"""Personal inbox semantics, filtering before pagination, and stable slide origins."""
from test_security import SecurityFixture


class CommunicationViewTests(SecurityFixture):
    iid = 'iteration-shared'

    def deck(self, client=None, iteration=None):
        return self.ok((client or self.editor).api('deck', query={'iteration': iteration or self.iid}))

    def post(self, **fields):
        return self.ok(self.editor.api('communication_post', dict(iteration=self.iid, body='Oak finish', **fields)), 201)['id']

    def feed(self, view='all', kind='all', **extra):
        return self.ok(self.editor.api('comments_feed', query=dict(filter=view, type=kind, show_answered=1, **extra)))

    def roots(self, view='all', kind='all', **extra):
        return {c['id'] for c in self.feed(view, kind, **extra)['items'] if not c['parent_id']}

    def test_personal_attention_and_closed_thread_unread_reply(self):
        self.sql("INSERT INTO comment_reads SELECT id,'user:editor@example.test','2026-01-01' FROM comments")
        mine = self.post(thread_type='todo', assignee='editor@example.test')
        theirs = self.post(thread_type='todo', assignee='client@example.test')
        approval = self.post(thread_type='approval', recipient='client@example.test')
        conversation = self.post(thread_type='conversation')
        self.assertEqual(self.roots('attention'), {mine})
        self.assertEqual(self.feed('all')['view_counts']['attention'],1)
        self.assertTrue({mine, theirs, approval, conversation}.issubset(self.roots('open')))
        client = {c['id']: c for c in self.deck(self.client)['communication']['comments']}
        self.assertTrue(client[theirs]['needs_attention'])
        self.assertTrue(client[approval]['needs_attention'])
        self.assertFalse(client[conversation]['needs_attention'])
        self.ok(self.editor.api('comment_answered', dict(iteration=self.iid, id=conversation, answered=True)))
        reply = self.ok(self.client.api('communication_post', dict(iteration=self.iid, parent_id=conversation, body='One more detail')), 201)['id']
        self.assertIn(conversation, self.roots('attention'))
        self.assertNotIn(conversation, self.roots('open'))
        self.ok(self.editor.api('read_comments', dict(iteration=self.iid, ids=[reply, mine])))
        self.assertEqual(self.roots('attention'), {mine})
        self.ok(self.editor.api('communication_work_decide', dict(iteration=self.iid, id=mine, resolved=True)))
        self.assertEqual(self.roots('attention'), set())
        self.assertNotIn(mine, self.roots('open'))
        self.assertIn(mine, self.roots())
        self.ok(self.client.api('confirmation_decide', dict(iteration=self.iid, id=approval, decision='confirmed')))
        self.assertNotIn(approval, self.roots('open'))
        self.assertIn(approval, self.roots('all', 'approval'))

    def test_unread_is_personal_and_mentions_do_not_reopen_work(self):
        self.sql("INSERT INTO comment_reads SELECT id,'user:editor@example.test','2026-01-01' FROM comments")
        root = self.ok(self.client.api('communication_post', dict(iteration=self.iid, body='Client discussion')), 201)['id']
        self.assertNotIn(root, self.roots('attention'))
        self.ok(self.client.api('comment_answered', dict(iteration=self.iid, id=root, answered=True)))
        reply = self.ok(self.client.api('communication_post', dict(iteration=self.iid, parent_id=root, body='@editor@example.test please review')), 201)['id']
        self.assertIn(root, self.roots('attention'))
        self.assertNotIn(root, self.roots('open'))
        self.ok(self.editor.api('read_comments', dict(iteration=self.iid, ids=[reply])))
        self.assertNotIn(root, self.roots('attention'))

    def test_type_filter_precedes_pagination_and_keeps_replies(self):
        approval = self.post(thread_type='approval', recipient='client@example.test')
        reply = self.post(parent_id=approval)
        for n in range(105):
            self.sql("INSERT INTO comments(id,iteration_id,slide,author,body,created_at) VALUES(?,?,'general','editor@example.test','Newer conversation','2099-01-01')", ('new-'+str(n), self.iid))
        result = self.feed('open', 'approval')
        self.assertEqual({c['id'] for c in result['items']}, {approval, reply})
        self.assertFalse(result['has_more'])
        self.assertEqual(result['next_offset'], 1)
        self.assertEqual(self.feed('attention', 'approval')['items'], [])
        self.ok(self.editor.api('confirmation_decide', dict(iteration=self.iid, id=approval, decision='withdrawn')))
        self.assertEqual(self.roots('open', 'approval'), set())
        self.assertEqual(self.roots('all', 'approval'), {approval})
        self.assertEqual(self.feed('all', 'approval', project_id='foreign')['items'], [])
        self.ok(self.editor.api('comments_feed', query={'type':'unknown'}), 400)

    def test_slide_link_updates_replies_without_changing_approval_terms(self):
        root = self.post(thread_type='approval', recipient='client@example.test', amount='125')
        reply = self.post(parent_id=root)
        terms = self.sql('SELECT * FROM comment_confirmations WHERE comment_id=?', (root,))
        body = dict(iteration=self.iid, id=root, slide='visual-slide-shared')
        self.denied(self.client.api('communication_slide_link', body))
        self.denied(self.editor.api('communication_slide_link', body, headers={'X-CSRF-Token':''}))
        self.ok(self.editor.api('communication_slide_link', body))
        self.assertEqual(self.sql('SELECT slide FROM comments WHERE id IN (?,?)', (root, reply)), [('visual-slide-shared',), ('visual-slide-shared',)])
        self.assertEqual(self.sql('SELECT * FROM comment_confirmations WHERE comment_id=?', (root,)), terms)
        self.ok(self.editor.api('communication_slide_link', dict(body, slide='budget')), 409)
        later = self.post(parent_id=root)
        self.assertEqual(self.sql('SELECT slide FROM comments WHERE id=?', (later,)), [('visual-slide-shared',)])
        latest = self.ok(self.editor.api('new_iteration', dict(iteration=self.iid)), 201)['id']
        origin = next(c for c in self.deck(iteration=latest)['communication']['comments'] if c['id']==root)
        self.assertEqual((origin['iteration_id'], origin['slide']), (self.iid, 'visual-slide-shared'))

    def test_slide_picker_and_links_respect_scope_visibility_and_locks(self):
        root = self.post()
        def link(slide, client=None):
            return (client or self.editor).api('communication_slide_link', dict(iteration=self.iid, id=root, slide=slide))
        self.ok(link('visual-slide-foreign'), 404)
        self.ok(self.editor.api('communication_post', dict(iteration=self.iid, slide='visual-slide-foreign', body='Wrong source')), 404)
        self.sql("INSERT INTO slide_layout(iteration_id,slide_id,hidden) VALUES(?,'visual-slide-shared',1)", (self.iid,))
        client_hub = self.deck(self.client)['communication']
        self.assertNotIn('visual-slide-shared', {s['id'] for s in client_hub['iteration_slides'][self.iid]})
        self.assertNotIn('iteration-foreign', client_hub['iteration_slides'])
        self.ok(self.client.api('communication_post', dict(iteration=self.iid, slide='visual-slide-shared', body='Hidden')), 404)
        self.sql("UPDATE slide_layout SET deleted=1 WHERE iteration_id=?", (self.iid,))
        self.ok(link('visual-slide-shared'), 404)
        self.sql('UPDATE iterations SET locked=1 WHERE id=?', (self.iid,))
        self.ok(link('budget'), 409)


    def test_search_multiple_types_and_pages_keep_complete_subjects(self):
        for n in range(53):
            root='paged-'+str(n).zfill(2)
            self.sql("INSERT INTO comments(id,iteration_id,slide,author,body,created_at) VALUES(?,?,'general','editor@example.test',?,'2099-01-01')", (root,self.iid,'Pagination '+str(n).zfill(2)))
            self.sql("INSERT INTO communication_topics(root_id,type) VALUES(?,?)", (root,['conversation','todo','approval'][n%3]))
        reply=self.post(parent_id='paged-52')
        self.sql("UPDATE comments SET body='A unique needle with 100% oak_wood' WHERE id=?", (reply,))
        first=self.feed(search='Pagination',limit=25)
        second=self.feed(search='Pagination',limit=25,offset=25)
        last=self.feed(search='Pagination',limit=25,offset=50)
        ids=lambda page:[c['id'] for c in page['items'] if not c['parent_id']]
        self.assertEqual([len(ids(page)) for page in [first,second,last]],[25,25,3])
        self.assertEqual(len(set(ids(first)+ids(second)+ids(last))),53)
        self.assertEqual([page['total'] for page in [first,second,last]],[53,53,53])
        self.assertEqual([page['view_counts'] for page in [first,second,last]],[{'open':53,'attention':0}]*3)
        self.assertEqual(self.feed('attention',search='Pagination')['view_counts'],{'open':53,'attention':0})
        self.assertFalse(last['has_more'])
        self.assertEqual(first['next_offset'],25)
        combined=self.feed(search='Pagination',types='conversation,todo',limit=100)
        self.assertEqual(combined['total'],36)
        self.assertEqual(self.feed(search='Pagination',types='none')['total'],0)
        self.assertEqual(self.feed(search='Pagination',types='none')['view_counts'],{'open':0,'attention':0})
        self.assertEqual(self.feed(search='Pagination',project_id='foreign')['view_counts'],{'open':0,'attention':0})
        self.assertEqual(ids(self.feed(search='unique needle')),['paged-52'])
        self.assertEqual({c['id'] for c in self.feed(search='100% oak_wood')['items']},{'paged-52',reply})
        self.assertEqual(self.feed(search="%' OR 1=1 --")['total'],0)
        self.assertEqual(self.feed(search='Pagination',project_id='foreign')['total'],0)
        self.assertEqual(ids(self.feed(search='Pagination',sort='oldest',limit=25))[0],'paged-00')
        self.assertEqual(self.feed(search='Pagination',limit=25,offset=500)['offset'],50)
        self.ok(self.editor.api('comments_feed',query={'types':'todo,unknown'}),400)
