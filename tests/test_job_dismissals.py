"""Failed processing items can be dismissed without losing task or file history."""
from test_security import SecurityFixture


class JobDismissalTests(SecurityFixture):
    def jobs(self):
        return self.ok(self.editor.api('project', query={'id':'shared'}))['jobs']

    def test_dismissal_persists_and_retry_resets_it(self):
        self.sql("UPDATE jobs SET error='Original failure details' WHERE id='job-shared'")
        self.ok(self.editor.api('dismiss_job', {'id':'job-shared'}))
        self.ok(self.editor.api('dismiss_job', {'id':'job-shared'}))
        job = next(j for j in self.jobs() if j['id'] == 'job-shared')
        self.assertTrue(job['dismissed_at'])
        self.assertEqual((job['status'], job['error']), ('failed', 'Original failure details'))
        self.assertEqual(self.sql("SELECT COUNT(*) FROM file_versions WHERE id='file-shared'"), [(1,)])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM job_dismissals'), [(1,)])
        self.ok(self.editor.api('restore_job', {'id':'job-shared'}))
        self.ok(self.editor.api('restore_job', {'id':'job-shared'}))
        restored = next(j for j in self.jobs() if j['id'] == 'job-shared')
        self.assertFalse(restored['dismissed_at'])
        self.assertEqual((restored['status'], restored['error']), ('failed', 'Original failure details'))
        self.ok(self.editor.api('dismiss_job', {'id':'job-shared'}))
        self.ok(self.editor.api('retry_job', {'id':'job-shared'}))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM job_dismissals'), [(0,)])
        self.sql("UPDATE jobs SET status='failed',error='New failure' WHERE id='job-shared'")
        job = next(j for j in self.jobs() if j['id'] == 'job-shared')
        self.assertFalse(job['dismissed_at'])
        self.assertEqual(job['error'], 'New failure')

    def test_permissions_status_and_locked_iteration(self):
        for project in ['private','public','foreign']:
            for action in ['dismiss_job','restore_job']:
                self.denied(self.editor.api(action, {'id':'job-'+project}))
        for action in ['dismiss_job','restore_job']:
            self.denied(self.client.api(action, {'id':'job-shared'}))
        self.assertEqual(self.editor.api('dismiss_job', {'id':'missing'})[0], 404)
        for status in ['queued','running','done']:
            self.sql("UPDATE jobs SET status=? WHERE id='job-shared'", (status,))
            for action in ['dismiss_job','restore_job']:
                self.assertEqual(self.editor.api(action, {'id':'job-shared'})[0], 400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM job_dismissals'), [(0,)])
        self.sql("UPDATE jobs SET status='failed',type='slide_video' WHERE id='job-shared'")
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        self.ok(self.editor.api('dismiss_job', {'id':'job-shared'}))
        self.assertTrue(next(j for j in self.jobs() if j['id']=='job-shared')['dismissed_at'])
        self.ok(self.editor.api('restore_job', {'id':'job-shared'}))
        self.assertFalse(next(j for j in self.jobs() if j['id']=='job-shared')['dismissed_at'])
