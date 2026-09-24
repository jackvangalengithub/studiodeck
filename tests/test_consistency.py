"""Source authority, grounded visual comparisons and designer access. No paid calls."""
import json
import os
import shutil
import subprocess
import unittest
from test_security import Client, SecurityFixture, PHP, DENIED, ROOT


class ConsistencyTests(SecurityFixture):
    def seed(self):
        super().seed()
        self.sql('UPDATE presentation_slides SET image_version_id=NULL,page_number=0,image_number=0 WHERE iteration_id=?', ('iteration-shared',))
        self.sql('DELETE FROM document_pages WHERE version_id=?', ('file-shared',))
        self.sql('UPDATE file_versions SET extracted_text=? WHERE id=?', ('Main bathroom toilet bowl: red.', 'file-shared'))

    def setUp(self):
        super().setUp()
        (self.tmp / 'scripts').mkdir()
        shutil.copy(ROOT / 'scripts/check_page_preview.py', self.tmp / 'scripts/check_page_preview.py')

    def php(self, code):
        r = subprocess.run([PHP, '-r', "require 'app/ai.php'; " + code], cwd=self.tmp, env=self.env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        return r.stdout

    def deck(self, actor=None):
        return self.ok((actor or self.editor).api('deck', query={'iteration': 'iteration-shared'}))

    def generate(self, role='detailed_design', verdict='conflict', identity='high', colour='green', extra_fact=None, mutate=False):
        facts = [dict(object='toilet bowl', room='Main bathroom', identifier='WC-01', property='colour', value='red', basis='text', quote='Main bathroom toilet bowl: red.', role='specification', confidence='high'),
                 dict(object='toilet bowl', room='Main bathroom', identifier='WC-01', property='colour', value=colour, basis='visual', bbox=[.1, .2, .6, .8], role=role, confidence='high')]
        if extra_fact:
            facts.append(extra_fact)
        fixture = dict(role='specification', reason='Detailed bathroom selection.', facts=facts)
        (self.tmp / 'check-extraction.json').write_text(json.dumps(fixture))
        # Clear only extraction cache to exercise varied model evidence in each scenario.
        self.sql('DELETE FROM check_source_cache WHERE iteration_id=?', ('iteration-shared',))
        code = """
        $calls=[];
        run_consistency_checks('iteration-shared',function($prompt,$content)use(&$calls){
            $calls[]=$prompt;
            if(str_starts_with($prompt,'Extract checkable'))return json_decode(file_get_contents('check-extraction.json'),true);
            if(str_starts_with($prompt,'Find potentially')){
                $facts=json_decode($content[0]['text'],true);
                return ['pairs'=>[['a'=>$facts[1]['id'],'b'=>$facts[0]['id']]]];
            }
            if(count(array_filter($content,fn($c)=>$c['type']==='image_url'))<1)throw new Exception('Verification did not receive actual image');
            MUTATION
            return ['verdict'=>VERDICT,'identity'=>IDENTITY,'title'=>'Toilet colour differs','explanation'=>'The specification requires red; the detailed image appears green.'];
        });echo json_encode(['calls'=>count($calls)]);
        """.replace('VERDICT', json.dumps(verdict)).replace('IDENTITY', json.dumps(identity)).replace('MUTATION', "query(\"UPDATE presentation_slides SET situation='before' WHERE iteration_id='iteration-shared'\");" if mutate else '')
        if mutate:
            code = "try{" + code + "}catch(RuntimeException $e){echo $e->getMessage();}"
        return self.php(code)

    def test_same_page_text_and_image_conflict_has_two_grounded_sources(self):
        self.generate()
        checks = self.deck()['checks']
        self.assertFalse(checks['run']['stale'])
        self.assertEqual(checks['run']['warnings'], [])
        finding = checks['findings'][0]
        self.assertEqual(finding['severity'], 'mismatch')
        self.assertEqual({e['basis'] for e in finding['evidence']}, {'text', 'visual'})
        self.assertEqual(finding['evidence'][1]['bbox'], [.1, .2, .6, .8])
        self.assertNotIn('checks', self.deck(self.client))
        self.assertEqual(self.editor.api('check_image', query={'iteration':'iteration-shared','source_key':'file-shared:p:0'})[0], 200)
        if os.environ.get('CONSISTENCY_BROWSER_EXPORT'):
            from pathlib import Path
            Path(os.environ['CONSISTENCY_BROWSER_EXPORT']).write_text(json.dumps({'session':self.ok(self.editor.api('session')),'deck':self.deck(),'projects':self.ok(self.editor.api('projects'))}))

    def test_inspiration_before_and_alternative_do_not_warn(self):
        for role in ('inspiration', 'before', 'alternative'):
            with self.subTest(role=role):
                self.generate(role=role)
                self.assertEqual(self.deck()['checks']['findings'], [])

    def test_room_mismatch_and_equal_colours_do_not_warn(self):
        self.generate(identity='different')
        self.assertEqual(self.deck()['checks']['findings'], [])
        self.generate(colour='red')
        self.assertEqual(self.deck()['checks']['findings'], [])
        self.generate(verdict='consistent')
        self.assertEqual(self.deck()['checks']['findings'], [])

    def test_uncertain_identity_does_not_suggest_and_unreadable_is_partial(self):
        self.generate(identity='uncertain')
        self.assertEqual(self.deck()['checks']['findings'], [])
        self.generate()
        self.generate(verdict='unverifiable')
        checks = self.deck()['checks']
        self.assertTrue(checks['run']['warnings'])
        self.assertTrue(checks['findings'][0]['stale'])

    def test_financial_and_scope_facts_require_explicit_text(self):
        result=json.loads(self.php("""
        $facts=[];foreach(['price','scope','inclusion'] as $property){
            $facts[]=['object'=>'Kitchen installation','property'=>$property,'value'=>'Included','basis'=>'text','quote'=>'Installation included for EUR 500 including VAT.','confidence'=>'high'];
            $facts[]=['object'=>'Kitchen installation','property'=>$property,'value'=>'Excluded','basis'=>'visual','bbox'=>[0,0,1,1],'confidence'=>'high'];
        }
        echo json_encode(consistency_extract(['role'=>'specification','facts'=>$facts],['text'=>'Installation included for EUR 500 including VAT.','has_image'=>true]));
        """))
        self.assertEqual({f['property'] for f in result['facts']},{'price','scope','inclusion'})
        self.assertTrue(all(f['basis']=='text' for f in result['facts']))
        self.assertTrue(result['incomplete'])

    def test_fake_quotes_and_visual_dimensions_are_rejected(self):
        bad = dict(object='toilet', property='dimension', value='50cm', basis='visual', bbox=[0,0,1,1], role='specification')
        self.generate(extra_fact=bad)
        self.assertTrue(self.deck()['checks']['run']['warnings'])
        code = """$s=['text'=>'A specification','has_image'=>true];$r=consistency_extract(['role'=>'approved_specification','facts'=>[['object'=>'toilet','property'=>'colour','value'=>'red','basis'=>'text','quote'=>'Invented evidence']]],$s);echo json_encode($r);"""
        result=json.loads(self.php(code))
        self.assertEqual(result['facts'], [])
        self.assertEqual(result['role'], 'specification')
        self.assertTrue(result['incomplete'])

    def test_role_overrides_keep_inspiration_and_before_low_priority(self):
        self.ok(self.editor.api('check_source_role', dict(iteration='iteration-shared', source_key='file-shared:file', role='approved_specification')))
        self.generate(role='inspiration')
        self.assertEqual(self.deck()['checks']['findings'], [])
        self.ok(self.editor.api('check_source_role', dict(iteration='iteration-shared', source_key='file-shared:p:0', role='inspiration')))
        self.generate()
        self.assertEqual(self.deck()['checks']['findings'], [])
        self.assertEqual(self.deck()['checks']['sources'][0]['role'], 'inspiration')
        self.ok(self.editor.api('check_source_role', dict(iteration='iteration-shared', source_key='file-shared:p:0', role='')))
        self.generate()
        self.assertEqual(len(self.deck()['checks']['findings']), 1)

    def test_review_and_question_are_idempotent_private_and_stale_on_change(self):
        self.generate()
        finding=self.deck()['checks']['findings'][0]
        body=dict(iteration='iteration-shared',id=finding['id'])
        q=self.ok(self.editor.api('review_consistency_finding',dict(**body,operation='question')))['question_id']
        self.assertEqual(self.ok(self.editor.api('review_consistency_finding',dict(**body,operation='question')))['question_id'],q)
        self.assertEqual(self.deck(self.client)['open_questions'],[])
        self.assertEqual(self.deck()['open_questions'][0]['accepted'],1)
        self.ok(self.editor.api('review_consistency_finding',dict(**body,operation='resolved')))
        self.generate()
        self.assertEqual(self.deck()['checks']['findings'][0]['status'],'resolved')
        self.sql("UPDATE presentation_slides SET situation='before' WHERE iteration_id='iteration-shared'")
        self.assertTrue(self.deck()['checks']['run']['stale'])
        self.assertTrue(self.deck()['checks']['findings'][0]['stale'])
        self.assertEqual(self.editor.api('review_consistency_finding',dict(**body,operation='question'))[0],409)

    def test_role_and_image_access_are_scoped_and_locked_writes_rejected(self):
        for actor in (self.client, Client(self.base,'outsider'), self.anon):
            self.assertIn(actor.api('check_source_role',dict(iteration='iteration-shared',source_key='file-shared:p:0',role='before'))[0],DENIED)
            self.assertIn(actor.api('check_image',query={'iteration':'iteration-shared','source_key':'file-shared:p:0'})[0],DENIED)
        self.assertEqual(self.editor.api('check_source_role',dict(iteration='iteration-shared',source_key='file-foreign:p:0',role='before'))[0],404)
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        for action in ('check_source_role','review_consistency_finding','run_consistency_checks'):
            self.assertEqual(self.editor.api(action,dict(iteration='iteration-shared'))[0],409)

    def test_concurrent_change_prevents_saving_findings(self):
        self.assertIn('project changed',self.generate(mutate=True))
        self.assertEqual(self.sql('SELECT COUNT(*) FROM consistency_runs'),[(0,)])

    def test_pdf_specification_preview_is_rendered_without_changing_extraction(self):
        subprocess.run(['python3','-c', "import fitz; d=fitz.open(); p=d.new_page(); p.insert_text((40,40),'Toilet: red'); p.draw_rect(fitz.Rect(40,80,120,140),color=(0,1,0),fill=(0,1,0)); d.save('spec.pdf')"],cwd=self.tmp,check=True)
        blob=(self.tmp/'spec.pdf').read_bytes()
        self.sql("UPDATE file_versions SET mime='application/pdf',name='spec.pdf',data=? WHERE id='file-shared'",(blob,))
        self.sql("INSERT INTO document_pages(version_id,number,text,metadata) VALUES('file-shared',1,'Toilet: red','{}')")
        self.sql("DELETE FROM presentation_slides WHERE iteration_id='iteration-shared'")
        checks=self.deck()['checks']
        self.assertTrue(checks['sources'][0]['has_image'])
        status,image,headers=self.editor.api('check_image',query=dict(iteration='iteration-shared',source_key='file-shared:p:1'))
        self.assertEqual(status,200,image[:200])
        self.assertTrue(image.startswith(b'\x89PNG'))
        self.assertEqual(self.sql("SELECT preview FROM document_pages WHERE version_id='file-shared'"),[(None,)])
        self.assertEqual(self.sql("SELECT count(*) FROM check_page_previews"),[(1,)])

    def test_cross_document_specification_and_completed_photo(self):
        self.sql("INSERT INTO assets(id,project_id,category,created_at) VALUES('spec-asset','shared','legal','2026-01-01')")
        self.sql("INSERT INTO file_versions(id,asset_id,number,name,mime,size,sha256,data,extracted_text,created_at) VALUES('spec-source','spec-asset',1,'Bathroom specification.csv','text/csv',30,'fixture','text','Main bathroom toilet bowl: red.','2026-01-01')")
        self.sql("INSERT INTO iteration_files VALUES('iteration-shared','spec-asset','spec-source','legal')")
        self.php("""
        run_consistency_checks('iteration-shared',function($prompt,$content){
            if(str_starts_with($prompt,'Extract checkable')){
                $source=json_decode($content[0]['text'],true);$spec=$source['version_id']==='spec-source';
                return ['role'=>$spec?'specification':'completed','facts'=>[['object'=>'toilet bowl','room'=>'Main bathroom','identifier'=>'WC-01','property'=>'colour','value'=>$spec?'red':'green','basis'=>$spec?'text':'visual','quote'=>$spec?'Main bathroom toilet bowl: red.':'','bbox'=>[.1,.2,.6,.8],'role'=>$spec?'specification':'completed','confidence'=>'high']]];
            }
            if(str_starts_with($prompt,'Find potentially')){$f=json_decode($content[0]['text'],true);return ['pairs'=>[['a'=>$f[0]['id'],'b'=>$f[1]['id']]]];}
            return ['verdict'=>'conflict','identity'=>'high','title'=>'Installed toilet differs','explanation'=>'Written red specification versus completed photo appearing green.'];
        });
        """)
        finding=self.deck()['checks']['findings'][0]
        self.assertEqual(finding['severity'],'mismatch')
        self.assertEqual({e['version_id'] for e in finding['evidence']},{'file-shared','spec-source'})

    def test_uploaded_image_annotation_ocr_is_grounded_and_cached(self):
        subprocess.run(['python3','-c', "from PIL import Image,ImageDraw,ImageFont; im=Image.new('RGB',(1200,400),'white'); d=ImageDraw.Draw(im); d.text((40,70),'TOILET COLOUR RED',font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',52),fill='black'); im.save('annotated.png')"],cwd=self.tmp,check=True)
        self.sql("UPDATE file_versions SET extracted_text='',data=? WHERE id='file-shared'",((self.tmp/'annotated.png').read_bytes(),))
        result=json.loads(self.php("$s=consistency_context('iteration-shared')['sources']['file-shared:p:0'];$w=[];$s=consistency_image_annotations('iteration-shared',$s,$w);echo json_encode([$s['text'],$w]);"))
        self.assertIn('TOILET COLOUR RED',result[0])
        self.assertEqual(result[1],[])
        self.assertEqual(self.sql('SELECT count(*) FROM check_image_text'),[(1,)])

    def test_deletion_cascades_check_records_and_preserves_other_projects(self):
        self.generate()
        self.ok(self.editor.api('check_source_role',dict(iteration='iteration-shared',source_key='file-shared:p:0',role='specification')))
        self.php("require_once 'app/project_delete.php';transaction(fn()=>delete_project_records('shared'));")
        for table in ('consistency_findings','consistency_runs','check_source_cache','check_source_roles'):
            self.assertEqual(self.sql('SELECT count(*) FROM '+table),[(0,)])
        self.assertEqual(self.sql("SELECT count(*) FROM projects WHERE id='own'"),[(1,)])

    def test_queue_deduplication_and_no_key_behavior(self):
        self.assertEqual(self.editor.api('run_consistency_checks',dict(iteration='iteration-shared'))[0],409)
        result=self.php("putenv('OPENAI_API_KEY=fake-test-key');transaction(function(){queue_consistency_checks('iteration-shared');queue_consistency_checks('iteration-shared');});echo one(\"SELECT COUNT(*) n FROM jobs WHERE type='consistency'\")['n'];")
        self.assertEqual(result,'1')


if __name__ == '__main__':
    unittest.main()
