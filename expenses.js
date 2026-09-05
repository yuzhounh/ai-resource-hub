// ============================================================
// Expenses / 支出板块核心逻辑（总览统计 + 单栏月度卡片 + 悬停操作）
// 数据保存在登录用户的 Google 账户（Firestore）中；
// localStorage 作为本地缓存与离线使用，首次使用内置完整历史记录。
// ============================================================

import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { HubAuth } from "./hub-auth.js";

const STORAGE_KEY = "ai_hub_expenses_records";

const INITIAL_EXPENSES = [
  {
    id: "exp_20260903_flower",
    date: "2026-09-03",
    title: "Flower Cloud Lite",
    category: "vpn",
    description: "每月150GB，年付",
    amount: 363.3,
    amountDisplay: "363.3元",
    notes: ""
  },
  {
    id: "exp_20260903_googleai_1",
    date: "2026-09-03",
    title: "Google AI Pro",
    category: "sub",
    description: "18个月",
    amount: 12.8,
    amountDisplay: "12.8元",
    notes: ""
  },
  {
    id: "exp_20260903_googleai_2",
    date: "2026-09-03",
    title: "Google AI Pro",
    category: "sub",
    description: "18个月",
    amount: 12.8,
    amountDisplay: "12.8元",
    notes: ""
  },
  {
    id: "exp_20260902_bajie",
    date: "2026-09-02",
    title: "八戒",
    category: "vpn",
    description: "不限时套餐，390GB",
    amount: 118.29,
    amountDisplay: "118.29元",
    notes: ""
  },
  {
    id: "exp_20260902_mojie",
    date: "2026-09-02",
    title: "魔戒",
    category: "vpn",
    description: "不限时套餐，150GB",
    amount: 52.0,
    amountDisplay: "52元",
    notes: ""
  },
  {
    id: "exp_20260827_glm",
    date: "2026-08-27",
    title: "智谱 GLM API",
    category: "api",
    description: "",
    amount: 30.0,
    amountDisplay: "30元",
    notes: ""
  },
  {
    id: "exp_20260824_chatgpt",
    date: "2026-08-24",
    title: "ChatGPT Plus",
    category: "sub",
    description: "月付",
    amount: 134.69,
    amountDisplay: "134.69元",
    notes: "注：对应20美元"
  },
  {
    id: "exp_20260821_opencode",
    date: "2026-08-21",
    title: "OpenCode Go",
    category: "sub",
    description: "",
    amount: 34.95,
    amountDisplay: "34.95元",
    notes: "注：对应5美元"
  },
  {
    id: "exp_20260821_qwen",
    date: "2026-08-21",
    title: "阿里 Qwen API",
    category: "api",
    description: "",
    amount: 10.0,
    amountDisplay: "10元",
    notes: ""
  },
  {
    id: "exp_20260818_qwentoken",
    date: "2026-08-18",
    title: "阿里 Qwen Token Plan",
    category: "sub",
    description: "月付",
    amount: 80.0,
    amountDisplay: "80元",
    notes: ""
  },
  {
    id: "exp_20260818_deepseek",
    date: "2026-08-18",
    title: "DeepSeek API",
    category: "api",
    description: "",
    amount: 50.0,
    amountDisplay: "50元",
    notes: ""
  },
  {
    id: "exp_20260816_deepseek",
    date: "2026-08-16",
    title: "DeepSeek API",
    category: "api",
    description: "",
    amount: 100.0,
    amountDisplay: "100元",
    notes: ""
  },
  {
    id: "exp_20260813_deepseek",
    date: "2026-08-13",
    title: "DeepSeek API",
    category: "api",
    description: "",
    amount: 100.0,
    amountDisplay: "100元",
    notes: ""
  },
  {
    id: "exp_20260811_kimi",
    date: "2026-08-11",
    title: "Kimi API",
    category: "api",
    description: "",
    amount: 50.0,
    amountDisplay: "50元",
    notes: ""
  },
  {
    id: "exp_20260810_googlecloud",
    date: "2026-08-10",
    title: "Google Cloud",
    category: "cloud",
    description: "SGD 25 预付费",
    amount: 132.4,
    amountDisplay: "132.4元",
    notes: "注：无意中给谷歌充值了SGD 25，即132.4元。重置界面是真的看不懂，而且设定了信用卡支付后，都不需要手机验证码啥的，自动就从信用卡扣款了。这是预付费，有效期一年时间，一年后自动作废。之前还说使用 Google AI Studio 一分不花，这不就花了么。也不能说亏吧，毕竟蹬 Gemini 是蹬得最多的。只不过这种消费方式实在是令人意外，我都不知道是啥时候支付的。刚看到手机短信提示是今天晚上21:49支付的，也就是不到一个小时前。"
  },
  {
    id: "exp_20260731_cursor",
    date: "2026-07-31",
    title: "Cursor Pro",
    category: "sub",
    description: "一个月会员",
    amount: 115.0,
    amountDisplay: "115元",
    notes: ""
  },
  {
    id: "exp_20260729_googleai",
    date: "2026-07-29",
    title: "Google AI Pro",
    category: "sub",
    description: "18个月",
    amount: 17.9,
    amountDisplay: "17.9元",
    notes: ""
  },
  {
    id: "exp_20260726_chatgpt",
    date: "2026-07-26",
    title: "ChatGPT Plus",
    category: "sub",
    description: "月付",
    amount: 135.7,
    amountDisplay: "135.7元",
    notes: "注：通过 Google Play Store 购买了 ChatGPT Plus 账号（20美元，即135.7元），这两天蹬完了一周额度，值了。"
  },
  {
    id: "exp_20260726_flower",
    date: "2026-07-26",
    title: "Flower Cloud Air",
    category: "vpn",
    description: "每月20GB，年付",
    amount: 134.31,
    amountDisplay: "134.31元",
    notes: ""
  },
  {
    id: "exp_20260724_qwen",
    date: "2026-07-24",
    title: "阿里 Qwen API",
    category: "api",
    description: "",
    amount: 15.71,
    amountDisplay: "15.71元",
    notes: ""
  },
  {
    id: "exp_20260724_cursor",
    date: "2026-07-24",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 59.8,
    amountDisplay: "59.8元",
    notes: ""
  },
  {
    id: "exp_20260722_cursor",
    date: "2026-07-22",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 26.8,
    amountDisplay: "26.8元",
    notes: ""
  },
  {
    id: "exp_20260620_cursor",
    date: "2026-06-20",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 59.8,
    amountDisplay: "59.8元",
    notes: ""
  },
  {
    id: "exp_20260531_cursor",
    date: "2026-05-31",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 29.8,
    amountDisplay: "29.8元",
    notes: ""
  },
  {
    id: "exp_20260530_openrouter",
    date: "2026-05-30",
    title: "OpenRouter API",
    category: "api",
    description: "",
    amount: 176.0,
    amountDisplay: "176元",
    notes: ""
  },
  {
    id: "exp_20260529_gpts",
    date: "2026-05-29",
    title: "GPTs API",
    category: "api",
    description: "",
    amount: 35.5,
    amountDisplay: "35.5元",
    notes: ""
  },
  {
    id: "exp_20260419_cursor",
    date: "2026-04-19",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 7.23,
    amountDisplay: "7.23元",
    notes: ""
  },
  {
    id: "exp_20260205_cursor",
    date: "2026-02-05",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 18.0,
    amountDisplay: "18元",
    notes: ""
  },
  {
    id: "exp_20251226_bluebird",
    date: "2025-12-26",
    title: "蓝鸟 Vunun（原 ANYWAY 机场）",
    category: "vpn",
    description: "不限时套餐，1800GB",
    amount: 128.0,
    amountDisplay: "128元",
    notes: ""
  },
  {
    id: "exp_20251226_wps_1",
    date: "2025-12-26",
    title: "WPS",
    category: "other",
    description: "一天",
    amount: 0.29,
    amountDisplay: "0.29元",
    notes: ""
  },
  {
    id: "exp_20251226_wps_2",
    date: "2025-12-26",
    title: "WPS",
    category: "other",
    description: "一天",
    amount: 0.01,
    amountDisplay: "0.01元",
    notes: ""
  },
  {
    id: "exp_20251211_wps",
    date: "2025-12-11",
    title: "WPS",
    category: "other",
    description: "一天",
    amount: 0.39,
    amountDisplay: "0.39元",
    notes: ""
  },
  {
    id: "exp_20251123_cursor",
    date: "2025-11-23",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 20.0,
    amountDisplay: "20元",
    notes: ""
  },
  {
    id: "exp_20251109_xunlei",
    date: "2025-11-09",
    title: "迅雷SVIP",
    category: "other",
    description: "一天",
    amount: 0.11,
    amountDisplay: "0.11元",
    notes: ""
  },
  {
    id: "exp_20251109_todesk_1",
    date: "2025-11-09",
    title: "ToDesk",
    category: "other",
    description: "一小时",
    amount: 0.78,
    amountDisplay: "0.78元",
    notes: ""
  },
  {
    id: "exp_20251109_todesk_2",
    date: "2025-11-09",
    title: "ToDesk",
    category: "other",
    description: "一小时",
    amount: 0.78,
    amountDisplay: "0.78元",
    notes: ""
  },
  {
    id: "exp_20251108_todesk",
    date: "2025-11-08",
    title: "ToDesk",
    category: "other",
    description: "一小时",
    amount: 0.78,
    amountDisplay: "0.78元",
    notes: ""
  },
  {
    id: "exp_20251103_todesk",
    date: "2025-11-03",
    title: "ToDesk",
    category: "other",
    description: "一小时",
    amount: 2.0,
    amountDisplay: "2元",
    notes: ""
  },
  {
    id: "exp_20251031_cursor",
    date: "2025-10-31",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 18.0,
    amountDisplay: "18元",
    notes: ""
  },
  {
    id: "exp_20251030_cursor",
    date: "2025-10-30",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 16.5,
    amountDisplay: "16.5元",
    notes: ""
  },
  {
    id: "exp_20251021_wos",
    date: "2025-10-21",
    title: "WOS 数据库",
    category: "other",
    description: "",
    amount: 33.95,
    amountDisplay: "33.95元",
    notes: ""
  },
  {
    id: "exp_20250922_cursor",
    date: "2025-09-22",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 25.0,
    amountDisplay: "25元",
    notes: ""
  },
  {
    id: "exp_20250922_claude",
    date: "2025-09-22",
    title: "Claude",
    category: "sub",
    description: "一天",
    amount: 0.98,
    amountDisplay: "0.98元",
    notes: ""
  },
  {
    id: "exp_20250922_wos",
    date: "2025-09-22",
    title: "WOS 数据库",
    category: "other",
    description: "",
    amount: 6.86,
    amountDisplay: "6.86元",
    notes: ""
  },
  {
    id: "exp_20250913_wenku",
    date: "2025-09-13",
    title: "百度文库",
    category: "other",
    description: "一篇",
    amount: 0.48,
    amountDisplay: "0.48元",
    notes: ""
  },
  {
    id: "exp_20250729_cursor",
    date: "2025-07-29",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 30.0,
    amountDisplay: "30元",
    notes: ""
  },
  {
    id: "exp_20250714_cursor",
    date: "2025-07-14",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 12.9,
    amountDisplay: "12.9元",
    notes: ""
  },
  {
    id: "exp_20250702_cursor",
    date: "2025-07-02",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 12.9,
    amountDisplay: "12.9元",
    notes: ""
  },
  {
    id: "exp_20250612_cursor",
    date: "2025-06-12",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 23.88,
    amountDisplay: "23.88元",
    notes: ""
  },
  {
    id: "exp_20250524_cursor",
    date: "2025-05-24",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 24.8,
    amountDisplay: "24.8元",
    notes: ""
  },
  {
    id: "exp_20250225_haolizi",
    date: "2025-02-25",
    title: "好例子网",
    category: "other",
    description: "一篇",
    amount: 0.88,
    amountDisplay: "0.88元",
    notes: ""
  },
  {
    id: "exp_20241230_wps",
    date: "2024-12-30",
    title: "WPS",
    category: "other",
    description: "两小时",
    amount: 0.68,
    amountDisplay: "0.68元",
    notes: ""
  },
  {
    id: "exp_20241227_wps",
    date: "2024-12-27",
    title: "WPS",
    category: "other",
    description: "一小时",
    amount: 0.28,
    amountDisplay: "0.28元",
    notes: ""
  },
  {
    id: "exp_20241226_wps",
    date: "2024-12-26",
    title: "WPS",
    category: "other",
    description: "4小时",
    amount: 0.48,
    amountDisplay: "0.48元",
    notes: ""
  },
  {
    id: "exp_20241216_cursor",
    date: "2024-12-16",
    title: "Cursor Pro",
    category: "quota",
    description: "",
    amount: 14.49,
    amountDisplay: "14.49元",
    notes: ""
  },
  {
    id: "exp_20241008_mirror",
    date: "2024-10-08",
    title: "共享镜像",
    category: "other",
    description: "一天",
    amount: 2.5,
    amountDisplay: "2.5元",
    notes: ""
  },
  {
    id: "exp_20241006_naiyun",
    date: "2024-10-06",
    title: "奈云",
    category: "vpn",
    description: "不限时套餐，2048GB",
    amount: 298.8,
    amountDisplay: "298.8元",
    notes: ""
  },
  {
    id: "exp_20240717_riolu",
    date: "2024-07-17",
    title: "精灵学院 Riolu",
    category: "vpn",
    description: "季付",
    amount: 14.25,
    amountDisplay: "14.25元",
    notes: ""
  },
  {
    id: "exp_20240410_wps",
    date: "2024-04-10",
    title: "WPS",
    category: "other",
    description: "一个月",
    amount: 9.9,
    amountDisplay: "9.9元",
    notes: ""
  },
  {
    id: "exp_20231229_baidunetdisk",
    date: "2023-12-29",
    title: "百度网盘",
    category: "other",
    description: "三天",
    amount: 6.6,
    amountDisplay: "6.6元",
    notes: ""
  },
  {
    id: "exp_20231220_wenku",
    date: "2023-12-20",
    title: "百度文库",
    category: "other",
    description: "一篇",
    amount: 0.46,
    amountDisplay: "0.46元",
    notes: ""
  },
  {
    id: "exp_20231028_weixin",
    date: "2023-10-28",
    title: "微信",
    category: "other",
    description: "",
    amount: 0.52,
    amountDisplay: "0.52元",
    notes: ""
  },
  {
    id: "exp_20231011_ssrdog",
    date: "2023-10-11",
    title: "SSRDOG",
    category: "vpn",
    description: "不限时套餐，500GB",
    amount: 211.45,
    amountDisplay: "211.45元",
    notes: ""
  },
  {
    id: "exp_20231011_wos",
    date: "2023-10-11",
    title: "WOS 数据库",
    category: "other",
    description: "",
    amount: 29.0,
    amountDisplay: "29元",
    notes: ""
  },
  {
    id: "exp_20230922_ssrdog",
    date: "2023-09-22",
    title: "SSRDOG",
    category: "vpn",
    description: "轻量，月付",
    amount: 25.0,
    amountDisplay: "25元",
    notes: ""
  },
  {
    id: "exp_20230804_wps",
    date: "2023-08-04",
    title: "WPS",
    category: "other",
    description: "七天",
    amount: 5.82,
    amountDisplay: "5.82元",
    notes: ""
  },
  {
    id: "exp_20220107_csdn_1",
    date: "2022-01-07",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.01,
    amountDisplay: "0.01元",
    notes: ""
  },
  {
    id: "exp_20220107_csdn_2",
    date: "2022-01-07",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.01,
    amountDisplay: "0.01元",
    notes: ""
  },
  {
    id: "exp_20200910_csdn",
    date: "2020-09-10",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.6,
    amountDisplay: "0.6元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_1",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.65,
    amountDisplay: "0.65元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_2",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.58,
    amountDisplay: "0.58元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_3",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.58,
    amountDisplay: "0.58元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_4",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.55,
    amountDisplay: "0.55元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_5",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.88,
    amountDisplay: "0.88元",
    notes: ""
  },
  {
    id: "exp_20200906_wenku",
    date: "2020-09-06",
    title: "百度文库",
    category: "other",
    description: "一篇",
    amount: 1.98,
    amountDisplay: "1.98元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_6",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.99,
    amountDisplay: "0.99元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_7",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.98,
    amountDisplay: "0.98元",
    notes: ""
  },
  {
    id: "exp_20200906_csdn_8",
    date: "2020-09-06",
    title: "CSDN",
    category: "other",
    description: "一篇",
    amount: 0.98,
    amountDisplay: "0.98元",
    notes: ""
  }
];

const CATEGORY_MAP = {
  vpn: { label: "VPN", cls: "vpn" },
  api: { label: "API", cls: "api" },
  sub: { label: "订阅", cls: "sub" },
  quota: { label: "额度", cls: "quota" },
  cloud: { label: "云平台", cls: "cloud" },
  other: { label: "会员", cls: "other" }
};

let expensesState = {
  items: [],
  query: "",
  activeCategory: "all",
  editingId: null,
  showChart: false,
  selectedFilter: null // null | { type: "category" | "year", key: string }
};

let currentUid = null;
let cloudUnsubscribe = null;
let saveTimer = null;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(num) {
  const n = Number(num) || 0;
  return "¥ " + n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(message) {
  let toast = document.getElementById("expenses-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "expenses-toast";
    toast.className = "expenses-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

function cleanRedundantDesc(desc) {
  if (!desc) return "";
  let s = desc.trim();
  s = s.replace(/^(VPN[，,]\s*)/i, "");
  s = s.replace(/^(云平台充值[（(])/i, "");
  if (s.endsWith("）") && desc.includes("云平台充值（")) s = s.slice(0, -1);
  if (s === "额度" || s === "API 充值" || s === "API" || s === "Coding 订阅" || s === "VPN") {
    return "";
  }
  return s;
}

function cleanItemTitle(title) {
  if (!title) return "";
  let s = String(title).trim();
  s = s.replace(/\s*会员\s*$/, "");
  s = s.replace(/^会员\s*/, "");
  return s.trim() || title;
}

function migrateItems(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  const existingIds = new Set();
  const existingKeys = new Set();

  list.forEach(item => {
    if (item.id === "exp_20260903_googleai" || (item.title === "Google AI Pro" && item.date === "2026-09-03" && (item.amount === 25.6 || (item.description && item.description.includes("两个账号"))))) {
      result.push({
        id: "exp_20260903_googleai_1",
        date: "2026-09-03",
        title: "Google AI Pro",
        category: "sub",
        description: "18个月",
        amount: 12.8,
        amountDisplay: "12.8元",
        notes: ""
      });
      result.push({
        id: "exp_20260903_googleai_2",
        date: "2026-09-03",
        title: "Google AI Pro",
        category: "sub",
        description: "18个月",
        amount: 12.8,
        amountDisplay: "12.8元",
        notes: ""
      });
      existingIds.add("exp_20260903_googleai_1");
      existingIds.add("exp_20260903_googleai_2");
      existingKeys.add("2026-09-03_Google AI Pro_12.8");
    } else {
      item.title = cleanItemTitle(item.title);
      item.description = cleanRedundantDesc(item.description);
      if (item.id === "exp_20260529_gpts" || item.title === "GPTs API") {
        item.amountDisplay = "35.5元";
        item.notes = "";
      }
      result.push(item);
      if (item.id) existingIds.add(item.id);
      existingKeys.add(`${item.date}_${item.title}_${item.amount}`);
    }
  });

  // 如果已有记录中缺少预置历史记录（如新增的一批历史数据），自动补齐合并
  INITIAL_EXPENSES.forEach(initItem => {
    const key = `${initItem.date}_${initItem.title}_${initItem.amount}`;
    if (!existingIds.has(initItem.id) && !existingKeys.has(key)) {
      result.push(JSON.parse(JSON.stringify(initItem)));
      existingIds.add(initItem.id);
      existingKeys.add(key);
    }
  });

  // 按日期倒序排列
  result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return result;
}

function readLocalExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(INITIAL_EXPENSES));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      const migrated = migrateItems(parsed);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
      return migrated;
    }
    return JSON.parse(JSON.stringify(INITIAL_EXPENSES));
  } catch {
    return JSON.parse(JSON.stringify(INITIAL_EXPENSES));
  }
}

function writeLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expensesState.items));
  } catch {}
}

function attachCloud(uid) {
  currentUid = uid;
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  const ref = doc(HubAuth.db, "users", uid, "expenses", "records");
  cloudUnsubscribe = onSnapshot(ref, snapshot => {
    if (!snapshot.exists()) {
      const local = readLocalExpenses();
      setDoc(ref, { items: local, updatedAt: Date.now() }).catch(() => {
        expensesState.items = local;
        renderExpenses();
      });
      return;
    }
    const data = snapshot.data();
    expensesState.items = Array.isArray(data?.items) ? data.items : [];
    if (!expensesState.items.length) {
      expensesState.items = JSON.parse(JSON.stringify(INITIAL_EXPENSES));
    } else {
      expensesState.items = migrateItems(expensesState.items);
    }
    writeLocalCache();
    renderExpenses();
  }, () => {
    expensesState.items = readLocalExpenses();
    renderExpenses();
  });
}

function detachCloud() {
  currentUid = null;
  clearTimeout(saveTimer);
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  expensesState.items = readLocalExpenses();
  renderExpenses();
}

function saveExpenses() {
  writeLocalCache();
  updateStats();
  if (!currentUid) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    setDoc(doc(HubAuth.db, "users", currentUid, "expenses", "records"), {
      items: expensesState.items,
      updatedAt: Date.now()
    }).catch(() => {
      showToast("云端同步失败，已暂存本地。");
    });
  }, 400);
}

// 更新顶部统计数据
function updateStats() {
  const items = expensesState.items;
  let total = 0;
  let y2026 = 0;
  let yHistory = 0;

  items.forEach(item => {
    const val = Number(item.amount) || 0;
    total += val;
    const year = (item.date || "").slice(0, 4);
    if (year === "2026") {
      y2026 += val;
    } else if (year) {
      yHistory += val;
    }
  });

  const totalEl = document.getElementById("exp-stat-total");
  const y2026El = document.getElementById("exp-stat-2026");
  const histEl = document.getElementById("exp-stat-hist");
  const countEl = document.getElementById("exp-stat-count");

  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (y2026El) y2026El.textContent = formatCurrency(y2026);
  if (histEl) histEl.textContent = formatCurrency(yHistory);
  if (countEl) countEl.textContent = `${items.length} 笔`;

  renderCategoryChart(items, total);
}

// 渲染综合分析看板：左上类别支出、左下连续年份支出、右侧细分饼图（更多条目展示）
function renderCategoryChart(items, totalAmount) {
  const catBody = document.getElementById("expenses-chart-cat-body");
  const yearBody = document.getElementById("expenses-chart-year-body");
  const catSub = document.getElementById("expenses-chart-cat-sub");
  const yearSub = document.getElementById("expenses-chart-year-sub");
  if (!catBody || !yearBody) return;

  const currentFilter = expensesState.selectedFilter; // null | { type: "category"|"year", key: string }

  // -------------------------------------------------------------
  // 1. 左上：按类别支出统计（降序）
  // -------------------------------------------------------------
  const catSums = {};
  const catCounts = {};
  for (const catKey in CATEGORY_MAP) {
    catSums[catKey] = 0;
    catCounts[catKey] = 0;
  }

  items.forEach(item => {
    const cat = (item.category && CATEGORY_MAP[item.category]) ? item.category : "other";
    const amt = Number(item.amount) || 0;
    catSums[cat] = (catSums[cat] || 0) + amt;
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const sortedCats = Object.keys(catSums)
    .map(key => ({
      key,
      label: CATEGORY_MAP[key]?.label || key,
      cls: CATEGORY_MAP[key]?.cls || "other",
      total: catSums[key],
      count: catCounts[key]
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  if (catSub) {
    catSub.textContent = `共 ${sortedCats.length} 类 · 总计 ${formatCurrency(totalAmount)}`;
  }

  const maxCatVal = sortedCats.length ? (sortedCats[0].total || 1) : 1;

  catBody.innerHTML = sortedCats.map(c => {
    const isSelected = currentFilter && currentFilter.type === "category" && currentFilter.key === c.key;
    const pctOfTotal = totalAmount > 0 ? ((c.total / totalAmount) * 100).toFixed(1) : "0.0";
    const barWidthPct = Math.max(3, (c.total / maxCatVal) * 100).toFixed(1);
    return `
      <div class="expenses-chart-row ${isSelected ? "active" : ""}" data-type="category" data-key="${escapeHtml(c.key)}" title="点击${isSelected ? "取消选择并查看全量分析" : `查看【${escapeHtml(c.label)}】详细细分`}">
        <div class="expenses-chart-cat-label">
          <span class="expenses-tag ${c.cls}">${escapeHtml(c.label)}</span>
        </div>
        <div class="expenses-chart-bar-wrap">
          <div class="expenses-chart-bar-fill ${c.cls}" style="width: ${barWidthPct}%;"></div>
        </div>
        <div class="expenses-chart-amount">${formatCurrency(c.total)}</div>
        <div class="expenses-chart-pct">${pctOfTotal}%</div>
      </div>
    `;
  }).join("");

  // -------------------------------------------------------------
  // 2. 左下：按年份支出统计（连续年份倒序，不跳过中间年份，没有则为0）
  // -------------------------------------------------------------
  const recordedYears = items
    .map(i => parseInt((i.date || "").slice(0, 4), 10))
    .filter(y => !isNaN(y) && y >= 2000 && y <= 2100);

  const minYear = recordedYears.length ? Math.min(...recordedYears) : new Date().getFullYear();
  const maxYear = recordedYears.length ? Math.max(...recordedYears) : new Date().getFullYear();

  const yearSums = {};
  const yearCounts = {};
  for (let y = maxYear; y >= minYear; y--) {
    const yStr = String(y);
    yearSums[yStr] = 0;
    yearCounts[yStr] = 0;
  }

  items.forEach(item => {
    const yStr = (item.date || "").slice(0, 4);
    if (yearSums[yStr] !== undefined) {
      const amt = Number(item.amount) || 0;
      yearSums[yStr] += amt;
      yearCounts[yStr] += 1;
    }
  });

  const continuousYears = [];
  for (let y = maxYear; y >= minYear; y--) {
    const yStr = String(y);
    continuousYears.push({
      key: yStr,
      label: `${yStr}年`,
      total: yearSums[yStr] || 0,
      count: yearCounts[yStr] || 0
    });
  }

  if (yearSub) {
    const activeYearsCount = continuousYears.filter(y => y.total > 0).length;
    yearSub.textContent = `${minYear} - ${maxYear}年（连续 ${continuousYears.length} 年）`;
  }

  const maxYearVal = continuousYears.reduce((m, y) => Math.max(m, y.total), 0) || 1;

  yearBody.innerHTML = continuousYears.map(y => {
    const isSelected = currentFilter && currentFilter.type === "year" && currentFilter.key === y.key;
    const pctOfTotal = totalAmount > 0 ? ((y.total / totalAmount) * 100).toFixed(1) : "0.0";
    const barWidthPct = y.total > 0 ? Math.max(3, (y.total / maxYearVal) * 100).toFixed(1) : "0";
    return `
      <div class="expenses-chart-row ${isSelected ? "active" : ""}" data-type="year" data-key="${escapeHtml(y.key)}" title="点击${isSelected ? "取消选择并查看全量分析" : `查看【${escapeHtml(y.label)}】详细细分`}">
        <div class="expenses-chart-cat-label">
          <span class="expenses-tag year-tag">${escapeHtml(y.label)}</span>
        </div>
        <div class="expenses-chart-bar-wrap">
          <div class="expenses-chart-bar-fill year-bar" style="width: ${barWidthPct}%;"></div>
        </div>
        <div class="expenses-chart-amount">${formatCurrency(y.total)}</div>
        <div class="expenses-chart-pct">${pctOfTotal}%</div>
      </div>
    `;
  }).join("");

  // -------------------------------------------------------------
  // 3. 右侧：联动渲染细分饼图（未选中时展示全量条目分析）
  // -------------------------------------------------------------
  renderCategoryPieChart(currentFilter, items);
}

// 渲染右侧细分饼图：filter 为 null 时全量分析；filter = { type: "category", key } 时分析该类；filter = { type: "year", key } 时分析该年
function renderCategoryPieChart(filter, items) {
  const container = document.getElementById("expenses-pie-container");
  if (!container) return;

  // 筛选待分析的项目列表与元信息
  let targetItems = [];
  let isAllMode = false;
  let titleHtml = "";

  if (!filter) {
    isAllMode = true;
    targetItems = items.slice();
    titleHtml = `<span class="expenses-tag other">全量</span><span>所有条目综合分析</span>`;
  } else if (filter.type === "year") {
    targetItems = items.filter(i => (i.date || "").startsWith(filter.key));
    titleHtml = `<span class="expenses-tag year-tag">${escapeHtml(filter.key)}年</span><span>年度支出细分</span>`;
  } else if (filter.type === "category" && CATEGORY_MAP[filter.key]) {
    const catMeta = CATEGORY_MAP[filter.key];
    targetItems = items.filter(i => (i.category || "other") === filter.key);
    titleHtml = `<span class="expenses-tag ${catMeta.cls}">${escapeHtml(catMeta.label)}</span><span>类别构成分析</span>`;
  } else {
    isAllMode = true;
    targetItems = items.slice();
    titleHtml = `<span class="expenses-tag other">全量</span><span>所有条目综合分析</span>`;
  }

  if (!targetItems.length) {
    container.innerHTML = `
      <div class="expenses-pie-header">
        <div class="expenses-pie-title">${titleHtml}</div>
        <div class="expenses-pie-header-right">
          <button type="button" class="expenses-pie-reset-btn" id="expenses-pie-reset" title="恢复全量综合分析">全量分析 ✕</button>
          <span class="expenses-pie-total">¥ 0.00</span>
        </div>
      </div>
      <div style="text-align:center;color:var(--muted);margin:auto;font-size:13px;padding:30px 0;">该筛选条件下暂无支出条目</div>
    `;
    return;
  }

  // 按条目标题聚合消费金额与记录笔数
  const titleSums = {};
  const titleCounts = {};
  const titleCats = {};
  let totalSum = 0;

  targetItems.forEach(i => {
    const t = i.title || "未命名项目";
    const val = Number(i.amount) || 0;
    titleSums[t] = (titleSums[t] || 0) + val;
    titleCounts[t] = (titleCounts[t] || 0) + 1;
    if (!titleCats[t] && i.category && CATEGORY_MAP[i.category]) {
      titleCats[t] = i.category;
    }
    totalSum += val;
  });

  const sortedTitles = Object.keys(titleSums)
    .map(title => ({
      title,
      amount: titleSums[title],
      count: titleCounts[title] || 1,
      catKey: titleCats[title] || "other",
      pct: totalSum > 0 ? (titleSums[title] / totalSum) : 0
    }))
    .filter(s => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (!sortedTitles.length) {
    container.innerHTML = `
      <div class="expenses-pie-header">
        <div class="expenses-pie-title">${titleHtml}</div>
        <div class="expenses-pie-header-right">
          <button type="button" class="expenses-pie-reset-btn" id="expenses-pie-reset" title="恢复全量综合分析">全量分析 ✕</button>
          <span class="expenses-pie-total">¥ 0.00</span>
        </div>
      </div>
      <div style="text-align:center;color:var(--muted);margin:auto;font-size:13px;padding:30px 0;">暂无有效金额数据</div>
    `;
    return;
  }

  // 预置丰富的高对比度现代调色板（支持随年份增加动态分配更多独特醒目色彩）
  const PALETTE = [
    "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899",
    "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16",
    "#e11d48", "#0284c7", "#d97706", "#9333ea", "#059669",
    "#ea580c", "#4f46e5", "#0d9488", "#ca8a04", "#be185d",
    "#2563eb", "#059669", "#7c3aed", "#d97706", "#db2777",
    "#0891b2", "#c2410c", "#0f766e", "#4338ca", "#65a30d",
    "#be123c", "#1d4ed8", "#4f46e5", "#047857", "#b45309"
  ];
  const OTHER_COLOR = "#94a3b8"; // “其他”专用柔和中性色

  // 动态计算展示条目数：
  // 基准状态（6 个有效类别 + 2020-2026 连续 7 年，共 13 行）对应右侧显示 19 条明细 + 1 条“其他”；
  // 左侧（按类别、按年份）每增加或减少 1 条，右侧图例列表精确联动增加或减少 1 条（若条目充裕）：
  // 计算当前有效类别数（金额 > 0 的类别）
  const activeCatsCount = Object.keys(CATEGORY_MAP).filter(catKey =>
    (expensesState.items || []).some(i => (i.category || "other") === catKey && Number(i.amount) > 0)
  ).length || 6;

  // 计算连续年份数
  const allRecordedYears = (expensesState.items || [])
    .map(i => parseInt((i.date || "").slice(0, 4), 10))
    .filter(y => !isNaN(y) && y >= 2000 && y <= 2100);
  const minRecordedYear = allRecordedYears.length ? Math.min(...allRecordedYears) : 2020;
  const maxRecordedYear = allRecordedYears.length ? Math.max(...allRecordedYears) : 2026;
  const continuousYearsCount = (maxRecordedYear >= minRecordedYear)
    ? (maxRecordedYear - minRecordedYear + 1)
    : 7;

  // 总增量 = (当前类别数 - 基准6) + (当前年份数 - 基准7)
  const leftTotalDelta = (activeCatsCount - 6) + (continuousYearsCount - 7);
  const maxExplicitItems = Math.max(1, 19 + leftTotalDelta);

  let slices = [];
  if (sortedTitles.length <= maxExplicitItems) {
    slices = sortedTitles;
  } else {
    slices = sortedTitles.slice(0, maxExplicitItems);
    const rest = sortedTitles.slice(maxExplicitItems);
    const restAmount = rest.reduce((sum, s) => sum + s.amount, 0);
    const restCount = rest.reduce((sum, s) => sum + s.count, 0);
    slices.push({
      title: "其他",
      amount: restAmount,
      count: restCount,
      catKey: "other",
      isOther: true,
      pct: totalSum > 0 ? (restAmount / totalSum) : 0
    });
  }

  // 构建 SVG 环形图（周长 2 * PI * r = 2 * PI * 42 ≈ 263.89）
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const svgCircles = slices.map((s, idx) => {
    const strokeDash = s.pct * circumference;
    const color = s.isOther ? OTHER_COLOR : PALETTE[idx % PALETTE.length];
    const circle = `
      <circle
        class="expenses-pie-slice"
        data-index="${idx}"
        cx="70" cy="70" r="${radius}"
        fill="transparent"
        stroke="${color}"
        stroke-width="22"
        stroke-dasharray="${strokeDash.toFixed(2)} ${circumference.toFixed(2)}"
        stroke-dashoffset="${(-currentOffset).toFixed(2)}"
        stroke-linecap="butt"
      >
        <title>${escapeHtml(s.title)}: ${formatCurrency(s.amount)} (${(s.pct * 100).toFixed(1)}%)</title>
      </circle>
    `;
    currentOffset += strokeDash;
    return circle;
  }).join("");

  // 图例列表：显示这 19 条（若有超出则第 20 项显示“其他”）
  const legendHtml = slices.map((s, idx) => {
    const color = s.isOther ? OTHER_COLOR : PALETTE[idx % PALETTE.length];
    const pctStr = (s.pct * 100).toFixed(1) + "%";
    const hoverTitle = s.isOther
      ? `其他（共 ${sortedTitles.length - maxExplicitItems} 项，${s.count} 笔支出）`
      : `${s.title}（${s.count} 笔）`;
    return `
      <div class="expenses-pie-legend-item" data-index="${idx}">
        <div class="expenses-pie-legend-left" title="${escapeHtml(hoverTitle)}">
          <span class="expenses-pie-legend-dot" style="background-color: ${color};"></span>
          <span class="expenses-pie-legend-name">${escapeHtml(s.title)}</span>
        </div>
        <div class="expenses-pie-legend-right">
          <span class="expenses-pie-legend-amount">${formatCurrency(s.amount)}</span>
          <span class="expenses-pie-legend-pct">${pctStr}</span>
        </div>
      </div>
    `;
  }).join("");

  const resetBtnHtml = !isAllMode
    ? `<button type="button" class="expenses-pie-reset-btn" id="expenses-pie-reset" title="取消单项筛选，恢复全量条目综合分析">全量分析 ✕</button>`
    : "";

  container.innerHTML = `
    <div class="expenses-pie-header">
      <div class="expenses-pie-title">
        ${titleHtml}
      </div>
      <div class="expenses-pie-header-right">
        ${resetBtnHtml}
        <span class="expenses-pie-total">${formatCurrency(totalSum)}</span>
      </div>
    </div>
    <div class="expenses-pie-content">
      <div class="expenses-pie-svg-wrap">
        <svg viewBox="0 0 140 140">
          ${svgCircles}
        </svg>
        <div class="expenses-pie-donut-hole">
          <span>共 ${sortedTitles.length} 项</span>
          <strong>${targetItems.length} 笔</strong>
        </div>
      </div>
      <div class="expenses-pie-legend">
        ${legendHtml}
      </div>
    </div>
  `;
}

// 格式化日期显示为 月日（例如“9月3日”与“12月26日”）
function formatDisplayDate(dateStr) {
  if (!dateStr) return "未知";
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateStr;
}

// 主渲染函数
function renderExpenses() {
  updateStats();
  const listEl = document.getElementById("expenses-list");
  if (!listEl) return;

  let filtered = expensesState.items.slice();

  // 分类过滤
  if (expensesState.activeCategory && expensesState.activeCategory !== "all") {
    filtered = filtered.filter(item => item.category === expensesState.activeCategory);
  }

  // 关键词搜索
  if (expensesState.query) {
    const q = expensesState.query.toLowerCase();
    filtered = filtered.filter(item =>
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.amountDisplay && item.amountDisplay.toLowerCase().includes(q)) ||
      (item.date && item.date.includes(q))
    );
  }

  // 排序：日期倒序
  filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (!filtered.length) {
    let emptyMsg = "当前暂无符合条件的支出记录。点击上方“+ 支出”按钮即可新增！";
    if (expensesState.query) emptyMsg = `没有找到包含“${escapeHtml(expensesState.query)}”的支出记录。`;
    listEl.innerHTML = `<div class="expenses-empty"><strong>空空如也</strong><p>${emptyMsg}</p></div>`;
    return;
  }

  // 按年月分组 (YYYY-MM)
  const monthGroups = {};
  for (const item of filtered) {
    const key = (item.date && item.date.length >= 7) ? item.date.slice(0, 7) : "其它时间";
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(item);
  }

  const sortedMonthKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

  listEl.innerHTML = sortedMonthKeys.map(monthKey => {
    const items = monthGroups[monthKey];
    let monthSum = 0;
    items.forEach(i => { monthSum += (Number(i.amount) || 0); });

    let yearText = "";
    let monthText = monthKey;
    const parts = monthKey.split("-");
    if (parts.length === 2) {
      yearText = `${parts[0]}年`;
      monthText = `${parseInt(parts[1], 10)}月`;
    }

    const itemsHtml = items.map(item => {
      const isEditing = expensesState.editingId === item.id;
      const catConfig = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;

      if (isEditing) {
        return `
          <div class="expenses-item-row editing" data-id="${escapeHtml(item.id)}">
            <div class="expenses-edit-box">
              <div class="expenses-edit-grid">
                <input class="expenses-input edit-date" type="date" value="${escapeHtml(item.date)}" title="日期">
                <select class="expenses-select edit-category">
                  <option value="vpn" ${item.category === "vpn" ? "selected" : ""}>VPN / 机场</option>
                  <option value="api" ${item.category === "api" ? "selected" : ""}>API 充值</option>
                  <option value="sub" ${item.category === "sub" ? "selected" : ""}>AI 订阅</option>
                  <option value="quota" ${item.category === "quota" ? "selected" : ""}>额度充值</option>
                  <option value="cloud" ${item.category === "cloud" ? "selected" : ""}>云平台</option>
                  <option value="other" ${item.category === "other" ? "selected" : ""}>会员</option>
                </select>
                <input class="expenses-input edit-title" type="text" value="${escapeHtml(item.title)}" placeholder="支出项目名称">
                <input class="expenses-input edit-desc" type="text" value="${escapeHtml(item.description || "")}" placeholder="规格 / 周期 / 套餐详情">
                <input class="expenses-input edit-amount" type="number" step="0.01" value="${item.amount}" placeholder="数值(元)">
              </div>
              <div class="expenses-edit-sub-grid">
                <div></div>
                <input class="expenses-input edit-notes" type="text" value="${escapeHtml(item.notes || "")}" placeholder="详细备注（可选）">
              </div>
              <div class="expenses-edit-actions">
                <button type="button" class="expenses-action-btn" data-action="cancel-edit">取消</button>
                <button type="button" class="expenses-action-btn primary" data-action="save-edit" style="background:var(--accent);color:#fff;border-color:var(--accent)">保存修改</button>
              </div>
            </div>
          </div>
        `;
      }


      return `
        <div class="expenses-item-row" data-id="${escapeHtml(item.id)}">
          <div class="expenses-item-date">${escapeHtml(formatDisplayDate(item.date))}</div>
          <div class="expenses-item-content">
            <div class="expenses-item-main-line">
              <div class="expenses-item-info">
                <span class="expenses-tag ${catConfig.cls}">${escapeHtml(catConfig.label)}</span>
                <div class="expenses-item-detail">
                  <div class="expenses-item-heading">
                    <strong class="expenses-item-title">${escapeHtml(item.title)}</strong>
                    ${item.description ? `<span class="expenses-item-desc">${escapeHtml(item.description)}</span>` : ""}
                  </div>
                  ${item.notes ? `<div class="expenses-item-notes">${escapeHtml(item.notes)}</div>` : ""}
                </div>
              </div>
              <div class="expenses-item-right">
                <div class="expenses-amount-wrapper">
                  <span class="expenses-amount-val">${formatCurrency(item.amount)}</span>
                </div>
                <div class="expenses-item-actions">
                  <button type="button" class="expenses-action-btn" data-action="edit-item" title="编辑此条支出">编辑</button>
                  <button type="button" class="expenses-action-btn danger" data-action="delete-item" title="删除此条支出">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="expenses-month-card" data-month="${escapeHtml(monthKey)}">
        <aside class="expenses-month-aside">
          <div class="expenses-month-label">
            <span class="expenses-month-title">${escapeHtml(yearText ? `${yearText}${monthText}` : monthText)}</span>
          </div>
          <div class="expenses-month-meta">
            <span class="expenses-month-count">共 ${items.length} 笔</span>
            <span class="expenses-month-total">${formatCurrency(monthSum)}</span>
          </div>
        </aside>
        <div class="expenses-month-body">
          <div class="expenses-month-items">
            ${itemsHtml}
          </div>
        </div>
      </section>
    `;
  }).join("");
}

// 事件初始化
function initExpensesEvents() {
  const modal = document.getElementById("expenses-modal");
  const openModalBtn = document.getElementById("expenses-btn-open-modal");
  const toggleChartBtn = document.getElementById("expenses-btn-toggle-chart");
  const chartPanel = document.getElementById("expenses-chart-panel");
  const closeModalBtn = document.getElementById("expenses-modal-close");
  const cancelModalBtn = document.getElementById("expenses-modal-cancel");
  const form = document.getElementById("expenses-form");
  const searchInput = document.getElementById("expenses-search");
  const listEl = document.getElementById("expenses-list");
  const filterBar = document.getElementById("expenses-filter-bar");

  // 展开/收起类别支出条形图
  if (toggleChartBtn && chartPanel) {
    toggleChartBtn.addEventListener("click", () => {
      expensesState.showChart = !expensesState.showChart;
      chartPanel.hidden = !expensesState.showChart;
      toggleChartBtn.classList.toggle("active", expensesState.showChart);
      toggleChartBtn.setAttribute("aria-expanded", String(expensesState.showChart));
      if (expensesState.showChart) {
        updateStats();
      }
    });

    // 点击分析行（类别行或年份行）或右侧重置按钮切换/取消穿透分析
    chartPanel.addEventListener("click", e => {
      // 点击恢复全量分析按钮
      const resetBtn = e.target.closest("#expenses-pie-reset");
      if (resetBtn) {
        expensesState.selectedFilter = null;
        chartPanel.querySelectorAll(".expenses-chart-row").forEach(r => r.classList.remove("active"));
        renderCategoryPieChart(null, expensesState.items);
        return;
      }

      // 点击条形行（类别或年份）
      const row = e.target.closest(".expenses-chart-row");
      if (!row) return;
      const type = row.dataset.type || "category";
      const key = row.dataset.key || row.dataset.cat;
      if (!key) return;

      const current = expensesState.selectedFilter;
      if (current && current.type === type && current.key === key) {
        // 再次点击已选中的条目行，则取消选中并恢复全量分析
        expensesState.selectedFilter = null;
        chartPanel.querySelectorAll(".expenses-chart-row").forEach(r => r.classList.remove("active"));
        renderCategoryPieChart(null, expensesState.items);
      } else {
        // 选中该项并展示其细分（无论是类别还是年份）
        expensesState.selectedFilter = { type, key };
        chartPanel.querySelectorAll(".expenses-chart-row").forEach(r => {
          const rType = r.dataset.type || "category";
          const rKey = r.dataset.key || r.dataset.cat;
          r.classList.toggle("active", rType === type && rKey === key);
        });
        renderCategoryPieChart(expensesState.selectedFilter, expensesState.items);
      }
    });

    // 鼠标在饼图圆弧或图例项上悬停时的双向动画与高亮同步联动
    const pieContainer = document.getElementById("expenses-pie-container");
    if (pieContainer) {
      const setPieHoverHighlight = idx => {
        pieContainer.querySelectorAll(".expenses-pie-slice").forEach(slice => {
          slice.classList.toggle("active", slice.dataset.index === String(idx));
        });
        pieContainer.querySelectorAll(".expenses-pie-legend-item").forEach(item => {
          item.classList.toggle("active", item.dataset.index === String(idx));
        });
      };

      const clearPieHoverHighlight = () => {
        pieContainer.querySelectorAll(".expenses-pie-slice").forEach(slice => {
          slice.classList.remove("active");
        });
        pieContainer.querySelectorAll(".expenses-pie-legend-item").forEach(item => {
          item.classList.remove("active");
        });
      };

      pieContainer.addEventListener("mouseover", e => {
        const slice = e.target.closest(".expenses-pie-slice");
        const legendItem = e.target.closest(".expenses-pie-legend-item");
        const target = slice || legendItem;
        if (target && target.dataset.index !== undefined) {
          setPieHoverHighlight(target.dataset.index);
        }
      });

      pieContainer.addEventListener("mouseout", e => {
        const related = e.relatedTarget;
        if (!related || !pieContainer.contains(related)) {
          clearPieHoverHighlight();
          return;
        }
        const currentTarget = e.target.closest(".expenses-pie-slice, .expenses-pie-legend-item");
        const nextTarget = related.closest(".expenses-pie-slice, .expenses-pie-legend-item");
        if (!nextTarget || nextTarget.dataset.index !== currentTarget?.dataset.index) {
          if (!nextTarget) {
            clearPieHoverHighlight();
          } else {
            setPieHoverHighlight(nextTarget.dataset.index);
          }
        }
      });
    }
  }

  // 打开弹窗
  if (openModalBtn && modal) {
    openModalBtn.addEventListener("click", () => {
      form.reset();
      const dateInput = document.getElementById("exp-form-date");
      if (dateInput) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        dateInput.value = `${y}-${m}-${d}`;
      }
      modal.showModal();
    });
  }

  // 关闭弹窗
  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener("click", () => modal.close());
  }
  if (cancelModalBtn && modal) {
    cancelModalBtn.addEventListener("click", () => modal.close());
  }
  if (modal) {
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.close();
    });
  }

  // 提交新建表单
  if (form && modal) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const date = document.getElementById("exp-form-date").value.trim();
      const title = document.getElementById("exp-form-title").value.trim();
      const category = document.getElementById("exp-form-cat").value;
      const description = document.getElementById("exp-form-desc").value.trim();
      const amountVal = parseFloat(document.getElementById("exp-form-amount").value);
      const notes = document.getElementById("exp-form-notes").value.trim();

      if (!date) {
        alert("请选择日期");
        return;
      }
      if (!title) {
        alert("请输入项目名称");
        return;
      }
      if (isNaN(amountVal)) {
        alert("请输入有效金额");
        return;
      }

      const newItem = {
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        title,
        category,
        description,
        amount: Math.round(amountVal * 100) / 100,
        amountDisplay: `${amountVal}元`,
        notes
      };

      expensesState.items.unshift(newItem);
      saveExpenses();
      renderExpenses();
      modal.close();
      showToast("已成功记录 1 笔新支出！");
    });
  }

  // 搜索
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      expensesState.query = searchInput.value.trim();
      renderExpenses();
    });
  }

  // 分类筛选胶囊
  if (filterBar) {
    filterBar.addEventListener("click", e => {
      const pill = e.target.closest(".expenses-filter-pill");
      if (!pill) return;
      filterBar.querySelectorAll(".expenses-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      expensesState.activeCategory = pill.dataset.cat || "all";
      renderExpenses();
    });
  }

  // 列表内操作：编辑、删除、保存修改、取消修改
  if (listEl) {
    listEl.addEventListener("click", e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest(".expenses-item-row");
      const id = row?.dataset.id;
      if (!id) return;

      const action = btn.dataset.action;
      const itemIndex = expensesState.items.findIndex(i => i.id === id);
      if (itemIndex === -1) return;
      const item = expensesState.items[itemIndex];

      if (action === "edit-item") {
        expensesState.editingId = id;
        renderExpenses();
        const editRow = listEl.querySelector(`.expenses-item-row[data-id="${id}"]`);
        editRow?.querySelector(".edit-title")?.focus();
      } else if (action === "cancel-edit") {
        expensesState.editingId = null;
        renderExpenses();
      } else if (action === "save-edit") {
        const newDate = row.querySelector(".edit-date")?.value.trim() || item.date;
        const newTitle = row.querySelector(".edit-title")?.value.trim() || item.title;
        const newCat = row.querySelector(".edit-category")?.value || item.category;
        const newDesc = row.querySelector(".edit-desc")?.value.trim() || "";
        const newAmount = parseFloat(row.querySelector(".edit-amount")?.value);
        const newDisplay = row.querySelector(".edit-amount-display")?.value.trim() ?? item.amountDisplay ?? "";
        const newNotes = row.querySelector(".edit-notes")?.value.trim() || "";

        if (!newTitle) {
          alert("项目名称不能为空");
          return;
        }

        item.date = newDate;
        item.title = newTitle;
        item.category = newCat;
        item.description = newDesc;
        if (!isNaN(newAmount)) item.amount = Math.round(newAmount * 100) / 100;
        item.amountDisplay = newDisplay;
        item.notes = newNotes;

        expensesState.editingId = null;
        saveExpenses();
        renderExpenses();
        showToast("已保存支出修改。");
      } else if (action === "delete-item") {
        const confirmDelete = window.confirm(`确定要删除“${item.title}”（${item.amountDisplay || formatCurrency(item.amount)}）这条支出记录吗？`);
        if (confirmDelete) {
          expensesState.items.splice(itemIndex, 1);
          saveExpenses();
          renderExpenses();
          showToast("已删除 1 条支出记录。");
        }
      }
    });
  }

  // 快捷键支持：按 E 打开新建支出弹窗（不在输入状态时）
  document.addEventListener("keydown", e => {
    if (e.key === "e" || e.key === "E") {
      const activeEl = document.activeElement;
      const isInputting = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (!isInputting) {
        const expensesTab = document.getElementById("tab-expenses");
        if (expensesTab && expensesTab.getAttribute("aria-selected") === "true") {
          e.preventDefault();
          openModalBtn?.click();
        }
      }
    }
  });
}

// 初始化数据
expensesState.items = readLocalExpenses();
renderExpenses();
initExpensesEvents();

// 监听认证状态
HubAuth.onChange(user => {
  if (user) {
    attachCloud(user.uid);
  } else {
    detachCloud();
  }
});

export { expensesState, renderExpenses };
