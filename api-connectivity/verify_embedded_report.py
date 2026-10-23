"""Check the data-format transformation, not transfer/copy integrity."""
import argparse
import json
import subprocess
from pathlib import Path
from bs4 import BeautifulSoup


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline',help='Optional Git version before the HTML-to-data transformation')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    manifest=json.loads((root/'connectivity/manifest.json').read_text('utf-8'))
    rows=json.loads((root/'connectivity'/manifest['rows']).read_text('utf-8'))
    fragment=BeautifulSoup((root/'connectivity'/manifest['fragment']).read_text('utf-8'),'html.parser')
    assert manifest['format']==1 and len(rows)==manifest['count']
    snapshot=json.loads((root/'connectivity'/manifest['snapshot']).read_text('utf-8'))
    assert len(rows)==sum(len(provider.get('tested_models',[])) for provider in snapshot['results'])
    assert not fragment.select('table tbody tr')
    for row in rows:
        element=BeautifulSoup(row['html'],'html.parser').find('tr')
        cells=element.find_all('td',recursive=False)
        assert len(cells)==6
        assert element['data-provider']==row['provider'] and element['data-status']==row['status']
        assert cells[1].get_text()==row['model'] and cells[2].get_text().strip()==row['protocol']
        assert element.get_text()==row['search']
    if args.baseline:
        raw=subprocess.check_output(['git','show',f'{args.baseline}:index.html'],cwd=root)
        before=BeautifulSoup(raw.decode('utf-8'),'html.parser').find(id='view-connectivity')
        original=before.select('table tbody tr')
        assert len(original)==len(rows)
        for old,new in zip(original,rows):
            actual=BeautifulSoup(new['html'],'html.parser').find('tr')
            assert old.get_text()==actual.get_text()
            assert old.attrs==actual.attrs
            assert [cell.attrs for cell in old.find_all('td')]==[cell.attrs for cell in actual.find_all('td')]
            assert [link.get('href') for link in old.find_all('a')]==[link.get('href') for link in actual.find_all('a')]
        assert json.loads(before.find(id='reportData').string)==snapshot
        assert [(card['data-provider'],card.get_text()) for card in before.select('.provider-card')]==[(card['data-provider'],card.get_text()) for card in fragment.select('.provider-card')]
        receipt=dict(baseline=args.baseline,rows=len(rows),providers=len(fragment.select('.provider-card')),
                     allSixColumnsAndAttributesPreserved=True,reportSnapshotPreserved=True,
                     originalHtmlBytes=len(raw),currentHtmlBytes=(root/'index.html').stat().st_size,
                     lazyFragmentBytes=(root/'connectivity'/manifest['fragment']).stat().st_size,
                     lazyRowsBytes=(root/'connectivity'/manifest['rows']).stat().st_size,
                     note='Uncompressed source bytes; no measured network, latency, heap or energy claim. This checks the changed data representation, not downloads or copies.')
        (root/'results').mkdir(exist_ok=True)
        (root/'results/connectivity-transformation.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(receipt,ensure_ascii=False))
    else:
        print(f'{len(rows)} model rows have valid display/search fields; deferred table is empty')


if __name__=='__main__':
    main()
