// 2026-09-28 snapshot from the linked price-comparison conversation.
// Prices are displayed as supplied there; source links let readers check current rates.
const pricingSources = {
  OpenAI: 'https://developers.openai.com/api/docs/pricing',
  Anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  Google: 'https://ai.google.dev/gemini-api/docs/pricing',
  xAI: 'https://docs.x.ai/developers/models/grok-4.7',
  Cursor: 'https://docs.cursor.com/models',
  DeepSeek: 'https://api-docs.deepseek.com/quick_start/pricing/',
  Qwen: 'https://help.aliyun.com/zh/model-studio/qwen3-8-flash',
  Kimi: 'https://platform.moonshot.ai/docs/pricing',
  'GLM / Z.ai': 'https://docs.z.ai/guides/overview/pricing',
  MiniMax: 'https://platform.minimax.io/docs/guides/pricing',
  'Xiaomi MiMo': 'https://platform.xiaomimimo.com/',
  '腾讯混元': 'https://cloud.tencent.com/product/hunyuan',
  'Seed / 豆包': 'https://www.volcengine.com/product/ark'
};

const pricingRows = [
  ['OpenAI', 'GPT-6 Luna', '$0.10', '$0.01', '$0.50', '0.05×', '大批量、简单任务'],
  ['OpenAI', 'GPT-6 Sol', '$2.00', '$0.20', '$10.00', '1×', '默认推荐'],
  ['OpenAI', 'GPT-6 Astra', '$10.00', '$1.00', '$50.00', '5.00×', '最高难度任务'],
  ['Anthropic', 'Claude Haiku 4.5', '$1.00', '≈$0.10', '$5.00', '0.50×', '低成本 / 子 Agent'],
  ['Anthropic', 'Claude Sonnet 5', '$2.00', '≈$0.20', '$10.00', '1×', '默认推荐'],
  ['Anthropic', 'Claude Opus 5.5', '$4.00', '$0.20', '$20.00', '2.00×', '高难 Coding / Agent'],
  ['Anthropic', 'Claude Fable 5.1', '$10.00', '$0.25', '$50.00', '5.00×', '极限档 / 超长程复杂任务'],
  ['Google', 'Gemini 3.5 Flash-Lite', '$0.30', '$0.03', '$2.50', '0.62×', '高吞吐低成本'],
  ['Google', 'Gemini 3.8 Flash', '$0.75', '$0.075', '$3.75', '1×', '默认推荐 / Coding & Agent'],
  ['Google', 'Gemini 3.1 Pro Preview', '$2.00', '$0.20', '$12.00', '3.11×', '复杂知识 / 多模态推理'],
  ['xAI', 'Grok 4.7', '$2.00', '$0.50', '$6.00', '1×', '默认推荐 / Coding + 知识工作'],
  ['Cursor', 'Composer 2.5', '$0.50', '$0.20', '$2.50', '1×', '默认推荐 / Coding & Agent'],
  ['Cursor', 'Grok 4.7', '$2.00', '$0.50', '$6.00', '2.67×', '更困难、长程 Coding / Agent'],
  ['DeepSeek', 'V4.1 Flash', '$0.30', '$0.006', '$1.20', '1×', '默认推荐；峰值价'],
  ['Qwen', 'Qwen3.8 Flash', '$0.113', '$0.014', '$0.382', '1×', '默认推荐 / 高性价比'],
  ['Qwen', 'Qwen3.8 Max', '$1.65', '$0.206', '$4.951', '13.34×', '旗舰复杂任务'],
  ['Kimi', 'K2.8 Preview', '—', '—', '—', '—', '默认推荐 / Coding & Agent'],
  ['Kimi', 'K3', '—', '—', '—', '—', '通用旗舰 / 大型代码库 / 知识工作'],
  ['GLM / Z.ai', 'GLM-5.3 Flash', '—', '—', '—', '—', '默认推荐 / 性价比'],
  ['GLM / Z.ai', 'GLM-5.3', '—', '—', '—', '—', '高难 Coding / 长程 Agent'],
  ['MiniMax', 'MiniMax M3', '$0.30', '$0.06', '$1.20', '1×', '默认推荐'],
  ['Xiaomi MiMo', 'MiMo-V2.6 Flash', '$0.14', '$0.0028', '$0.28', '1×', '默认推荐'],
  ['Xiaomi MiMo', 'MiMo-V2.6 Pro', '$0.435', '$0.0036', '$0.87', '3.11×', '高难推理'],
  ['腾讯混元', 'Hy3', '¥1', '¥0.25', '¥4', '1×', '默认性价比'],
  ['腾讯混元', 'Hy4 Preview', '¥6', '¥0.30', '¥18', '4.80×', '高质量 / Coding / Agent'],
  ['Seed / 豆包', 'Seed 2.1 Lite', '¥0.80', '¥0.16', '¥2.70', '0.10×', '低成本、大规模调用'],
  ['Seed / 豆包', 'Seed 2.1 Pro', '¥6.00', '¥1.20', '¥30.00', '1×', '通用默认推荐'],
  ['Seed / 豆包', 'Seed Evolving', '¥6.00', '¥1.20', '¥30.00', '1×', 'Coding / Agent 默认推荐']
];

const pricingBody = document.getElementById('pricing-body');
for (const row of pricingRows) {
  const tr = document.createElement('tr');
  row.forEach((value, index) => {
    const td = document.createElement('td');
    if (index === 0) {
      const a = document.createElement('a');
      a.href = pricingSources[value];
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = value;
      a.title = '查看厂商定价或产品页面';
      td.append(a);
    } else {
      td.textContent = value;
    }
    tr.append(td);
  });
  pricingBody.append(tr);
}

const pricingSearch = document.getElementById('pricing-search');
pricingSearch.addEventListener('input', () => {
  const query = pricingSearch.value.trim().toLocaleLowerCase();
  let visible = 0;
  pricingBody.querySelectorAll('tr').forEach(row => {
    const match = !query || row.textContent.toLocaleLowerCase().includes(query);
    row.hidden = !match;
    if (match) visible++;
  });
  document.getElementById('pricing-empty').hidden = visible !== 0;
});
