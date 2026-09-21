"""HTTP security regression tests for identity, tenant and asset isolation.

Run: PHP_BIN=php python3 tests/test_security.py -v
Requires PHP with pdo_sqlite and gd. Uses only Python's standard library.
Every test gets a migrated temporary database, seeded identities and a loopback
server. No worker, real mail, external API, existing database or .env is used.
Client fixtures use identity cookies with a selected share. Separate tests reject
the legacy sessionless bearer path and client escalation into studio rights.
See docs/security-review.md for enforced policy and deployment requirements.
"""

import hashlib
from http.cookies import SimpleCookie
import http.cookiejar
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import struct
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zlib


ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('PHP_BIN', 'php')
DENIED = (401, 403, 404)
READ_ACTIONS = {
    'project_testimonials', 'project_testimonial_photo',
    'mention_people',
    'conversation', 'conversation_file',
    'website', 'website_sources', 'website_source_image', 'website_asset', 'website_preview', 'website_template_preview', 'website_export',
    'project_access', 'billing', 'billing_invoices', 'project_export',
    'drive_status', 'drive_list', 'drive_callback', 'session', 'projects',
    'project', 'deck', 'file', 'document_page', 'slide_image', 'studio_users',
    'activity_feed', 'comments_feed', 'studio_logo', 'resolve_slide', 'profile',
    'comment_preview', 'project_cover', 'studio_starting_pack', 'pack_file',
    'project_starting_pack',
    'destinations', 'client_project', 'destination_cover',
}
PUBLIC_ACTIONS = {'session', 'request_login', 'consume_login'}
WRITE_ACTIONS = {
    'project_testimonial_save', 'project_testimonial_delete',
    'conversation_revoke',
    'communication_post', 'confirmation_decide', 'communication_upload',
    'website_reset', 'website_start', 'website_save', 'website_import', 'website_upload', 'website_publish', 'website_restore', 'website_undo',
    'website_chat', 'website_checkout', 'website_refresh_billing', 'website_domain',
    'project_activate', 'billing_checkout', 'billing_resume_checkout', 'billing_cancel_checkout', 'billing_cancel_change',
    'billing_change_preview', 'billing_change_confirm', 'billing_refresh', 'billing_portal', 'billing_onboard', 'billing_coverage',
    'generate_open_questions', 'save_open_question', 'reply_open_question', 'add_client_question',
    'request_login', 'consume_login', 'logout', 'create_studio', 'switch_studio',
    'lock_iteration', 'save_project_person', 'remove_project_person', 'add_project_pack_slide', 'comment_answered',
    'save_studio_user', 'remove_studio_user', 'project_members',
    'upload_studio_logo', 'remove_studio_logo', 'save_pack_item',
    'archive_pack_item', 'apply_project_pack', 'drive_connect',
    'drive_disconnect', 'drive_import', 'project_settings', 'pin_project',
    'prepare_delete_project', 'delete_project', 'save_profile', 'upload_avatar',
    'remove_avatar', 'read_comments', 'comment', 'view_event', 'budget_chat',
    'budget_choice', 'upload_project_logo', 'remove_project_logo',
    'create_project', 'new_iteration', 'upload', 'reprocess', 'category',
    'studio_theme', 'theme', 'match_subquotes', 'review_subquote',
    'unlink_subquote', 'save_budget', 'save_contact', 'share', 'revoke_share',
    'retry_job', 'select_slide_image', 'reorder_slide_groups', 'add_slide_group', 'remove_slide_group',
    'slide_layout', 'save_slide', 'add_system_slide', 'slide_image_edit', 'image_edit',
    'save_project_client', 'remove_project_client',
}
PROJECT_WRITES = {
    'generate_open_questions', 'save_open_question',
    'lock_iteration', 'save_project_person', 'remove_project_person', 'add_project_pack_slide', 'comment_answered',
    'project_settings', 'project_members', 'new_iteration', 'reprocess',
    'category', 'theme', 'match_subquotes', 'save_budget', 'save_contact',
    'share', 'revoke_share', 'retry_job', 'select_slide_image',
    'reorder_slide_groups', 'add_slide_group', 'remove_slide_group', 'slide_layout', 'save_slide', 'add_system_slide',
    'slide_image_edit', 'image_edit', 'remove_project_logo', 'apply_project_pack',
    'review_subquote', 'unlink_subquote',
}
SQL_PAYLOADS = [
    "' OR 1=1--", "' OR '1'='1", "' UNION SELECT NULL--",
    "'; DROP TABLE projects;--", "'/**/OR/**/1=1--", '" OR 1=1--',
    "' AND (SELECT randomblob(1)) IS NOT NULL--",
]


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def png(marker):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    color = hashlib.sha256(marker.encode()).digest()[:3]
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 2, 2, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress((b'\0' + color * 2) * 2)) + chunk(b'IEND', b''))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, base, session=None, bearer=None, client_share=None):
        self.base, self.session, self.bearer = base, session, bearer
        self.client_share = client_share
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect(),
            urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, path, data=None, headers=None, method=None, multipart=False):
        h = {}
        if self.session:
            h.update({'Cookie': 'studiodeck_session=' + self.session,
                      'X-CSRF-Token': 'csrf-' + self.session})
        if self.bearer:
            h['Authorization'] = 'Bearer ' + self.bearer
        if self.client_share:
            h['Authorization'] = 'Client ' + self.client_share
        if multipart:
            boundary = 'security-test-boundary'
            body = b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode()
                            for k, v in (data or {}).items())
            body += (f'--{boundary}\r\nContent-Disposition: form-data; name="files[]"; filename="security.png"\r\nContent-Type: image/png\r\n\r\n').encode()
            body += png('upload') + f'\r\n--{boundary}--\r\n'.encode()
            h['Content-Type'] = 'multipart/form-data; boundary=' + boundary
        else:
            body = None if data is None else json.dumps(data).encode()
            if body is not None:
                h['Content-Type'] = 'application/json'
        h.update(headers or {})
        request = urllib.request.Request(self.base + path, data=body, headers=h, method=method)
        try:
            response = self.opener.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.code, response.read(), dict(response.headers)

    def api(self, action, data=None, query=None, **kwargs):
        return self.request('/api.php?' + urllib.parse.urlencode({'action': action, **(query or {})}), data, **kwargs)


class SecurityFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep a run consistent even if another workspace task edits the app.
        cls.source_temp = tempfile.TemporaryDirectory(prefix='studiodeck-security-source-')
        cls.addClassCleanup(cls.source_temp.cleanup)
        cls.source = Path(cls.source_temp.name)
        for folder in ('app', 'public'):
            shutil.copytree(ROOT / folder, cls.source / folder)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='studiodeck-security-')
        self.addCleanup(self.temp.cleanup)
        self.tmp = Path(self.temp.name)
        self.database = self.tmp / 'security.sqlite'
        # Copy only executable source. In particular, do not load the workspace .env.
        for folder in ('app', 'public'):
            shutil.copytree(self.source / folder, self.tmp / folder)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', getattr(self, 'listen_port', 0)))
            port = sock.getsockname()[1]
        self.base = f'http://127.0.0.1:{port}'
        env = {k: v for k, v in os.environ.items() if k in ('PATH', 'HOME', 'LANG', 'LD_LIBRARY_PATH')}
        env.update(APP_ENV='local', APP_URL=self.base, DATABASE_PATH=str(self.database),
                   MAIL_LOG_PATH=str(self.tmp / 'mail.log'), MAIL_TRANSPORT='log',
                   OPENAI_API_KEY='', DESIGNER_EMAILS='', GOOGLE_DRIVE_CLIENT_ID='',
                   GOOGLE_DRIVE_CLIENT_SECRET='', GOOGLE_DRIVE_TOKEN_KEY='')
        result = subprocess.run([PHP, '-r', 'require $argv[1]; db();', str(self.tmp / 'app/bootstrap.php')],
                                env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'PHP needs pdo_sqlite: ' + result.stderr)
        self.seed()
        self.env = env
        output = open(self.tmp / 'server.log', 'w')
        self.addCleanup(output.close)
        self.server = subprocess.Popen([PHP, '-d', 'display_errors=0', '-S', f"{getattr(self, 'listen_host', '127.0.0.1')}:{port}",
                                        '-t', str(self.tmp / 'public'), str(self.tmp / 'public/router.php')],
                                       env=env, stdout=output, stderr=output)
        self.addCleanup(self.stop_server)
        self.anon = Client(self.base)
        for _ in range(100):
            try:
                if self.anon.api('session')[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            if self.server.poll() is not None:
                self.fail((self.tmp / 'server.log').read_text())
            time.sleep(.03)
        else:
            self.fail('Test server did not become ready')
        self.editor = Client(self.base, 'editor')
        self.admin = Client(self.base, 'admin')
        self.client = Client(self.base, 'client', client_share='client-share')

    def stop_server(self):
        self.server.terminate()
        try:
            self.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.server.kill()
            self.server.wait(timeout=5)

    def sql(self, sql, params=()):
        with sqlite3.connect(self.database) as db:
            return db.execute(sql, params).fetchall()

    def seed(self):
        with sqlite3.connect(self.database) as db:
            db.execute('PRAGMA foreign_keys=ON')

            def insert(table, **values):
                db.execute(f'INSERT INTO {table} ({",".join(values)}) VALUES ({",".join("?" for _ in values)})',
                           tuple(values.values()))

            for studio in ('studio-a', 'studio-b'):
                insert('studios', id=studio, name=studio, created_at='2026-01-01')
                insert('studio_billing', studio_id=studio, legacy_exempt=1, onboarded_at=1)
                insert('studio_logos', studio_id=studio, data=png(studio), mime='image/png')
                insert('studio_pack_items', id='pack-' + studio, studio_id=studio, kind='document')
                insert('studio_pack_versions', id='pack-version-' + studio, item_id='pack-' + studio,
                       revision=1, title='Template', name='template.png', mime='image/png',
                       data=png(studio), created_at='2026-01-01')
            for user, studio, role in [('editor', 'studio-a', 'member'), ('colleague', 'studio-a', 'member'),
                                       ('admin', 'studio-a', 'admin'), ('outsider', 'studio-b', 'admin')]:
                insert('users', id=user, email=user + '@example.test', name=user, created_at='2026-01-01')
                insert('studio_members', studio_id=studio, user_id=user, role=role)
                insert('sessions', token_hash=digest(user), user_id=user, studio_id=studio,
                       csrf='csrf-' + user, expires_at=int(time.time()) + 3600)
            insert('sessions', token_hash=digest('expired'), user_id='editor', studio_id='studio-a',
                   csrf='csrf-expired', expires_at=int(time.time()) - 1)
            insert('users', id='client', email='client@example.test', name='Client', created_at='2026-01-01')
            insert('sessions', token_hash=digest('client'), user_id='client', studio_id=None,
                   csrf='csrf-client', expires_at=int(time.time()) + 3600)
            for project, user, studio, visibility in [
                ('own', 'editor', 'studio-a', 'team'), ('shared', 'editor', 'studio-a', 'team'),
                ('private', 'colleague', 'studio-a', 'team'), ('public', 'colleague', 'studio-a', 'public'),
                ('foreign', 'outsider', 'studio-b', 'team'), ('foreignpublic', 'outsider', 'studio-b', 'public'),
            ]:
                iteration = 'iteration-' + project
                insert('projects', id=project, user_id=user, studio_id=studio, visibility=visibility,
                       name='Project ' + project, created_at='2026-01-01')
                insert('project_coverage', project_id=project, source='legacy')
                insert('project_members', project_id=project, user_id=user)
                insert('iterations', id=iteration, project_id=project, number=1, title=project,
                       status='shared' if project == 'shared' else 'draft', created_at='2026-01-01')
                insert('assets', id='asset-' + project, project_id=project, category='renders', created_at='2026-01-01')
                for suffix, parent, number in [('old-', None, 1), ('file-', 'old-' + project, 2)]:
                    data = png(suffix + project)
                    insert('file_versions', id=suffix + project, asset_id='asset-' + project, parent_id=parent,
                           number=number, name=suffix + project + '.png', mime='image/png', size=len(data),
                           sha256=hashlib.sha256(data).hexdigest(), data=data, preview=data, created_at='2026-01-01')
                insert('iteration_files', iteration_id=iteration, asset_id='asset-' + project,
                       version_id='file-' + project, category='renders')
                insert('document_pages', version_id='file-' + project, number=1, text='SECRET-' + project,
                       metadata='{}', preview=png('page-' + project))
                insert('document_images', version_id='file-' + project, page_number=1, number=1,
                       metadata='{}', data=png('crop-' + project))
                insert('slide_image_versions', id='variant-' + project, source_version_id='file-' + project,
                       mime='image/png', data=png('variant-' + project), metadata='{}', created_at='2026-01-01')
                insert('presentation_slides', id='slide-' + project, iteration_id=iteration,
                       source_version_id='file-' + project, type='render', title=project, position=0,
                       image_version_id='variant-' + project)
                insert('budget_items', id='budget-' + project, iteration_id=iteration, label='Budget ' + project,
                       amount_cents=10000, is_optional=1)
                insert('comments', id='comment-' + project, iteration_id=iteration, slide='intro',
                       author=user + '@example.test', body='SECRET-' + project, created_at='2026-01-01')
                insert('events', id='event-' + project, project_id=project, iteration_id=iteration,
                       actor=user + '@example.test', type='project_created', detail='SECRET-' + project, created_at='2026-01-01')
                insert('jobs', id='job-' + project, project_id=project, iteration_id=iteration,
                       version_id='file-' + project, type='ingest', status='failed', created_at='2026-01-01')
            insert('project_client_members', project_id='shared', email='client@example.test', name='Client', created_at='2026-01-01')
            for share, project, revoked, expiry in [('client-share', 'shared', 0, 3600),
                                                    ('revoked-share', 'shared', 1, 3600),
                                                    ('expired-share', 'shared', 0, -1)]:
                insert('shares', id=share, iteration_id='iteration-' + project, token_hash=digest(share),
                       email='client@example.test', revoked=revoked, expires_at=int(time.time()) + expiry,
                       created_at='2026-01-01')
                insert('share_aliases', token_hash=digest('alias-' + share), share_id=share)

    def ok(self, response, expected=200):
        status, body, _ = response
        self.assertEqual(status, expected, body[:250])
        return json.loads(body)

    def denied(self, response):
        status, body, _ = response
        self.assertIn(status, DENIED, f'Access should be denied; got {status}: {body[:160]!r}')
        self.assertNotIn(b'SECRET-', body)

    def read_cases(self, project):
        iteration = 'iteration-' + project
        common = {'iteration': iteration}
        return [
            ('project', {'id': project}), ('deck', common),
            ('file', {**common, 'id': 'file-' + project}),
            ('file', {**common, 'id': 'old-' + project}),
            ('file', {**common, 'id': 'file-' + project, 'preview': 1}),
            ('document_page', {**common, 'id': 'file-' + project, 'page': 1}),
            ('document_page', {**common, 'id': 'file-' + project, 'page': 1, 'preview': 1}),
            ('document_page', {**common, 'id': 'file-' + project, 'page': 1, 'image': 1}),
            ('slide_image', {**common, 'slide_id': 'slide-' + project}),
            ('slide_image', {**common, 'slide_id': 'slide-' + project, 'original': 1}),
            ('slide_image', {**common, 'slide_id': 'slide-' + project, 'image_version_id': 'variant-' + project}),
            ('comment_preview', {'id': 'comment-' + project}),
            ('project_cover', {'project_id': project}),
            ('resolve_slide', {**common, 'slide': 'slide-' + project}),
            ('project_starting_pack', common),
            ('client_project', {**common, 'project_id': project}),
            ('destination_cover', {**common, 'project_id': project}),
        ]

    def write_body(self, project):
        return dict(project_id=project, iteration='iteration-' + project, id='budget-' + project,
                    slide_id='slide-' + project, version_id='file-' + project, asset_id='asset-' + project,
                    name='Changed', location='Changed', title='Changed', label='Changed', type='render',
                    description='Changed', body='Client must not change this', selected=True, answered=True,
                    question='What is the total?', slide='intro', operation='hide', category='other',
                    theme={}, emails=['client@example.test'], email='contact@example.test',
                    user_ids=['editor'], order=['story', 'current', 'moodboards', 'designs', 'budget'],
                    image_version_id='variant-' + project, prompt='Change the image', changes=[])


class SecurityTests(SecurityFixture):
    def test_action_inventory_is_explicit(self):
        source = '\n'.join(p.read_text() for p in [self.source / 'public/api.php', *sorted((self.source / 'app').glob('*_api.php'))])
        discovered = set(re.findall(r"\$action\s*===\s*'([^']+)'", source))
        for group in re.findall(r"in_array\(\$action,\[([^\]]+)\]", source):
            discovered.update(re.findall(r"'([^']+)'", group))
        self.assertEqual(discovered, READ_ACTIONS | WRITE_ACTIONS,
                         'New endpoints need an explicit security classification')

    def test_anonymous_invalid_and_expired_sessions_cannot_read_project_data(self):
        for session in (None, 'forged', 'expired'):
            client = Client(self.base, session)
            for project in ('own', 'public', 'foreign'):
                for action, query in self.read_cases(project):
                    with self.subTest(session=session, project=project, action=action, query=query):
                        self.denied(client.api(action, query=query))

    def test_all_nonpublic_api_actions_require_authentication(self):
        query = dict(self.write_body('own'), studio_id='studio-a', version='pack-version-studio-a',
                     folder='root', slide='slide-own')
        query['id'] = 'comment-own'
        for session in (None, 'forged', 'expired'):
            client = Client(self.base, session)
            for action in sorted((READ_ACTIONS | WRITE_ACTIONS) - PUBLIC_ACTIONS):
                with self.subTest(session=session, action=action):
                    self.denied(client.api(action, query=query) if action in READ_ACTIONS
                                else client.api(action, self.write_body('own')))

    def test_app_routes_and_assets_require_a_session(self):
        paths = ['/', '/index.html', '/choose', '/client/projects/shared', '/studio-a/projects', '/studio-a/projects/own',
                 '/studio-a/slide/slide-own', '/studio-a/users', '/studio-a/activity',
                 '/studio-a/comments', '/studio-a/settings', '/studio-a/profile']
        paths += ['/' + str(p.relative_to(self.source / 'public')) for p in sorted((self.source / 'public/assets').rglob('*')) if p.is_file()]
        for session in (None, 'forged', 'expired'):
            for path in paths:
                with self.subTest(session=session, path=path):
                    response = Client(self.base, session).request(path)
                    # A redirect must actually lead to a dedicated authentication entry.
                    if response[0] in (302, 303, 307):
                        self.assertEqual(urllib.parse.urlparse(response[2].get('Location', '')).path, '/login')
                        self.assertNotIn(b'<div id="app"', response[1])
                    else:
                        self.denied(response)

    def test_source_storage_and_traversal_paths_are_not_served(self):
        for path in ('/.env', '/.git/config', '/app/schema.sql', '/app/bootstrap.php',
                     '/storage/studiodeck.sqlite', '/storage/studiodeck.sqlite-wal', '/storage/mail.log',
                     '/api.php/../app/bootstrap.php', '/assets/../../.env', '/assets/%2e%2e/%2e%2e/.env',
                     '/%2e%2e/app/schema.sql', '/assets/%252e%252e/.env'):
            with self.subTest(path=path):
                self.denied(self.anon.request(path))

    def test_studio_project_lists_and_feeds_are_scoped(self):
        expected = {'own', 'shared', 'public'}
        self.assertEqual({p['id'] for p in self.ok(self.editor.api('projects'))['projects']}, expected)
        for action in ('activity_feed', 'comments_feed'):
            with self.subTest(action=action):
                items = self.ok(self.editor.api(action))['items']
                self.assertEqual({i['project_id'] for i in items}, {'own', 'shared'} if action == 'comments_feed' else expected)
                self.assertEqual(self.ok(self.editor.api(action, query={'project_id': 'private'}))['items'], [])

    def test_studio_members_read_own_and_public_projects_and_files(self):
        for project in ('own', 'public'):
            for action, query in self.read_cases(project):
                with self.subTest(project=project, action=action, query=query):
                    if action in ('client_project', 'destination_cover'):
                        continue  # Explicit client access requires a client invitation.
                    response = self.editor.api(action, query=query)
                    self.assertEqual(response[0], 200, response[1][:200])
                    if action == 'file':
                        self.assertEqual(response[1], png(query['id']))
            self.assertEqual(self.ok(self.editor.api('project', query={'id': project}))['can_edit'], project == 'own')

    def test_studio_members_cannot_read_other_private_or_foreign_projects(self):
        for actor in (self.editor, self.admin):
            for project in ('private', 'foreign', 'foreignpublic'):
                for action, query in self.read_cases(project):
                    with self.subTest(actor=actor.session, project=project, action=action, query=query):
                        self.denied(actor.api(action, query=query))
        for action, query in [('studio_logo', {'studio_id': 'studio-b'}),
                              ('pack_file', {'version': 'pack-version-studio-b'})]:
            with self.subTest(action=action):
                self.denied(self.editor.api(action, query=query))

    def test_studio_headers_and_iteration_ids_cannot_change_scope(self):
        for action in ('projects', 'studio_users', 'activity_feed'):
            with self.subTest(action=action):
                self.denied(self.editor.api(action, headers={'X-Studio-ID': 'studio-b'}))
        for project in ('private', 'public', 'foreign'):
            with self.subTest(project=project):
                self.denied(self.editor.api('project', query={'id': 'own', 'iteration': 'iteration-' + project}))

    def test_authenticated_routes_enforce_project_and_studio_scope(self):
        for actor in (self.editor, self.client):
            for path in ('/studio-a/projects/private', '/studio-b/projects/foreign',
                         '/studio-b/settings', '/studio-a/slide/slide-private', '/client/projects/private'):
                with self.subTest(actor=actor.session, path=path):
                    self.denied(actor.request(path))

    def test_studio_member_can_edit_own_project_and_upload_files(self):
        self.ok(self.editor.api('project_settings', {'project_id': 'own', 'location': 'Authorized edit'}))
        self.assertEqual(self.sql('SELECT location FROM projects WHERE id=?', ('own',)), [('Authorized edit',)])
        self.ok(self.editor.api('save_slide', {'iteration': 'iteration-own', 'slide_id': 'intro', 'title': 'Authorized title'}))
        response = self.ok(self.editor.api('upload', {'iteration': 'iteration-own'}, multipart=True), 201)
        self.assertTrue(response)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM iteration_files WHERE iteration_id=?', ('iteration-own',)), [(2,)])

    def test_studio_member_cannot_edit_other_projects_including_public(self):
        tables = ('projects', 'iterations', 'assets', 'file_versions', 'iteration_files',
                  'presentation_slides', 'budget_items', 'project_members', 'contacts')
        before = {table: self.sql(f'SELECT * FROM {table} ORDER BY rowid') for table in tables}
        for project in ('private', 'public', 'foreign'):
            for action in sorted(PROJECT_WRITES):
                with self.subTest(project=project, action=action):
                    body = self.write_body(project)
                    if action == 'retry_job':
                        body['id'] = 'job-' + project
                    if action == 'revoke_share':
                        continue
                    self.denied(self.editor.api(action, body))
            with self.subTest(project=project, action='upload'):
                self.denied(self.editor.api('upload', {'iteration': 'iteration-' + project}, multipart=True))
        self.assertEqual(self.sql('SELECT location FROM projects WHERE id IN (?,?,?)', ('private', 'public', 'foreign')), [('',)] * 3)
        self.assertEqual({table: self.sql(f'SELECT * FROM {table} ORDER BY rowid') for table in tables}, before)

    def test_studio_member_cannot_revoke_another_projects_share(self):
        for project in ('private', 'public', 'foreign'):
            self.sql('UPDATE shares SET iteration_id=? WHERE id=?', ('iteration-' + project, 'client-share'))
            with self.subTest(project=project):
                self.denied(self.editor.api('revoke_share', {'id': 'client-share'}))
                self.assertEqual(self.sql('SELECT revoked FROM shares WHERE id=?', ('client-share',)), [(0,)])

    def test_admin_nonmember_cannot_delete_public_project(self):
        response = self.admin.api('prepare_delete_project', {'project_id': 'public'})
        with self.subTest(stage='prepare'):
            self.denied(response)
        if response[0] == 200:
            confirmation = json.loads(response[1])['confirmation']
            response = self.admin.api('delete_project', {'project_id': 'public', 'confirmation': confirmation,
                                                        'name': 'Project public', 'acknowledged': True})
            with self.subTest(stage='delete'):
                self.denied(response)
        with self.subTest(stage='project_preserved'):
            self.assertEqual(self.sql('SELECT COUNT(*) FROM projects WHERE id=?', ('public',)), [(1,)])

    def test_client_can_view_only_assigned_presentation_and_its_files(self):
        for action, query in self.read_cases('shared'):
            if action in ('project', 'project_cover', 'resolve_slide', 'project_starting_pack'):
                continue  # Studio-only endpoints; client uses deck and slide_image.
            with self.subTest(action=action, query=query):
                response = self.client.api(action, query=query)
                self.assertEqual(response[0], 200, response[1][:200])
                if action == 'file':
                    self.assertEqual(response[1], png(query['id']))
        deck = self.ok(self.client.api('deck'))
        self.assertEqual(deck['project']['id'], 'shared')
        self.assertFalse(deck.get('can_edit', False))
        for field in ('shares', 'jobs', 'events', 'iterations'):
            self.assertNotIn(field, deck)

    def test_client_cannot_view_other_projects_even_if_public(self):
        for project in ('own', 'private', 'public', 'foreign', 'foreignpublic'):
            for action, query in self.read_cases(project):
                with self.subTest(project=project, action=action, query=query):
                    self.denied(self.client.api(action, query=query))
        for action in ('projects', 'studio_users', 'activity_feed', 'comments_feed', 'studio_starting_pack'):
            with self.subTest(action=action):
                self.denied(self.client.api(action))

    def test_authorized_iteration_cannot_be_combined_with_foreign_file_ids(self):
        for actor, iteration in ((self.editor, 'iteration-own'), (self.client, 'iteration-shared')):
            for project in ('private', 'public', 'foreign'):
                for action, query in self.read_cases(project):
                    if action not in ('file', 'document_page', 'slide_image'):
                        continue
                    query['iteration'] = iteration
                    with self.subTest(actor=actor.session or 'client', action=action, query=query):
                        self.denied(actor.api(action, query=query))
                with self.subTest(actor=actor.session or 'client', variant=project):
                    self.denied(actor.api('slide_image', query={'iteration': iteration,
                                'slide_id': 'slide-' + iteration.removeprefix('iteration-'),
                                'image_version_id': 'variant-' + project}))

    def test_client_cannot_call_studio_write_endpoints(self):
        excluded = PUBLIC_ACTIONS | {'communication_post', 'confirmation_decide', 'communication_upload', 'logout', 'comment', 'view_event', 'budget_chat', 'budget_choice',
                                     'save_profile', 'upload_avatar', 'remove_avatar', 'read_comments', 'comment_answered', 'reply_open_question', 'add_client_question'}
        # Successful forbidden operations must not alter the identity of later
        # cases (e.g. create_studio could otherwise grant admin to this client).
        with sqlite3.connect(self.database) as original, sqlite3.connect(':memory:') as snapshot:
            original.backup(snapshot)
            for action in sorted(WRITE_ACTIONS - excluded):
                snapshot.backup(original)
                with self.subTest(action=action):
                    body = self.write_body('shared')
                    if action == 'revoke_share':
                        body['id'] = 'client-share'
                    elif action == 'retry_job':
                        body['id'] = 'job-shared'
                    self.denied(self.client.api(action, body))
            snapshot.backup(original)
        for action in ('upload', 'upload_project_logo'):
            with self.subTest(action=action, encoding='multipart'):
                self.denied(self.client.api(action, {'iteration': 'iteration-shared', 'project_id': 'shared'}, multipart=True))

    def test_client_can_logout_and_cannot_reuse_the_cookie(self):
        self.ok(self.client.api('logout', {}))
        self.denied(self.client.api('deck'))
        self.denied(self.client.api('file', query={'id': 'file-shared'}))

    def test_client_cookie_and_share_selector_cannot_impersonate_another_client(self):
        for actor in (self.anon, self.editor, Client(self.base, 'expired')):
            for action in ('deck', 'file'):
                with self.subTest(actor=actor.session, action=action):
                    self.denied(actor.api(action, query={'id': 'file-shared'},
                                          headers={'Authorization': 'Client client-share'}))
        self.sql('UPDATE shares SET email=? WHERE id=?', ('other-client@example.test', 'client-share'))
        self.denied(self.client.api('deck'))
        self.denied(self.client.api('file', query={'id': 'file-shared'}))

    def test_client_account_destinations_contain_only_assigned_projects(self):
        destinations = self.ok(self.client.api('destinations'))
        self.assertEqual(destinations['studios'], [])
        self.assertEqual({p['id'] for p in destinations['projects']}, {'shared'})
        selected = self.ok(self.client.api('client_project', query={'project_id': 'shared'}))
        self.assertEqual(selected['share_id'], 'client-share')
        self.sql('UPDATE shares SET expires_at=? WHERE id=?', (int(time.time()) - 1, 'client-share'))
        self.denied(self.client.api('deck'))
        self.denied(self.client.api('file', query={'id': 'file-shared'}))
        self.assertEqual(self.ok(self.client.api('destinations'))['projects'], [])

    def test_client_can_comment_ask_questions_and_approve_own_budget(self):
        for action in ('comment', 'budget_choice', 'budget_chat', 'view_event'):
            with self.subTest(action=action):
                self.ok(self.client.api(action, self.write_body('shared')))
        self.assertEqual(self.sql('SELECT author FROM comments WHERE body=?', ('Client must not change this',)),
                         [('client@example.test',)])
        self.assertEqual(self.sql('SELECT selected,updated_by FROM budget_choices WHERE budget_item_id=?',
                                 ('budget-shared',)), [(1, 'client@example.test')])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM budget_choices WHERE budget_item_id<>?', ('budget-shared',)), [(0,)])

    def test_client_engagement_requires_csrf_and_cannot_target_other_projects(self):
        for action in ('comment', 'budget_choice', 'budget_chat', 'view_event'):
            with self.subTest(action=action, case='missing_csrf'):
                self.denied(self.client.api(action, self.write_body('shared'), headers={'X-CSRF-Token': ''}))
            for project in ('own', 'private', 'public', 'foreign'):
                with self.subTest(action=action, project=project):
                    self.denied(self.client.api(action, self.write_body(project)))
        with self.subTest(case='foreign_budget_id_with_own_iteration'):
            self.denied(self.client.api('budget_choice', {**self.write_body('shared'), 'id': 'budget-private'}))
        with self.subTest(case='foreign_comment_read'):
            self.denied(self.client.api('read_comments', {'ids': ['comment-private']}))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comments'), [(6,)])
        self.assertEqual(self.sql('SELECT * FROM budget_choices'), [])

    def test_share_token_alone_is_not_a_logged_in_session(self):
        for bearer in ('client-share', 'alias-client-share'):
            client = Client(self.base, bearer=bearer)
            self.assertIsNone(self.ok(client.api('session'))['user'])
            for action, query in [('deck', {}), ('file', {'id': 'file-shared'}),
                                  ('document_page', {'id': 'file-shared', 'page': 1}),
                                  ('slide_image', {'slide_id': 'slide-shared'})]:
                with self.subTest(bearer=bearer, action=action):
                    self.denied(client.api(action, query=query))

    def test_revoked_expired_and_forged_shares_and_aliases_are_denied(self):
        for bearer in ('forged', 'revoked-share', 'expired-share', 'alias-revoked-share', 'alias-expired-share'):
            client = Client(self.base, bearer=bearer)
            for action, query in [('deck', {}), ('file', {'id': 'file-shared'}),
                                  ('document_page', {'id': 'file-shared'}),
                                  ('slide_image', {'slide_id': 'slide-shared'}),
                                  ('comment_preview', {'id': 'comment-shared'}), ('profile', {})]:
                with self.subTest(bearer=bearer, action=action):
                    self.denied(client.api(action, query=query))
        alias = Client(self.base, bearer='alias-client-share')
        self.sql('UPDATE shares SET revoked=1 WHERE id=?', ('client-share',))
        self.denied(alias.api('file', query={'id': 'file-shared'}))
        self.denied(self.client.api('deck'))

    def test_logout_and_membership_removal_take_effect_immediately(self):
        self.ok(self.editor.api('logout', {}))
        self.denied(self.editor.api('file', query={'iteration': 'iteration-own', 'id': 'file-own'}))
        colleague = Client(self.base, 'colleague')
        self.sql('DELETE FROM project_members WHERE user_id=?', ('colleague',))
        self.denied(colleague.api('project', query={'id': 'private'}))
        self.denied(colleague.api('project_settings', {'project_id': 'public', 'location': 'denied'}))
        self.sql('DELETE FROM studio_members WHERE user_id=?', ('colleague',))
        self.denied(colleague.api('project', query={'id': 'public'}))

    def test_csrf_and_http_methods_protect_studio_writes(self):
        for csrf in ('', 'wrong', 'csrf-admin'):
            with self.subTest(csrf=csrf):
                self.denied(self.editor.api('project_settings', {'project_id': 'own', 'location': 'denied'},
                                            headers={'X-CSRF-Token': csrf}))
        self.assertEqual(self.editor.api('project_settings', query={'project_id': 'own'})[0], 405)
        self.assertEqual(self.sql('SELECT location FROM projects WHERE id=?', ('own',)), [('',)])

    def test_login_token_is_single_use_expiring_and_not_fixated(self):
        self.ok(self.anon.api('request_login', {'email': 'editor@example.test'}))
        token = (self.tmp / 'mail.log').read_text().strip().split('/#/login/')[-1]
        response = self.anon.api('consume_login', {'token': token})
        self.ok(response)
        cookie = response[2]['Set-Cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Lax', cookie)
        self.assertNotIn('studiodeck_session=editor;', cookie)
        parsed = SimpleCookie(cookie)['studiodeck_session']
        self.assertEqual(int(parsed['max-age']), 14 * 86400)
        stored = self.sql('SELECT user_id,expires_at FROM sessions WHERE token_hash=?', (digest(parsed.value),))
        self.assertEqual(stored[0][0], 'editor')
        self.assertLessEqual(abs(stored[0][1] - int(time.time()) - 14 * 86400), 3)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM login_tokens WHERE token_hash=?', (digest(token),)), [(0,)])
        self.assertEqual(self.ok(self.anon.api('session'))['user']['id'], 'editor')
        self.ok(self.anon.api('project', query={'id': 'own'}))
        self.denied(self.anon.api('project', query={'id': 'private'}))
        self.denied(Client(self.base).api('consume_login', {'token': token}))
        self.sql('INSERT INTO login_tokens VALUES(?,?,?)', (digest('expired-login'), 'editor', int(time.time()) - 1))
        self.denied(Client(self.base).api('consume_login', {'token': 'expired-login'}))
        self.sql('UPDATE sessions SET expires_at=? WHERE token_hash=?', (int(time.time()) - 1, digest(parsed.value)))
        self.assertIsNone(self.ok(self.anon.api('session'))['user'])
        self.denied(self.anon.api('project', query={'id': 'own'}))

    def test_client_email_login_does_not_grant_studio_creation_rights(self):
        self.sql('UPDATE shares SET email=? WHERE id=?', ('new-client@example.test', 'client-share'))
        self.sql('UPDATE project_client_members SET email=? WHERE project_id=?', ('new-client@example.test', 'shared'))
        self.ok(self.anon.api('request_login', {'email': 'new-client@example.test'}))
        token = (self.tmp / 'mail.log').read_text().strip().split('/#/login/')[-1]
        self.ok(self.anon.api('consume_login', {'token': token}))
        session = self.ok(self.anon.api('session'))
        self.assertEqual(session['user']['email'], 'new-client@example.test')
        destinations = self.ok(self.anon.api('destinations'))
        self.assertEqual({p['id'] for p in destinations['projects']}, {'shared'})
        self.assertEqual(self.ok(self.anon.api('deck', headers={'Authorization': 'Client client-share'}))['project']['id'], 'shared')
        self.denied(Client(self.base).api('consume_login', {'token': token}))
        with self.subTest(check='no_studio_membership'):
            self.assertEqual(session['studios'], [])
        with self.subTest(check='no_project_creation'):
            self.denied(self.anon.api('create_project', {'name': 'Client-created project'},
                                     headers={'X-CSRF-Token': session['csrf']}))
        with self.subTest(check='no_studio_creation'):
            self.denied(self.anon.api('create_studio', {'name': 'Client-created studio'},
                                     headers={'X-CSRF-Token': session['csrf']}))

    def test_client_invitation_uses_one_time_cookie_login(self):
        link = self.ok(self.editor.api('share', {'iteration': 'iteration-own',
                                                'emails': ['invited@example.test']}))['links'][0]['url']
        # A designer must NEVER receive another account's login credential.
        self.assertEqual(urllib.parse.urlparse(link).fragment, '')
        self.assertEqual(urllib.parse.urlparse(link).path, '/client/projects/own')
        mail = json.loads((self.tmp / 'mail.log.messages.jsonl').read_text().splitlines()[-1])
        self.assertEqual(mail['to'], 'invited@example.test')
        token = re.search(r'/#/login/([a-f0-9]{64})', mail['text']).group(1)
        self.assertNotIn(token, link)
        response = self.anon.api('consume_login', {'token': token})
        with self.subTest(check='exchange'):
            self.ok(response)
            self.assertIn('studiodeck_session=', response[2].get('Set-Cookie', ''))
        if response[0] == 200:
            self.assertEqual(self.ok(self.anon.api('session'))['user']['email'], 'invited@example.test')
            self.denied(Client(self.base).api('consume_login', {'token': token}))
            self.denied(Client(self.base, bearer=token).api('deck'))

    def test_sql_injection_cannot_bypass_authentication(self):
        for payload in SQL_PAYLOADS:
            for credential in ('session', 'bearer', 'login'):
                with self.subTest(payload=payload, credential=credential):
                    if credential == 'session':
                        response = Client(self.base, payload).api('projects')
                    elif credential == 'bearer':
                        response = Client(self.base, bearer=payload).api('deck')
                    else:
                        response = self.anon.api('consume_login', {'token': payload})
                    self.denied(response)
            with self.subTest(payload=payload, credential='email'):
                response = self.anon.api('request_login', {'email': payload})
                self.assertEqual(response[0], 400, response[1])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM projects'), [(6,)])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM login_tokens'), [(0,)])

    def test_sql_injection_ids_filters_headers_and_pagination(self):
        for payload in SQL_PAYLOADS:
            cases = [('project', {'id': payload}), ('deck', {'iteration': payload}),
                     ('file', {'iteration': 'iteration-own', 'id': payload}),
                     ('document_page', {'iteration': 'iteration-own', 'id': payload}),
                     ('slide_image', {'iteration': 'iteration-own', 'slide_id': payload}),
                     ('comment_preview', {'id': payload}), ('resolve_slide', {'slide': payload}),
                     ('pack_file', {'version': payload})]
            for action, query in cases:
                with self.subTest(payload=payload, action=action):
                    self.denied(self.editor.api(action, query=query))
            with self.subTest(payload=payload, action='studio_header'):
                self.denied(self.editor.api('projects', headers={'X-Studio-ID': payload}))
            with self.subTest(payload=payload, action='client_header'):
                self.denied(self.client.api('deck', headers={'Authorization': 'Client ' + payload}))
            with self.subTest(payload=payload, action='client_project'):
                self.denied(self.client.api('client_project', query={'project_id': payload}))
            for action in ('activity_feed', 'comments_feed'):
                with self.subTest(payload=payload, action=action):
                    self.assertEqual(self.ok(self.editor.api(action, query={'project_id': payload}))['items'], [])
                    items = self.ok(self.editor.api(action, query={'offset': payload}))['items']
                    self.assertEqual({x['project_id'] for x in items}, {'own', 'shared'} if action == 'comments_feed' else {'own', 'shared', 'public'})
        self.assertEqual(self.sql('SELECT COUNT(*) FROM projects'), [(6,)])

    def test_sql_payloads_remain_literal_text_and_cannot_update_other_rows(self):
        for payload in SQL_PAYLOADS:
            with self.subTest(payload=payload):
                self.ok(self.editor.api('project_settings', {'project_id': 'own', 'location': payload}))
                self.assertEqual(self.sql('SELECT location FROM projects WHERE id=?', ('own',)), [(payload,)])
                self.denied(self.editor.api('project_settings', {'project_id': payload, 'location': 'injected'}))
                self.ok(self.editor.api('save_slide', {'iteration': 'iteration-own', 'slide_id': 'intro', 'title': payload}))
                self.assertEqual(self.sql('SELECT title FROM slide_content WHERE iteration_id=?', ('iteration-own',)), [(payload,)])
                response = self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'intro', 'operation': payload})
                self.assertEqual(response[0], 400, response[1])
        self.assertEqual(self.sql('SELECT location FROM projects WHERE id<>?', ('own',)), [('',)] * 5)
        self.assertEqual(self.sql('PRAGMA integrity_check'), [('ok',)])
        self.assertEqual(self.sql('PRAGMA foreign_key_check'), [])


    def invitation(self, email='client@example.test'):
        link = self.ok(self.editor.api('share', {'iteration': 'iteration-own', 'emails': [email]}))['links'][0]
        mail = json.loads((self.tmp / 'mail.log.messages.jsonl').read_text().splitlines()[-1])
        token = re.search(r'/#/login/([a-f0-9]{64})', mail['text']).group(1)
        return link, token

    def test_inviter_never_receives_recipient_account_credentials(self):
        link, token = self.invitation('outsider@example.test')
        self.assertNotIn(token, json.dumps(link))
        self.assertNotIn('/login/', link['url'])
        self.denied(self.editor.api('project', query={'id': 'foreign'}))
        self.denied(self.editor.api('deck', headers={'Authorization': 'Client ' + link['id']}))
        # Only the mailbox credential can sign in as this existing studio admin.
        mailbox = Client(self.base)
        self.ok(mailbox.api('consume_login', {'token': token}))
        self.assertEqual(self.ok(mailbox.api('session'))['user']['id'], 'outsider')
        self.ok(mailbox.api('project', query={'id': 'foreign'}))

    def test_pending_invitation_login_checks_revocation_expiry_and_membership(self):
        for invalidate in ('revoke', 'expire', 'remove', 'delete'):
            with self.subTest(invalidate=invalidate):
                link, token = self.invitation()
                if invalidate == 'revoke':
                    self.ok(self.editor.api('revoke_share', {'id': link['id']}))
                elif invalidate == 'expire':
                    self.sql('UPDATE shares SET expires_at=0 WHERE id=?', (link['id'],))
                elif invalidate == 'remove':
                    self.sql('DELETE FROM project_client_members WHERE project_id=?', ('own',))
                else:
                    self.sql('DELETE FROM shares WHERE id=?', (link['id'],))
                self.denied(Client(self.base).api('consume_login', {'token': token}))

    def test_invitation_expires_and_only_one_concurrent_redemption_succeeds(self):
        from concurrent.futures import ThreadPoolExecutor
        _, token = self.invitation()
        self.sql('UPDATE login_tokens SET expires_at=0 WHERE token_hash=?', (digest(token),))
        self.denied(Client(self.base).api('consume_login', {'token': token}))
        _, token = self.invitation()
        with ThreadPoolExecutor(max_workers=4) as pool:
            codes = list(pool.map(lambda _: Client(self.base).api('consume_login', {'token': token})[0], range(4)))
        self.assertEqual(codes.count(200), 1)
        self.assertEqual(codes.count(403), 3)

    def test_delete_confirmation_does_not_survive_permission_removal(self):
        self.sql('INSERT INTO project_members VALUES(?,?)', ('public', 'admin'))
        for remove in ('team', 'admin'):
            with self.subTest(remove=remove):
                confirmation = self.ok(self.admin.api('prepare_delete_project', {'project_id': 'public'}))['confirmation']
                if remove == 'team':
                    self.sql('DELETE FROM project_members WHERE project_id=? AND user_id=?', ('public', 'admin'))
                else:
                    self.sql("UPDATE studio_members SET role='member' WHERE user_id='admin'")
                self.denied(self.admin.api('delete_project', {'project_id': 'public', 'confirmation': confirmation,
                                                            'name': 'Project public', 'acknowledged': True}))
                if remove == 'team':
                    self.sql('INSERT INTO project_members VALUES(?,?)', ('public', 'admin'))
        self.assertEqual(self.sql("SELECT COUNT(*) FROM projects WHERE id='public'"), [(1,)])

    def test_studio_configuration_requires_admin(self):
        for action, body in [('studio_theme', {'name': 'Unauthorized rename'}), ('remove_studio_logo', {})]:
            with self.subTest(action=action):
                self.denied(self.editor.api(action, body))
                self.ok(self.admin.api(action, body))

    def test_account_with_two_studios_must_authorize_each_resource(self):
        self.sql("INSERT INTO studio_members(studio_id,user_id) VALUES('studio-b','editor')")
        self.ok(self.editor.api('project', query={'id': 'foreignpublic'}, headers={'X-Studio-ID': 'studio-b'}))
        self.denied(self.editor.api('project', query={'id': 'foreign'}, headers={'X-Studio-ID': 'studio-b'}))
        self.denied(self.editor.api('project', query={'id': 'own'}, headers={'X-Studio-ID': 'studio-b'}))
        self.ok(self.editor.api('project', query={'id': 'own'}, headers={'X-Studio-ID': 'studio-a'}))
        self.sql("DELETE FROM studio_members WHERE studio_id='studio-b' AND user_id='editor'")
        self.denied(self.editor.api('project', query={'id': 'foreignpublic'}, headers={'X-Studio-ID': 'studio-b'}))

    def test_login_entry_is_public_but_protected_assets_are_not_cached(self):
        for path in ('/login', '/auth/login.js', '/auth/login.css'):
            self.assertEqual(self.anon.request(path)[0], 200)
        for path in ('/', '/assets/app.js', '/assets/app.css', '/studio-a/projects/own'):
            response = self.editor.request(path)
            self.assertEqual(response[0], 200, response[1][:100])
            self.assertEqual(response[2]['Cache-Control'], 'no-store')
        self.assertEqual(self.client.request('/client/projects/shared')[0], 200)
        self.denied(self.editor.request('/studio-a/projects/own?iteration=iteration-private'))
        self.denied(self.editor.request('/studio-a/slide/slide-own?project=private'))

    def test_client_resolve_thread_requires_csrf_and_valid_assignment(self):
        body = {'iteration': 'iteration-shared', 'id': 'comment-shared', 'answered': True}
        self.denied(self.client.api('comment_answered', body, headers={'X-CSRF-Token': ''}))
        self.ok(self.client.api('comment_answered', body))
        self.denied(self.editor.api('comment_answered', {'iteration': 'iteration-public', 'id': 'comment-public', 'answered': True}))
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.denied(self.client.api('comment_answered', body))

    def test_client_grant_does_not_expose_unshared_draft(self):
        self.sql("INSERT INTO iterations(id,project_id,number,title,status,created_at) VALUES('unshared','shared',2,'Private','draft','now')")
        self.denied(self.client.api('deck', query={'iteration': 'unshared'}))
        self.denied(self.client.request('/client/projects/shared?iteration=unshared'))
        self.denied(self.client.api('client_project', query={'project_id': 'shared', 'iteration': 'unshared'}))


    def test_every_protected_write_requires_csrf(self):
        for action in sorted(WRITE_ACTIONS - PUBLIC_ACTIONS):
            with self.subTest(action=action):
                self.denied(self.editor.api(action, self.write_body('own'), headers={'X-CSRF-Token': ''}))

    def test_notification_mail_uses_private_credentials_and_rechecks_revocation(self):
        link, _ = self.invitation()
        self.ok(self.editor.api('comment', {'iteration': 'iteration-own', 'slide': 'intro', 'body': 'A private update'}))
        queued = self.sql('SELECT url FROM email_outbox')
        self.assertTrue(queued)
        self.assertNotIn('/login/', queued[0][0])
        def dispatch():
            result = subprocess.run([PHP, '-r', 'require $argv[1]; dispatch_comment_email();',
                                     str(self.tmp / 'app/bootstrap.php')], env=self.env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        dispatch()
        messages = (self.tmp / 'mail.log.messages.jsonl').read_text().splitlines()
        mail = json.loads(messages[-1])
        self.assertEqual(mail['to'], 'client@example.test')
        self.assertEqual(mail['subject'], 'New comment on your design presentation')
        token = re.search(r'/#/login/([a-f0-9]{64})', mail['text']).group(1)
        self.ok(self.editor.api('comment', {'iteration': 'iteration-own', 'slide': 'intro', 'body': 'Cancelled update'}))
        self.ok(self.editor.api('revoke_share', {'id': link['id']}))
        dispatch()
        self.assertEqual((self.tmp / 'mail.log.messages.jsonl').read_text().splitlines(), messages)
        self.assertTrue(self.sql("SELECT 1 FROM email_outbox WHERE status='cancelled'"))
        self.denied(Client(self.base).api('consume_login', {'token': token}))


if __name__ == '__main__':
    unittest.main()
