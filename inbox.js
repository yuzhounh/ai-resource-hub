// ============================================================
// Inbox / 笔记板块核心逻辑（全公共按钮操作 + 单栏月度卡片）
// 数据保存在登录用户的 Google 账户（Firestore）中；
// localStorage 仅作本地缓存与首次登录迁移来源。
// ============================================================

import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { HubAuth } from "./hub-auth.js";

const STORAGE_KEY = "ai_hub_inbox_notes";

let notesState = {
  notes: [],
  filter: "pending", // 'pending' | 'archived' | 'all'
  query: "",
  editingId: null,
  selectedIds: new Set(),
  selectMode: false // 默认纯净阅读模式，不显示复选框
};

// 工具函数
function safeUrl(url) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExactTime(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function showToast(message) {
  let toast = document.getElementById("inbox-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "inbox-toast";
    toast.className = "inbox-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const success = document.execCommand("copy");
    document.body.removeChild(ta);
    return success;
  } catch {
    return false;
  }
}

// URL 净化：去除追踪参数和无意义字段，保留最短有效路径
function cleanUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return rawUrl; }
  if (!['http:', 'https:'].includes(u.protocol)) return rawUrl;

  // 已知追踪/会话/UI状态参数（大小写不敏感匹配）
  const TRACKING_PARAMS = new Set([
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','utm_referrer',
    'fbclid','gclid','msclkid','dclid','yclid','igshid','ttclid','twclid','li_fat_id',
    '_ga','_gl','mc_cid','mc_eid','sc_campaign','sc_channel','sc_content','sc_medium','sc_source',
    'ref','referer','source','from','origin','referrer','via',
    'spm','ssid','sid','session_id','sessionid','clientpreloadid','preloadorigin',
    'initiative_id','sourceid','source_id','search_type','commend',
    'tab','ie','page','sort','asort','filter','pf_rd_i','pf_rd_m','pf_rd_p','pf_rd_r','pf_rd_s','pf_rd_t',
    'smid','share_id','share_type','shareid','sr_share_type',
    'clickid','click_id','ad_id','adid','campaign_id','ad_type',
    'preloadorigin','preload_origin',
  ]);

  // 若无 query string，直接原样返回
  if (!u.search) return u.href;

  const kept = new URLSearchParams();
  for (const [key, value] of u.searchParams.entries()) {
    const lk = key.toLowerCase();
    // 跳过已知追踪参数
    if (TRACKING_PARAMS.has(lk)) continue;
    // 跳过值超过 80 个字符（几乎肯定是 token / base64 / 编码 URL）
    if (value.length > 80) continue;
    // 跳过看起来像随机 ID（全是十六进制或下划线数字混合）
    if (/^[a-f0-9]{16,}$/i.test(value)) continue;
    kept.append(key, value);
  }

  const cleaned = kept.toString();
  u.search = cleaned ? '?' + cleaned : '';
  // 去掉尾部的 #（空锚点）
  const result = u.href.replace(/#$/, '');
  return result;
}

// 智能文本解析器
function parseNotesInput(text) {
  if (!text || !text.trim()) return [];

  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = [...text.matchAll(urlRegex)];
  if (!matches.length) return [];

  const rawBlocks = text.trim().split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (rawBlocks.length > 1 && rawBlocks.every(b => /https?:\/\//.test(b))) {
    return rawBlocks.map(parseSingleBlock).filter(Boolean);
  }

  if (matches.length === 1) {
    return [parseSingleBlock(text.trim())].filter(Boolean);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim());
  const results = [];
  let currentTitleLines = [];
  let currentUrl = null;
  let currentRemarkLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (currentUrl) {
        results.push(finalizeItem(currentTitleLines, currentUrl, currentRemarkLines));
        currentTitleLines = [];
        currentUrl = null;
        currentRemarkLines = [];
      }
      continue;
    }
    const m = line.match(/https?:\/\/[^\s]+/);
    if (m) {
      if (currentUrl) {
        results.push(finalizeItem(currentTitleLines, currentUrl, currentRemarkLines));
        currentTitleLines = [];
        currentRemarkLines = [];
      }
      currentUrl = m[0];
      const beforeInLine = line.slice(0, line.indexOf(currentUrl)).trim();
      const afterInLine = line.slice(line.indexOf(currentUrl) + currentUrl.length).trim();
      if (beforeInLine) currentTitleLines.push(beforeInLine);
      if (afterInLine) currentRemarkLines.push(afterInLine);
    } else {
      if (currentUrl) {
        currentRemarkLines.push(line);
      } else {
        currentTitleLines.push(line);
      }
    }
  }
  if (currentUrl) {
    results.push(finalizeItem(currentTitleLines, currentUrl, currentRemarkLines));
  }
  return results;
}

function parseSingleBlock(block) {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let urlIdx = -1;
  let urlMatch = null;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/https?:\/\/[^\s]+/);
    if (m) {
      urlIdx = i;
      urlMatch = m[0];
      break;
    }
  }
  if (!urlMatch) return null;

  let titleLines = lines.slice(0, urlIdx);
  let remarkLines = lines.slice(urlIdx + 1);

  const urlLine = lines[urlIdx];
  const beforeInLine = urlLine.slice(0, urlLine.indexOf(urlMatch)).trim();
  const afterInLine = urlLine.slice(urlLine.indexOf(urlMatch) + urlMatch.length).trim();

  if (beforeInLine) titleLines.push(beforeInLine);
  if (afterInLine) remarkLines.unshift(afterInLine);

  return finalizeItem(titleLines, urlMatch, remarkLines);
}

function finalizeItem(titleLines, url, remarkLines) {
  const cleanedUrl = cleanUrl(url);
  let title = titleLines.join(" ").trim();
  let notes = remarkLines.join("\n").trim();
  if (!title) {
    try {
      const u = new URL(cleanedUrl);
      title = u.hostname.replace(/^www\./, "") + (u.pathname && u.pathname !== "/" ? u.pathname : "");
    } catch {
      title = cleanedUrl;
    }
  }
  return { title, url: cleanedUrl, notes };
}

// 云端存储（Firestore: users/{uid}/inbox/notes）
let currentUid = null;
let cloudUnsubscribe = null;
let saveTimer = null;

function readLocalNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesState.notes));
  } catch {}
}

function attachCloud(uid) {
  currentUid = uid;
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  const ref = doc(HubAuth.db, "users", uid, "inbox", "notes");
  cloudUnsubscribe = onSnapshot(ref, snapshot => {
    if (!snapshot.exists()) {
      const local = readLocalNotes();
      if (local.length) {
        // 首次登录：把本地已有笔记上传到 Google 账户
        setDoc(ref, { notes: local, updatedAt: Date.now() }).catch(() => {
          notesState.notes = local;
          renderInbox();
          showToast("笔记已载入本地缓存，云同步暂不可用。");
        });
      } else {
        notesState.notes = [];
        renderInbox();
      }
      return;
    }
    notesState.notes = Array.isArray(snapshot.data().notes) ? snapshot.data().notes : [];
    writeLocalCache();
    renderInbox();
  }, () => {
    showToast("无法从 Google 账户加载笔记，请检查网络或登录状态。");
  });
}

function detachCloud() {
  currentUid = null;
  clearTimeout(saveTimer);
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  notesState.notes = [];
  renderInbox();
}

function saveNotes() {
  writeLocalCache();
  updateNavBadge();
  if (!currentUid) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    setDoc(doc(HubAuth.db, "users", currentUid, "inbox", "notes"), {
      notes: notesState.notes,
      updatedAt: Date.now()
    }).catch(() => {
      showToast("云端保存失败，请检查网络或登录状态。");
    });
  }, 400);
}

function updateNavBadge() {
  const badge = document.getElementById("inbox-nav-badge");
  if (badge) badge.remove();
}

// 格式化为给 AI 投喂的 Markdown 提示词
function generateAiMarkdown(notesToExport) {
  if (!notesToExport.length) return "";
  const header = `请将以下近期收集整理的 AI 资源分析并合并录入到项目中相应的板块（如工具集、API控制台、Agent生态地图等）：\n\n`;
  const items = notesToExport.map((n, idx) => {
    let itemStr = `${idx + 1}. [${n.title || "未命名资源"}](${n.url})\n   - 链接: ${n.url}\n   - 记录时间: ${n.createdAt || "未知"}`;
    if (n.notes) {
      itemStr += `\n   - 备注: ${n.notes}`;
    }
    return itemStr;
  }).join("\n\n");
  const footer = `\n\n请根据各资源的定位归入最合适的分区，补充简明扼要的小字说明与分类标签，并以现有卡片风格呈现。`;
  return header + items + footer;
}

// 渲染核心：单栏月度卡片，支持纯净阅读模式与选择模式切换
function renderInbox() {
  const listEl = document.getElementById("inbox-list");
  if (!listEl) return;

  // 模式切换控制：只有在 selectMode 下才为列表赋予选择样式
  if (notesState.selectMode) {
    listEl.classList.add("select-mode");
  } else {
    listEl.classList.remove("select-mode");
  }

  const countPendingEl = document.getElementById("inbox-count-pending");
  const countArchivedEl = document.getElementById("inbox-count-archived");
  const countAllEl = document.getElementById("inbox-count-all");

  const pendingNotes = notesState.notes.filter(n => n.status !== "archived");
  const archivedNotes = notesState.notes.filter(n => n.status === "archived");

  if (countPendingEl) countPendingEl.textContent = pendingNotes.length;
  if (countArchivedEl) countArchivedEl.textContent = archivedNotes.length;
  if (countAllEl) countAllEl.textContent = notesState.notes.length;

  let filtered = notesState.notes;
  if (notesState.filter === "pending") filtered = pendingNotes;
  else if (notesState.filter === "archived") filtered = archivedNotes;

  if (notesState.query) {
    const q = notesState.query.toLowerCase();
    filtered = filtered.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.url && n.url.toLowerCase().includes(q)) ||
      (n.notes && n.notes.toLowerCase().includes(q))
    );
  }

  // 时间倒序
  filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // 更新顶部公共操作按钮的状态与文字
  const selectModeBtn = document.getElementById("inbox-btn-select-mode");
  const selectAllWrap = document.getElementById("inbox-select-all-wrap");
  const globalSelectAll = document.getElementById("inbox-global-select-all");
  const globalCountEl = document.getElementById("inbox-global-selected-count");
  const batchStatusBtn = document.getElementById("inbox-btn-batch-status");

  if (selectModeBtn) {
    selectModeBtn.textContent = notesState.selectMode ? "取消" : "选择";
    selectModeBtn.classList.toggle("active", notesState.selectMode);
    selectModeBtn.title = notesState.selectMode ? "退出选择模式" : "开启多选批量操作";
  }

  if (selectAllWrap) {
    selectAllWrap.hidden = !notesState.selectMode;
  }

  if (batchStatusBtn) {
    batchStatusBtn.textContent = notesState.filter === "archived" ? "还原" : "收录";
  }

  const visibleIds = filtered.map(n => n.id);
  const selectedVisibleCount = visibleIds.filter(id => notesState.selectedIds.has(id)).length;

  if (globalSelectAll) {
    globalSelectAll.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    globalSelectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  if (globalCountEl) {
    if (notesState.selectMode && selectedVisibleCount > 0) {
      globalCountEl.textContent = `已选 ${selectedVisibleCount} 条`;
      globalCountEl.hidden = false;
    } else {
      globalCountEl.hidden = true;
    }
  }

  if (!filtered.length) {
    let emptyMsg = "当前没有笔记。在上方框内整体粘贴内容，按 Enter 即可直接完成整理！";
    if (notesState.filter === "archived") emptyMsg = "暂无已收录的归档笔记。";
    if (notesState.query) emptyMsg = `没有找到包含“${escapeHtml(notesState.query)}”的笔记。`;

    listEl.innerHTML = `<div class="inbox-empty"><strong>空空如也</strong><p>${emptyMsg}</p></div>`;
    return;
  }

  // 按月份分组 (YYYY-MM)
  const monthGroups = {};
  for (const note of filtered) {
    let key = "";
    if (note.createdAt && /^\d{4}-\d{2}/.test(note.createdAt)) {
      key = note.createdAt.slice(0, 7);
    } else if (note.timestamp) {
      const d = new Date(note.timestamp);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else {
      key = "其他时间";
    }
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(note);
  }

  const sortedMonthKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

  listEl.innerHTML = sortedMonthKeys.map(monthKey => {
    const items = monthGroups[monthKey];

    let yearText = "";
    let monthText = monthKey;
    const parts = monthKey.split("-");
    if (parts.length === 2) {
      yearText = `${parts[0]} 年`;
      monthText = `${parseInt(parts[1], 10)} 月`;
    }

    const itemsHtml = items.map(note => {
      const isArchived = note.status === "archived";
      const validUrl = safeUrl(note.url) || note.url || "#";
      const isEditing = notesState.editingId === note.id;
      const isChecked = notesState.selectedIds.has(note.id);

      if (isEditing) {
        return `
          <div class="inbox-item-row editing" data-id="${escapeHtml(note.id)}">
            <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
              <input class="inbox-input edit-title" type="text" value="${escapeHtml(note.title)}" placeholder="网站标题">
              <input class="inbox-input edit-url" type="url" value="${escapeHtml(note.url)}" placeholder="网站链接">
              <textarea class="inbox-input edit-notes" style="resize:vertical;min-height:60px;" placeholder="备注内容">${escapeHtml(note.notes || "")}</textarea>
              <div style="display:flex;gap:6px;margin-top:4px;">
                <button type="button" data-action="save-edit" class="inbox-button primary" style="padding:4px 10px;font-size:12px;min-width:auto;">保存</button>
                <button type="button" data-action="cancel-edit" class="inbox-button ghost" style="padding:4px 10px;font-size:12px;min-width:auto;">取消</button>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="inbox-item-row${isArchived ? " archived" : ""}${isChecked ? " selected" : ""}" data-id="${escapeHtml(note.id)}">
          <label class="inbox-checkbox-wrap" title="选中此条笔记">
            <input type="checkbox" class="inbox-item-check" data-id="${escapeHtml(note.id)}" ${isChecked ? "checked" : ""}>
          </label>
          <div class="inbox-item-content">
            <div class="inbox-item-header">
              <div class="inbox-item-title-group">
                <a class="inbox-item-title" href="${escapeHtml(validUrl)}" target="_blank" rel="noopener" title="${escapeHtml(note.title || '未命名网页')}">
                  ${escapeHtml(note.title || "未命名网页")}
                </a>
                ${isArchived ? '<span class="inbox-status-tag archived">已收录</span>' : ""}
              </div>
              <div class="inbox-item-meta">
                <span class="inbox-time">${escapeHtml(note.createdAt || "刚刚")}</span>
              </div>
            </div>
            <a class="inbox-card-url" href="${escapeHtml(validUrl)}" target="_blank" rel="noopener" title="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a>
            ${note.notes ? `<div class="inbox-card-notes">${escapeHtml(note.notes)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="inbox-month-card" data-month="${escapeHtml(monthKey)}">
        <aside class="inbox-month-aside">
          <div class="inbox-month-label">
            ${yearText ? `<span class="inbox-month-year">${escapeHtml(yearText)}</span>` : ""}
            <span class="inbox-month-num">${escapeHtml(monthText)}</span>
          </div>
          <span class="inbox-month-count">共 ${items.length} 条</span>
        </aside>
        <div class="inbox-month-body">
          <div class="inbox-month-items">
            ${itemsHtml}
          </div>
        </div>
      </section>
    `;
  }).join("");
}

// 事件绑定
function initInboxEvents() {
  const form = document.getElementById("inbox-form");
  const rawInput = document.getElementById("inbox-raw-input");
  const searchInput = document.getElementById("inbox-search");

  // 顶部公共操作按钮
  const selectModeBtn = document.getElementById("inbox-btn-select-mode");
  const globalSelectAll = document.getElementById("inbox-global-select-all");
  const batchCopyBtn = document.getElementById("inbox-btn-batch-copy");
  const batchStatusBtn = document.getElementById("inbox-btn-batch-status");
  const batchDeleteBtn = document.getElementById("inbox-btn-batch-delete");
  const batchEditBtn = document.getElementById("inbox-btn-batch-edit");

  // 单框回车直接保存录入（Shift + Enter 允许常规换行）
  rawInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  // 表单提交：录入笔记
  form?.addEventListener("submit", event => {
    event.preventDefault();
    const raw = rawInput?.value.trim();
    if (!raw) return;

    const items = parseNotesInput(raw);
    if (!items.length) {
      showToast("未能识别到有效链接（需包含 http:// 或 https://）！");
      rawInput?.focus();
      return;
    }

    const now = Date.now();
    const timeStr = formatExactTime(new Date());

    const newNotes = items.map((item, idx) => ({
      id: "note_" + (now + idx) + "_" + Math.random().toString(36).slice(2, 6),
      title: item.title,
      url: item.url,
      notes: item.notes,
      createdAt: timeStr,
      timestamp: now + idx,
      status: "pending"
    }));

    notesState.notes.unshift(...newNotes);
    saveNotes();
    renderInbox();

    if (rawInput) rawInput.value = "";
    showToast(items.length === 1 ? "已成功整理并记录 1 条笔记！" : `已成功批量整理并录入 ${items.length} 条笔记！`);
  });

  // 公共功能 0：切换多选模式 / 纯净阅读模式
  selectModeBtn?.addEventListener("click", () => {
    notesState.selectMode = !notesState.selectMode;
    if (!notesState.selectMode) {
      notesState.selectedIds.clear();
    }
    renderInbox();
  });

  // 公共功能 1：全选 / 取消全选（跨越所有月份）
  globalSelectAll?.addEventListener("change", () => {
    const isChecked = globalSelectAll.checked;
    let filtered = notesState.notes;
    if (notesState.filter === "pending") filtered = filtered.filter(n => n.status !== "archived");
    else if (notesState.filter === "archived") filtered = filtered.filter(n => n.status === "archived");

    if (notesState.query) {
      const q = notesState.query.toLowerCase();
      filtered = filtered.filter(n =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.url && n.url.toLowerCase().includes(q)) ||
        (n.notes && n.notes.toLowerCase().includes(q))
      );
    }

    if (isChecked) {
      filtered.forEach(n => notesState.selectedIds.add(n.id));
    } else {
      notesState.selectedIds.clear();
    }
    renderInbox();
  });

  // 公共功能 2：复制笔记（阅读模式直接复制全部未归档；选择模式下复制勾选项）
  batchCopyBtn?.addEventListener("click", async () => {
    let targetNotes = [];
    if (notesState.selectMode && notesState.selectedIds.size > 0) {
      targetNotes = notesState.notes.filter(n => notesState.selectedIds.has(n.id));
    } else {
      targetNotes = notesState.notes.filter(n => n.status !== "archived");
    }

    if (!targetNotes.length) {
      showToast("当前没有可复制的笔记！");
      return;
    }

    const md = generateAiMarkdown(targetNotes);
    const ok = await copyText(md);
    if (ok) {
      showToast(`已复制 ${targetNotes.length} 条笔记到剪贴板，可直接发给 AI！`);
    } else {
      showToast("复制失败，请检查浏览器权限。");
    }
  });

  // 公共功能 3：标记已收录 / 还原
  batchStatusBtn?.addEventListener("click", () => {
    const isArchivedTab = notesState.filter === "archived";
    const newStatus = isArchivedTab ? "pending" : "archived";

    let targetNotes = [];
    if (notesState.selectMode && notesState.selectedIds.size > 0) {
      targetNotes = notesState.notes.filter(n => notesState.selectedIds.has(n.id));
    } else {
      targetNotes = notesState.notes.filter(n => isArchivedTab ? n.status === "archived" : n.status !== "archived");
    }

    if (!targetNotes.length) {
      showToast("没有可操作的笔记。");
      return;
    }

    const actionDesc = isArchivedTab ? "还原至待整理" : "收录";
    if (notesState.selectedIds.size === 0) {
      if (!window.confirm(`确定将全部 ${targetNotes.length} 条笔记${actionDesc}吗？`)) return;
    }

    targetNotes.forEach(n => { n.status = newStatus; });
    notesState.selectedIds.clear();
    saveNotes();
    renderInbox();
    showToast(`已将 ${targetNotes.length} 条笔记${actionDesc}。`);
  });

  // 公共功能 4：删除笔记
  batchDeleteBtn?.addEventListener("click", () => {
    if (!notesState.selectMode) {
      notesState.selectMode = true;
      renderInbox();
      showToast("已开启选择模式，请勾选需要删除的笔记！");
      return;
    }

    if (notesState.selectedIds.size === 0) {
      showToast("请先勾选需要删除的笔记！");
      return;
    }
    const count = notesState.selectedIds.size;
    if (!window.confirm(`确定删除选中的 ${count} 条笔记吗？`)) return;

    notesState.notes = notesState.notes.filter(n => !notesState.selectedIds.has(n.id));
    notesState.selectedIds.clear();
    saveNotes();
    renderInbox();
    showToast(`已删除 ${count} 条笔记。`);
  });

  // 公共功能 5：编辑笔记
  batchEditBtn?.addEventListener("click", () => {
    if (!notesState.selectMode) {
      notesState.selectMode = true;
      renderInbox();
      showToast("已开启选择模式，请勾选需要编辑的笔记！");
      return;
    }

    if (notesState.selectedIds.size === 0) {
      showToast("请先勾选需要编辑的笔记！");
      return;
    }
    const targetId = [...notesState.selectedIds][0];
    notesState.editingId = targetId;
    renderInbox();
    setTimeout(() => {
      const row = document.querySelector(`.inbox-item-row.editing[data-id="${targetId}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.querySelector(".edit-title")?.focus();
    }, 60);
  });

  // 搜索过滤
  searchInput?.addEventListener("input", () => {
    notesState.query = searchInput.value.trim();
    renderInbox();
  });

  // 筛选 Tab
  document.getElementById("inbox-filter-tabs")?.addEventListener("click", event => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    notesState.filter = btn.dataset.filter;
    notesState.selectedIds.clear();
    document.querySelectorAll("#inbox-filter-tabs .inbox-tab-pill").forEach(p => {
      p.classList.toggle("active", p === btn);
    });
    renderInbox();
  });

  // 列表事件委托（单选复选框 & 保存/取消行编辑）
  document.getElementById("inbox-list")?.addEventListener("click", async event => {
    // 1. 复选框勾选
    const itemCheck = event.target.closest(".inbox-item-check");
    if (itemCheck) {
      const id = itemCheck.dataset.id;
      if (itemCheck.checked) notesState.selectedIds.add(id);
      else notesState.selectedIds.delete(id);
      renderInbox();
      return;
    }

    // 2. 行内编辑表单保存 / 取消
    const card = event.target.closest(".inbox-item-row");
    if (!card) return;
    const noteId = card.dataset.id;
    const note = notesState.notes.find(n => n.id === noteId);
    if (!note) return;

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "cancel-edit") {
      notesState.editingId = null;
      renderInbox();
    } else if (action === "save-edit") {
      const newTitle = card.querySelector(".edit-title")?.value.trim();
      const newUrl = card.querySelector(".edit-url")?.value.trim();
      const newNotes = card.querySelector(".edit-notes")?.value.trim();
      if (!newUrl) {
        showToast("链接不能为空！");
        return;
      }
      note.title = newTitle || note.title;
      note.url = newUrl;
      note.notes = newNotes;
      notesState.editingId = null;
      saveNotes();
      renderInbox();
      showToast("修改已保存。");
    }
  });
}

function init() {
  initInboxEvents();
  renderInbox();
  HubAuth.onChange(user => {
    if (user) attachCloud(user.uid);
    else detachCloud();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
