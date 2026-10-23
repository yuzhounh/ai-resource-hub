import json
from pathlib import Path
import tempfile
import unittest
from bs4 import BeautifulSoup
from embedded_report import pack_fragment
from report_renderer import _sync_to_hub


def fragment(provider='A', model='one', latency=20):
    return f'''<div class="stats-grid">snapshot</div><div class="providers-grid"><article class="provider-card" data-provider="{provider}">{provider}</article></div>
    <b id="connProvidersCount">1</b><div class="table-controls">filters</div><div class="table-container"><table><tbody>
    <tr data-provider="{provider}" data-status="SUCCESS"><td>{provider}</td><td>{model}</td><td>Chat</td><td>{latency} ms</td><td>success</td><td>details &amp; notes</td></tr>
    </tbody></table><div id="connPagination">pages</div></div><script id="reportData" type="application/json">{{"version":2,"results":[]}}</script>'''


class EmbeddedReportTests(unittest.TestCase):
    def test_keeps_row_contents_metadata_and_empty_live_table(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)
            manifest=pack_fragment(fragment(),directory)
            rows=json.loads((directory/manifest['rows']).read_text('utf-8'))
            self.assertEqual(rows[0]['provider'],'A')
            self.assertEqual(rows[0]['latency'],20)
            self.assertIn('details & notes',rows[0]['search'])
            self.assertEqual(len(BeautifulSoup(rows[0]['html'],'html.parser').find_all('td')),6)
            view=BeautifulSoup((directory/manifest['fragment']).read_text('utf-8'),'html.parser')
            self.assertEqual(len(view.select('tbody tr')),0)
            self.assertIsNone(view.find(id='reportData'))
            self.assertEqual(json.loads((directory/manifest['snapshot']).read_text('utf-8')),{'version':2,'results':[]})

    def test_refresh_updates_lazy_data_and_keeps_authentication_and_paging(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            index=root/'index.html'
            index.write_text('<div id="view-connectivity" data-hub-locked><section class="hub-lock-card">login</section><p id="connectivity-load">load</p></div>',encoding='utf-8')
            pack_fragment(fragment(),root/'connectivity')
            _sync_to_hub(index,fragment('B','two',40))
            manifest=json.loads((root/'connectivity/manifest.json').read_text('utf-8'))
            rows=json.loads((root/'connectivity'/manifest['rows']).read_text('utf-8'))
            self.assertEqual((rows[0]['provider'],rows[0]['model'],rows[0]['latency']),('B','two',40))
            view=BeautifulSoup((root/'connectivity'/manifest['fragment']).read_text('utf-8'),'html.parser')
            self.assertIsNotNone(view.find(id='connPagination'))
            self.assertEqual(len(view.select('#connPagination')),1)
            self.assertEqual(view.find(id='connProvidersCount').text,'1')
            self.assertTrue(BeautifulSoup(index.read_text('utf-8'),'html.parser').find(id='view-connectivity').has_attr('data-hub-locked'))

    def test_invalid_report_does_not_replace_the_current_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)
            pack_fragment(fragment(),directory)
            with self.assertRaises(ValueError):
                pack_fragment('<table><tbody><tr><td>invalid</td></tr></tbody></table>',directory)
            self.assertEqual(json.loads((directory/'manifest.json').read_text('utf-8'))['count'],1)


if __name__=='__main__':
    unittest.main()
