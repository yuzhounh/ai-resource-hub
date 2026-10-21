// Historical dataset: script dated 2026-09-30, original footer dated 2026-09-29.
// Preserved on 2026-10-21. Keep these original rows and source links unchanged.
const pricingSources = {
  OpenAI: { url: 'https://developers.openai.com/api/docs/pricing', label: 'OpenAI Developer' },
  Anthropic: { url: 'https://platform.claude.com/docs/en/about-claude/pricing', label: 'Anthropic' },
  Google: { url: 'https://ai.google.dev/gemini-api/docs/pricing', label: 'Google AI for Dev' },
  'SpaceXAI / Cursor': { url: 'https://docs.cursor.com/models', label: 'Cursor / xAI' },
  Meta: { url: 'https://dev.meta.ai/', label: 'Meta Model API' },
  xAI: { url: 'https://docs.x.ai/developers/models/grok-4.7', label: 'xAI Docs' },
  Cursor: { url: 'https://docs.cursor.com/models', label: 'Cursor Models' },
  DeepSeek: { url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', label: 'DeepSeek Docs' },
  Qwen: { url: 'https://help.aliyun.com/zh/model-studio/qwen3-8-flash', label: '阿里云百炼' },
  Kimi: { url: 'https://platform.moonshot.ai/docs/pricing', label: 'Moonshot Docs' },
  'GLM / Z.ai': { url: 'https://docs.z.ai/guides/overview/pricing', label: '智谱开放平台' },
  MiniMax: { url: 'https://platform.minimax.io/docs/guides/pricing', label: 'MiniMax Docs' },
  'Xiaomi MiMo': { url: 'https://platform.xiaomimimo.com/', label: 'Xiaomi MiMo' },
  '腾讯混元': { url: 'https://cloud.tencent.com/product/hunyuan', label: '腾讯云混元' },
  'Seed / 豆包': { url: 'https://www.volcengine.com/product/ark', label: '火山方舟' }
};

const pricingRows = [
  { vendor: 'OpenAI', model: 'GPT-6 Luna', input: '$0.10', cache: '$0.01', output: '$0.50', ratio: '0.05×', desc: '大批量、简单任务', emoji: '💰', type: 'budget' },
  { vendor: 'OpenAI', model: 'GPT-6.1 Sol', input: '$2.00', cache: '$0.10', output: '$10.00', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'OpenAI', model: 'GPT-6 Astra', input: '$10.00', cache: '$1.00', output: '$50.00', ratio: '5.00×', desc: '最高难度任务', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Anthropic', model: 'Claude Haiku 4.5', input: '$1.00', cache: '$0.10', output: '$5.00', ratio: '0.50×', desc: '低成本 / 子 Agent', emoji: '💰', type: 'budget' },
  { vendor: 'Anthropic', model: 'Claude Sonnet 5.5', input: '$2.00', cache: '$0.20', output: '$10.00', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Anthropic', model: 'Claude Opus 5.5', input: '$4.00', cache: '$0.20', output: '$20.00', ratio: '2.00×', desc: '高难 Coding / Agent', emoji: '🧠', type: 'reasoning' },
  { vendor: 'Anthropic', model: 'Claude Fable 5.1', input: '$10.00', cache: '$0.25', output: '$50.00', ratio: '5.00×', desc: '极限档 / 超长程复杂任务', emoji: '🚀', type: 'extreme' },

  { vendor: 'Google', model: 'Gemini 3.8 Flash', input: '$0.75', cache: '$0.075', output: '$3.75', ratio: '1.00×', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Google', model: 'Gemini 3.1 Pro', input: '$2.00', cache: '$0.20', output: '$12.00', ratio: '3.11×', desc: '复杂知识 / 多模态推理', emoji: '🧠', type: 'reasoning' },

  { vendor: 'SpaceXAI / Cursor', model: 'Composer 2.5', input: '$0.50', cache: '$0.20', output: '$2.50', ratio: '1.00×', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'SpaceXAI / Cursor', model: 'Grok 4.7', input: '$2.00', cache: '$0.50', output: '$6.00', ratio: '2.67×', desc: '更困难、长程 Coding / Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Meta', model: 'Muse Spark (Contributor)', input: '$0.10', cache: '$0.002', output: '$0.20', ratio: '0.06×', desc: '极低成本 / 共享训练数据', emoji: '💰', type: 'budget' },
  { vendor: 'Meta', model: 'Muse Spark', input: '$1.25', cache: '$0.15', output: '$4.25', ratio: '1.00×', desc: '默认推荐 / 原生多模态 & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },

  { vendor: 'DeepSeek', model: 'DeepSeek V4.1 Flash', input: '¥2.00', cache: '¥0.04', output: '¥8.00', ratio: '1.00×', desc: '默认推荐；峰值价', emoji: '⭐', isFlagship: true, type: 'flagship' },

  { vendor: 'Qwen', model: 'Qwen3.8 Flash', input: '¥0.80', cache: '¥0.10', output: '¥2.70', ratio: '1.00×', desc: '默认推荐 / 高性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Qwen', model: 'Qwen3.8 Max', input: '¥12.00', cache: '¥1.50', output: '¥36.00', ratio: '13.71×', desc: '旗舰复杂任务', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Kimi', model: 'Kimi K2.8 Preview', input: '—', cache: '—', output: '—', ratio: '—', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Kimi', model: 'Kimi K3', input: '—', cache: '—', output: '—', ratio: '—', desc: '通用旗舰 / 大型代码库 / 知识工作', emoji: '🧠', type: 'reasoning' },

  { vendor: 'GLM / Z.ai', model: 'GLM-5.3 Flash', input: '—', cache: '—', output: '—', ratio: '—', desc: '默认推荐 / 性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'GLM / Z.ai', model: 'GLM-5.3', input: '—', cache: '—', output: '—', ratio: '—', desc: '高难 Coding / 长程 Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'MiniMax', model: 'MiniMax M3', input: '¥2.10', cache: '¥0.42', output: '¥8.40', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },

  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Flash', input: '¥1.00', cache: '¥0.02', output: '¥2.00', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Pro', input: '¥3.00', cache: '¥0.025', output: '¥6.00', ratio: '3.00×', desc: '高难推理', emoji: '🧠', type: 'reasoning' },

  { vendor: '腾讯混元', model: 'Hy3', input: '¥1.00', cache: '¥0.25', output: '¥4.00', ratio: '1.00×', desc: '默认性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: '腾讯混元', model: 'Hy4 Preview', input: '¥6.00', cache: '¥0.30', output: '¥18.00', ratio: '4.80×', desc: '高质量 / Coding / Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Lite', input: '¥0.30', cache: '¥0.06', output: '¥0.60', ratio: '1.00×', desc: '默认推荐 / 极低成本', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Pro', input: '¥0.80', cache: '¥0.16', output: '¥2.00', ratio: '3.11×', desc: '高质量 / 复杂任务', emoji: '🧠', type: 'reasoning' }
];

const pricingTable = document.getElementById('pricing-table');
const pricingBody = document.getElementById('pricing-body');
const pricingSearch = document.getElementById('pricing-search');
const pricingSnapshots = [{
  id: '2026-09-30',
  label: '2026-09-30 · 更新前快照',
  date: '2026-09-30',
  sources: pricingSources,
  rows: pricingRows,
  historical: true,
  footer: '更新于 2026-09-29，记录当前各厂商主流模型的推荐定位与定价基准有效状态。基准倍数 =（普通输入价 + 输出价）÷ 同厂商默认推荐模型对应价格之和，以主力推荐模型为 1.00×，仅用于同一厂商内各型号的相对成本参考（— 表示没有合适的统一按量价格，不代表免费）。价格按每百万 token 计，缓存输入不参与基准倍数计算；不同币种、上下文长度和计费通道不能直接横向比较，实际计费请参考各厂商官方定价页。'
}];

const pricingVersions = [pricingCurrent, ...pricingSnapshots];
for (const snapshot of pricingVersions) {
  const entry = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'pricing-snapshot-row';
  const link = document.createElement('a');
  link.className = 'pricing-snapshot-link';  link.href = '#pricing/' + snapshot.date;
  link.textContent = snapshot.date + ' 快照';
  const toggle = document.createElement('a');
  const record = document.createElement('div');
  record.id = 'pricing-record-' + snapshot.date;
  record.className = 'pricing-snapshot-record';
  record.hidden = true;
  toggle.href = '#' + record.id;
  toggle.textContent = '更新记录';
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-controls', record.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', snapshot.date + ' 快照更新记录');
  const onToggle = event => {
    event.preventDefault();
    record.hidden = !record.hidden;
    toggle.setAttribute('aria-expanded', String(!record.hidden));
  };
  toggle.addEventListener('click', onToggle);
  toggle.addEventListener('keydown', event => {
    if (event.key === ' ') onToggle(event);
  });
  const status = document.createElement('p');
  status.className = 'pricing-snapshot-status';
  status.textContent = snapshot.historical
    ? '原脚本日期 2026-09-30（原页脚标注 09-29），2026-10-21 归档。保留原表的 27 条记录与来源；未保留该版本更早的逐项更新记录。'
    : '官方信息核对日期 ' + snapshot.date + ' · ' + snapshot.rows.length + ' 条价格记录';
  record.append(status);
  if (snapshot.updates) {
    const list = document.createElement('ul');
    for (const update of snapshot.updates) {
      const item = document.createElement('li');
      item.append(update.text + ' ');
      const source = document.createElement('a');
      source.href = update.url;
      source.textContent = '官方来源';
      source.target = '_blank';
      source.rel = 'noopener';
      item.append(source);
      list.append(item);
    }
    record.append(list);
  }
  row.append(link, toggle);
  entry.append(row, record);
  document.getElementById('pricing-history-links').append(entry);
}

function pricingRatio(item, rows) {
  const baseline = rows.find(row => row.vendor === item.vendor && row.isFlagship &&
    (row.channel || 'direct') === (item.channel || 'direct'));
  const prices = [item.input, item.output, baseline?.input, baseline?.output]
    .map(value => /^([$¥])(\d+(?:\.\d+)?)$/.exec(value || ''));
  if (prices.some(value => !value) || !prices.every(value => value[1] === prices[0][1])) return '—';
  const base = Number(prices[2][2]) + Number(prices[3][2]);
  return base > 0 ? ((Number(prices[0][2]) + Number(prices[1][2])) / base).toFixed(2) + '×' : '—';
}

function showPricingHistory(open) {
  document.getElementById('pricing-history').hidden = !open;
  document.getElementById('pricing-history-toggle').setAttribute('aria-expanded', String(open));
}

function renderPricing(snapshot) {
  pricingBody.replaceChildren();
  document.getElementById('pricing-heading').textContent = snapshot.historical ? snapshot.label : '模型价格对比';
  document.getElementById('pricing-footer').textContent = snapshot.footer;
  showPricingHistory(location.hash.startsWith('#pricing/') && pricingVersions.includes(snapshot));
  document.querySelectorAll('#pricing-snapshot-nav .pricing-snapshot-link').forEach(link => {
    const selected = link.getAttribute('href') === '#pricing/' + snapshot.date;
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

let lastVendor = null;
snapshot.rows.forEach((item) => {
  const tr = document.createElement('tr');
  const isFirstInVendor = item.vendor !== lastVendor;
  lastVendor = item.vendor;

  if (isFirstInVendor) {
    tr.classList.add('vendor-group-start');
  } else {
    tr.classList.add('vendor-group-sub');
  }

  if (item.isFlagship) {
    tr.classList.add('pricing-row-flagship');
  } else {
    tr.classList.add('pricing-row-normal');
  }

  tr.dataset.vendor = item.vendor;
  tr.dataset.model = item.model;
  tr.dataset.desc = item.desc;

  const source = snapshot.sources[item.vendor] || { url: '#', label: item.vendor };

  // 1. 厂商 / 平台 (首行展示厂商名链接，同组后续型号行留白)
  const tdVendor = document.createElement('td');
  tdVendor.className = 'cell-vendor';
  if (isFirstInVendor) {
    const a = document.createElement('a');
    a.href = source.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'vendor-title-link';
    a.textContent = item.vendor;
    a.title = '查看 ' + item.vendor + ' 官方定价或产品页面';
    tdVendor.append(a);
  } else {
    // 隐藏/Ghost厂商名，供过滤搜索状态下显示
    const ghost = document.createElement('span');
    ghost.className = 'vendor-sub-ghost';
    ghost.textContent = item.vendor;
    tdVendor.append(ghost);
  }
  tr.append(tdVendor);

  // 2. 模型
  const tdModel = document.createElement('td');
  tdModel.className = 'cell-model';
  const modelSpan = document.createElement('span');
  modelSpan.className = 'model-name';
  modelSpan.textContent = item.model;
  tdModel.append(modelSpan);
  if (!snapshot.historical) {
    modelSpan.title = [source.note, item.note].filter(Boolean).join('\n');
  }
  tr.append(tdModel);

  // 3. 输入 / 1M
  const tdInput = document.createElement('td');
  tdInput.className = 'cell-price';
  tdInput.textContent = item.input;
  tr.append(tdInput);

  // 4. 缓存输入 / 1M
  const tdCache = document.createElement('td');
  tdCache.className = 'cell-price';
  tdCache.textContent = item.cache;
  tr.append(tdCache);

  // 5. 输出 / 1M
  const tdOutput = document.createElement('td');
  tdOutput.className = 'cell-price';
  tdOutput.textContent = item.output;
  tr.append(tdOutput);

  // 6. 基准倍数 (统一两位小数，如 1.00×)
  const tdRatio = document.createElement('td');
  tdRatio.className = 'cell-ratio cell-price';
  tdRatio.textContent = snapshot.historical ? item.ratio : pricingRatio(item, snapshot.rows);
  tr.append(tdRatio);

  // 7. 推荐定位 (无背景色，保留emoji和标准文字颜色，仅默认推荐加粗)
  const tdRecommend = document.createElement('td');
  tdRecommend.className = 'cell-recommend';

  const tag = document.createElement('span');
  tag.className = `recommend-tag tag-${item.type}`;
  tag.innerHTML = `<span class="tag-emoji">${item.emoji}</span><span class="tag-text">${item.desc}</span>`;
  tdRecommend.append(tag);

  tr.append(tdRecommend);
  pricingBody.append(tr);
});
  filterPricing();
}

function filterPricing() {
  const query = pricingSearch.value.trim().toLocaleLowerCase();
  let visible = 0;
  if (query) {
    pricingTable?.classList.add('is-filtered');
  } else {
    pricingTable?.classList.remove('is-filtered');
  }

  const normQuery = query.replace(/[-\s]+/g, ' ');
  pricingBody.querySelectorAll('tr').forEach(row => {
    const text = (row.dataset.vendor + ' ' + row.dataset.model + ' ' + row.dataset.desc + ' ' + row.textContent).toLocaleLowerCase();
    const normText = text.replace(/[-\s]+/g, ' ');
    const match = !query || text.includes(query) || normText.includes(normQuery);
    row.hidden = !match;
    if (match) visible++;
  });
  document.getElementById('pricing-empty').hidden = visible !== 0;
}

let activePricingSnapshot = null;
function syncPricingSnapshot() {
  const [view, id] = location.hash.slice(1).split('/');
  if (view !== 'pricing' && activePricingSnapshot) return;
  const snapshot = view === 'pricing' && id
    ? pricingVersions.find(item => item.date === id) || pricingCurrent
    : pricingCurrent;
  activePricingSnapshot = snapshot;
  renderPricing(snapshot);
}

{
  const toggle = document.getElementById('pricing-history-toggle');
  const onToggle = event => {
    event.preventDefault();
    showPricingHistory(document.getElementById('pricing-history').hidden);
  };
  toggle.addEventListener('click', onToggle);
  toggle.addEventListener('keydown', event => {
    if (event.key === ' ') onToggle(event);
  });
}

pricingSearch.addEventListener('input', filterPricing);
addEventListener('hashchange', syncPricingSnapshot);
syncPricingSnapshot();
