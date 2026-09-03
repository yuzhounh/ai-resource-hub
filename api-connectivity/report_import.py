"""Read existing report data without credentials or network access."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path


class LegacyReportParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.providers = {}
        self.current_provider = None
        self.row = None
        self.cells = []
        self.cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if 'provider-card' in classes:
            name = attrs.get('id', '').removeprefix('card-')
            self.current_provider = name
            self.providers[name] = dict(provider=name, base_url='', status='CATALOG_OK',
                message='目录获取成功；可用性以模型实测为准', total_models=0,
                success_count=0, failed_count=0, skipped_count=0, tested_models=[])
        if 'provider-url' in classes and self.current_provider:
            self.providers[self.current_provider]['base_url'] = attrs.get('title', '')
        if tag == 'tr' and 'data-provider' in attrs:
            self.row = attrs
            self.cells = []
        if tag == 'td' and self.row is not None:
            self.cell = {'text': '', 'title': attrs.get('title')}

    def handle_data(self, data):
        if self.cell is not None:
            self.cell['text'] += data

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.cells.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            if len(self.cells) != 6:
                raise ValueError('旧报告表格结构不完整，拒绝覆盖原报告')
            cells = self.cells
            provider = self.providers[self.row['data-provider']]
            status = self.row['data-status']
            proto = cells[2]['text'].strip()
            if status == 'BATCH': status = 'BATCH_API'
            elif status == 'SKIPPED':
                status = ('CATALOG_ONLY' if proto == 'Catalog' else
                          'SKIPPED_EMBEDDING' if 'Embeddings' in proto else 'SKIPPED_MEDIA')
            message = cells[5]['title'] or cells[5]['text'].strip()
            message = message.replace('目录已收录（抽样可用）', '仅目录收录；原报告未测试')
            latency = re.search(r'\d+', cells[3]['text'])
            provider['tested_models'].append(dict(model=cells[1]['title'] or cells[1]['text'].strip(),
                status=status, protocol=proto, latency_ms=int(latency[0]) if latency else 0,
                message=message, attempts=[]))
            self.row = None


def read_report(path):
    html = Path(path).read_text(encoding='utf-8')
    embedded = re.search(r'<script type="application/json" id="reportData">(.*?)</script>', html, re.S)
    if embedded:
        snapshot = json.loads(embedded[1])
        if snapshot.get('version') != 2 or not isinstance(snapshot.get('results'), list):
            raise ValueError('不支持的报告数据格式')
        for provider in snapshot['results']:
            was_historical = provider.get('status') == 'HISTORICAL'
            if was_historical:
                provider['status'] = 'CATALOG_OK'
                provider['message'] = '目录获取成功；可用性以模型实测为准'
            provider.pop('historical', None)
        snapshot['historical'] = False
        return snapshot
    parser = LegacyReportParser()
    parser.feed(html)
    if not parser.providers:
        raise ValueError('未找到可恢复的报告数据；原文件不变')
    for provider in parser.providers.values():
        models = provider['tested_models']
        provider.update(total_models=len(models), success_count=sum(m['status'] == 'SUCCESS' for m in models),
                        failed_count=sum(m['status'] == 'FAILED' for m in models),
                        skipped_count=sum(m['status'] not in ('SUCCESS', 'FAILED') for m in models))
    timestamp = re.search(r'报告生成时间:\s*([\d-]+ [\d:]+)', html)
    return dict(version=2, results=list(parser.providers.values()), historical=False,
                generated_at=timestamp[1] if timestamp else '原生成时间未知')
