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


def make_pdf(path):
    doc=fitz.open()
    page=doc.new_page(width=600,height=800)
    page.insert_text((40,55),'Project cover - a home by the water',fontsize=16)
    page=doc.new_page(width=600,height=800)
    page.insert_text((40,55),'Japandi moodboard: oak, linen and sage green',fontsize=16)
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
            self.assertEqual(len(result['pages'][1]['images']),2)
            for page in result['pages']:
                self.assertTrue(page['preview'])
                self.assertEqual(page['warnings'],[])
            self.assertIn('Natural oak and linen',result['pages'][2]['text'])
            self.assertTrue(any(b['source']=='ocr' for b in result['pages'][2]['text_blocks']))
            self.assertGreaterEqual(len(result['pages'][2]['images']),2)
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
            self.assertIn('#668055',[p['hex'] for p in native['pages'][0]['palette']])
            self.assertNotIn('#e03030',[p['hex'] for p in native['pages'][0]['palette']])
            rendered=extractor.extract(str(path),directory)
            self.assertEqual(rendered['warnings'],[])
            self.assertEqual(len(rendered['pages']),2)
            self.assertTrue(all(p['preview'] for p in rendered['pages']))
            self.assertIn('First:',rendered['pages'][0]['text'])
            self.assertIn('Second:',rendered['pages'][1]['text'])
            self.assertTrue(rendered['pages'][0]['images'])

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
