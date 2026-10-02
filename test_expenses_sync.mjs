import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExpenseSync, mergeExpenseChange } from './expense-sync.js';

const clone = value => JSON.parse(JSON.stringify(value));
const record = (id, title = id) => ({ id, title, amount: 7, date: '2026-10-03' });
function storageFixture() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index]; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}
function serverFixture(initial = []) {
  const server = { items: clone(initial), revision: 0, online: true, loseAcknowledgement: false, retries: 0 };
  // Model Firestore's optimistic retry when another client commits after the read.
  server.transact = async (operation, active) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!server.online) throw new Error('offline');
      const revision = server.revision, items = clone(server.items);
      await Promise.resolve();
      if (!active()) throw Object.assign(new Error('cancelled'), { code: 'expense-cancelled' });
      if (revision !== server.revision) { server.retries++; continue; }
      server.items = mergeExpenseChange(items, operation);
      server.revision++;
      if (server.loseAcknowledgement) { server.loseAcknowledgement = false; throw new Error('lost acknowledgement'); }
      return clone(server.items);
    }
    throw new Error('contention');
  };
  return server;
}
function client(server, storage = storageFixture(), initialItems = server.items) {
  const observed = { items: [], status: null, errors: [] };
  const sync = new ExpenseSync({ uid: 'fixture-user', storage, initialItems,
    transact: server.transact,
    onChange: (items, status) => Object.assign(observed, { items, status }),
    onError: message => observed.errors.push(message) });
  sync.refresh();
  return { sync, storage, observed };
}
async function idle(...clients) {
  for (let count = 0; count < 100; count++) {
    await Promise.resolve();
    if (clients.every(c => !c.sync.busy)) return;
  }
  assert.fail('sync did not settle');
}

test('two stale devices add different records without overwriting either', async () => {
  const server = serverFixture([record('existing')]), a = client(server), b = client(server);
  a.sync.queue(null, record('a')); b.sync.queue(null, record('b'));
  await idle(a, b);
  assert.deepEqual(server.items.map(item => item.id).sort(), ['a', 'b', 'existing']);
  assert.ok(server.retries > 0);
  a.sync.receive(server.items); b.sync.receive(server.items); await idle(a, b);
  assert.deepEqual(a.observed.items, b.observed.items);
  assert.equal(a.observed.status.pending + b.observed.status.pending, 0);
});

test('same-record edit conflicts preserve drafts and unrelated writes; keep local is explicit', async () => {
  const base = record('shared'), server = serverFixture([base]), a = client(server), b = client(server);
  a.sync.queue(base, record('shared', 'Device A'));
  b.sync.queue(base, record('shared', 'Device B'));
  b.sync.queue(null, record('unrelated'));
  await idle(a, b);
  assert.equal(server.items.find(item => item.id === 'shared').title, 'Device A');
  assert.equal(b.observed.items.find(item => item.id === 'shared').title, 'Device B');
  assert.equal(b.observed.status.conflicts.length, 1);
  assert.ok(server.items.some(item => item.id === 'unrelated'));
  b.sync.resolve('shared', true); await idle(b);
  assert.equal(server.items.find(item => item.id === 'shared').title, 'Device B');
  assert.equal(b.observed.status.pending, 0);
});

test('remote delete cannot be silently resurrected; adopting cloud discards the draft', async () => {
  const base = record('shared'), server = serverFixture([base]), a = client(server), b = client(server);
  a.sync.queue(base, null); await idle(a);
  b.sync.queue(base, record('shared', 'Stale edit')); await idle(b);
  assert.deepEqual(server.items, []);
  assert.equal(b.observed.status.conflicts[0].remote, null);
  b.sync.resolve('shared', false); await idle(b);
  assert.deepEqual(b.observed.items, []);
  assert.equal(b.observed.status.pending, 0);
});

test('offline consecutive edits survive reload and merge with another device on reconnect', async () => {
  const base = record('shared'), changed = record('shared', 'Offline edit');
  const server = serverFixture([base]), a = client(server);
  server.online = false;
  a.sync.queue(base, changed); a.sync.queue(changed, record('shared', 'Second edit'));
  await idle(a);
  assert.equal(a.observed.status.pending, 2);
  assert.match(a.observed.status.error, /本机/);
  a.sync.stop();
  server.items.push(record('remote-add')); server.revision++;
  const reloaded = client(server, a.storage, a.observed.items);
  assert.equal(reloaded.observed.status.pending, 2);
  server.online = true; reloaded.sync.receive(server.items); await idle(reloaded);
  assert.equal(server.items.find(item => item.id === 'shared').title, 'Second edit');
  assert.ok(server.items.some(item => item.id === 'remote-add'));
  assert.equal(reloaded.observed.status.pending, 0);
});

test('shared-origin tabs keep independent outbox entries and replay safely', async () => {
  const server = serverFixture(), storage = storageFixture(), a = client(server, storage), b = client(server, storage);
  a.sync.queue(null, record('a')); b.sync.queue(null, record('b'));
  await idle(a, b);
  assert.deepEqual(server.items.map(item => item.id).sort(), ['a', 'b']);
  assert.equal(storage.length, 0);
});

test('lost acknowledgement is retried idempotently after reload', async () => {
  const server = serverFixture(), a = client(server);
  server.loseAcknowledgement = true;
  a.sync.queue(null, record('once')); await idle(a);
  assert.equal(server.items.length, 1);
  assert.equal(a.observed.status.pending, 1);
  a.sync.stop();
  const b = client(server, a.storage); await b.sync.flush();
  assert.equal(server.items.length, 1);
  assert.equal(b.observed.status.pending, 0);
});

test('conflict comparison follows latest local draft and latest received cloud version', async () => {
  const base = record('shared'), server = serverFixture([record('shared', 'Remote')]);
  const a = client(server, storageFixture(), [base]);
  a.sync.queue(base, record('shared', 'Local 1')); await idle(a);
  a.sync.queue(record('shared', 'Local 1'), record('shared', 'Local 2')); await idle(a);
  server.items = [record('shared', 'Remote 2')];
  a.sync.receive(server.items); await idle(a);
  assert.equal(a.observed.status.conflicts.length, 1);
  assert.equal(a.observed.status.conflicts[0].after.title, 'Local 2');
  assert.equal(a.observed.status.conflicts[0].remote.title, 'Remote 2');
  a.sync.resolve('shared', true); await idle(a);
  assert.equal(server.items[0].title, 'Local 2');
});

test('storage quota failure does not claim an edit was saved', async () => {
  const server = serverFixture(), storage = storageFixture(), a = client(server, storage);
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(a.sync.queue(null, record('unsaved')), false);
  assert.equal(a.observed.errors.length, 1);
  assert.deepEqual(server.items, []);
  assert.deepEqual(a.observed.items, []);
});
