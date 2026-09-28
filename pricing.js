// 2026-09-28 snapshot from the linked price-comparison conversation.
// Prices are displayed as supplied there; source links let readers check current rates.
const pricingSources = {
  OpenAI: { url: 'https://developers.openai.com/api/docs/pricing', label: 'OpenAI Developer' },
  Anthropic: { url: 'https://platform.claude.com/docs/en/about-claude/pricing', label: 'Anthropic' },
  Google: { url: 'https://ai.google.dev/gemini-api/docs/pricing', label: 'Google AI for Dev' },
  'SpaceXAI / Cursor': { url: 'https://docs.cursor.com/models', label: 'Cursor / xAI' },
  xAI: { url: 'https://docs.x.ai/developers/models/grok-4.7', label: 'xAI Docs' },
  Cursor: { url: 'https://docs.cursor.com/models', label: 'Cursor Models' },
  DeepSeek: { url: 'https://api-docs.deepseek.com/quick_start/pricing/', label: 'DeepSeek Docs' },
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
  { vendor: 'OpenAI', model: 'GPT-6 Sol', input: '$2.00', cache: '$0.20', output: '$10.00', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'OpenAI', model: 'GPT-6 Astra', input: '$10.00', cache: '$1.00', output: '$50.00', ratio: '5.00×', desc: '最高难度任务', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Anthropic', model: 'Claude Haiku 4.5', input: '$1.00', cache: '$0.10', output: '$5.00', ratio: '0.50×', desc: '低成本 / 子 Agent', emoji: '💰', type: 'budget' },
  { vendor: 'Anthropic', model: 'Claude Sonnet 5', input: '$2.00', cache: '$0.20', output: '$10.00', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Anthropic', model: 'Claude Opus 5.5', input: '$4.00', cache: '$0.20', output: '$20.00', ratio: '2.00×', desc: '高难 Coding / Agent', emoji: '🧠', type: 'reasoning' },
  { vendor: 'Anthropic', model: 'Claude Fable 5.1', input: '$10.00', cache: '$0.25', output: '$50.00', ratio: '5.00×', desc: '极限档 / 超长程复杂任务', emoji: '🚀', type: 'extreme' },

  { vendor: 'Google', model: 'Gemini 3.5 Flash-Lite', input: '$0.30', cache: '$0.03', output: '$2.50', ratio: '0.62×', desc: '高吞吐低成本', emoji: '💰', type: 'budget' },
  { vendor: 'Google', model: 'Gemini 3.8 Flash', input: '$0.75', cache: '$0.075', output: '$3.75', ratio: '1.00×', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Google', model: 'Gemini 3.1 Pro Preview', input: '$2.00', cache: '$0.20', output: '$12.00', ratio: '3.11×', desc: '复杂知识 / 多模态推理', emoji: '🧠', type: 'reasoning' },

  { vendor: 'SpaceXAI / Cursor', model: 'Grok 4.7', input: '$2.00', cache: '$0.50', output: '$6.00', ratio: '1.00×', desc: '默认推荐 / Coding + 知识工作', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'SpaceXAI / Cursor', model: 'Composer 2.5', input: '$0.50', cache: '$0.20', output: '$2.50', ratio: '1.00×', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'SpaceXAI / Cursor', model: 'Grok 4.7', input: '$2.00', cache: '$0.50', output: '$6.00', ratio: '2.67×', desc: '更困难、长程 Coding / Agent', emoji: '🚀', type: 'extreme' },

  { vendor: 'DeepSeek', model: 'V4.1 Flash', input: '$0.30', cache: '$0.006', output: '$1.20', ratio: '1.00×', desc: '默认推荐；峰值价', emoji: '⭐', isFlagship: true, type: 'flagship' },

  { vendor: 'Qwen', model: 'Qwen3.8 Flash', input: '$0.113', cache: '$0.014', output: '$0.382', ratio: '1.00×', desc: '默认推荐 / 高性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Qwen', model: 'Qwen3.8 Max', input: '$1.65', cache: '$0.206', output: '$4.951', ratio: '13.34×', desc: '旗舰复杂任务', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Kimi', model: 'K2.8 Preview', input: '—', cache: '—', output: '—', ratio: '—', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Kimi', model: 'K3', input: '—', cache: '—', output: '—', ratio: '—', desc: '通用旗舰 / 大型代码库 / 知识工作', emoji: '🧠', type: 'reasoning' },

  { vendor: 'GLM / Z.ai', model: 'GLM-5.3 Flash', input: '—', cache: '—', output: '—', ratio: '—', desc: '默认推荐 / 性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'GLM / Z.ai', model: 'GLM-5.3', input: '—', cache: '—', output: '—', ratio: '—', desc: '高难 Coding / 长程 Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'MiniMax', model: 'MiniMax M3', input: '$0.30', cache: '$0.06', output: '$1.20', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },

  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Flash', input: '$0.14', cache: '$0.0028', output: '$0.28', ratio: '1.00×', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Pro', input: '$0.435', cache: '$0.0036', output: '$0.87', ratio: '3.11×', desc: '高难推理', emoji: '🧠', type: 'reasoning' },

  { vendor: '腾讯混元', model: 'Hy3', input: '¥1', cache: '¥0.25', output: '¥4', ratio: '1.00×', desc: '默认性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: '腾讯混元', model: 'Hy4 Preview', input: '¥6', cache: '¥0.30', output: '¥18', ratio: '4.80×', desc: '高质量 / Coding / Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Lite', input: '¥0.80', cache: '¥0.16', output: '¥2.70', ratio: '0.10×', desc: '低成本、大规模调用', emoji: '💰', type: 'budget' },
  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Pro', input: '¥6.00', cache: '¥1.20', output: '¥30.00', ratio: '1.00×', desc: '通用默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Seed / 豆包', model: 'Seed Evolving', input: '¥6.00', cache: '¥1.20', output: '¥30.00', ratio: '1.00×', desc: 'Coding / Agent 默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' }
];

const pricingTable = document.getElementById('pricing-table');
const pricingBody = document.getElementById('pricing-body');

let lastVendor = null;
pricingRows.forEach((item) => {
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

  const source = pricingSources[item.vendor] || { url: '#', label: item.vendor };

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
  tdRatio.textContent = item.ratio;
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

const pricingSearch = document.getElementById('pricing-search');
pricingSearch.addEventListener('input', () => {
  const query = pricingSearch.value.trim().toLocaleLowerCase();
  let visible = 0;
  if (query) {
    pricingTable?.classList.add('is-filtered');
  } else {
    pricingTable?.classList.remove('is-filtered');
  }

  pricingBody.querySelectorAll('tr').forEach(row => {
    const text = (row.dataset.vendor + ' ' + row.dataset.model + ' ' + row.dataset.desc + ' ' + row.textContent).toLocaleLowerCase();
    const match = !query || text.includes(query);
    row.hidden = !match;
    if (match) visible++;
  });
  document.getElementById('pricing-empty').hidden = visible !== 0;
});
