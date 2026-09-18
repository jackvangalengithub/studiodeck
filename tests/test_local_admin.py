"""Opt-in, read-only local account acceptance check. Never promotes users.

LOCAL_ADMIN_DATABASE=storage/studiodeck.sqlite python3 tests/test_local_admin.py
Optional LOCAL_ADMIN_IDENTITY (default jackvangalen) and LOCAL_ADMIN_STUDIO_ID.
Without a studio ID, checks every membership for the uniquely matched account.
Missing local configuration is reported as skipped, never as a passing check.
"""
import os
from pathlib import Path
import sqlite3
import unittest


class LocalAdminTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('LOCAL_ADMIN_DATABASE'), 'Set LOCAL_ADMIN_DATABASE for the read-only local account check')
    def test_account_is_already_a_studio_admin(self):
        path=Path(os.environ['LOCAL_ADMIN_DATABASE']).resolve()
        self.assertTrue(path.is_file(), f'Database not found: {path}')
        identity=os.environ.get('LOCAL_ADMIN_IDENTITY','jackvangalen').lower()
        # mode=ro refuses writes, including accidental database creation.
        with sqlite3.connect(path.as_uri()+'?mode=ro',uri=True) as db:
            db.execute('PRAGMA query_only=ON')
            users=db.execute("SELECT id FROM users WHERE lower(email)=? OR lower(name)=? OR lower(substr(email,1,instr(email,'@')-1))=?",(identity,identity,identity)).fetchall()
            self.assertEqual(len(users),1,'Expected one unambiguous account; use its full email if needed')
            rows=db.execute('SELECT studio_id,role FROM studio_members WHERE user_id=?',(users[0][0],)).fetchall()
            studio=os.environ.get('LOCAL_ADMIN_STUDIO_ID')
            if studio: rows=[row for row in rows if row[0]==studio]
            self.assertTrue(rows,'Account must belong to the requested studio(s)')
            for studio_id,role in rows:
                with self.subTest(studio=studio_id):
                    self.assertEqual(role,'admin',f'{identity} is {role} in studio {studio_id}')
            print(f'Checked {len(rows)} studio membership(s), read-only.')


if __name__=='__main__':
    unittest.main(verbosity=2)
