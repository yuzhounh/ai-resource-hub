"""Package report rows for the hub without credentials, probes or data changes."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup


def pack_fragment(fragment: str, directory: Path) -> dict:
    soup = BeautifulSoup(fragment, 'html.parser')
    body = soup.select_one('table tbody')
    if body is None:
        raise ValueError('Connectivity table is missing')
    rows = []
    for row in body.find_all('tr', recursive=False):
        cells = row.find_all('td', recursive=False)
        if len(cells) != 6:
            raise ValueError('Connectivity row must retain all six columns')
        latency = re.match(r'\s*([+-]?\d+)', cells[3].get_text())
        rows.append(dict(html=str(row), provider=row['data-provider'], status=row['data-status'],
                         search=row.get_text(), model=cells[1].get_text(), protocol=cells[2].get_text().strip(),
                         latency=int(latency[1]) if latency else 0))
    body.clear()
    snapshot = soup.find(id='reportData')
    if snapshot is None:
        raise ValueError('Report snapshot is missing')
    snapshot_data = json.loads(snapshot.string)
    snapshot.decompose()
    directory.mkdir(parents=True, exist_ok=True)

    def asset(prefix: str, suffix: str, content: bytes) -> str:
        name = f'{prefix}.{hashlib.sha256(content).hexdigest()[:16]}.{suffix}'
        (directory / name).write_bytes(content)
        return name

    manifest = dict(format=1, count=len(rows),
                    fragment=asset('view', 'html', str(soup).encode('utf-8')),
                    rows=asset('rows', 'json', json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8')),
                    snapshot=asset('snapshot', 'json', json.dumps(snapshot_data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')))
    temporary = directory / 'manifest.tmp'
    temporary.write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    temporary.replace(directory / 'manifest.json')
    return manifest


def update_embedded_report(root: Path, report_html: str) -> None:
    directory = root / 'connectivity'
    manifest = json.loads((directory / 'manifest.json').read_text('utf-8'))
    shell = BeautifulSoup((directory / manifest['fragment']).read_text('utf-8'), 'html.parser')
    report = BeautifulSoup(report_html, 'html.parser')
    controls = report.select_one('.table-controls')
    if controls:
        search = controls.select_one('.search-box')
        if search:
            search.decompose()
    for selector in ('.stats-grid', '.providers-grid', '.table-controls', '.table-container'):
        before, after = shell.select_one(selector), report.select_one(selector)
        if before is None or after is None:
            raise ValueError(f'Report section missing: {selector}')
        if selector == '.table-container':
            pagination = before.select_one('#connPagination')
            if pagination:
                pagination.extract()
                before.insert_after(pagination)
            duplicate = after.select_one('#connPagination')
            if duplicate:
                duplicate.decompose()
        before.replace_with(after)
    snapshot = report.find(id='reportData')
    if snapshot is None:
        raise ValueError('Report snapshot is missing')
    shell.append(snapshot)
    count = len(shell.select('.provider-card'))
    badge = shell.select_one('#connProvidersCount')
    if badge:
        badge.string = str(count)
    pack_fragment(str(shell), directory)
