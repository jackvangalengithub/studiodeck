// Fictional full-app fixture. No database, email, AI or billing services.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
exports.startOnboardingFixture=async function({offline=false}={}){
  const {demoRequest}=await import('../../public/assets/demo.js');
  const root=path.resolve(__dirname,'../../public'),sample=(await demoRequest('projects')).projects[0];
  const fixture={setupCompleted:'existing',businessType:'interior',studioName:'Demo studio',setupFail:false,empty:true,visible:false,needsSetup:false,language:'en',studio:'demo',user:'onboarding-user',created:null,files:false,shared:false,calls:[]};
  const billing=()=>({needs_onboarding:fixture.needsSetup,trial_active:!fixture.needsSetup,trial_ends_at:fixture.needsSetup?null:Math.floor(Date.now()/1000)+5*86400,status:'trial',usage:{passes:0,projects:fixture.empty?0:1},limits:{projects:1}});
  const session=async()=>{const s=await demoRequest('session');s.user.id=fixture.user;s.user.profile.language=fixture.language;s.studio.id=fixture.studio;s.studio.setup_completed_at=fixture.setupCompleted;s.studio.business_type=fixture.businessType;s.studio.name=fixture.studioName;s.studio.language=fixture.language;s.studios=[s.studio];s.billing=billing();return s;};
  async function api(action,body){
    fixture.calls.push({action,body});
    if(action==='session')return session();
    if(action==='complete_studio_setup'){
      if(fixture.setupFail)throw Error('Temporary save failure. Please try again.');
      fixture.needsSetup=false;fixture.setupCompleted='2026-09-19T12:00:00Z';fixture.businessType=body.business_type;fixture.studioName=body.name;fixture.language=body.language;return session();
    }
    if(action==='studio_theme'){fixture.businessType=body.business_type;fixture.studioName=body.name;fixture.language=body.language;return {ok:true};}
    if(action==='website'){
      const types=JSON.parse(await fs.readFile(path.join(root,'assets/studio-types.json'),'utf8')),recommended=types.find(t=>t.id===fixture.businessType).templates;
      const ids=['editorial','linen','noir','gallery','coast','atelier','panorama','folio','terracotta','minimal'];
      return {studio_id:fixture.studio,draft:{started:false,name:fixture.studioName},templates:[...recommended,...ids.filter(id=>!recommended.includes(id))].map(id=>({id,name:id,description:'A considered design.',tone:'light',recommended:recommended.includes(id),business_types:types.map(t=>t.id),styles:['modern']})),revision:1};
    }
    if(action==='projects')return {studio_empty:fixture.empty,projects:fixture.visible?[{...sample,id:fixture.created?.project_id||sample.id,name:fixture.created?'My first project':sample.name,members:[]}]:[],billing:billing()};
    if(action==='project_access')return {reason:'ready'};
    if(action==='billing_onboard'){fixture.needsSetup=false;return session();}
    if(action==='studio_starting_pack')return {items:[]};
    if(action==='create_project'){fixture.created=await demoRequest(action,body);fixture.empty=false;fixture.visible=true;return fixture.created;}
    if(action==='project'){
      const d=await demoRequest(action,body);d.slides=[];d.slide_content=[];d.can_edit=true;d.clients=[];d.members=[];d.project.archived=0;
      if(fixture.created&&!fixture.files)d.files=[];
      if(fixture.files&&fixture.created)d.files=(await demoRequest('project',{id:sample.id})).files;
      d.iteration.status=fixture.shared?'shared':'draft';d.iterations=d.iterations.map(i=>({...i,status:d.iteration.status}));return d;
    }
    if(action==='drive_status')return {configured:false,connected:false};
    if(action==='view_event')return {ok:true};
    throw Error('Unexpected fixture API action: '+action);
  }
  const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.webm':'video/webm','.vtt':'text/vtt','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.csv':'text/csv'};
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.searchParams.get('action')==='website_template_preview'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Example</title><h1>Studio example</h1>');return;}
      res.setHeader('X-Frame-Options',url.pathname==='/index.html'&&url.searchParams.get('app-tour')==='1'?'SAMEORIGIN':'DENY');
      if(url.pathname==='/api.php'){
        let data='';for await(const chunk of req)data+=chunk;
        const body=data?JSON.parse(data):Object.fromEntries(url.searchParams);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await api(url.searchParams.get('action'),body)));return;
      }
      const file=url.pathname.startsWith('/assets/')?path.resolve(root,'.'+url.pathname):path.join(root,'index.html');
      if(!file.startsWith(root+path.sep))throw Error('Invalid fixture path');
      const content=await fs.readFile(file);
      if(path.extname(file)==='.webm'){
        res.setHeader('Accept-Ranges','bytes');
        const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
        if(range){
          const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),content.length-1):content.length-1;
          if(start>end){res.statusCode=416;res.setHeader('Content-Range',`bytes */${content.length}`);res.end();return;}
          res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${content.length}`);
          res.setHeader('Content-Type','video/webm');res.setHeader('Content-Length',end-start+1);res.end(content.subarray(start,end+1));return;
        }
      }
      res.setHeader('Content-Type',types[path.extname(file)]||'text/html');res.setHeader('Content-Length',content.length);res.end(content);
    }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
  });
  if(offline)return {fixture,sample,base:'http://localhost:19888',close:async()=>{},install:async page=>{
    await page.route('http://localhost:19888/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={};
      const req={url:url.pathname+url.search,headers:request.headers(),async *[Symbol.asyncIterator](){if(request.postData())yield request.postData();}};
      let content='';const res={statusCode:200,setHeader:(name,value)=>{headers[name]=String(value);},end:value=>{content=value??'';}};
      await server.listeners('request')[0](req,res);
      await route.fulfill({status:res.statusCode,headers,body:content});
    });
  }};
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {fixture,sample,base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
};
