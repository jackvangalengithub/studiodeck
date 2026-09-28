"""Batch client/guest permissions using the same isolated fixtures as the legacy API."""
import json
import subprocess
import unittest
from test_security import SecurityFixture, Client, digest, READ_ACTIONS, WRITE_ACTIONS, PHP


class BatchSecurityTests(SecurityFixture):
    def test_catalog_covers_all_authenticated_json_actions(self):
        direct={'request_login','consume_login','upload','communication_upload','upload_avatar','upload_project_logo','upload_studio_logo',
                'website_upload','file','slide_image','slide_media','check_image','conversation_file','project_testimonial_photo',
                'website_source_image','website_asset','website_preview','website_template_preview','website_export','project_export',
                'destination_cover','drive_callback','studio_logo','comment_preview','project_cover','pack_file','product_feedback_image'}
        names=sorted(READ_ACTIONS|WRITE_ACTIONS)
        result=subprocess.check_output([PHP,'-r',"require $argv[1];echo json_encode(array_map('batch_action_method',json_decode($argv[2],true)));",str(self.tmp/'app/batch_actions.php'),json.dumps(names)])
        for action,method in zip(names,json.loads(result)):
            self.assertEqual(method,None if action in direct else 'QUERY' if action in READ_ACTIONS else 'POST',action)

    def batch(self, client, calls, scope='account', expected=200):
        groups=[]
        for n,(action,params,method) in enumerate(calls):
            groups.append([dict(id=str(n),method=method,relative_url=scope+'/api:'+action,
                                body=json.dumps(params),requestingId=None)])
        status,body,_=client.request('/api/1.0/'+scope+'/batch',groups)
        self.assertEqual(status,expected,body[:1000])
        return json.loads(body)

    def test_client_share_reads_writes_and_revocation(self):
        result=self.batch(self.client,[('deck',{},'QUERY'),('comment',{'iteration':'iteration-shared','slide':'general','body':'Batch client comment'},'POST'),('pin_project',{'project_id':'shared','pinned':True},'POST')])
        self.assertEqual([r['code'] for r in result],[200,200,403],result)
        self.assertEqual(result[0]['body']['other']['project']['id'],'shared')
        self.assertTrue(self.sql("SELECT 1 FROM comments WHERE body='Batch client comment' AND author='client@example.test'"))
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        result=self.batch(self.client,[('deck',{},'QUERY'),('comment',{'iteration':'iteration-shared','slide':'general','body':'Revoked'},'POST')])
        self.assertTrue(all(r['code'] in (401,403,404) for r in result),result)
        self.assertFalse(self.sql("SELECT 1 FROM comments WHERE body='Revoked'"))

    def test_conversation_guest_cannot_expand_access(self):
        self.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('joiner','shared','Joiner','Joiner','joiner@example.test')")
        status,body,_=self.editor.api('communication_post',{'iteration':'iteration-shared','body':'Invited conversation','recipient':'joiner@example.test','invite':True})
        self.assertEqual(status,201,body)
        root=json.loads(body)['id'];user=self.sql("SELECT id FROM users WHERE email='joiner@example.test'")[0][0]
        self.sql("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,9999999999)",(digest('guest'),user,'csrf-guest'))
        guest=Client(self.base,'guest')
        result=self.batch(guest,[('conversation',{'id':root},'QUERY'),('communication_post',{'conversation':root,'body':'Guest reply'},'POST'),('project',{'id':'shared'},'QUERY'),('save_budget',{'iteration':'iteration-shared','label':'Forbidden','amount':'2'},'POST')])
        self.assertEqual([r['code'] for r in result],[200,201,403,403],result)
        self.assertTrue(self.sql("SELECT 1 FROM comments WHERE body='Guest reply' AND parent_id=?",(root,)))
        self.sql('UPDATE conversation_grants SET revoked=1 WHERE root_id=?',(root,))
        result=self.batch(guest,[('conversation',{'id':root},'QUERY')])
        self.assertIn(result[0]['code'],(401,403,404))

    def test_no_auth_bypass_or_binary_dispatch(self):
        for client in [self.anon,Client(self.base,'expired'),Client(self.base,None,bearer='client-share')]:
            groups=[[dict(id='1',method='QUERY',relative_url='account/api:profile',body='{}')]]
            status,body,_=client.request('/api/1.0/account/batch',groups)
            self.assertIn(status,(401,403),body)
        for action in ['file','upload','consume_login','website_preview','website_upload','drive_callback']:
            self.batch(self.editor,[(action,{},'POST')],expected=404)
        self.batch(self.client,[('deck',{},'QUERY')],scope='studio-a',expected=403)


if __name__=='__main__':
    unittest.main()
