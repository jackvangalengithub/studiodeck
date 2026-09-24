"""Real HTTP confirmation tests with temporary identities/database; no external services."""
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from test_security import SecurityFixture, Client

class ConfirmationTests(SecurityFixture):
    iid = 'iteration-shared'

    def call(self, who, action, data=None, expected=200, **kwargs):
        status, body, _ = who.api(action, data, **kwargs)
        self.assertEqual(status, expected, body.decode()[:600])
        return json.loads(body)

    def deck(self):
        return self.call(self.editor, 'project', query={'id':'shared','iteration':self.iid})

    def request(self, who=None, **fields):
        return self.call(who or self.editor, 'communication_post', dict(iteration=self.iid, body='Please confirm the paint.', recipient='client@example.test', **fields), expected=201)['id']

    def decide(self, id, who=None, decision='confirmed', expected=200):
        return self.call(who or self.client, 'confirmation_decide', dict(iteration=self.iid,id=id,decision=decision),expected)

    def test_named_threads_keep_replies_and_confirmations_together(self):
        root=self.call(self.editor,'communication_post',dict(iteration=self.iid,thread_title='Paint options',body='Which finish?',version_id='old-shared'),expected=201)['id']
        reply=self.call(self.client,'communication_post',dict(iteration=self.iid,parent_id=root,body='Matte, please.'),expected=201)['id']
        request=self.request(related_thread_id=root)
        deck=self.deck()
        self.assertIn({'id':root,'title':'Paint options'},deck['communication']['threads'])
        self.assertEqual({c['id'] for c in deck['comments'] if c['parent_id']==root},{reply})
        self.assertEqual(next(c for c in deck['comments'] if c['id']==root)['slide'],'general')
        self.assertTrue(any(a['comment_id']==root and a['id']=='old-shared' for a in deck['communication']['attachments']))
        self.call(self.client,'communication_post',dict(iteration=self.iid,thread_title='Client question',body='Can we discuss lighting?'),expected=201)
        for fields in [dict(thread_title=''),dict(thread_title='Nested',parent_id=root),dict(thread_title='x'*161)]:
            self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Invalid thread',**fields),expected=400)
        self.call(self.editor,'communication_post',dict(iteration=self.iid,thread_title='Bad CSRF',body='Test'),headers={'X-CSRF-Token':'bad'},expected=403)

    def test_directory_recipients_show_access_and_missing_email(self):
        self.sql("INSERT INTO project_members(project_id,user_id) VALUES('shared','colleague')")
        self.sql("INSERT INTO project_client_members(project_id,email,name,created_at) VALUES('shared','waiting@example.test','Unshared client','2026-01-01')")
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('trade','shared','Bakker Joinery','Joiner','trade@example.test')")
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('painter','shared','Painter without email','Painter','')")
        people={p['name']:p for p in self.deck()['communication']['recipients']}
        self.assertTrue(people['Client']['available'])
        self.assertTrue(people['colleague']['available'])
        self.assertEqual(people['Unshared client']['unavailable_reason'],'needs_access')
        self.assertEqual(people['Bakker Joinery']['group'],'other')
        self.assertEqual(people['Painter without email']['unavailable_reason'],'missing_email')
        for recipient in ['waiting@example.test','trade@example.test','outsider@example.test']:
            self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Cannot invite implicitly',recipient=recipient),expected=400)
        self.assertFalse(self.sql("SELECT 1 FROM shares WHERE email IN ('waiting@example.test','trade@example.test')"))
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        people={p['name']:p for p in self.deck()['communication']['recipients']}
        self.assertFalse(people['Client']['available'])
        self.assertEqual(people['Client']['unavailable_reason'],'needs_access')

    def test_budget_exactly_once_and_signed(self):
        for amount, cents in [('1000',100000),('-250,05',-25005),('0.01',1),('0',0)]:
            before=self.deck()['total_cents']
            request=self.request(amount=amount)
            self.assertEqual(self.deck()['total_cents'],before)
            with ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(lambda _: self.decide(request, Client(self.base,'client',client_share='client-share')),range(2)))
            self.assertEqual(self.deck()['total_cents'],before+cents)
            lines=[b for b in self.deck()['budget'] if b['confirmation'] and b['confirmation']['comment_id']==request]
            self.assertEqual(len(lines),1)
            self.assertEqual(lines[0]['amount_cents'],cents)
            self.assertEqual(lines[0]['confirmation']['recipient_name'],'Client')
            self.call(self.editor,'save_budget',dict(iteration=self.iid,id=lines[0]['id'],label='Tampered',amount='99'),expected=409)
            self.decide(request, self.editor, 'withdrawn',409)
        for amount in ['', '1e3', '1.234', '100000000', 1.2, True]:
            self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Invalid',recipient='client@example.test',amount=amount),expected=400)

    def test_identity_access_revocation_and_withdrawal(self):
        request=self.request()
        self.decide(request,self.editor,expected=403)
        self.decide(request,Client(self.base,'outsider'),expected=404)
        self.call(self.client,'confirmation_decide',dict(iteration=self.iid,id=request,decision='confirmed'),headers={'X-CSRF-Token':'bad'},expected=403)
        self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Private',recipient='outsider@example.test'),expected=400)
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.decide(request,expected=404)
        self.sql("UPDATE shares SET revoked=0 WHERE id='client-share'")
        self.decide(request,self.editor,'withdrawn')
        self.decide(request,expected=409)
        self.assertEqual(self.deck()['communication']['confirmations'][0]['status'],'withdrawn')

    def test_client_to_team_and_legacy_replies(self):
        request=self.call(self.client,'communication_post',dict(iteration=self.iid,body='Is this colour included?',recipient='editor@example.test',related_thread_id='comment-shared'),expected=201)['id']
        self.call(self.editor,'comment',dict(iteration=self.iid,parent_id='comment-shared',slide='intro',body='A reply alone is not approval.'))
        self.assertEqual(self.deck()['communication']['confirmations'][0]['status'],'pending')
        self.decide(request,self.editor)
        message=next(c for c in self.deck()['comments'] if c['id']==request)
        self.assertEqual((message['parent_id'],message['slide']),(None,'general'))
        self.assertEqual(len(self.deck()['budget']),1)
        self.call(self.client,'communication_post',dict(iteration=self.iid,body='Wrong thread',parent_id='comment-foreign'),expected=404)

    def test_attachment_upload_and_file_isolation(self):
        self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Private attachment',version_id='file-foreign'),expected=404)
        for who in (self.editor,self.client):
            uploaded=self.call(who,'communication_upload',dict(iteration=self.iid),multipart=True,expected=201)['ids'][0]
            self.request(who=None,version_id=uploaded)
            deck=self.deck()
            self.assertTrue(any(a['id']==uploaded for a in deck['communication']['attachments']))
            self.assertEqual(next(f for f in deck['files'] if f['id']==uploaded)['category'],'legal')
            self.assertEqual(len(deck['budget']),1)
            self.assertTrue(any(j['version_id']==uploaded and j['status']=='queued' for j in deck['jobs']))
        self.request(version_id='old-shared')
        self.assertTrue(any(a['id']=='old-shared' for a in self.deck()['communication']['attachments']))
        self.sql("DELETE FROM iteration_files WHERE iteration_id=? AND asset_id='asset-shared'",(self.iid,))
        self.assertEqual(self.client.api('file',query={'id':'old-shared','iteration':self.iid})[0],200)

    def test_locked_iteration_and_copy_provenance(self):
        request=self.request(amount='-250')
        self.sql('UPDATE iterations SET locked=1 WHERE id=?',(self.iid,))
        self.decide(request,expected=409)
        self.request() # Nonfinancial conversations remain open.
        self.call(self.client,'communication_upload',dict(iteration=self.iid),multipart=True,expected=409)
        self.sql('UPDATE iterations SET locked=0 WHERE id=?',(self.iid,))
        self.decide(request)
        clone=self.call(self.editor,'new_iteration',dict(iteration=self.iid),expected=201)['id']
        copied=self.call(self.editor,'project',query={'id':'shared','iteration':clone})
        self.assertEqual(copied['total_cents'],-25000)
        linked=next(b for b in copied['budget'] if b['confirmation'])
        self.assertEqual(linked['confirmation']['comment_id'],request)
        self.assertEqual(linked['confirmation']['iteration_id'],self.iid)
        self.assertTrue(copied['communication']['confirmations'])
        self.assertTrue(all(r['iteration_id']==self.iid for r in copied['communication']['confirmations']))
        self.call(self.editor,'save_budget',dict(iteration=clone,id=linked['id'],label='Changed',amount='12'),expected=409)

if __name__=='__main__':unittest.main()
