"""Activity filtering across complete history with authorized facets."""
from test_security import SecurityFixture


class ActivityFilterTests(SecurityFixture):
    def event(self, ident, project='shared', kind='file_added', actor='Designer', detail='Oak', date='2026-09-20T12:00:00Z'):
        self.sql('INSERT INTO events(id,project_id,iteration_id,actor,type,detail,created_at) VALUES(?,?,?,?,?,?,?)',
                 (ident, project, 'iteration-' + project, actor, kind, detail, date))

    def feed(self, **query):
        return self.ok(self.editor.api('activity_feed', query=query))

    def project(self, **query):
        return self.ok(self.editor.api('project', query=dict(id='shared', **query)))

    def test_search_filters_and_sort_precede_pagination(self):
        self.sql('DELETE FROM events')
        for n in range(125):
            self.event('event-' + str(n), detail='Walnut finish', actor='Client' if n % 2 else 'Designer')
        self.event('needle', kind='question_answered', detail='Choose a finish', date='2026-09-21T23:59:59Z')
        self.sql("INSERT INTO event_questions(event_id,slide,slide_title,question,answer,status) VALUES('needle','intro','Welcome home','What fits?','Natural oak at 10% premium','answered')")
        self.event('status-noise', kind='comment_status_changed', actor='Hidden status actor')
        first = self.feed(sort='oldest')
        second = self.feed(sort='oldest', offset=100)
        self.assertEqual(first['total'], 126)
        self.assertNotIn('comment_status_changed', first['facets']['types'])
        self.assertNotIn('Hidden status actor', first['facets']['actors'])
        self.assertEqual(self.feed(type='comment_status_changed')['items'], [])
        self.assertTrue(first['has_more'])
        self.assertEqual(len(first['items']), 100)
        self.assertEqual(len(second['items']), 26)
        self.assertFalse(set(x['id'] for x in first['items']) & set(x['id'] for x in second['items']))
        self.assertEqual(second['items'][-1]['id'], 'needle')
        found = self.feed(search='10%', type='question_answered', actor='Designer', **{'from':'2026-09-21','to':'2026-09-21'})
        self.assertEqual([x['id'] for x in found['items']], ['needle'])
        self.assertEqual(found['items'][0]['question_answer']['answer'], 'Natural oak at 10% premium')
        self.assertEqual(self.feed(search='_')['total'], 0)
        self.assertEqual(self.feed(search='walnut', actor='Client')['total'], 62)
        page = self.project(events_sort='oldest', events_page=5)
        self.assertEqual(page['events'][0]['id'], 'event-100')
        filtered = self.project(events_search='natural oak', events_page=5)
        self.assertEqual(filtered['events_pagination'], dict(page=0, per_page=20, total=1))
        self.assertEqual(filtered['events'][0]['id'], 'needle')
        self.assertEqual(self.feed(sort='newest')['items'][0]['id'], 'needle')

    def test_facets_and_results_respect_access_and_project(self):
        self.sql('DELETE FROM events')
        for pid in ['shared','public','private','foreign']:
            self.event(pid, project=pid, actor=pid, kind=pid)
        feed = self.feed(search='nothing')
        self.assertEqual(feed['total'], 0)
        self.assertEqual(set(feed['facets']['actors']), {'shared','public'})
        self.assertEqual(set(feed['facets']['types']), {'shared','public'})
        self.assertEqual({p['id'] for p in feed['facets']['projects']}, {'shared','public'})
        self.assertEqual(self.feed(project='foreign')['total'], 0)
        self.assertEqual(self.feed(project='private')['total'], 0)
        self.assertEqual([e['id'] for e in self.feed(project='public')['items']], ['public'])
        self.assertEqual(self.project()['events_facets']['actors'], ['shared'])
        self.assertEqual(self.project(events_actor='public')['events'], [])
        self.assertEqual(self.client.api('activity_feed')[0], 403)

    def test_invalid_sort_and_dates_rejected(self):
        for query in [dict(sort='random'), {'from':'2026-02-30'}, {'from':'2026-09-21','to':'2026-09-20'}]:
            self.assertEqual(self.editor.api('activity_feed', query=query)[0], 400)
            self.assertEqual(self.editor.api('project', query=dict(id='shared', **{'events_'+k:v for k,v in query.items()}))[0], 400)
