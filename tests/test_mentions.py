"""Mentions, access boundaries and notification preferences over real HTTP."""
import hashlib
import json
import subprocess
from test_security import SecurityFixture, Client, PHP


class MentionTests(SecurityFixture):
    iid = 'iteration-shared'

    def call(self, who, action, data=None, expected=200, **kwargs):
        status, body, _ = who.api(action, data, **kwargs)
        self.assertEqual(status, expected, body[:600])
        return json.loads(body)

    def post(self, body, who=None, **extra):
        return self.call(who or self.editor, 'communication_post',
                         dict(iteration=self.iid, body=body, **extra), 201)['id']

    def profile(self, who=None, only=True, enabled=True):
        return self.call(who or self.client, 'save_profile', dict(
            name='Client', email_comments=enabled, email_mentions_only=only))['profile']

    def queued(self, cid):
        return self.sql('SELECT email FROM email_outbox WHERE comment_id=?', (cid,))

    def dispatch(self):
        result = subprocess.run([PHP, '-r', 'require $argv[1]; while(dispatch_comment_email()){}',
                                 str(self.tmp/'app/bootstrap.php')], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_profile_defaults_roundtrip_and_legacy_migration(self):
        self.assertFalse(self.call(self.client, 'profile')['profile']['email_mentions_only'])
        self.assertTrue(self.profile()['email_mentions_only'])
        p = self.call(self.client, 'save_profile', dict(name='Client', email_comments=True))['profile']
        self.assertTrue(p['email_mentions_only'])  # Older clients preserve the preference.
        self.call(self.client, 'save_profile', dict(name='Client', email_mentions_only='false'), 400)
        self.profile(enabled=False)
        self.sql('ALTER TABLE person_profiles DROP COLUMN email_mentions_only')
        p = self.call(self.client, 'profile')['profile']
        self.assertFalse(p['email_mentions_only'])
        self.assertFalse(p['email_comments'])

    def test_explicit_names_email_and_removed_mentions(self):
        self.profile()
        self.assertEqual(self.queued(self.post('A general update.')), [])
        mention = dict(email='client@example.test', label='Client')
        cid = self.post('🎨 @Client, can you check? @Client!', mentions=[mention, mention])
        self.assertEqual(self.queued(cid), [('client@example.test',)])
        self.assertEqual(self.sql('SELECT email,label FROM comment_mentions WHERE comment_id=?', (cid,)),
                         [('client@example.test', 'Client')])
        deck = self.call(self.editor, 'project', query=dict(id='shared', iteration=self.iid))
        self.assertEqual(next(c for c in deck['comments'] if c['id']==cid)['mentions'], [mention])
        for body in ['Removed mention', '@Clientele', 'client@example.test', 'hello@Client', '@client@example.test.invalid']:
            self.assertEqual(self.queued(self.post(body, mentions=[mention])), [])
        typed = self.post('Please check @client@example.test.')
        self.assertEqual(self.queued(typed), [('client@example.test',)])
        self.profile(enabled=False)
        self.assertEqual(self.queued(self.post('@Client please', mentions=[mention])), [])

    def test_queue_dispatch_rechecks_preferences_and_access(self):
        ordinary = self.post('General update')
        mentioned = self.post('@client@example.test please review')
        self.profile()
        self.dispatch()
        self.assertEqual(self.sql('SELECT status FROM email_outbox WHERE comment_id=?', (ordinary,)), [('cancelled',)])
        self.assertEqual(self.sql('SELECT status FROM email_outbox WHERE comment_id=?', (mentioned,)), [('logged',)])
        mail = [json.loads(x) for x in (self.tmp/'mail.log.messages.jsonl').read_text().splitlines()]
        self.assertEqual(len(mail), 1)
        self.assertIn('mentioned', mail[0]['subject'])
        revoked = self.post('@client@example.test revoked access')
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.dispatch()
        self.assertEqual(self.sql('SELECT status FROM email_outbox WHERE comment_id=?', (revoked,)), [('cancelled',)])

    def test_full_access_candidates_and_no_implicit_invites(self):
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('trade','shared','Trade','Joiner','trade@example.test')")
        people = self.call(self.editor, 'mention_people', query=dict(iteration=self.iid))
        self.assertEqual({p['email'] for p in people}, {'editor@example.test', 'client@example.test', 'trade@example.test'})
        self.assertTrue(next(p for p in people if p['email']=='trade@example.test')['invitable'])
        self.call(self.editor, 'mention_people', query=dict(iteration=self.iid, parent_id='comment-foreign'), expected=404)
        self.call(Client(self.base,'outsider'), 'mention_people', query=dict(iteration=self.iid), expected=404)
        before = self.sql('SELECT COUNT(*) FROM comments')
        for email, label in [('trade@example.test','Trade'), ('outsider@example.test','outsider'), ('client@example.test','Fake')]:
            self.call(self.editor, 'communication_post', dict(iteration=self.iid, body='@'+label,
                      mentions=[dict(email=email,label=label)]), 400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comments'), before)
        self.assertFalse(self.sql('SELECT 1 FROM conversation_grants'))

    def test_contact_mentions_invite_only_the_conversation_on_send(self):
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('trade','shared','Trade','Joiner','trade@example.test')")
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('noemail','shared','No email','Painter','')")
        self.sql("INSERT INTO project_client_members(project_id,email,name,created_at) VALUES('shared','waiting@example.test','Waiting client','2026-01-01')")
        people = self.call(self.editor, 'mention_people', query=dict(iteration=self.iid))
        self.assertEqual(len(people), 5)
        self.assertFalse(next(p for p in people if not p['email'])['invitable'])
        self.assertTrue(next(p for p in people if p['email']=='waiting@example.test')['invitable'])
        mention = dict(email='trade@example.test',label='Trade',invite=True)
        # Merely opening the picker, removing a mention or typing an email doesn't invite.
        self.post('Removed mention',mentions=[mention])
        self.post('@trade@example.test without a selected invitation')
        self.assertFalse(self.sql('SELECT 1 FROM conversation_grants'))
        # Clients cannot use the invitation bit to grant another contact access.
        self.call(self.client,'communication_post',dict(iteration=self.iid,body='@Trade',mentions=[mention]),400)
        root=self.post('Discuss this finish',thread_title='Finish',version_id='old-shared')
        cid=self.post('@Trade please check. @Trade',parent_id=root,mentions=[mention])
        self.assertEqual(self.sql('SELECT root_id,email FROM conversation_grants'),[(root,'trade@example.test')])
        self.assertEqual(len(self.sql('SELECT 1 FROM conversation_outbox WHERE comment_id=?',(cid,))),1)
        self.assertFalse(self.sql("SELECT 1 FROM shares WHERE email='trade@example.test'"))
        uid=self.sql("SELECT id FROM users WHERE email='trade@example.test'")[0][0]
        self.assertFalse(self.sql('SELECT 1 FROM studio_members WHERE user_id=?',(uid,)))
        self.sql('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',
                 (hashlib.sha256(b'trade').hexdigest(),uid,'csrf-trade',9999999999))
        guest=Client(self.base,'trade')
        view=self.call(guest,'conversation',query=dict(id=root))
        self.assertEqual({c['id'] for c in view['comments']},{root,cid})
        self.assertEqual([a['id'] for a in view['attachments']],['old-shared'])
        self.denied(guest.api('project',query=dict(id='shared',iteration=self.iid)))
        self.call(guest,'mention_people',query=dict(conversation='comment-shared'),expected=404)
        self.call(guest,'communication_post',dict(conversation=root,body='@Waiting client',mentions=[dict(email='waiting@example.test',label='Waiting client',invite=True)]),400)
        self.dispatch()
        self.assertEqual(self.sql('SELECT status FROM conversation_outbox WHERE comment_id=?',(cid,)),[('logged',)])

    def test_legacy_comments_confirmations_and_self_mentions(self):
        self.profile()
        cid = self.call(self.editor, 'comment', dict(iteration=self.iid, slide='intro',parent_id='comment-shared',
                        body='@Client please',mentions=[dict(email='client@example.test',label='Client')]))['id']
        self.assertEqual(self.queued(cid), [('client@example.test',)])
        ordinary = self.post('Please approve', recipient='client@example.test')
        self.assertFalse(self.queued(ordinary))
        request = self.post('@client@example.test please approve', recipient='client@example.test')
        self.assertEqual(self.queued(request), [('client@example.test',)])
        own = self.post('@editor@example.test myself')
        self.assertFalse(self.queued(own))
        self.assertTrue(self.sql('SELECT 1 FROM comment_mentions WHERE comment_id=?', (own,)))

    def test_scoped_guest_mentions_preferences_and_revocation(self):
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('joiner','shared','Joiner','Joiner','joiner@example.test')")
        root = self.post('Please join', recipient='joiner@example.test', invite=True)
        uid = self.sql("SELECT id FROM users WHERE email='joiner@example.test'")[0][0]
        self.sql('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',
                 (hashlib.sha256(b'joiner').hexdigest(),uid,'csrf-joiner',9999999999))
        guest = Client(self.base, 'joiner')
        self.profile(guest)
        self.sql('DELETE FROM conversation_outbox')
        people = self.call(guest, 'mention_people', query=dict(conversation=root))
        self.assertEqual({p['email'] for p in people}, {'editor@example.test','joiner@example.test'})
        self.call(guest, 'mention_people', query=dict(iteration=self.iid), expected=403)
        self.call(guest,'communication_post',dict(conversation=root,body='@Client',mentions=[dict(email='client@example.test',label='Client')]),400)
        self.post('Ordinary reply',parent_id=root)
        self.assertFalse(self.sql('SELECT 1 FROM conversation_outbox'))
        cid = self.post('@joiner@example.test check please',parent_id=root)
        self.assertEqual(len(self.sql('SELECT 1 FROM conversation_outbox WHERE comment_id=?',(cid,))),1)
        self.dispatch()
        self.assertEqual(self.sql('SELECT status FROM conversation_outbox WHERE comment_id=?',(cid,)),[('logged',)])
        self.call(guest,'communication_post',dict(conversation=root,body='@editor thanks',mentions=[dict(email='editor@example.test',label='editor')]),201)
        cid = self.post('@joiner@example.test now revoked',parent_id=root)
        self.sql('UPDATE conversation_grants SET revoked=1 WHERE root_id=?',(root,))
        self.dispatch()
        self.assertEqual(self.sql('SELECT status FROM conversation_outbox WHERE comment_id=?',(cid,)),[('cancelled',)])
        self.call(guest,'mention_people',query=dict(conversation=root),expected=404)
