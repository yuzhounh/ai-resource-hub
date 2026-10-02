// ============================================================
// Expenses / 支出板块核心逻辑（总览统计 + 单栏月度卡片 + 悬停操作）
// 数据保存在登录用户的 Google 账户（Firestore）中；
// localStorage 按用户 UID 缓存；未登录及新账户不加载任何预置记录。
// ============================================================

import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { HubAuth } from "./hub-auth.js";
import { ExpenseSync, mergeExpenseChange } from "./expense-sync.js?v=20261003a";

const STORAGE_KEY = "ai_hub_expenses_records";
// 与 firestore.rules 中的所有者一致；旧版共享缓存仅迁移给原所有者。
const LEGACY_OWNER_UID = "8ASrz9xvKmMcrGkV7Yu98i6IrZO2";

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
let expenseSync = null;
let editingBase = null;
let sessionVersion = 0;

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
  return list
    .filter(item => item && typeof item === "object")
    .map(item => ({
      ...item,
      title: cleanItemTitle(item.title),
      description: cleanRedundantDesc(String(item.description || ""))
    }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function readLocalExpenses(uid = currentUid) {
  if (!uid) return [];
  try {
    const key = `${STORAGE_KEY}:${uid}`;
    const raw = localStorage.getItem(key);
    if (raw !== null) return migrateItems(JSON.parse(raw));
    if (uid === LEGACY_OWNER_UID) {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy !== null) {
        const items = migrateItems(JSON.parse(legacy));
        localStorage.setItem(key, JSON.stringify(items));
        localStorage.removeItem(STORAGE_KEY);
        return items;
      }
    }
  } catch {
    // 缓存损坏或浏览器禁止存储时，从空数据等待云端读取。
  }
  return [];
}

function writeLocalCache(uid = currentUid) {
  if (!uid) return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${uid}`, JSON.stringify(expensesState.items));
  } catch {}
}

function resetExpensesSession(uid = null) {
  sessionVersion += 1;
  expenseSync?.stop();
  expenseSync = null;
  editingBase = null;
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  currentUid = uid;
  expensesState.items = readLocalExpenses(uid);
  expensesState.query = "";
  expensesState.activeCategory = "all";
  expensesState.editingId = null;
  expensesState.selectedFilter = null;
  const search = document.getElementById("expenses-search");
  if (search) search.value = "";
  document.querySelectorAll(".expenses-filter-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.cat === "all");
  });
  document.getElementById("expenses-form")?.reset();
  const modal = document.getElementById("expenses-modal");
  if (modal?.open) modal.close();
  renderExpenses();
  renderSyncStatus({ pending: 0, conflicts: [] });
}

function attachCloud(uid) {
  resetExpensesSession(uid);
  const version = sessionVersion;
  const ref = doc(HubAuth.db, "users", uid, "expenses", "records");
  expenseSync = new ExpenseSync({
    uid, storage: localStorage, initialItems: expensesState.items,
    transact: (operation, isActive) => runTransaction(HubAuth.db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!isActive()) throw Object.assign(new Error('Account session ended'), { code: 'expense-cancelled' });
      const items = migrateItems(snapshot.exists() ? snapshot.data()?.items : []);
      const merged = mergeExpenseChange(items, operation);
      transaction.set(ref, { items: merged, updatedAt: Date.now() }, { merge: true });
      return merged;
    }),
    onChange: (items, status) => {
      if (version !== sessionVersion || currentUid !== uid) return;
      expensesState.items = migrateItems(items);
      writeLocalCache(uid);
      // Keep unsaved form values intact while a remote snapshot arrives.
      if (!expensesState.editingId) renderExpenses();
      renderSyncStatus(status);
    },
    onError: showToast
  });
  expenseSync.refresh();
  cloudUnsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
    if (version !== sessionVersion || currentUid !== uid) return;
    // A cache miss while offline is not evidence that the server deleted history.
    if (!snapshot.exists() && snapshot.metadata?.fromCache) return;
    expenseSync.receive(migrateItems(snapshot.exists() ? snapshot.data()?.items : []), !snapshot.metadata?.fromCache);
  }, () => {
    if (version !== sessionVersion || currentUid !== uid) return;
    expenseSync.lastError = '无法读取云端数据，已保留本机记录和待同步修改。';
    expenseSync.refresh();
  });
}

function detachCloud() {
  resetExpensesSession();
}

function saveExpenses(before, after) {
  return currentUid && expenseSync ? expenseSync.queue(
    before ? migrateItems([before])[0] : null,
    after ? migrateItems([after])[0] : null
  ) : false;
}

function renderSyncStatus(status) {
  const element = document.getElementById('expenses-sync-status');
  if (!element) return;
  element.hidden = !currentUid;
  const message = status.error || (status.pending ? `${status.pending} 项修改待同步${status.busy ? '，正在同步…' : ''}` : status.hasServerState ? '已同步' : '等待云端确认；当前显示本机缓存');
  const describe = item => item ? `${item.date} · ${item.title} · ${CATEGORY_MAP[item.category]?.label || item.category} · ${formatCurrency(item.amount)} · ${item.amountDisplay || ''} · ${item.description || ''} · ${item.notes || ''}` : '此记录已删除';
  element.innerHTML = `<p>${escapeHtml(message)} ${status.pending && !status.busy ? '<button type="button" data-sync="retry">重试同步</button>' : ''}</p>`
    + status.conflicts.map(operation => `<div class="expenses-sync-conflict">
      <strong>${escapeHtml(operation.after?.title || operation.before?.title || '支出记录')}：同步冲突</strong>
      <p>本机：${escapeHtml(describe(operation.after))}</p>
      <p>云端：${escapeHtml(describe(operation.remote))}</p>
      <button type="button" data-sync="local" data-id="${escapeHtml(operation.recordId)}" ${status.busy ? 'disabled' : ''}>保留本机修改</button>
      <button type="button" data-sync="remote" data-id="${escapeHtml(operation.recordId)}" ${status.busy ? 'disabled' : ''}>采用云端版本</button>
    </div>`).join('');
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
      if (!currentUid) return;
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
      if (!currentUid) return;
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

      if (!saveExpenses(null, newItem)) return;
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
      const item = expensesState.items[itemIndex] || (editingBase?.id === id ? editingBase : null);
      if (!item) return;

      if (action === "edit-item") {
        expensesState.editingId = id;
        editingBase = JSON.parse(JSON.stringify(item));
        renderExpenses();
        const editRow = listEl.querySelector(`.expenses-item-row[data-id="${id}"]`);
        editRow?.querySelector(".edit-title")?.focus();
      } else if (action === "cancel-edit") {
        expensesState.editingId = null;
        editingBase = null;
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

        const updated = { ...item, date: newDate, title: newTitle, category: newCat,
          description: newDesc, amount: isNaN(newAmount) ? item.amount : Math.round(newAmount * 100) / 100,
          amountDisplay: newDisplay, notes: newNotes };
        if (!saveExpenses(editingBase || item, updated)) return;

        expensesState.editingId = null;
        editingBase = null;
        renderExpenses();
        showToast("已保存支出修改。");
      } else if (action === "delete-item") {
        const confirmDelete = window.confirm(`确定要删除“${item.title}”（${item.amountDisplay || formatCurrency(item.amount)}）这条支出记录吗？`);
        if (confirmDelete) {
          if (!saveExpenses(item, null)) return;
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

// 初始化为空；认证完成后只读取当前账户的数据。
document.getElementById('expenses-sync-status')?.addEventListener('click', event => {
  const button = event.target.closest('button[data-sync]');
  if (!button || !expenseSync) return;
  if (button.dataset.sync === 'retry') void expenseSync.flush();
  else expenseSync.resolve(button.dataset.id, button.dataset.sync === 'local');
});
window.addEventListener('online', () => { void expenseSync?.flush(); });
window.addEventListener('storage', event => {
  if (expenseSync && (event.key === null || event.key.startsWith(expenseSync.prefix))) {
    expenseSync.refresh();
    void expenseSync.flush();
  }
});
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
