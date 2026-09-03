"""Offline regressions: no credential reads and no real requests."""
import copy
import io
import json
import ssl
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor

import api_probe as probe
import refresh_api_report as app
from report_import import read_report
from report_renderer import generate_html


def chat(text='Hello'):
    return {'choices': [{'finish_reason': 'stop', 'message': {'role': 'assistant', 'content': text}}]}


class Response(io.BytesIO):
    def __init__(self, data):
        super().__init__(json.dumps(data).encode())


class ProbeTests(unittest.TestCase):
    def setUp(self):
        # Fail closed if any test accidentally reaches the network or credential store.
        self.network = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Real network forbidden'))
        self.credentials = patch.object(app, 'get_secret', side_effect=AssertionError('Credential access forbidden'))
        self.network.start(); self.credentials.start()
        self.addCleanup(self.network.stop); self.addCleanup(self.credentials.stop)

    def client(self, responses, **kwargs):
        client = probe.ProbeClient(**kwargs)
        client.opener = Mock()
        client.opener.open.side_effect = responses
        return client

    def test_certificate_verification_on(self):
        client = probe.ProbeClient()
        self.assertTrue(client.context.check_hostname)
        self.assertEqual(client.context.verify_mode, ssl.CERT_REQUIRED)

    def test_redirect_does_not_forward_auth(self):
        req = urllib.request.Request('https://example.invalid', headers={'Authorization': 'Bearer dummy'})
        self.assertIsNone(probe.NoRedirect().redirect_request(req, None, 302, '', {}, 'https://other.invalid'))

    def test_https_required(self):
        with self.assertRaises(probe.ProbeError):
            probe.ProbeClient().request('http://example.invalid', 'dummy')

    def test_empty_and_error_json_not_success(self):
        for invalid in ({}, {'error': 'failure'}, {'choices': []}, chat(''), chat(None)):
            with self.subTest(invalid=invalid), self.assertRaises(probe.ProbeError):
                probe.response_text(invalid, 'Chat Completions')

    def test_all_protocols_require_completed_text(self):
        responses = {'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': 'Hi'}]}]}
        messages = {'type': 'message', 'role': 'assistant', 'stop_reason': 'end_turn', 'content': [{'type': 'text', 'text': 'Hi'}]}
        self.assertEqual(probe.response_text(chat(), 'Chat Completions'), 'Hello')
        self.assertEqual(probe.response_text(responses, 'Responses'), 'Hi')
        self.assertEqual(probe.response_text(messages, 'Anthropic Messages'), 'Hi')
        for protocol, data, field in [('Responses', responses, 'status'), ('Anthropic Messages', messages, 'stop_reason')]:
            data[field] = None
            with self.assertRaises(probe.ProbeError): probe.response_text(data, protocol)

    def test_401_stops_fallback_and_provider(self):
        error = urllib.error.HTTPError('https://example.invalid', 401, '', {}, None)
        client = self.client([error, Response(chat())])
        for model, status, outcome in (('model-a', 'FAILED', 'AUTH'), ('model-b', 'CATALOG_ONLY', 'PROVIDER_STOPPED')):
            result = probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', model, client)
            self.assertEqual(result['status'], status)
            self.assertEqual(result['attempts'][0]['outcome'], outcome)
        self.assertEqual(client.opener.open.call_count, 1)

    def test_incompatible_protocol_falls_back_and_keeps_details(self):
        error = urllib.error.HTTPError('https://example.invalid', 404, '', {}, None)
        response = {'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': 'dummy secret'}]}]}
        client = self.client([error, Response(response)])
        result = probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', 'model', client)
        self.assertEqual(result['status'], 'SUCCESS')
        self.assertEqual(len(result['attempts']), 2)
        self.assertNotIn('dummy', result['message'])

    def test_invalid_json_fails_all_protocols(self):
        client = self.client([Response({}), Response({'error': 'no'}), Response({})])
        result = probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', 'model', client)
        self.assertEqual(result['status'], 'FAILED')
        self.assertEqual(len(result['attempts']), 3)

    def test_request_budget(self):
        client = self.client([Response({})], max_requests=1)
        client.request('https://example.invalid', 'dummy')
        result = probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', 'model', client)
        self.assertEqual(result['status'], 'CATALOG_ONLY')
        self.assertEqual(client.opener.open.call_count, 1)

    def test_request_budget_is_shared_across_workers(self):
        client = self.client([], max_requests=3)
        client.opener.open.side_effect = lambda *a, **k: Response(chat())
        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(lambda n: probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', f'model-{n}', client), range(20)))
        self.assertEqual(client.opener.open.call_count, 3)
        self.assertEqual(sum(r['status'] == 'SUCCESS' for r in results), 3)
        self.assertEqual(sum(r['status'] == 'CATALOG_ONLY' for r in results), 17)

    def test_rate_limit_retry_is_bounded(self):
        errors = [urllib.error.HTTPError('https://example.invalid', 429, '', {'Retry-After': '0'}, None) for _ in range(2)]
        client = self.client(errors)
        with self.assertRaises(probe.ProbeError): client.request('https://example.invalid', 'dummy')
        self.assertEqual(client.requests, 2)
        self.assertEqual(client.stop_error.kind, 'RATE_LIMIT')

    def test_long_retry_after_does_not_retry_early(self):
        client = self.client([urllib.error.HTTPError('https://example.invalid', 429, '', {'Retry-After': '120'}, None)])
        with self.assertRaises(probe.ProbeError): client.request('https://example.invalid', 'dummy')
        self.assertEqual(client.requests, 1)

    def test_network_error_redacts_raw_details(self):
        client = self.client([urllib.error.URLError('dummy-secret-in-url')])
        with self.assertRaises(probe.ProbeError) as error: client.request('https://example.invalid', 'dummy')
        self.assertNotIn('dummy', str(error.exception))

    def test_catalog_failure_distinct_from_empty(self):
        invalid = self.client([Response({})])
        with self.assertRaises(probe.ProbeError): probe.fetch_models('Mock', 'https://example.invalid', 'dummy', invalid)
        valid = self.client([Response({'data': []})])
        self.assertEqual(probe.fetch_models('Mock', 'https://example.invalid', 'dummy', valid), [])

    def test_gemini_pagination_header_auth_and_cache(self):
        client = self.client([Response({'models': [{'name': 'models/a'}], 'nextPageToken': 'next'}), Response({'models': [{'name': 'models/b'}]})])
        for _ in range(2):
            self.assertEqual(probe.fetch_models('Gemini API', 'ignored', 'dummy', client), ['a', 'b'])
        self.assertEqual(client.requests, 2)
        for call in client.opener.open.call_args_list:
            self.assertNotIn('dummy', call.args[0].full_url)
            self.assertEqual(call.args[0].get_header('X-goog-api-key'), 'dummy')

    def test_media_and_batch_do_not_call_network(self):
        client = self.client([])
        for model in ('flux-image', 'eleven_sound_v1', 'seedance-2.5',
                      'model-batch', 'text-embedding'):
            result = probe.test_model_pipeline('Mock', 'https://example.invalid', 'dummy', model, client)
            self.assertNotEqual(result['status'], 'SUCCESS')
        self.assertEqual(client.requests, 0)

    def test_provider_missing_credential_visible(self):
        with patch.object(app, 'get_secret', return_value=None):
            result = app.probe_provider({'name': 'Mock', 'cred_name': 'Mock', 'base_url': 'https://example.invalid'}, None)
        self.assertEqual(result['status'], 'MISSING_CREDENTIAL')

    def test_provider_catalog_failure_visible(self):
        options = SimpleNamespace(max_requests=1, timeout=1, ca_file=None, retries=0)
        with patch.object(app, 'get_secret', return_value='dummy'), patch.object(app, 'fetch_models', side_effect=probe.ProbeError('NETWORK', '连接失败')):
            result = app.probe_provider({'name': 'Mock', 'cred_name': 'Mock', 'base_url': 'https://example.invalid'}, options)
        self.assertEqual(result['status'], 'CATALOG_FAILED')

    def test_provider_sampling_preserves_unprobed_models(self):
        options = SimpleNamespace(max_requests=10, timeout=1, ca_file=None, retries=0, max_models=1, workers=2)
        client = self.client([Response(chat())])
        provider = {'name': 'Mock', 'cred_name': 'Mock', 'base_url': 'https://example.invalid', 'all_models': True}
        with patch.object(app, 'get_secret', return_value='dummy'), patch.object(app, 'ProbeClient', return_value=client), patch.object(app, 'fetch_models', return_value=['alpha', 'beta', 'flux-image']), patch('builtins.print'):
            result = app.probe_provider(provider, options)
        self.assertEqual(result['total_models'], 3)
        self.assertEqual([m['status'] for m in result['tested_models']], ['SUCCESS', 'CATALOG_ONLY', 'SKIPPED_MEDIA'])
        self.assertEqual(client.requests, 1)


class MarkupParser(HTMLParser):
    def __init__(self): super().__init__(); self.scripts = 0; self.bad_attrs = []; self.rows = 0
    def handle_starttag(self, tag, attrs):
        if tag == 'script': self.scripts += 1
        if tag == 'tr' and 'data-status' in dict(attrs): self.rows += 1
        self.bad_attrs.extend(name for name, value in attrs if name.startswith('on'))


class ReportTests(unittest.TestCase):
    def test_markup_escaping_snapshot_roundtrip_and_original_unchanged(self):
        hostile = '\"><img src=x onerror=alert(1)></script><script>alert(2)</script>&'
        results = [dict(provider=hostile, base_url="https://example.invalid/'", status='CATALOG_OK',
                        total_models=1, success_count=1, failed_count=0, tested_models=[dict(model=hostile, message=hostile,
                        protocol='Chat Completions', status='SUCCESS', latency_ms=10, attempts=[])])]
        original = copy.deepcopy(results)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'report.html'
            generate_html(results, path, generated_at='2026-01-01 00:00:00', historical=True)
            output = path.read_text(encoding='utf-8')
            parser = MarkupParser(); parser.feed(output)
            self.assertEqual(parser.scripts, 3)
            self.assertEqual(parser.bad_attrs, [])
            self.assertEqual(parser.rows, 1)
            self.assertNotIn('<img src=x', output)
            self.assertEqual(read_report(path)['results'], results)
            self.assertIn('● 成功', output)
            self.assertNotIn('历史报告', output)
            self.assertNotIn('历史成功', output)
        self.assertEqual(results, original)

    def test_atomic_write_preserves_report_on_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'report.html'; path.write_text('original')
            with patch('report_renderer.os.replace', side_effect=OSError('failure')), self.assertRaises(OSError):
                generate_html([], path)
            self.assertEqual(path.read_text(), 'original')
            self.assertEqual(list(Path(directory).glob('*.tmp')), [])


if __name__ == '__main__': unittest.main()
