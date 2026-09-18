// Fictional full-app fixture. No database, email, AI or billing services.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
exports.startOnboardingFixture=async function(){
  const {demoRequest}=await import('../../public/assets/demo.js');
  const root=path.resolve(__dirname,'../../public'),sample=(await demoRequest('projects')).projects[0];
  const fixture={empty:true,visible:false,needsSetup:false,language:'en',studio:'demo',user:'onboarding-user',created:null,files:false,shared:false,calls:[]};
  const billing=()=>({needs_onboarding:fixture.needsSetup,trial_active:true,status:'trial',usage:{passes:0,projects:fixture.empty?0:1},limits:{projects:1}});
  const session=async()=>{const s=await demoRequest('session');s.user.id=fixture.user;s.user.profile.language=fixture.language;s.studio.id=fixture.studio;s.studios=[s.studio];s.billing=billing();return s;};
  async function api(action,body){
    fixture.calls.push({action,body});
    if(action==='session')return session();
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
      res.setHeader('X-Frame-Options',url.pathname==='/index.html'&&url.searchParams.get('app-tour')==='1'?'SAMEORIGIN':'DENY');
      if(url.pathname==='/api.php'){
        let data='';for await(const chunk of req)data+=chunk;
        const body=data?JSON.parse(data):Object.fromEntries(url.searchParams);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await api(url.searchParams.get('action'),body)));return;
      }
      const file=url.pathname.startsWith('/assets/')?path.resolve(root,'.'+url.pathname):path.join(root,'index.html');
      if(!file.startsWith(root+path.sep))throw Error('Invalid fixture path');
      res.setHeader('Content-Type',types[path.extname(file)]||'text/html');res.end(await fs.readFile(file));
    }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {fixture,sample,base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
};
