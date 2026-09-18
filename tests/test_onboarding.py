"""Empty-studio detection through the real HTTP API, using an isolated SQLite DB."""
import unittest
from test_billing import BillingTests


class OnboardingTests(BillingTests):
    def test_empty_studio_includes_archived_and_private_projects(self):
        session = self.login()
        studio = session['studio']['id']
        self.assertIs(self.call('projects')['studio_empty'], True)
        project = self.project()
        self.assertIs(self.call('projects')['studio_empty'], False)
        self.call('project_settings', {'project_id': project['project_id'], 'archived': True})
        listing = self.call('projects')
        self.assertEqual(listing['projects'], [])
        self.assertIs(listing['studio_empty'], False)
        # A studio member with no project access must not receive a new-studio welcome.
        self.sql('UPDATE studio_billing SET legacy_exempt=1 WHERE studio_id=?', (studio,))
        self.call('save_studio_user', {'email': 'member@example.test', 'name': 'Member', 'role': 'member'})
        member = self.new_client()
        self.login('member@example.test', client=member, onboard=False)
        hidden = self.call('projects', client=member, extra={'X-Studio-ID': studio})
        self.assertEqual(hidden['projects'], [])
        self.assertIs(hidden['studio_empty'], False)
        self.assertNotIn(project['project_id'], str(hidden))
        # Other studios do not affect eligibility; switching back restores the result.
        second = self.call('create_studio', {'name': 'Fresh studio'}, 201)
        self.assertIs(self.call('projects', extra={'X-Studio-ID': second['studio']['id']})['studio_empty'], True)
        self.assertIs(self.call('projects', extra={'X-Studio-ID': studio})['studio_empty'], False)
        # Only the authenticated practice entry point permits same-origin framing.
        for route, policy in [('/index.html', 'DENY'), ('/index.html?app-tour=1', 'SAMEORIGIN')]:
            response = self.client['opener'].open(self.base+route)
            self.assertEqual(response.headers['X-Frame-Options'], policy)
            if policy == 'SAMEORIGIN':
                self.assertEqual(response.headers['Content-Security-Policy'], "frame-ancestors 'self'")
        # Existing file authentication also covers the tour and its caption tracks.
        for asset, mime in [('tour.webm', 'video/webm'), ('tour-en.vtt', 'text/vtt'), ('tour-nl.vtt', 'text/vtt')]:
            response = self.client['opener'].open(self.base+'/assets/onboarding/'+asset)
            self.assertIn(mime, response.headers['Content-Type'])
            self.assertGreater(len(response.read()), 20)


if __name__ == '__main__':
    unittest.main(defaultTest='OnboardingTests.test_empty_studio_includes_archived_and_private_projects')
