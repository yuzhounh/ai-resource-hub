"""Loopback-only UI server. The browser never receives credentials."""
import argparse, json, secrets, threading, webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import refresh_api_report as app
from api_probe import ProbeError
from report_import import read_report
from report_renderer import generate_html

ROOT = Path(__file__).resolve().parent
REPORT = ROOT / 'api_connectivity_report.html'
REFRESH_LOCK = threading.Lock()

class State:
    def __init__(self, token, options): self.token, self.options = token, options
    def refresh(self, provider_name=None):
        with REFRESH_LOCK:
            snapshot = read_report(REPORT); results = snapshot['results']
            targets = [p for p in app.PROVIDERS if provider_name is None or p['name'] == provider_name]
            if provider_name is not None and not targets: raise ValueError('未知服务商')
            refreshed = {p['name']: app.probe_provider(p, self.options) for p in targets}
            by_name = {p['provider']: p for p in results}
            for name, result in refreshed.items(): result['historical'] = False; by_name[name] = result
            for result in results: result.setdefault('historical', True)
            generate_html(list(by_name.values()), REPORT, generated_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'), historical=provider_name is not None)
            return {'scope': 'all' if provider_name is None else provider_name, 'refreshed': list(refreshed)}

class Handler(BaseHTTPRequestHandler):
    server_version = 'APIReport/1'
    def log_message(self, *_): pass
    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8'); self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/status': self.send_json(200, {'running': True, 'refreshEnabled': True}); return
        if path in ('/', '/api_connectivity_report.html'):
            html = REPORT.read_text(encoding='utf-8').replace('<html lang="zh-CN"', f'<html lang="zh-CN" data-refresh-token="{self.server.state.token}"', 1)
            data = html.encode('utf-8'); self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        self.send_json(404, {'error': 'Not found'})
    def do_POST(self):
        if urlparse(self.path).path != '/api/refresh': self.send_json(404, {'error': 'Not found'}); return
        if self.headers.get('X-Refresh-Token') != self.server.state.token: self.send_json(403, {'error': '刷新令牌无效'}); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 4096: raise ValueError('请求过大')
            body = json.loads(self.rfile.read(length) or b'{}'); provider = body.get('provider')
            if provider is not None and not isinstance(provider, str): raise ValueError('服务商参数无效')
            self.send_json(200, self.server.state.refresh(provider))
        except (ValueError, ProbeError) as exc: self.send_json(400, {'error': str(exc)})
        except Exception: self.send_json(500, {'error': '刷新失败；详情请查看启动窗口'})

def main():
    parser = argparse.ArgumentParser(description='启动本机 API 报告刷新服务')
    parser.add_argument('--port', type=int, default=8765); parser.add_argument('--max-models', type=app.positive_int, default=25); parser.add_argument('--max-requests', type=app.positive_int, default=100); parser.add_argument('--workers', type=app.positive_int, default=3); parser.add_argument('--timeout', type=app.positive_int, default=15); parser.add_argument('--retries', type=int, choices=(0, 1, 2), default=1); parser.add_argument('--ca-file'); parser.add_argument('--no-browser', action='store_true')
    options = parser.parse_args(); token = secrets.token_urlsafe(32); server = ThreadingHTTPServer(('127.0.0.1', options.port), Handler); server.state = State(token, options); url = f'http://127.0.0.1:{options.port}/'
    print(f'本地报告服务已启动：{url}\n仅监听本机；关闭此窗口即可停止服务。刷新操作可能产生 API 费用。')
    if not options.no_browser: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
