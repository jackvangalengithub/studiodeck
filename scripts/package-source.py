"""Package the runnable PHP application, without runtime data or hosting credentials."""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[1]
out=root/'downloads'
out.mkdir(exist_ok=True)
target=out/'studiodeck-php.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for name in ['app','public','scripts','tests']:
        for f in (root/name).rglob('*'):
            if f.is_file() and '__pycache__' not in str(f) and '/tmp/' not in str(f):
                z.write(f,'studiodeck/'+str(f.relative_to(root)))
    for name in ['README.md','Dockerfile','.env.example','.gitignore','package.json']:
        z.write(root/name,'studiodeck/'+name)
    z.writestr('studiodeck/storage/.gitkeep','')
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert not any(n.endswith('/.env') or n.endswith('.sqlite') for n in z.namelist())
print(f'Created {target.name} ({target.stat().st_size:,} bytes)')
