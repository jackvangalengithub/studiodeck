"""Studio setup, permissions and business-aware websites; isolated data, no external services."""
from pathlib import Path
import http.cookiejar, json, os, socket, sqlite3, subprocess, tempfile, time, urllib.request, urllib.error

ROOT = Path(__file__).resolve().parents[1]

class Client:
    def __init__(self, base):
        self.base, self.csrf, self.studio = base, '', ''
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def call(self, action, body=None, expected=200, csrf=True, raw=False):
        headers = {'Content-Type': 'application/json'}
        if csrf: headers['X-CSRF-Token'] = self.csrf
        if self.studio: headers['X-Studio-ID'] = self.studio
        request = urllib.request.Request(self.base+'/api.php?action='+action, headers=headers,
                                         data=json.dumps(body).encode() if body is not None else None)
        try: response = self.opener.open(request)
        except urllib.error.HTTPError as error: response = error
        data = response.read()
        assert response.code == expected, (action, response.code, data[:500])
        return data if raw else json.loads(data)

    def settings_logo(self, fields, image=None, expected=200):
        boundary = 'studiodeck-test-logo-boundary'
        parts = []
        for key, value in fields.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        if image is not None:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="logo"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + image + b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())
        request = urllib.request.Request(self.base+'/api.php?action=studio_theme', data=b''.join(parts), headers={'Content-Type': 'multipart/form-data; boundary='+boundary, 'X-CSRF-Token': self.csrf, 'X-Studio-ID': self.studio})
        try: response = self.opener.open(request)
        except urllib.error.HTTPError as error: response = error
        data = response.read()
        assert response.code == expected, (response.code, data[:500])
        return json.loads(data)

    def login(self, email, log):
        self.call('request_login', {'email': email})
        token = log.read_text().strip().splitlines()[-1].split('/#/login/')[1]
        self.call('consume_login', {'token': token})
        session = self.call('session'); self.csrf = session['csrf']
        return session

with tempfile.TemporaryDirectory(prefix='studio-setup-') as temp:
    root = Path(temp); log = root/'mail.log'; database = root/'test.sqlite'
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    env = {**os.environ, 'APP_ENV': 'local', 'APP_URL': base, 'DATABASE_PATH': str(database),
           'WEBSITE_STORAGE_PATH': str(root/'sites'), 'MAIL_LOG_PATH': str(log),
           'MAIL_TRANSPORT': 'log', 'OPENAI_API_KEY': '', 'STRIPE_SECRET_KEY': '', 'DESIGNER_EMAILS': ''}
    with open(root/'server.log', 'w') as output:
        server = subprocess.Popen([os.environ.get('PHP_BIN', 'php'), '-S', f'127.0.0.1:{port}',
                                   '-t', str(ROOT/'public'), str(ROOT/'public/router.php')],
                                  env=env, stdout=output, stderr=output)
        try:
            owner = Client(base)
            for _ in range(60):
                try: owner.call('session'); break
                except urllib.error.URLError: time.sleep(.1)
            session = owner.login('setup@example.test', log); sid = session['studio']['id']
            assert session['studio']['setup_completed_at'] is None
            assert session['studio']['business_type'] == 'interior'
            payload = {'name': 'Willow & Wild', 'language': 'nl', 'business_type': 'landscape'}
            Client(base).call('complete_studio_setup', payload, expected=401)
            owner.call('complete_studio_setup', payload, expected=403, csrf=False)
            for invalid in [{'name': '  '}, {'language': 'zz'}, {'business_type': 'invalid'}, {'business_type': []}]:
                owner.call('complete_studio_setup', payload | invalid, expected=400)
            assert owner.call('session')['studio'] == session['studio'], 'Validation must be atomic'
            result = owner.call('complete_studio_setup', payload)
            assert result['studio']['setup_completed_at']
            for key, value in payload.items(): assert result['studio'][key] == value
            assert not result['billing']['needs_onboarding'], 'Completing the wizard also completes billing onboarding'
            assert result['billing']['trial_active']
            trial_end = result['billing']['trial_ends_at']
            assert abs(trial_end - time.time() - 7*86400) < 3
            owner.call('complete_studio_setup', payload | {'name': 'Stale tab', 'business_type': 'events'})
            assert owner.call('session')['studio'] == result['studio'], 'A retry cannot overwrite completed setup'
            assert owner.call('session')['billing']['trial_ends_at'] == trial_end, 'Retries cannot restart a trial'
            print('PASS Persistent, validated, CSRF-protected setup with safe retries')

            other = owner.call('create_studio', {'name': 'Second studio'}, expected=201)
            assert other['studio']['setup_completed_at'] is None
            second = owner.call('complete_studio_setup', {'name': 'Second studio', 'language': 'en', 'business_type': 'architecture'})
            assert not second['billing']['needs_onboarding'] and not second['billing']['trial_active'], 'Another studio does not grant a second trial'
            owner.call('switch_studio', {'studio_id': sid})
            assert owner.call('session')['studio']['business_type'] == 'landscape'
            stranger = Client(base); stranger.login('stranger@example.test', log); stranger.studio = sid
            stranger.call('complete_studio_setup', payload, expected=404)
            member = Client(base); member_session = member.login('member@example.test', log)
            with sqlite3.connect(database) as connection:
                connection.execute("INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,?,'member')", (sid, member_session['user']['id']))
            member.studio = sid
            member.call('complete_studio_setup', payload, expected=403)
            member.call('studio_theme', {'business_type': 'events'}, expected=403)
            print('PASS Studios are independent and members cannot change studio identity')

            assert owner.call('session')['studio_theme']['font'] == 'serif'
            owner.call('studio_theme', {'theme': {'font': 'sans', 'palette': 'ocean'}})
            assert member.call('session')['studio_theme'] == {'palette': 'warmgray', 'style': 'editorial', 'font': 'sans'}
            owner.call('studio_theme', {'name': 'Font persists'})
            assert owner.call('session')['studio_theme']['font'] == 'sans', 'Unrelated settings preserve the font'
            member.call('studio_theme', {'theme': {'font': 'serif'}}, expected=403)
            before = owner.call('session')['studio']
            owner.call('studio_theme', {'name': 'Invalid font', 'theme': {'font': 'unknown'}}, expected=400)
            assert owner.call('session')['studio'] == before
            owner.call('studio_theme', {'theme': 'sans'}, expected=400)
            owner.call('switch_studio', {'studio_id': second['studio']['id']})
            assert owner.call('session')['studio_theme']['font'] == 'serif', 'Studios have independent fonts'
            owner.call('switch_studio', {'studio_id': sid})
            assert owner.call('session')['studio_theme']['font'] == 'sans'
            font = owner.opener.open(base+'/assets/dm-sans-variable.ttf')
            assert font.headers.get_content_type() == 'font/ttf' and len(font.read()) > 10000
            owner.call('studio_theme', {'theme': {'font': 'serif'}})
            assert member.call('session')['studio_theme']['font'] == 'serif'
            print('PASS Shared studio font persists, validates, serves DM Sans and respects admin/studio boundaries')

            import struct, zlib
            def chunk(kind, data):
                return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
            png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\x44\x55\x66\xff')) + chunk(b'IEND', b'')
            owner.settings_logo({'name': 'Logo studio', 'theme': json.dumps({'font': 'sans'})}, png)
            assert owner.call('session')['studio']['has_logo']
            assert owner.call('session')['studio_theme']['font'] == 'sans'
            before = owner.call('session')['studio']
            owner.settings_logo({'name': 'Must roll back'}, b'not an image', expected=400)
            assert owner.call('session')['studio'] == before
            member.settings_logo({'remove_logo': '1'}, expected=403)
            assert owner.call('session')['studio']['has_logo']
            owner.settings_logo({'remove_logo': '1', 'language': 'invalid'}, expected=400)
            assert owner.call('session')['studio']['has_logo']
            owner.settings_logo({'remove_logo': '1', 'name': 'Without logo'})
            assert not owner.call('session')['studio']['has_logo']
            assert owner.call('session')['studio']['name'] == 'Without logo'
            assert owner.call('session')['studio_theme']['font'] == 'sans'
            print('PASS Logo and studio settings save together, reject invalid uploads atomically and restrict removal to admins')

            types = json.loads((ROOT/'public/assets/studio-types.json').read_text())
            # The asset catalog is served through the authenticated gateway.
            assert len(json.load(owner.opener.open(base+'/assets/studio-types.json'))) == len(types)
            for item in types:
                owner.call('studio_theme', {'business_type': item['id'], 'language': 'en'})
                site = owner.call('website')
                assert [t['id'] for t in site['templates'][:3]] == item['templates']
                assert len(site['templates']) == 29 and sum(t['recommended'] for t in site['templates']) == 3
                example = owner.call('website_template_preview&template='+item['templates'][0], raw=True).decode()
                assert item['en']['headline'] in example
                assert item['en']['projectTitle'] in example
                if item['id'] != 'interior': assert 'Interior design' not in example
            print('PASS All business types have matching template previews and three recommendations')

            owner.call('studio_theme', payload)
            site = owner.call('website')
            site = owner.call('website_start', {'template': 'panorama', 'revision': site['revision']})
            assert site['draft']['business_type'] == 'landscape'
            assert site['draft']['language'] == 'nl'
            assert 'dichter bij de natuur' in site['draft']['files']['index.html']
            saved = site['draft']; revision = site['revision']
            owner.call('studio_theme', {'business_type': 'events', 'language': 'en'})
            changed = owner.call('website')
            assert changed['draft'] == saved and changed['revision'] == revision
            before = owner.call('session')['studio']
            owner.call('studio_theme', {'business_type': 'architecture', 'language': 'invalid', 'name': 'Wrong'}, expected=400)
            assert owner.call('session')['studio'] == before
            owner.call('studio_theme', {'business_type': 'bogus'}, expected=400)
            assert owner.call('session')['studio'] == before
            print('PASS Editable settings update recommendations without changing existing website content')
        finally:
            server.terminate(); server.wait()
