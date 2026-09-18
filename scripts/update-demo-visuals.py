"""Add the visual studies to existing demo drafts and version their designed PDFs.

Backs up SQLite; retains existing slides, edits, selections and original sources.
No email or AI requests. Re-running the same bundle makes no changes.
Requires Pillow and PyMuPDF, available in the StudioDeck application image.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import fitz
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--database',type=Path,required=True)
p.add_argument('--demos',type=Path,required=True)
p.add_argument('--studio',required=True)
a=p.parse_args()
db=sqlite3.connect(a.database,timeout=60)
db.row_factory=sqlite3.Row
db.execute('PRAGMA foreign_keys=ON')
stamp=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def uid(slug,key):
    return hashlib.sha256((slug+'-demo-v1:'+a.studio+':'+key).encode()).hexdigest()[:32]

def ins(table,**values):
    db.execute('INSERT INTO '+table+' ('+','.join(values)+') VALUES ('+','.join('?' for _ in values)+')',list(values.values()))

def preview(raw):
    im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((1600,1200))
    out=io.BytesIO();im.save(out,'PNG');return out.getvalue()

prepared=[]
for slug in ['villa-auren','stillwater-garden','haus-morgenlicht']:
    bundle=a.demos/slug
    manifest=json.loads((bundle/'manifest.json').read_text())
    additions=json.loads((bundle/'additional-slides.json').read_text())
    pid,iid=uid(slug,'project'),uid(slug,'iteration')
    iteration=db.execute('SELECT * FROM iterations WHERE id=? AND project_id=?',(iid,pid)).fetchone()
    assert iteration and iteration['status']=='draft',f'{slug}: original demo iteration must be a draft'
    assert db.execute('SELECT 1 FROM projects WHERE id=? AND studio_id=?',(pid,a.studio)).fetchone()
    pdfname=manifest.get('pdf','Villa-Auren-Presentation.pdf')
    raw=(bundle/pdfname).read_bytes();digest=hashlib.sha256(raw).hexdigest()
    asset=uid(slug,'asset:'+pdfname)
    current=db.execute('SELECT v.id,v.sha256 FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND f.asset_id=?',(iid,asset)).fetchone()
    assert current,f'{slug}: designed source PDF missing'
    pages=[]
    if current['sha256']!=digest:
        doc=fitz.open(stream=raw,filetype='pdf')
        assert len(doc)==len(manifest['slides']),f'{slug}: rebuild the PDF first'
        for n,page in enumerate(doc,1):
            pages.append((n,page.get_text(),page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),alpha=False).tobytes('png')))
    images={}
    for item in additions:
        source=(bundle/'assets'/(item['key']+'.webp')).read_bytes()
        images[item['key']]=(source,preview(source))
    prepared.append((slug,manifest,additions,pid,iid,pdfname,raw,digest,asset,current,pages,images))

backup_dir=a.database.parent/'backups';backup_dir.mkdir(exist_ok=True)
backup=backup_dir/('before-demo-visual-studies-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.sqlite')
target=sqlite3.connect(backup);db.backup(target);target.close();backup.chmod(0o600)
reports=[]
db.execute('BEGIN IMMEDIATE')
try:
    for slug,manifest,additions,pid,iid,pdfname,raw,digest,asset,previous,pages,images in prepared:
        assert db.execute('SELECT status FROM iterations WHERE id=?',(iid,)).fetchone()[0]=='draft'
        current=db.execute('SELECT version_id FROM iteration_files WHERE iteration_id=? AND asset_id=?',(iid,asset)).fetchone()[0]
        assert current==previous['id'],f'{slug}: source changed during preparation; retry'
        added=0
        for item in additions:
            key=item['key'];sid=uid(slug,'slide:'+key)
            if db.execute('SELECT 1 FROM presentation_slides WHERE iteration_id=? AND id=?',(iid,sid)).fetchone():continue
            rel='assets/'+key+'.webp';aid=uid(slug,'asset:'+rel);vid=uid(slug,'version:'+rel)
            source,prv=images[key];category='drawings' if item['type']=='drawing' else 'renders'
            ins('assets',id=aid,project_id=pid,category=category,created_at=stamp)
            ins('file_versions',id=vid,asset_id=aid,number=1,name=manifest['name']+' — '+key+' — AI concept.webp',mime='image/webp',size=len(source),sha256=hashlib.sha256(source).hexdigest(),data=source,preview=prv,extracted_text='',metadata=json.dumps(dict(demo=True,generated=True,review_required=False)),created_at=stamp)
            ins('iteration_files',iteration_id=iid,asset_id=aid,version_id=vid,category=category)
            anchor='visual-'+uid(slug,'slide:'+item['after'])
            prior=db.execute('SELECT position FROM slide_layout WHERE iteration_id=? AND slide_id=?',(iid,anchor)).fetchone()
            assert prior,f'{slug}: insertion anchor missing: {item["after"]}'
            position=prior['position']+1
            db.execute('UPDATE slide_layout SET position=position+1 WHERE iteration_id=? AND position>=?',(iid,position))
            ins('presentation_slides',id=sid,iteration_id=iid,source_version_id=vid,page_number=0,image_number=0,type=item['type'],situation='concept',title=item['title'].replace('\n',' '),description=item['body'],metadata=json.dumps(dict(demo=True,confidence='manual',evidence='Generated fictional 3D model or crayon-style concept study.')),position=position,manual=1)
            ins('slide_sections',iteration_id=iid,slide_id='visual-'+sid,section='designs')
            ins('slide_layout',iteration_id=iid,slide_id='visual-'+sid,position=position)
            added+=1
        if pages:
            vid=uid(slug,'visual-studies-pdf:'+digest)
            number=db.execute('SELECT MAX(number)+1 FROM file_versions WHERE asset_id=?',(asset,)).fetchone()[0]
            ins('file_versions',id=vid,asset_id=asset,parent_id=current,number=number,name=pdfname,mime='application/pdf',size=len(raw),sha256=digest,data=raw,preview=preview(pages[0][2]),extracted_text='\n'.join(text for _,text,_ in pages),metadata=json.dumps(dict(demo=True,review_required=False,page_count=len(pages),extraction_method='PyMuPDF; generated source text')),created_at=stamp)
            for n,text,prv in pages:
                ins('document_pages',version_id=vid,number=n,text=text,preview=prv,metadata=json.dumps(dict(include_in_presentation=False,classification='other',demo=True)))
            db.execute('UPDATE iteration_files SET version_id=? WHERE iteration_id=? AND asset_id=?',(vid,iid,asset))
            # Remap composed pages only when they still use the prior source PDF.
            # Manual source replacements and all shared snapshots stay intact.
            for n,s in enumerate(manifest['slides'],1):
                db.execute('UPDATE presentation_slides SET source_version_id=?,page_number=? WHERE iteration_id=? AND id=? AND source_version_id=? AND page_number>0 AND image_version_id IS NULL',(vid,n,iid,uid(slug,'slide:'+s['key']),current))
        if added or pages:
            ins('events',id=hashlib.sha256((slug+stamp).encode()).hexdigest()[:32],project_id=pid,iteration_id=iid,actor='StudioDeck demo update',type='slides_updated',detail='Added classic 3D design studies'+(' and crayon-style garden sketches' if slug=='stillwater-garden' else '')+'. Updated designed PDF; existing content and budget choices retained.',created_at=stamp)
        reports.append(dict(project=manifest['name'],added_slides=added,pdf_updated=bool(pages)))
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.commit()
except Exception:
    db.rollback();raise
print(json.dumps(dict(backup=str(backup),projects=reports),indent=2))
