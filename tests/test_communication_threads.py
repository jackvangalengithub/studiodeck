"""Thread purposes, plain replies, independent decisions, history and pin status."""
from test_security import SecurityFixture, Client

class CommunicationThreadTests(SecurityFixture):
    iid='iteration-shared'
    def post(self,who=None,**fields):
        return self.ok((who or self.editor).api('communication_post',dict(iteration=self.iid,body='Oak fronts as specified',**fields)),201)['id']
    def deck(self,who=None):
        return self.ok((who or self.editor).api('deck',query={'iteration':self.iid}))
    def change(self,root,**fields):
        return self.editor.api('communication_thread_update',dict(iteration=self.iid,id=root,**fields))

    def test_plain_replies_cannot_change_thread_type_or_terms(self):
        root=self.post(thread_type='todo',thread_title='Correct cabinet fronts',assignee='client@example.test',due_date='2026-10-12')
        reply=self.post(parent_id=root)
        comments={c['id']:c for c in self.deck()['communication']['comments']}
        self.assertIsNone(comments[reply]['thread_details'])
        self.assertEqual(comments[root]['thread_details']['type'],'todo')
        self.assertEqual(self.sql('SELECT count(*) FROM communication_messages'),[(0,)])
        for fields in [dict(thread_type='question'),dict(thread_type='discussion'),dict(recipient='client@example.test'),dict(amount='50'),dict(assignee='client@example.test'),dict(due_date='2026-10-13')]:
            self.ok(self.editor.api('communication_post',dict(iteration=self.iid,parent_id=root,body='Invalid typed reply',**fields)),400)
        self.ok(self.editor.api('comment_answered',dict(iteration=self.iid,id=root,answered=True)),400)
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=root,resolved=True)))
        self.assertEqual(self.sql('SELECT answered FROM comments WHERE id=?',(root,)),[(1,)])
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=root,resolved=False)))
        self.assertEqual(self.sql('SELECT answered FROM comments WHERE id=?',(root,)),[(0,)])

    def test_question_can_become_todo_with_history_and_one_work_item(self):
        root=self.post(thread_type='question',audience='studio')
        qid=self.sql('SELECT question_id FROM communication_topics WHERE root_id=?',(root,))[0][0]
        self.ok(self.change(root,thread_type='todo',assignee='editor@example.test',due_date='2026-10-12'))
        topic=next(c for c in self.deck()['communication']['comments'] if c['id']==root)['thread_details']
        self.assertEqual(topic['question_id'],qid)
        self.assertEqual((topic['history'][0]['from_type'],topic['history'][0]['to_type']),('conversation','todo'))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM checklist_threads WHERE root_id=?',(root,)),[(1,)])
        self.ok(self.change(root,thread_type='todo',assignee='editor@example.test',due_date='2026-02-30'),400)
        self.denied(self.client.api('communication_thread_update',dict(iteration=self.iid,id=root,thread_type='discussion')))
        self.denied(self.editor.api('communication_thread_update',dict(iteration=self.iid,id=root,thread_type='todo'),headers={'X-CSRF-Token':''}))
        self.sql('UPDATE iterations SET locked=1 WHERE id=?',(self.iid,))
        self.ok(self.change(root,thread_type='todo',assignee='editor@example.test'),409)

    def test_linked_price_approval_does_not_complete_work_and_terms_are_immutable(self):
        root=self.post(thread_type='todo',assignee='editor@example.test')
        request=self.post(thread_type='price_adjustment',related_thread_id=root,recipient='client@example.test',amount='450')
        self.assertEqual(self.sql('SELECT parent_id FROM comments WHERE id=?',(request,)),[(None,)])
        self.assertEqual(self.sql('SELECT related_root_id FROM communication_topics WHERE root_id=?',(request,)),[(root,)])
        self.ok(self.change(request,thread_type='discussion'),400)
        self.ok(self.change(request,thread_type='price_adjustment',amount='900'),400)
        before=self.deck()['total_cents']
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=request,decision='confirmed')))
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=request,decision='confirmed')))
        self.assertEqual(self.deck()['total_cents'],before+45000)
        self.assertEqual(self.sql('SELECT answered FROM comments WHERE id=?',(root,)),[(0,)])
        self.ok(self.change(request,thread_type='price_adjustment',recipient='editor@example.test',amount='1000'),400)
        self.ok(self.editor.api('communication_post',dict(iteration=self.iid,body='Bad link',related_thread_id='comment-foreign')),404)
        private=self.post(thread_type='discussion',audience='studio')
        self.denied(self.client.api('communication_post',dict(iteration=self.iid,related_thread_id=private,body='Leak')))
        self.ok(self.editor.api('communication_post',dict(iteration=self.iid,related_thread_id=private,thread_type='price_adjustment',recipient='client@example.test',amount='50',body='Implicit share',audience='shared')),400)

    def test_conversation_waiting_person_controls_attention_and_can_be_cleared(self):
        self.sql("INSERT INTO comment_reads SELECT id,'user:editor@example.test','2026-01-01' FROM comments")
        root=self.post(thread_type='conversation')
        def attention():
            return {c['id'] for c in self.ok(self.editor.api('comments_feed',query={'filter':'attention'}))['items']}
        self.assertNotIn(root,attention())
        self.ok(self.change(root,thread_type='conversation',assignee='client@example.test'))
        self.assertIn(root,attention())
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=root,resolved=True)))
        self.assertNotIn(root,attention())
        self.ok(self.change(root,thread_type='conversation',assignee='editor@example.test'))
        self.assertIn(root,attention())
        self.ok(self.change(root,thread_type='conversation',assignee=''))
        self.assertNotIn(root,attention())
        self.assertEqual(self.sql('SELECT question_id FROM communication_topics WHERE root_id=?',(root,)),[(None,)])
        self.ok(self.editor.api('comment_answered',dict(iteration=self.iid,id=root,answered=True)))

    def test_approval_has_optional_budget_and_preserves_lock_rules(self):
        plain=self.post(thread_type='approval',recipient='client@example.test')
        priced=self.post(thread_type='approval',recipient='client@example.test',amount='-125.50')
        self.assertEqual(self.sql('SELECT type FROM communication_topics WHERE root_id IN (?,?)',(plain,priced)),[('approval',),('approval',)])
        self.assertEqual(self.sql('SELECT amount_cents FROM comment_confirmations WHERE comment_id=?',(plain,)),[(None,)])
        before=self.deck()['total_cents']
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=plain,decision='confirmed')))
        self.assertEqual(self.deck()['total_cents'],before)
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=priced,decision='confirmed')))
        self.assertEqual(self.deck()['total_cents'],before-12550)
        self.sql('UPDATE iterations SET locked=1 WHERE id=?',(self.iid,))
        self.post(thread_type='approval',recipient='client@example.test')
        self.ok(self.editor.api('communication_post',dict(iteration=self.iid,body='Locked cost',thread_type='approval',recipient='client@example.test',amount='10')),409)
        self.post(thread_type='conversation')
        self.ok(self.editor.api('communication_post',dict(iteration=self.iid,body='Locked waiting',thread_type='conversation',assignee='client@example.test')),409)

    def test_old_thread_types_map_without_losing_identity_or_terms(self):
        import sqlite3
        conversation=self.post(thread_type='conversation')
        question=self.post(thread_type='conversation',assignee='client@example.test')
        task=self.post(thread_type='todo',assignee='editor@example.test')
        approval=self.post(thread_type='approval',recipient='client@example.test')
        price=self.post(thread_type='approval',recipient='client@example.test',amount='1250',related_thread_id=task)
        reply=self.post(parent_id=question)
        with sqlite3.connect(self.database) as db:
            schema=db.execute("SELECT sql FROM sqlite_master WHERE name='communication_topics'").fetchone()[0]
            db.execute('ALTER TABLE communication_topics RENAME TO saved_topics')
            db.execute(schema.replace("'conversation','todo','approval'", "'discussion','question','todo','confirmation','price_adjustment'"))
            db.execute("INSERT INTO communication_topics SELECT root_id,CASE WHEN root_id=? THEN 'discussion' WHEN root_id=? THEN 'question' WHEN root_id=? THEN 'confirmation' WHEN root_id=? THEN 'price_adjustment' ELSE type END,assignee,assignee_name,due_date,question_id,related_root_id FROM saved_topics",(conversation,question,approval,price))
            db.execute('DROP TABLE saved_topics')
        comments={c['id']:c for c in self.deck()['communication']['comments']}
        for root,kind in [(conversation,'conversation'),(question,'conversation'),(task,'todo'),(approval,'approval'),(price,'approval')]:
            self.assertEqual(comments[root]['thread_details']['type'],kind)
        self.assertEqual(comments[reply]['parent_id'],question)
        self.assertEqual(comments[price]['thread_details']['related_root_id'],task)
        self.assertEqual(self.sql('SELECT amount_cents FROM comment_confirmations WHERE comment_id=?',(price,)),[(125000,)])
        self.assertEqual(self.sql('PRAGMA foreign_key_check'),[])
        self.deck()  # Applying the schema again is harmless.
