"""Budget range/option integration checks. Temporary database; no AI or real email."""
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

with tempfile.TemporaryDirectory(prefix='studiodeck-budget-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8095';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-d','display_errors=0','-S','127.0.0.1:8095','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        owner=Client(base)
        for _ in range(60):
            try:owner.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        owner.login('designer@example.test',log)
        made=owner.call('create_project',{'name':'Interactive budget'},expected=201);pid,iid=made['project_id'],made['iteration_id']
        def deck():return owner.call('project',query='&id='+pid+'&iteration='+iid)
        def save(label,**extra):
            owner.call('save_budget',{'iteration':iid,'label':label,'amount':'','kind':'estimate',**extra})
            return next(x for x in deck()['budget'] if x['label']==label)['id']
        fixed=save('Fixed quote',price_type='fixed',amount='100')
        ranged=save('Garden works',price_type='range',min_amount='1.000',max_amount='2.000')
        option=save('Optional lighting',price_type='fixed',amount='250',is_optional=True)
        unknown=save('Grondverzet en opruimwerkzaamheden',price_type='unknown')
        child=save('Included subquote',price_type='fixed',amount='40',parent_id=fixed,included=True)
        check(deck()['total_cents']==110000,'Ranges start at Budget; options and unspecified rows are excluded; subquotes counted once')
        check(next(x for x in deck()['budget'] if x['id']==unknown)['label']=='Grondverzet en opruimwerkzaamheden','Unspecified labels survive the presentation payload')
        for fields in [{'min_amount':'2000','max_amount':'1000'},{'min_amount':'-1','max_amount':'1000'},{'min_amount':'','max_amount':'1000'}]:owner.call('save_budget',{'iteration':iid,'label':'Invalid range','price_type':'range',**fields},expected=400)
        check(True,'Missing, negative or reversed range endpoints are rejected')
        owner.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':50})
        owner.call('budget_choice',{'iteration':iid,'id':option,'selected':True})
        check(deck()['total_cents']==185000,'Saved slider and optional choices change the total and survive reload')
        owner.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':101},expected=400)
        owner.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':50.5},expected=400)
        owner.call('budget_choice',{'iteration':iid,'id':fixed,'selected':True},expected=400)
        owner.call('budget_choice',{'iteration':iid,'id':option,'selected':'false'},expected=400)
        owner.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':25},csrf=False,expected=403)
        check(True,'Budget preferences validate types, ranges, optional status and CSRF')
        outsider=Client(base);outsider.login('outsider@example.test',log)
        outsider.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':20},expected=404)
        owner.call('save_studio_user',{'email':'viewer@example.test','name':'Viewer'})
        owner.call('project_settings',{'project_id':pid,'visibility':'public','tags':[],'deadline':''})
        viewer=Client(base);viewer.login('viewer@example.test',log)
        check(viewer.call('project',query='&id='+pid)['can_edit'] is False,'Public studio viewers can inspect the saved budget')
        viewer.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':25},expected=403)
        check(True,'Public studio viewing does not permit changing budget choices')
        shared=owner.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.bearer=shared['url'].split('/#/view/')[1]
        client.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':100})
        check(deck()['total_cents']==235000,'Clients can save budget preferences on shared presentations')
        check('choice_updated_by' not in client.call('deck')['budget'][0],'Client payload does not expose other clients’ email addresses')
        owner.call('lock_iteration',{'iteration':iid})
        owner.call('save_budget',{'iteration':iid,'id':fixed,'label':'Changed quote','amount':'999'},expected=409)
        check(next(x for x in deck()['budget'] if x['id']==ranged)['min_amount_cents']==100000,'Interactive preferences preserve immutable source range endpoints')
        check(any(e['type']=='budget_choice_updated' and e['actor']=='client@example.test' for e in deck()['events']),'Designers can see who changed budget choices in activity')
        next_iid=owner.call('new_iteration',{'iteration':iid,'title':'Next budget'},expected=201)['id']
        next_deck=owner.call('project',query='&id='+pid+'&iteration='+next_iid)
        check(next_deck['total_cents']==235000,'New iterations carry saved choices forward')
        new_range=next(x for x in next_deck['budget'] if x['label']=='Garden works')['id']
        owner.call('budget_choice',{'iteration':next_iid,'id':new_range,'range_percent':0})
        check(client.call('deck')['total_cents']==235000,'Changing a new iteration does not change earlier shared choices')
        client.call('budget_choice',{'iteration':next_iid,'id':new_range,'range_percent':10},expected=403)
        owner.call('revoke_share',{'id':shared['id']});client.call('budget_choice',{'iteration':iid,'id':ranged,'range_percent':10},expected=403)
        check(True,'Cross-iteration and revoked client links cannot alter choices')
        # Exercise spreadsheet ingestion and choice preservation on source replacement.
        table_project=owner.call('create_project',{'name':'Budget source ranges'},expected=201);tid=table_project['iteration_id']
        def upload(csv):
            owner.call('upload',{'iteration':tid},files=[('budget.csv','text/csv',csv.encode())],expected=201)
            subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
            return owner.call('project',query='&id='+table_project['project_id'])
        csv='label,amount,min_amount,max_amount,optional\nRange,,1000,2000,no\nFixed,200,,,no\nOption,50,,,yes\nUnknown,,,,no\n'
        data=upload(csv);check(data['total_cents']==120000 and len(data['budget'])==4,'CSV imports fixed prices, ranges, options and unspecified labels')
        rid=next(x for x in data['budget'] if x['label']=='Range')['id'];owner.call('budget_choice',{'iteration':tid,'id':rid,'range_percent':80})
        data=upload(csv.replace('Fixed,200','Fixed,300'));check(data['total_cents']==210000,'Replacing a source preserves choices for matching budget labels')
        # Recover explicit old source notes without an AI call.
        code="require 'app/ingest.php'; echo json_encode(budget_evidence_properties(['amount_cents'=>null,'note'=>'Page 1. Indicative range €1,000–€2,000; no single amount provided.']));"
        recovered=json.loads(subprocess.check_output([PHP,'-r',code],cwd=ROOT,env=env,text=True));check(recovered['min_amount_cents']==100000 and recovered['max_amount_cents']==200000,'Existing extracted ranges can be repaired from explicit notes')
        print('All budget checks passed. No real email or AI calls.',flush=True)
    finally:
        server.terminate();server.wait(timeout=5);output.close()
