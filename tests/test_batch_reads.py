"""Isolated real PHP/SQLite batch tests. Run inside the app image: python3 tests/test_batch_reads.py."""
import json, os, socket, sqlite3, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
with tempfile.TemporaryDirectory(prefix='studiodeck-batch-') as directory:
    dbpath=str(Path(directory)/'test.sqlite')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    env={**os.environ,'DATABASE_PATH':dbpath,'APP_ENV':'local','APP_URL':base,'MAIL_TRANSPORT':'log','OPENAI_API_KEY':''}
    seed='''require 'app/bootstrap.php'; db();
    insert('users',['id'=>'u','email'=>'batch@example.test','name'=>'Batch','created_at'=>now()]);
    $sid=create_studio('u','Batch studio');
    query('UPDATE studios SET setup_completed_at=? WHERE id=?',[time(),$sid]);
    query('UPDATE studio_billing SET legacy_exempt=1 WHERE studio_id=?',[$sid]);
    insert('sessions',['token_hash'=>hash_token('batch-token'),'user_id'=>'u','studio_id'=>$sid,'csrf'=>'csrf','expires_at'=>time()+3600]);
    foreach(['p','other'] as $pid){
      insert('projects',['id'=>$pid,'studio_id'=>$sid,'user_id'=>'u','name'=>$pid,'created_at'=>now()]);
      insert('project_members',['project_id'=>$pid,'user_id'=>'u']);
      insert('project_coverage',['project_id'=>$pid,'source'=>'legacy']);
      insert('iterations',['id'=>$pid.'-i','project_id'=>$pid,'number'=>1,'title'=>'Initial','created_at'=>now()]);
    }
    insert('budget_items',['id'=>'cost','iteration_id'=>'p-i','label'=>'Lighting','amount_cents'=>4200]);
    insert('project_client_members',['project_id'=>'p','email'=>'client@example.test','name'=>'Client','created_at'=>now()]);
    echo json_encode(['studio'=>$sid]);'''
    fixture=json.loads(subprocess.check_output([PHP,'-r',seed],cwd=ROOT,env=env))
    studio=fixture['studio']
    def request(path,data=None,expected=200,headers=None):
        h={'Cookie':'studiodeck_session=batch-token','X-CSRF-Token':'csrf','Content-Type':'application/json',**(headers or {})}
        req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=h)
        try:r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:r=e
        raw=r.read();assert r.status==expected,(r.status,expected,raw)
        return json.loads(raw)
    def call(name,id=None,project='p',iteration=None):
        return {'id':id or name,'method':'QUERY','relative_url':studio+'/'+name,'body':json.dumps({'projectId':project,'iterationId':iteration}),'requestingId':None}
    endpoint=f'/api/1.0/{studio}/batch'
    log=open(Path(directory)/'server.log','w+')
    server=subprocess.Popen([PHP,'-S',f'127.0.0.1:{port}','-t','public','public/router.php'],cwd=ROOT,env=env,stdout=log,stderr=log)
    try:
        for _ in range(80):
            try:request('/api.php?action=session');break
            except urllib.error.URLError:time.sleep(.05)
        resources=['shell','jobs','overview','slides','files','budget','people','communication','presentation']
        result=request(endpoint,[[call('project:'+name) for name in resources]])
        assert all(r['code']==200 for r in result),result
        parts={r['responseid'].split(':')[1]:r['body']['other'] for r in result}
        legacy=request('/api.php?action=project&id=p')
        for name in ['shell','jobs','slides','files','budget','people','communication']:
            for key,value in parts[name].items():
                if key in ['members','files','file_count']:continue # Explicit projections for these resources.
                assert value==legacy[key],(name,key,value,legacy[key])
        assert parts['presentation']==legacy
        assert parts['overview']['overview']['client_count']==1
        assert parts['overview']['total_cents']==4200
        assert not set(parts['overview']) & {'files','slides','budget','people','communication','comments','clients'}
        assert parts['shell']['iteration']['id']=='p-i'
        print('PASS scoped resources match legacy values; overview excludes tab collections')
        mixed=request(endpoint,[[call('project:shell','valid'),call('project:budget','denied','missing'),call('project:shell','wrong-iteration',iteration='other-i')]])
        assert [r['code'] for r in mixed]==[200,404,404]
        assert [r['responseid'] for r in mixed]==['valid','denied','wrong-iteration']
        print('PASS per-call failures, project/iteration isolation and response IDs')
        app=request(endpoint,[[{**call('app:context'),'body':'{}'}],[{**call('app:status'),'body':'{}'}]])
        assert app[0]['body']['other']['user']['id']=='u'
        assert app[0]['body']['other']['capabilities']['batch_reads'] is True
        assert app[1]['body']['other']['unread_count']==0
        print('PASS app context and separate dynamic status across multiple request groups')
        for payload in [{},[],[{}],[[call('project:shell'),call('project:shell')]],[[{**call('project:shell'),'body':{}}]],[[{**call('project:shell'),'body':'[]'}]],[[{**call('project:shell'),'body':'{"x":"{{other.entities[].id}}"}'}]],[[{**call('project:shell'),'relative_url':'another/project:shell'}]],[[call('project:shell',str(n)) for n in range(101)]]]:
            request(endpoint,payload,400)
        request(endpoint,[[{**call('project:shell'),'method':'PATCH'}]],405)
        request(endpoint,[[call('project:unknown')]],404)
        request(endpoint,[[call('project:shell')]],403,{'X-CSRF-Token':'wrong'})
        request(endpoint,[[call('project:shell')]],401,{'Cookie':''})
        request(endpoint,[[call('project:shell')]],400,{'X-Studio-ID':'another'})
        request('/api/1.0/unknown/batch',[[call('project:shell')]],404)
        request(endpoint,[[call('project:shell')]],403,{'Authorization':'Client share'})
        print('PASS malformed envelopes, unsupported calls, authentication, CSRF and studio boundaries')
        def action(name,params=None,method='QUERY',id=None,scope=studio):
            return {'id':id or name,'method':method,'relative_url':scope+'/api:'+name,'body':json.dumps(params or {}),'requestingId':None}
        names=['projects','profile','studio_users','destinations','attention','studio_starting_pack','comments_feed']
        result=request(endpoint,[[action(name) for name in names]])
        for name,reply in zip(names,result):
            assert reply['code']==200,(name,reply)
            assert reply['body']['other']==request('/api.php?action='+name),name
        print('PASS app-wide JSON reads match legacy dispatcher payloads')
        result=request(endpoint,[
            [action('project_settings',{'project_id':'p','location':'Amsterdam','tags':['A','B']},'POST')],
            [action('pin_project',{'project_id':'p','pinned':True},'POST')],
            [action('projects')],
            [action('save_budget',{'iteration':'p-i','label':''},'POST','bad-budget')],
            [action('save_budget',{'iteration':'p-i','label':'Batch cost','amount':'12.50'},'POST','good-budget')],
            [action('project',{'id':'p'})],
        ])
        assert [r['code'] for r in result]==[200,200,200,400,200,200],result
        project=next(p for p in result[2]['body']['other']['projects'] if p['id']=='p')
        assert project['location']=='Amsterdam' and project['tags']==['A','B'] and project['pinned']==1
        assert any(b['label']=='Batch cost' for b in result[-1]['body']['other']['budget'])
        # An error after the first SQL update must roll back that action only.
        result=request(endpoint,[[action('project_settings',{'project_id':'p','location':'Must roll back','tags':'bad'},'POST')],[action('projects')]])
        assert result[0]['code']==400
        assert next(p for p in result[1]['body']['other']['projects'] if p['id']=='p')['location']=='Amsterdam'
        # Validate the entire envelope before running any mutation.
        request(endpoint,[[action('pin_project',{'project_id':'p','pinned':False},'POST'),action('projects')]],400)
        request(endpoint,[[action('pin_project',{'project_id':'p','pinned':False},'POST')],[action('file')]],404)
        assert next(p for p in request('/api.php?action=projects')['projects'] if p['id']=='p')['pinned']==1
        request(endpoint,[[action('pin_project',method='QUERY')]],405)
        request(endpoint,[[action('document_page',{'preview':1})]],400)
        request(endpoint,[[action('projects')]],403,{'X-CSRF-Token':'wrong'})
        print('PASS writes, nested bodies, ordering, per-action rollback, validation before execution and CSRF')
        # Keep account context independent of the studio route; session changes are isolated.
        account='/api/1.0/account/batch'
        result=request(account,[[action('profile',scope='account'),action('destinations',scope='account')]])
        assert all(r['code']==200 for r in result)
        result=request(account,[[action('save_profile',{'name':'Updated {{name}}','email_comments':True,'email_mentions_only':False,'language':'en'},'POST',scope='account')]])
        assert result[0]['body']['other']['profile']['name']=='Updated {{name}}'
        request(account,[[action('logout',method='POST',scope='account')],[action('profile',scope='account')]],400)
        result=request(account,[[action('create_studio',{'name':'Second studio'},'POST',scope='account')]])
        assert result[0]['code']==201,result
        second=result[0]['body']['other']['studio']['id'];assert second!=studio
        result=request(account,[[action('switch_studio',{'studio_id':studio},'POST',scope='account')]])
        assert result[0]['body']['other']['studio']['id']==studio
        # A valid other studio cannot read or write this studio's projects.
        result=request('/api/1.0/'+second+'/batch',[[action('pin_project',{'project_id':'p','pinned':False},'POST',scope=second)],[action('project',{'id':'p'},scope=second)]])
        assert [r['code'] for r in result]==[404,404],result
        print('PASS account reads/writes, isolated studio switching and cross-studio access checks')
        # Prove overview avoids the expensive enrichers, not merely filtering a full payload afterward.
        probe="""require 'app/bootstrap.php';require 'app/project_resources.php';
        $_COOKIE['studiodeck_session']='batch-token';$u=owner();[$p,$i]=project_read_context($u,['projectId'=>'p']);
        db()->exec('DROP TABLE budget_match_checks; DROP TABLE budget_link_suggestions; DROP TABLE comment_reads');
        $r=project_overview_resource($p,$i);echo json_encode($r);"""
        overview=json.loads(subprocess.check_output([PHP,'-r',probe],cwd=ROOT,env=env))
        assert overview['total_cents']>4200
        print('PASS overview does not invoke budget/communication detail loaders')
    except Exception:
        log.flush();log.seek(0);print(log.read()[-12000:]);raise
    finally:
        server.terminate();server.wait(timeout=10);log.close()
