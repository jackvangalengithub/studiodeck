"""Integration checks for custom groups, legal extraction and permanent deletion.
Run: PHP_BIN=php python3 tests/test_workflows.py
Uses a temporary database and log-only email. No real messages or AI calls.
"""
from pathlib import Path
import http.cookiejar, urllib.request, urllib.error, json, os, tempfile, subprocess, time, zipfile, io, sqlite3

ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value: raise AssertionError(message)
    print('PASS',message)
class Client:
    def __init__(self,base):
        self.base=base; self.csrf=''; self.bearer=''; self.studio_context=None
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False,file_field='files[]'):
        headers={}
        if self.studio_context:headers['X-Studio-ID']=self.studio_context
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
        if files:
            boundary='studiodeck-test-boundary';parts=[]
            for k,v in data.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for name,mime,blob in files:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+blob+b'\r\n')
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

with tempfile.TemporaryDirectory(prefix='studiodeck-legal-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8096';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8096','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('designer@example.test',log)
        p=admin.call('create_project',{'name':'Keep / Delete carefully','visibility':'public'},expected=201);pid=p['project_id'];iid=p['iteration_id']
        # Every PDF page, including beyond the visual import cap and aggregate text limit.
        import fitz
        doc=fitz.open()
        for n in range(125):
            page=doc.new_page()
            text=('General clause. Maintain access to premises during working hours. '*28) if n<124 else 'Painting of all walls is included. Removal of garbage is excluded unless separately agreed in writing.'
            page.insert_textbox(fitz.Rect(36,36,550,810),text,fontsize=10)
        pdf=doc.tobytes();doc.close()
        vid=admin.call('upload',{'iteration':iid,'category':'legal'},files=[('specification.pdf','application/pdf',pdf)],expected=201)['ids'][0]
        admin.call('category',{'iteration':iid,'asset_id':admin.call('project',query='&id='+pid)['files'][0]['asset_id'],'category':'legal'},expected=409)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        deck=admin.call('project',query='&id='+pid)
        check(len(deck['files'][0]['pages'])==125 and not deck['slides'],'Legal PDFs extract all 125 pages without creating visual slides')
        with sqlite3.connect(tmp/'test.sqlite') as db:
            text=db.execute('SELECT extracted_text FROM file_versions WHERE id=?',(vid,)).fetchone()[0]
        check(len(text)>150000 and 'Removal of garbage' in text,'Complete legal text is retained beyond the former aggregate text limit')
        answer=admin.call('budget_chat',{'iteration':iid,'question':'Does it include paint and removal of garbage?'})
        check(any(c['page']==125 for c in answer['citations']) and 'excluded' in answer['answer'],'Scope questions retrieve late-page legal clauses and page citations')
        # Model output cannot cite a different document or arbitrary page.
        code="require 'app/ai.php'; $e=legal_evidence('"+iid+"','paint garbage'); $r=budget_answer('paint',[],$e,fn($s,$c)=>['answer'=>'Source summary','sources'=>['foreign'],'citations'=>['foreign:1','"+vid+":125']]); echo json_encode($r);"
        result=json.loads(subprocess.check_output([PHP,'-r',code],env=env,cwd=ROOT))
        check(result['sources']==[] and result['citations']==[{'version_id':vid,'name':'specification.pdf','page':125}],'AI citations are restricted to retrieved source pages')
        other=admin.call('create_project',{'name':'Another project'},expected=201)
        clean=admin.call('budget_chat',{'iteration':other['iteration_id'],'question':'paint garbage'})
        check(not clean.get('citations'),'Legal retrieval cannot leak across projects')
        print('PASS Complete legal text extraction, scoped retrieval and source citations')
    finally:
        server.terminate();server.wait(timeout=10);output.close()
