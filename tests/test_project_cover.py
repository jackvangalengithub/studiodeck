"""Persistent cover selection, authorization, fallback and iteration copying."""
import unittest
from test_security import SecurityFixture

class ProjectCoverTests(SecurityFixture):
    def add_cover(self):
        self.sql("INSERT INTO presentation_slides(id,iteration_id,source_version_id,page_number,image_number,type,title,position) VALUES('chosen','iteration-own','file-own',1,1,'photo','Chosen cover',1)")

    def select(self, slide='chosen', iteration='iteration-own', actor=None):
        return (actor or self.editor).api('set_project_cover', {'iteration':iteration,'slide_id':slide})

    def test_cover_persists_in_detail_tile_and_new_iteration(self):
        self.add_cover()
        before=self.ok(self.editor.api('project',query={'id':'own'}))['cover_slide_id']
        self.ok(self.select())
        self.assertNotEqual(before,'chosen')
        self.assertEqual(self.ok(self.editor.api('project',query={'id':'own'}))['cover_slide_id'],'chosen')
        tile=next(p for p in self.ok(self.editor.api('projects'))['projects'] if p['id']=='own')
        self.assertIn(':chosen:',tile['cover_key'])
        image=self.editor.api('project_cover',query={'project_id':'own'})
        self.assertEqual(image[0],200)
        self.assertTrue(image[1].startswith(b'\xff\xd8'))
        self.ok(self.editor.api('new_iteration',{'iteration':'iteration-own'}),201)
        latest=self.ok(self.editor.api('project',query={'id':'own'}))
        self.assertEqual(latest['cover_slide_id'],'chosen')
        self.assertNotEqual(latest['iteration']['id'],'iteration-own')
        self.assertEqual(len(self.sql('SELECT * FROM iteration_covers')),2)

    def test_rejects_other_project_non_images_and_unauthorized_changes(self):
        self.add_cover()
        self.ok(self.select())
        self.assertEqual(self.select('slide-foreign')[0],400)
        self.assertEqual(self.select('missing')[0],400)
        for actor in (self.anon,self.client,self.admin):
            self.denied(self.select(actor=actor))
        self.denied(self.select(iteration='iteration-foreign',slide='slide-foreign'))
        self.denied(self.editor.api('set_project_cover',{'iteration':'iteration-own','slide_id':'chosen'},headers={'X-CSRF-Token':''}))
        self.sql("UPDATE presentation_slides SET type='video' WHERE iteration_id='iteration-own' AND id='chosen'")
        self.assertEqual(self.select()[0],400)
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-own'")
        self.assertEqual(self.select('slide-own')[0],409)

    def test_deleted_cover_falls_back_and_project_deletion_cleans_selection(self):
        self.add_cover();self.ok(self.select())
        self.sql("DELETE FROM presentation_slides WHERE iteration_id='iteration-own' AND id='chosen'")
        self.assertEqual(self.ok(self.editor.api('project',query={'id':'own'}))['cover_slide_id'],'slide-own')
        self.add_cover();self.ok(self.select())
        self.sql("INSERT OR IGNORE INTO project_members(project_id,user_id) VALUES('own','admin')")
        name=self.ok(self.admin.api('project',query={'id':'own'}))['project']['name']
        confirmation=self.ok(self.admin.api('prepare_delete_project',{'project_id':'own'}))['confirmation']
        self.ok(self.admin.api('delete_project',{'project_id':'own','name':name,'confirmation':confirmation,'acknowledged':True}))
        self.assertEqual(self.sql('SELECT * FROM iteration_covers'),[])

if __name__=='__main__':unittest.main()
