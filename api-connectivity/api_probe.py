"""Bounded API probes. Importing this module never reads credentials or makes requests."""
import hashlib
import json
from email.utils import parsedate_to_datetime
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


class ProbeError(Exception):
    def __init__(self, kind, message, code=None):
        super().__init__(message)
        self.kind, self.code = kind, code


class NoRedirect(urllib.request.HTTPRedirectHandler):
    # Never forward authentication headers to an unexpected endpoint.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ProbeClient:
    def __init__(self, max_requests=100, timeout=15, ca_file=None, retries=1):
        self.context = ssl.create_default_context(cafile=ca_file)
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=self.context), NoRedirect())
        self.max_requests, self.timeout, self.retries = max_requests, timeout, retries
        self.requests = 0
        self.lock = threading.Lock()
        self.blocked_until = 0
        self.stop_error = None
        self.catalog_cache = {}  # Per-run memory only; credentials never go to disk.

    def request(self, url, key, payload=None, extra_headers=None):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.username or parsed.password:
            raise ProbeError('SECURITY', '仅允许不含用户凭据的 HTTPS 端点')
        headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                   'User-Agent': 'API-Connectivity-Report/2'}
        headers.update(extra_headers or {})
        for attempt in range(self.retries + 1):
            while True:
                with self.lock:
                    if self.stop_error:
                        raise ProbeError('PROVIDER_STOPPED', '服务商已停止后续请求：' + str(self.stop_error))
                    if self.requests >= self.max_requests:
                        raise ProbeError('BUDGET', '已达到本服务商请求上限；未完成验证')
                    delay = self.blocked_until - time.monotonic()
                    if delay <= 0:
                        self.requests += 1
                        break
                time.sleep(min(delay, 1))
            req = urllib.request.Request(url, headers=headers,
                data=json.dumps(payload).encode('utf-8') if payload is not None else None)
            try:
                with self.opener.open(req, timeout=self.timeout) as response:
                    raw = response.read(4 * 1024 * 1024 + 1)
                    if len(raw) > 4 * 1024 * 1024:
                        raise ProbeError('INVALID_RESPONSE', '响应超过 4 MiB 限制')
                    data = json.loads(raw.decode('utf-8'))
                    if not isinstance(data, dict) or data.get('error'):
                        raise ProbeError('INVALID_RESPONSE', '响应包含错误或不是 JSON 对象')
                    return data
            except urllib.error.HTTPError as exc:
                code = exc.code
                retry_after = exc.headers.get('Retry-After', '') if exc.headers else ''
                exc.close()
                kind = ('AUTH' if code in (401, 403) else 'QUOTA' if code == 402 else
                        'RATE_LIMIT' if code == 429 else 'SERVER' if code >= 500 else 'HTTP')
                error = ProbeError(kind, f'HTTP {code}（{kind}）', code)
                if kind in ('AUTH', 'QUOTA'):
                    with self.lock:
                        self.stop_error = error
                if kind in ('RATE_LIMIT', 'SERVER'):
                    try:
                        delay = float(retry_after) if retry_after.isdigit() else max(0, parsedate_to_datetime(retry_after).timestamp() - time.time())
                    except (ValueError, TypeError, OverflowError):
                        delay = 2 ** (attempt + 1)
                    # Do not retry earlier than a long provider-requested cooldown.
                    if delay > 30 or (kind == 'RATE_LIMIT' and attempt == self.retries):
                        with self.lock:
                            self.stop_error = error
                        raise error from None
                    if attempt < self.retries:
                        with self.lock:
                            self.blocked_until = max(self.blocked_until, time.monotonic() + delay)
                        continue
                raise error from None
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise ProbeError('INVALID_RESPONSE', '响应不是有效的 UTF-8 JSON') from None
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                reason = getattr(exc, 'reason', exc)
                kind = 'TLS' if isinstance(reason, ssl.SSLError) else 'NETWORK'
                # Never persist exception strings/URLs that may contain credentials.
                raise ProbeError(kind, '证书校验失败' if kind == 'TLS' else '连接失败或超时') from None


def fetch_models(name, base_url, key, client):
    cache_key = (name, base_url, hashlib.sha256(key.encode()).digest())
    if cache_key in client.catalog_cache:
        return list(client.catalog_cache[cache_key])
    gemini = name == 'Gemini API'
    url = ('https://generativelanguage.googleapis.com/v1beta/models' if gemini
           else base_url.rstrip('/') + '/models')
    models, page_tokens = [], set()
    for _ in range(100):
        data = client.request(url, key, extra_headers={'x-goog-api-key': key} if gemini else None)
        items = data.get('data', data.get('models'))
        if not isinstance(items, list):
            raise ProbeError('INVALID_RESPONSE', '目录响应缺少模型列表')
        for item in items:
            model = item.get('id') or item.get('name') if isinstance(item, dict) else item
            if not isinstance(model, str) or not model.strip():
                raise ProbeError('INVALID_RESPONSE', '目录含无效模型标识')
            models.append(model.removeprefix('models/') if gemini else model)
        token = data.get('nextPageToken') if gemini else None
        if not token:
            answer = sorted(set(models), key=str.casefold)
            client.catalog_cache[cache_key] = tuple(answer)
            return answer
        if not isinstance(token, str) or token in page_tokens:
            raise ProbeError('INVALID_RESPONSE', '目录分页标记无效或重复')
        page_tokens.add(token)
        url = 'https://generativelanguage.googleapis.com/v1beta/models?' + urllib.parse.urlencode({'pageToken': token})
    raise ProbeError('INVALID_RESPONSE', '目录分页超过安全上限')


def skipped_model(model):
    name = model.lower()
    if ':batch' in name or name.endswith('-batch'):
        status, protocol, message = 'BATCH_API', 'Batch（名称推断）', '可能为批处理模型，未调用验证'
    elif any(x in name for x in ('wan2', 'flux', 'sd-', 'image', 'kolors', 'veo', 'video',
                                 'seedance', 'kling', 'sora', 'audio', 'tts', 'realtime',
                                 'voice', 'speech', 'whisper', 'lyria', 'transcribe',
                                 'eleven_', 'sound', 'music')):
        status, protocol, message = 'SKIPPED_MEDIA', 'Media/Multi-modal', '名称推断为媒体模型，免消耗跳过'
    elif any(x in name for x in ('embed', 'bge', 'rerank', 'aqa', 'clip')):
        status, protocol, message = 'SKIPPED_EMBEDDING', 'Embeddings/Rerank', '名称推断为向量/重排模型，跳过'
    else:
        return None
    return dict(model=model, status=status, protocol=protocol, message=message, latency_ms=0, attempts=[])


def response_text(data, protocol):
    """Require a finished assistant text response, not merely an HTTP 2xx."""
    if not isinstance(data, dict) or data.get('error'):
        raise ProbeError('INVALID_RESPONSE', '响应包含错误')
    if protocol == 'Chat Completions':
        choices = data.get('choices')
        choice = choices[0] if isinstance(choices, list) and choices else {}
        if not isinstance(choice, dict):
            choice = {}
        message = choice.get('message')
        if not isinstance(message, dict) or message.get('role') != 'assistant' or choice.get('finish_reason') not in ('stop', 'length'):
            raise ProbeError('INVALID_RESPONSE', '缺少已完成的 assistant 回复')
        content = message.get('content')
        text = content if isinstance(content, str) else ''
        if isinstance(content, list):
            text = ''.join(b.get('text', '') for b in content if isinstance(b, dict) and isinstance(b.get('text'), str))
    elif protocol == 'Responses':
        if data.get('status') != 'completed' or not isinstance(data.get('output'), list):
            raise ProbeError('INVALID_RESPONSE', 'Responses 未完成或缺少 output')
        text = ''.join(b['text'] for item in data['output'] if isinstance(item, dict)
                      and item.get('type') == 'message' and item.get('role') == 'assistant'
                      and isinstance(item.get('content'), list)
                      for b in item['content'] if isinstance(b, dict) and b.get('type') == 'output_text'
                      and isinstance(b.get('text'), str))
    else:
        if data.get('type') != 'message' or data.get('role') != 'assistant' or data.get('stop_reason') not in ('end_turn', 'max_tokens', 'stop_sequence') or not isinstance(data.get('content'), list):
            raise ProbeError('INVALID_RESPONSE', 'Messages 未完成或缺少 assistant 内容')
        text = ''.join(b['text'] for b in data['content'] if isinstance(b, dict)
                      and b.get('type') == 'text' and isinstance(b.get('text'), str))
    if not text.strip():
        raise ProbeError('INVALID_RESPONSE', '未取得非空文本；不判定模型调用成功')
    return text.strip()


def test_model_pipeline(name, base_url, key, model, client):
    skipped = skipped_model(model)
    if skipped:
        return skipped
    attempts = []
    protocols = [
        ('Chat Completions', '/chat/completions', {'model': model, 'messages': [{'role': 'user', 'content': 'Hi'}], 'max_tokens': 32, 'stream': False}, {}),
        ('Responses', '/responses', {'model': model, 'input': 'Hi', 'max_output_tokens': 64}, {}),
        ('Anthropic Messages', '/messages', {'model': model, 'messages': [{'role': 'user', 'content': 'Hi'}], 'max_tokens': 32}, {'x-api-key': key, 'anthropic-version': '2023-06-01'})]
    for protocol, endpoint, payload, headers in protocols:
        start = time.perf_counter()
        try:
            data = client.request(base_url.rstrip('/') + endpoint, key, payload, headers)
            reply = response_text(data, protocol).replace(key, '[REDACTED]')
            latency = max(1, int((time.perf_counter() - start) * 1000))
            attempts.append(dict(protocol=protocol, outcome='SUCCESS', latency_ms=latency))
            return dict(model=model, status='SUCCESS', protocol=protocol, latency_ms=latency,
                        message='成功响应 ' + reply[:80], attempts=attempts)
        except ProbeError as exc:
            attempts.append(dict(protocol=protocol, outcome=exc.kind, latency_ms=int((time.perf_counter()-start)*1000), message=str(exc)))
            # Only protocol/parameter/response incompatibility warrants trying another API.
            if exc.kind != 'INVALID_RESPONSE' and not (exc.kind == 'HTTP' and exc.code in (400, 404, 405, 415, 422)):
                break
    not_tested = attempts and all(a['outcome'] in ('BUDGET', 'PROVIDER_STOPPED') for a in attempts)
    return dict(model=model, status='CATALOG_ONLY' if not_tested else 'FAILED',
                protocol='未完成验证' if not_tested else '已尝试协议未通过', latency_ms=0,
                message='；'.join(a['protocol'] + ': ' + a['message'] for a in attempts), attempts=attempts)
