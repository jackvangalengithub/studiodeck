"""Image feedback uses ordinary threads, with version-scoped immutable coordinates."""
from test_security import SecurityFixture, Client
import json

class AnnotationTests(SecurityFixture):
    def post(self, who=None, expected=200, **extra):
        body=dict(iteration='iteration-shared',slide='visual-slide-shared',body='Could this be oak?',annotation=self.pin())
        body.update(extra)
        response=(who or self.client).api('comment',body)
        self.assertEqual(response[0],expected,response[1])
        return json.loads(response[1])

    def pin(self, **extra):
        return dict(x=.25,y=.75,source_version_id='file-shared',page_number=0,image_number=0,image_version_id='variant-shared',**extra)

    def test_persistence_replies_resolution_and_preview(self):
        root=self.post()['id']
        data=self.ok(self.editor.api('project',query={'id':'shared'}))
        comment=next(c for c in data['comments'] if c['id']==root)
        self.assertEqual(comment['annotation'],self.pin())
        self.assertTrue(comment['unread'])
        reply=self.post(self.editor,parent_id=root,annotation=None)['id']
        self.assertIsNone(self.sql('SELECT annotation FROM comments WHERE id=?',(reply,))[0][0])
        self.ok(self.client.api('comment_answered',dict(iteration='iteration-shared',id=root,answered=True)))
        self.assertEqual(self.sql('SELECT answered FROM comments WHERE id=?',(root,))[0][0],1)
        self.ok(self.editor.api('comment_answered',dict(iteration='iteration-shared',id=root,answered=False)))
        self.assertEqual(self.client.api('comment_preview',query={'id':root})[0],200)
        self.sql("UPDATE presentation_slides SET image_version_id=NULL WHERE id='slide-shared'")
        self.assertEqual(self.sql('SELECT annotation FROM comments WHERE id=?',(root,))[0][0],json.dumps(self.pin(),separators=(',',':')))
        self.assertEqual(self.client.api('comment_preview',query={'id':root})[0],200)
        self.assertTrue(self.sql('SELECT 1 FROM email_outbox WHERE comment_id=?',(root,)))

    def test_validation_and_access(self):
        for invalid in [-.01,1.01,'0.5',True,None,[],{}]:
            self.post(annotation={**self.pin(),'x':invalid},expected=400)
        for field,value in [('source_version_id','file-foreign'),('page_number',1),('image_number',1)]:
            self.post(annotation={**self.pin(),field:value},expected=409)
        self.post(annotation={**self.pin(),'image_version_id':'variant-foreign'},expected=404)
        self.post(slide='intro',expected=404)
        self.post(Client(self.base,'outsider'),expected=404)
        self.post(Client(self.base,'admin'),expected=404)
        response=self.client.api('comment',dict(iteration='iteration-shared',slide='visual-slide-shared',body='No CSRF',annotation=self.pin()),headers={'X-CSRF-Token':'bad'})
        self.assertEqual(response[0],403)
        self.sql("UPDATE shares SET revoked=1 WHERE id='client-share'")
        self.post(expected=404)

    def test_locked_iterations_originals_and_deleted_slides(self):
        self.sql("UPDATE iterations SET locked=1 WHERE id='iteration-shared'")
        root=self.post(annotation={**self.pin(),'x':0,'y':1,'image_version_id':''})['id']
        self.post(parent_id=root,expected=400)
        self.sql("INSERT INTO slide_layout(iteration_id,slide_id,hidden) VALUES('iteration-shared','visual-slide-shared',1)")
        self.post(expected=404)
        self.post(self.editor)
        self.sql("UPDATE slide_layout SET deleted=1")
        self.post(self.editor,expected=404)

if __name__=='__main__':
    import unittest
    unittest.main()
