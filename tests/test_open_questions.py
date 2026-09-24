"""Isolated HTTP and worker tests. No paid AI calls or real email."""
import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path

from test_security import Client, SecurityFixture, PHP, ROOT


class OpenQuestionTests(SecurityFixture):
    def seed(self):
        super().seed()
        # These fixture projects represent existing, entitled studios.
        if self.sql("SELECT 1 FROM sqlite_master WHERE name='studio_billing'"):
            self.sql("INSERT OR IGNORE INTO studio_billing(studio_id,legacy_exempt,onboarded_at) SELECT id,1,1 FROM studios")
            self.sql("INSERT OR IGNORE INTO project_coverage(project_id,source) SELECT id,'legacy' FROM projects")

    def save(self, project='shared', **fields):
        return self.ok(self.editor.api('save_open_question', {
            'iteration': 'iteration-' + project, 'question': 'Is installation included?',
            'kind': 'clarification', 'published': False, **fields}))['id']

    def deck(self, actor=None, project='shared'):
        return self.ok((actor or self.editor).api('deck', query={'iteration': 'iteration-' + project}))

    def php(self, code):
        result = subprocess.run([PHP, '-r', "require 'app/ai.php'; " + code],
                                cwd=self.tmp, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result.stdout

    def test_legacy_migration_preserves_reviewed_items_and_custom_labels(self):
        result = json.loads(self.php("""
            $legacy=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
            $legacy->exec(file_get_contents('app/schema.sql'));
            $legacy->exec(file_get_contents('app/confirmation_schema.sql'));
            $legacy->exec('CREATE TABLE migrations(name TEXT PRIMARY KEY)');
            $legacy->exec("INSERT INTO open_questions(id,iteration_id,question,origin,published,edited,created_at) VALUES('suggestion','old','Suggested','ai',0,0,'now'),('reviewed','old','Reviewed','ai',0,1,'now'),('shared','old','Shared','ai',1,0,'now')");
            $legacy->exec("INSERT INTO slide_groups(iteration_id,id,label,position) VALUES('old','questions','Open questions',0),('custom','questions','Our next steps',0)");
            migrate_checklist($legacy);migrate_checklist($legacy);
            echo json_encode(['items'=>$legacy->query('SELECT id,accepted,item_type FROM open_questions ORDER BY id')->fetchAll(),'labels'=>$legacy->query('SELECT label FROM slide_groups ORDER BY iteration_id')->fetchAll(PDO::FETCH_COLUMN)]);
        """))
        self.assertEqual({q['id']: q['accepted'] for q in result['items']}, {'suggestion': 0, 'reviewed': 1, 'shared': 1})
        self.assertTrue(all(q['item_type'] == 'question' for q in result['items']))
        self.assertEqual(result['labels'], ['Our next steps', 'Checklist'])

    def test_accept_private_action_preserve_regeneration_and_manual_completion(self):
        qid=self.save(question='Order flooring samples',item_type='action')
        q=self.deck()['open_questions'][0]
        self.assertEqual(q['id'],qid)
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 1)
        self.php("generate_open_questions('iteration-shared');")
        self.assertEqual(self.deck()['open_questions'][0]['id'], q['id'])
        self.save(id=q['id'], question='Order flooring samples', item_type='action', responsible='Jules', kind='answered', answer='Supplier has samples.')
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 1)
        self.ok(self.editor.api('save_open_question', dict(iteration='iteration-shared', id=q['id'], operation='resolve')))
        self.php("generate_open_questions('iteration-shared');")
        self.assertEqual(len(self.deck()['open_questions']), 1)
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 0)
        self.ok(self.editor.api('save_open_question', dict(iteration='iteration-shared', id=q['id'], operation='reopen')))
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 1)

    def test_comment_links_approval_privacy_budget_and_iteration_carry(self):
        comment = self.ok(self.client.api('comment', dict(iteration='iteration-shared', slide='budget', body='Can we include installation?')))['id']
        qid = self.save(source_comment_id=comment, item_type='action', responsible='Jules')
        request = self.ok(self.editor.api('communication_post', dict(iteration='iteration-shared', checklist_id=qid,
            body='Confirm installation for an extra 800 euro', recipient='client@example.test', amount='800')), 201)['id']
        item = self.deck()['open_questions'][0]
        self.assertEqual(item['source_comment']['id'], comment)
        self.assertEqual(item['confirmation']['status'], 'pending')
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 0)
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['confirmations'], 1)
        self.ok(self.editor.api('communication_post', dict(iteration='iteration-shared', checklist_id=qid,
            body='Duplicate', recipient='client@example.test')), 409)
        self.ok(self.editor.api('save_open_question', dict(iteration='iteration-shared', id=qid, operation='resolve')))
        self.assertEqual(self.sql('SELECT status FROM comment_confirmations WHERE comment_id=?', (request,))[0][0], 'pending')
        self.assertEqual(self.sql('SELECT COUNT(*) FROM confirmation_budget_links WHERE comment_id=?', (request,))[0][0], 0)
        self.ok(self.editor.api('save_open_question', dict(iteration='iteration-shared', id=qid, operation='reopen')))
        latest = self.ok(self.editor.api('new_iteration', dict(iteration='iteration-shared')), 201)['id']
        copied = self.ok(self.editor.api('deck', query={'iteration': latest}))['open_questions'][0]
        self.assertEqual(copied['confirmation']['iteration_id'], 'iteration-shared')
        self.assertEqual(copied['responsible'], 'Jules')
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 0)
        self.ok(self.client.api('confirmation_decide', dict(iteration='iteration-shared', id=request, decision='confirmed')))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM confirmation_budget_links WHERE comment_id=?', (request,))[0][0], 1)
        self.assertEqual(self.ok(self.editor.api('attention'))['counts']['questions'], 1)
        self.assertEqual(self.deck()['open_questions'][0]['resolved'], 0)

    def test_links_cannot_cross_projects_or_bypass_team_and_lock(self):
        foreign = self.ok(self.editor.api('comment', dict(iteration='iteration-own', slide='budget', body='Other project')))['id']
        self.denied(self.editor.api('save_open_question', dict(iteration='iteration-shared', question='Bad link', published=False, source_comment_id=foreign)))
        self.denied(self.editor.api('save_open_question', dict(iteration='iteration-shared', question='Bad approval', published=False, confirmation_id=foreign)))
        qid = self.save()
        self.denied(self.client.api('communication_post', dict(iteration='iteration-shared', checklist_id=qid, body='Try private item', recipient='editor@example.test')))
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        self.ok(self.editor.api('communication_post', dict(iteration='iteration-shared', checklist_id=qid, body='Locked', recipient='client@example.test')), 409)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comment_confirmations')[0][0], 0)

    def test_private_review_replies_activity_and_access(self):
        self.assertEqual(self.deck()['slide_groups']['questions'], 'Checklist')
        qid = self.save()
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        if os.environ.get('OPEN_QUESTIONS_BROWSER_EXPORT'):
            payload={'session': self.ok(self.editor.api('session')), 'deck': self.ok(self.editor.api('project', query={'id': 'shared'}))}
            Path(os.environ['OPEN_QUESTIONS_BROWSER_EXPORT']).write_text(json.dumps(payload))
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Guessing a draft ID'}))
        root=self.deck()['open_questions'][0]['thread_id']
        self.ok(self.editor.api('communication_share', dict(iteration='iteration-shared', id=root, share_history=True)))
        self.save(id=qid, kind='answered', answer='The designer will confirm the scope.', published=True)
        self.assertEqual(self.deck(self.client)['open_questions'][0]['answer'], 'The designer will confirm the scope.')
        self.ok(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Please include removal too.'}))
        question = self.deck()['open_questions'][0]
        self.assertEqual(question['replies'][0]['author'], 'client@example.test')
        events = self.ok(self.editor.api('project', query={'id': 'shared'}))['events']
        self.assertTrue(any(e['type'] == 'open_question_reply' and 'removal' in e['detail'] for e in events))
        for actor in (self.client, Client(self.base, 'outsider'), self.anon):
            self.denied(actor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid}))
            self.denied(actor.api('generate_open_questions', {'iteration': 'iteration-shared'}))
        self.denied(self.editor.api('save_open_question', {'iteration': 'iteration-shared'}, headers={'X-CSRF-Token': ''}))
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-own', 'id': qid, 'body': 'No'}))
        self.denied(self.editor.api('reply_open_question', {'iteration': 'iteration-own', 'id': qid, 'body': 'Wrong iteration'}))
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid, 'operation': 'dismiss'}))
        self.assertEqual(self.deck(self.client)['open_questions'], [])
        self.denied(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Hidden'}))

    def test_source_change_marks_saved_answers_stale(self):
        qid=self.save(kind='answered',answer='Installation is included.',published=True)
        self.sql('UPDATE file_versions SET extracted_text=? WHERE id=?',('Installation now needs confirmation.','file-shared'))
        stale=self.deck(self.client)['open_questions'][0]
        self.assertTrue(stale['stale'])
        self.assertEqual(stale['answer'],'')

    def test_locked_content_conversations_and_iteration_snapshots(self):
        qid = self.save(published=True)
        resolved = self.save(question='A completed decision', published=True)
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': resolved, 'operation': 'resolve'}))
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        self.ok(self.editor.api('generate_open_questions', {'iteration': 'iteration-shared'}), 409)
        self.ok(self.editor.api('save_open_question', {'iteration': 'iteration-shared', 'id': qid, 'operation': 'dismiss'}), 409)
        self.ok(self.client.api('reply_open_question', {'iteration': 'iteration-shared', 'id': qid, 'body': 'Continue our discussion'}))
        self.ok(self.client.api('add_client_question', {'iteration': 'iteration-shared', 'question': 'When can we meet?'}))
        iid = self.ok(self.editor.api('new_iteration', {'iteration': 'iteration-shared'}), 201)['id']
        questions = self.ok(self.editor.api('deck', query={'iteration': iid}))['open_questions']
        self.assertEqual(len(questions), 3)
        copied = next(q for q in questions if q['id'] == qid)
        self.assertFalse(copied['stale'])
        self.assertEqual(len(copied['replies']), 1)
        self.assertEqual(copied['iteration_id'], 'iteration-shared')
        self.assertEqual(self.sql('SELECT COUNT(*) FROM open_questions WHERE id=?', (qid,))[0][0], 1)
        self.ok(self.editor.api('reply_open_question', {'iteration': copied['iteration_id'], 'id': qid, 'body': 'Continue the original conversation'}))
        self.assertEqual(len(next(q for q in self.deck(self.client)['open_questions'] if q['id'] == qid)['replies']), 2)
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.denied(self.client.api('add_client_question', {'iteration': 'iteration-shared', 'question': 'Revoked'}))

    def test_no_ai_means_no_generic_fallback_suggestions(self):
        self.ok(self.editor.api('generate_open_questions', {'iteration': 'iteration-shared'}), 202)
        self.assertEqual(self.sql("SELECT COUNT(*) FROM jobs WHERE type='open_questions'"),[(0,)])
        self.php("generate_open_questions('iteration-shared');")
        self.assertEqual(self.deck()['open_questions'],[])
        qid=self.save(question='Keep this manual action',item_type='action')
        self.php("try {generate_open_questions('iteration-shared',function(){throw new RuntimeException('provider unavailable');});}catch(Throwable $e){}")
        self.assertEqual([q['id'] for q in self.deck()['open_questions']],[qid])


if __name__ == '__main__':
    unittest.main()
