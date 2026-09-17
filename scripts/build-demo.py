"""Build an explicitly marked static UI demo. Never copies PHP or private storage."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
dist.mkdir(exist_ok=True)
shutil.copytree(root/'public/assets',dist/'assets',dirs_exist_ok=True)
html=(root/'public/index.html').read_text()
html=html.replace('<script type="module"','<script>window.STUDIODECK_DEMO=true;</script><script type="module"')
(dist/'index.html').write_text(html)
print('Static demo ready.')
