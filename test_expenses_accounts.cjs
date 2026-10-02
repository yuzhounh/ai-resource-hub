// Offline tests execute the real expense module with Firebase and DOM fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'expenses.js'), 'utf8');
const cacheKey = 'ai_hub_expenses_records';
const ownerUid = '8ASrz9xvKmMcrGkV7Yu98i6IrZO2';
const entry = (title = 'Private fixture', amount = 7) => ({
  id: 'fixture-entry', date: '2026-01-01', title, category: 'sub',
  description: '', amount, amountDisplay: `${amount}元`, notes: ''
});
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(initialCache = {}) {
  const storage = new Map(Object.entries(initialCache));
  const reads = [], subscriptions = [], writes = [], timers = new Map();
  let authChange, timerId = 0;
  const element = () => ({
    innerHTML: '', textContent: '', value: '', open: false, listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    reset() { this.wasReset = true; },
    close() { this.open = false; },
    showModal() { this.open = true; }
  });
  const ids = Object.fromEntries([
    'expenses-list', 'expenses-form', 'expenses-modal', 'expenses-search',
    'expenses-btn-open-modal', 'exp-stat-count', 'exp-stat-total'
  ].map(id => [id, element()]));
  const context = vm.createContext({
    console, Date, Math,
    document: {
      getElementById: id => ids[id] || null,
      querySelectorAll: () => [], addEventListener() {}
    },
    localStorage: {
      getItem(key) { reads.push(key); return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    HubAuth: { db: {}, onChange(callback) { authChange = callback; callback(null); } },
    doc: (_db, ...segments) => segments.join('/'),
    onSnapshot(ref, success, error) {
      const subscription = { ref, success, error, stopped: false };
      subscriptions.push(subscription);
      return () => { subscription.stopped = true; };
    },
    setDoc(ref, data) { writes.push({ ref, data: plain(data) }); return Promise.resolve(); },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace(/^export .*;?\s*$/gm, '') +
    '\nglobalThis.expensesTest = { expensesState, saveExpenses, readLocalExpenses };', context);
  return {
    ...context.expensesTest, storage, reads, subscriptions, writes, timers, ids,
    login: uid => authChange(uid ? { uid } : null),
    snapshot(items, exists = true, subscription = subscriptions.at(-1)) {
      subscription.success({ exists: () => exists, data: () => ({ items }) });
    },
    flush() {
      const callbacks = [...timers.values()]; timers.clear();
      callbacks.forEach(callback => callback());
    }
  };
}

test('anonymous initialization never reads a previous account cache', () => {
  const f = fixture({ [cacheKey]: JSON.stringify([entry()]) });
  assert.deepEqual(plain(f.expensesState.items), []);
  assert.equal(f.reads.length, 0);
  assert.match(f.ids['expenses-list'].innerHTML, /空空如也/);
  f.ids['expenses-btn-open-modal'].listeners.click();
  assert.equal(f.ids['expenses-modal'].open, false);
  f.ids['expenses-form'].listeners.submit({ preventDefault() {} });
  f.saveExpenses(); f.flush();
  assert.equal(f.writes.length, 0);
});

test('a different account stays empty for missing documents and denied reads', () => {
  const f = fixture({ [cacheKey]: JSON.stringify([entry()]),
    [`${cacheKey}:${ownerUid}`]: JSON.stringify([entry()]) });
  f.login('new-user'); f.snapshot(undefined, false);
  assert.deepEqual(plain(f.expensesState.items), []);
  f.subscriptions.at(-1).error(new Error('permission-denied'));
  assert.deepEqual(plain(f.expensesState.items), []);
  assert.equal(f.reads.includes(cacheKey), false);
  assert.equal(f.writes.length, 0);
});

test('existing cloud history is read without adding records or writing it back', () => {
  const f = fixture(); const history = [entry('Cloud fixture')];
  f.login(ownerUid); f.snapshot(history);
  assert.deepEqual(plain(f.expensesState.items), history);
  assert.deepEqual(JSON.parse(f.storage.get(`${cacheKey}:${ownerUid}`)), history);
  assert.match(f.ids['expenses-list'].innerHTML, /Cloud fixture/);
  assert.equal(f.ids['exp-stat-count'].textContent, '1 笔');
  assert.equal(f.writes.length, 0);
});

test('legacy cache migrates only to the owner; empty cloud data remains empty', () => {
  const f = fixture({ [cacheKey]: JSON.stringify([entry()]) });
  f.login('new-user'); f.snapshot(undefined, false);
  assert.ok(f.storage.has(cacheKey));
  f.login(ownerUid);
  assert.equal(f.expensesState.items.length, 1);
  assert.equal(f.storage.has(cacheKey), false);
  f.snapshot([]);
  assert.deepEqual(plain(f.expensesState.items), []);
  assert.equal(f.storage.get(`${cacheKey}:${ownerUid}`), '[]');
  f.login(null); f.login(ownerUid); f.snapshot([]);
  assert.deepEqual(plain(f.expensesState.items), []);
});

test('logout clears displayed records, closes the form and cancels pending writes', () => {
  const f = fixture(); f.login(ownerUid); f.snapshot([entry()]);
  f.ids['expenses-modal'].open = true;
  f.saveExpenses(); const pending = [...f.timers.values()][0];
  const oldSubscription = f.subscriptions.at(-1);
  f.login(null); pending(); f.snapshot([entry()], true, oldSubscription);
  assert.deepEqual(plain(f.expensesState.items), []);
  assert.doesNotMatch(f.ids['expenses-list'].innerHTML, /Private fixture/);
  assert.equal(f.ids['exp-stat-count'].textContent, '0 笔');
  assert.equal(f.ids['expenses-modal'].open, false);
  assert.equal(f.ids['expenses-form'].wasReset, true);
  assert.equal(oldSubscription.stopped, true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.writes.length, 0);
});

test('account switching ignores stale cloud callbacks and uses separate write paths', () => {
  const f = fixture(); f.login(ownerUid); f.snapshot([entry()]);
  f.saveExpenses(); const pending = [...f.timers.values()][0];
  const oldSubscription = f.subscriptions.at(-1);
  f.login('other-user'); f.snapshot([entry('Other fixture', 9)]);
  pending(); f.snapshot([entry()], true, oldSubscription); oldSubscription.error();
  assert.equal(f.expensesState.items[0].title, 'Other fixture');
  assert.equal(f.writes.length, 0);
  f.saveExpenses(); f.flush();
  assert.equal(f.writes[0].ref, 'users/other-user/expenses/records');
  assert.equal(f.writes[0].data.items[0].title, 'Other fixture');
  assert.equal(JSON.parse(f.storage.get(`${cacheKey}:${ownerUid}`))[0].title, 'Private fixture');
});

test('deleting the last record persists an empty list without replenishing history', () => {
  const f = fixture(); f.login(ownerUid); f.snapshot([entry()]);
  f.expensesState.items = []; f.saveExpenses(); f.flush(); f.snapshot([]);
  assert.deepEqual(f.writes[0].data.items, []);
  assert.deepEqual(plain(f.expensesState.items), []);
});

test('public expense source contains no historical seed and the entry point is refreshed', () => {
  assert.doesNotMatch(source, /INITIAL_EXPENSES|exp_\d{8}_/);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(html, /expenses\.js\?v=20261002a/);
});
