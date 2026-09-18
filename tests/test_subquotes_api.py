"""Subquote API/upload integration checks. Temporary database; injected matching, no AI/email."""
from pathlib import Path
import http.cookiejar,urllib.request,urllib.error,json,os,tempfile,subprocess,time,sqlite3
ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value: raise AssertionError(message)
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

with tempfile.TemporaryDirectory(prefix='studiodeck-subquote-api-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8194';log=tmp/'mail.log';database=tmp/'test.sqlite'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(database),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'test-not-used','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8194','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    def sql(query,args=()):
        with sqlite3.connect(database) as db: return db.execute(query,args).fetchall()
    def worker():subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env={**env,'OPENAI_API_KEY':''},check=True,capture_output=True)
    def php(code):
        result=subprocess.run([PHP,'-r','require '+json.dumps(str(ROOT/'app/ai.php'))+';'+code],env=env,check=True,text=True,capture_output=True)
        return json.loads(result.stdout)
    try:
        owner=Client(base)
        for _ in range(60):
            try:owner.call('session');break
            except urllib.error.URLError:time.sleep(.1)
        owner.login('designer@example.test',log)
        made=owner.call('create_project',{'name':'Quote links','visibility':'public'},expected=201);pid,iid=made['project_id'],made['iteration_id']
        def deck(iteration=None):return owner.call('project',query='&id='+pid+'&iteration='+(iteration or iid))
        parent_text='Main contract includes Greenworks garden quote GW-1234.';child_text='Greenworks garden quote GW-1234 for planting.'
        def upload(name,body):
            owner.call('upload',{'iteration':iid},files=[(name,'text/csv',body.encode())],expected=201);worker()
        upload('main.csv','key,label,vendor,amount,note\nmain,Main contract,BuildCo,50000,'+parent_text+'\n')
        upload('garden.csv','key,label,vendor,amount,note\ngarden,Garden,Greenworks,8000,'+child_text+'\nwater,Irrigation,WaterCo,2000,WaterCo irrigation for the garden.\n')
        data=deck();bykey={r['source_key']:r for r in data['budget']}
        check(len(bykey)==3 and all(j['status']=='done' for j in data['jobs']),'Worker imports quotes successfully when matching is unavailable')
        check(any(f['metadata'].get('subquote_matching',{}).get('status')=='unavailable' for f in data['files']),'Cross-file check runs automatically after the later upload')
        links=[{'child_id':bykey['garden']['id'],'parent_id':bykey['main']['id'],'confidence':'high','inclusion':'included','child_excerpt':child_text,'parent_excerpt':parent_text},{'child_id':bykey['water']['id'],'parent_id':bykey['main']['id'],'confidence':'medium','inclusion':'unknown','child_excerpt':'WaterCo irrigation for the garden.','parent_excerpt':parent_text}]
        def match():return php('echo json_encode(reconcile_subquotes('+json.dumps(iid)+',fn()=>json_decode('+json.dumps(json.dumps({'links':links}))+',true)));')
        result=match();check(result['linked']==1 and result['suggested']==1,'Cross-file matching creates an automatic link and an uncertain proposal')
        data=deck();sid=data['subquote_suggestions'][0]['id'];water=bykey['water']['id'];garden=bykey['garden']['id']
        check(data['total_cents']==5200000,'Automatic included link updates persisted project total')
        if os.environ.get('STUDIODECK_TEST_EXPORT'):Path(os.environ['STUDIODECK_TEST_EXPORT']).write_text(json.dumps({'deck':data,'session':owner.call('session')}))
        owner.call('review_subquote',{'iteration':iid,'id':sid,'decision':'included'},csrf=False,expected=403)
        owner.call('save_studio_user',{'name':'Viewer','email':'viewer@example.test'})
        viewer=Client(base);viewer.login('viewer@example.test',log)
        viewer.call('review_subquote',{'iteration':iid,'id':sid,'decision':'included'},expected=403)
        viewer.call('match_subquotes',{'iteration':iid},expected=403)
        other=owner.call('create_project',{'name':'Other project'},expected=201)
        owner.call('review_subquote',{'iteration':other['iteration_id'],'id':sid,'decision':'included'},expected=409)
        owner.call('review_subquote',{'iteration':iid,'id':sid,'decision':'included'})
        check(deck()['total_cents']==5000000 and not deck()['subquote_suggestions'],'Accepting a suggestion links the cost and updates the total')
        owner.call('review_subquote',{'iteration':iid,'id':sid,'decision':'additional'},expected=409)
        owner.call('unlink_subquote',{'iteration':iid,'id':garden})
        r=next(r for r in deck()['budget'] if r['id']==garden)
        check(r['relationship_locked']==1 and r['parent_id'] is None and deck()['total_cents']==5800000,'Undoing an automatic link restores the amount and locks the decision')
        check(match()['linked']==0,'Later matching cannot recreate an undone link')
        owner.call('save_budget',{'iteration':iid,'id':water,'label':'Irrigation','vendor':'WaterCo','price_type':'fixed','amount':'2000','parent_id':'','included':False,'note':'Keep separate'})
        check(next(r for r in deck()['budget'] if r['id']==water)['relationship_locked']==1,'Manual budget edits protect the chosen relationship')
        owner.call('match_subquotes',{'iteration':iid},expected=202)
        owner.call('match_subquotes',{'iteration':iid},expected=409)
        worker();check(deck()['jobs'][0]['status']=='done' or all(j['status']=='done' for j in deck()['jobs']),'Explicit recheck runs without reimporting sources')
        owner.call('lock_iteration',{'iteration':iid})
        shared=owner.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.bearer=shared['url'].split('/#/view/')[1]
        check('subquote_suggestions' not in client.call('deck'),'Review suggestions are not shown to clients')
        client.call('review_subquote',{'iteration':iid,'id':sid,'decision':'included'},expected=401)
        owner.call('review_subquote',{'iteration':iid,'id':sid,'decision':'included'},expected=409)
        owner.call('match_subquotes',{'iteration':iid},expected=409)
        new=owner.call('new_iteration',{'iteration':iid},expected=201)['id'];newer=deck(new)
        check(any(r['source_key']=='garden' and r['relationship_locked']==1 for r in newer['budget']),'New iteration carries forward manual relationship locks')
        check(sql('SELECT COUNT(*) FROM budget_link_suggestions WHERE iteration_id=?',(new,))[0][0]==1,'Reviewed suggestions are remapped into new iterations')
        confirm=owner.call('prepare_delete_project',{'project_id':pid})
        owner.call('delete_project',{'project_id':pid,'confirmation':confirm['confirmation'],'name':'Quote links','acknowledged':True})
        check(not sql('SELECT * FROM budget_link_suggestions') and not sql('PRAGMA foreign_key_check'),'Project deletion cleans up suggestions without dangling references')
    finally:server.terminate();server.wait(timeout=10);output.close()
