$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsRaw = Get-Content -Raw -Encoding UTF8 (Join-Path $workspace 'ai_navigator.html')
$apiRaw = Get-Content -Raw -Encoding UTF8 (Join-Path $workspace 'ai_api_navigator.html')
$agentsRaw = Get-Content -Raw -Encoding UTF8 (Join-Path $workspace 'ai_agent_landscape.html')

$tools = [regex]::Match($toolsRaw, '(?s)<body><main>(.*?)</main><script>').Groups[1].Value
$api = [regex]::Match($apiRaw, '(?s)<main class="container">(.*?)</main>').Groups[1].Value
$agents = [regex]::Match($agentsRaw, '(?s)<body><main>(.*?)</main>\s*<script>').Groups[1].Value

if (-not $tools -or -not $api -or -not $agents) {
  throw 'Unable to extract one or more source pages.'
}

$tools = $tools.Replace('id="q"', 'id="tools-search"')
$tools = $tools.Replace('<h1>AI Navigator</h1>', '')
$tools = $tools.Replace('AI 助手、搜索、科研、Coding / Agent、模型平台、榜单与工具导航 · 共 162 个入口', 'AI 助手、搜索、科研、Coding / Agent、模型平台、榜单与工具导航。')
$tools = $tools.Replace('<p class="sub">', '<p class="view-summary">')
$tools = $tools.Replace('<input id="tools-search" ', '<input id="tools-search" type="search" ')
$mimoCard = '<a class="card" href="https://aistudio.xiaomimimo.com/#/c" target="_blank" rel="noopener"><b>Xiaomi MiMo Studio</b><small>小米</small></a>'
$mimoReplacement = '$1' + $mimoCard + '$2'
$tools = [regex]::Replace(
  $tools,
  '(?s)(<section id="s1".*?<div class="grid">.*?)(</div></section><section id="s2")',
  $mimoReplacement,
  1
)
$tools = $tools.Replace('通用 AI 助手 <em>27</em>', '通用 AI 助手 <em>28</em>')
$tools = $tools.Replace('通用 AI 助手 <span>27</span>', '通用 AI 助手 <span>28</span>')
$tools = [regex]::Replace($tools, 'href="#(s\d+)"', 'href="#tools/$1"')
$tools = [regex]::Replace(
  $tools,
  '(?s)<div class="search">(.*?)</div><nav>(.*?)</nav>',
  '<div class="view-toolbar"><div class="search">$1</div><nav class="subnav">$2</nav></div>',
  1
)

$agents = $agents.Replace('id="search"', 'id="agents-search"')
$agents = [regex]::Replace(
  $agents,
  '(?s)<header class="hero">.*?</header>',
  '<p class="view-summary">Agent 生态地图，覆盖 AI 编程、知识工作、桌面 / 浏览器操作、常驻个人 Agent，以及 Coding / Token Plan、API Router、基础模型与 Chat 产品。</p>',
  1
)
$agents = [regex]::Replace($agents, 'href="#([a-z][a-z0-9-]*)"', 'href="#agents/$1"')
$agents = $agents.Replace('<div class="toolbar">', '<div class="view-toolbar">')
$agents = $agents.Replace('<nav class="nav">', '<nav class="subnav">')

$apiSections = [ordered]@{
  '模型厂商代表方案 · 国内' = 'api-models-cn'
  '模型厂商代表方案 · 国外' = 'api-models-global'
  'API Router / 聚合平台 · 国内' = 'api-router-cn'
  'API Router / 聚合平台 · 国外' = 'api-router-global'
}
foreach ($entry in $apiSections.GetEnumerator()) {
  $old = "<section>`r`n      <h2>$($entry.Key)</h2>"
  $new = "<section id=`"$($entry.Value)`" data-title=`"$($entry.Key)`">`r`n      <h2>$($entry.Key)</h2>"
  $api = $api.Replace($old, $new)
}
$api = $api.Replace('<h1>AI API Console Navigator</h1>', '')

$apiToolbar = @'
    <div class="view-toolbar">
      <div class="search"><input id="api-search" type="search" placeholder="搜索平台、API Key、Usage、套餐或文档…（按 / 聚焦）" aria-label="搜索 API 控制台导航"></div>
      <nav class="subnav" aria-label="API 控制台分类">
        <a href="#api/api-models-cn">模型厂商·国内 <em data-count-for="api-models-cn">—</em></a>
        <a href="#api/api-models-global">模型厂商·国外 <em data-count-for="api-models-global">—</em></a>
        <a href="#api/api-router-cn">API Router·国内 <em data-count-for="api-router-cn">—</em></a>
        <a href="#api/api-router-global">API Router·国外 <em data-count-for="api-router-global">—</em></a>
      </nav>
    </div>
    <p class="empty-state" id="api-empty" hidden>没有找到匹配的平台或入口。</p>
'@
$apiSubtitle = '<p class="subtitle">模型厂商代表方案与 API Router / 聚合平台，按国内外分类，含 API Key、Usage、充值 / 套餐与文档入口。</p>'
$api = $api.Replace($apiSubtitle, "$apiSubtitle`r`n$apiToolbar")
$api = $api.Replace('<p class="subtitle">', '<p class="view-summary">')
$api = [regex]::Replace($api, '(?m)^[ \t]+(?=\r?$)', '')

$template = @'
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="AI 工具集、API 控制台与 Agent 生态地图的统一导航入口">
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <title>AI Resource Hub</title>
  <style>
    :root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--text:#17191c;--muted:#69707c;--line:#e3e6ea;--accent:#2563eb;--soft:#eef4ff;--warn:#fff7e6;--bar:color-mix(in srgb,var(--bg) 91%,transparent)}
    @media(prefers-color-scheme:dark){:root{--bg:#0d0f12;--card:#16191e;--text:#f3f4f6;--muted:#9aa3ad;--line:#2a3038;--accent:#8ab4ff;--soft:#172238;--warn:#2a2111}}
    *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:150px}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.55}
    a{color:var(--accent)}.app-shell{width:min(calc(100% - 44px),1280px);margin-inline:auto}.site-header{padding:30px 0 18px;text-align:center}.brand-title{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}.brand-title img{width:36px;height:36px;flex:0 0 auto}.site-header h1{font-size:34px;letter-spacing:-.03em;margin:0}.site-header p{color:var(--muted);margin:0}
    .primary-bar{position:sticky;top:0;z-index:30;background:var(--bar);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.primary-tabs{display:flex;flex-wrap:wrap;gap:8px;padding:10px 0}.primary-tabs a{flex:0 0 auto;color:var(--muted);font-weight:650;text-decoration:none;padding:9px 14px;border-radius:10px}.primary-tabs a:hover{color:var(--text);background:var(--card)}.primary-tabs a[aria-selected="true"]{color:var(--accent);background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
    .view{padding:28px 0 70px}.view[hidden]{display:none!important}.view-summary{height:25px;line-height:25px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--muted);font-size:16px;margin:0 0 20px}.view-toolbar{position:sticky;top:59px;z-index:20;padding:9px 0 12px;background:var(--bar);backdrop-filter:blur(12px)}.search input,.view-toolbar>input{width:100%;padding:13px 15px;border-radius:13px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:15px;outline:none}.search input:focus,.view-toolbar>input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 15%,transparent)}
    .subnav{display:flex;flex-wrap:wrap;gap:8px;padding:10px 0 0}.subnav a{flex:0 0 auto;white-space:nowrap;text-decoration:none;color:var(--text);border:1px solid var(--line);background:var(--card);padding:7px 10px;border-radius:999px;font-size:13px}.subnav a:hover,.subnav a.active{border-color:var(--accent);color:var(--accent)}.subnav em{font-style:normal;color:var(--muted)}
    section{scroll-margin-top:150px}.hidden{display:none!important}footer{color:var(--muted);font-size:13px;border-top:1px solid var(--line);padding-top:18px;margin-top:40px}.empty-state{background:var(--card);border:1px dashed var(--line);border-radius:13px;padding:22px;text-align:center;color:var(--muted)}

    .view-tools section{margin:26px 0 36px}.view-tools h1{margin:0;font-size:30px}.view-tools h2{font-size:21px;margin:0 0 12px}.view-tools h2 span{font-size:12px;font-weight:500;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 7px}.view-tools .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:10px}.view-tools .card{text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 14px;min-height:74px;display:flex;flex-direction:column;gap:6px;transition:.15s}.view-tools .card:hover{transform:translateY(-2px);border-color:var(--accent)}.view-tools .card b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.view-tools .card small{color:var(--muted)}

    .view-api h1{margin:0;font-size:30px}.view-api section{margin-top:34px}.view-api h2{margin:0 0 14px;font-size:22px}.view-api .table-wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.05)}.view-api table{width:100%;min-width:1000px;border-collapse:collapse;table-layout:fixed;font-size:14px}.view-api col.col-platform{width:18.18%}.view-api col.col-key,.view-api col.col-usage,.view-api col.col-billing{width:22.73%}.view-api col.col-docs{width:13.63%}.view-api th,.view-api td{padding:12px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);line-height:1.45;overflow-wrap:break-word;word-break:keep-all}.view-api th{background:color-mix(in srgb,var(--card) 78%,var(--soft));font-size:14px}.view-api tr:last-child td{border-bottom:0}.view-api td:first-child{font-weight:700}.view-api td a{font-weight:600;text-decoration:none}.view-api td a:hover{text-decoration:underline}.view-api .arrow{color:var(--muted);font-size:13px;margin-left:4px}

    .view-agents .view-intro{margin:0 0 18px}.view-agents .tagline{font-size:16px;color:var(--muted);margin:0 0 12px}.view-agents .meta{display:flex;gap:9px;flex-wrap:wrap;color:var(--muted);font-size:13px}.view-agents .badge{border:1px solid var(--line);background:var(--card);padding:4px 9px;border-radius:999px}.view-agents .intro{max-width:1100px;color:var(--muted);margin:14px 0 4px}.view-agents section{margin:34px 0 44px}.view-agents .section-title{display:flex;align-items:center;gap:10px;margin-bottom:12px}.view-agents h2{font-size:23px;margin:0}.view-agents h3{font-size:16px;margin:20px 0 10px;color:var(--muted)}.view-agents .table-intro{max-width:1100px;margin:0 0 12px;color:var(--muted);font-size:14px}.view-agents .table-wrap{overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:14px}.view-agents table{border-collapse:collapse;width:100%;min-width:860px}.view-agents th,.view-agents td{padding:12px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}.view-agents th{background:color-mix(in srgb,var(--card) 78%,var(--soft));font-size:13px;white-space:nowrap}.view-agents td{font-size:13.5px}.view-agents tr:last-child td{border-bottom:0}.view-agents td:first-child{font-weight:650;white-space:nowrap}.view-agents .lead-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.view-agents .lead-grid.five{grid-template-columns:repeat(5,1fr)}.view-agents .mini{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:14px;display:flex;flex-direction:column;gap:6px}.view-agents .mini span{font-size:13px;color:var(--muted)}.view-agents .concepts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.view-agents .concepts span{font-size:13px;border:1px solid var(--line);background:var(--card);padding:7px 10px;border-radius:10px}.view-agents .architecture{max-width:1050px;margin:auto;text-align:center}.view-agents .node{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 16px;margin:auto;max-width:650px}.view-agents .node.strong{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 15%,transparent)}.view-agents .node small{color:var(--muted)}.view-agents .arrow{color:var(--muted);font-size:22px;height:28px}.view-agents .branch{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.view-agents .branch .node{width:100%}.view-agents .fuel{margin-top:12px;color:var(--muted);font-size:13px}.view-agents .note{margin-top:12px;border:1px solid var(--line);background:var(--soft);border-radius:12px;padding:12px 14px;font-size:13px}.view-agents .note.warn{background:var(--warn)}.view-agents .steps{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 18px 15px 40px}.view-agents .steps li{margin:5px 0}
    @media(max-width:900px){.view-agents .lead-grid,.view-agents .lead-grid.five{grid-template-columns:repeat(2,1fr)}.view-agents .branch{grid-template-columns:1fr}.view-agents h1{font-size:30px}}
    @media(max-width:650px){.app-shell{width:calc(100% - 28px)}.site-header{padding:22px 0 14px}.site-header h1{font-size:29px}.primary-tabs a{padding:8px 11px}.view{padding-top:22px}.view-summary{height:3.1em;line-height:1.55;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}.view-toolbar{top:55px}.view-tools .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.view-agents .lead-grid,.view-agents .lead-grid.five{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="site-header app-shell">
    <div class="brand-title"><img src="./ai-resource-hub.svg" alt=""><h1>AI Resource Hub</h1></div>
    <p>AI 工具集、API 控制台与 Agent 生态地图的统一入口</p>
  </header>
  <div class="primary-bar">
    <nav class="primary-tabs app-shell" role="tablist" aria-label="资源分类">
      <a id="tab-tools" role="tab" href="#tools" aria-controls="view-tools">工具集</a>
      <a id="tab-api" role="tab" href="#api" aria-controls="view-api">API 控制台</a>
      <a id="tab-agents" role="tab" href="#agents" aria-controls="view-agents">Agent 生态地图</a>
    </nav>
  </div>
  <main class="app-shell">
    <div id="view-tools" class="view view-tools" role="tabpanel" aria-labelledby="tab-tools">__TOOLS__</div>
    <div id="view-api" class="view view-api" role="tabpanel" aria-labelledby="tab-api" hidden>__API__</div>
    <div id="view-agents" class="view view-agents" role="tabpanel" aria-labelledby="tab-agents" hidden>__AGENTS__</div>
  </main>
  <script>
    const viewNames=['tools','api','agents'];
    let activeView=null;

    function hashParts(){
      const parts=location.hash.slice(1).split('/').filter(Boolean);
      return {view:viewNames.includes(parts[0])?parts[0]:'tools',section:parts[1]||null};
    }
    function activateView(view,section){
      const firstLoad=activeView===null;
      viewNames.forEach(name=>{
        const selected=name===view;
        document.getElementById(`view-${name}`).hidden=!selected;
        const tab=document.getElementById(`tab-${name}`);
        tab.setAttribute('aria-selected',String(selected));
        tab.tabIndex=selected?0:-1;
      });
      const changed=!firstLoad&&activeView!==view;
      activeView=view;
      document.title=`${document.getElementById(`tab-${view}`).textContent} · AI Resource Hub`;
      requestAnimationFrame(()=>{
        if(section){
          const target=document.getElementById(section);
          if(target&&target.closest(`#view-${view}`)){
            const toolbar=document.querySelector(`#view-${view} .view-toolbar`);
            const offset=document.querySelector('.primary-bar').offsetHeight+(toolbar?toolbar.offsetHeight:0)+12;
            scrollTo({top:target.getBoundingClientRect().top+scrollY-offset,behavior:changed?'auto':'smooth'});
          }
        }else if(changed){
          scrollTo({top:document.querySelector('.primary-bar').offsetTop,behavior:'auto'});
        }
      });
    }
    function route(){const {view,section}=hashParts();activateView(view,section)}
    if(!location.hash) history.replaceState(null,'','#tools');
    addEventListener('hashchange',route);
    route();

    document.querySelector('.primary-tabs').addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index=viewNames.indexOf(activeView);
      const next=event.key==='Home'?0:event.key==='End'?viewNames.length-1:(index+(event.key==='ArrowRight'?1:-1)+viewNames.length)%viewNames.length;
      document.getElementById(`tab-${viewNames[next]}`).click();
      document.getElementById(`tab-${viewNames[next]}`).focus();
    });

    const toolsSearch=document.getElementById('tools-search');
    toolsSearch.addEventListener('input',()=>{
      const query=toolsSearch.value.trim().toLowerCase();
      document.querySelectorAll('#view-tools section').forEach(section=>{
        let visible=0;
        section.querySelectorAll('.card').forEach(card=>{
          const match=!query||(card.textContent+' '+section.dataset.cat).toLowerCase().includes(query);
          card.classList.toggle('hidden',!match);
          if(match) visible++;
        });
        section.classList.toggle('hidden',visible===0);
        const badge=document.querySelector(`#view-tools .subnav a[href="#tools/${section.id}"] em`);
        if(badge) badge.textContent=visible;
      });
    });

    const apiSearch=document.getElementById('api-search');
    function filterApi(){
      const query=apiSearch.value.trim().toLowerCase();
      let total=0;
      document.querySelectorAll('#view-api section').forEach(section=>{
        let visible=0;
        section.querySelectorAll('tbody tr').forEach(row=>{
          const match=!query||row.textContent.toLowerCase().includes(query);
          row.hidden=!match;
          if(match) visible++;
        });
        section.classList.toggle('hidden',visible===0);
        const badge=document.querySelector(`[data-count-for="${section.id}"]`);
        if(badge) badge.textContent=visible;
        const nav=document.querySelector(`#view-api .subnav a[href="#api/${section.id}"]`);
        if(nav) nav.classList.toggle('empty-match',visible===0);
        total+=visible;
      });
      document.getElementById('api-empty').hidden=total!==0;
    }
    apiSearch.addEventListener('input',filterApi);
    filterApi();

    const agentsSearch=document.getElementById('agents-search');
    agentsSearch.addEventListener('input',()=>{
      const query=agentsSearch.value.trim().toLowerCase();
      document.querySelectorAll('#view-agents section').forEach(section=>{
        const wraps=[...section.querySelectorAll('.table-wrap')];
        if(wraps.length){
          const titleMatch=!!query&&(section.dataset.title||'').toLowerCase().includes(query);
          let sectionMatches=0;
          wraps.forEach(wrap=>{
            let tableMatches=0;
            wrap.querySelectorAll('tbody tr').forEach(row=>{
              const match=!query||titleMatch||row.textContent.toLowerCase().includes(query);
              row.hidden=!match;
              if(match) tableMatches++;
            });
            wrap.classList.toggle('hidden',!!query&&tableMatches===0);
            sectionMatches+=tableMatches;
          });
          section.classList.toggle('hidden',!!query&&sectionMatches===0);
        }else{
          const match=!query||section.textContent.toLowerCase().includes(query)||(section.dataset.title||'').toLowerCase().includes(query);
          section.classList.toggle('hidden',!match);
        }
      });
    });

    document.addEventListener('keydown',event=>{
      const input={tools:toolsSearch,api:apiSearch,agents:agentsSearch}[activeView];
      if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){
        event.preventDefault();input.focus();
      }
      if(event.key==='Escape'&&document.activeElement===input){
        input.value='';input.dispatchEvent(new Event('input'));input.blur();
      }
    });

    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
      if(!visible) return;
      document.querySelectorAll(`#view-${activeView} .subnav a`).forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${activeView}/${visible.target.id}`));
    },{rootMargin:'-155px 0px -65% 0px',threshold:0});
    document.querySelectorAll('.view section[id]').forEach(section=>observer.observe(section));
  </script>
</body>
</html>
'@

$output = $template.Replace('__TOOLS__', $tools).Replace('__API__', $api).Replace('__AGENTS__', $agents)
Set-Content -Encoding UTF8 -NoNewline -Path (Join-Path $workspace 'ai_resource_hub.html') -Value $output
Set-Content -Encoding UTF8 -NoNewline -Path (Join-Path $workspace 'index.html') -Value $output
Write-Output 'Created ai_resource_hub.html and index.html'
