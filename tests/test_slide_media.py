"""Media storage, authorization, snapshots and async generation. No paid calls.
Run inside the project PHP/Python image; MEDIA_TEST_VIDEO points to a tiny WebM.
"""
import json, os, subprocess, unittest, urllib.request, urllib.error
from pathlib import Path
from test_security import Client, SecurityFixture

class SlideMediaTests(SecurityFixture):
    def seed(self):
        super().seed()
        self.sql("UPDATE presentation_slides SET image_version_id=NULL,type='fullphoto',manual=1")
        self.sql("UPDATE studios SET setup_completed_at='2026-09-24'")

    def php(self, code):
        result = subprocess.run(['php','-r',"require 'app/ingest.php'; "+code],cwd=self.tmp,env=self.env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        return result.stdout

    def upload(self, raw=None, **extra):
        raw = raw if raw is not None else Path(os.environ['MEDIA_TEST_VIDEO']).read_bytes()
        boundary='media-test';fields={'iteration':'iteration-shared','type':'video','title':'A quiet film','video_layout':'full','video_autoplay':'1',**extra}
        body=b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode() for k,v in fields.items())
        body+=(f'--{boundary}\r\nContent-Disposition: form-data; name="video_file"; filename="film.webm"\r\nContent-Type: video/webm\r\n\r\n').encode()+raw+f'\r\n--{boundary}--\r\n'.encode()
        request=urllib.request.Request(self.base+'/api.php?action=save_slide',data=body,headers={'Cookie':'studiodeck_session=editor','X-CSRF-Token':'csrf-editor','Content-Type':'multipart/form-data; boundary='+boundary})
        try:r=urllib.request.urlopen(request)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())

    def deck(self, actor=None):
        return self.ok((actor or self.editor).api('deck',query={'iteration':'iteration-shared'}))

    def motion(self, **extra):
        return self.editor.api('save_slide_motion',{'iteration':'iteration-shared','slide_id':'slide-shared','mode':'simple','movement':'pan-right','duration':4,**extra})

    def test_upload_playback_ranges_and_access(self):
        status,result=self.upload();self.assertEqual(status,200,result)
        slide=next(s for s in self.deck()['slides'] if s['id']==result['id'][7:]);video=slide['metadata']['video']
        self.assertEqual(video['provider'],'upload');self.assertEqual(video['layout'],'full');self.assertTrue(video['autoplay'])
        query={'iteration':'iteration-shared','slide_id':slide['id'],'media_id':video['media_id']}
        self.assertEqual(self.client.api('slide_media',query=query)[1],Path(os.environ['MEDIA_TEST_VIDEO']).read_bytes())
        status,raw,headers=self.client.api('slide_media',query=query,headers={'Range':'bytes=2-12'})
        self.assertEqual(status,206);self.assertEqual(len(raw),11);self.assertTrue(headers['Content-Range'].startswith('bytes 2-12/'))
        self.assertEqual(self.client.api('slide_media',query=query,headers={'Range':'bytes=99999999-'})[0],416)
        self.denied(Client(self.base,'outsider').api('slide_media',query=query));self.denied(self.anon.api('slide_media',query=query))
        self.denied(self.client.api('slide_media',query={**query,'iteration':'iteration-own'}))
        self.ok(self.editor.api('save_slide',{'iteration':'iteration-shared','slide_id':slide['id'],'type':'video','title':'Renamed'}))
        self.assertEqual(next(s for s in self.deck()['slides'] if s['id']==slide['id'])['metadata']['video']['media_id'],video['media_id'])

    def test_invalid_upload_is_atomic_and_youtube_compatible(self):
        self.assertEqual(self.upload(b'<html>not a video</html>')[0],400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM slide_media')[0][0],0)
        self.assertEqual(self.upload(video_fit='stretch')[0],400)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM slide_media')[0][0],0)
        result=self.ok(self.editor.api('save_slide',{'iteration':'iteration-shared','type':'video','title':'YouTube','video_url':'https://youtu.be/M7lc1UVf-VE?t=90','video_layout':'full','video_autoplay':True}))
        video=next(s for s in self.deck()['slides'] if s['id']==result['id'][7:])['metadata']['video']
        self.assertEqual(video['start'],90);self.assertTrue(video['autoplay'])

    def test_motion_validation_permissions_and_lock(self):
        self.ok(self.motion());self.assertEqual(self.deck()['slides'][0]['metadata']['motion']['source_key'],'file-shared:0:0:')
        self.assertEqual(self.motion(duration=999)[0],400);self.assertEqual(self.motion(movement='fly-away')[0],400)
        self.assertEqual(self.editor.api('save_slide_motion',{'iteration':'iteration-shared','slide_id':'slide-shared','mode':'none'},headers={'X-CSRF-Token':''})[0],403)
        self.denied(self.client.api('save_slide_motion',{'iteration':'iteration-shared','slide_id':'slide-shared','mode':'none'}))
        self.assertEqual(self.editor.api('generate_slide_motion',{'iteration':'iteration-shared','slide_id':'slide-shared'})[0],503)
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'");self.assertEqual(self.motion()[0],409)

    def generate_candidate(self, legacy=False):
        video=Path(os.environ['MEDIA_TEST_VIDEO']).read_bytes();(self.tmp/'video.webm').write_bytes(video)
        code="""
        putenv('GEMINI_API_KEY=fake-test-key');
        $i=one("SELECT * FROM iterations WHERE id='iteration-shared'");$s=current_slide($i['id'],'slide-shared');
        $prompt="Glide gently towards the window.\nKeep the warm morning light; finish on the photo.";
        $id=transaction(fn()=>queue_slide_video($i,$s,['prompt'=>$prompt]));
        if(LEGACY_JOB){$p=json_decode(one('SELECT payload FROM jobs WHERE id=?',[$id])['payload'],true);unset($p['prompt']);$p['movement']='pan-left';query('UPDATE jobs SET payload=? WHERE id=?',[json_encode($p),$id]);$prompt=legacy_slide_motion_prompt('pan-left');}

        $request=function($path,$body=null)use($prompt){
            if($body){if(!str_contains($body['instances'][0]['prompt'],$prompt))throw new Exception('Edited prompt lost');if(empty($body['instances'][0]['image']['bytesBase64Encoded'])||empty($body['instances'][0]['lastFrame']['bytesBase64Encoded']))throw new Exception('Frame constraints missing');return ['name'=>'models/veo-3.1-fast-generate-preview/operations/test'];}
            return ['done'=>true,'response'=>['generateVideoResponse'=>['generatedSamples'=>[['video'=>['uri'=>'https://generativelanguage.googleapis.com/test']]]]]];
        };
        process_slide_video(one('SELECT * FROM jobs WHERE id=?',[$id]),$request);
        $j=one('SELECT * FROM jobs WHERE id=?',[$id]);if($j['status']!=='queued'||!json_decode($j['payload'],true)['operation'])throw new Exception('Operation not saved');
        process_slide_video($j,$request,fn($url)=>file_get_contents('video.webm'));
        echo $id;
        """
        return self.php(code.replace('LEGACY_JOB','true' if legacy else 'false'))

    def test_generated_video_requires_apply_and_remains_a_snapshot(self):
        self.ok(self.motion());jid=self.generate_candidate();slide=self.deck()['slides'][0];candidate=slide['metadata']['motion_candidate']
        self.assertEqual(slide['metadata']['motion']['mode'],'simple')
        self.assertNotIn('motion_candidate',self.deck(self.client)['slides'][0]['metadata'])
        query={'iteration':'iteration-shared','slide_id':'slide-shared','media_id':candidate['media_id']}
        self.assertEqual(self.editor.api('slide_media',query=query)[0],200);self.assertEqual(self.client.api('slide_media',query=query)[0],404)
        self.assertEqual(self.motion(mode='ai',media_id=candidate['media_id'],prompt='Different instructions')[0],409)
        self.ok(self.motion(mode='ai',media_id=candidate['media_id'],prompt=candidate['prompt']));self.assertEqual(self.client.api('slide_media',query=query)[0],200)
        self.assertEqual(self.editor.api('retry_job',{'id':jid})[0],400)
        self.assertNotIn('prompt',self.deck(self.client)['slides'][0]['metadata']['motion'])
        self.assertEqual(self.deck()['slides'][0]['metadata']['motion']['prompt'],candidate['prompt'])
        self.sql("INSERT INTO project_members(project_id,user_id) VALUES('shared','admin')")
        self.ok(self.admin.api('lock_iteration',{'iteration':'iteration-shared'}))
        newer=self.ok(self.editor.api('new_iteration',{'iteration':'iteration-shared'}),201)['id']
        self.ok(self.editor.api('save_slide_motion',{'iteration':newer,'slide_id':'slide-shared','mode':'none'}))
        self.assertEqual(self.deck(self.client)['slides'][0]['metadata']['motion']['mode'],'ai')
        self.denied(self.client.api('slide_media',query={**query,'iteration':newer}))
        self.php("require_once 'app/project_delete.php';transaction(fn()=>delete_project_records('shared'));")
        self.assertEqual(self.sql('SELECT COUNT(*) FROM slide_media')[0][0],0)

    def test_stale_candidate_rejected(self):
        self.generate_candidate();candidate=self.deck()['slides'][0]['metadata']['motion_candidate']
        self.sql("UPDATE presentation_slides SET image_version_id='variant-shared' WHERE id='slide-shared'")
        self.assertEqual(self.motion(mode='ai',media_id=candidate['media_id'])[0],409)
        self.assertEqual(self.editor.api('slide_media',query={'iteration':'iteration-shared','slide_id':'slide-shared','media_id':candidate['media_id']})[0],404)

    def test_stale_generation_cannot_replace_photo(self):
        result=self.php("""
        putenv('GEMINI_API_KEY=fake');$i=one("SELECT * FROM iterations WHERE id='iteration-shared'");$s=current_slide($i['id'],'slide-shared');
        $id=transaction(fn()=>queue_slide_video($i,$s,['prompt'=>'Slow camera movement.']));query("UPDATE presentation_slides SET source_version_id='old-shared' WHERE id='slide-shared'");
        try{process_slide_video(one('SELECT * FROM jobs WHERE id=?',[$id]),fn()=>throw new Exception('Must not call provider'));}catch(RuntimeException $e){echo $e->getMessage();}
        """)
        self.assertIn('photo changed',result);self.assertEqual(self.sql('SELECT COUNT(*) FROM slide_media')[0][0],0)

    def test_prompt_validation_before_queueing(self):
        result=self.php("""
        putenv('GEMINI_API_KEY=fake');$i=one("SELECT * FROM iterations WHERE id='iteration-shared'");$s=current_slide($i['id'],'slide-shared');$codes=[];
        foreach(['', '   ', [], str_repeat('a',2001),str_repeat('é',2001)] as $bad){try{transaction(fn()=>queue_slide_video($i,$s,['prompt'=>$bad]));$codes[]=0;}catch(RuntimeException $e){$codes[]=$e->getCode();}}
        echo json_encode($codes);
        """)
        self.assertEqual(json.loads(result),[400]*5)
        self.assertEqual(self.sql("SELECT COUNT(*) FROM jobs WHERE type='slide_video'")[0][0],0)
        self.assertEqual(self.php("echo mb_strlen(slide_motion_prompt(str_repeat('é',2000)),'UTF-8');"),'2000')

    def test_legacy_queued_movement_keeps_instructions(self):
        self.generate_candidate(legacy=True)
        candidate=self.deck()['slides'][0]['metadata']['motion_candidate']
        self.assertIn('right to left',candidate['prompt'])
        self.ok(self.motion(mode='ai',media_id=candidate['media_id'],prompt=candidate['prompt']))

    def test_google_errors_preserve_reason_and_redact_key(self):
        result=json.loads(self.php("""
        putenv('GEMINI_API_KEY=secret-test-key');
        echo json_encode([
            veo_error_message(429,json_encode(['error'=>['message'=>'Quota exceeded.'] ])),
            veo_error_message(403,json_encode(['error'=>['message'=>'Key secret-test-key denied.'] ])),
            veo_error_message(400,json_encode(['error'=>['message'=>'Unsupported parameter: example.'] ])),
            veo_error_message(503,'<html>private upstream response</html>'),
            veo_error_message(400,json_encode(['error'=>['message'=>['unexpected shape']]]))
        ]);
        """))
        self.assertIn('Quota exceeded.',result[0]);self.assertIn('billing',result[0])
        self.assertIn('[redacted]',result[1]);self.assertNotIn('secret-test-key',result[1])
        self.assertIn('Unsupported parameter: example.',result[2])
        self.assertIn('HTTP 503',result[3]);self.assertNotIn('private upstream',result[3])
        self.assertIn('Google rejected',result[4])

    def test_browser_fixture(self):
        self.ok(self.motion());self.upload();self.generate_candidate()
        if os.environ.get('MEDIA_BROWSER_EXPORT'):
            Path(os.environ['MEDIA_BROWSER_EXPORT']).write_text(json.dumps({'session':self.ok(self.editor.api('session')),'deck':self.deck()}))

if __name__=='__main__':unittest.main()
