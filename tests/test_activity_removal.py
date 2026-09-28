"""Activity retirement: existing history is removed and project workflows still work."""
import sqlite3
import unittest
from test_security import SecurityFixture


class ActivityRemovalTests(SecurityFixture):
    def assert_no_history(self):
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute("SELECT name FROM sqlite_master WHERE name IN ('events','event_questions','idx_events_project_time')").fetchall(), [])
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_existing_history_is_dropped_without_losing_project_data(self):
        with sqlite3.connect(self.database) as db:
            db.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE events (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), created_at TEXT);
                CREATE INDEX idx_events_project_time ON events(project_id,created_at);
                CREATE TABLE event_questions (event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE, question TEXT, answer TEXT);
                INSERT INTO events VALUES ('legacy','own','2026-01-01');
                INSERT INTO event_questions VALUES ('legacy','Old question','Old answer');
            """)
        for _ in range(2):
            project = self.ok(self.editor.api('project', query={'id': 'own'}))
            self.assertEqual(project['project']['id'], 'own')
            self.assertTrue(project['files'])
            self.assertTrue(project['budget'])
            self.assertTrue(project['comments'])
            self.assertFalse({'events', 'events_facets', 'events_pagination'} & project.keys())
            self.assert_no_history()

    def test_comments_choices_and_questions_work_without_history(self):
        answer = self.ok(self.editor.api('budget_chat', {'iteration': 'iteration-own', 'slide': 'budget', 'question': 'What is the total budget?'}))
        self.assertTrue(answer['answer'])
        self.assertNotIn('activity_event', answer)
        self.ok(self.editor.api('budget_chat', {'iteration': 'iteration-own', 'slide': 'foreign-slide', 'question': 'Invalid slide'}), 404)
        reply = self.ok(self.editor.api('comment', {'iteration': 'iteration-own', 'slide': 'intro', 'body': 'Keep this comment'}))
        self.ok(self.editor.api('budget_choice', {'iteration': 'iteration-own', 'id': 'budget-own', 'selected': True}))
        project = self.ok(self.editor.api('project', query={'id': 'own'}))
        self.assertIn(reply['id'], [c['id'] for c in project['comments']])
        self.assertEqual(project['total_cents'], 10000)
        self.assert_no_history()

    def test_removed_endpoints_are_unavailable(self):
        self.ok(self.editor.api('activity_feed'), 405)
        self.ok(self.editor.api('view_event', {'iteration': 'iteration-own', 'slide': 'intro'}), 404)
        self.assert_no_history()


if __name__ == '__main__':
    unittest.main()
