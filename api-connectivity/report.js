'use strict';

const themeButton = document.getElementById('themeToggleBtn');
function setTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem('theme', theme); } catch (_) { /* Storage is optional. */ }
    themeButton.textContent = theme === 'dark' ? '🌙' : '☀️';
    themeButton.setAttribute('aria-label', theme === 'dark' ? '切换为浅色模式' : '切换为深色模式');
}
setTheme(document.documentElement.dataset.theme);
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

const searchInput = document.getElementById('searchInput');
const tbody = document.querySelector('#modelsTable tbody');
const cards = Array.from(document.querySelectorAll('.provider-card'));
const filters = Array.from(document.querySelectorAll('.filter-btn'));
const sortHeaders = Array.from(document.querySelectorAll('th.sortable'));
const refreshScopeButton = document.getElementById('refreshScope');
const refreshStatus = document.getElementById('refreshStatus');
const reportData = JSON.parse(document.getElementById('reportData').textContent);
const statusOrder = { SUCCESS: 0, BATCH: 1, SKIPPED: 2, FAILED: 3 };
const rows = Array.from(tbody.querySelectorAll('tr')).map(row => ({
    element: row,
    provider: row.dataset.provider,
    status: row.dataset.status,
    search: row.textContent.toLocaleLowerCase(),
    model: row.cells[1].textContent.toLocaleLowerCase(),
    protocol: row.cells[2].textContent.trim().toLocaleLowerCase(),
    latency: parseInt(row.cells[3].textContent, 10) || 0
}));
let providerFilter = 'ALL';
let statusFilter = 'ALL';
let searchTimer;
let sortColumn = null;
let sortDirection = 1;

const initialStats = {
    providerLabel: document.getElementById('providerStatLabel')?.textContent || '目录请求成功 / 已配置',
    providerValue: document.getElementById('providerStatValue')?.textContent || '16 / 16',
    providerSub: document.getElementById('providerStatSub')?.textContent || '目录失败 0 / 缺少凭据 0',
    successLabel: document.getElementById('successStatLabel')?.textContent || '模型实测成功',
    successValue: document.getElementById('successStatValue')?.textContent || '202',
    successSub: document.getElementById('successStatSub')?.textContent || 'Chat: 190 | Resp: 10 | Anth: 10',
    skippedValue: document.getElementById('skippedStatValue')?.textContent || '871',
    skippedSub: document.getElementById('skippedStatSub')?.textContent || '41 Batch推断 / 131 分类跳过 / 699 未测试',
    latencyValue: document.getElementById('latencyStatValue')?.textContent || '2435 ms',
    latencySub: document.getElementById('latencyStatSub')?.textContent || '仅统计成功记录'
};

function updateDetailControls() {
    const selected = providerFilter === 'ALL' ? null : providerFilter;
    const scopedRows = rows.filter(row => !selected || row.provider === selected);
    const counts = { ALL: scopedRows.length, SUCCESS: 0, BATCH: 0, SKIPPED: 0, FAILED: 0 };
    const successLatencies = [];
    scopedRows.forEach(row => {
        if (row.status === 'SUCCESS') {
            counts.SUCCESS++;
            if (row.latency > 0) successLatencies.push(row.latency);
        } else if (row.status === 'BATCH') {
            counts.BATCH++;
        } else if (row.status === 'FAILED') {
            counts.FAILED++;
        } else {
            counts.SKIPPED++;
        }
    });
    const labels = { ALL: '全部', SUCCESS: '成功', BATCH: 'Batch', SKIPPED: '跳过/未测试', FAILED: '探测失败' };
    filters.forEach(button => {
        const st = button.dataset.status;
        if (st && counts[st] !== undefined) {
            button.textContent = `${labels[st]} (${counts[st]})`;
        }
    });
    if (refreshScopeButton) {
        refreshScopeButton.textContent = selected ? '刷新当前' : '刷新全部';
        refreshScopeButton.title = selected ? `刷新 ${selected}` : '刷新全部服务商';
        refreshScopeButton.setAttribute('aria-label', selected ? `刷新 ${selected}` : '刷新全部服务商');
    }
    const pLabel = document.getElementById('providerStatLabel');
    const pVal = document.getElementById('providerStatValue');
    const pSub = document.getElementById('providerStatSub');
    const sLabel = document.getElementById('successStatLabel');
    const sVal = document.getElementById('successStatValue');
    const sSub = document.getElementById('successStatSub');
    const skVal = document.getElementById('skippedStatValue');
    const skSub = document.getElementById('skippedStatSub');
    const lVal = document.getElementById('latencyStatValue');
    const lSub = document.getElementById('latencyStatSub');
    if (selected) {
        if (pLabel) pLabel.textContent = '当前选中服务商';
        if (pVal) pVal.textContent = selected;
        if (pSub) pSub.textContent = `共 ${counts.ALL} 个模型`;
        if (sLabel) sLabel.textContent = `${selected} 实测成功`;
        if (sVal) sVal.textContent = String(counts.SUCCESS);
        const rate = counts.ALL ? Math.round(counts.SUCCESS / counts.ALL * 100) : 0;
        if (sSub) sSub.textContent = `实测成功率 ${rate}%`;
        if (skVal) skVal.textContent = String(counts.SKIPPED + counts.BATCH);
        if (skSub) skSub.textContent = `${counts.BATCH} Batch推断 / ${counts.SKIPPED} 跳过或未测试`;
        const avgLat = successLatencies.length ? Math.round(successLatencies.reduce((a, b) => a + b, 0) / successLatencies.length) + ' ms' : '-';
        if (lVal) lVal.textContent = avgLat;
        if (lSub) lSub.textContent = successLatencies.length ? `基于 ${successLatencies.length} 个成功模型响应` : '暂无成功样本';
    } else {
        if (pLabel) pLabel.textContent = initialStats.providerLabel;
        if (pVal) pVal.textContent = initialStats.providerValue;
        if (pSub) pSub.textContent = initialStats.providerSub;
        if (sLabel) sLabel.textContent = initialStats.successLabel;
        if (sVal) sVal.textContent = initialStats.successValue;
        if (sSub) sSub.textContent = initialStats.successSub;
        if (skVal) skVal.textContent = initialStats.skippedValue;
        if (skSub) skSub.textContent = initialStats.skippedSub;
        if (lVal) lVal.textContent = initialStats.latencyValue;
        if (lSub) lSub.textContent = initialStats.latencySub;
    }
}

function applyFilters() {
    clearTimeout(searchTimer);
    const query = searchInput.value.trim().toLocaleLowerCase();
    // All search/layout reads happen before any writes. Cached text also covers hidden rows.
    const matches = rows.map(row => (providerFilter === 'ALL' || row.provider === providerFilter)
        && (statusFilter === 'ALL' || row.status === statusFilter) && row.search.includes(query));
    rows.forEach((row, index) => { row.element.hidden = !matches[index]; });
    const count = matches.filter(Boolean).length;
    const scopeCount = providerFilter === 'ALL' ? rows.length : rows.filter(row => row.provider === providerFilter).length;
    document.getElementById('resultCount').textContent = `显示 ${count} / ${scopeCount} 个模型`;
    document.getElementById('emptyState').hidden = count !== 0;
}
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
});

cards.forEach(card => card.addEventListener('click', event => {
    if (event.target.closest('.copy-btn')) return;
    const provider = card.dataset.provider;
    providerFilter = providerFilter === provider ? 'ALL' : provider;
    cards.forEach(item => {
        const selected = item.dataset.provider === providerFilter;
        item.classList.toggle('selected', selected);
        item.querySelector('.provider-select').setAttribute('aria-pressed', String(selected));
    });
    applyFilters();
    updateDetailControls();
}));
async function refresh(provider = null, button = refreshScopeButton) {
    const token = document.documentElement.dataset.refreshToken;
    if (!token) { if (refreshStatus) refreshStatus.textContent = '请双击启动脚本后从本地服务地址打开页面。'; return; }
    button.disabled = true; button.classList.add('is-refreshing'); refreshStatus.textContent = provider ? `正在刷新 ${provider}…` : '正在刷新全部服务商…';
    try {
        const response = await fetch('/api/refresh', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Refresh-Token': token}, body: JSON.stringify({provider})});
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '刷新失败'); location.reload();
    } catch (error) { refreshStatus.textContent = error.message || '刷新失败'; button.disabled = false; button.classList.remove('is-refreshing'); }
}
if (refreshScopeButton) refreshScopeButton.addEventListener('click', () => refresh(providerFilter === 'ALL' ? null : providerFilter));
filters.forEach(button => button.addEventListener('click', () => {
    statusFilter = button.dataset.status;
    filters.forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
    });
    applyFilters();
    updateDetailControls();
}));

function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function defaultCompare(a, b) {
    return compareText(a.provider.toLocaleLowerCase(), b.provider.toLocaleLowerCase()) || compareText(a.model, b.model);
}
function sortTable(column) {
    if (sortColumn !== column) { sortColumn = column; sortDirection = 1; }
    else if (sortDirection === 1) sortDirection = -1;
    else { sortColumn = null; sortDirection = 1; }
    rows.sort((a, b) => {
        if (!sortColumn) return defaultCompare(a, b);
        let result = 0;
        if (sortColumn === 'latency') {
            if ((a.latency <= 0) !== (b.latency <= 0)) return a.latency <= 0 ? 1 : -1;
            result = a.latency - b.latency;
        } else if (sortColumn === 'status') result = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        else result = compareText(a.protocol, b.protocol);
        return result * sortDirection || defaultCompare(a, b);
    });
    const fragment = document.createDocumentFragment();
    rows.forEach(row => fragment.appendChild(row.element));
    tbody.appendChild(fragment);
    sortHeaders.forEach(header => {
        const selected = header.dataset.sort === sortColumn;
        header.classList.toggle('th-active', selected);
        header.setAttribute('aria-sort', selected ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none');
        header.querySelector('.sort-ind').textContent = selected ? (sortDirection === 1 ? '▲' : '▼') : '↕';
    });
    applyFilters();
}
sortHeaders.forEach(header => {
    header.addEventListener('click', () => sortTable(header.dataset.sort));
    header.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            sortTable(header.dataset.sort);
        }
    });
});

async function copyText(text) {
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (_) { /* Try the local-file-compatible fallback. */ }
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(textarea);
    try {
        textarea.select();
        return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
    } catch (_) { return false; }
    finally {
        textarea.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    }
}
document.querySelectorAll('.copy-btn').forEach(button => {
    let resetTimer;
    const originalTitle = button.title;
    button.addEventListener('click', async event => {
        event.stopPropagation();
        const success = await copyText(button.dataset.copyUrl);
        clearTimeout(resetTimer);
        button.classList.toggle('copied', success);
        button.title = success ? '已复制' : '复制失败，请手动选择地址复制';
        document.getElementById('copyStatus').textContent = button.title;
        resetTimer = setTimeout(() => { button.classList.remove('copied'); button.title = originalTitle; }, 2000);
    });
});
applyFilters();
updateDetailControls();
