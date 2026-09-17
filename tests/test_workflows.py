"""Integration checks for authorization, immutable shares, imports and budget accounting.
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

with tempfile.TemporaryDirectory(prefix='studiodeck-test-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8089';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w')
    server=subprocess.Popen([PHP,'-d','upload_max_filesize=30M','-d','post_max_size=128M','-S','127.0.0.1:8089','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        owner=Client(base)
        for _ in range(60):
            try:owner.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        tok=owner.login('designer@example.test',log)
        owner.call('consume_login',{'token':tok},expected=403)
        check(True,'Magic links work once; replay is rejected')
        cookie=list(owner.cookies)[0]
        check(13.99*86400 < cookie.expires-time.time() <14.01*86400,'Designer session has a 14-day expiry')
        owner.call('create_project',{'name':'Missing CSRF'},csrf=False,expected=403)
        check(True,'Designer writes require the session CSRF token')
        owner.call('studio_theme',{'theme':{'palette':'clay','style':'classic'}},csrf=False,expected=403)
        owner.call('studio_theme',{'theme':{'palette':'invalid','style':'classic'}},expected=400)
        owner.call('studio_theme',{'theme':{'palette':'clay','style':'classic'}})
        check(owner.call('session')['studio_theme']=={'palette':'clay','style':'classic','font':'serif'},'Studio appearance persists independently of any project')
        made=owner.call('create_project',{'name':'Test family project','emails':['client@example.test']},expected=201)
        pid,iid=made['project_id'],made['iteration_id']
        for name,mime,blob in [('budget.csv','text/csv',(ROOT/'public/assets/example-budget.csv').read_bytes()),('living.webp','image/webp',(ROOT/'public/assets/interior.webp').read_bytes()),('floorplan.pdf','application/pdf',(ROOT/'public/assets/concept-plan.pdf').read_bytes())]:
            owner.call('upload',{'iteration':iid},files=[(name,mime,blob)],expected=201)
        owner.call('upload',{'iteration':iid},files=[('bad.png','image/png',b'<?php echo "bad";')],expected=400)
        check(True,'Uploads validate file contents, not just the extension')
        owner.call('share',{'iteration':iid,'emails':['client@example.test']},expected=409)
        check(True,'An iteration cannot be shared while files are processing')
        for _ in range(3):subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        d=owner.call('project',query='&id='+pid)
        check(all(j['status']=='done' for j in d['jobs']),'Background worker processes images, PDF and CSV')
        check(d['total_cents']==12845000,'Included vendor subquotes are not double counted')
        check(sum(x['amount_cents'] is None for x in d['budget'])==2,'Unspecified costs remain null and outside the known total')
        construction=next(x for x in d['budget'] if x['label']=='Construction & installation')
        sub=next(x for x in d['budget'] if x['label']=='Electrical installation')
        owner.call('save_budget',{'iteration':iid,'id':construction['id'],'label':'Bad hierarchy','parent_id':sub['id'],'amount':'54000'},expected=400)
        check(True,'Circular nested quote relationships are rejected')
        share=owner.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        check(not share['sent'],'Log mode never reports that client email was sent')
        client=Client(base);client.bearer=share['url'].split('/#/view/')[1]
        shared=client.call('deck')
        check('events' not in shared and 'shares' not in shared,'Client payload excludes studio activity and other client links')
        check('studio_theme' not in shared and shared['project']['theme']!={'palette':'clay','style':'classic'},'Client presentations do not receive studio appearance settings')
        owner.call('save_budget',{'iteration':iid,'label':'Changed after share','amount':'123'},expected=409)
        check(True,'Shared iterations reject edits')
        second=owner.call('new_iteration',{'iteration':iid,'title':'Second concept'},expected=201)['id']
        carried=owner.call('project',query='&id='+pid+'&iteration='+second)
        check([f['id'] for f in d['files']]==[f['id'] for f in carried['files']],'A new iteration carries all unchanged file versions forward')
        old=next(f for f in carried['files'] if f['category']=='budget')
        new_csv=(ROOT/'public/assets/example-budget.csv').read_bytes().replace(b'Oak,32000',b'Oak,33000')
        owner.call('upload',{'iteration':second,'replace_asset':old['asset_id']},files=[('updated-budget.csv','text/csv',new_csv)],expected=201)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        updated=owner.call('project',query='&id='+pid+'&iteration='+second)
        new=next(f for f in updated['files'] if f['category']=='budget')
        check(len(new['history'])==2 and new['history'][1]['id']==old['id'],'Replacements preserve the original file and its history')
        check(updated['total_cents']==12945000,'A replacement quote replaces previous imported costs without duplication')
        check(client.call('deck')['total_cents']==12845000,'An existing client link keeps its original budget snapshot')
        client.call('file',query='&id='+new['id'],expected=404)
        check(True,'A client cannot download future file versions')
        check(client.call('file',query='&id='+old['id'],raw=True)==(ROOT/'public/assets/example-budget.csv').read_bytes(),'Original bytes remain downloadable from the shared iteration')
        client.call('comment',{'iteration':iid,'slide':'budget','body':'Could we clarify the curtains? <script>demo</script>'})
        check(len(owner.call('project',query='&id='+pid+'&iteration='+iid)['comments'])==1,'Client feedback is stored against the correct iteration')
        stranger=Client(base);stranger.login('unrelated@example.test',log)
        stranger.call('project',query='&id='+pid,expected=404)
        stranger.call('file',query='&iteration='+iid+'&id='+old['id'],expected=404)
        check(True,'A different designer cannot access another studio’s project or files')
        check(stranger.call('session')['studio_theme']==[],'Studio preferences are isolated between designers')
        owner.call('revoke_share',{'id':share['id']})
        client.call('deck',expected=403)
        check(True,'Revocation immediately disables a client link')
        expired=owner.call('share',{'iteration':iid,'emails':['expired@example.test']})['links'][0]
        con=sqlite3.connect(tmp/'test.sqlite');con.execute('UPDATE shares SET expires_at=1 WHERE id=?',(expired['id'],));con.commit();con.close()
        client.bearer=expired['url'].split('/#/view/')[1];client.call('deck',expected=403)
        check(True,'Expired client links are rejected')
        # Exercise the native Office XML parsers without third-party spreadsheet libraries.
        xlsx=io.BytesIO()
        with zipfile.ZipFile(xlsx,'w') as z:
            z.writestr('xl/workbook.xml','<workbook/>')
            z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>label</t></is></c><c r="B1" t="inlineStr"><is><t>amount</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Bench</t></is></c><c r="B2"><v>1234.56</v></c></row></sheetData></worksheet>')
        pptx=io.BytesIO()
        with zipfile.ZipFile(pptx,'w') as z:
            z.writestr('ppt/presentation.xml','<presentation/>')
            z.writestr('ppt/slides/slide1.xml','<slide><t>Natural oak and linen moodboard</t></slide>')
        owner.call('upload',{'iteration':second},files=[('bench.xlsx','application/zip',xlsx.getvalue()),('mood.pptx','application/zip',pptx.getvalue())],expected=201)
        for _ in range(2):subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        office=owner.call('project',query='&id='+pid+'&iteration='+second)
        check(any(x['label']=='Bench' and x['amount_cents']==123456 for x in office['budget']),'Excel cells import into exact integer-cent budget amounts')
        check(any(x['name']=='mood.pptx' and x['category']=='moodboard' for x in office['files']),'PowerPoint text informs automatic categorization')
        from test_extraction import make_pdf
        fixture=tmp/'material-study.pdf';make_pdf(fixture,mixed=True)
        made=owner.call('create_project',{'name':'Page extraction checks','emails':[]},expected=201)
        page_pid,page_iid=made['project_id'],made['iteration_id']
        uploaded=owner.call('upload',{'iteration':page_iid},files=[('material-study.pdf','application/pdf',fixture.read_bytes())],expected=201)
        version=uploaded['ids'][0]
        worker=subprocess.Popen([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        observed=[]
        while worker.poll() is None:
            snapshot=owner.call('project',query='&id='+page_pid)
            observed.extend(j['progress']['stage'] for j in snapshot['jobs'] if j.get('progress'))
            time.sleep(.1)
        _,error=worker.communicate();check(worker.returncode==0,'Page worker completes: '+error.decode()[:100])
        page_deck=owner.call('project',query='&id='+page_pid)
        file=page_deck['files'][0]
        check(len(file['pages'])==4 and file['metadata']['image_count']>=4,'Every page and extracted image is persisted')
        check(any(s in observed for s in ['extracting_text','extracting_images','extracting_colors']),'Progress API reports actual extraction stages')
        check(all('images' in p and 'has_text' in p for p in page_deck['files'][0]['pages']),'File explorer receives extracted image entries and text availability')
        detail=owner.call('document_page',query=f'&iteration={page_iid}&id={version}&page=2')
        check('Japandi' in detail['text'] and len(detail['images'])==2,'Page API returns the correct page text and crops')
        check(page_deck['project']['theme']['style']=='Japandi','Style comes from source evidence instead of a fixed default')
        check('#668055' in file['metadata']['palette'],'Project palette samples the later moodboard page')
        image=owner.call('document_page',query=f'&iteration={page_iid}&id={version}&page=2&image=1',raw=True)
        check(image.startswith(b'\xff\xd8'),'Cropped images are served as images')
        stranger.call('document_page',query=f'&iteration={page_iid}&id={version}&page=2',expected=404)
        visuals=page_deck['slides']
        check(sum(s['image_number']>0 for s in visuals)==file['metadata']['image_count'],'Each extracted image has its own persistent slide')
        before_slide=next(s for s in visuals if s['page_number']==2 and s['image_number']==1)
        render_slide=next(s for s in visuals if s['page_number']==2 and s['image_number']==2)
        for slide,type_,situation in [(before_slide,'photo','before'),(render_slide,'render','concept')]:
            owner.call('save_slide',{'iteration':page_iid,'slide_id':slide['id'],'type':type_,'situation':situation,'title':type_+' slide'})
        owner.call('slide_image_edit',{'iteration':page_iid,'slide_id':before_slide['id'],'mode':'photorealistic','prompt':'Improve lighting'},expected=400)
        owner.call('slide_image_edit',{'iteration':page_iid,'slide_id':render_slide['id'],'mode':'photorealistic','prompt':'Improve lighting'},expected=503)
        stranger.call('slide_image',query=f'&iteration={page_iid}&slide_id={render_slide["id"]}',expected=404)
        resolved=owner.call('resolve_slide',query='&slide='+render_slide['id'])
        check(resolved['project_id']==page_pid and resolved['iteration_id']==page_iid,'Direct slide URLs resolve to the correct authorized project and iteration')
        stranger.call('resolve_slide',query='&slide='+render_slide['id'],expected=404)
        render_original=owner.call('slide_image',query=f'&iteration={page_iid}&slide_id={render_slide["id"]}',raw=True)
        crop=owner.call('document_page',query=f'&iteration={page_iid}&id={version}&page=2&image=2',raw=True)
        check(render_original==crop,'A render slide resolves the exact crop, not the entire PDF')
        check(owner.call('slide_image',query=f'&iteration={page_iid}&slide_id={before_slide["id"]}',raw=True)==image,'Before and concept slides on one page use distinct source images')
        helper=tmp/'slide-result.php'
        helper.write_text("<?php require '"+str(ROOT/"app/ingest.php")+"'; $p=json_decode(file_get_contents($argv[1]),true); $s=current_slide($p['iteration'],$p['slide']); save_slide_image_result(['iteration_id'=>$p['iteration'],'version_id'=>$p['source']],$s,['mode'=>'photorealistic','prompt'=>'Test variation','expected_image_version_id'=>$p['expected']],base64_decode($p['image']));")
        from test_extraction import png
        import base64
        variation=png('#527a65');variation2=png('#ab845b')
        def apply_variant(iteration,expected,blob):
            payload=tmp/'slide-result.json';payload.write_text(json.dumps({'iteration':iteration,'slide':render_slide['id'],'source':version,'expected':expected,'image':base64.b64encode(blob).decode()}))
            return subprocess.run([PHP,str(helper),str(payload)],env=env,capture_output=True)
        check(apply_variant(page_iid,None,variation).returncode==0,'Image edit result is saved to the selected slide')
        check(owner.call('slide_image',query=f'&iteration={page_iid}&slide_id={render_slide["id"]}',raw=True)==variation,'Generated slide image is served after completion')
        check(owner.call('slide_image',query=f'&iteration={page_iid}&slide_id={render_slide["id"]}&original=1',raw=True)==crop,'Original render remains available for comparison')
        check(owner.call('file',query=f'&iteration={page_iid}&id={version}',raw=True)==fixture.read_bytes(),'Photorealistic editing does not replace or alter the PDF')
        check(apply_variant(page_iid,None,variation2).returncode!=0,'Stale image results cannot overwrite a newer slide image')
        slide_ids=['intro']+['visual-'+s['id'] for s in page_deck['slides']]+['changes','budget','contacts','summary']
        owner.call('slide_layout',{'iteration':page_iid,'operation':'hide','slide_id':'intro'},csrf=False,expected=403)
        stranger.call('slide_layout',{'iteration':page_iid,'operation':'hide','slide_id':'intro'},expected=404)
        owner.call('slide_layout',{'iteration':page_iid,'operation':'hide','slide_id':'missing'},expected=404)
        owner.call('slide_layout',{'iteration':page_iid,'operation':'hide','slide_id':'intro'})
        owner.call('slide_layout',{'iteration':page_iid,'operation':'delete','slide_id':'changes'})
        owner.call('slide_layout',{'iteration':page_iid,'operation':'delete','slide_id':'visual-'+before_slide['id']})
        check(owner.call('slide_image',query=f'&iteration={page_iid}&slide_id={before_slide["id"]}',raw=True)==image,'Deleting a slide preserves its original image')
        order=list(reversed([x for x in slide_ids if x not in ['changes','visual-'+before_slide['id']]]))
        owner.call('slide_layout',{'iteration':page_iid,'operation':'reorder','order':order+['changes']},expected=409)
        owner.call('slide_layout',{'iteration':page_iid,'operation':'reorder','order':order[:-1]+[order[0]]},expected=409)
        owner.call('slide_layout',{'iteration':page_iid,'operation':'reorder','order':order})
        layout=owner.call('project',query='&id='+page_pid)['slide_layout']
        check(next(s for s in layout if s['slide_id']=='intro')['hidden']==1 and next(s for s in layout if s['slide_id']=='changes')['deleted']==1,'Visibility and deletion persist for built-in and image slides')
        check([s['slide_id'] for s in sorted([s for s in layout if not s['deleted']],key=lambda s:s['position'])]==order,'Complete slide order is persisted, including hidden slides')
        shared_page=owner.call('share',{'iteration':page_iid,'emails':['pages@example.test']})['links'][0]
        viewer=Client(base);viewer.bearer=shared_page['url'].split('/#/view/')[1]
        check(viewer.call('document_page',query=f'&id={version}&page=2&image=1',raw=True)==image,'Shared links can view their own extracted images')
        owner.call('reprocess',{'iteration':page_iid,'version_id':version},expected=409)
        next_iid=owner.call('new_iteration',{'iteration':page_iid,'title':'Re-extracted'},expected=201)['id']
        slide_copy=owner.call('project',query=f'&id={page_pid}&iteration={next_iid}')['slides']
        copied_layout=owner.call('project',query=f'&id={page_pid}&iteration={next_iid}')['slide_layout']
        check(copied_layout==layout,'New iterations preserve order, visibility and deleted slides')
        owner.call('slide_layout',{'iteration':page_iid,'operation':'show','slide_id':'intro'},expected=409)
        viewer.call('slide_layout',{'iteration':page_iid,'operation':'show','slide_id':'intro'},expected=401)
        owner.call('slide_layout',{'iteration':next_iid,'operation':'show','slide_id':'intro'})
        check(next(s for s in viewer.call('deck')['slide_layout'] if s['slide_id']=='intro')['hidden']==1,'Editing visibility in the next draft preserves the shared presentation')
        copied_render=next(s for s in slide_copy if s['id']==render_slide['id'])
        check(copied_render['type']=='render' and copied_render['situation']=='concept' and copied_render['image_version_id'],'New iterations preserve slide types, situation labels and selected image versions')
        check(apply_variant(next_iid,copied_render['image_version_id'],variation2).returncode==0,'A copied slide can receive a new image in the next draft')
        check(viewer.call('slide_image',query=f'&slide_id={render_slide["id"]}',raw=True)==variation,'Shared slides retain their own image version when the next iteration changes')
        owner.call('save_slide',{'iteration':page_iid,'slide_id':render_slide['id'],'type':'photo','situation':'after','title':'Changed'},expected=409)
        viewer.call('slide_image',query=f'&iteration={next_iid}&slide_id={render_slide["id"]}',expected=403)
        owner.call('theme',{'iteration':next_iid,'theme':{'style':'My own direction','colors':['#123456'],'font':'sans'}})
        new_version=owner.call('reprocess',{'iteration':next_iid,'version_id':version},expected=202)['id']
        owner.call('reprocess',{'iteration':next_iid,'version_id':new_version},expected=409)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        refreshed=owner.call('project',query=f'&id={page_pid}&iteration={next_iid}')
        check(refreshed['files'][0]['id']!=version and len(refreshed['files'][0]['pages'])==4,'Re-extraction creates a complete new version')
        check(refreshed['project']['theme']['style']=='My own direction','Manual styling survives background processing')
        check(viewer.call('document_page',query=f'&id={version}&page=2&image=1',raw=True)==image,'Re-extraction preserves the shared page snapshot')
        viewer.call('document_page',query=f'&id={new_version}&page=2&image=1',expected=404)
        owner.call('revoke_share',{'id':shared_page['id']})
        viewer.call('document_page',query=f'&id={version}&page=2&image=1',expected=403)
        viewer.call('slide_image',query=f'&slide_id={render_slide["id"]}',expected=403)
        check(True,'Future and revoked page images are inaccessible')
        print('\nAll workflow checks passed. No real email or AI calls were made.')
    finally:
        server.terminate();server.wait(timeout=5);output.close()
