"""Studio starting-pack integration checks.
Run: PHP_BIN=php python3 tests/test_starting_pack.py
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
        if self.bearer: headers['Authorization']='Client '+self.bearer
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

with tempfile.TemporaryDirectory(prefix='studiodeck-pack-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8097';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8097','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('admin@example.test',log)
        studio=admin.call('session')['studio']['id']
        check(admin.call('studio_starting_pack')=={'items':[],'can_manage':True},'Studio starts with an empty admin-managed pack')
        template={'kind':'slide','slide_type':'intro','title':'Welcome to {{project_name}}','body':'By {{studio_name}}. {{location}}','default_enabled':True}
        admin.call('save_pack_item',template,csrf=False,expected=403)
        intro=admin.call('save_pack_item',template)
        process=admin.call('save_pack_item',{'kind':'slide','slide_type':'text','title':'Our process','body':'Discover, design, refine.','default_enabled':True,'position':10})
        contact=admin.call('save_pack_item',{'kind':'slide','slide_type':'contacts','title':'Contact {{designer_name}}','body':'{{designer_email}}','default_enabled':False,'position':90})
        import fitz
        def pdf(text):
            d=fitz.open();p=d.new_page();p.insert_text((50,50),text);b=d.tobytes();d.close();return b
        terms1=pdf('Studio terms: Two revision rounds are included. Painting is excluded.')
        terms=admin.call('save_pack_item',{'kind':'document','title':'Studio terms','default_enabled':'1'},files=[('studio-terms.pdf','application/pdf',terms1)],file_field='file')
        from test_extraction import png
        photo=admin.call('save_pack_item',{'kind':'slide','slide_type':'fullphoto','title':'Our studio','default_enabled':'1'},files=[('studio.png','image/png',png('#a09588'))],file_field='file')
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'})
        member=Client(base);member.login('member@example.test',log)
        check(not member.call('studio_starting_pack')['can_manage'],'Members can view but cannot manage the pack')
        member.call('save_pack_item',template,expected=403)
        member.call('archive_pack_item',{'id':intro['id']},expected=403)
        p=admin.call('create_project',{'name':'Villa Amber','visibility':'public'},expected=201);pid=p['project_id'];iid=p['iteration_id']
        def deck(iteration=iid):return admin.call('project',query='&id='+pid+'&iteration='+iteration)
        def review(iteration=iid):return admin.call('project_starting_pack',query='&iteration='+iteration)
        def apply(changes,iteration=iid,snapshot=None,expected=200):
            return admin.call('apply_project_pack',{'iteration':iteration,'snapshot':snapshot or review(iteration)['snapshot'],'changes':changes},expected=expected)
        def change(item,operation='apply'):return {'item_id':item['id'],'operation':operation,'version_id':item['version_id']}
        d=deck();check(len(d['slides'])==2 and len(d['files'])==2,'Default slides, independent image and reference PDF are copied')
        check(d['slide_content'][0]['title']=='Welcome to Villa Amber' and '{{location}}' in d['slide_content'][0]['description'],'Available tokens are filled and missing details stay editable')
        check(len(review()['applied'])==4,'Optional contact template is omitted')
        member.call('apply_project_pack',{'iteration':iid,'snapshot':review()['snapshot'],'changes':[]},expected=403)
        apply([change(terms,'remove')],expected=409)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        d=deck();reference=next(f for f in d['files'] if f['category']=='legal');vid1=reference['id']
        check(len(reference['pages'])==1 and len(d['slides'])==2 and reference['studio_reference']['revision']==1,'References extract text without generating slides and show their attached revision')
        check(reference['metadata']['studio_reference'],'Reference provenance survives processing')
        check(admin.call('file',query='&iteration='+iid+'&id='+vid1,raw=True)==terms1,'Project keeps an exact byte copy of the PDF')
        answer=admin.call('budget_chat',{'iteration':iid,'question':'How many revision rounds are included?'})
        check(answer['citations'][0]['version_id']==vid1 and 'Two revision' in answer['answer'],'Document answers use the attached PDF with page citations')
        empty=admin.call('create_project',{'name':'Blank project','starting_pack':[]},expected=201)
        check(not admin.call('project',query='&id='+empty['project_id'])['files'],'Explicit opt-out creates a blank project')
        # Add slide only offers missing slide templates, never documents or existing copies.
        def available(iteration):return admin.call('project_starting_pack',query='&iteration='+iteration)
        def add_slide(item,iteration=empty['iteration_id'],expected=200,snapshot=None):
            return admin.call('add_project_pack_slide',{'iteration':iteration,'version_id':item['version_id'],'snapshot':snapshot or available(iteration)['snapshot']},expected=expected)
        check([s['id'] for s in review()['available_slides']]==[contact['id']],'Only the missing contact slide is offered on a project with the default pack')
        check({s['id'] for s in available(empty['iteration_id'])['available_slides']}=={intro['id'],process['id'],contact['id'],photo['id']},'Blank projects can add studio slides but not reference PDFs')
        add_slide(process)
        add_slide(process,expected=409)
        add_slide(terms,expected=409)
        admin.call('save_slide',{'iteration':empty['iteration_id'],'slide_id':'intro','title':'Existing welcome','description':'Keep my words'})
        add_slide(intro,expected=409)
        check(intro['id'] not in [s['id'] for s in available(empty['iteration_id'])['available_slides']],'Custom built-in text is not offered for replacement')
        stale_add=available(empty['iteration_id'])['snapshot']
        admin.call('save_slide',{'iteration':empty['iteration_id'],'slide_id':'contacts','title':'Existing contacts','description':'My team'})
        add_slide(contact,snapshot=stale_add,expected=409)
        add_slide(photo)
        blank=admin.call('project',query='&id='+empty['project_id'])
        check(len(blank['slides'])==2 and len(blank['files'])==1 and next(c for c in blank['slide_content'] if c['slide_id']=='intro')['title']=='Existing welcome','Adding missing text and image slides preserves project content')
        member.call('add_project_pack_slide',{'iteration':iid,'version_id':contact['version_id'],'snapshot':review()['snapshot']},expected=403)
        admin.call('add_project_pack_slide',{'iteration':iid,'version_id':contact['version_id'],'snapshot':review()['snapshot']},csrf=False,expected=403)
        chosen=member.call('create_project',{'name':'Member project','starting_pack':[contact['version_id']]},expected=201)
        check(member.call('project',query='&id='+chosen['project_id'])['slide_content'][0]['description']=='member@example.test','Members can choose templates and receive their own personalized copies')
        foreign=Client(base);foreign.login('outsider@example.test',log)
        foreign.call('pack_file',query='&version='+terms['version_id'],expected=404)
        foreign.call('create_project',{'name':'Cross studio','starting_pack':[intro['version_id']]},expected=404)
        foreign.call('add_project_pack_slide',{'iteration':iid,'version_id':contact['version_id'],'snapshot':review()['snapshot']},expected=404)
        check(not foreign.call('projects')['projects'],'Cross-studio selection rolls back project creation')
        admin.call('save_slide',{'iteration':iid,'slide_id':'intro','title':'My bespoke welcome','description':'Project-specific copy'})
        stale=review()['snapshot']
        intro2=admin.call('save_pack_item',{**template,'id':intro['id'],'base_version':intro['version_id'],'title':'A new welcome for {{project_name}}'})
        terms2=admin.call('save_pack_item',{'id':terms['id'],'base_version':terms['version_id'],'title':'Studio terms','default_enabled':'1'},files=[('studio-terms-v2.pdf','application/pdf',pdf('Studio terms: Five revision rounds are included. Painting is excluded.'))],file_field='file')
        admin.call('save_pack_item',{**template,'id':intro['id'],'base_version':intro['version_id']},expected=409)
        apply([change(intro2)],snapshot=stale,expected=409)
        check(deck()['slide_content'][0]['title']=='My bespoke welcome' and next(f for f in deck()['files'] if f['category']=='legal')['id']==vid1,'Library edits never silently change an existing draft')
        add_slide(intro2,iteration=iid,expected=409)
        check(intro['id'] not in [s['id'] for s in review()['available_slides']],'New studio versions do not make existing project slides available again')
        check(next(a for a in review()['applied'] if a['item_id']==intro['id'])['modified'],'Review flags locally edited content')
        shared=admin.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.login('client@example.test',log);client.bearer=shared['id']
        admin.call('lock_iteration',{'iteration':iid})
        apply([change(intro2)],expected=409)
        add_slide(contact,iteration=iid,expected=409)
        client.call('studio_starting_pack',expected=403)
        draft=admin.call('new_iteration',{'iteration':iid,'title':'Design development'},expected=201)['id']
        check(len(review(draft)['applied'])==4,'Starting-pack provenance carries to a new iteration')
        apply([change(intro2),change(terms2)],draft)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        updated=deck(draft);ref2=next(f for f in updated['files'] if f['category']=='legal')
        check(updated['slide_content'][0]['title']=='A new welcome for Villa Amber' and ref2['studio_reference']['revision']==2 and ref2['parent_id']==vid1,'Explicit review applies new content and preserves PDF version history')
        clientdeck=client.call('deck')
        check(clientdeck['slide_content'][0]['title']=='My bespoke welcome' and next(f for f in clientdeck['files'] if f['category']=='legal')['id']==vid1,'Shared iteration remains pinned to its original content and PDF')
        answer=client.call('budget_chat',{'iteration':iid,'question':'How many revision rounds?'})
        check('Two revision' in answer['answer'] and 'Five revision' not in answer['answer'],'Client answers never use a newer studio library version')
        # Both studio terms and project-specific source text must be available to explain conflicts.
        with sqlite3.connect(tmp/'test.sqlite') as db:
            source=ref2['id'];meta=json.loads(db.execute('SELECT metadata FROM file_versions WHERE id=?',(source,)).fetchone()[0])
            # Existing copied image is used only as a distinct, attached source fixture.
            proposal=next(f['id'] for f in updated['files'] if f['mime']=='image/png')
            db.execute('INSERT INTO document_pages(version_id,number,text,metadata) VALUES(?,1,?,?)',(proposal,'Project proposal: Three revision rounds are included.','{}'))
            db.execute("UPDATE iteration_files SET category='presentation' WHERE iteration_id=? AND version_id=?",(draft,proposal))
        code="require 'app/ai.php'; echo json_encode(legal_evidence('"+draft+"','revision rounds'));"
        evidence=json.loads(subprocess.check_output([PHP,'-r',code],cwd=ROOT,env=env))
        check({c['source_kind'] for c in evidence['excerpts']}=={'studio_reference','presentation'},'Retrieval includes project-specific text alongside studio defaults')
        code="require 'app/ai.php'; $e=legal_evidence('"+draft+"','revision rounds'); budget_answer('revision rounds',[],$e,function($prompt,$c){if(!str_contains($prompt,'never assume which takes precedence'))throw new Exception('Missing conflict policy'); return ['answer'=>'Ask the designer to clarify','citations'=>[]];});"
        subprocess.run([PHP,'-r',code],cwd=ROOT,env=env,check=True)
        branch=admin.call('new_iteration',{'iteration':iid,'title':'Alternative draft'},expected=201)['id']
        apply([change(terms2)],branch)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        branchref=next(f for f in deck(branch)['files'] if f['category']=='legal')
        check(branchref['parent_id']==vid1 and ref2['id'] not in [h['id'] for h in branchref['history']],'Branch updates inherit only their own attached document history')
        process2=admin.call('save_pack_item',{'id':process['id'],'base_version':process['version_id'],'title':'A refined process','body':'Discover, discuss, design.','default_enabled':True})
        apply([change(process2)],draft)
        check(any(s['title']=='A refined process' for s in deck(draft)['slides']),'Text slide updates replace the existing template copy')
        apply([change(terms2,'remove'),change(photo,'remove')],draft)
        check(not any(f['category']=='legal' for f in deck(draft)['files']),'Removing a reference excludes it from the draft document set')
        apply([change(photo)],draft)
        check(not next(a for a in review(draft)['applied'] if a['item_id']==photo['id'])['excluded'],'Removed image templates can be reapplied without losing originals')
        admin.call('archive_pack_item',{'id':process['id']})
        check(any(a['archived'] for a in review(draft)['applied']),'Archiving a library template leaves existing project copies intact')
        check(process['id'] not in [s['id'] for s in member.call('project_starting_pack',query='&iteration='+chosen['iteration_id'])['available_slides']],'Archived studio slides are not offered by Add slide')
        # Exact version content is immutable, even after deleting a project that used it.
        confirmation=admin.call('prepare_delete_project',{'project_id':pid})['confirmation']
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'Villa Amber','acknowledged':True})
        check(admin.call('pack_file',query='&version='+terms['version_id'],raw=True)==terms1,'Deleting a project preserves studio library versions')
        with sqlite3.connect(tmp/'test.sqlite') as db:check(not db.execute('PRAGMA foreign_key_check').fetchall(),'Starting-pack lifecycle preserves database integrity')
    finally:
        server.terminate();server.wait();output.close()
