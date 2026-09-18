"""Question/answer activity persistence and access checks. No AI or real email."""
from pathlib import Path
import http.cookiejar,urllib.request,urllib.error,json,os,tempfile,subprocess,time,sqlite3
ROOT=Path(__file__).resolve().parents[1];PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value:raise AssertionError(message)
    print('PASS',message,flush=True)
class Client:
    def __init__(self,base):
        self.base=base; self.csrf=''; self.bearer=''
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False):
        headers={}
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
        if files:
            boundary='studiodeck-test-boundary';parts=[]
            for k,v in data.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for name,mime,blob in files:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="files[]"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+blob+b'\r\n')
            parts.append(f'--{boundary}--\r\n'.encode());body=b''.join(parts);headers['Content-Type']='multipart/form-data; boundary='+boundary
        elif data is not None:body=json.dumps(data).encode();headers['Content-Type']='application/json'
        else:body=None
        req=urllib.request.Request(self.base+'/api.php?action='+action+query,data=body,headers=headers)
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        value=r.read()
        if r.code!=expected:raise AssertionError(f'{action}: expected {expected}, got {r.code}: {value[:600]!r}')
        return value if raw else json.loads(value)
    def login(self,email,log):
        self.call('request_login',{'email':email})
        tok=log.read_text().strip().splitlines()[-1].split('/#/login/')[1]
        self.call('consume_login',{'token':tok})
        self.csrf=self.call('session')['csrf']
        return tok

with tempfile.TemporaryDirectory(prefix='studiodeck-questions-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8096';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-d','display_errors=0','-S','127.0.0.1:8096','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        owner=Client(base)
        for _ in range(60):
            try:owner.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        owner.login('designer@example.test',log)
        made=owner.call('create_project',{'name':'Question activity'},expected=201);pid,iid=made['project_id'],made['iteration_id']
        answer=owner.call('budget_chat',{'iteration':iid,'question':'What is the total budget?','slide':'budget'})
        event=answer['activity_event'];check(event['question_answer']['answer']==answer['answer'] and event['question_answer']['slide']=='budget','The exact returned answer and originating slide are recorded')
        project=owner.call('project',query='&id='+pid);stored=next(e for e in project['events'] if e['id']==event['id'])
        check(stored['question_answer']['question']=='What is the total budget?' and stored['iteration_id']==iid,'Project activity retains the question and exact iteration after reload')
        feed=owner.call('activity_feed');check(any(e.get('question_answer',{}).get('answer')==answer['answer'] for e in feed['items']),'Studio activity contains the full question and answer')
        owner.call('budget_chat',{'iteration':iid,'question':'Question on another slide','slide':'intro'})
        check(owner.call('activity_feed')['items'][0]['question_answer']['slide']=='intro','Origin slide is preserved instead of always linking to the budget')
        owner.call('budget_chat',{'iteration':iid,'question':'Invalid slide','slide':'foreign-slide'},expected=404)
        owner.call('budget_chat',{'iteration':iid,'question':'Missing CSRF','slide':'budget'},csrf=False,expected=403)
        shared=owner.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0];client=Client(base);client.bearer=shared['url'].split('/#/view/')[1]
        client_answer=client.call('budget_chat',{'iteration':iid,'question':'What is still unspecified?','slide':'summary'})
        client_event=client_answer['activity_event'];check(client_event['actor']=='client@example.test' and client_event['question_answer']['slide']=='summary','Client questions are logged with their author and original slide')
        check('events' not in client.call('deck'),'Clients do not receive the studio activity history')
        client.call('activity_feed',expected=401)
        owner.call('revoke_share',{'id':shared['id']});client.call('budget_chat',{'iteration':iid,'question':'Revoked link','slide':'budget'},expected=403)
        outsider=Client(base);outsider.login('outsider@example.test',log);check(not outsider.call('activity_feed')['items'],'Questions stay within authorized studio/project activity')
        code="require 'app/ingest.php'; $i=one('SELECT * FROM iterations WHERE id=?',[$argv[1]]); try {answer_with_activity($i,'designer@example.test','budget','Failure example',function(){throw new RuntimeException('internal provider detail');});}catch(Throwable $e){}"
        subprocess.run([PHP,'-r',code,iid],cwd=ROOT,env=env,check=True)
        failure=owner.call('activity_feed')['items'][0]['question_answer'];check(failure['status']=='failed' and failure['question']=='Failure example' and 'internal provider detail' not in failure['answer'],'Failed answers preserve the question without exposing internal provider details')
        with sqlite3.connect(tmp/'test.sqlite') as db:
            db.execute('PRAGMA foreign_keys=ON');db.execute('DELETE FROM events WHERE id=?',(event['id'],));check(db.execute('SELECT COUNT(*) FROM event_questions WHERE event_id=?',(event['id'],)).fetchone()[0]==0,'Question records are cleaned up with their activity events')
        print('All question activity checks passed.',flush=True)
    finally:
        server.terminate();server.wait(timeout=5);output.close()
