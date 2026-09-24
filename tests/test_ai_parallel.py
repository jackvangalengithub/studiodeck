"""Real PHP/curl_multi requests against a threaded, delayed local API."""
import argparse
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MockAPI(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), Handler)
        self.lock = threading.Lock()
        self.active = self.peak = 0
        self.events = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        text = body['messages'][1]['content'][0]['text']
        if text.startswith('PAGE '):
            request = json.loads(re.search(r'\nText:\n(.*?)\nNative image geometry:', text, re.S)[1])
        else:
            request = json.loads(text)
        number = request['number']
        with self.server.lock:
            self.server.active += 1
            self.server.peak = max(self.server.peak, self.server.active)
            event = {'number': number, 'start': time.time()}
            self.server.events.append(event)
        try:
            time.sleep(request.get('delay', 0.02))
            mode = request.get('response', 'ok')
            page = {'number': 999 if mode == 'wrong_page' else number, 'content_type': 'photo', 'strategy': 'preserve', 'regions': []}
            content = '{broken' if mode == 'bad_content' else json.dumps(page)
            payload = b'{broken' if mode == 'bad_json' else json.dumps({'choices': [{'message': {'content': content}}]}).encode()
            # Mark service work complete before publishing the response. The client
            # may refill its slot before this handler thread reaches finally.
            with self.server.lock:
                event['end'] = time.time()
                self.server.active -= 1
            self.send_response(429 if mode == 'http_error' else 200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with self.server.lock:
                if 'end' not in event:
                    event['end'] = time.time()
                    self.server.active -= 1


def run_case(requests, concurrency=4, **options):
    server = MockAPI()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        config = {'url': f'http://127.0.0.1:{server.server_port}/', 'requests': requests, 'concurrency': concurrency, **options}
        result = subprocess.run(['php', str(ROOT / 'tests/ai_parallel_runner.php')], input=json.dumps(config), text=True, capture_output=True, timeout=40,
                                env={**os.environ, 'OPENAI_API_KEY': '', 'DOCUMENT_PAGE_CONCURRENCY': str(concurrency)})
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)
        output = json.loads(result.stdout)
        output['peak'] = server.peak
        output['events'] = list(server.events)
        output['logs'] = result.stderr
        return output
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class ParallelTests(unittest.TestCase):
    def test_overlap_order_refill_and_lazy_payloads(self):
        result = run_case([{'number': 1, 'delay': .6}, *[{'number': n, 'delay': .1} for n in range(2, 7)]], 2)
        self.assertEqual(result['peak'], 2)
        self.assertEqual(list(result['results']), [str(n) for n in range(1, 7)])
        self.assertEqual([r['data']['number'] for r in result['results'].values()], list(range(1, 7)))
        events = {e['number']: e for e in result['events']}
        self.assertLess(events[3]['start'], events[1]['end'])
        self.assertGreaterEqual(result['built'][2]['time'], events[2]['start'] + .08)
        self.assertEqual(result['live_handles'], 0)
        self.assertEqual(result['reports'][-1]['completed'], 6)
        self.assertTrue(all(r['active'] <= 2 for r in result['reports']))

    def test_sequential_and_empty(self):
        result = run_case([{'number': n} for n in range(1, 4)], 1)
        self.assertEqual(result['peak'], 1)
        self.assertEqual(result['live_handles'], 0)
        empty = run_case([])
        self.assertEqual(empty['peak'], 0)
        self.assertEqual(empty['reports'][-1]['completed'], 0)

    def test_failures_are_isolated_without_retries(self):
        result = run_case([{'number': 1, 'response': 'http_error'}, {'number': 2, 'response': 'bad_json'}, {'number': 3, 'response': 'bad_content'}, {'number': 4, 'factory_error': True}, {'number': 5}])
        self.assertTrue(all('error' in result['results'][str(n)] for n in range(1, 5)))
        self.assertEqual(result['results']['5']['data']['number'], 5)
        self.assertEqual(len(result['events']), 4)
        self.assertEqual(result['live_handles'], 0)

    def test_timeout_does_not_cancel_other_pages(self):
        result = run_case([{'number': 1, 'delay': .4}, {'number': 2}], timeout_ms=150)
        self.assertIn('error', result['results']['1'])
        self.assertEqual(result['results']['2']['data']['number'], 2)
        self.assertEqual(result['live_handles'], 0)

    def test_cleanup_when_progress_callback_aborts(self):
        result = run_case([{'number': n} for n in range(1, 7)], abort=True)
        self.assertEqual(result['live_handles'], 0)
        self.assertEqual(len(result['built']), 4)
        self.assertEqual(result['peak'], 0)

    def test_page_integration_and_progress(self):
        result = run_case([{'number': 1, 'delay': .2}, {'number': 2, 'response': 'wrong_page'}, {'number': 3, 'preview': False}, {'number': 4}, {'number': 5, 'missing': True}], mode='pages')
        self.assertEqual(list(result['results']), ['1', '4'])
        self.assertEqual(len(result['warnings']), 2)
        self.assertIn('Page 2:', result['warnings'][0])
        self.assertIn('Page 5:', result['warnings'][1])
        self.assertEqual(len(result['events']), 3)
        progress = [h['progress'] for h in result['heartbeats']]
        self.assertEqual(progress[-1], {'stage': 'classifying_pages', 'completed': 4, 'total': 4, 'active': 0})
        self.assertEqual([p['completed'] for p in progress], sorted(p['completed'] for p in progress))
        self.assertEqual(result['live_handles'], 0)
        log = json.loads(result['logs'].splitlines()[-1])
        self.assertEqual((log['pages'], log['concurrency'], log['failures']), (4, 4, 2))

    def test_heartbeat_while_waiting(self):
        result = run_case([{'number': 1, 'delay': 5.6}], mode='pages')
        waiting = [h for h in result['heartbeats'] if h['progress']['active'] == 1 and h['progress']['completed'] == 0]
        self.assertGreaterEqual(len(waiting), 2)
        self.assertLess(waiting[1]['time'] - waiting[0]['time'], 5.5)
        self.assertNotEqual(waiting[0]['started_at'], waiting[1]['started_at'])
        self.assertTrue(all(h['job'] == 'fixture-job' for h in waiting))

    def test_configuration_defaults(self):
        for value, expected in [('0', 4), ('9', 4), ('invalid', 4), ('1', 1), ('8', 8)]:
            with self.subTest(value=value):
                result = run_case([], concurrency=value, mode='pages')
                self.assertEqual(result['configured_concurrency'], expected)


def benchmark():
    requests = [{'number': n, 'delay': .5} for n in range(1, 9)]
    runs = {1: [], 4: []}
    expected = None
    for _ in range(3):
        for concurrency in (1, 4):
            result = run_case(requests, concurrency)
            assert result['peak'] == concurrency, (concurrency, result['peak'], result['events'])
            assert max(report['active'] for report in result['reports']) == concurrency
            assert result['live_handles'] == 0
            assert all('data' in item for item in result['results'].values())
            expected = result['results'] if expected is None else expected
            assert result['results'] == expected
            runs[concurrency].append(result['elapsed'])
    sequential, parallel = (statistics.median(runs[n]) for n in (1, 4))
    report = {'benchmark': 'local mock API; eight pages, 500 ms/request, three runs per setting', 'sequential_median_seconds': round(sequential, 3), 'parallel_median_seconds': round(parallel, 3), 'speedup': round(sequential / parallel, 2), 'waiting_reduction_percent': round(100 * (1 - parallel / sequential), 1), 'peak_active_requests': {'sequential': 1, 'parallel': 4}, 'failures': 0, 'identical_results': True}
    print(json.dumps(report, indent=2))
    assert parallel < sequential * .6, report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--benchmark', action='store_true')
    args = parser.parse_args()
    if args.benchmark:
        benchmark()
    else:
        unittest.main(argv=[__file__], verbosity=2)
