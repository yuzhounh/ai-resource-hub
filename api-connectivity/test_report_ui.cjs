// Offline DOM fixtures test behavior, not browser layout or rendering speed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

class Element {
    constructor(text = '', dataset = {}) {
        this.textContent = text; this.dataset = dataset; this.style = {};
        this.attributes = {}; this.listeners = {}; this.hidden = false; this.value = '';
        this.classList = { toggle() {}, remove() {} };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    click() { return this.listeners.click({ target: { closest: () => null }, stopPropagation() {} }); }
    focus() { this.focused = true; }
    select() {}
    remove() { this.removed = true; }
}
function fixture({ storageBlocked = false, savedTheme = 'dark', clipboard, legacyCopy = false } = {}) {
    const row = (provider, model, latency, status) => {
        const item = new Element(`${provider} ${model} Chat ${latency} ${status}`, { provider, status });
        item.cells = [provider, model, 'Chat', latency, status, 'details'].map(text => new Element(text));
        return item;
    };
    const modelRows = [row('A', 'Alpha', '20 ms', 'SUCCESS'), row('B', 'Beta', '-', 'SKIPPED'), row('A', 'Gamma', '10 ms', 'FAILED')];
    const ids = Object.fromEntries(['themeToggleBtn', 'searchInput', 'resultCount', 'emptyState', 'copyStatus', 'refreshStatus', 'providerStatLabel', 'providerStatValue', 'providerStatSub', 'successStatLabel', 'successStatValue', 'successStatSub', 'skippedStatValue', 'skippedStatSub', 'latencyStatValue', 'latencyStatSub'].map(id => [id, new Element()]));
    ids.reportData = new Element(JSON.stringify({ results: [
        { provider: 'A', total_models: 2 }, { provider: 'B', total_models: 1 }
    ] }));
    const filters = ['ALL', 'SUCCESS', 'SKIPPED', 'FAILED'].map(status => new Element('', { status }));
    const cards = ['A', 'B'].map(provider => {
        const card = new Element('', { provider }); card.button = new Element();
        card.querySelector = selector => selector === '.provider-select' ? card.button : null;
        return card;
    });
    const headers = ['protocol', 'latency', 'status'].map(sort => {
        const header = new Element('', { sort }); header.indicator = new Element();
        header.querySelector = () => header.indicator;
        return header;
    });
    const copyButton = new Element('', { copyUrl: 'https://example.invalid' });
    let displayedRows = modelRows.slice();
    const tbody = { querySelectorAll: () => modelRows, appendChild: fragment => { displayedRows = fragment.children; } };
    const previousFocus = new Element();
    const document = {
        documentElement: new Element(), activeElement: previousFocus,
        getElementById: id => ids[id], querySelector: () => tbody,
        querySelectorAll: selector => ({ '.provider-card': cards, '.filter-btn': filters, 'th.sortable': headers, '.copy-btn': [copyButton] })[selector],
        createDocumentFragment: () => ({ children: [], appendChild(item) { this.children.push(item); } }),
        createElement: () => new Element(), body: { appendChild() {} }, execCommand: () => legacyCopy
    };
    const timers = new Map(); let timerId = 0;
    const localStorage = {
        getItem() { if (storageBlocked) throw new Error('blocked'); return savedTheme; },
        setItem(key, value) { if (storageBlocked) throw new Error('blocked'); savedTheme = value; }
    };
    const context = vm.createContext({ document, localStorage, navigator: { clipboard },
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } });
    vm.runInContext(script('theme.js'), context);
    const initialTheme = document.documentElement.dataset.theme;
    vm.runInContext(script('report.js'), context);
    return { document, ids, modelRows, filters, cards, headers, copyButton, initialTheme, previousFocus,
        displayedRows: () => displayedRows,
        flushTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
        timerCount: () => timers.size };
}

test('saved theme applies before main script and storage failures are tolerated', () => {
    const saved = fixture({ savedTheme: 'light' }); assert.equal(saved.initialTheme, 'light');
    saved.ids.themeToggleBtn.click(); assert.equal(saved.document.documentElement.dataset.theme, 'dark');
    const blocked = fixture({ storageBlocked: true }); blocked.ids.themeToggleBtn.click();
    assert.equal(blocked.document.documentElement.dataset.theme, 'light');
    assert.equal(fixture({ savedTheme: 'invalid' }).initialTheme, 'dark');
});
test('search debounces, finds hidden rows again and shows empty state', () => {
    const f = fixture();
    for (const query of ['b', 'be', 'beta']) { f.ids.searchInput.value = query; f.ids.searchInput.listeners.input(); }
    assert.equal(f.timerCount(), 1); f.flushTimers();
    assert.deepEqual(f.modelRows.map(row => row.hidden), [true, false, true]);
    f.ids.searchInput.value = 'ALPHA'; f.ids.searchInput.listeners.input(); f.flushTimers();
    assert.deepEqual(f.modelRows.map(row => row.hidden), [false, true, true]);
    f.ids.searchInput.value = 'missing'; f.ids.searchInput.listeners.input(); f.flushTimers();
    assert.equal(f.ids.emptyState.hidden, false); assert.match(f.ids.resultCount.textContent, /0 \/ 3/);
});
test('provider and status filters combine and can be cleared', () => {
    const f = fixture(); f.cards[0].click();
    assert.equal(f.filters[0].textContent, '全部 (2)');
    assert.equal(f.filters[1].textContent, '成功 (1)');
    f.filters[3].click();
    assert.deepEqual(f.modelRows.map(row => row.hidden), [true, true, false]);
    assert.equal(f.cards[0].button.attributes['aria-pressed'], 'true');
    f.cards[0].click(); f.filters[0].click();
    assert.ok(f.modelRows.every(row => !row.hidden));
    assert.equal(f.filters[0].textContent, '全部 (3)');
});
test('latency sort keeps missing values last in both directions and supports keyboard', () => {
    const f = fixture(); const header = f.headers[1]; header.click();
    assert.deepEqual(f.displayedRows().map(row => row.cells[1].textContent), ['Gamma', 'Alpha', 'Beta']);
    header.listeners.keydown({ key: 'Enter', preventDefault() {} });
    assert.deepEqual(f.displayedRows().map(row => row.cells[1].textContent), ['Alpha', 'Gamma', 'Beta']);
    assert.equal(header.attributes['aria-sort'], 'descending');
    header.click(); assert.deepEqual(f.displayedRows().map(row => row.cells[1].textContent), ['Alpha', 'Gamma', 'Beta']);
    assert.equal(header.attributes['aria-sort'], 'none');
});
test('clipboard missing or rejected uses fallback and never reports a false success', async () => {
    const missing = fixture(); await missing.copyButton.click();
    assert.match(missing.ids.copyStatus.textContent, /复制失败/);
    assert.equal(missing.previousFocus.focused, true);
    const fallback = fixture({ clipboard: { writeText: async () => { throw new Error('denied'); } }, legacyCopy: true });
    await fallback.copyButton.click(); assert.equal(fallback.ids.copyStatus.textContent, '已复制');
    let copied;
    const modern = fixture({ clipboard: { writeText: async text => { copied = text; } } });
    await modern.copyButton.click(); assert.equal(copied, 'https://example.invalid');
    assert.equal(modern.ids.copyStatus.textContent, '已复制');
});
