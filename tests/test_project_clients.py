"""Project client rosters and per-iteration recipient access, with isolated data.
Run: PHP_BIN=php python3 tests/test_project_clients.py -v
"""
import json
import unittest

from test_security import Client, SecurityFixture, png


class ProjectClientTests(SecurityFixture):
    def add(self, email, name='Client', project='own', actor=None):
        return self.ok((actor or self.editor).api('save_project_client',
                       {'project_id': project, 'email': email, 'name': name}))['clients']

    def send(self, emails, iteration='iteration-own'):
        return self.ok(self.editor.api('share', {'iteration': iteration, 'client_emails': emails}))['links']

    def account(self, email):
        client = Client(self.base)
        self.ok(client.api('request_login', {'email': email}))
        token = (self.tmp / 'mail.log').read_text().strip().split('/#/login/')[-1]
        self.ok(client.api('consume_login', {'token': token}))
        return client

    def test_project_client_list_is_independent_of_team_and_invitations(self):
        members = self.sql('SELECT * FROM project_members ORDER BY project_id')
        shares = self.sql('SELECT * FROM shares ORDER BY id')
        users = self.sql('SELECT * FROM users ORDER BY id')
        clients = self.add('Alice@Example.Test', 'Alice')
        self.assertEqual([(c['name'], c['email']) for c in clients], [('Alice', 'alice@example.test')])
        self.add('alice@example.test', 'Alice Updated')
        self.assertEqual(self.sql('SELECT name FROM project_client_members WHERE project_id=?', ('own',)), [('Alice Updated',)])
        self.assertEqual(self.sql('SELECT * FROM project_members ORDER BY project_id'), members)
        self.assertEqual(self.sql('SELECT * FROM shares ORDER BY id'), shares)
        self.assertEqual(self.sql('SELECT * FROM users ORDER BY id'), users)
        self.assertFalse((self.tmp / 'mail.log.messages.jsonl').exists())
        self.assertEqual(self.ok(self.editor.api('project', query={'id': 'own'}))['clients'][0]['name'], 'Alice Updated')
        self.assertNotIn('clients', self.ok(self.client.api('deck')))
        p = self.ok(self.editor.api('create_project', {'name': 'With clients', 'emails': ['a@example.test', 'b@example.test']}), 201)
        self.assertEqual({c['email'] for c in self.ok(self.editor.api('project', query={'id': p['project_id']}))['clients']},
                         {'a@example.test', 'b@example.test'})

    def test_only_project_team_can_manage_clients(self):
        self.add('alice@example.test', 'Alice')
        for actor, project in ((self.anon, 'own'), (self.client, 'own'), (self.admin, 'own'),
                               (self.editor, 'private'), (self.editor, 'public'), (self.editor, 'foreign')):
            for action in ('save_project_client', 'remove_project_client'):
                with self.subTest(actor=actor.session, project=project, action=action):
                    self.denied(actor.api(action, {'project_id': project, 'email': 'alice@example.test', 'name': 'Changed'}))
        self.denied(self.editor.api('save_project_client', {'project_id': 'own', 'email': 'x@example.test', 'name': 'X'},
                                    headers={'X-CSRF-Token': ''}))
        self.assertEqual(self.editor.api('save_project_client', {'project_id': 'own', 'email': "' OR 1=1--", 'name': 'X'})[0], 400)
        self.assertEqual(self.sql('SELECT name FROM project_client_members WHERE project_id=?', ('own',)), [('Alice',)])

    def test_selected_clients_alone_get_each_iteration(self):
        self.add('alice@example.test', 'Alice')
        self.add('bob@example.test', 'Bob')
        alice_link = self.send(['alice@example.test'])[0]
        self.assertEqual(self.sql('SELECT email FROM shares WHERE iteration_id=?', ('iteration-own',)), [('alice@example.test',)])
        alice, bob = self.account('alice@example.test'), self.account('bob@example.test')
        alice.client_share = alice_link['id']
        bob.client_share = alice_link['id']  # A guessed selector cannot grant access.
        self.assertEqual(self.ok(alice.api('deck'))['iteration']['id'], 'iteration-own')
        self.assertEqual(alice.api('file', query={'id': 'file-own'})[1], png('file-own'))
        self.denied(bob.api('deck'))
        self.denied(bob.api('file', query={'id': 'file-own'}))
        self.assertEqual(self.ok(bob.api('destinations'))['projects'], [])
        second = self.ok(self.editor.api('new_iteration', {'iteration': 'iteration-own'}), 201)['id']
        bob_link = self.send(['bob@example.test'], second)[0]
        bob.client_share = bob_link['id']
        self.assertEqual(self.ok(bob.api('deck'))['iteration']['id'], second)
        self.denied(alice.api('deck', query={'iteration': second}))
        self.denied(bob.api('deck', query={'iteration': 'iteration-own'}))
        self.assertEqual(self.ok(alice.api('destinations'))['projects'][0]['iteration_id'], 'iteration-own')
        self.assertEqual({c['email'] for c in self.ok(self.editor.api('project', query={'id': 'own'}))['clients']},
                         {'alice@example.test', 'bob@example.test'})
        self.send(['alice@example.test'], second)
        # Deselecting Bob on this later send does not revoke his earlier invitation.
        self.ok(bob.api('deck'))
        messages = [json.loads(line) for line in (self.tmp / 'mail.log.messages.jsonl').read_text().splitlines()]
        self.assertEqual([m['to'] for m in messages], ['alice@example.test', 'bob@example.test', 'alice@example.test'])

    def test_invalid_or_stale_recipient_selection_does_not_publish(self):
        self.add('alice@example.test', 'Alice')
        self.add('outside@example.test', 'Outside', 'private', Client(self.base, 'colleague'))
        for selection, status in (([], 400), ('alice@example.test', 400),
                                  (['outside@example.test'], 409),
                                  (['alice@example.test', 'missing@example.test'], 409),
                                  (['alice@example.test'] * 21, 400)):
            with self.subTest(selection=selection):
                response = self.editor.api('share', {'iteration': 'iteration-own', 'client_emails': selection})
                self.assertEqual(response[0], status, response[1])
                self.assertEqual(self.sql('SELECT status FROM iterations WHERE id=?', ('iteration-own',)), [('draft',)])
                self.assertEqual(self.sql('SELECT COUNT(*) FROM shares WHERE iteration_id=?', ('iteration-own',)), [(0,)])
        self.ok(self.editor.api('remove_project_client', {'project_id': 'own', 'email': 'alice@example.test'}))
        self.assertEqual(self.editor.api('share', {'iteration': 'iteration-own', 'client_emails': ['alice@example.test']})[0], 409)
        self.assertFalse((self.tmp / 'mail.log.messages.jsonl').exists())

    def test_removal_revokes_all_project_grants_aliases_and_queued_notifications(self):
        self.add('alice@example.test', 'Alice')
        self.add('bob@example.test', 'Bob')
        links = self.send(['alice@example.test', 'bob@example.test'])
        self.ok(self.editor.api('comment', {'iteration': 'iteration-own', 'body': 'Review this design', 'slide': 'intro'}))
        aliases = self.sql('SELECT url FROM email_outbox WHERE email=?', ('alice@example.test',))
        self.assertEqual(len(aliases), 1)
        other = self.ok(self.editor.api('create_project', {'name': 'Another project', 'emails': ['alice@example.test'], 'starting_pack': []}), 201)
        other_link = self.send(['alice@example.test'], other['iteration_id'])[0]
        alice = self.account('alice@example.test')
        self.ok(self.editor.api('remove_project_client', {'project_id': 'own', 'email': 'alice@example.test'}))
        alice.client_share = links[0]['id']
        self.denied(alice.api('deck'))
        bearer = Client(self.base, bearer=links[0]['id'])
        self.denied(bearer.api('file', query={'id': 'file-own'}))
        alias = Client(self.base, bearer=aliases[0][0])
        self.denied(alias.api('deck'))
        self.assertEqual(self.sql('SELECT status FROM email_outbox WHERE email=?', ('alice@example.test',)), [('cancelled',)])
        alice.client_share = other_link['id']
        self.ok(alice.api('deck'))
        self.assertEqual({p['id'] for p in self.ok(alice.api('destinations'))['projects']}, {other['project_id']})
        bob = self.account('bob@example.test');bob.client_share = links[1]['id']
        self.ok(bob.api('deck'))
        self.add('alice@example.test', 'Alice Again')
        alice.client_share = links[0]['id']
        self.denied(alice.api('deck'))  # Re-adding membership must not revive revoked invitations.
        self.assertEqual(self.sql('PRAGMA foreign_key_check'), [])

    def test_existing_client_contacts_and_share_recipients_migrate_once(self):
        self.sql('DELETE FROM project_client_members')
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('legacy-client','own','Legacy Alice','Client','Alice@Example.Test')")
        self.sql("DELETE FROM migrations WHERE name='project-clients-v1'")
        own = self.ok(self.editor.api('project', query={'id': 'own'}))
        shared = self.ok(self.editor.api('project', query={'id': 'shared'}))
        self.assertEqual([(c['email'], c['name']) for c in own['clients']], [('alice@example.test', 'Legacy Alice')])
        self.assertEqual([c['email'] for c in shared['clients']], ['client@example.test'])
        self.ok(self.editor.api('remove_project_client', {'project_id': 'shared', 'email': 'client@example.test'}))
        self.assertEqual(self.ok(self.editor.api('project', query={'id': 'shared'}))['clients'], [])
        self.assertEqual(self.ok(self.editor.api('project', query={'id': 'shared'}))['clients'], [])
        self.denied(self.client.api('deck'))

    def test_legacy_email_invites_and_client_contacts_join_the_roster(self):
        self.ok(self.editor.api('share', {'iteration': 'iteration-own', 'emails': ['legacy@example.test']}))
        self.ok(self.editor.api('save_contact', {'project_id': 'own', 'role': 'Client', 'email': 'contact@example.test', 'name': 'Contact'}))
        self.assertEqual({c['email'] for c in self.ok(self.editor.api('project', query={'id': 'own'}))['clients']},
                         {'legacy@example.test', 'contact@example.test'})


if __name__ == '__main__':
    unittest.main()
