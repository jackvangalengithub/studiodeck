"""Read-only studio attention queue: scope, deduplication, deadlines and lifecycle."""
from test_security import SecurityFixture, Client
from datetime import datetime, timezone, timedelta

class AttentionTests(SecurityFixture):
    def queue(self, who=None, **query):
        return self.ok((who or self.editor).api('attention',query=query))

    def question(self,id,iteration='iteration-shared',**fields):
        values=dict(id=id,iteration_id=iteration,question='Question '+id,created_at='2026-01-01',published=1)
        values.update(fields)
        self.sql('INSERT INTO open_questions('+','.join(values)+') VALUES('+','.join('?' for _ in values)+')',tuple(values.values()))

    def deadline(self,project,days):
        date=(datetime.now(timezone.utc).date()+timedelta(days=days)).isoformat()
        self.sql('INSERT OR REPLACE INTO project_details(project_id,deadline) VALUES(?,?)',(project,date))
        return date

    def test_scope_and_no_implicit_reads(self):
        for name in ('own','shared','private','public','foreign','foreignpublic'):
            self.question(name,'iteration-'+name)
            self.deadline(name,3)
        result=self.queue()
        self.assertEqual({r['project_id'] for r in result['items']},{'own','shared'})
        self.assertEqual(result['counts']['questions'],2)
        self.assertEqual(result['counts']['deadlines'],2)
        self.assertEqual(self.queue(self.admin)['total'],0)
        self.denied(self.client.api('attention'))
        self.denied(self.anon.api('attention'))
        self.denied(self.editor.api('attention',headers={'X-Studio-Id':'studio-b'}))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comment_reads')[0][0],0)
        self.sql("UPDATE projects SET archived=1 WHERE id='shared'")
        self.assertEqual({r['project_id'] for r in self.queue()['items']},{'own'})
        self.sql("DELETE FROM project_members WHERE project_id='own' AND user_id='editor'")
        self.assertEqual(self.queue()['total'],0)

    def test_latest_questions_and_all_iteration_confirmations(self):
        self.question('question')
        for id,fields in [('private',dict(published=0)),('dismissed',dict(dismissed=1)),('resolved',dict(resolved=1)),('answered',dict(kind='answered',answer='Yes',resolved=1))]:
            self.question(id,**fields)
        request=self.ok(self.client.api('communication_post',dict(iteration='iteration-shared',body='Please confirm',recipient='editor@example.test')),201)['id']
        self.sql("INSERT INTO iterations(id,project_id,number,title,created_at) VALUES('latest','shared',2,'Next','2026-01-02')")
        self.question('question','latest')
        self.question('late-client-question')
        queue=self.queue()
        self.assertEqual(queue['counts']['questions'],2)
        self.assertEqual(next(r for r in queue['items'] if r['kind']=='questions' and r['id']=='question')['iteration_id'],'latest')
        confirmation=next(r for r in queue['items'] if r['kind']=='confirmations')
        self.assertEqual(confirmation['id'],request)
        self.assertEqual(confirmation['iteration_id'],'iteration-shared')
        self.assertTrue(confirmation['assigned_to_me'])
        self.ok(self.editor.api('confirmation_decide',dict(iteration='iteration-shared',id=request,decision='confirmed')))
        self.assertEqual(self.queue()['counts']['confirmations'],0)
        self.sql("UPDATE open_questions SET resolved=1 WHERE iteration_id='latest'")
        self.assertEqual(self.queue()['counts']['questions'],1)
        self.sql("UPDATE open_questions SET resolved=1 WHERE id='late-client-question'")
        self.assertEqual(self.queue()['counts']['questions'],0)

    def test_feedback_groups_replies_and_only_opening_marks_read(self):
        root=self.ok(self.client.api('comment',dict(iteration='iteration-shared',slide='visual-slide-shared',body='Feedback')))['id']
        reply=self.ok(self.client.api('comment',dict(iteration='iteration-shared',parent_id=root,body='Another thought')))['id']
        self.ok(self.editor.api('comment',dict(iteration='iteration-shared',parent_id=root,body='My reply')))
        queue=self.queue(kind='feedback')
        self.assertEqual(queue['counts']['feedback'],1)
        self.assertEqual(len(queue['items']),1)
        self.assertEqual(queue['items'][0]['unread_count'],2)
        self.assertEqual(queue['items'][0]['id'],root)
        self.queue()
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comment_reads')[0][0],0)
        self.ok(self.editor.api('read_comments',dict(ids=[root,reply])))
        self.assertEqual(self.queue()['counts']['feedback'],0)

    def test_deadline_window_priority_and_pagination(self):
        self.deadline('shared',-1);self.deadline('own',14)
        queue=self.queue()
        self.assertEqual(queue['items'][0]['id'],'shared')
        self.assertTrue(queue['items'][0]['overdue'])
        self.assertEqual(queue['counts']['deadlines'],2)
        self.deadline('own',15)
        self.assertEqual(self.queue()['counts']['deadlines'],1)
        self.deadline('own',0)
        self.assertEqual(self.queue()['counts']['deadlines'],2)
        for n in range(56):self.question('q%03d'%n)
        page=self.queue(kind='questions')
        self.assertEqual(page['counts']['questions'],56)
        self.assertEqual(len(page['items']),50)
        self.assertTrue(page['has_more'])
        second=self.queue(kind='questions',offset=page['next_offset'])
        self.assertEqual(len(second['items']),6)
        self.assertFalse(second['has_more'])
        self.assertEqual(len({r['id'] for r in page['items']+second['items']}),56)
        self.assertEqual(self.editor.api('attention',query={'kind':"' OR 1=1--"})[0],400)

if __name__=='__main__':
    import unittest
    unittest.main()
