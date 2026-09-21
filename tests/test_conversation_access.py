"""Conversation-only invitations: identity, grant revocation and resource isolation."""
import json
import re
import subprocess
import unittest
from test_security import SecurityFixture, Client, PHP

class ConversationAccessTests(SecurityFixture):
    iid='iteration-shared'
    def call(self,who,action,data=None,expected=200,**kwargs):
        status,body,_=who.api(action,data,**kwargs)
        self.assertEqual(status,expected,body[:600])
        return json.loads(body)
    def setUp(self):
        super().setUp()
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('joiner','shared','Bakker Joinery','Joiner','joiner@example.test')")
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('painter','shared','Painter','Painter','painter@example.test')")
    def invite(self,**extra):
        return self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Please confirm the paint specification.',recipient='joiner@example.test',invite=True,version_id='old-shared',**extra),201)['id']
    def login_guest(self,root):
        result=subprocess.run([PHP,'-r','require $argv[1]; while(dispatch_conversation_email()){}',str(self.tmp/'app/bootstrap.php')],env=self.env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        mail=[json.loads(line) for line in (self.tmp/'mail.log.messages.jsonl').read_text().splitlines() if json.loads(line)['to']=='joiner@example.test'][-1]
        token=re.search(r'/#/login/([a-f0-9]{64})',mail['text']).group(1)
        guest=Client(self.base)
        login=self.call(guest,'consume_login',{'token':token})
        self.assertEqual(login['redirect'],'/conversations/'+root)
        csrf=self.call(guest,'session')['csrf']
        return guest,csrf,token
    def test_invitation_opens_only_its_thread_and_exact_files(self):
        root=self.invite(amount='1000')
        guest,csrf,token=self.login_guest(root)
        view=self.call(guest,'conversation',query={'id':root})
        self.assertEqual([c['id'] for c in view['comments']],[root])
        self.assertEqual([a['id'] for a in view['attachments']],['old-shared'])
        self.assertNotIn('budget',view)
        self.assertNotIn('SECRET-shared',json.dumps(view))
        self.assertFalse(self.sql("SELECT 1 FROM studio_members m JOIN users u ON u.id=m.user_id WHERE u.email='joiner@example.test'"))
        self.assertFalse(self.sql("SELECT 1 FROM shares WHERE email='joiner@example.test'"))
        for action,query in [('conversation',{'id':'comment-shared'}),('deck',{'iteration':self.iid}),('project',{'id':'shared'}),('file',{'iteration':self.iid,'id':'old-shared'}),('conversation_file',{'conversation':root,'id':'file-shared'}),('conversation_file',{'conversation':root,'id':'file-foreign'})]:
            self.denied(guest.api(action,query=query))
        self.assertEqual(guest.api('conversation_file',query={'conversation':root,'id':'old-shared'})[0],200)
        self.assertEqual(guest.request('/conversations/'+root)[0],200)
        self.denied(guest.request('/client/projects/shared'))
        self.denied(Client(self.base,'client',client_share='client-share').api('conversation',query={'id':root}))
        self.call(guest,'consume_login',{'token':token},403)
        destinations=self.call(guest,'destinations')
        self.assertEqual(destinations['studios'],[]);self.assertEqual(destinations['projects'],[])
        self.assertEqual(destinations['conversations'][0]['id'],root)
        headers={'X-CSRF-Token':csrf}
        self.call(guest,'communication_post',dict(conversation=root,body='Reply in this thread.'),201,headers=headers)
        self.call(guest,'communication_post',dict(conversation=root,body='Wrong thread',parent_id='comment-shared'),403,headers=headers)
        self.call(guest,'communication_post',dict(conversation=root,body='File injection',version_id='file-shared'),404,headers=headers)
        self.call(guest,'communication_post',dict(conversation=root,body='Invite another contact',recipient='painter@example.test',invite=True),400,headers=headers)
        self.call(guest,'confirmation_decide',dict(conversation=root,id=root,decision='confirmed'),403)
        for _ in range(2):self.call(guest,'confirmation_decide',dict(conversation=root,id=root,decision='confirmed'),headers=headers)
        deck=self.call(self.editor,'project',query={'id':'shared','iteration':self.iid})
        self.assertEqual(deck['total_cents'],100000)
        # Guests can request confirmation from participants, without discovering the directory.
        reverse=self.call(guest,'communication_post',dict(conversation=root,body='Is the installation included?',recipient='editor@example.test'),201,headers=headers)['id']
        self.call(self.editor,'confirmation_decide',dict(iteration=self.iid,id=reverse,decision='confirmed'))
        self.assertEqual(next(r for r in self.call(guest,'conversation',query={'id':root})['confirmations'] if r['comment_id']==reverse)['status'],'confirmed')
    def test_existing_thread_scope_and_revocation(self):
        root=self.call(self.editor,'communication_post',dict(iteration=self.iid,thread_title='Paint discussion',body='Earlier message'),201)['id']
        request=self.invite(parent_id=root)
        guest,csrf,_=self.login_guest(root)
        self.assertEqual({c['id'] for c in self.call(guest,'conversation',query={'id':root})['comments']},{root,request})
        other=self.invite()
        self.call(guest,'confirmation_decide',dict(conversation=root,id=other,decision='confirmed'),404,headers={'X-CSRF-Token':csrf})
        grant=self.sql('SELECT id FROM conversation_grants WHERE root_id=?',(root,))[0][0]
        self.call(guest,'conversation_revoke',dict(id=grant),403,headers={'X-CSRF-Token':csrf})
        self.call(self.editor,'conversation_revoke',dict(id=grant))
        self.denied(guest.api('conversation',query={'id':root}))
        self.denied(guest.api('conversation_file',query={'conversation':root,'id':'old-shared'}))
        self.call(guest,'communication_post',dict(conversation=root,body='After revocation'),404,headers={'X-CSRF-Token':csrf})
        self.call(guest,'confirmation_decide',dict(conversation=root,id=request,decision='confirmed'),404,headers={'X-CSRF-Token':csrf})
    def test_contact_removal_expiry_and_mail_recheck(self):
        root=self.invite();self.sql("DELETE FROM contacts WHERE id='joiner'")
        result=subprocess.run([PHP,'-r','require $argv[1]; dispatch_conversation_email();',str(self.tmp/'app/bootstrap.php')],env=self.env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(self.sql('SELECT status FROM conversation_outbox')[0][0],'cancelled')
        self.assertFalse((self.tmp/'mail.log.messages.jsonl').exists())
    def test_inviting_from_an_old_general_message_creates_a_manageable_thread(self):
        root=self.call(self.editor,'communication_post',dict(iteration=self.iid,body='Earlier general message'),201)['id']
        self.invite(parent_id=root)
        deck=self.call(self.editor,'project',query={'id':'shared','iteration':self.iid})
        self.assertIn({'id':root,'title':'Earlier general message'},deck['communication']['threads'])
        self.assertEqual(deck['communication']['guests'][0]['root_id'],root)

    def test_expiry_pending_login_and_existing_session_are_enforced(self):
        root=self.invite();guest,csrf,_=self.login_guest(root)
        self.sql('UPDATE conversation_grants SET expires_at=0 WHERE root_id=?',(root,))
        self.denied(guest.api('conversation',query={'id':root}))
        self.call(guest,'confirmation_decide',dict(conversation=root,id=root,decision='confirmed'),404,headers={'X-CSRF-Token':csrf})
        self.assertEqual(self.call(guest,'destinations')['conversations'],[])
        self.sql('UPDATE conversation_grants SET expires_at=9999999999 WHERE root_id=?',(root,))
        self.call(self.editor,'communication_post',dict(iteration=self.iid,parent_id=root,body='Another update'),201)
        result=subprocess.run([PHP,'-r','require $argv[1]; while(dispatch_conversation_email()){}',str(self.tmp/'app/bootstrap.php')],env=self.env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        messages=[json.loads(line) for line in (self.tmp/'mail.log.messages.jsonl').read_text().splitlines()]
        token=re.search(r'/#/login/([a-f0-9]{64})',messages[-1]['text']).group(1)
        self.sql("DELETE FROM contacts WHERE id='joiner'")
        self.call(Client(self.base),'consume_login',{'token':token},404)
        self.denied(guest.api('conversation_file',query={'conversation':root,'id':'old-shared'}))

    def test_invitation_is_explicit_and_team_only(self):
        fields=dict(iteration=self.iid,body='Request',recipient='joiner@example.test')
        self.call(self.editor,'communication_post',fields,400)
        self.call(self.client,'communication_post',{**fields,'invite':True},400)
        self.call(self.editor,'communication_post',{**fields,'invite':True,'recipient':'outsider@example.test'},400)
        self.assertFalse(self.sql('SELECT 1 FROM conversation_grants'))

if __name__=='__main__':unittest.main()
