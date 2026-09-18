"""Group removal preserves slides and permissions using isolated API fixtures."""
import unittest
from test_security import SecurityFixture, Client


class SlideGroupTests(SecurityFixture):
    def project(self, iteration='iteration-own'):
        return self.ok(self.editor.api('project', query={'id': 'own', 'iteration': iteration}))

    def remove(self, group, destination, expected=200, iteration='iteration-own'):
        return self.ok(self.editor.api('remove_slide_group', {
            'iteration': iteration, 'group': group, 'destination': destination,
        }), expected)

    def test_existing_group_schema_migrates_without_losing_groups(self):
        self.sql('ALTER TABLE slide_groups DROP COLUMN deleted')
        self.assertIn('story', self.project()['slide_groups'])
        self.remove('story', 'designs')
        self.assertNotIn('story', self.project()['slide_groups'])

    def test_empty_groups_need_no_destination(self):
        group = self.ok(self.editor.api('add_slide_group', {'iteration': 'iteration-own', 'label': 'Empty group'}), 201)['id']
        before = self.project()
        for gid in [group, 'moodboards']:
            self.ok(self.editor.api('remove_slide_group', {'iteration': 'iteration-own', 'group': gid}))
            self.assertNotIn(gid, self.project()['slide_groups'])
        after = self.project()
        for key in ['slides', 'files', 'slide_layout', 'slide_sections']:
            self.assertEqual(before[key], after[key])

    def test_hidden_slides_need_destination_but_deleted_slides_do_not(self):
        group = self.ok(self.editor.api('add_slide_group', {'iteration': 'iteration-own', 'label': 'One slide'}), 201)['id']
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'intro', 'operation': 'section', 'section': group}))
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'intro', 'operation': 'hide'}))
        self.remove(group, '', 400)
        self.assertIn(group, self.project()['slide_groups'])
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'intro', 'operation': 'delete'}))
        before = self.project()
        self.ok(self.editor.api('remove_slide_group', {'iteration': 'iteration-own', 'group': group}))
        after = self.project()
        self.assertNotIn(group, after['slide_groups'])
        self.assertEqual(before['slide_layout'], after['slide_layout'])
        self.assertFalse(any(s['section'] == group for s in after['slide_sections']))

    def test_moves_implicit_explicit_hidden_and_deleted_slides(self):
        group = self.ok(self.editor.api('add_slide_group', {'iteration': 'iteration-own', 'label': 'Destination'}), 201)['id']
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'budget', 'operation': 'section', 'section': 'story'}))
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'intro', 'operation': 'hide'}))
        self.ok(self.editor.api('slide_layout', {'iteration': 'iteration-own', 'slide_id': 'summary', 'operation': 'delete'}))
        before = self.project()
        self.remove('story', group)
        after = self.project()
        self.assertNotIn('story', after['slide_groups'])
        self.assertEqual(before['slides'], after['slides'])
        self.assertEqual(before['files'], after['files'])
        self.assertEqual(before['slide_layout'], after['slide_layout'])
        assignments = {s['slide_id']: s['section'] for s in after['slide_sections']}
        for slide in ['intro', 'changes', 'contacts', 'summary', 'budget']:
            self.assertEqual(assignments[slide], group)
        self.remove(group, 'designs')
        after = self.project()
        self.assertNotIn(group, after['slide_groups'])
        self.assertTrue(all(s['section'] == 'designs' for s in after['slide_sections']))
        newer = self.ok(self.editor.api('new_iteration', {'iteration': 'iteration-own'}), 201)['id']
        copied = self.project(newer)
        self.assertEqual(after['slide_groups'], copied['slide_groups'])
        self.assertEqual(after['slide_sections'], copied['slide_sections'])
        self.assertNotIn('story', copied['slide_groups'])

    def test_default_visual_and_questions_groups_and_last_group(self):
        self.remove('designs', 'current')
        self.assertIn(('visual-slide-own', 'current'), [(s['slide_id'], s['section']) for s in self.project()['slide_sections']])
        self.remove('questions', 'current')
        self.assertNotIn('questions', self.project()['slide_groups'])
        for group in list(self.project()['slide_groups']):
            if group != 'current':
                self.remove(group, 'current')
        self.assertEqual(list(self.project()['slide_groups']), ['current'])
        self.remove('current', 'current', 400)

    def test_invalid_destinations_and_access_leave_group_intact(self):
        before = self.project()
        self.remove('story', '', 400)
        self.remove('story', 'story', 400)
        self.remove('story', 'missing', 400)
        self.remove('missing', 'story', 404)
        body = {'iteration': 'iteration-own', 'group': 'story', 'destination': 'designs'}
        self.denied(Client(self.base, 'outsider').api('remove_slide_group', body))
        self.denied(self.client.api('remove_slide_group', body))
        self.assertEqual(self.editor.api('remove_slide_group', body, headers={'X-CSRF-Token': ''})[0], 403)
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-own'")
        self.assertEqual(self.editor.api('remove_slide_group', body)[0], 409)
        after = self.project()
        self.assertEqual(before['slide_groups'], after['slide_groups'])
        self.assertEqual(before['slide_sections'], after['slide_sections'])


if __name__ == '__main__':
    unittest.main()
