"""Export only public runtime assets; no post-copy comparison or hashing."""
import json
from pathlib import Path
import shutil
import subprocess

root=Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text('utf-8').strip()
output=root/'dist'/version
output.mkdir(parents=True,exist_ok=True)
extensions={'.html','.css','.js','.mjs','.svg','.ico','.json','.png','.jpg','.webp','.woff2','.pdf','.txt'}
paths=[]
for relative in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines():
    path=Path(relative)
    if relative.startswith(('tmp/','results/','.github/','tests/')) or path.name.startswith('test_'):
        continue
    if path.suffix in extensions and path.name!='firebase.json':
        paths.append(path)
paths.extend([Path('VERSION'),Path('.nojekyll'),Path('view-subscriptions.mjs')])
manifest=json.loads((root/'connectivity/manifest.json').read_text('utf-8'))
paths.extend(Path('connectivity')/name for name in ('manifest.json','view.mjs',manifest['fragment'],manifest['rows'],manifest['snapshot']))
for relative in dict.fromkeys(paths):
    target=output/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(root/relative,target)
print(f'Public package copied normally to {output}')
