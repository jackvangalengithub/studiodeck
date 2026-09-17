"""Page extraction worker. All output stays in the caller's private temporary directory."""
import csv
import io
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

import fitz
from PIL import Image

Image.MAX_IMAGE_PIXELS = 40_000_000
MAX_PAGES = 120
MAX_IMAGES = 40
MAX_BYTES = 60 * 1024 * 1024
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def sampled_palette(images):
    """Quantize actual pixels, balancing images equally and merging near duplicates."""
    pixels = []
    for image in images:
        small = image.convert('RGBA')
        small.thumbnail((100, 100))
        pixels.extend((r, g, b) for r, g, b, a in small.getdata()
                      if a > 128 and not (min(r, g, b) > 246 or max(r, g, b) < 9))
    if not pixels:
        return []
    strip = Image.new('RGB', (len(pixels), 1))
    strip.putdata(pixels)
    quant = strip.quantize(colors=12)
    palette = quant.getpalette()
    buckets = []
    for count, index in sorted(quant.getcolors(), reverse=True):
        rgb = palette[index * 3:index * 3 + 3]
        if any(sum((a-b)**2 for a, b in zip(rgb, old['rgb'])) < 32**2 for old in buckets):
            continue
        buckets.append({'rgb': rgb, 'hex': '#%02x%02x%02x' % tuple(rgb),
                        'weight': round(count / len(pixels), 4)})
    return [{'hex': b['hex'], 'weight': b['weight']} for b in buckets[:5]]


class Output:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.size = 0

    def image(self, im, name, edge=1500):
        im = im.convert('RGB')
        im.thumbnail((edge, edge))
        data = io.BytesIO()
        im.save(data, 'JPEG', quality=86)
        self.size += len(data.getvalue())
        if self.size > MAX_BYTES:
            raise RuntimeError('Extracted images reached the 60 MB limit. Split this document into smaller files.')
        (self.directory / name).write_bytes(data.getvalue())
        return name


def pix_image(page, rect=None, edge=1600):
    rect = rect or page.rect
    scale = min(3, edge / max(rect.width, rect.height))
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False, colorspace=fitz.csRGB)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)


def box(rect, width, height):
    return [round(max(0, min(1, v)), 5) for v in
            (rect[0]/width, rect[1]/height, rect[2]/width, rect[3]/height)]


def ocr(image, directory, number):
    path = Path(directory) / ('ocr-%d.png' % number)
    image.save(path)
    try:
        result = subprocess.run(['tesseract', str(path), 'stdout', '-l', os.environ.get('OCR_LANGUAGES', 'eng+nld'),
                                 '--psm', '11', 'tsv'], capture_output=True, text=True, timeout=45, check=True)
        lines = defaultdict(list)
        for word in csv.DictReader(io.StringIO(result.stdout), delimiter='\t', quoting=csv.QUOTE_NONE):
            if not word.get('text', '').strip() or float(word.get('conf', '-1')) < 25:
                continue
            lines[(word['block_num'], word['par_num'], word['line_num'])].append(word)
        blocks = []
        for words in lines.values():
            x0 = min(int(w['left']) for w in words)
            y0 = min(int(w['top']) for w in words)
            x1 = max(int(w['left']) + int(w['width']) for w in words)
            y1 = max(int(w['top']) + int(w['height']) for w in words)
            blocks.append({'text': ' '.join(w['text'] for w in words),
                           'bbox': box((x0, y0, x1, y1), image.width, image.height), 'source': 'ocr'})
        return blocks
    finally:
        path.unlink(missing_ok=True)


def rect_area(b):
    return max(0,b[2]-b[0])*max(0,b[3]-b[1])


def overlap(a,b):
    return rect_area([max(a[0],b[0]),max(a[1],b[1]),min(a[2],b[2]),min(a[3],b[3])])


def union_bounds(regions):
    return [min(b[0] for b in regions),min(b[1] for b in regions),max(b[2] for b in regions),max(b[3] for b in regions)]


def safe_bounds(value):
    if not isinstance(value,list) or len(value)!=4 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not 0<=v<=1 for v in value):
        return None
    return value if value[2]-value[0]>=.01 and value[3]-value[1]>=.01 else None


def mark_repeated_graphics(pages):
    occurrences=defaultdict(list)
    for page in pages:
        for c in page.get('candidates',[]):
            if c.get('digest'):
                occurrences[c['digest']].append((page['number'],c))
    for page in pages:
        for c in page.get('candidates',[]):
            matches=occurrences[c.get('digest')]
            c['repeated_pages']=len({number for number,other in matches if max(abs(a-b) for a,b in zip(c['bbox'],other['bbox']))<.025})
            b=c['bbox'];c['at_page_edge']=b[1]<.10 or b[3]>.90 or b[0]<.04 or b[2]>.96
            # Size alone is never a reason to reject a material swatch.
            c['likely_branding']=c['repeated_pages']>=2 and c['area_ratio']<.035 and c['at_page_edge']


def fallback_page_plan(page):
    usable=[c for c in page.get('candidates',[]) if not c.get('likely_branding')]
    text=page.get('text','').lower()
    board=bool(re.search(r'\b(moodboard|mood board|collage|material board|material palette|sfeerbord|materialenbord)\b',text))
    excluded=[{'candidate_id':c['id'],'reason':'Repeated small graphic at the same page edge; likely branding.'} for c in page.get('candidates',[]) if c.get('likely_branding')]
    if not usable:
        return {'content_type':'text' if text.strip() else 'unknown','strategy':'none','confidence':'low','regions':[], 'excluded':excluded,
                'reason':'No independent content images found. The complete page remains available in Files.','source':'geometry'}
    comparison=bool(re.search(r'\b(before|existing|bestaand)\b',text) and re.search(r'\b(after|concept|proposed|voorstel)\b',text))
    independent=2<=len(usable)<=4 and all(.045<=c['area_ratio']<.85 for c in usable) and not any(overlap(a['bbox'],b['bbox'])>.001 for n,a in enumerate(usable) for b in usable[n+1:])
    if not board and comparison and independent:
        return {'content_type':'mixed','strategy':'separate','confidence':'low',
                'regions':[{'bbox':c['bbox'],'type':'other','situation':'unknown','title':'Comparison image','candidate_ids':[c['id']]} for c in usable],
                'excluded':excluded,'reason':'Explicit comparison labels and non-overlapping native pictures support separate complete images.','source':'geometry'}
    b=union_bounds([c['bbox'] for c in usable])
    return {'content_type':'moodboard' if board else 'unknown','strategy':'preserve','confidence':'low',
            'regions':[{'bbox':b,'type':'moodboard' if board else 'other','situation':'unknown','title':'Mood & materials' if board else 'Page visual','candidate_ids':[c['id'] for c in usable]}],
            'excluded':excluded,'reason':'Keep the composition intact until visual evidence supports separate images.','source':'geometry'}


def compact_exclusions(exclusions,candidates):
    result=[]
    for entry in exclusions:
        bounds=entry.get('bbox') or candidates.get(entry.get('candidate_id'),{}).get('bbox')
        if not bounds:continue
        target=next((old for old in result if overlap(old['bbox'],bounds)/max(.00001,min(rect_area(old['bbox']),rect_area(bounds)))>.4),None)
        if target:target['bbox']=union_bounds([target['bbox'],bounds])
        else:result.append({'bbox':bounds,'reason':entry['reason']})
    return result


def resolve_page_plan(page, proposal=None):
    """Validate model intent against native geometry before rendering any final crops."""
    fallback=fallback_page_plan(page)
    if not isinstance(proposal,dict) or proposal.get('confidence') not in ('medium','high'):
        return fallback
    types=('photo','render','collage','moodboard','mixed','drawing','text','budget','cover','unknown')
    kind=proposal.get('content_type')
    if kind not in types or kind=='unknown':
        return fallback
    candidates={c['id']:c for c in page.get('candidates',[])}
    rejected={c['id'] for c in candidates.values() if c.get('likely_branding')}
    for raw in proposal.get('regions',[]) if isinstance(proposal.get('regions'),list) else []:
        if isinstance(raw,dict) and proposal['confidence']=='high' and raw.get('role') in ('photo','render','drawing') and isinstance(raw.get('candidate_ids'),list):
            for cid in raw['candidate_ids']:
                if isinstance(cid,str):rejected.discard(cid)
    excluded=[e for e in fallback['excluded'] if e.get('candidate_id') in rejected]

    regions=[]
    for raw in (proposal.get('regions') if isinstance(proposal.get('regions'),list) else [])[:40]:
        if not isinstance(raw,dict):continue
        bbox=safe_bounds(raw.get('bbox'))
        ids=[i for i in raw.get('candidate_ids',[]) if isinstance(i,str) and i in candidates] if isinstance(raw.get('candidate_ids'),list) else []
        if raw.get('role') in ('logo','decoration','text'):
            if proposal['confidence']=='high':
                for cid in ids:
                    c=candidates[cid]
                    # A logo inside a full-page raster must not reject the whole page image.
                    if bbox and overlap(c['bbox'],bbox)/max(.00001,rect_area(c['bbox']))<.8:continue
                    rejected.add(cid);excluded.append({'candidate_id':cid,'reason':str(raw.get('role'))+' identified by page analysis.'})
                if bbox:excluded.append({'bbox':bbox,'reason':str(raw.get('role'))+' identified by page analysis.'})
            continue
        if raw.get('role') not in ('photo','render','collage','moodboard','drawing') or not bbox:continue
        regions.append({'bbox':bbox,'candidate_ids':ids,'type':'moodboard' if raw['role']=='collage' else raw['role'],
                        'title':str(raw.get('title') or 'Page visual')[:160],
                        'situation':raw.get('situation') if raw.get('situation') in ('before','concept','after','reference','unknown') else 'unknown'})
    excluded=compact_exclusions(excluded,candidates)
    usable=[c for c in candidates.values() if c['id'] not in rejected]
    # Content regions fully covering known logos are never published as separate images.
    regions=[r for r in regions if not (r['candidate_ids'] and all(cid in rejected for cid in r['candidate_ids']))]
    if kind in ('text','budget','cover') and not regions:
        return {'content_type':kind,'strategy':'none','confidence':proposal['confidence'],'regions':[],'excluded':excluded,
                'reason':str(proposal.get('reason') or 'No project imagery on this page.')[:1200],'source':'vision'}
    if not regions:
        if usable:
            return fallback
        return {**fallback,'regions':[],'strategy':'none','excluded':excluded,'source':'vision','content_type':kind}
    # Snap regions to complete native pictures. Narrow LLM boxes cannot cut furniture,
    # rooms, or white areas out of a normal embedded photograph.
    for r in regions:
        if kind in ('collage','moodboard'):continue
        matched=[c for c in usable if c['area_ratio']<.85 and
                 (c['id'] in r['candidate_ids'] or overlap(c['bbox'],r['bbox'])/max(.00001,rect_area(r['bbox']))>.65)]
        if matched:
            r['bbox']=union_bounds([c['bbox'] for c in matched]);r['candidate_ids']=[c['id'] for c in matched]
    preserve=kind in ('collage','moodboard','photo','render','drawing') or proposal.get('strategy')!='separate' or proposal['confidence']!='high'
    # A full-page scan can contain independent photographs, but small fragments are
    # unsafe. Preserve instead of accepting a collection of tiny patch crops.
    if any(rect_area(r['bbox'])<.045 for r in regions) or len(regions)>8:
        safe_page={**page,'candidates':[c for c in usable]}
        safe=fallback_page_plan(safe_page)
        safe['excluded']=excluded
        safe['reason']='Proposed crops are too fragmented relative to the page. Keep the complete source composition for review.'
        if kind in ('collage','moodboard'):
            safe['content_type']=kind
            for r in safe['regions']:r['type']='moodboard'
        return safe
    if any(overlap(a['bbox'],b['bbox'])/max(.00001,min(rect_area(a['bbox']),rect_area(b['bbox'])))>.12 for n,a in enumerate(regions) for b in regions[n+1:]):preserve=True
    if preserve:
        bounds=[r['bbox'] for r in regions]
        # Include every native component of a board, even if the model described
        # only one of its photographs. Excluded logos are outside this group.
        if kind in ('collage','moodboard'):
            composed=union_bounds(bounds)
            components=[c for c in usable if c['area_ratio']<.85]
            # PDFs can retain oversized/covered image objects behind the visible
            # board. Keep the model's outer board boundary if it includes most of
            # every component; do not extend it into the footer for a hidden edge.
            if any(overlap(composed,c['bbox'])/max(.00001,rect_area(c['bbox']))<.8 for c in components):
                bounds.extend(c['bbox'] for c in components)
        # A declared single photo represented by PDF tiles also stays complete.
        if kind in ('photo','render') and len(usable)>1:
            bounds.extend(c['bbox'] for c in usable if c['area_ratio']>=.045)
        first=regions[0]
        regions=[{**first,'bbox':union_bounds(bounds),'type':'moodboard' if kind in ('collage','moodboard') else kind if kind in ('photo','render','drawing') else 'other',
                  'candidate_ids':list(dict.fromkeys(cid for r in regions for cid in r['candidate_ids']))}]
    # Reject a crop that is essentially an excluded logo box, even without IDs.
    regions=[r for r in regions if not any('bbox' in e and overlap(r['bbox'],e['bbox'])/max(.00001,rect_area(r['bbox']))>.8 for e in excluded)]
    return {'content_type':kind,'strategy':'preserve' if preserve else 'separate','confidence':proposal['confidence'],'regions':regions,
            'excluded':excluded,'reason':str(proposal.get('reason') or 'Page content and image geometry reviewed before cropping.')[:1200],'source':'vision'}


def materialize_pages(manifest, output, proposals=None):
    mark_repeated_graphics(manifest['pages'])
    proposals=proposals or {}
    pdf=fitz.open(manifest['_pdf']) if manifest.get('_pdf') else None
    try:
        for p in manifest['pages']:
            proposal=proposals.get(str(p['number']))
            plan=resolve_page_plan(p,proposal)
            p['extraction_plan']=plan;p['include_in_presentation']=bool(plan['regions'])
            p['images']=[];samples=[]
            print(json.dumps({'stage':'extracting_images','page':p['number'],'total':manifest['page_count']}),flush=True)
            if plan['source']=='geometry' and p.get('candidates'):
                p['warnings'].append('Page visual classification unavailable or uncertain. The composition was kept intact for review.')
            for region in plan['regions'][:MAX_IMAGES]:
                try:
                    b=region['bbox']
                    if pdf:
                        page=pdf[p['number']-1];rect=fitz.Rect(b[0]*page.rect.width,b[1]*page.rect.height,b[2]*page.rect.width,b[3]*page.rect.height)
                        im=pix_image(page,rect,1800)
                    elif p.get('preview'):
                        full=Image.open(output.directory/p['preview']).convert('RGB')
                        im=full.crop((round(b[0]*full.width),round(b[1]*full.height),round(b[2]*full.width),round(b[3]*full.height)))
                    else:
                        continue
                    n=len(p['images'])+1
                    p['images'].append({'number':n,'file':output.image(im,f"page-{p['number']}-image-{n}.jpg",1800),
                                        'bbox':b,'area_ratio':round(rect_area(b),5),'kind':'composed_visual' if plan['strategy']=='preserve' else 'independent_visual',
                                        'classification':{'type':region['type'],'situation':region['situation'],'title':region['title'],'confidence':plan['confidence'],'evidence':plan['reason']},
                                        'palette':sampled_palette([im])})
                    samples.append(im.copy().resize((100,100)))
                except Exception as error:
                    p['warnings'].append('A planned image could not be extracted: '+str(error)[:160])
            p['include_in_presentation']=bool(p['images'])
            p['palette']=sampled_palette(samples);p['palette_source']='accepted_visuals'
            if isinstance(proposal,dict) and plan['source']=='vision':
                cat={'collage':'moodboard','moodboard':'moodboard','photo':'renders','render':'renders','drawing':'drawings','budget':'budget','mixed':'presentation'}.get(plan['content_type'],'other')
                p['analysis']={'category':cat,'summary':str(proposal.get('summary',''))[:1200],
                               'style':str(proposal.get('style',''))[:40],'evidence':plan['reason'],'confidence':plan['confidence'],
                               'materials':[x[:100] for x in proposal.get('materials',[]) if isinstance(x,str)][:12] if isinstance(proposal.get('materials'),list) else [],'page_first':True}
    finally:
        if pdf:pdf.close()
    manifest.pop('_pdf',None)
    return manifest


def extract_pdf(path, output, inventory=False):
    pages = []
    warnings = []
    with fitz.open(path) as doc:
        if doc.needs_pass:
            raise RuntimeError('This PDF is password protected. Upload an unlocked copy.')
        total = len(doc)
        if total > MAX_PAGES:
            warnings.append(f'Processed the first {MAX_PAGES} of {total} pages. Split the file to extract the remaining pages.')
        for index in range(min(total, MAX_PAGES)):
            page = doc[index]
            number = index+1
            entry = {'number': number, 'width': page.rect.width, 'height': page.rect.height,
                     'text': '', 'text_blocks': [], 'images': [], 'palette': [], 'warnings': [], 'preview': None}
            try:
                print(json.dumps({'stage':'extracting_text','page':number,'total':total}),flush=True)
                # All coordinates use the displayed page, including PDF rotation.
                blocks = page.get_text('blocks', sort=True)
                for b in blocks:
                    if b[6] == 0:
                        rect = fitz.Rect(b[:4]) * page.rotation_matrix
                        entry['text_blocks'].append({'text': b[4].strip(), 'bbox': box(rect, page.rect.width, page.rect.height), 'source': 'native'})
                preview = pix_image(page)
                entry['preview'] = output.image(preview, f'page-{number}.jpg')
                infos = page.get_image_info(hashes=True)
                # OCR scans and hybrid pages whose embedded images can contain additional text.
                image_area = sum((fitz.Rect(i['bbox']) & page.cropbox).get_area() for i in infos)
                native = '\n'.join(b['text'] for b in entry['text_blocks'])
                if len(native.strip()) < 40 or image_area > page.rect.get_area() * .35:
                    try:
                        read = ocr(pix_image(page, edge=2400), output.directory, number)
                        for b in read:
                            normal = re.sub(r'\W+', '', b['text']).lower()
                            if normal and normal not in re.sub(r'\W+', '', native).lower():
                                entry['text_blocks'].append(b)
                    except (OSError, subprocess.SubprocessError):
                        entry['warnings'].append('OCR was unavailable for this page; text inside images may be missing.')
                entry['text_blocks'].sort(key=lambda b: (round(b['bbox'][1], 2), b['bbox'][0]))
                entry['text'] = '\n'.join(b['text'] for b in entry['text_blocks'])
                entry['candidates']=[]
                seen=set()
                for info in infos:
                    rect=(fitz.Rect(info['bbox'])*page.rotation_matrix)&page.rect
                    if rect.is_empty or rect.width<2 or rect.height<2:continue
                    signature=tuple(round(n,1) for n in rect)
                    if signature in seen:continue
                    seen.add(signature)
                    bounds=box(rect,page.rect.width,page.rect.height)
                    entry['candidates'].append({'id':f'p{number}-i{len(entry["candidates"])+1}','bbox':bounds,
                                                'area_ratio':round(rect_area(bounds),5),'pixel_width':info['width'],'pixel_height':info['height'],
                                                'digest':info.get('digest',b'').hex()})
                if len(entry['candidates'])>160:
                    entry['warnings'].append('Only the first 160 image placements were inspected on this page.')
                    entry['candidates']=entry['candidates'][:160]

            except Exception as exc:
                entry['warnings'].append('Page extraction incomplete: '+str(exc)[:200])
            pages.append(entry)

    result={'pages':pages,'page_count':total,'warnings':warnings,'_pdf':str(path)}
    mark_repeated_graphics(pages)
    return result if inventory else materialize_pages(result,output)


def xml(data):
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('Unsupported XML entities in Office file.')
    return ET.fromstring(data)


def relationships(archive, part):
    name = posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part)+'.rels')
    if name not in archive.namelist():
        return {}
    return {r.attrib['Id']: posixpath.normpath(posixpath.join(posixpath.dirname(part), r.attrib['Target'])).lstrip('/')
            for r in xml(archive.read(name)) if r.attrib.get('TargetMode') != 'External'}


def native_pptx(path, output, inventory=False):
    """Fallback preserving presentation order, relationships and each picture's source crop."""
    pages = []
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 4000 or sum(i.file_size for i in archive.infolist()) > 100*1024*1024:
            raise ValueError('Office file exceeds the extraction limit.')
        presentation = xml(archive.read('ppt/presentation.xml'))
        size=presentation.find('p:sldSz',NS)
        slide_width=int(size.attrib.get('cx',9144000)) if size is not None else 9144000
        slide_height=int(size.attrib.get('cy',6858000)) if size is not None else 6858000
        rels = relationships(archive, 'ppt/presentation.xml')
        ordered = [rels[s.attrib['{'+NS['r']+'}id']] for s in presentation.findall('.//p:sldId',NS)]
        if not ordered:
            ordered = sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)),key=lambda n:int(re.search(r'(\d+)\.xml',n)[1]))
        for index, name in enumerate(ordered[:MAX_PAGES]):
            root = xml(archive.read(name))
            texts = [' '.join(n.itertext()) for n in root.findall('.//a:t', NS)]
            if not texts: # Permit older minimal producers that omit namespace declarations.
                texts = [n.text or '' for n in root.iter() if n.tag.split('}')[-1]=='t']
            page = {'number': index+1, 'text': '\n'.join(texts), 'text_blocks': [], 'preview': None,
                    'images': [], 'warnings': ['Slide rendering unavailable; these are native slide text and embedded picture crops.'], 'palette': []}
            rels = relationships(archive, name)
            samples = [];page['candidates']=[];page['width']=slide_width;page['height']=slide_height
            composite=Image.new('RGB',(1600,max(1,round(1600*slide_height/slide_width))),'white')
            for pic in root.findall('.//p:pic',NS)[:MAX_IMAGES]:
                blip = pic.find('.//a:blip', NS)
                target = rels.get(blip.attrib.get('{'+NS['r']+'}embed')) if blip is not None else None
                if not target or target not in archive.namelist():
                    continue
                try:
                    im = Image.open(io.BytesIO(archive.read(target))).convert('RGBA')
                    crop = pic.find('.//a:srcRect',NS)
                    if crop is not None:
                        l,t,r,b = [int(crop.attrib.get(k,0))/100000 for k in ['l','t','r','b']]
                        im = im.crop((round(l*im.width),round(t*im.height),round((1-r)*im.width),round((1-b)*im.height)))
                    # Composite transparent PNGs onto white for the saved preview.
                    canvas = Image.new('RGB',im.size,'white');canvas.paste(im,mask=im.getchannel('A'))
                    im = canvas
                    transform=pic.find('.//a:xfrm',NS)
                    off=transform.find('a:off',NS) if transform is not None else None
                    extent=transform.find('a:ext',NS) if transform is not None else None
                    x=int(off.attrib.get('x',0)) if off is not None else 0;y=int(off.attrib.get('y',0)) if off is not None else 0
                    w=int(extent.attrib.get('cx',slide_width)) if extent is not None else slide_width
                    h=int(extent.attrib.get('cy',slide_height)) if extent is not None else slide_height
                    bounds=box((x,y,x+w,y+h),slide_width,slide_height)
                    if not safe_bounds(bounds):continue
                    n=len(page['candidates'])+1
                    page['candidates'].append({'id':f'p{index+1}-i{n}','bbox':bounds,'area_ratio':round(rect_area(bounds),5),
                                               'pixel_width':im.width,'pixel_height':im.height,'digest':hashlib.sha256(im.tobytes()).hexdigest()})
                    left,top,right,bottom=[round(v*d) for v,d in zip(bounds,(composite.width,composite.height,composite.width,composite.height))]
                    composite.paste(canvas.resize((max(1,right-left),max(1,bottom-top))),(left,top))

                except Exception:
                    page['warnings'].append('An embedded slide image could not be decoded.')
            page['preview']=output.image(composite,f'page-{index+1}.jpg',1600)
            page['warnings'].append('Native fallback preview preserves picture placements; text and effects may differ from the original slide.')
            pages.append(page)
        warnings = ['PowerPoint rendering failed. Native slide extraction was used.']
        if len(ordered)>MAX_PAGES:
            warnings.append(f'Processed the first {MAX_PAGES} of {len(ordered)} slides.')
        result={'pages':pages,'page_count':len(ordered),'warnings':warnings}
        mark_repeated_graphics(pages)
        return result if inventory else materialize_pages(result,output)


def extract(path, directory, inventory=False):
    output = Output(directory)
    suffix = Path(path).suffix.lower()
    if suffix in ('.ppt', '.pptx'):
        try:
            subprocess.run(['libreoffice','-env:UserInstallation=file://'+str(Path(directory)/'lo-profile'),
                            '--headless','--convert-to','pdf:impress_pdf_Export','--outdir',directory,path],
                           capture_output=True,timeout=120,check=True)
            pdf = Path(directory)/(Path(path).stem+'.pdf')
            if not pdf.is_file():
                raise RuntimeError('PowerPoint rendering did not produce a PDF.')
            return extract_pdf(pdf,output,inventory)
        except (OSError, RuntimeError, subprocess.SubprocessError):
            if suffix == '.pptx':
                return native_pptx(path,output,inventory)
            raise RuntimeError('This PowerPoint could not be rendered. Try saving it as PPTX or PDF.')
    return extract_pdf(path,output,inventory)


if __name__ == '__main__':
    try:
        if len(sys.argv)>3 and sys.argv[3]=='--apply-plan':
            root=Path(sys.argv[2]);manifest=json.loads((root/'inventory.json').read_text())
            output=Output(root);output.size=sum(f.stat().st_size for f in root.glob('*.jpg'))
            manifest=materialize_pages(manifest,output,json.loads((root/'page-plans.json').read_text()))
        else:
            manifest=extract(sys.argv[1],sys.argv[2],len(sys.argv)>3 and sys.argv[3]=='--inventory')
    except Exception as exc:
        manifest={'pages':[],'page_count':0,'warnings':[str(exc)[:300]]}
    name='inventory.json' if len(sys.argv)>3 and sys.argv[3]=='--inventory' else 'manifest.json'
    (Path(sys.argv[2])/name).write_text(json.dumps(manifest,ensure_ascii=False))
