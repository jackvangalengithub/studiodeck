"""Repeatable system slides share content while retaining independent layout and access."""
import unittest
from test_security import SecurityFixture, Client


class SystemSlideTests(SecurityFixture):
    def add(self, kind='budget', iteration='iteration-own', section=''):
        return self.ok(self.editor.api('add_system_slide', {
            'iteration': iteration, 'type': kind, 'section': section,
        }), 201)['id']

    def project(self, iteration='iteration-own', project='own'):
        return self.ok(self.editor.api('project', query={'id': project, 'iteration': iteration}))

    def test_repeated_types_share_content_and_keep_independent_layout(self):
        types = ['intro', 'changes', 'budget', 'open-questions', 'contacts', 'summary']
        ids = [self.add(kind) for kind in types]
        later = self.add(section='story')
        self.assertEqual(len(set(ids + [later])), 7)
        self.assertEqual([s['type'] for s in self.project()['system_slides']], types + ['budget'])
        self.ok(self.editor.api('save_slide', {'iteration': 'iteration-own', 'slide_id': later,
                                             'title': 'Our shared investment', 'description': 'Live numbers', 'section': 'current'}))
        self.assertEqual(self.project()['slide_content'], [{'slide_id': 'budget', 'title': 'Our shared investment', 'description': 'Live numbers'}])
        for operation in ['hide', 'show', 'delete']:
            self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': ids[2], 'operation': operation}))
        layout = {s['slide_id']: s for s in self.project()['slide_layout']}
        self.assertEqual(layout[ids[2]]['deleted'], 1)
        self.assertEqual(layout[later]['deleted'], 0)
        order = ['intro', 'visual-slide-own', 'changes', 'budget', 'open-questions', 'contacts', 'summary'] + [s for s in ids if s != ids[2]] + [later]
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'operation': 'reorder', 'order': order[::-1]}))
        self.assertEqual(next(s for s in self.project()['slide_layout'] if s['slide_id'] == later)['position'], 0)
        self.ok(self.editor.api('remove_slide_group', {'iteration': 'iteration-own', 'group': 'current', 'destination': 'designs'}))
        self.assertEqual(next(s for s in self.project()['slide_sections'] if s['slide_id'] == later)['section'], 'designs')
        newer = self.ok(self.editor.api('new_iteration', {'iteration': 'iteration-own'}), 201)['id']
        self.assertEqual(self.project(newer)['system_slides'], self.project()['system_slides'])
        self.ok(self.editor.api('save_slide', {'iteration': newer, 'slide_id': later, 'title': 'New iteration', 'description': ''}))
        self.assertEqual(self.project()['slide_content'][0]['title'], 'Our shared investment')
        self.assertEqual(self.project(newer)['slide_content'][0]['title'], 'New iteration')

    def test_shared_deck_budget_choices_and_comments_use_the_same_project_data(self):
        first = self.add(iteration='iteration-shared')
        second = self.add(iteration='iteration-shared')
        deck = self.ok(self.client.api('deck'))
        self.assertEqual([s['id'] for s in deck['system_slides']], [first, second])
        self.ok(self.client.api('budget_choice', {'iteration': 'iteration-shared', 'id': 'budget-shared', 'selected': True}))
        self.assertEqual(self.ok(self.client.api('deck'))['total_cents'], 10000)
        self.assertEqual(self.project('iteration-shared', 'shared')['total_cents'], 10000)
        self.ok(self.editor.api('save_slide', {'iteration': 'iteration-shared', 'slide_id': first, 'title': 'Shared budget', 'description': 'Live'}))
        self.assertEqual(self.ok(self.client.api('deck'))['slide_content'][0]['title'], 'Shared budget')
        comment = self.ok(self.client.api('comment', {'iteration': 'iteration-shared', 'slide': second, 'body': 'About this budget view'}))
        self.assertTrue(self.client.api('comment_preview', query={'id': comment['id']})[1].startswith(b'\x89PNG'))
        self.assertEqual(next(c for c in self.ok(self.client.api('deck'))['comments'] if c['id'] == comment['id'])['slide'], second)

    def test_invalid_types_scope_csrf_and_locked_iterations(self):
        body = {'iteration': 'iteration-own', 'type': 'budget'}
        for kind in ['', 'photo', 'system-budget']:
            self.ok(self.editor.api('add_system_slide', {**body, 'type': kind}), 400)
        self.ok(self.editor.api('add_system_slide', {**body, 'section': 'missing'}), 400)
        self.denied(Client(self.base, 'outsider').api('add_system_slide', body))
        self.denied(self.client.api('add_system_slide', body))
        self.assertEqual(self.editor.api('add_system_slide', body, headers={'X-CSRF-Token': ''})[0], 403)
        sid = self.add()
        self.ok(self.editor.api('save_slide', {'iteration': 'iteration-shared', 'slide_id': sid, 'title': 'Wrong iteration'}), 404)
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-own'")
        self.ok(self.editor.api('add_system_slide', body), 409)
        self.assertEqual(len(self.project()['system_slides']), 1)


if __name__ == '__main__':
    unittest.main()
