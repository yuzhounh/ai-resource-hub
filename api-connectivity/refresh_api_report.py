import argparse
import ctypes
from ctypes import wintypes
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from api_probe import ProbeClient, ProbeError, fetch_models, skipped_model, test_model_pipeline
from report_renderer import generate_html

class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ('Flags', wintypes.DWORD),
        ('Type', wintypes.DWORD),
        ('TargetName', wintypes.LPWSTR),
        ('Comment', wintypes.LPWSTR),
        ('LastWritten', wintypes.FILETIME),
        ('CredentialBlobSize', wintypes.DWORD),
        ('CredentialBlob', ctypes.POINTER(ctypes.c_byte)),
        ('Persist', wintypes.DWORD),
        ('AttributeCount', wintypes.DWORD),
        ('Attributes', ctypes.c_void_p),
        ('TargetAlias', wintypes.LPWSTR),
        ('UserName', wintypes.LPWSTR),
    ]

PCREDENTIAL = ctypes.POINTER(CREDENTIAL)
CredRead = ctypes.windll.Advapi32.CredReadW
CredRead.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(PCREDENTIAL)]
CredRead.restype = wintypes.BOOL
CredFree = ctypes.windll.Advapi32.CredFree
CredFree.argtypes = [ctypes.c_void_p]

def get_secret(target_name):
    cred_ptr = PCREDENTIAL()
    if CredRead(target_name, 1, 0, ctypes.byref(cred_ptr)):
        cred = cred_ptr.contents
        size = cred.CredentialBlobSize
        raw_bytes = bytes(cred.CredentialBlob[:size])
        CredFree(cred_ptr)
        if size % 2 == 0 and b'\x00' in raw_bytes:
            try:
                val = raw_bytes.decode('utf-16-le').strip('\x00').strip()
                if '\x00' not in val and len(val) > 0:
                    return val
            except Exception:
                pass
        try:
            val = raw_bytes.decode('utf-8').strip('\x00').strip()
            if '\x00' not in val and len(val) > 0:
                return val
        except Exception:
            pass
        return raw_bytes.decode('latin-1').strip('\x00').strip()
    return None

PROVIDERS = [
    {"name": "AMD Radeon Cloud API", "cred_name": "AMD Radeon Cloud API", "base_url": "https://developer.amd.com.cn/radeon/api/v1", "all_models": True},
    {"name": "B.AI API", "cred_name": "B.AI API", "base_url": "https://api.b.ai/v1", "all_models": True},
    {"name": "DeepSeek API", "cred_name": "DeepSeek API", "base_url": "https://api.deepseek.com/v1", "all_models": True},
    {"name": "Flatkey API", "cred_name": "Flatkey API", "base_url": "https://router.flatkey.ai/v1", "all_models": False, "sample_limit": 25},
    {"name": "Gemini API", "cred_name": "Gemini API", "base_url": "https://generativelanguage.googleapis.com/v1beta/openai", "all_models": True},
    {"name": "GLM API", "cred_name": "GLM API", "base_url": "https://open.bigmodel.cn/api/paas/v4", "all_models": True},
    {"name": "GPTs API", "cred_name": "GPTs API", "base_url": "https://api.gptsapi.net/v1", "all_models": True},
    {"name": "Kimi API", "cred_name": "Kimi API", "base_url": "https://api.moonshot.cn/v1", "all_models": True},
    {"name": "NVIDIA NIM API", "cred_name": "NVIDIA NIM API", "base_url": "https://integrate.api.nvidia.com/v1", "all_models": False, "sample_limit": 25},
    {"name": "Ollama Cloud API", "cred_name": "Ollama Cloud API", "base_url": "https://ollama.com/v1", "all_models": True},
    {"name": "OpenCode Go", "cred_name": "OpenCode Go", "base_url": "https://opencode.ai/zen/go/v1", "all_models": True},
    {"name": "OpenRouter API", "cred_name": "OpenRouter API", "base_url": "https://openrouter.ai/api/v1", "all_models": False, "sample_limit": 25},
    {"name": "Qwen API", "cred_name": "Qwen API", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "all_models": False, "sample_limit": 25},
    {"name": "Qwen Token Plan", "cred_name": "Qwen Token Plan", "base_url": "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", "all_models": True},
    {"name": "SiliconFlow API", "cred_name": "SiliconFlow API", "base_url": "https://api.siliconflow.cn/v1", "all_models": False, "sample_limit": 25},
    {"name": "TokenRhythm API", "cred_name": "TokenRhythm API", "base_url": "https://tokenrhythm.studio/v1", "all_models": True}
]


def probe_provider(provider, options):
    name, base_url = provider['name'], provider['base_url']
    result = dict(provider=name, base_url=base_url, status='MISSING_CREDENTIAL',
                  message='未找到 Windows 凭据', total_models=0, success_count=0,
                  failed_count=0, skipped_count=0, tested_models=[], requests=0)
    key = get_secret(provider['cred_name']) or get_secret(name)
    if not key:
        return result
    client = ProbeClient(max_requests=options.max_requests, timeout=options.timeout,
                         ca_file=options.ca_file, retries=options.retries)
    try:
        models = fetch_models(name, base_url, key, client)
    except ProbeError as exc:
        result.update(status='CATALOG_FAILED', message=str(exc), requests=client.requests)
        return result
    result.update(status='CATALOG_OK' if models else 'CATALOG_EMPTY',
                  message='目录获取成功；可用性以模型实测为准' if models else '目录请求成功，但未返回模型',
                  total_models=len(models))
    candidates = [m for m in models if skipped_model(m) is None]
    limit = options.max_models
    if not provider.get('all_models'):
        limit = min(limit, provider.get('sample_limit', 25))
    selected = set(candidates[:limit])
    tested = []
    with ThreadPoolExecutor(max_workers=options.workers) as executor:
        futures = {executor.submit(test_model_pipeline, name, base_url, key, model, client): model
                   for model in candidates[:limit]}
        for future in as_completed(futures):
            model = futures[future]
            try:
                item = future.result()
            except Exception:
                item = dict(model=model, status='FAILED', protocol='探测异常', latency_ms=0,
                            message='内部探测异常；未判定成功', attempts=[])
            tested.append(item)
            print(f"    [{item['status']}] {model.replace(key, '[REDACTED]')}")
    for model in models:
        if model not in selected:
            tested.append(skipped_model(model) or dict(model=model, status='CATALOG_ONLY',
                protocol='Catalog', latency_ms=0, message='仅目录收录；本次未测试', attempts=[]))
    # Redact known credentials even if an upstream model ID or reply echoes them.
    for item in tested:
        for field in ('model', 'message'):
            item[field] = item[field].replace(key, '[REDACTED]')
    result.update(tested_models=sorted(tested, key=lambda x: x['model'].casefold()), requests=client.requests,
                  success_count=sum(x['status'] == 'SUCCESS' for x in tested),
                  failed_count=sum(x['status'] == 'FAILED' for x in tested),
                  skipped_count=sum(x['status'] not in ('SUCCESS', 'FAILED') for x in tested))
    return result


def positive_int(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError('必须为正整数')
    return number


def main():
    parser = argparse.ArgumentParser(description='有请求上限的 API 连通性检查；实时探测可能产生费用')
    parser.add_argument('--render-only', action='store_true', help='只用当前报告数据更新页面，不读取凭据或访问网络')
    parser.add_argument('--max-models', type=positive_int, default=25, help='每个服务商最多探测的模型数，默认 25')
    parser.add_argument('--max-requests', type=positive_int, default=100, help='每个服务商请求总上限，含目录、回退和重试')
    parser.add_argument('--workers', type=positive_int, default=3)
    parser.add_argument('--timeout', type=positive_int, default=15)
    parser.add_argument('--retries', type=int, choices=(0, 1, 2), default=1, help='仅限流及服务端 HTTP 错误可重试')
    parser.add_argument('--ca-file', help='可选可信 CA PEM 文件；始终启用证书校验')
    options = parser.parse_args()
    report = Path(__file__).resolve().with_name('api_connectivity_report.html')
    if options.render_only:
        from report_import import read_report
        snapshot = read_report(report)
        generate_html(snapshot['results'], report, generated_at=snapshot['generated_at'],
                      historical=snapshot['historical'])
        print('已用现有数据更新页面；未调用 API。')
        return
    results = []
    for provider in sorted(PROVIDERS, key=lambda p: p['name'].casefold()):
        print(f"[+] Probing: {provider['name']}")
        results.append(probe_provider(provider, options))
    generate_html(results, report)
    print(f'报告已更新：{report}')


if __name__ == '__main__':
    main()

