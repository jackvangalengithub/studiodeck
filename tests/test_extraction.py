"""Real document fixtures: page order, crops, OCR, rotation and import limits."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extract_document',ROOT/'scripts/extract_document.py')
extractor=importlib.util.module_from_spec(spec);spec.loader.exec_module(extractor)


def png(color,size=(240,160)):
    image=Image.new('RGB',size,color);out=io.BytesIO();image.save(out,'PNG');return out.getvalue()


def make_pdf(path,mixed=False):
    doc=fitz.open()
    page=doc.new_page(width=600,height=800)
    page.insert_text((40,55),'Project cover - a home by the water',fontsize=16)
    page=doc.new_page(width=600,height=800)
    page.insert_text((40,55),'Japandi: Before photo / Concept rendering' if mixed else 'Japandi moodboard: oak, linen and sage green',fontsize=16)
    page.insert_image(fitz.Rect(40,110,280,270),stream=png('#668055'))
    page.insert_image(fitz.Rect(320,110,560,270),stream=png('#b87d59'))
    page=doc.new_page(width=600,height=800)
    scan=Image.new('RGB',(1200,1600),'white');draw=ImageDraw.Draw(scan)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',44)
    draw.text((80,100),'Natural oak and linen',font=font,fill='black')
    draw.rectangle((80,300,550,700),fill='#668055');draw.rectangle((650,300,1120,700),fill='#b87d59')
    out=io.BytesIO();scan.save(out,'PNG');page.insert_image(page.rect,stream=out.getvalue())
    page=doc.new_page(width=600,height=800)
    page.insert_text((50,60),'Rotated material study',fontsize=16)
    page.insert_image(fitz.Rect(50,120,290,280),stream=png('#526d8a'));page.set_rotation(90)
    doc.save(path);doc.close()


def make_pptx(path):
    # Order deliberately differs from slide filenames and ZIP insertion order.
    with zipfile.ZipFile(path,'w') as z:
        z.writestr('[Content_Types].xml','''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>''')
        z.writestr('_rels/.rels','''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>''')
        z.writestr('ppt/presentation.xml','''<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="257" r:id="rId2"/><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>''')
        z.writestr('ppt/_rels/presentation.xml.rels','''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>''')
        for n,text in [(1,'Second: terracotta study'),(2,'First: Japandi sage moodboard')]:
            z.writestr(f'ppt/slides/slide{n}.xml',f'''<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="400000" y="300000"/><a:ext cx="8000000" cy="800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>{text}</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Material"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:srcRect l="50000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="4000000" cy="3000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>''')
            z.writestr(f'ppt/slides/_rels/slide{n}.xml.rels',f'''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image{n}.png"/></Relationships>''')
            im=Image.new('RGB',(400,200),'#e03030');ImageDraw.Draw(im).rectangle((200,0,400,200),fill='#668055' if n==2 else '#b87d59')
            out=io.BytesIO();im.save(out,'PNG');z.writestr(f'ppt/media/image{n}.png',out.getvalue())


class DocumentTests(unittest.TestCase):
    def test_pdf_pages_images_ocr_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.pdf';make_pdf(path)
            result=extractor.extract(str(path),directory)
            self.assertEqual(result['page_count'],4)
            self.assertEqual([p['number'] for p in result['pages']],[1,2,3,4])
            self.assertIn('Japandi',result['pages'][1]['text'])
            self.assertEqual(len(result['pages'][1]['images']),1)
            self.assertEqual(result['pages'][1]['images'][0]['classification']['type'],'moodboard')
            for page in result['pages']:
                self.assertTrue(page['preview'])
                self.assertFalse(any('incomplete' in w for w in page['warnings']))
            self.assertIn('Natural oak and linen',result['pages'][2]['text'])
            self.assertTrue(any(b['source']=='ocr' for b in result['pages'][2]['text_blocks']))
            self.assertEqual(len(result['pages'][2]['images']),1)
            self.assertEqual(len(result['pages'][3]['images']),1)
            self.assertIn('#668055',[p['hex'] for p in result['pages'][1]['palette']])
            self.assertNotIn('#ffffff',[p['hex'] for p in result['pages'][1]['palette']])
            rect=result['pages'][3]['images'][0]['bbox'];self.assertTrue(all(0<=n<=1 for n in rect))

    def test_pptx_order_cropping_and_rendering(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.pptx';make_pptx(path)
            native=extractor.native_pptx(path,extractor.Output(directory))
            self.assertIn('First:',native['pages'][0]['text'])
            self.assertIn('Second:',native['pages'][1]['text'])
            self.assertTrue(any(max(abs(int(c['hex'][i:i+2],16)-int('#668055'[i:i+2],16)) for i in (1,3,5))<=2 for c in native['pages'][0]['palette']))
            self.assertNotIn('#e03030',[p['hex'] for p in native['pages'][0]['palette']])
            rendered=extractor.extract(str(path),directory)
            self.assertEqual(rendered['warnings'],[])
            self.assertEqual(len(rendered['pages']),2)
            self.assertTrue(all(p['preview'] for p in rendered['pages']))
            self.assertIn('First:',rendered['pages'][0]['text'])
            self.assertIn('Second:',rendered['pages'][1]['text'])
            self.assertTrue(rendered['pages'][0]['images'])

    def test_tight_photos_exclude_captions_and_margins(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'captioned.pdf';doc=fitz.open()
            for color in ['#60774f','#676767']:
                page=doc.new_page(width=600,height=800)
                scan=Image.new('RGB',(1200,1600),'white');draw=ImageDraw.Draw(scan)
                font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',36)
                draw.text((100,90),'Existing living room',font=font,fill='black')
                draw.rectangle((120,300,1079,939),fill=color)
                draw.text((120,990),'Photo caption must stay outside the crop',font=font,fill='black')
                raw=io.BytesIO();scan.save(raw,'PNG');page.insert_image(page.rect,stream=raw.getvalue())
            doc.save(path);doc.close()
            inventory=extractor.extract(str(path),directory,inventory=True)
            self.assertTrue(all(not p['images'] for p in inventory['pages']))
            plans={str(p['number']):{'content_type':'photo','strategy':'preserve','confidence':'high',
                   'regions':[{'role':'photo','bbox':[.1,.1875,.9,.5875],'candidate_ids':[p['candidates'][0]['id']]}]} for p in inventory['pages']}
            result=extractor.materialize_pages(inventory,extractor.Output(directory),plans)
            for p in result['pages']:

                self.assertEqual(len(p['images']),1)
                b=p['images'][0]['bbox']
                for actual,expected in zip(b,[.1,.1875,.9,.5875]):self.assertAlmostEqual(actual,expected,delta=.012)
                image=Image.open(Path(directory)/p['images'][0]['file']).convert('RGB')
                self.assertAlmostEqual(image.width/image.height,1.5,delta=.06)
                paper=sum(min(pixel)>235 for pixel in image.getdata())/(image.width*image.height)
                self.assertLess(paper,.025)
                self.assertIn('caption',p['text'].lower())

    def test_page_first_compositions_logos_and_whole_photos(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'compositions.pdf';doc=fitz.open()
            logo=png('#151515',(180,25))
            photo=Image.new('RGB',(600,300),'#b87d59');draw=ImageDraw.Draw(photo)
            # A white wall/divider is inside one photo, never a crop gutter.
            draw.rectangle((240,0,340,299),fill='white');draw.rectangle((341,0,599,299),fill='#668055')
            buffer=io.BytesIO();photo.save(buffer,'PNG')
            for n in range(5):
                page=doc.new_page(width=600,height=800)
                page.insert_text((35,45),'Moodboard' if n==0 else 'Before and concept' if n==3 else 'Project study',fontsize=16)
                if n==0:
                    for rect,color in [(fitz.Rect(40,100,240,260),'#668055'),(fitz.Rect(280,100,550,330),'#b87d59'),(fitz.Rect(60,300,220,460),'#526d8a')]:page.insert_image(rect,stream=png(color),keep_proportion=False)
                elif n in (1,2):page.insert_image(fitz.Rect(40,100,560,360),stream=buffer.getvalue())
                elif n==3:
                    page.insert_image(fitz.Rect(40,100,280,260),stream=png('#668055'))
                    page.insert_image(fitz.Rect(320,100,560,260),stream=png('#b87d59'))
                page.insert_image(fitz.Rect(440,755,570,780),stream=logo,keep_proportion=False)
            doc.save(path);doc.close()
            inventory=extractor.extract(str(path),directory,inventory=True)
            self.assertTrue(all(not p['images'] for p in inventory['pages']))
            self.assertTrue(all(any(c['likely_branding'] for c in p['candidates']) for p in inventory['pages']))
            plans={
                '1':{'content_type':'collage','strategy':'separate','confidence':'high','regions':[{'role':'photo','bbox':[.07,.13,.39,.32]}]},
                '2':{'content_type':'photo','strategy':'separate','confidence':'high','regions':[{'role':'photo','bbox':[.1,.15,.3,.4]},{'role':'photo','bbox':[.65,.15,.88,.4]}]},
                '4':{'content_type':'mixed','strategy':'separate','confidence':'high','regions':[{'role':'photo','bbox':[.07,.13,.46,.32],'situation':'before'},{'role':'render','bbox':[.54,.13,.93,.32],'situation':'concept'}]}}
            result=extractor.materialize_pages(inventory,extractor.Output(directory),plans)
            self.assertEqual([len(p['images']) for p in result['pages']],[1,1,1,2,0])
            board=result['pages'][0]['images'][0]
            self.assertEqual(board['classification']['type'],'moodboard')
            for a,b in zip(board['bbox'],[40/600,100/800,550/600,460/800]):self.assertAlmostEqual(a,b,delta=.001)
            for p in result['pages'][1:3]:
                image=p['images'][0]
                for a,b in zip(image['bbox'],[40/600,100/800,560/600,360/800]):self.assertAlmostEqual(a,b,delta=.001)
                self.assertTrue(image['bbox'][3]<.9)
                im=Image.open(Path(directory)/image['file'])
                self.assertAlmostEqual(im.width/im.height,2,delta=.02)
            self.assertFalse(result['pages'][4]['include_in_presentation'])
            self.assertEqual(result['pages'][3]['images'][0]['classification']['situation'],'before')
            self.assertEqual(result['pages'][3]['images'][1]['classification']['type'],'render')

    def test_invalid_and_fragmented_plans_preserve_source(self):
        page={'text':'','candidates':[{'id':'p1-i1','bbox':[0,0,1,1],'area_ratio':1,'likely_branding':False}]}
        bad={'content_type':'mixed','strategy':'separate','confidence':'high','regions':[{'role':'photo','bbox':[0,.1,.1,.2]},{'role':'photo','bbox':[.8,.1,.9,.2]}]}
        plan=extractor.resolve_page_plan(page,bad)
        self.assertEqual(plan['strategy'],'preserve')
        self.assertEqual(len(plan['regions']),1)
        self.assertEqual(plan['regions'][0]['bbox'],[0,0,1,1])
        bad['regions']=[{'role':'photo','bbox':[-1,0,2,1]}]
        self.assertEqual(extractor.resolve_page_plan(page,bad)['regions'][0]['bbox'],[0,0,1,1])
        self.assertEqual(extractor.resolve_page_plan(page,{'confidence':'low'})['source'],'geometry')
        # A small logo inside a scanned page cannot make its complete photo disappear.
        p={'content_type':'photo','strategy':'preserve','confidence':'high','regions':[{'role':'logo','candidate_ids':['p1-i1'],'bbox':[.8,.9,1,1]},{'role':'photo','bbox':[.1,.1,.9,.8]}]}
        self.assertEqual(len(extractor.resolve_page_plan(page,p)['regions']),1)

    def test_board_bounds_ignore_hidden_pdf_overscan(self):
        # Native placements can extend behind a white mask into the footer.
        page={'text':'','candidates':[{'id':'a','bbox':[.02,.07,.23,.91],'area_ratio':.1764}, {'id':'b','bbox':[.25,.07,.98,.86],'area_ratio':.5767}]}
        proposal={'content_type':'moodboard','strategy':'preserve','confidence':'high','regions':[{'role':'moodboard','candidate_ids':['a','b'],'bbox':[.02,.07,.98,.86]}]}
        result=extractor.resolve_page_plan(page,proposal)
        self.assertEqual(result['regions'][0]['bbox'],[.02,.07,.98,.86])
        self.assertEqual(len(result['regions']),1)

    def test_later_pages_and_reported_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.pdf';doc=fitz.open()
            for n in range(122):
                page=doc.new_page(width=300,height=200)
                page.insert_text((20,50),f'Page {n+1}: material specification and design notes for the project',fontsize=7)
            doc.save(path);doc.close()
            result=extractor.extract(str(path),directory)
            self.assertEqual(result['page_count'],122)
            self.assertEqual(len(result['pages']),120)
            self.assertIn('Page 120',result['pages'][-1]['text'])
            self.assertIn('first 120 of 122',result['warnings'][0])

if __name__=='__main__':unittest.main(buffer=True)
