"""Page extraction worker. All output stays in the caller's private temporary directory."""
import csv
import io
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


def tight_photo_bounds(image):
    """Find a dense rectangular image, excluding light margins and sparse caption bands.

    Uses luminance as well as colour, so monochrome photographs are retained.
    Ambiguous/mostly white artwork is left for the original image fallback.
    """
    small = image.convert('RGB')
    small.thumbnail((640, 640))
    width, height = small.size
    if min(width, height) < 16:
        return None
    pixels = list(small.getdata())
    # White and warm-grey paper backgrounds; colour photographs touching the edge
    # do not become their own background sample.
    corners = [pixels[0], pixels[width-1], pixels[-width], pixels[-1]]
    paper = [p for p in corners if min(p) >= 215 and max(p)-min(p) < 28]
    background = tuple(sorted(p[c] for p in paper)[len(paper)//2] for c in range(3)) if paper else (255, 255, 255)
    mask = [max(abs(p[c]-background[c]) for c in range(3)) > 22 for p in pixels]
    def longest_run(indices):
        runs = []
        for n in indices:
            if not runs or n > runs[-1][-1]+2:
                runs.append([n])
            else:
                runs[-1].append(n)
        return max(runs, key=len) if runs else []
    # Captions have sparse strokes interrupted by line spacing; a photo has a
    # sustained band of occupied rows. Then fit the sides against that band.
    rows = longest_run([y for y in range(height) if sum(mask[y*width:(y+1)*width])/width >= .32])
    if len(rows) < max(12, height*.08):
        return None
    top, bottom = rows[0], rows[-1]+1
    cols = [x for x in range(width) if sum(mask[y*width+x] for y in range(top,bottom))/(bottom-top) >= .45]
    if not cols or cols[-1]-cols[0] < max(12,width*.08):
        return None
    left, right = cols[0], cols[-1]+1
    # Refine row bounds after removing the horizontal paper margins.
    rows = longest_run([y for y in range(height) if sum(mask[y*width+left:y*width+right])/(right-left) >= .45])
    if len(rows) < 12:
        return None
    top, bottom = rows[0], rows[-1]+1
    density = sum(sum(mask[y*width+left:y*width+right]) for y in range(top,bottom))/((right-left)*(bottom-top))
    if density < .5:
        return None
    return [left/width, top/height, right/width, bottom/height]


def split_board(image):
    """Split flattened moodboards at wide white gutters; retain a whole image if ambiguous."""
    small = image.convert('RGB')
    small.thumbnail((400, 400))
    def divide(bounds, depth=0):
        x0, y0, x1, y1 = bounds
        if depth >= 5 or x1-x0 < 50 or y1-y0 < 50:
            return [bounds]
        for axis in (0, 1):
            lo, hi = (x0, x1) if axis == 0 else (y0, y1)
            runs, start = [], None
            for n in range(lo+8, hi-8):
                values = ([small.getpixel((n, m)) for m in range(y0, y1)] if axis == 0
                          else [small.getpixel((m, n)) for m in range(x0, x1)])
                white = sum(min(v) > 238 for v in values) / max(1, len(values)) > .985
                if white and start is None:
                    start = n
                elif not white and start is not None:
                    if n-start >= 5 and start-lo > 25 and hi-n > 25:
                        runs.append((start, n))
                    start = None
            if runs:
                a, b = max(runs, key=lambda r: r[1]-r[0])
                parts = [(x0,y0,a,y1),(b,y0,x1,y1)] if axis == 0 else [(x0,y0,x1,a),(x0,b,x1,y1)]
                return [piece for p in parts for piece in divide(p, depth+1)]
        return [bounds]
    result = []
    for rect in divide((0, 0, small.width, small.height)):
        crop = small.crop(rect)
        tight = tight_photo_bounds(crop)
        if not tight:
            continue
        result.append([(rect[0]+tight[0]*crop.width)/small.width,
                       (rect[1]+tight[1]*crop.height)/small.height,
                       (rect[0]+tight[2]*crop.width)/small.width,
                       (rect[1]+tight[3]*crop.height)/small.height])
    # A scan with just one photograph and a caption still needs a tight crop.
    return result



def extract_pdf(path, output):
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
                infos = page.get_image_info()
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
                print(json.dumps({'stage':'extracting_images','page':number,'total':total}),flush=True)
                candidates, seen = [], set()
                for info in infos:
                    rect = (fitz.Rect(info['bbox']) * page.rotation_matrix) & page.rect
                    if rect.is_empty or rect.width < 20 or rect.height < 20:
                        continue
                    signature = tuple(round(n, 1) for n in rect)
                    if signature in seen:
                        continue
                    seen.add(signature)
                    candidates.append((rect, 'image_crop'))
                # Vector-only boards are visible in the preview and can also yield gutter crops.
                if not candidates or (len(candidates) == 1 and candidates[0][0].get_area() > page.rect.get_area() * .7):
                    regions = split_board(preview)
                    if regions:
                        candidates = [(fitz.Rect(b[0]*page.rect.width,b[1]*page.rect.height,b[2]*page.rect.width,b[3]*page.rect.height), 'board_crop') for b in regions]
                if len(candidates) > MAX_IMAGES:
                    entry['warnings'].append(f'Only the first {MAX_IMAGES} image regions were extracted from this page.')
                images = []
                for rect, kind in candidates[:MAX_IMAGES]:
                    try:
                        im = pix_image(page, rect, 1600)
                        source_rect = fitz.Rect(rect)
                        tight = tight_photo_bounds(im)
                        if tight and (tight[0] > .008 or tight[1] > .008 or tight[2] < .992 or tight[3] < .992):
                            rect = fitz.Rect(source_rect.x0+tight[0]*source_rect.width, source_rect.y0+tight[1]*source_rect.height,
                                             source_rect.x0+tight[2]*source_rect.width, source_rect.y0+tight[3]*source_rect.height)
                            im = pix_image(page, rect, 1200)
                            kind = 'tight_photo_crop'

                        n = len(entry['images'])+1
                        entry['images'].append({'number': n, 'file': output.image(im, f'page-{number}-image-{n}.jpg',1200),
                                                'bbox': box(rect,page.rect.width,page.rect.height), 'source_bbox': box(source_rect,page.rect.width,page.rect.height), 'kind': kind,
                                                'palette': sampled_palette([im])})
                        images.append(im.copy().resize((100,100)))
                    except Exception as exc:
                        entry['warnings'].append('An image crop could not be extracted: '+str(exc)[:160])
                # Mask text from fallback page sampling so body copy cannot dominate the palette.
                if not images:
                    from PIL import ImageDraw
                    sample = preview.copy()
                    draw = ImageDraw.Draw(sample)
                    for block in entry['text_blocks']:
                        b = block['bbox']
                        draw.rectangle((b[0]*sample.width,b[1]*sample.height,b[2]*sample.width,b[3]*sample.height),fill='white')
                    images = [sample]
                print(json.dumps({'stage':'extracting_colors','page':number,'total':total}),flush=True)
                entry['palette'] = sampled_palette(images)
                entry['palette_source'] = 'image_crops' if entry['images'] else 'page_without_text'
            except Exception as exc:
                entry['warnings'].append('Page extraction incomplete: '+str(exc)[:200])
            pages.append(entry)

    return {'pages': pages, 'page_count': total, 'warnings': warnings}


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


def native_pptx(path, output):
    """Fallback preserving presentation order, relationships and each picture's source crop."""
    pages = []
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 4000 or sum(i.file_size for i in archive.infolist()) > 100*1024*1024:
            raise ValueError('Office file exceeds the extraction limit.')
        presentation = xml(archive.read('ppt/presentation.xml'))
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
            samples = []
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
                    tight = tight_photo_bounds(canvas)
                    if tight:
                        canvas = canvas.crop((round(tight[0]*canvas.width),round(tight[1]*canvas.height),round(tight[2]*canvas.width),round(tight[3]*canvas.height)))
                    im = canvas
                    n = len(page['images'])+1
                    page['images'].append({'number':n,'file':output.image(canvas,f'page-{index+1}-image-{n}.jpg',1200),
                                           'bbox':None,'kind':'embedded_crop','palette':sampled_palette([im])})
                    samples.append(im.resize((100,100)))
                except Exception:
                    page['warnings'].append('An embedded slide image could not be decoded.')
            page['palette'] = sampled_palette(samples)
            page['palette_source'] = 'image_crops'
            pages.append(page)
        warnings = ['PowerPoint rendering failed. Native slide extraction was used.']
        if len(ordered)>MAX_PAGES:
            warnings.append(f'Processed the first {MAX_PAGES} of {len(ordered)} slides.')
        return {'pages':pages,'page_count':len(ordered),'warnings':warnings}


def extract(path, directory):
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
            return extract_pdf(pdf,output)
        except (OSError, RuntimeError, subprocess.SubprocessError):
            if suffix == '.pptx':
                return native_pptx(path,output)
            raise RuntimeError('This PowerPoint could not be rendered. Try saving it as PPTX or PDF.')
    return extract_pdf(path,output)


if __name__ == '__main__':
    try:
        manifest = extract(sys.argv[1],sys.argv[2])
    except Exception as exc:
        manifest = {'pages':[],'page_count':0,'warnings':[str(exc)[:300]]}
    (Path(sys.argv[2])/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False))
