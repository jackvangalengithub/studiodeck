"""Isolated HTTP and worker tests. No paid AI calls or real email."""
import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path

from test_security import Client, SecurityFixture, PHP, ROOT


class OpenQuestionTests(SecurityFixture):
    def seed(self):
        super().seed()
        # These fixture projects represent existing, entitled studios.
        if self.sql("SELECT 1 FROM sqlite_master WHERE name='studio_billing'"):
            self.sql("INSERT OR IGNORE INTO studio_billing(studio_id,legacy_exempt,onboarded_at) SELECT id,1,1 FROM studios")
            self.sql("INSERT OR IGNORE INTO project_coverage(project_id,source) SELECT id,'legacy' FROM projects")

    def save(self, project='shared', **fields):
        return self.ok(self.editor.api('save_open_question', {
            'iteration': 'iteration-' + project, 'question': 'Is installation included?',
            'kind': 'clarification', 'published': False, **fields}))['id']

    def deck(self, actor=None, project='shared'):
        return self.ok((actor or self.editor).api('deck', query={'iteration': 'iteration-' + project}))

    def php(self, code):
        result = subprocess.run([PHP, '-r', "require 'app/ai.php'; " + code],
                                cwd=self.tmp, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result.stdout

    def generate(self, suggestions, extra=''):
        (self.tmp / 'suggestions.json').write_text(json.dumps({'questions': suggestions}))
        self.php("generate_open_questions('iteration-shared', function($prompt,$context){" + extra +
                 "return json_decode(file_get_contents('suggestions.json'),true);});")

    def test_private_review_replies_activity_and_access(self):
        self.assertEqual(self.deck()['slide_groups']['questions'], 'Open questions')
        qid = self.save()
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        if os.environ.get('OPEN_QUESTIONS_BROWSER_EXPORT'):
            payload={'session': self.ok(self.editor.api('session')), 'deck': self.ok(self.editor.api('project', query={'id': 'shared'}))}
            Path(os.environ['OPEN_QUESTIONS_BROWSER_EXPORT']).write_text(json.dumps(payload))
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Guessing a draft ID'}))
        self.save(id=qid, kind='answered', answer='The designer will confirm the scope.', published=True)
        self.assertEqual(self.deck(self.client)['open_questions'][0]['answer'], 'The designer will confirm the scope.')
        self.ok(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Please include removal too.'}))
        question = self.deck()['open_questions'][0]
        self.assertEqual(question['replies'][0]['author'], 'client@example.test')
        events = self.ok(self.editor.api('project', query={'id': 'shared'}))['events']
        self.assertTrue(any(e['type'] == 'open_question_reply' and 'removal' in e['detail'] for e in events))
        for actor in (self.client, Client(self.base, 'outsider'), self.anon):
            self.denied(actor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid}))
            self.denied(actor.api('generate_open_questions', {'iteration': 'iteration-shared'}))
        self.denied(self.editor.api('save_open_question', {'iteration': 'iteration-shared'}, headers={'X-CSRF-Token': ''}))
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-own', 'id': qid, 'body': 'No'}))
        self.denied(self.editor.api('reply_open_question', {'iteration': 'iteration-own', 'id': qid, 'body': 'Wrong iteration'}))
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid, 'operation': 'dismiss'}))
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Hidden'}))

    def test_grounding_dedup_regeneration_and_stale_answers(self):
        self.sql('UPDATE document_pages SET text=? WHERE version_id=?', ('Installation is included. Delivery is excluded.', 'file-shared'))
        answered = {'question': 'Is installation included?', 'kind': 'answered', 'answer': 'Installation is included.',
                    'citations': [{'key': 'file-shared:1', 'quote': 'Installation is included.'}]}
        self.generate([answered, {'question': 'Is delivery included?', 'kind': 'answered', 'answer': 'Yes.',
                                 'citations': [{'key': 'file-private:1', 'quote': 'Installation is included.'}]}])
        questions = self.deck()['open_questions']
        q = next(q for q in questions if q['question'] == answered['question'])
        bad = next(q for q in questions if q['question'] != answered['question'])
        self.assertEqual(q['answer'], answered['answer'])
        self.assertEqual(q['citations'][0]['page'], 1)
        self.assertEqual((bad['answer'], bad['kind']), ('', 'clarification'))
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        self.save(id=q['id'], kind='answered', answer=answered['answer'], published=True)
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': bad['id'], 'operation': 'dismiss'}))
        self.ok(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': q['id'], 'body': 'Thank you'}))
        self.generate([answered, {'question': 'Is delivery included?', 'kind': 'clarification'},
                       {'question': 'Which finish would you prefer?', 'kind': 'preference'}])
        questions = self.deck()['open_questions']
        self.assertEqual(len(questions), 3)
        self.assertEqual(next(x for x in questions if x['id'] == q['id'])['replies'][0]['body'], 'Thank you')
        self.assertEqual(next(x for x in questions if x['id'] == bad['id'])['dismissed'], 1)
        self.sql('UPDATE document_pages SET text=? WHERE version_id=?', ('Installation now needs confirmation.', 'file-shared'))
        # Updating extracted source text simulates completed reprocessing.
        self.sql('UPDATE file_versions SET extracted_text=? WHERE id=?', ('Installation now needs confirmation.', 'file-shared'))
        stale = self.deck(self.client)['open_questions'][0]
        self.assertTrue(stale['stale'])
        self.assertEqual(stale['answer'], '')

    def test_locked_content_conversations_and_iteration_snapshots(self):
        qid = self.save(published=True)
        resolved = self.save(question='A completed decision', published=True)
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': resolved, 'operation': 'resolve'}))
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        self.ok(self.editor.api('generate_open_questions', {'iteration': 'iteration-shared'}), 409)
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid, 'operation': 'dismiss'}), 409)
        self.ok(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Continue our discussion'}))
        self.ok(self.client.api('add_client_question', {'iteration': 'iteration-shared', 'question': 'When can we meet?'}))
        iid = self.ok(self.editor.api('new_iteration', {'iteration': 'iteration-shared'}), 201)['id']
        questions = self.ok(self.editor.api('deck', query={'iteration': iid}))['open_questions']
        self.assertEqual(len(questions), 2)
        copied = next(q for q in questions if q['id'] == qid)
        self.assertFalse(copied['stale'])
        self.assertEqual(len(copied['replies']), 1)
        self.ok(self.editor.api('reply_open_question', {'iteration': iid, 'id': qid, 'body': 'Next iteration only'}))
        self.assertEqual(len(next(q for q in self.deck(self.client)['open_questions'] if q['id'] == qid)['replies']), 1)
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.denied(self.client.api('add_client_question', {'iteration': 'iteration-shared', 'question': 'Revoked'}))

    def test_queue_worker_fallback_and_failure_preservation(self):
        self.ok(self.editor.api('generate_open_questions', {'iteration': 'iteration-shared'}), 202)
        self.ok(self.editor.api('generate_open_questions', {'iteration': 'iteration-shared'}), 202)
        self.assertEqual(self.sql("SELECT COUNT(*) FROM jobs WHERE type='open_questions'")[0][0], 1)
        shutil.copytree(ROOT / 'scripts', self.tmp / 'scripts')
        result = subprocess.run([PHP, 'scripts/worker.php', '--once'], cwd=self.tmp, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.sql("SELECT status,error FROM jobs WHERE type='open_questions'")[0], ('done', ''))
        questions = self.deck()['open_questions']
        self.assertTrue(questions)
        self.assertEqual(questions[0]['origin'], 'source_helper')
        self.php("try {generate_open_questions('iteration-shared',function(){throw new RuntimeException('provider unavailable');});}catch(Throwable $e){}")
        self.assertEqual(self.deck()['open_questions'], questions)
        # Ingest completion schedules suggestions without another API call.
        self.sql("UPDATE jobs SET status='queued' WHERE id='job-own'")
        result = subprocess.run([PHP, 'scripts/worker.php', '--once'], cwd=self.tmp, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.sql("SELECT status FROM jobs WHERE type='open_questions' AND iteration_id='iteration-own'")[0][0], 'queued')


if __name__ == '__main__':
    unittest.main()
