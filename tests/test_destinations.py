"""Account/client authorization integration checks against an isolated app.
Set STUDIODECK_TEST_URL, STUDIODECK_TEST_MAIL_LOG, STUDIODECK_TEST_DATABASE,
and STUDIODECK_TEST_EXPORT. The database must belong to the isolated test server.
"""
import os,json,time,sqlite3,urllib.request,urllib.error,http.cookiejar,base64,struct,zlib
from pathlib import Path
base=os.environ['STUDIODECK_TEST_URL'];log=Path(os.environ['STUDIODECK_TEST_MAIL_LOG']);database=os.environ['STUDIODECK_TEST_DATABASE']
class Client:
 def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.csrf='';self.auth=''
 def call(self,action,data=None,query=None,status=200,csrf=True,raw=False,file=None):
  headers={};body=None
  if self.csrf and csrf:headers['X-CSRF-Token']=self.csrf
  if self.auth:headers['Authorization']=self.auth
  if file:
   boundary='test-image';headers['Content-Type']='multipart/form-data; boundary='+boundary
   body=b''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k,v in data.items())
   body+=f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+file+f'\r\n--{boundary}--\r\n'.encode()
  elif data is not None:headers['Content-Type']='application/json';body=json.dumps(data).encode()
  req=urllib.request.Request(base+'/api.php?'+urllib.parse.urlencode({'action':action,**(query or {})}),body,headers)
  try:r=self.opener.open(req)
  except urllib.error.HTTPError as error:r=error
  result=r.read();assert r.status==status,(action,r.status,result[:500]);return result if raw else json.loads(result)
 def login(self,email):
  self.call('request_login',{'email':email});token=log.read_text().strip().splitlines()[-1].split('/#/login/')[1];self.call('consume_login',{'token':token});s=self.call('session');self.csrf=s['csrf'];return s
stamp=str(time.time_ns());emails={key:f'{key}-{stamp}@example.test' for key in ['alpha','beta','client','single','stranger']}
a=Client();sa=a.login(emails['alpha']);assert len(sa['studios'])==1, 'New accounts keep automatic studio creation'
a.call('studio_theme',{'name':'Atelier Alpha'});studioA=sa['studio']['id']
b=Client();sb=b.login(emails['beta']);b.call('studio_theme',{'name':'Studio Beta'});studioB=sb['studio']['id']
pa=a.call('create_project',{'name':'Alpha home'},status=201);pb=b.call('create_project',{'name':'Beta garden'},status=201)
chunk=lambda kind,data:struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'+b'\xaa\x88\x66'*2+b'\0'+b'\xaa\x88\x66'*2))+chunk(b'IEND',b'')
image=a.call('save_slide',{'iteration':pa['iteration_id'],'type':'photo','title':'Shared cover','section':'designs'},file=png)
b.call('save_budget',{'iteration':pb['iteration_id'],'label':'Optional garden lighting','kind':'estimate','price_type':'fixed','amount':'100','is_optional':True})
shareA=a.call('share',{'iteration':pa['iteration_id'],'emails':[emails['client'],emails['alpha'],emails['single']]})['links']
shareB=b.call('share',{'iteration':pb['iteration_id'],'emails':[emails['client'],emails['alpha']]})['links']
# A newer iteration is shared to somebody else; the client's list must retain their own version.
b2=b.call('new_iteration',{'iteration':pb['iteration_id'],'title':'Not shared with this client'},status=201)['id'];b.call('share',{'iteration':b2,'emails':[emails['stranger']]});b3=b.call('new_iteration',{'iteration':b2,'title':'Private draft'},status=201)['id']
for state in ['archived','revoked','expired']:
 p=a.call('create_project',{'name':state+' project'},status=201);link=a.call('share',{'iteration':p['iteration_id'],'emails':[emails['client']]})['links'][0]
 if state=='archived':a.call('project_settings',{'project_id':p['project_id'],'archived':True})
 elif state=='revoked':a.call('revoke_share',{'id':link['id']})
 else:
  with sqlite3.connect(database) as db:db.execute('UPDATE shares SET expires_at=0 WHERE id=?',(link['id'],))
# Preserve earlier anonymous profile preferences when the client claims their account.
with sqlite3.connect(database) as db:db.execute('INSERT INTO person_profiles(person_key,name,email_comments) VALUES(?,?,0)',('client:'+emails['client'],'Client Name'))
c=Client();sc=c.login(emails['client']);assert len(sc['studios'])==1;assert sc['user']['profile']['name']=='Client Name';assert sc['user']['profile']['email_comments'] is False
choices=c.call('destinations');assert {p['id'] for p in choices['projects']}=={pa['project_id'],pb['project_id']};assert len(choices['studios'])==1;assert all(not p['studio_access'] for p in choices['projects'])
selected=c.call('client_project',query={'project_id':pb['project_id']});assert selected['iteration_id']==pb['iteration_id'];c.auth='Client '+selected['share_id']
deck=c.call('deck');assert deck['iteration']['id']==pb['iteration_id'];assert not any(k in deck for k in ['events','jobs','shares','members','iterations']);assert deck['profile']['name']=='Client Name'
c.call('deck',query={'iteration':b2},status=404);c.call('deck',query={'iteration':pa['iteration_id']},status=404)
c.call('comment',{'iteration':pb['iteration_id'],'slide':'budget','body':'Keep this as an option'},csrf=False,status=403)
c.call('comment',{'iteration':pb['iteration_id'],'slide':'budget','body':'Keep this as an option'})
budget_id=deck['budget'][0]['id'];c.call('budget_choice',{'iteration':pb['iteration_id'],'id':budget_id,'selected':True})
c.call('save_slide',{'iteration':pb['iteration_id'],'type':'text','title':'Not allowed'},status=404)
c.call('project',query={'id':pb['project_id']},status=404)
c.auth='';c.call('destination_cover',query={'project_id':pa['project_id'],'iteration':pa['iteration_id']},raw=True)
c.call('destination_cover',query={'project_id':pb['project_id'],'iteration':b2},status=404)
# A share ID is never sufficient without the matching signed-in email.
outsider=Client();outsider.login(emails['stranger']);outsider.auth='Client '+selected['share_id'];outsider.call('deck',status=404)
anonymous=Client();anonymous.auth='Client '+selected['share_id'];anonymous.call('deck',status=401)
# Mixed role: own studio plus client projects; same-project access offers both roles.
mixed=a.call('destinations');assert len(mixed['studios'])==1;assert len(mixed['projects'])==2;assert next(p for p in mixed['projects'] if p['id']==pa['project_id'])['studio_access'];assert not next(p for p in mixed['projects'] if p['id']==pb['project_id'])['studio_access']
a.auth='Client '+a.call('client_project',query={'project_id':pb['project_id']})['share_id'];a.call('save_slide',{'iteration':b3,'type':'text','title':'Not allowed'},status=404);a.auth=''
# Legacy links still work, and cannot change an employee's signed-in profile.
legacy=Client();legacy.auth='Bearer '+shareA[1]['url'].split('/#/view/')[1];legacy.call('deck');legacy.call('save_profile',{'name':'Anonymous client alias','email_comments':True});assert a.call('profile')['profile']['name']!='Anonymous client alias'
# Revocation is checked on every subsequent request, not just while opening the card.
b.call('revoke_share',{'id':selected['share_id']});c.auth='Client '+selected['share_id'];c.call('deck',status=404);c.call('budget_choice',{'iteration':pb['iteration_id'],'id':budget_id,'selected':False},status=404);c.auth='';assert len(c.call('destinations')['projects'])==1
# Reissue a valid invite for browser navigation checks.
b.call('share',{'iteration':pb['iteration_id'],'emails':[emails['client']]})
# An employee can work for several studios while remaining only a client on a private project.
b.call('save_studio_user',{'name':'Alpha employee','email':emails['alpha'],'role':'member'})
assert len(a.call('destinations')['studios'])==2
# Existing accounts without a studio can have exactly one client destination or none.
for key in ['single','empty']:
 if key not in emails:emails[key]=f'{key}-{stamp}@example.test'
 member=next(u for u in b.call('save_studio_user',{'name':key,'email':emails[key],'role':'member'})['users'] if u['email']==emails[key])
 b.call('remove_studio_user',{'id':member['id']})
fixture={'emails':emails,'studioA':studioA,'studioB':studioB,'a':pa,'b':pb,'b2':b2,'b3':b3,'image':image,'legacy':shareA[0]['url']}
Path(os.environ['STUDIODECK_TEST_EXPORT']).write_text(json.dumps(fixture))
print('PASS Destinations: automatic signup studio, cross-studio client projects, latest authorized shared iteration, archive/revoke/expiry, profile claim, CSRF, role isolation, covers, budget/comments and legacy links.')
