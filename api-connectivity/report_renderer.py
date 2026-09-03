import copy
import datetime
import json
import os
import tempfile
from pathlib import Path
from html import escape

ASSETS = Path(__file__).resolve().parent

def generate_html(results, report_out, *, generated_at=None, historical=False):
    styles = ASSETS.joinpath("report.css").read_text(encoding="utf-8")
    theme_script = ASSETS.joinpath("theme.js").read_text(encoding="utf-8")
    app_script = ASSETS.joinpath("report.js").read_text(encoding="utf-8")
    results = copy.deepcopy(results)
    for provider in results:
        for item in provider.get('tested_models', []):
            if isinstance(item.get('message'), str):
                item['message'] = item['message'].replace('成功响应:', '成功响应')
    # Sort providers alphabetically A-Z
    results.sort(key=lambda x: x["provider"].lower())

    total_providers = len(results)
    active_providers = sum(p['status'] in ('CATALOG_OK', 'CATALOG_EMPTY') for p in results)
    missing_providers = sum(p['status'] == 'MISSING_CREDENTIAL' for p in results)
    failed_providers = sum(p['status'] == 'CATALOG_FAILED' for p in results)
    provider_summary = f'目录失败 {failed_providers} / 缺少凭据 {missing_providers}'
    success_label = '模型实测成功'
    success_short = '成功'
    provider_value = str(active_providers)
    provider_labels = {'CATALOG_OK': '目录获取成功', 'CATALOG_EMPTY': '目录为空',
                       'MISSING_CREDENTIAL': '缺少凭据', 'CATALOG_FAILED': '目录获取失败',
                       'HISTORICAL': '目录获取成功'}
    
    all_tested_items = []
    for p in results:
        # Sort each provider's models alphabetically A-Z
        p["tested_models"].sort(key=lambda x: x["model"].lower())
        for m in p["tested_models"]:
            item = dict(m)
            item["provider"] = p["provider"]
            item["base_url"] = p["base_url"]
            all_tested_items.append(item)

    # Sort all tested items by Provider (A-Z), then Model Name (A-Z)
    all_tested_items.sort(key=lambda x: (x["provider"].lower(), x["model"].lower()))

    total_success = sum(1 for x in all_tested_items if x["status"] == "SUCCESS")
    total_batch = sum(1 for x in all_tested_items if x["status"] == "BATCH_API")
    total_skipped = sum(1 for x in all_tested_items if "SKIPPED" in x["status"])
    total_catalog = sum(1 for x in all_tested_items if x["status"] == "CATALOG_ONLY")
    total_failed = sum(1 for x in all_tested_items if x["status"] == "FAILED")
    latencies = [x["latency_ms"] for x in all_tested_items if x["status"] == "SUCCESS" and x["latency_ms"] > 0]
    avg_latency = int(sum(latencies) / len(latencies)) if latencies else 0
    now_str = generated_at or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    snapshot = json.dumps(dict(version=2, results=results, generated_at=now_str, historical=historical), ensure_ascii=False)
    snapshot = snapshot.replace('&', r'\u0026').replace('<', r'\u003c').replace('>', r'\u003e')
    now_str = escape(now_str)
    proto_counts = {
        "Chat Completions": sum(1 for x in all_tested_items if "Chat Completions" in x["protocol"] or "OpenAI" in x["protocol"]),
        "Responses": sum(1 for x in all_tested_items if "Responses" in x["protocol"]),
        "Anthropic Messages": sum(1 for x in all_tested_items if "Anthropic Messages" in x["protocol"]),
        "Batch API": total_batch
    }

    copy_icon_svg = """<svg class="copy-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>"""
    refresh_icon_svg = """<svg class="refresh-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.6-4.6L3 8"></path><path d="M3 4v4h4"></path></svg>"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Windows 凭据 API Keys 多协议连通性验证报告</title>
    <script>{theme_script}</script>
    <style>{styles}</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="header-title">
            <h1>⚡ Windows 凭据 API 密钥多协议连通性验证报告</h1>
            <p>已配置 {total_providers} 个服务商 | 凭据通过 Windows 凭据管理器读取，不写入报告</p>
            <div class="protocol-tags">
                <span class="p-tag p-chat">● Chat Completions 优先探测</span>
                <span class="p-tag p-resp">● Responses 自动回退</span>
                <span class="p-tag p-anth">● Anthropic Messages 深度回退</span>
                <span class="p-tag p-batch">● Batch API 异步队列识别</span>
            </div>
        </div>
        <div class="header-right">
            <a href="../index.html#api" class="badge-secure" style="text-decoration: none; display: inline-flex; align-items: center; padding: 6px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 0.84rem;">← 返回 AI Resource Hub</a>
            <div class="badge-secure">本地连通性报告</div>
            <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="切换深色或浅色模式" title="切换深色/浅色模式">🌙</button>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label" id="providerStatLabel">目录请求成功 / 已配置</div>
            <div class="stat-value" id="providerStatValue">{provider_value} / {total_providers}</div>
            <div class="stat-sub" id="providerStatSub">{provider_summary}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label" id="successStatLabel">{success_label}</div>
            <div class="stat-value" id="successStatValue" style="color: var(--success-text);">{total_success}</div>
            <div class="stat-sub" id="successStatSub">Chat: {proto_counts['Chat Completions']} | Resp: {proto_counts['Responses']} | Anth: {proto_counts['Anthropic Messages']}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">免消耗 / Batch / 收录</div>
            <div class="stat-value" id="skippedStatValue" style="color: var(--warning-text);">{total_skipped + total_catalog + total_batch}</div>
            <div class="stat-sub" id="skippedStatSub">{total_batch} Batch推断 / {total_skipped} 分类跳过 / {total_catalog} 未测试</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">平均实时响应延迟</div>
            <div class="stat-value" id="latencyStatValue" style="color: var(--primary);">{avg_latency} ms</div>
            <div class="stat-sub" id="latencyStatSub">仅统计成功记录</div>
        </div>
    </div>

    <div class="section-title">
        <span>🏢 服务商与端点</span>
        <span style="font-size: 0.82rem; font-weight: normal; color: var(--text-muted);">（点击卡片或用 Tab 聚焦名称筛选；复制按钮仅复制地址）</span>
    </div>
    <div class="providers-grid">
"""

    for p in results:
        p_name = escape(p["provider"])
        p_url = escape(p["base_url"])
        provider_state = escape(provider_labels.get(p["status"], "状态未知"))
        provider_message = escape(p.get("message", ""))
        p_total = int(p["total_models"])
        p_success = sum(m['status'] == 'SUCCESS' for m in p['tested_models'])
        p_fail = sum(m['status'] == 'FAILED' for m in p['tested_models'])

        html += f"""
        <div class="provider-card" data-provider="{p_name}">
            <div class="provider-card-head"><button type="button" class="provider-name provider-select" data-provider="{p_name}" aria-pressed="false" aria-label="筛选 {p_name}">{p_name}</button></div>
            <p class="provider-state" title="{provider_message}">{provider_state} · {provider_message}</p>
            <div class="url-box">
                <span class="provider-url" title="{p_url}">{p_url}</span>
                <button class="copy-btn" data-copy-url="{p_url}" aria-label="复制 {p_name} 的 Base URL" title="复制 Base URL">
                    {copy_icon_svg}
                </button>
            </div>
            <div class="provider-metrics">
                <div class="metric-item">目录模型: <b>{p_total}</b></div>
                <div class="metric-item">{success_short}: <b style="color: var(--success-text);">{p_success}</b></div>
                {f'<div class="metric-item">未通过: <b style="color: var(--danger-text);">{p_fail}</b></div>' if p_fail > 0 else ''}
            </div>
        </div>
        """

    html += f"""
    </div>

    <div class="section-title">
        <span>🔬 模型级调用与协议适配明细</span>
    </div>

    <div class="table-controls">
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="搜索模型名称、服务商或协议类型..." aria-label="搜索模型名称、服务商或协议类型">
        </div>
        <div class="filter-tags">
            <button class="filter-btn active" data-status="ALL" aria-pressed="true">全部 ({len(all_tested_items)})</button>
            <button class="filter-btn" data-status="SUCCESS" aria-pressed="false">{success_short} ({total_success})</button>
            <button class="filter-btn" data-status="BATCH" aria-pressed="false">Batch ({total_batch})</button>
            <button class="filter-btn" data-status="SKIPPED" aria-pressed="false">跳过/未测试 ({total_skipped + total_catalog})</button>
            <button class="filter-btn" data-status="FAILED" aria-pressed="false">探测失败 ({total_failed})</button>
            <button type="button" id="refreshScope" class="filter-btn refresh-text-btn" aria-label="刷新全部服务商">刷新全部</button>
        </div>
    </div>

    <p id="refreshStatus" role="status" aria-live="polite"></p>
    <p id="resultCount" role="status" aria-live="polite"></p>
    <p id="copyStatus" role="status" aria-live="polite"></p>
    <p id="emptyState" hidden>没有匹配的模型，请调整搜索或筛选条件。</p>
    <div class="table-container" role="region" aria-label="模型探测明细，可横向滚动" tabindex="0">
        <table id="modelsTable">
            <thead>
                <tr>
                    <th>服务商</th>
                    <th>模型名称 (Model ID)</th>
                    <th class="sortable" data-sort="protocol" tabindex="0" aria-sort="none">生效协议<span class="sort-ind">↕</span></th>
                    <th class="sortable" data-sort="latency" tabindex="0" aria-sort="none">响应延迟<span class="sort-ind">↕</span></th>
                    <th class="sortable" data-sort="status" tabindex="0" aria-sort="none">状态<span class="sort-ind">↕</span></th>
                    <th>探测结果 / 响应详情</th>
                </tr>
            </thead>
            <tbody>
    """

    for item in all_tested_items:
        st = item["status"]
        proto = item["protocol"]
        msg = escape(item["message"])
        provider = escape(item['provider'])
        model = escape(item['model'])
        detail = item['message']
        if item.get('attempts'):
            detail += '\n' + '\n'.join(a['protocol'] + ': ' + a['outcome'] + ' (' + str(a['latency_ms']) + ' ms)' for a in item['attempts'])
        escaped_msg = escape(detail)
        proto = escape(proto)

        if st == "SUCCESS":
            status_html, status_cat = '<span class="status-text success">● 成功</span>', "SUCCESS"
        elif st == "BATCH_API":
            status_html, status_cat = '<span class="status-text batch" title="名称推断，未调用验证">● Batch</span>', "BATCH"
        elif "SKIPPED" in st:
            status_html, status_cat = '<span class="status-text warning">▲ 免消耗</span>', "SKIPPED"
        elif st == "CATALOG_ONLY":
            status_html, status_cat = '<span class="status-text info">ℹ 目录收录</span>', "SKIPPED"
        else:
            status_html, status_cat = '<span class="status-text danger">✕ 失败</span>', "FAILED"

        display_proto = proto.replace(" / ", " /<br>") if " / " in proto else proto

        if "Chat Completions" in proto or "OpenAI" in proto:
            proto_html = f'<span class="proto-text chat">{display_proto}</span>'
        elif "Responses" in proto:
            proto_html = f'<span class="proto-text resp">{display_proto}</span>'
        elif "Anthropic Messages" in proto:
            proto_html = f'<span class="proto-text anth">{display_proto}</span>'
        elif "Batch API" in proto:
            proto_html = f'<span class="proto-text batch">{display_proto}</span>'
        else:
            proto_html = f'<span class="proto-text meta">{display_proto}</span>'

        lat = int(item["latency_ms"])
        lat_class = "fast" if lat < 1000 and lat > 0 else ("medium" if lat < 3000 else "slow")
        lat_str = f"{lat} ms" if lat > 0 else "-"

        html += f"""
                <tr data-provider="{provider}" data-status="{status_cat}">
                    <td><b>{provider}</b></td>
                    <td class="model-name" title="{model}">{model}</td>
                    <td>{proto_html}</td>
                    <td><span class="latency {lat_class}">{lat_str}</span></td>
                    <td>{status_html}</td>
                    <td class="detail-cell" title="{escaped_msg}">{msg}</td>
                </tr>
        """

    html += f"""
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>报告生成时间: {now_str} | 报告不包含凭据；模型回复和探测信息仅供本地查看</p>
    </div>
</div>

<script type="application/json" id="reportData">{snapshot}</script>
<script>{app_script}</script>
</body>
</html>
    """

    target = Path(report_out)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False, suffix='.tmp') as f:
            temp_path = Path(f.name)
            f.write(html)
        os.replace(temp_path, target)
        if target.name == 'api_connectivity_report.html':
            hub_index = target.parent.parent / 'index.html'
            if hub_index.is_file():
                _sync_to_hub(hub_index, html)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def _sync_to_hub(hub_index_path, report_html):
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(report_html, 'html.parser')
        stats = soup.find('div', class_='stats-grid')
        providers = soup.find('div', class_='providers-grid')
        table_ctrl = soup.find('div', class_='table-controls')
        if table_ctrl:
            sb = table_ctrl.find('div', class_='search-box')
            if sb:
                sb.decompose()
        table_cont = soup.find('div', class_='table-container')
        r_data = soup.find('script', id='reportData')
        if not (stats and providers and table_ctrl and table_cont and r_data):
            return

        content = hub_index_path.read_text(encoding='utf-8')
        start_marker = '<div id="view-connectivity" class="view view-connectivity" role="tabpanel" aria-labelledby="tab-connectivity" hidden>'
        view_start = content.find(start_marker)
        if view_start == -1:
            return
        next_view_start = content.find('<div id="view-', view_start + len(start_marker))
        if next_view_start == -1:
            return

        view_conn_html = f"""{start_marker}
      <p class="view-summary">Windows 凭据 API 密钥多协议连通性验证报告；16 服务商实测快照与协议适配明细。</p>
      <div class="view-toolbar">
        <div class="search"><input id="connectivity-search" type="search" placeholder="搜索服务商、模型名称或协议…（按 / 聚焦）"></div>
        <nav class="subnav">
          <a href="#connectivity/conn-stats">整体统计</a>
          <a href="#connectivity/conn-providers">服务商与端点 <em>16</em></a>
          <a href="#connectivity/conn-models">模型实测明细 <em>202</em></a>
        </nav>
      </div>
      <section id="conn-stats" data-title="整体统计">
        <div class="section-title"><h2>整体统计快照</h2></div>
        {str(stats)}
      </section>
      <section id="conn-providers" data-title="服务商与端点">
        <div class="section-title">
          <h2>服务商与端点 <span>16</span></h2>
          <small>点击服务商卡片可筛选模型；复制按钮复制 Base URL</small>
        </div>
        {str(providers)}
      </section>
      <section id="conn-models" data-title="模型实测明细">
        <div class="section-title"><h2>模型级调用与协议适配明细</h2></div>
        {str(table_ctrl)}
        {str(table_cont)}
      </section>
      {str(r_data)}
      <footer>凭据通过 Windows 凭据管理器读取，不保存在前端页面中；测试耗时包含协议回退与重试。连通性结果以实际调用为准。</footer>
    </div>"""
        new_content = content[:view_start] + view_conn_html.strip() + '\n    ' + content[next_view_start:]
        hub_index_path.write_text(new_content, encoding='utf-8')
    except Exception:
        pass


