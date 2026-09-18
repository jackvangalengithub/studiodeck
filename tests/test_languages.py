"""Language persistence and authorization against an isolated real PHP API."""
import unittest
from test_security import SecurityFixture, Client


class LanguageTests(SecurityFixture):
    def test_defaults_settings_and_client_profile(self):
        session = self.ok(self.admin.api('session'))
        self.assertEqual(session['studio']['language'], 'en')
        self.assertEqual(session['user']['profile']['language'], '')
        self.ok(self.admin.api('studio_theme', {'language': 'nl'}))
        deck = self.ok(self.client.api('deck'))
        self.assertEqual(deck['project']['studio_language'], 'nl')
        self.assertEqual(deck['project']['language'], '')
        self.assertEqual(deck['profile']['language'], '')
        self.ok(self.editor.api('project_settings', {'project_id': 'shared', 'language': 'en'}))
        deck = self.ok(self.client.api('deck'))
        self.assertEqual(deck['project']['language'], 'en')
        self.assertEqual(deck['project']['studio_language'], 'nl')
        self.ok(self.client.api('save_profile', {'name': 'Client', 'email_comments': True, 'language': 'nl'}))
        self.assertEqual(self.ok(self.client.api('deck'))['profile']['language'], 'nl')
        # A fresh request/session sees saved settings, and unrelated edits preserve them.
        client = Client(self.base, 'client', client_share='client-share')
        self.assertEqual(self.ok(client.api('profile'))['profile']['language'], 'nl')
        self.ok(client.api('save_profile', {'name': 'New name', 'email_comments': False}))
        self.ok(self.editor.api('project_settings', {'project_id': 'shared', 'location': 'Utrecht'}))
        self.ok(self.admin.api('studio_theme', {'name': 'Dutch studio'}))
        deck = self.ok(client.api('deck'))
        self.assertEqual((deck['project']['language'], deck['project']['studio_language'], deck['profile']['language']), ('en', 'nl', 'nl'))
        self.ok(client.api('save_profile', {'name': 'New name', 'language': ''}))
        self.ok(self.editor.api('project_settings', {'project_id': 'shared', 'language': ''}))
        deck = self.ok(client.api('deck'))
        self.assertEqual(deck['project']['language'], '')
        self.assertEqual(deck['profile']['language'], '')
        # Switching projects uses that project's studio, not the active studio.
        foreign = self.ok(Client(self.base, 'outsider').api('project', query={'id': 'foreign'}))
        self.assertEqual(foreign['project']['studio_language'], 'en')

    def test_budget_answers_follow_viewer_language(self):
        self.ok(self.admin.api('studio_theme', {'language': 'nl'}))
        answer = self.ok(self.client.api('budget_chat', {'iteration': 'iteration-shared', 'question': 'Wat is het totaal?', 'slide': 'budget'}))
        self.assertTrue(answer['answer'].startswith('Het vastgelegde totaal is €'), answer)
        self.ok(self.client.api('save_profile', {'name': 'Client', 'language': 'en'}))
        answer = self.ok(self.client.api('budget_chat', {'iteration': 'iteration-shared', 'question': 'What is the total?', 'slide': 'budget'}))
        self.assertTrue(answer['answer'].startswith('The recorded total is €'), answer)

    def test_login_copy_is_public_without_exposing_app_assets(self):
        response = self.anon.request('/login')
        self.assertEqual(response[0], 200)
        self.assertIn(b'Welcome to Studiodeck.', response[1])
        self.assertIn(b'login-translations', response[1])
        self.assertIn(b'Welkom bij Studiodeck.', response[1])
        self.assertNotIn(b'{{login_', response[1])
        self.assertEqual(self.anon.request('/assets/languages/nl.js')[0], 401)
        self.assertEqual(self.anon.request('/assets/i18n.js')[0], 401)

    def test_validation_and_permissions(self):
        self.denied(self.editor.api('studio_theme', {'language': 'nl'}))
        self.denied(self.client.api('studio_theme', {'language': 'nl'}))
        self.denied(self.client.api('project_settings', {'project_id': 'shared', 'language': 'nl'}))
        self.denied(self.editor.api('project_settings', {'project_id': 'foreign', 'language': 'nl'}))
        self.denied(self.client.api('save_profile', {'name': 'Client', 'language': 'nl'}, headers={'X-CSRF-Token': 'invalid'}))
        for invalid in ('fr', 'NL', None, [], 1):
            for actor, action, body in (
                (self.admin, 'studio_theme', {'language': invalid, 'name': 'Should not save'}),
                (self.editor, 'project_settings', {'project_id': 'shared', 'language': invalid, 'location': 'Should not save'}),
                (self.client, 'save_profile', {'name': 'Should not save', 'language': invalid}),
            ):
                with self.subTest(action=action, invalid=invalid):
                    self.assertEqual(actor.api(action, body)[0], 400)
        self.assertEqual(self.admin.api('studio_theme', {'language': ''})[0], 400)
        session = self.ok(self.admin.api('session'))
        self.assertEqual(session['studio']['language'], 'en')
        self.assertEqual(session['studio']['name'], 'studio-a')
        self.assertEqual(self.ok(self.client.api('deck'))['project']['location'], '')
        self.assertEqual(self.ok(self.client.api('profile'))['profile']['name'], 'Client')

    def test_existing_database_migration_is_idempotent(self):
        # Remove only this feature's migration from the isolated fixture.
        self.sql("DELETE FROM migrations WHERE name='languages-v1'")
        for table in ('studios', 'projects', 'person_profiles'):
            self.sql(f'ALTER TABLE {table} DROP COLUMN language')
        self.assertEqual(self.ok(self.admin.api('session'))['studio']['language'], 'en')
        self.ok(self.admin.api('studio_theme', {'language': 'nl'}))
        self.assertEqual(self.ok(self.admin.api('session'))['studio']['language'], 'nl')
        self.assertEqual(self.sql("SELECT COUNT(*) FROM migrations WHERE name='languages-v1'")[0][0], 1)


if __name__ == '__main__':
    unittest.main()
