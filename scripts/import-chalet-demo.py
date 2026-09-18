"""Add Haus Morgenlicht to an existing StudioDeck studio without replacing any project.

Requires Pillow and PyMuPDF (available in the application Docker image).
Uses one transaction, backs up SQLite first, does not send mail or invoke AI.
"""
import argparse
import hashlib
import io
import json
import mimetypes
from pathlib import Path
import sqlite3
from datetime import datetime, timezone
import fitz
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--bundle',type=Path,required=True)
p.add_argument('--database',type=Path,required=True)
p.add_argument('--studio',required=True)
p.add_argument('--owner',required=True)
a=p.parse_args()
bundle=a.bundle
manifest=json.loads((bundle/'manifest.json').read_text())
db=sqlite3.connect(a.database,timeout=30)
db.row_factory=sqlite3.Row
db.execute('PRAGMA foreign_keys=ON')
assert db.execute('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',(a.studio,a.owner)).fetchone(), 'Owner must belong to the selected studio.'
def uid(key):return hashlib.sha256(('haus-morgenlicht-demo-v1:'+a.studio+':'+key).encode()).hexdigest()[:32]
pid,iid=uid('project'),uid('iteration')
if db.execute('SELECT 1 FROM projects WHERE id=?',(pid,)).fetchone():
    print(json.dumps(dict(status='already exists; no changes',project_id=pid,iteration_id=iid)));raise SystemExit(0)

required=[manifest['pdf'],'scope.pdf','budget.csv','materials.csv','interventions.csv','programme.csv']
required += ['assets/'+key+'.webp' for key in manifest['assets']]
required += ['assets/'+key+'.png' for key in manifest['plans']]
required += ['suppliers/'+q['reference']+'.pdf' for q in manifest['quotes']]
for f in required:assert (bundle/f).is_file(),f'Missing asset: {f}'
stamp=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
backup_dir=a.database.parent/'backups';backup_dir.mkdir(exist_ok=True)
backup=backup_dir/('before-haus-morgenlicht-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'.sqlite')
target=sqlite3.connect(backup);db.backup(target);target.close();backup.chmod(0o600)

def ins(table,**values):
    db.execute('INSERT INTO '+table+' ('+','.join(values)+') VALUES ('+','.join('?' for _ in values)+')',list(values.values()))
def preview(raw):
    im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((1600,1200));b=io.BytesIO();im.save(b,'PNG');return b.getvalue()

versions={};pdftexts={}
def add_file(rel,category,name=None):
    path=bundle/rel;raw=path.read_bytes();asset=uid('asset:'+rel);vid=uid('version:'+rel)
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    if path.suffix=='.csv':mime='text/csv'
    meta=dict(demo=True,review_required=False,summary='Fictional Haus Morgenlicht demonstration source.',generated=path.suffix=='.webp')
    prv=None;text='';pages=[]
    if mime.startswith('image/'):prv=preview(raw)
    elif mime=='application/pdf':
        doc=fitz.open(stream=raw,filetype='pdf')
        for n,page in enumerate(doc,1):
            pix=page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False)
            page_text=page.get_text();text+=f'\nPage {n}\n'+page_text
            png=pix.tobytes('png');jpg=io.BytesIO()
            Image.open(io.BytesIO(png)).convert('RGB').save(jpg,'JPEG',quality=92)
            pages.append((n,page_text,jpg.getvalue()))
        prv=preview(pages[0][2]) if pages else None
        meta.update(page_count=len(pages),extraction_method='PyMuPDF; generated source text')
    else:text=raw.decode('utf-8')
    ins('assets',id=asset,project_id=pid,category=category,created_at=stamp)
    ins('file_versions',id=vid,asset_id=asset,number=1,name=name or path.name,mime=mime,size=len(raw),sha256=hashlib.sha256(raw).hexdigest(),data=raw,preview=prv,extracted_text=text,metadata=json.dumps(meta),created_at=stamp)
    ins('iteration_files',iteration_id=iid,asset_id=asset,version_id=vid,category=category)
    for n,text,prv in pages:
        ins('document_pages',version_id=vid,number=n,text=text,metadata=json.dumps(dict(include_in_presentation=False,classification='legal' if category=='legal' else 'other',demo=True)),preview=prv)
    versions[rel]=vid
    return vid

db.execute('BEGIN IMMEDIATE')
try:
    theme=json.dumps(manifest['theme'])
    ins('projects',id=pid,user_id=a.owner,studio_id=a.studio,name=manifest['project_name'],location=manifest['location'],description=manifest['description'],theme=theme,created_at=stamp,visibility='team',archived=0)
    ins('project_members',project_id=pid,user_id=a.owner)
    ins('project_pins',project_id=pid,user_id=a.owner)
    ins('project_details',project_id=pid,tags=json.dumps(['Demo 03','Alpine conversion','Fictional project']),deadline='')
    ins('iterations',id=iid,project_id=pid,number=1,title='Haus Morgenlicht · Complete chalet conversion',status='draft',theme=theme,created_at=stamp)
    for n,(gid,label) in enumerate(manifest['groups']):
        ins('slide_groups',iteration_id=iid,id=gid,label=label,position=n)
    for key in manifest['assets']:
        add_file('assets/'+key+'.webp','moodboard' if key in ['materials','textiles'] else 'photos' if key.startswith('before-') else 'drawings' if key.startswith('sketch-') else 'renders',name='Haus Morgenlicht — '+key+' — AI concept.webp')
    deckvid=add_file('Haus-Morgenlicht-Presentation.pdf','other')
    add_file('scope.pdf','legal','Haus Morgenlicht — scope & assumptions.pdf')
    add_file('budget.csv','budget','Haus Morgenlicht — master budget.csv')
    add_file('materials.csv','other','Haus Morgenlicht — material specification.csv')
    add_file('programme.csv','other','Haus Morgenlicht — delivery programme.csv')
    add_file('interventions.csv','other','Haus Morgenlicht — retention and intervention schedule.csv')
    for q in manifest['quotes']:add_file('suppliers/'+q['reference']+'.pdf','budget',q['reference']+' — '+q['vendor']+' — fictional quote.pdf')

    # Keep the PDF's composition for palette, hierarchy, options and programme.
    # Chalet imagery, moodboards and text remain native editable slide records.
    composed=set(manifest['composed'])
    for n,s in enumerate(manifest['slides']):
        if s['key'] in ['cover','investment']:continue
        vid=None;page=0;typ='text';desc=s['body']
        if s['points']:desc+='\n\n'+'\n'.join('• '+x for x in s['points'])
        if s['key'] in composed:
            vid=deckvid;page=n+1;typ='drawing';desc='Designed presentation page. Fictional demo.'
        elif s['image'] in manifest['plans']:
            vid=add_file('assets/'+s['image']+'.png','drawings','Haus Morgenlicht — '+s['image']+' — concept plan.png')
            typ='floorplan' if s['image']!='section' else 'drawing'
        elif s['image']:
            vid=versions['assets/'+s['image']+'.webp']
            typ='moodboard' if s['section']=='moodboards' else 'photo' if s['situation']=='before' else 'fullphoto' if s['kind'] in ['hero','cover'] else 'render'
        typ=s.get('type',typ)
        sid=uid('slide:'+s['key'])
        ins('presentation_slides',id=sid,iteration_id=iid,source_version_id=vid,page_number=page,image_number=0,type=typ,situation=s.get('situation','concept') if vid else 'unknown',title=s['title'].replace('\n',' '),description=desc,metadata=json.dumps(dict(confidence='manual',demo=True,evidence='Original fictional demonstration content; AI-generated concept imagery.',palette=[{'hex':c} for c in manifest['theme']['colors']])),position=n,manual=1)
        ins('slide_sections',iteration_id=iid,slide_id='visual-'+sid,section=s['section'])
        ins('slide_layout',iteration_id=iid,slide_id='visual-'+sid,position=n)
    for sid,title,description,section,position in [
        ('intro','Haus Morgenlicht. Air, light and the mountains.',manifest['slides'][0]['body']+' All clients, suppliers and prices are fictional; imagery is AI-generated.','story',0),
        ('budget','The investment, made clear.','Fictional conversion: €687,500–€703,500 including €62,000 contingency. Optional wellness and terrace packages begin unselected. Concealed conditions remain unpriced. All figures include assumed VAT.','budget',next(n for n,s in enumerate(manifest['slides']) if s['key']=='investment')),
        ('contacts','Your fictional project team.','Demo contacts use reserved example.test addresses. No invitations or messages have been sent.','delivery',len(manifest['slides'])+1),
        ('summary','Every detail, together.','Download the designed presentation, original images, 19 fictional supplier quotes, four design plans, material and intervention schedules, programme and scope document.','delivery',len(manifest['slides'])+2),
    ]:
        ins('slide_content',iteration_id=iid,slide_id=sid,title=title,description=description)
        ins('slide_sections',iteration_id=iid,slide_id=sid,section=section)
        ins('slide_layout',iteration_id=iid,slide_id=sid,position=position)
    ins('slide_layout',iteration_id=iid,slide_id='changes',hidden=1)
    budget_columns={x['name'] for x in db.execute('PRAGMA table_info(budget_items)')}
    for r in manifest['budget']:
        src='budget.csv' if r['source']=='budget' else 'scope.pdf' if r['source']=='scope' else 'suppliers/'+r['source']+'.pdf'
        cents=lambda v:None if v is None else round(v*100)
        ins('budget_items',id=uid('budget:'+r['key']),iteration_id=iid,parent_id=uid('budget:'+r['parent']) if r['parent'] else None,source_version_id=versions[src],label=r['label'],vendor=r['vendor'],amount_cents=cents(r['amount']),min_amount_cents=cents(r['min_amount']),max_amount_cents=cents(r['max_amount']),kind=r['kind'],included=int(r['included']),is_optional=int(r['optional']),note=r['note']+' Fictional demo; amounts include assumed VAT.',**({
            'source_key':r['key'],'relationship_origin':'manual','relationship_evidence':r['note'],'relationship_locked':1
        } if 'relationship_locked' in budget_columns else {}))
    for name,role,email in [('Anna & Lukas Leitner','Client','leitner@example.test'),('Mara Huber','Architect · fictional','mara.huber@example.test'),('Felix Gruber','Interior designer · fictional','felix.gruber@example.test'),('Lena Berger','Project coordinator · fictional','lena.berger@example.test'),('Alpen Bauatelier','Conversion contractor · fictional','alpen.bauatelier@example.test'),('Panorama Werk','Glazing specialist · fictional','panorama.werk@example.test')]:
        ins('contacts',id=uid('contact:'+email),project_id=pid,name=name,role=role,email=email,phone='')
    ins('events',id=uid('event:created'),project_id=pid,iteration_id=iid,actor='StudioDeck demo import',type='project_created',detail='Created Haus Morgenlicht: original concept imagery, complete chalet conversion presentation and fictional supplier pack. No client messages sent.',created_at=stamp)
    assert not db.execute('PRAGMA foreign_key_check').fetchall(),'Foreign key validation failed'
    db.commit()
except Exception:
    db.rollback();raise
print(json.dumps(dict(status='created',project_id=pid,iteration_id=iid,files=len(versions),visual_slides=db.execute('SELECT count(*) FROM presentation_slides WHERE iteration_id=?',(iid,)).fetchone()[0],budget_rows=len(manifest['budget']),backup=str(backup),path=f'/{a.studio}/projects/{pid}'),indent=2))
