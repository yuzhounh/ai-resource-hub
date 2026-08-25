import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCb2KYknXU04OxEpFIVbmCFXRoHNJ2cA5g",
  authDomain: "ai-resource-hub-manager.firebaseapp.com",
  projectId: "ai-resource-hub-manager",
  storageBucket: "ai-resource-hub-manager.firebasestorage.app",
  messagingSenderId: "926784069813",
  appId: "1:926784069813:web:41b8bd97dd1cfd102c5efc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const collectionNames = ["plans", "promotions", "transactions", "models", "compatibilityTests", "usageSnapshots", "notes"];
const state = {
  user: null,
  activePanel: "plans",
  query: "",
  editing: null,
  unsubscribers: [],
  data: Object.fromEntries(collectionNames.map(name => [name, []]))
};

const statusOptions = ["正常", "暂停", "已到期", "已用尽"];
const testStatusOptions = ["可用", "部分可用", "不可用", "不稳定", "未测试", "已失效"];
const modelStatusOptions = ["可用", "部分可用", "不可用", "不稳定", "未测试"];

const schemas = {
  plans: {
    title: "Plan",
    eyebrow: "SUBSCRIPTION",
    fields: [
      { name: "name", label: "Plan 名称", required: true, full: true },
      { name: "provider", label: "提供方", required: true },
      { name: "type", label: "类型", type: "select", options: ["Coding Plan", "Token Plan", "按量 API", "会员权益", "Credits 套餐", "其他"] },
      { name: "region", label: "地区", type: "select", options: ["国内", "国外", "全球"] },
      { name: "status", label: "状态", type: "select", options: statusOptions },
      { name: "purchaseAmount", label: "购买 / 充值金额", type: "number", step: "0.01" },
      { name: "currency", label: "币种", type: "select", options: ["CNY", "USD", "EUR", "JPY", "其他"] },
      { name: "remainingMode", label: "额度数值类型", type: "select", options: ["百分比", "金额"], defaultValue: "百分比" },
      { name: "quotaDisplayMode", label: "额度显示方式", type: "select", options: ["剩余", "已用"], defaultValue: "剩余" },
      { name: "remainingValue", label: "当前剩余", type: "number", step: "0.01", min: "0", defaultValue: 100, help: "百分比模式填写 0–100；金额模式填写实际数值。" },
      { name: "quotaPeriodDays", label: "额度周期（天）", type: "number", step: "1", min: "1", defaultValue: 7, help: "默认按 7 天额度周期记录。" },
      { name: "nextResetAt", label: "下次重置时间", type: "datetime-local", step: "1", help: "可填写具体时间，或输入 27 days 4 hours / 27天4小时；按当前设备本地时间换算。" },
      { name: "quotaTotal", label: "套餐标称总额度（可选）", type: "number", step: "any" },
      { name: "quotaUnit", label: "额度单位", type: "select", options: ["Tokens", "Credits", "CNY", "USD", "请求", "其他"] },
      { name: "startDate", label: "开始日期", type: "date" },
      { name: "expiresAt", label: "截止日期", type: "date" },
      { name: "openaiBaseUrl", label: "OpenAI Base URL", type: "url", full: true, help: "用于 OpenAI Responses / Chat Completions 兼容接口。" },
      { name: "anthropicBaseUrl", label: "Anthropic Base URL", type: "url", full: true, help: "用于 Anthropic Messages 兼容接口。只记录服务地址，不记录认证信息。" },
      { name: "consoleUrl", label: "控制台 / Usage 链接", type: "url" },
      { name: "docsUrl", label: "官方文档链接", type: "url" },
      { name: "credentialLabel", label: "凭证别名", help: "例如“个人主账号”；不要填写真实 Key。" },
      { name: "notes", label: "注意事项", type: "textarea", full: true }
    ]
  },
  promotions: {
    title: "限时优惠",
    eyebrow: "LIMITED OFFER",
    fields: [
      { name: "title", label: "优惠名称", required: true, full: true },
      { name: "provider", label: "提供方", required: true },
      { name: "offerType", label: "优惠类型", type: "select", options: ["模型免费", "免费额度", "折扣", "赠送 Credits", "其他"] },
      { name: "status", label: "状态", type: "select", options: ["进行中", "即将开始", "已结束"], defaultValue: "进行中" },
      { name: "planId", label: "关联 Plan（可选）", type: "planSelect" },
      { name: "models", label: "适用模型 / 资源", full: true, help: "例如 OX Alpha，或填写多种可免费体验的模型。" },
      { name: "benefit", label: "优惠内容", type: "textarea", full: true, required: true, help: "例如免费一周、赠送免费消费额或提供体验额度。" },
      { name: "startsAt", label: "开始时间", type: "datetime-local", help: "可填写具体时间，也可输入相对当前时间的时长。" },
      { name: "expiresAt", label: "结束时间", type: "datetime-local", help: "可填写具体时间，也可输入 7 days / 7天。" },
      { name: "consoleUrl", label: "活动 / 控制台链接", type: "url" },
      { name: "docsUrl", label: "说明文档链接", type: "url" },
      { name: "notes", label: "注意事项", type: "textarea", full: true }
    ]
  },
  transactions: {
    title: "充值 / 购买套餐记录",
    eyebrow: "PAYMENT",
    fields: [
      { name: "planId", label: "关联 Plan", type: "planSelect", required: true },
      { name: "recordType", label: "记录类型", type: "select", options: ["充值", "购买套餐"], defaultValue: "充值", required: true },
      { name: "amount", label: "金额", type: "number", step: "0.01", min: "0.01", required: true },
      { name: "currency", label: "币种", type: "select", options: ["CNY", "USD", "EUR", "JPY", "其他"], defaultValue: "CNY", required: true },
      { name: "recordedAt", label: "日期", type: "date", required: true },
      { name: "notes", label: "备注", type: "textarea", full: true }
    ]
  },
  models: {
    title: "模型",
    eyebrow: "MODEL",
    fields: [
      { name: "name", label: "模型名称", required: true },
      { name: "planId", label: "所属 Plan", type: "planSelect", required: true },
      { name: "protocol", label: "API 协议", type: "select", options: ["OpenAI Responses", "OpenAI Chat Completions", "Anthropic Messages", "Gemini", "自定义"] },
      { name: "status", label: "实测状态", type: "select", options: modelStatusOptions },
      { name: "contextWindow", label: "上下文长度", type: "number", step: "1" },
      { name: "maxOutput", label: "最大输出", type: "number", step: "1" },
      { name: "capabilities", label: "能力", full: true, help: "用逗号分隔，例如 Tool Calling, Vision, Streaming。" },
      { name: "testedAt", label: "最近测试日期", type: "date" },
      { name: "quality", label: "实测效果", type: "textarea", full: true },
      { name: "notes", label: "限制与注意事项", type: "textarea", full: true }
    ]
  },
  compatibilityTests: {
    title: "Harness 测试",
    eyebrow: "COMPATIBILITY",
    fields: [
      { name: "planId", label: "Plan", type: "planSelect", required: true },
      { name: "modelId", label: "模型", type: "modelSelect" },
      { name: "harness", label: "Harness", required: true, help: "例如 Codex、Claude Code、OpenCode、Cline。" },
      { name: "harnessVersion", label: "Harness 版本" },
      { name: "status", label: "结果", type: "select", options: testStatusOptions },
      { name: "testedAt", label: "测试日期", type: "date" },
      { name: "latencyMs", label: "延迟（ms）", type: "number", step: "1" },
      { name: "features", label: "已验证能力", full: true, help: "例如对话、工具调用、视觉、长上下文。" },
      { name: "error", label: "错误或异常", type: "textarea", full: true, help: "粘贴前请删除 Authorization、Cookie 和完整请求头。" },
      { name: "notes", label: "配置方法与结论", type: "textarea", full: true }
    ]
  },
  usageSnapshots: {
    title: "用量快照",
    eyebrow: "USAGE",
    fields: [
      { name: "planId", label: "Plan", type: "planSelect", required: true },
      { name: "recordedAt", label: "记录日期", type: "date", required: true },
      { name: "remaining", label: "剩余额度", type: "number", step: "any", required: true },
      { name: "used", label: "已用额度", type: "number", step: "any" },
      { name: "unit", label: "单位", type: "select", options: ["Tokens", "Credits", "CNY", "USD", "请求", "其他"] },
      { name: "sourceUrl", label: "数据来源链接", type: "url", full: true },
      { name: "notes", label: "备注", type: "textarea", full: true }
    ]
  },
  notes: {
    title: "备注",
    eyebrow: "NOTE",
    fields: [
      { name: "title", label: "标题", required: true, full: true },
      { name: "category", label: "分类", type: "select", options: ["配置", "限制", "错误", "解决办法", "购买记录", "其他"] },
      { name: "planId", label: "关联 Plan", type: "planSelect" },
      { name: "content", label: "内容", type: "textarea", full: true, required: true }
    ]
  }
};

const els = {
  login: document.getElementById("manager-login"),
  app: document.getElementById("manager-app"),
  account: document.getElementById("manager-account"),
  userMenuButton: document.getElementById("manager-user-menu-button"),
  userMenu: document.getElementById("manager-user-menu"),
  userName: document.getElementById("manager-user-name"),
  userEmail: document.getElementById("manager-user-email"),
  userAvatar: document.getElementById("manager-user-avatar"),
  userAvatarFallback: document.getElementById("manager-user-avatar-fallback"),
  menuAvatar: document.getElementById("manager-menu-avatar"),
  menuAvatarFallback: document.getElementById("manager-menu-avatar-fallback"),
  addButton: document.getElementById("manager-add-button"),
  addMenu: document.getElementById("manager-add-menu"),
  uid: document.getElementById("manager-uid"),
  authMessage: document.getElementById("manager-auth-message"),
  syncMessage: document.getElementById("manager-sync-message"),
  search: document.getElementById("manager-search"),
  dialog: document.getElementById("manager-dialog"),
  form: document.getElementById("manager-form"),
  fields: document.getElementById("manager-form-fields"),
  formMessage: document.getElementById("manager-form-message"),
  dialogTitle: document.getElementById("manager-dialog-title"),
  dialogEyebrow: document.getElementById("manager-dialog-eyebrow")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function linkifyText(value = "") {
  const text = String(value);
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  let html = "";
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const matchedUrl = match[0];
    const url = matchedUrl.replace(/[，。；！？、,;!?]+$/, "");
    const trailingText = matchedUrl.slice(url.length);
    html += escapeHtml(text.slice(lastIndex, match.index));
    const safe = safeUrl(url);
    html += safe
      ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>${escapeHtml(trailingText)}`
      : escapeHtml(matchedUrl);
    lastIndex = match.index + matchedUrl.length;
  }

  return html + escapeHtml(text.slice(lastIndex));
}

function containsLikelySecret(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~-]{16,})/i.test(text);
}

function setMessage(element, message = "", type = "") {
  element.textContent = message;
  element.className = `manager-message${type ? ` ${type}` : ""}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateInput(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
  return String(value);
}

function formatDateTimeInput(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || "00"}`;
  return String(value);
}

function parseDateInput(value) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!match) throw new Error("日期格式应为“2026年8月17日”。");
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) throw new Error("请输入有效日期。");
  const pad = number => String(number).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateTimeInput(value) {
  if (!value) return "";
  const text = String(value).trim();
  const pad = number => String(number).padStart(2, "0");
  const toStoredValue = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const absoluteMatch = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (absoluteMatch) {
    const [, year, month, day, hour, minute, second] = absoluteMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) throw new Error("请输入有效的日期和 24 小时时间。");
    return toStoredValue(date);
  }
  const relativeMatch = text.match(/^(?:(\d+(?:\.\d+)?)\s*天)?\s*(?:(\d+(?:\.\d+)?)\s*小时)?\s*(?:(\d+(?:\.\d+)?)\s*分钟)?$/)
    || text.match(/^(?:(\d+(?:\.\d+)?)\s*days?)?\s*(?:(\d+(?:\.\d+)?)\s*hours?)?\s*(?:(\d+(?:\.\d+)?)\s*minutes?)?$/i);
  if (relativeMatch && relativeMatch.slice(1).some(part => part !== undefined)) {
    const [, days = 0, hours = 0, minutes = 0] = relativeMatch;
    const durationMs = (Number(days) * 24 * 60 + Number(hours) * 60 + Number(minutes)) * 60000;
    if (durationMs > 0) return toStoredValue(new Date(Date.now() + durationMs));
  }
  throw new Error("请输入“2026年8月24日 14:30:00”、‘27 days 4 hours’或“27天4小时”。");
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number) : "—";
}

function formatMoney(value, currency = "CNY") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (!["CNY", "USD", "EUR", "JPY"].includes(currency)) return `${formatNumber(number)} ${escapeHtml(currency || "")}`;
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(number).replace("US$", "$");
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function formatResetDistance(value) {
  if (!value) return "尚未设置";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "时间格式无效";
  const differenceMs = target.getTime() - Date.now();
  if (differenceMs <= 0) return "已到重置时间";
  return `${(differenceMs / 86400000).toFixed(1)}天`;
}

function countdownTone(value) {
  if (!value) return "";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "";
  const days = (target.getTime() - Date.now()) / 86400000;
  if (days <= 3) return "countdown-critical";
  if (days <= 7) return "countdown-warning";
  if (days <= 30) return "countdown-safe";
  return "countdown-distant";
}

function byUpdated(items) {
  return [...items].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

function byTitle(items, getTitle = item => item.name || item.title || item.harness || "") {
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  return [...items].sort((a, b) => {
    const titleA = String(getTitle(a) || "").trim();
    const titleB = String(getTitle(b) || "").trim();
    const groupA = /^[A-Za-z]/.test(titleA) ? 0 : /[\u3400-\u9fff]/.test(titleA[0] || "") ? 1 : 2;
    const groupB = /^[A-Za-z]/.test(titleB) ? 0 : /[\u3400-\u9fff]/.test(titleB[0] || "") ? 1 : 2;
    return groupA - groupB || collator.compare(titleA, titleB);
  });
}

function findPlan(id) {
  return state.data.plans.find(item => item.id === id);
}

function findModel(id) {
  return state.data.models.find(item => item.id === id);
}

function quotaPercent(item) {
  if (item.remainingMode === "金额") return null;
  const current = Number(item.remainingValue);
  if (Number.isFinite(current)) return Math.max(0, Math.min(100, current));
  const explicit = Number(item.quotaRemainingPercent);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const total = Number(item.quotaTotal);
  const remaining = Number(item.quotaRemaining);
  if (total > 0 && Number.isFinite(remaining)) return Math.max(0, Math.min(100, remaining / total * 100));
  return null;
}

function remainingPercent(item) {
  const percent = quotaPercent(item);
  if (percent === null) return null;
  return item.quotaDisplayMode === "已用" ? 100 - percent : percent;
}

function badge(status) {
  const ok = ["正常", "可用", "进行中"].includes(status);
  const bad = ["不可用", "已到期", "已用尽", "已失效", "已结束"].includes(status);
  const warn = ["部分可用", "不稳定", "暂停", "即将开始"].includes(status);
  return `<span class="manager-badge${ok ? " ok" : bad ? " bad" : warn ? " warn" : ""}">${escapeHtml(status || "未设置")}</span>`;
}

function externalLink(url, label) {
  const safe = safeUrl(url);
  return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>` : "";
}

function matchesQuery(item) {
  return !state.query || JSON.stringify(item).toLowerCase().includes(state.query);
}

function empty(message) {
  return `<div class="manager-empty">${escapeHtml(message)}</div>`;
}

function actionButtons(collectionName, id) {
  return `<div class="manager-list-actions"><button type="button" data-edit="${collectionName}" data-id="${escapeHtml(id)}">编辑</button><button type="button" data-delete="${collectionName}" data-id="${escapeHtml(id)}">删除</button></div>`;
}

function renderPromotions() {
  const items = byTitle(state.data.promotions).filter(matchesQuery);
  document.getElementById("manager-promotions-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    const consoleLink = externalLink(item.consoleUrl, "活动 / 控制台");
    const docsLink = externalLink(item.docsUrl, "说明文档");
    const startsAt = item.startsAt || (item.startDate ? `${item.startDate}T00:00:00` : "");
    const distance = item.expiresAt ? formatResetDistance(item.expiresAt) : "未设置结束时间";
    const tone = countdownTone(item.expiresAt);
    const periodStart = startsAt ? formatDateTime(startsAt) : "未设置开始时间";
    return `<article class="manager-list-item manager-promotion-card"><div class="manager-list-main"><div class="manager-record-header"><div class="manager-list-title"><strong>${escapeHtml(item.title)}</strong>${badge(item.status)}</div>${actionButtons("promotions", item.id)}</div><div class="manager-promotion-overview"><div class="manager-plan-fact manager-plan-provider"><div class="manager-plan-provider-info"><span>提供方</span><strong>${escapeHtml(item.provider || "未填写")}</strong><small>${escapeHtml(item.offerType || "其他")}${plan ? ` · ${escapeHtml(plan.name)}` : ""}</small></div>${consoleLink || docsLink ? `<div class="manager-plan-card-links">${consoleLink}${docsLink}</div>` : ""}</div><div class="manager-plan-fact"><span>优惠内容</span><strong class="manager-promotion-benefit-value">${linkifyText(item.benefit || "未填写")}</strong></div><div class="manager-plan-fact"><span>适用模型 / 资源</span><strong class="manager-promotion-model-value">${escapeHtml(item.models || "未填写")}</strong></div><div class="manager-plan-fact manager-promotion-time"><span>剩余</span><strong class="manager-promotion-countdown${tone ? ` ${tone}` : ""}">${escapeHtml(distance)}</strong><small><span class="manager-promotion-period-label">活动时间</span><span class="manager-promotion-period-value"><span>${escapeHtml(periodStart)}${item.expiresAt ? " —" : ""}</span>${item.expiresAt ? `<span>${escapeHtml(formatDateTime(item.expiresAt))}</span>` : ""}</span></small></div></div>${item.notes ? `<div class="manager-record-note"><span>注意事项</span><p>${linkifyText(item.notes)}</p></div>` : ""}</div></article>`;
  }).join("") : empty("还没有限时优惠记录。");
}

function renderPlans() {
  const items = byTitle(state.data.plans).filter(matchesQuery);
  const otherItems = items.filter(item => item.type !== "按量 API");
  const apiItems = items.filter(item => item.type === "按量 API");
  const displayedItems = [...otherItems, ...apiItems];
  const renderPlanCards = planItems => planItems.map(item => {
    const percent = remainingPercent(item);
    const periodDays = Number(item.quotaPeriodDays) > 0 ? Number(item.quotaPeriodDays) : 7;
    const isApi = item.type === "按量 API";
    const isAmount = item.remainingMode === "金额";
    const isUsed = item.quotaDisplayMode === "已用";
    const remainingValue = Number(item.remainingValue);
    const declaredTotal = item.quotaTotal === null || item.quotaTotal === "" || item.quotaTotal === undefined ? null : Number(item.quotaTotal);
    const purchaseTotal = item.purchaseAmount === null || item.purchaseAmount === "" || item.purchaseAmount === undefined ? null : Number(item.purchaseAmount);
    const amountTotal = Number.isFinite(declaredTotal) ? declaredTotal : Number.isFinite(purchaseTotal) ? purchaseTotal : null;
    const displayedAmount = Number.isFinite(remainingValue)
      ? isUsed ? amountTotal !== null ? Math.max(0, amountTotal - remainingValue) : null : remainingValue
      : null;
    const consoleUrl = safeUrl(item.consoleUrl);
    const docsUrl = safeUrl(item.docsUrl);
    const openaiBaseUrl = item.openaiBaseUrl || item.baseUrl || "";
    const resetDistance = formatResetDistance(item.nextResetAt);
    const resetTone = countdownTone(item.nextResetAt);
    return `<article class="manager-list-item manager-plan-card"><div class="manager-list-main"><div class="manager-record-header"><div class="manager-list-title"><strong>${escapeHtml(item.name)}</strong>${badge(item.status)}${item.credentialLabel ? `<span class="manager-credential">凭证 · ${escapeHtml(item.credentialLabel)}</span>` : ""}</div>${actionButtons("plans", item.id)}</div><div class="manager-plan-overview${isApi ? " api-plan" : ""}"><div class="manager-plan-fact manager-plan-provider"><div class="manager-plan-provider-info"><span>提供方</span><strong>${escapeHtml(item.provider || "未填写")}</strong><small>${escapeHtml(item.type || "其他")}</small></div>${consoleUrl || docsUrl ? `<div class="manager-plan-card-links">${consoleUrl ? `<a href="${escapeHtml(consoleUrl)}" target="_blank" rel="noopener">控制台</a>` : ""}${docsUrl ? `<a href="${escapeHtml(docsUrl)}" target="_blank" rel="noopener">官方文档</a>` : ""}</div>` : ""}</div><div class="manager-plan-fact"><span>投入</span><strong>${formatMoney(item.purchaseAmount, item.currency)}</strong><small>${escapeHtml(item.region || "未设置地区")}</small></div><div class="manager-plan-fact manager-plan-quota">${isAmount ? `<span>${isApi ? "账户余额" : "剩余金额"}</span><strong>${displayedAmount === null ? "—" : formatMoney(displayedAmount, item.currency || "CNY")}</strong><small>${isApi ? "长期有效" : "金额余额"}</small>` : `<span>${isApi ? "剩余额度" : `${periodDays} 天额度剩余`}</span><strong>${percent === null ? "—" : `${formatNumber(percent)}%`}</strong><div class="manager-progress" aria-label="额度剩余百分比"><i style="width:${percent === null ? 0 : percent}%"></i></div>`}</div>${isApi ? "" : `<div class="manager-plan-fact manager-plan-reset"><span>距离重置</span><strong class="manager-reset-value${resetTone ? ` ${resetTone}` : ""}">${escapeHtml(resetDistance)}</strong><small>下次重置 ${escapeHtml(formatDateTime(item.nextResetAt))}</small></div><div class="manager-plan-fact"><span>有效期</span><strong>${formatDate(item.expiresAt)}</strong><small>${item.startDate ? `开始于 ${formatDate(item.startDate)}` : "未填写开始日期"}</small></div>`}</div>${openaiBaseUrl || item.anthropicBaseUrl ? `<div class="manager-endpoints">${openaiBaseUrl ? `<div><div class="manager-endpoint-value"><span>OpenAI Base URL</span><code>${escapeHtml(openaiBaseUrl)}</code></div><button type="button" data-copy-plan="${escapeHtml(item.id)}" data-copy-field="openaiBaseUrl">复制</button></div>` : ""}${item.anthropicBaseUrl ? `<div><div class="manager-endpoint-value"><span>Anthropic Base URL</span><code>${escapeHtml(item.anthropicBaseUrl)}</code></div><button type="button" data-copy-plan="${escapeHtml(item.id)}" data-copy-field="anthropicBaseUrl">复制</button></div>` : ""}</div>` : ""}${item.notes ? `<div class="manager-record-note"><span>注意事项</span><p>${linkifyText(item.notes)}</p></div>` : ""}</div></article>`;
  }).join("");
  const groups = [
    { title: "会员权益、Token Plan、Coding Plan 等", items: otherItems, className: "other", addLabel: "新增 Plan", emptyText: "还没有会员权益、Token Plan 或 Coding Plan。" },
    { title: "按量 API", items: apiItems, className: "api", addLabel: "新增按量 API", planType: "按量 API", emptyText: "还没有按量 API。" }
  ];
  document.getElementById("manager-plans-list").innerHTML = groups.map(group => `<section class="manager-plan-group manager-plan-group-${group.className}"><div class="manager-plan-subheading"><h3>${group.title}</h3><button class="manager-button" type="button" data-add="plans"${group.planType ? ` data-plan-type="${group.planType}"` : ""}>${group.addLabel}</button></div>${group.items.length ? `<div class="manager-plan-group-grid">${renderPlanCards(group.items)}</div>` : empty(group.emptyText)}</section>`).join("");
  document.querySelectorAll("#manager-plans-list .manager-plan-card").forEach((card, index) => {
    card.classList.toggle("manager-plan-card-highlight", displayedItems[index]?.type !== "按量 API");
    const validityHint = [...card.querySelectorAll(".manager-plan-fact>small")].find(element => /^(开始于|未填写开始日期)/.test(element.textContent));
    if (validityHint) validityHint.parentElement.classList.add("manager-plan-validity");
  });
  document.querySelectorAll("#manager-plans-list [data-copy-plan]").forEach(button => {
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>';
    button.setAttribute("aria-label", "复制 Base URL");
    button.title = "复制";
  });
}

function renderTransactions() {
  const items = [...state.data.transactions]
    .sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")) || (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter(matchesQuery);
  document.getElementById("manager-transactions-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    return `<article class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(plan?.name || "未关联 Plan")}</strong><span class="manager-badge">${escapeHtml(item.recordType || "投入")}</span></div><div class="manager-list-meta"><strong class="manager-transaction-amount">${formatMoney(item.amount, item.currency || plan?.currency || "CNY")}</strong><span>${formatDate(item.recordedAt)}</span></div>${item.notes ? `<p class="manager-list-notes">${linkifyText(item.notes)}</p>` : ""}</div>${actionButtons("transactions", item.id)}</article>`;
  }).join("") : empty("还没有充值或购买套餐记录。");
}

function renderModels() {
  const items = byUpdated(state.data.models).filter(matchesQuery);
  document.getElementById("manager-models-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    return `<article class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(item.name)}</strong>${badge(item.status)}</div><div class="manager-list-meta"><span>${escapeHtml(plan?.name || "未关联 Plan")}</span><span>${escapeHtml(item.protocol || "未设置协议")}</span><span>上下文 ${formatNumber(item.contextWindow)}</span><span>最近测试 ${formatDate(item.testedAt)}</span></div>${item.capabilities ? `<p class="manager-list-notes">能力：${escapeHtml(item.capabilities)}</p>` : ""}${item.quality ? `<p class="manager-list-notes">实测：${escapeHtml(item.quality)}</p>` : ""}${item.notes ? `<p class="manager-list-notes">${linkifyText(item.notes)}</p>` : ""}</div>${actionButtons("models", item.id)}</article>`;
  }).join("") : empty("还没有模型记录。模型需要关联到一个 Plan。");
}

function renderCompatibility() {
  const items = byUpdated(state.data.compatibilityTests).filter(matchesQuery);
  document.getElementById("manager-compatibility-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    const model = findModel(item.modelId);
    return `<article class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(item.harness || "未命名 Harness")}</strong>${badge(item.status)}</div><div class="manager-list-meta"><span>${escapeHtml(plan?.name || "未关联 Plan")}</span><span>${escapeHtml(model?.name || "未指定模型")}</span>${item.harnessVersion ? `<span>版本 ${escapeHtml(item.harnessVersion)}</span>` : ""}<span>${formatDate(item.testedAt)}</span>${item.latencyMs ? `<span>${formatNumber(item.latencyMs)} ms</span>` : ""}</div>${item.features ? `<p class="manager-list-notes">已验证：${escapeHtml(item.features)}</p>` : ""}${item.error ? `<p class="manager-list-notes">异常：${escapeHtml(item.error)}</p>` : ""}${item.notes ? `<p class="manager-list-notes">${linkifyText(item.notes)}</p>` : ""}</div>${actionButtons("compatibilityTests", item.id)}</article>`;
  }).join("") : empty("还没有 Harness 测试。为不同 Plan 和 Harness 分别记录结果。");
}

function renderUsage() {
  const items = [...state.data.usageSnapshots].sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || ""))).filter(matchesQuery);
  document.getElementById("manager-usage-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    const source = externalLink(item.sourceUrl, "数据来源");
    return `<article class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(plan?.name || "未关联 Plan")}</strong><span class="manager-badge">${formatDate(item.recordedAt)}</span></div><div class="manager-list-meta"><span>剩余 ${formatNumber(item.remaining)} ${escapeHtml(item.unit || "")}</span><span>已用 ${formatNumber(item.used)} ${escapeHtml(item.unit || "")}</span>${source ? `<span>${source}</span>` : ""}</div>${item.notes ? `<p class="manager-list-notes">${linkifyText(item.notes)}</p>` : ""}</div>${actionButtons("usageSnapshots", item.id)}</article>`;
  }).join("") : empty("还没有用量快照。查看供应商控制台后，可以手动记录一次余额。");
}

function renderNotes() {
  const items = byUpdated(state.data.notes).filter(matchesQuery);
  document.getElementById("manager-notes-list").innerHTML = items.length ? items.map(item => {
    const plan = findPlan(item.planId);
    return `<article class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(item.title)}</strong><span class="manager-badge">${escapeHtml(item.category || "其他")}</span></div><div class="manager-list-meta">${plan ? `<span>${escapeHtml(plan.name)}</span>` : ""}<span>更新于 ${new Intl.DateTimeFormat("zh-CN").format(new Date(item.updatedAt || item.createdAt || Date.now()))}</span></div><p class="manager-list-notes">${linkifyText(item.content || "")}</p></div>${actionButtons("notes", item.id)}</article>`;
  }).join("") : empty("还没有备注。可以记录配置方法、限制和问题解决过程。");
}

function renderDashboard() {
  const activePlans = state.data.plans.filter(item => !["已到期", "已用尽"].includes(item.status));
  const hasTransactionRecords = state.data.transactions.length > 0;
  const investmentRecords = hasTransactionRecords
    ? state.data.transactions
    : state.data.plans.map(item => ({ amount: item.purchaseAmount, currency: item.currency }));
  const totalsByCurrency = investmentRecords.reduce((totals, item) => {
    const amount = Number(item.amount) || 0;
    const currency = item.currency || "CNY";
    totals[currency] = (totals[currency] || 0) + amount;
    return totals;
  }, {});
  const currencyOrder = ["CNY", "USD", "EUR", "JPY"];
  const investmentSummary = Object.entries(totalsByCurrency)
    .filter(([, amount]) => amount !== 0)
    .sort(([currencyA], [currencyB]) => {
      const indexA = currencyOrder.indexOf(currencyA);
      const indexB = currencyOrder.indexOf(currencyB);
      return (indexA < 0 ? currencyOrder.length : indexA) - (indexB < 0 ? currencyOrder.length : indexB) || currencyA.localeCompare(currencyB);
    })
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ") || "—";
  const expiring = activePlans.filter(item => { const days = daysUntil(item.expiresAt); return days !== null && days >= 0 && days <= 30; });
  const low = activePlans.filter(item => remainingPercent(item) !== null && remainingPercent(item) <= 20);
  const failed = state.data.compatibilityTests.filter(item => ["不可用", "不稳定", "已失效"].includes(item.status));
  const metricData = [
    ["有效 Plan", activePlans.length, `${state.data.plans.length} 个总记录`],
    ["累计投入", investmentSummary, hasTransactionRecords ? "来自充值 / 购买套餐记录" : "来自 Plan 中的购买金额"],
    ["即将到期", expiring.length, "未来 30 天"],
    ["余额不足", low.length, "剩余不高于 20%"],
    ["兼容异常", failed.length, "不可用 / 不稳定"]
  ];
  document.getElementById("manager-metrics").innerHTML = metricData.map(([label, value, hint]) => `<article class="manager-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`).join("");

  const attention = [
    ...expiring.map(item => ({ title: item.name, meta: `${daysUntil(item.expiresAt)} 天后到期`, status: "即将到期", collectionName: "plans", id: item.id })),
    ...low.map(item => ({ title: item.name, meta: `${Number(item.quotaPeriodDays) > 0 ? item.quotaPeriodDays : 7} 天额度剩余 ${formatNumber(remainingPercent(item))}%`, status: "余额不足", collectionName: "plans", id: item.id })),
    ...failed.slice(0, 6).map(item => ({ title: `${item.harness} · ${findPlan(item.planId)?.name || "未关联 Plan"}`, meta: item.notes || item.error || "查看兼容性记录", status: item.status, collectionName: "compatibilityTests", id: item.id }))
  ];
  document.getElementById("manager-attention").innerHTML = attention.length ? attention.slice(0, 10).map(item => `<div class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(item.title)}</strong>${badge(item.status)}</div><div class="manager-list-meta"><span>${escapeHtml(item.meta)}</span></div></div>${actionButtons(item.collectionName, item.id)}</div>`).join("") : empty("当前没有需要特别关注的项目。");

  const recent = collectionNames.flatMap(name => state.data[name].map(item => ({ ...item, _collection: name }))).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 8);
  const collectionLabels = { plans: "Plan", promotions: "优惠", transactions: "投入", models: "模型", compatibilityTests: "Harness", usageSnapshots: "用量", notes: "备注" };
  document.getElementById("manager-recent").innerHTML = recent.length ? recent.map(item => `<div class="manager-list-item"><div class="manager-list-main"><div class="manager-list-title"><strong>${escapeHtml(item.name || item.title || item.harness || findPlan(item.planId)?.name || "记录")}</strong><span class="manager-badge">${collectionLabels[item._collection]}</span></div><div class="manager-list-meta"><span>${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updatedAt || item.createdAt))}</span></div></div>${actionButtons(item._collection, item.id)}</div>`).join("") : empty("尚未创建任何记录。");
}

function renderAll() {
  renderDashboard();
  renderPromotions();
  renderPlans();
  renderTransactions();
  renderModels();
  renderCompatibility();
  renderUsage();
  renderNotes();
}

function optionsHtml(options, selected, placeholder = "请选择") {
  return `<option value="">${escapeHtml(placeholder)}</option>${options.map(option => {
    const value = typeof option === "string" ? option : option.value;
    const label = typeof option === "string" ? option : option.label;
    return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("")}`;
}

function fieldHtml(field, value = "") {
  const required = field.required ? " required" : "";
  const full = field.full ? " full" : "";
  const help = field.help ? `<small>${escapeHtml(field.help)}</small>` : "";
  let control;
  if (field.type === "select") {
    control = `<select name="${field.name}"${required}>${optionsHtml(field.options, value)}</select>`;
  } else if (field.type === "planSelect") {
    control = `<select name="${field.name}"${required}>${optionsHtml(state.data.plans.map(item => ({ value: item.id, label: `${item.provider || ""} · ${item.name}` })), value, "选择 Plan")}</select>`;
  } else if (field.type === "modelSelect") {
    control = `<select name="${field.name}"${required}>${optionsHtml(state.data.models.map(item => ({ value: item.id, label: item.name })), value, "选择模型（可选）")}</select>`;
  } else if (field.type === "textarea") {
    control = `<textarea name="${field.name}"${required}>${escapeHtml(value)}</textarea>`;
  } else if (field.type === "date") {
    control = `<input name="${field.name}" type="text" value="${escapeHtml(formatDateInput(value))}" placeholder="2026年8月17日" inputmode="numeric"${required}>`;
  } else if (field.type === "datetime-local") {
    control = `<input name="${field.name}" type="text" value="${escapeHtml(formatDateTimeInput(value))}" placeholder="2026年8月24日 14:30:00 或 27天4小时"${required}>`;
  } else {
    control = `<input name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(value)}"${field.step ? ` step="${field.step}"` : ""}${field.min !== undefined ? ` min="${field.min}"` : ""}${field.max !== undefined ? ` max="${field.max}"` : ""}${required}>`;
  }
  return `<div class="manager-field${full}" data-field-name="${escapeHtml(field.name)}"><label>${escapeHtml(field.label)}</label>${control}${help}</div>`;
}

function updatePlanFieldVisibility() {
  if (state.editing?.collectionName !== "plans") return;
  const isApi = els.form.elements.type?.value === "按量 API";
  const isAmount = els.form.elements.remainingMode?.value === "金额";
  const isUsed = els.form.elements.quotaDisplayMode?.value === "已用";
  ["quotaPeriodDays", "nextResetAt", "startDate", "expiresAt"].forEach(name => {
    const field = els.fields.querySelector(`[data-field-name="${name}"]`);
    if (field) field.hidden = isApi;
  });
  const valueLabel = els.fields.querySelector('[data-field-name="remainingValue"] label');
  if (valueLabel) valueLabel.textContent = isAmount ? `当前${isUsed ? "已用" : "剩余"}金额` : `当前${isUsed ? "已用" : "剩余"}（%）`;
}

function openEditor(collectionName, id = null, defaults = {}) {
  const schema = schemas[collectionName];
  const item = id ? state.data[collectionName].find(entry => entry.id === id) : null;
  state.editing = { collectionName, id };
  els.dialogEyebrow.textContent = schema.eyebrow;
  els.dialogTitle.textContent = `${item ? "编辑" : "新增"}${schema.title}`;
  els.fields.innerHTML = schema.fields.map(field => {
    const legacyValue = collectionName === "plans" && field.name === "openaiBaseUrl" ? item?.baseUrl : undefined;
    const legacyPromotionStart = collectionName === "promotions" && field.name === "startsAt" && item?.startDate ? `${item.startDate}T00:00:00` : undefined;
    const legacyPercent = collectionName === "plans" && field.name === "remainingValue" && item ? remainingPercent(item) : undefined;
    const defaultValue = field.defaultValue ?? (field.name === "status" ? schema === schemas.plans ? "正常" : "未测试" : field.name === "recordedAt" || field.name === "testedAt" ? new Date().toISOString().slice(0, 10) : "");
    return fieldHtml(field, item?.[field.name] ?? legacyValue ?? legacyPromotionStart ?? legacyPercent ?? defaults[field.name] ?? defaultValue);
  }).join("");
  updatePlanFieldVisibility();
  setMessage(els.formMessage);
  els.dialog.showModal();
}

function formObject(collectionName) {
  const schema = schemas[collectionName];
  const formData = new FormData(els.form);
  const result = {};
  schema.fields.forEach(field => {
    const raw = formData.get(field.name);
    if (field.type === "number") result[field.name] = raw === "" ? null : Number(raw);
    else if (field.type === "date") result[field.name] = parseDateInput(String(raw || "").trim());
    else if (field.type === "datetime-local") result[field.name] = parseDateTimeInput(String(raw || "").trim());
    else result[field.name] = String(raw || "").trim();
  });
  return result;
}

async function saveEditor(event) {
  event.preventDefault();
  if (!state.user || !state.editing) return;
  const { collectionName, id } = state.editing;
  let value;
  try {
    value = formObject(collectionName);
  } catch (error) {
    setMessage(els.formMessage, error.message, "error");
    return;
  }
  if (collectionName === "plans") {
    if (value.type === "按量 API") {
      value.quotaPeriodDays = null;
      value.nextResetAt = "";
      value.startDate = "";
      value.expiresAt = "";
    }
    if (value.remainingMode === "百分比" && Number(value.remainingValue) > 100) {
      setMessage(els.formMessage, "百分比不能大于 100。", "error");
      return;
    }
  }
  if (containsLikelySecret(value)) {
    setMessage(els.formMessage, "检测到疑似 API Key 或 Bearer Token。请删除凭证后再保存。", "error");
    return;
  }
  const now = Date.now();
  const existing = id ? state.data[collectionName].find(item => item.id === id) : null;
  const payload = { ...value, createdAt: existing?.createdAt || now, updatedAt: now };
  try {
    setMessage(els.formMessage, "正在保存…");
    const base = collection(db, "users", state.user.uid, collectionName);
    if (id) await setDoc(doc(base, id), payload);
    else await addDoc(base, payload);
    els.dialog.close();
    const targetPanel = { plans: "plans", promotions: "plans", transactions: "transactions", models: "models", compatibilityTests: "compatibility", usageSnapshots: "usage", notes: "notes" }[collectionName];
    if (targetPanel) showPanel(targetPanel);
    setMessage(els.syncMessage, "已保存到 Firestore。", "success");
  } catch (error) {
    setMessage(els.formMessage, friendlyError(error), "error");
  }
}

async function removeItem(collectionName, id) {
  if (!state.user) return;
  const item = state.data[collectionName].find(entry => entry.id === id);
  const label = item?.name || item?.title || item?.harness || "这条记录";
  if (!window.confirm(`确定删除“${label}”吗？此操作无法撤销。`)) return;
  try {
    await deleteDoc(doc(db, "users", state.user.uid, collectionName, id));
    setMessage(els.syncMessage, "记录已删除。", "success");
  } catch (error) {
    setMessage(els.syncMessage, friendlyError(error), "error");
  }
}

async function copyPlanEndpoint(button) {
  const plan = findPlan(button.dataset.copyPlan);
  if (!plan) return;
  const field = button.dataset.copyField;
  const value = field === "openaiBaseUrl" ? plan.openaiBaseUrl || plan.baseUrl : plan[field];
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    button.classList.add("copied");
    button.setAttribute("aria-label", "已复制");
    button.title = "已复制";
    setTimeout(() => {
      button.classList.remove("copied");
      button.setAttribute("aria-label", "复制 Base URL");
      button.title = "复制";
    }, 1200);
  } catch {
    setMessage(els.syncMessage, "复制失败，请手动选择 Base URL。", "error");
  }
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return "Firestore 拒绝访问。请检查数据库是否已创建，以及 Security Rules 是否允许当前 UID。";
  if (code.includes("unauthorized-domain")) return "当前域名尚未加入 Firebase Authentication 的 Authorized domains。";
  if (code.includes("popup-closed")) return "登录窗口已关闭。";
  if (code.includes("popup-blocked")) return "浏览器阻止了登录窗口，请允许弹窗后重试。";
  return error?.message || "操作失败，请稍后重试。";
}

function subscribeData(user) {
  state.unsubscribers.forEach(unsubscribe => unsubscribe());
  state.unsubscribers = [];
  collectionNames.forEach(name => {
    const unsubscribe = onSnapshot(collection(db, "users", user.uid, name), snapshot => {
      state.data[name] = snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }));
      renderAll();
      setMessage(els.syncMessage);
    }, error => setMessage(els.syncMessage, friendlyError(error), "error"));
    state.unsubscribers.push(unsubscribe);
  });
}

function showPanel(name) {
  state.activePanel = name;
  document.querySelectorAll("[data-manager-view]").forEach(button => button.classList.toggle("active", button.dataset.managerView === name));
  document.querySelectorAll("[data-manager-panel]").forEach(panel => {
    const active = panel.dataset.managerPanel === name;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function exportData() {
  const payload = {
    format: "ai-resource-hub-manager",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(collectionNames.map(name => [name, state.data[name].map(({ id, ...item }) => item)]))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ai-resource-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  if (!state.user || !file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== "ai-resource-hub-manager" || !payload.data) throw new Error("无法识别该备份文件。");
    if (containsLikelySecret(payload)) throw new Error("导入文件中包含疑似 API Key 或 Token，已停止导入。");
    const total = collectionNames.reduce((sum, name) => sum + (Array.isArray(payload.data[name]) ? payload.data[name].length : 0), 0);
    if (!window.confirm(`即将向当前账号新增 ${total} 条记录。现有数据不会被删除，是否继续？`)) return;
    for (const name of collectionNames) {
      const allowed = new Set(schemas[name].fields.map(field => field.name));
      for (const source of Array.isArray(payload.data[name]) ? payload.data[name] : []) {
        const clean = Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key)));
        await addDoc(collection(db, "users", state.user.uid, name), { ...clean, createdAt: Date.now(), updatedAt: Date.now() });
      }
    }
    setMessage(els.syncMessage, `已导入 ${total} 条记录。`, "success");
  } catch (error) {
    setMessage(els.syncMessage, error.message || "导入失败。", "error");
  } finally {
    document.getElementById("manager-import").value = "";
  }
}

document.getElementById("manager-signin").addEventListener("click", async () => {
  try {
    setMessage(els.authMessage, "正在打开 Google 登录…");
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    setMessage(els.authMessage, friendlyError(error), "error");
  }
});

document.getElementById("manager-signout").addEventListener("click", () => signOut(auth));
els.addButton.addEventListener("click", event => {
  event.stopPropagation();
  const open = els.addMenu.hidden;
  els.addMenu.hidden = !open;
  els.addButton.setAttribute("aria-expanded", String(open));
});
els.userMenuButton.addEventListener("click", event => {
  event.stopPropagation();
  const open = els.userMenu.hidden;
  els.userMenu.hidden = !open;
  els.userMenuButton.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", event => {
  if (!els.account.contains(event.target)) {
    els.userMenu.hidden = true;
    els.userMenuButton.setAttribute("aria-expanded", "false");
  }
  if (!event.target.closest(".manager-add-control")) {
    els.addMenu.hidden = true;
    els.addButton.setAttribute("aria-expanded", "false");
  }
});
document.getElementById("manager-export").addEventListener("click", exportData);
document.getElementById("manager-import").addEventListener("change", event => importData(event.target.files?.[0]));
els.form.addEventListener("submit", saveEditor);
els.form.addEventListener("change", event => {
  if (["type", "remainingMode", "quotaDisplayMode"].includes(event.target.name)) updatePlanFieldVisibility();
});
document.querySelectorAll("[data-dialog-close]").forEach(button => button.addEventListener("click", () => els.dialog.close()));
document.querySelector(".manager-nav").addEventListener("click", event => {
  const button = event.target.closest("[data-manager-view]");
  if (button) showPanel(button.dataset.managerView);
});
document.getElementById("manager-app").addEventListener("click", event => {
  const add = event.target.closest("[data-add]");
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  const copy = event.target.closest("[data-copy-plan]");
  if (add) openEditor(add.dataset.add, null, add.dataset.planType ? { type: add.dataset.planType } : {});
  if (add) {
    els.addMenu.hidden = true;
    els.addButton.setAttribute("aria-expanded", "false");
  }
  if (edit) openEditor(edit.dataset.edit, edit.dataset.id);
  if (remove) removeItem(remove.dataset.delete, remove.dataset.id);
  if (copy) copyPlanEndpoint(copy);
});
els.search.addEventListener("input", () => {
  state.query = els.search.value.trim().toLowerCase();
  renderAll();
});

onAuthStateChanged(auth, user => {
  state.user = user;
  els.login.hidden = Boolean(user);
  els.app.hidden = !user;
  els.account.hidden = !user;
  els.account.style.display = user ? "flex" : "none";
  if (user) {
    showPanel("plans");
    els.userName.textContent = user.displayName || "Google 用户";
    els.userEmail.textContent = user.email || "";
    const avatarUrl = safeUrl(user.photoURL);
    els.userAvatar.hidden = !avatarUrl;
    els.userAvatarFallback.hidden = Boolean(avatarUrl);
    els.menuAvatar.hidden = !avatarUrl;
    els.menuAvatarFallback.hidden = Boolean(avatarUrl);
    const initial = (user.displayName || user.email || "U").trim().slice(0, 1).toUpperCase();
    els.userAvatarFallback.textContent = initial;
    els.menuAvatarFallback.textContent = initial;
    if (avatarUrl) {
      els.userAvatar.src = avatarUrl;
      els.menuAvatar.src = avatarUrl;
    }
    els.uid.textContent = user.uid;
    setMessage(els.authMessage);
    subscribeData(user);
  } else {
    els.userMenu.hidden = true;
    els.userMenuButton.setAttribute("aria-expanded", "false");
    state.unsubscribers.forEach(unsubscribe => unsubscribe());
    state.unsubscribers = [];
    state.data = Object.fromEntries(collectionNames.map(name => [name, []]));
    renderAll();
  }
});

showPanel("plans");
renderAll();
