"""Unified subjects, audience isolation, persistent work, and attention deduplication."""
from test_security import SecurityFixture, Client


class CommunicationHubTests(SecurityFixture):
    iid = 'iteration-shared'

    def deck(self, client=None, iteration=None):
        return self.ok((client or self.editor).api('deck', query={'iteration': iteration or self.iid}))

    def post(self, **fields):
        return self.ok(self.editor.api('communication_post', dict(iteration=self.iid, body='Oak finish', **fields)), 201)['id']

    def item(self, **fields):
        return self.ok(self.editor.api('save_open_question', dict({'iteration':self.iid, 'question':'Get an oak quote', 'published':False}, **fields)))['id']

    def share(self, root):
        return self.ok(self.editor.api('communication_share', dict(iteration=self.iid, id=root, share_history=True)))

    def test_private_thread_guards_every_client_path_and_notifications(self):
        root = self.post(thread_title='Internal oak discussion', audience='studio', version_id='file-shared')
        self.ok(self.editor.api('communication_post', dict(iteration=self.iid, parent_id=root, body='Private reply')), 201)
        client = self.deck(self.client)
        self.assertNotIn(root, [c['id'] for c in client['comments']])
        self.assertNotIn(root, [c['id'] for c in client['communication']['comments']])
        self.assertNotIn(root, [t['id'] for t in client['communication']['threads']])
        self.assertNotIn(root, [a['comment_id'] for a in client['communication']['attachments']])
        for action, body in [
            ('comment', dict(parent_id=root, slide='general', body='Guess')),
            ('communication_post', dict(parent_id=root, body='Guess')),
            ('comment_answered', dict(id=root, answered=True)),
            ('read_comments', dict(ids=[root])),
            ('communication_share', dict(id=root, share_history=True)),
        ]:
            self.denied(self.client.api(action, dict(iteration=self.iid, **body)))
        self.denied(self.client.api('mention_people', query=dict(iteration=self.iid, parent_id=root)))
        self.denied(self.client.api('comment_preview', query=dict(id=root)))
        self.assertFalse(self.sql('SELECT 1 FROM email_outbox WHERE comment_id=? AND share_id IS NOT NULL', (root,)))
        self.ok(self.editor.api('communication_post', dict(iteration=self.iid, parent_id=root, body='No implicit sharing', recipient='client@example.test')), 400)
        self.ok(self.editor.api('communication_share', dict(iteration=self.iid, id=root)), 400)
        self.denied(self.editor.api('communication_share', dict(iteration=self.iid, id=root, share_history=True), headers={'X-CSRF-Token': ''}))
        self.share(root)
        self.assertIn(root, [c['id'] for c in self.deck(self.client)['communication']['comments']])
        self.ok(self.client.api('communication_post', dict(iteration=self.iid, parent_id=root, body='Now visible')), 201)

    def test_checklist_discussion_uses_comments_and_keeps_one_identity(self):
        qid = self.item()
        item = next(q for q in self.deck()['open_questions'] if q['id'] == qid)
        root = item['thread_id']
        self.assertTrue(root)
        self.ok(self.editor.api('reply_open_question', dict(iteration=self.iid, id=qid, body='Check supplier availability')))
        self.assertFalse(self.sql('SELECT 1 FROM open_question_replies WHERE question_id=?', (qid,)))
        self.assertEqual(self.sql('SELECT body FROM comments WHERE parent_id=?', (root,))[0][0], 'Check supplier availability')
        self.assertEqual(self.deck(self.client)['communication']['items'], [])
        latest = self.ok(self.editor.api('new_iteration', dict(iteration=self.iid)), 201)['id']
        hub = self.deck(iteration=latest)['communication']
        self.assertEqual([q['id'] for q in hub['items']].count(qid), 1)
        self.assertEqual(next(q for q in hub['items'] if q['id'] == qid)['iteration_id'], self.iid)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM open_questions WHERE id=?', (qid,))[0][0], 1)
        self.assertIn(root, [c['id'] for c in hub['comments']])
        self.ok(self.editor.api('save_open_question', dict(iteration=self.iid, id=qid, question='Get an oak quote', published=True)), 400)
        self.share(root)
        self.ok(self.editor.api('save_open_question', dict(iteration=self.iid, id=qid, question='Get an oak quote', published=True)))
        self.ok(self.client.api('reply_open_question', dict(iteration=self.iid, id=qid, body='Please include delivery')))
        reply = self.sql('SELECT id FROM comments WHERE body=?', ('Please include delivery',))[0][0]
        self.assertTrue(self.sql('SELECT 1 FROM email_outbox WHERE comment_id=? AND email=?', (reply, 'editor@example.test')))
        self.assertEqual(next(q for q in self.deck(iteration=latest)['communication']['items'] if q['id']==qid)['replies'][-1]['body'], 'Please include delivery')

    def test_actions_approvals_and_unread_appear_once_and_stay_independent(self):
        root = self.ok(self.client.api('comment', dict(iteration=self.iid, slide='budget', body='Can we use oak?')))['id']
        first = self.item(source_comment_id=root)
        second = self.item(source_comment_id=root, question='Order samples')
        self.assertEqual(len([r for r in self.ok(self.editor.api('attention'))['items'] if r.get('subject_id')==root]), 1)
        request = self.ok(self.editor.api('communication_post', dict(iteration=self.iid, checklist_id=first, body='Approve oak upgrade', recipient='client@example.test', amount='450')), 201)['id']
        self.assertIsNone(self.sql('SELECT parent_id FROM comments WHERE id=?', (request,))[0][0])
        self.assertEqual(self.sql('SELECT related_root_id FROM communication_topics WHERE root_id=?',(request,)),[(root,)])
        rows = [r for r in self.ok(self.editor.api('attention'))['items'] if r.get('subject_id')==root]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['kind'], 'questions')
        before = self.deck()['total_cents']
        self.ok(self.editor.api('save_open_question', dict(iteration=self.iid, id=first, operation='resolve')))
        self.assertEqual(self.deck()['total_cents'], before)
        self.ok(self.client.api('confirmation_decide', dict(iteration=self.iid, id=request, decision='confirmed')))
        self.assertEqual(self.deck()['total_cents'], before+45000)
        self.assertEqual(self.sql('SELECT resolved FROM open_questions WHERE id=?', (second,))[0][0], 0)
        self.assertEqual(len([r for r in self.ok(self.editor.api('attention'))['items'] if r.get('subject_id')==root]), 1)

    def test_client_hub_lists_only_currently_authorized_iterations(self):
        root = self.post(thread_title='Shared oak discussion')
        latest = self.ok(self.editor.api('new_iteration', dict(iteration=self.iid)), 201)['id']
        hidden = self.ok(self.editor.api('communication_post', dict(iteration=latest, body='Draft subject', thread_title='Draft')), 201)['id']
        self.assertNotIn(hidden, [c['id'] for c in self.deck(self.client)['communication']['comments']])
        self.assertNotIn(latest, self.deck(self.client)['communication']['iteration_files'])
        self.sql("UPDATE iterations SET status='shared' WHERE id=?", (latest,))
        self.sql("INSERT INTO shares(id,iteration_id,token_hash,email,expires_at,created_at) VALUES('new-share',?,'new-token','client@example.test',9999999999,'2026-01-02')", (latest,))
        client = Client(self.base, 'client', client_share='new-share')
        hub = self.deck(client, latest)['communication']
        self.assertEqual({i['id'] for i in hub['iterations']}, {self.iid, latest})
        self.assertIn(root, [c['id'] for c in hub['comments']])
        self.assertEqual(hub['iteration_files'][self.iid][0]['id'], 'file-shared')
        added=self.ok(client.api('add_client_question', dict(iteration=latest, question='When can we review the oak?')))
        self.assertTrue(next(q for q in self.deck(client, latest)['communication']['items'] if q['id']==added['id'])['thread_id'])
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.assertNotIn(root, [c['id'] for c in self.deck(client, latest)['communication']['comments']])
        self.denied(self.client.api('communication_post', dict(iteration=self.iid, parent_id=root, body='Revoked')))
        self.assertNotIn('iteration-foreign', [i['id'] for i in self.deck()['communication']['iterations']])

    def test_typed_work_assignment_date_and_completion_are_separate_from_approval(self):
        root=self.post(thread_title='Delivery scope',thread_type='question')
        task=self.post(related_thread_id=root,thread_type='todo',assignee='client@example.test',due_date='2026-10-12')
        hub=self.deck()['communication']
        details=next(c for c in hub['comments'] if c['id']==task)['thread_details']
        self.assertEqual((details['type'],details['assignee'],details['due_date']),('todo','client@example.test','2026-10-12'))
        self.assertEqual(self.sql('SELECT count(*) FROM comment_confirmations WHERE comment_id=?',(task,)),[(0,)])
        q=next(q for q in hub['items'] if q['id']==details['question_id'])
        self.assertEqual((q['thread_id'],q['published'],q['responsible']),(task,1,'Client'))
        before=self.deck()['total_cents']
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=task,resolved=True)))
        self.assertEqual(self.sql('SELECT resolved FROM open_questions WHERE id=?',(q['id'],)),[(1,)])
        self.assertEqual(self.deck()['total_cents'],before)
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=task,resolved=False)))
        self.denied(self.client.api('communication_work_decide',dict(iteration=self.iid,id=task,resolved=True),headers={'X-CSRF-Token':''}))
        private=self.post(audience='studio',thread_type='todo',assignee='editor@example.test')
        self.denied(self.client.api('communication_work_decide',dict(iteration=self.iid,id=private,resolved=True)))
        self.sql("UPDATE iterations SET locked=1 WHERE id=?",(self.iid,))
        self.ok(self.client.api('communication_work_decide',dict(iteration=self.iid,id=task,resolved=True)),409)

    def test_message_types_reject_incompatible_fields_atomically(self):
        before=self.sql('SELECT COUNT(*) FROM comments')
        for fields in [dict(thread_type='bogus'),dict(thread_type='todo'),dict(thread_type='confirmation'),dict(thread_type='price_adjustment',recipient='client@example.test'),dict(thread_type='question',amount='50'),dict(thread_type='discussion',recipient='client@example.test'),dict(thread_type='confirmation',recipient='client@example.test',amount='50'),dict(thread_type='todo',assignee='client@example.test',due_date='2026-02-30'),dict(thread_type='question',assignee='outsider@example.test'),dict(thread_type='todo',audience='studio',assignee='client@example.test')]:
            self.ok(self.editor.api('communication_post',dict(iteration=self.iid,body='Invalid',**fields)),400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comments'),before)
        request=self.post(thread_type='price_adjustment',recipient='client@example.test',amount='-250.50')
        before=self.deck()['total_cents']
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=request,decision='confirmed')))
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=request,decision='confirmed')))
        self.assertEqual(self.deck()['total_cents'],before-25050)

    def test_attention_is_a_communication_filter_with_subject_pagination(self):
        def feed(**extra):
            return self.ok(self.editor.api('comments_feed',query=dict(filter='attention',**extra)))
        self.sql("INSERT INTO comment_reads SELECT id,'user:editor@example.test','2026-01-01' FROM comments")
        root=self.post(thread_title='Needs a decision')
        task=self.post(related_thread_id=root,thread_type='todo',assignee='editor@example.test')
        approval=self.post(related_thread_id=root,thread_type='confirmation',recipient='client@example.test')
        self.ok(self.editor.api('comment_answered',dict(iteration=self.iid,id=root,answered=True)))
        for n in range(105):
            self.sql("INSERT INTO comments(id,iteration_id,slide,author,body,answered,created_at) VALUES(?,?,'general','editor@example.test','Finished',1,'2099-01-01')",('finished-'+str(n),self.iid))
        filtered=feed()
        self.assertEqual({c['id'] for c in filtered['items'] if not c['parent_id']},{task,approval})
        self.assertFalse(filtered['has_more'])
        self.assertEqual(filtered['next_offset'],2)
        self.assertEqual({c['id'] for c in filtered['items']},{task,approval})
        self.ok(self.editor.api('communication_work_decide',dict(iteration=self.iid,id=task,resolved=True)))
        self.assertTrue(feed()['items'])
        self.ok(self.client.api('confirmation_decide',dict(iteration=self.iid,id=approval,decision='confirmed')))
        self.assertEqual(feed()['items'],[])
        reply=self.ok(self.client.api('communication_post',dict(iteration=self.iid,parent_id=root,body='One more detail')),201)['id']
        before=self.sql('SELECT COUNT(*) FROM comment_reads')
        self.assertEqual([c['id'] for c in feed()['items'] if not c['parent_id']],[root])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comment_reads'),before)
        self.ok(self.editor.api('read_comments',dict(iteration=self.iid,ids=[reply])))
        self.assertEqual(feed()['items'],[])
        self.assertEqual(feed(project_id='foreign')['items'],[])
        self.denied(self.client.api('comments_feed',query=dict(filter='attention')))
        self.denied(self.anon.api('comments_feed',query=dict(filter='attention')))
