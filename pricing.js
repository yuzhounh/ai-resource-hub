// Historical datasets, newest first:
//   2026-10-21 — snapshot published 2026-10-21, archived 2026-11-12 when the current table moved on.
//   2026-09-30 — script dated 2026-09-30, original footer dated 2026-09-29, preserved 2026-10-21.
// Keep these original rows, source links and update records unchanged,
// except the noted 2026-11-13 name correction in the 2026-09-30 snapshot.
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
  { vendor: 'Google', model: 'Gemini 3.1 Pro Preview', input: '$2.00', cache: '$0.20', output: '$12.00', ratio: '3.11×', desc: '复杂知识 / 多模态推理', emoji: '🧠', type: 'reasoning' },

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
const pricingSources20261021 = {
  OpenAI: { url: 'https://developers.openai.com/api/docs/pricing', note: '官方 API，Standard，输入 ≤272K；Ultrafast、缓存写入、工具及长上下文另计。' },
  Anthropic: { url: 'https://platform.claude.com/docs/en/about-claude/pricing', note: 'Claude Platform 标准价；缓存列为命中读取，5 分钟 / 1 小时写入另计。' },
  Google: { url: 'https://ai.google.dev/gemini-api/docs/pricing', note: 'Gemini Developer API 付费 Standard；输出含思考 token，显式缓存存储与工具另计。' },
  'SpaceXAI / Cursor': { url: 'https://cursor.com/docs/models-and-pricing', note: 'Cursor 内标准用量价格，非订阅月费；Fast 与更大上下文另计。' },
  Meta: { url: 'https://dev.meta.ai/docs/pricing-rate-limits', note: 'Meta Model API Standard 价格；Contributor 优惠以允许内容用于训练为条件。' },
  DeepSeek: { url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', note: '官方人民币价；高峰为北京时间工作日（不含法定节假日）09–12 / 14–18，其余时段半价。' },
  Qwen: { url: 'https://help.aliyun.com/zh/model-studio/qwen3-8-flash', note: '百炼北京原价，缓存列为输入缓存命中；显式缓存创建、命中规则另见官方页。' },
  Kimi: { url: 'https://platform.kimi.ai/docs/pricing/chat', note: 'Kimi 官方国际站美元价，非第三方平台报价。' },
  'GLM / Z.ai': { url: 'https://docs.z.ai/guides/overview/pricing', note: 'Z.ai 国际 API 美元价；与国内智谱、腾讯云和 Coding Plan 分开计费。' },
  MiniMax: { url: 'https://platform.minimax.cn/docs/pricing/overview', note: 'MiniMax 国内标准 API；M3 输入超过 512K 时输入 / 缓存 / 输出均为表内价格的 2 倍。' },
  'Xiaomi MiMo': { url: 'https://mimo.mi.com/docs/en-US/pricing', note: '国内实时 API 人民币价，非 Batch / Token Plan；海外美元定价另列于官方页。' },
  '腾讯混元': { url: 'https://cloud.tencent.com/document/product/1823/130055', note: '腾讯云 TokenHub 广州在线推理人民币价，非 Token Plan 积分。' },
  'Seed / 豆包': { url: 'https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing', note: '火山方舟北京在线推理（常规）、非音频输入；缓存存储 ¥0.017 / 百万 token / 小时另计。' }
};

const pricingRows20261021 = [
  { vendor: 'OpenAI', model: 'GPT-6 Luna', input: '$0.10', cache: '$0.01', output: '$0.50', desc: '大批量、简单任务', emoji: '💰', type: 'budget' },
  { vendor: 'OpenAI', model: 'GPT-6.1 Sol', input: '$2.00', cache: '$0.10', output: '$10.00', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship', note: 'Ultrafast 为标准档的 6 倍：输入 $12、缓存 $0.60、输出 $60。' },
  { vendor: 'OpenAI', model: 'GPT-6 Astra', input: '$10.00', cache: '$1.00', output: '$50.00', desc: '最高难度任务', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Anthropic', model: 'Claude Haiku 5.5', input: '$0.10', cache: '$0.01', output: '$0.50', desc: '低成本 / 分类与路由', emoji: '💰', type: 'budget', note: '表内为提示词 ≤100K；超过后输入 $0.50、缓存 $0.05、输出 $2.50。' },
  { vendor: 'Anthropic', model: 'Claude Sonnet 5.5', input: '$2.00', cache: '$0.10', output: '$10.00', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Anthropic', model: 'Claude Opus 5.5', input: '$4.00', cache: '$0.20', output: '$20.00', desc: '高难 Coding / Agent', emoji: '🧠', type: 'reasoning' },
  { vendor: 'Anthropic', model: 'Claude Fable 5.1', input: '$10.00', cache: '$0.25', output: '$50.00', desc: '超长程复杂任务', emoji: '🚀', type: 'extreme' },

  { vendor: 'Google', model: 'Gemini 3.8 Flash', input: '$0.75', cache: '$0.075', output: '$3.75', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship', note: '现价至 2026-12-31；2027-01-01 起输入 $1.50、缓存 $0.15、输出 $7.50。' },
  { vendor: 'Google', model: 'Gemini 4 Argon', input: '$2.00', cache: '$0.10', output: '$10.00', desc: '复杂工程 / 科学推理', emoji: '🧠', type: 'reasoning', note: '现价至 2026-11-30；12-01 起输入 $4、缓存 $0.20、输出 $20；仅隐式缓存。' },
  { vendor: 'Google', model: 'Gemini 3.1 Pro Preview', input: '$2.00', cache: '$0.20', output: '$12.00', desc: '复杂知识 / 多模态推理', emoji: '🧠', type: 'reasoning', note: '表内为输入 ≤200K；超过后输入 $4、缓存 $0.40、输出 $18。' },

  { vendor: 'SpaceXAI / Cursor', model: 'Composer 2.5', input: '$0.50', cache: '$0.20', output: '$2.50', desc: '默认推荐 / Coding & Agent', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'SpaceXAI / Cursor', model: 'Grok 4.7', input: '$2.00', cache: '$0.50', output: '$6.00', desc: '长程 Coding / Agent', emoji: '🧠', type: 'reasoning', note: 'Cursor 256K 标准档；500K 档输入 $4、缓存 $1、输出 $12。' },

  { vendor: 'Meta', model: 'Muse Spark 1.3', input: '$1.25', cache: '$0.15', output: '$4.25', desc: '默认推荐 / 多模态 & Agent', emoji: '⭐', isFlagship: true, type: 'flagship', note: '标准单价与旧表 Spark 相同；1.2 / 1.1 的 Standard 价格也相同。Contributor 档输入 $0.10、缓存 $0.002、输出 $0.20。' },
  { vendor: 'Meta', model: 'Muse Wonder 1.0', input: '$4.00', cache: '$0.20', output: '$20.00', desc: '复杂代码库 / 长程 Agent', emoji: '🧠', type: 'reasoning', note: 'Model API 无 Contributor 档；Wonder Full 仅 Muse Code 订阅，未公布按 token 单价。' },

  { vendor: 'DeepSeek', model: 'DeepSeek V4.1 Flash', input: '¥2.00', cache: '¥0.04', output: '¥8.00', desc: '默认推荐 / 多模态', emoji: '⭐', isFlagship: true, type: 'flagship', note: '当前版本 Flash-1017，调用 ID 为 deepseek-flash。表内为高峰价；空闲时段输入 ¥1、缓存 ¥0.02、输出 ¥4。' },
  { vendor: 'DeepSeek', model: 'DeepSeek V4 Pro', input: '¥9.00', cache: '¥0.30', output: '¥27.00', desc: 'Pro / 文本推理', emoji: '🧠', type: 'reasoning', note: '当前版本 Pro-0813。表内为高峰价；空闲时段输入 ¥4.50、缓存 ¥0.15、输出 ¥13.50。' },

  { vendor: 'Qwen', model: 'Qwen3.8 Flash', input: '¥0.80', cache: '¥0.10', output: '¥2.70', desc: '默认推荐 / 高性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Qwen', model: 'Qwen3.8 Max', input: '¥12.00', cache: '¥1.50', output: '¥36.00', desc: '旗舰复杂任务', emoji: '🧠', type: 'reasoning', sourceUrl: 'https://help.aliyun.com/zh/model-studio/qwen3-8-max', note: '当前快照 qwen3.8-max-0902；普通缓存命中 ¥1.50，显式缓存命中 ¥1.00。' },

  { vendor: 'Kimi', model: 'Kimi K2.7 Code', input: '$0.95', cache: '$0.19', output: '$4.00', desc: '默认推荐 / Coding', emoji: '⭐', isFlagship: true, type: 'flagship', note: '官方国际站；HighSpeed 档输入 $1.90、缓存 $0.38、输出 $8。' },
  { vendor: 'Kimi', model: 'Kimi K3', input: '$3.00', cache: '$0.30', output: '$15.00', desc: '通用旗舰 / 长程任务', emoji: '🧠', type: 'reasoning', note: '1M 上下文统一单价；5 分钟 / 1 小时缓存写入另为 $3 / $6。' },

  { vendor: 'GLM / Z.ai', model: 'GLM-5.3 Flash', input: '$0.15', cache: '$0.03', output: '$0.50', desc: '默认推荐 / 性价比', emoji: '⭐', isFlagship: true, type: 'flagship', note: 'FlashX 加速型号输入 $0.37、缓存 $0.075、输出 $1.25。' },
  { vendor: 'GLM / Z.ai', model: 'GLM-5.3', input: '$1.40', cache: '$0.26', output: '$4.40', desc: '高难 Coding / 长程 Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'MiniMax', model: 'MiniMax M3.1 Flash', input: '¥1.00', cache: '¥0.10', output: '¥4.00', desc: '低成本 / 快速响应', emoji: '💰', type: 'budget' },
  { vendor: 'MiniMax', model: 'MiniMax M3', input: '¥2.10', cache: '¥0.42', output: '¥8.40', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship', note: '表内为输入 ≤512K 的标准档；Priority 为对应标准档的 1.5 倍。' },

  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Flash', input: '¥1.00', cache: '¥0.02', output: '¥2.00', desc: '默认推荐', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: 'Xiaomi MiMo', model: 'MiMo-V2.6 Pro', input: '¥3.00', cache: '¥0.025', output: '¥6.00', desc: '高难推理', emoji: '🧠', type: 'reasoning', note: 'Ultraspeed 档输入 ¥30、缓存 ¥0.25、输出 ¥60，不支持 Batch。' },

  { vendor: '腾讯混元', model: 'Hy3', input: '¥1.00', cache: '¥0.25', output: '¥4.00', desc: '默认性价比', emoji: '⭐', isFlagship: true, type: 'flagship' },
  { vendor: '腾讯混元', model: 'Hy4 Preview', input: '¥6.00', cache: '¥0.30', output: '¥18.00', desc: '高质量 / Coding / Agent', emoji: '🧠', type: 'reasoning' },

  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Lite', input: '¥0.80', cache: '¥0.16', output: '¥2.70', desc: '默认推荐 / 低成本', emoji: '⭐', isFlagship: true, type: 'flagship', note: '校正旧表记录；音频输入 ¥12，音频缓存命中 ¥2.40。' },
  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Turbo', input: '¥3.00', cache: '¥0.60', output: '¥15.00', desc: '编程 / 快速推理', emoji: '⚡', type: 'reasoning', note: '输入长度 ≤256K。' },
  { vendor: 'Seed / 豆包', model: 'Seed 2.1 Pro', input: '¥6.00', cache: '¥1.20', output: '¥30.00', desc: '高质量 / 复杂任务', emoji: '🧠', type: 'reasoning', note: '校正旧表记录；输入长度 ≤1M，非音频。' }
];

const pricingUpdates20261021 = [
  { text: 'OpenAI：三款主力 Standard 单价与旧表一致；Sol Ultrafast 和长上下文等计费条件合并在悬停说明中。10-20 新增 12 小时缓存，写入为普通输入价的 2.5 倍。', url: 'https://developers.openai.com/api/docs/changelog' },
  { text: 'Claude：以 Haiku 5.5 替换 Haiku 4.5，上下文分档合并在悬停说明中；Sonnet 5.5 缓存命中价由旧表 $0.20 校正为 $0.10，其余已列主力价一致。', url: 'https://platform.claude.com/docs/en/about-claude/pricing' },
  { text: 'Google：补录 Gemini 4 Argon；Flash 现价不变。Argon 的现价到 11-30，Flash 的现价到 12-31，之后价格已写入各行说明。', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { text: 'Meta：补录 Muse Wonder 与 Spark 1.3；Spark 标准 / Contributor 单价与旧表一致，Wonder Full 暂无公开按 token 价。', url: 'https://dev.meta.ai/docs/pricing-rate-limits' },
  { text: 'DeepSeek：Flash 已指向 V4.1-Flash-1017，高峰单价不变；补录 V4 Pro，空闲时段价格合并在悬停说明中。', url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/' },
  { text: 'Kimi / GLM：补齐原来的价格空缺。Kimi 使用官方国际站报价；GLM 使用 Z.ai 国际站报价。', url: 'https://platform.kimi.ai/docs/pricing/chat' },
  { text: 'MiniMax：补录 M3.1 Flash（¥1 / ¥0.10 / ¥4，依次为输入 / 缓存 / 输出）；M3 普通档价格未变，补上 512K 分档条件。', url: 'https://platform.minimax.cn/docs/pricing/overview' },
  { text: '豆包：按官方 10-20 价格表校正 Lite / Pro，并补录 Turbo。这是与旧记录的差异，不据此推断厂商调价日期。Qwen、MiMo 普通档、Hy3 / Hy4 的已列价格一致。', url: 'https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing' }
];

const pricingSnapshots = [{
  id: '2026-10-21',
  label: '2026-10-21 · 快照',
  date: '2026-10-21',
  sources: pricingSources20261021,
  rows: pricingRows20261021,
  updates: pricingUpdates20261021,
  historical: true,
  status: '核对日期 2026-10-21，2026-11-12 归档。保留当时的 31 条价格记录、来源和 8 条更新记录。',
  footer: '核对日期 2026-10-21。价格均为每百万 token，展示主流模型的标准或基础档；鼠标悬停模型名可查看上下文、时段及速度档等计费说明。缓存列仅为命中读取，不含写入、存储、工具调用和税费。基准倍数 =（普通输入价 + 输出价）÷ 同厂商、同币种和同计费通道默认推荐模型对应价格之和。— 表示没有可比基准，不代表免费。具体账单以对应官方定价和账户地区为准。'
}, {
  id: '2026-09-30',
  label: '2026-09-30 · 更新前快照',
  date: '2026-09-30',
  sources: pricingSources,
  rows: pricingRows,
  historical: true,
  status: '原脚本日期 2026-09-30（原页脚标注 09-29），2026-10-21 归档。保留原表的 27 条记录与来源；未保留该版本更早的逐项更新记录。唯一改动：2026-11-13 按官方模型列表把「Gemini 3.1 Pro」更正为「Gemini 3.1 Pro Preview」（该型号至今只有 preview 端点），价格未动。',
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
  status.textContent = snapshot.status
    || '官方信息核对日期 ' + snapshot.date + ' · ' + snapshot.rows.length + ' 条价格记录';
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
  const modelNote = [source.note, item.note].filter(Boolean).join('\n');
  if (modelNote) {
    modelSpan.title = modelNote;
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
  tdRatio.textContent = item.ratio || pricingRatio(item, snapshot.rows);
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
