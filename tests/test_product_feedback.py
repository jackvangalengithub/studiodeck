"""Private product feedback, access control, screenshots, retries and triage.

Run with PHP pdo_sqlite + gd: python3 tests/test_product_feedback.py -v
Uses isolated copies, a temporary database and loopback HTTP. No email or AI calls.
Optional PRODUCT_FEEDBACK_EXPORT writes a browser fixture.
"""
import json
import os
import subprocess
from pathlib import Path
import urllib.error
import urllib.request
import unittest
import uuid
from test_security import Client, SecurityFixture, png, PHP


class ProductFeedbackTests(SecurityFixture):
    def seed(self):
        super().seed()
        (self.tmp / '.env').write_text('PRODUCT_FEEDBACK_TEAM_EMAILS=feedback@studiodeck.com\nAPP_VERSION=feedback-test\n')
        self.sql("UPDATE users SET email='feedback@studiodeck.com' WHERE id='colleague'")
        self.sql("UPDATE studios SET setup_completed_at='2026-01-01'")

    def payload(self, **overrides):
        return dict(request_key=str(uuid.uuid4()), category='friction', area='budget',
                    screen='budget', goal='Prepare a client budget', detail='I have to retype every line.',
                    impact='slows', frequency='often', contact_allowed=False, **overrides)

    def submit(self, client=None, payload=None):
        code, body, _ = (client or self.editor).api('product_feedback_submit', payload or self.payload())
        self.assertEqual(code, 201, body)
        return json.loads(body)['id']

    def reviewer(self):
        return Client(self.base, 'colleague')

    def enable_notifications(self, email='feedback@studiodeck.com'):
        with (self.tmp / '.env').open('a') as file:
            file.write('PRODUCT_FEEDBACK_NOTIFY_EMAIL='+email+'\n')

    def dispatch_mail(self, sender='null'):
        code='require $argv[1]; echo json_encode(dispatch_product_feedback_email('+sender+'));'
        result=subprocess.run([PHP,'-r',code,str(self.tmp / 'app/bootstrap.php')],env=self.env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        return json.loads(result.stdout)

    def inbox(self, **filters):
        code, body, _ = self.reviewer().api('product_feedback_inbox', query=filters)
        self.assertEqual(code, 200, body)
        return json.loads(body)

    def test_submit_and_retry_do_not_duplicate_or_touch_projects(self):
        before = self.sql('SELECT COUNT(*) FROM comments')[0][0]
        p = self.payload()
        report = self.submit(payload=p)
        self.assertEqual(self.submit(payload=p), report)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM product_feedback'), [(1,)])
        self.assertEqual(self.sql('SELECT COUNT(*) FROM comments')[0][0], before)
        item = self.inbox()['items'][0]
        self.assertEqual((item['user_id'], item['studio_id'], item['app_version']), ('editor', 'studio-a', 'feedback-test'))
        self.assertIsNone(item['contact_email'])
        self.assertNotIn('request_key', item)
        # Viewers and expired billing can still tell the product team about problems.
        self.sql("DELETE FROM project_members WHERE user_id='editor'")
        self.sql("UPDATE studio_billing SET legacy_exempt=0,trial_ends_at=1 WHERE studio_id='studio-a'")
        self.submit()

    def test_inbox_and_screenshot_require_explicit_team_allowlist(self):
        report = self.submit()
        for actor in [self.anon, self.editor, self.admin, self.client, Client(self.base, 'outsider')]:
            for action in ['product_feedback_inbox', 'product_feedback_image']:
                code, _, _ = actor.api(action, query={'id': report})
                self.assertIn(code, [401, 403])
            code, _, _ = actor.api('product_feedback_review', {'id': report, 'status': 'shipped'})
            self.assertIn(code, [401, 403])
        for actor, expected in [(self.editor, False), (self.admin, False), (self.reviewer(), True)]:
            code, body, _ = actor.api('session')
            self.assertEqual(code, 200)
            self.assertEqual(json.loads(body)['user']['feedback_reviewer'], expected)
        (self.tmp / '.env').write_text('PRODUCT_FEEDBACK_TEAM_EMAILS=\n')
        self.assertEqual(self.reviewer().api('product_feedback_inbox')[0], 403)

    def test_write_authentication_and_validation(self):
        p = self.payload()
        self.assertEqual(self.anon.api('product_feedback_submit', p)[0], 401)
        self.assertEqual(self.client.api('product_feedback_submit', p)[0], 403)
        self.assertEqual(self.editor.api('product_feedback_submit', p, headers={'X-CSRF-Token': 'bad'})[0], 403)
        self.assertEqual(self.editor.api('product_feedback_submit')[0], 405)
        for changes in [{'category':'unknown'}, {'area':'private-project-id'}, {'screen':'/secret?token=bad'},
                        {'impact':'critical'}, {'frequency':''}, {'goal':'  '}, {'detail':''},
                        {'contact_allowed':'false'}, {'goal':'a'*2001}, {'request_key':'short'}]:
            code, _, _ = self.editor.api('product_feedback_submit', {**p, **changes})
            self.assertEqual(code, 400, changes)
        for category in ['broken', 'friction', 'missing', 'other', 'positive']:
            self.submit(payload={**self.payload(), 'category':category, 'impact':'' if category=='positive' else 'minor'})
        self.assertEqual(len(self.inbox()['items']), 5)

    def test_triage_filters_counts_and_stale_review_protection(self):
        first = self.submit(payload={**self.payload(), 'contact_allowed':True})
        self.submit(Client(self.base, 'outsider'))
        self.submit()
        inbox = self.inbox()
        self.assertEqual(inbox['counts'], {'reports':3, 'users':2, 'studios':2})
        item = next(i for i in inbox['items'] if i['id']==first)
        self.assertEqual(item['contact_email'], 'editor@example.test')
        update = dict(id=first, status='planned', theme='Budget handoff', notes='Explore editable export.', updated_at=item['updated_at'])
        self.assertEqual(self.reviewer().api('product_feedback_review', update, headers={'X-CSRF-Token':'bad'})[0], 403)
        self.assertEqual(self.reviewer().api('product_feedback_review', update)[0], 200)
        self.assertEqual(self.reviewer().api('product_feedback_review', update)[0], 409)
        filtered = self.inbox(status='planned', theme='Budget handoff', search='retype', impact='slows')
        self.assertEqual(filtered['counts']['reports'], 1)
        self.assertEqual(filtered['themes'][0], {'theme':'Budget handoff', 'reports':1, 'users':1, 'studios':1})
        self.assertEqual(self.inbox(search="' OR 1=1 --")['counts']['reports'], 0)
        self.assertEqual(self.inbox(offset=50)['items'], [])
        export = os.getenv('PRODUCT_FEEDBACK_EXPORT')
        if export:
            session=json.loads(self.editor.api('session')[1])
            session['user']['feedback_reviewer']=True
            Path(export).write_text(json.dumps({'session':session,'inbox':inbox}))

    def upload(self, data, filename='screen.png'):
        boundary='product-feedback-boundary'
        body=(f'--{boundary}\r\nContent-Disposition: form-data; name="feedback"\r\n\r\n{json.dumps(self.payload())}\r\n'
              f'--{boundary}\r\nContent-Disposition: form-data; name="screenshot"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
        req=urllib.request.Request(self.base+'/api.php?action=product_feedback_submit',body,headers={
            'Cookie':'studiodeck_session=editor','X-CSRF-Token':'csrf-editor',
            'Content-Type':'multipart/form-data; boundary='+boundary})
        try:
            response=self.editor.opener.open(req)
        except urllib.error.HTTPError as error:
            response=error
        with response:
            return response.code,json.loads(response.read())

    def test_screenshots_are_validated_reencoded_and_private(self):
        original=png('feedback')+b'private-metadata-marker'
        code,result=self.upload(original)
        self.assertEqual(code,201,result)
        code,data,headers=self.reviewer().api('product_feedback_image',query={'id':result['id']})
        self.assertEqual(code,200)
        self.assertEqual(headers['Content-Type'],'image/jpeg')
        self.assertNotIn(b'private-metadata-marker',data)
        self.assertTrue(data.startswith(b'\xff\xd8'))
        self.assertEqual(self.editor.api('product_feedback_image',query={'id':result['id']})[0],403)
        self.assertEqual(self.upload(b'<svg onload="alert(1)"></svg>','attack.svg')[0],400)
        self.assertEqual(self.upload(b'X'*(5*1024*1024+1))[0],400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM product_feedback'),[(1,)])

    def test_new_feedback_queues_one_complete_notification(self):
        self.enable_notifications()
        payload={**self.payload(),'goal':'Prepare <client> budget'}
        report=self.submit(payload=payload)
        self.assertEqual(self.submit(payload=payload),report)
        self.assertEqual(self.sql('SELECT email,status FROM product_feedback_outbox'),[('feedback@studiodeck.com','queued')])
        self.assertTrue(self.dispatch_mail())
        self.assertFalse(self.dispatch_mail())
        self.assertEqual(self.sql('SELECT status,attempts FROM product_feedback_outbox'),[('logged',1)])
        messages=[json.loads(line) for line in Path(str(self.tmp / 'mail.log')+'.messages.jsonl').read_text().splitlines()]
        self.assertEqual(len(messages),1)
        mail=messages[0]
        self.assertEqual(mail['to'],'feedback@studiodeck.com')
        self.assertIn('Budget - Too much effort',mail['subject'])
        for value in [payload['goal'],payload['detail'],'Slows me down','Often',report,'No follow-up email permission.']:
            self.assertIn(value,mail['text'])
        self.assertNotIn('editor@example.test',mail['text'])
        self.assertNotIn('<client>',mail['html'])
        self.assertIn('&lt;client&gt;',mail['html'])
        self.assertIn('Presented by studiodeck',mail['html'])
        self.assertIn('New product feedback',mail['html'])
        self.assertIn('this mailbox is configured for Studiodeck product feedback',mail['html'])
        self.assertNotIn('If you did not request this sign-in link',mail['html'])

    def test_notification_includes_followup_email_only_with_consent(self):
        self.enable_notifications()
        self.submit(payload={**self.payload(),'category':'positive','impact':'','contact_allowed':True})
        self.dispatch_mail()
        mail=json.loads(Path(str(self.tmp / 'mail.log')+'.messages.jsonl').read_text())
        self.assertIn('What worked well for you?',mail['text'])
        self.assertIn('Open to a follow-up email: editor@example.test',mail['text'])
        self.assertNotIn('Impact:',mail['text'])

    def test_mail_failure_retries_without_losing_feedback(self):
        self.enable_notifications()
        self.submit()
        for attempt in range(1,4):
            self.sql('UPDATE product_feedback_outbox SET next_attempt=0')
            self.assertTrue(self.dispatch_mail('fn(...$args)=>false'))
            self.assertEqual(self.sql('SELECT attempts,status FROM product_feedback_outbox'),[(attempt,'failed' if attempt==3 else 'queued')])
            self.assertFalse(self.dispatch_mail('fn(...$args)=>true'))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM product_feedback'),[(1,)])

    def test_mail_delivery_success_and_disabled_recipient(self):
        self.submit()
        self.assertEqual(self.sql('SELECT COUNT(*) FROM product_feedback_outbox'),[(0,)])
        self.enable_notifications()
        self.submit()
        self.assertTrue(self.dispatch_mail('fn(...$args)=>true'))
        self.assertFalse(self.dispatch_mail('fn(...$args)=>true'))
        self.assertEqual(self.sql('SELECT status FROM product_feedback_outbox'),[('sent',)])
        self.submit()
        (self.tmp / '.env').write_text('PRODUCT_FEEDBACK_NOTIFY_EMAIL=\n')
        self.assertTrue(self.dispatch_mail('fn(...$args)=>throw new RuntimeException("Must not send")'))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM product_feedback_outbox WHERE status=?',('cancelled',)),[(1,)])


if __name__ == '__main__':
    unittest.main()
