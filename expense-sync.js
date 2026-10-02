// Durable per-operation outbox. Firestore transactions merge into the latest list.
const PREFIX = 'ai_hub_expenses_records';
const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
const canonical = value => value == null ? 'null' : JSON.stringify(Object.fromEntries(
  Object.keys(value).sort().map(key => [key, value[key]])
));

export function mergeExpenseChange(items, operation) {
  const current = items.find(item => item.id === operation.recordId) || null;
  // A successful write can be replayed after a lost acknowledgement/reload.
  if (canonical(current) === canonical(operation.after)) return items;
  if (canonical(current) !== canonical(operation.before)) {
    throw Object.assign(new Error('这条记录已在其他设备修改或删除。'), {
      code: 'expense-conflict', remote: copy(current)
    });
  }
  const merged = items.filter(item => item.id !== operation.recordId);
  if (operation.after) merged.push(copy(operation.after));
  return merged;
}

export class ExpenseSync {
  constructor({ uid, storage, initialItems, transact, onChange, onError }) {
    this.uid = uid;
    this.storage = storage;
    this.cloudItems = copy(initialItems) || [];
    this.transact = transact;
    this.onChange = onChange;
    this.onError = onError;
    this.prefix = `${PREFIX}:pending:${uid}:`;
    this.active = true;
    this.busy = false;
    this.lastStamp = 0;
    this.lastError = '';
    this.snapshotVersion = 0;
    this.hasServerState = false;
    this.operations = this.readOperations();
  }

  readOperations() {
    const operations = [];
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      try {
        const operation = JSON.parse(this.storage.getItem(key));
        if (operation?.id && operation.recordId && key === this.prefix + operation.id) operations.push(operation);
      } catch { /* Keep an unreadable draft untouched rather than silently deleting it. */ }
    }
    return operations.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  view() {
    const map = new Map(this.cloudItems.map(item => [item.id, copy(item)]));
    for (const operation of this.operations) {
      if (operation.after) map.set(operation.recordId, copy(operation.after));
      else map.delete(operation.recordId);
    }
    return [...map.values()];
  }

  notify() {
    if (!this.active) return;
    this.onChange(this.view(), {
      pending: this.operations.length,
      busy: this.busy,
      error: this.lastError,
      hasServerState: this.hasServerState,
      conflicts: [...new Set(this.operations.filter(operation => operation.conflict).map(operation => operation.recordId))]
        .map(recordId => ({
          ...this.operations.filter(operation => operation.recordId === recordId).at(-1),
          remote: copy(this.cloudItems.find(item => item.id === recordId) || null)
        }))
    });
  }

  refresh() {
    if (!this.active) return;
    this.operations = this.readOperations();
    this.notify();
  }

  receive(items, confirmed = true) {
    if (!this.active) return;
    this.hasServerState ||= confirmed;
    this.snapshotVersion += 1;
    this.cloudItems = copy(items) || [];
    this.refresh();
    void this.flush();
  }

  queue(before, after) {
    if (!this.active || !(after || before)?.id) return false;
    this.lastStamp = Math.max(this.lastStamp, ...this.readOperations().map(operation => operation.createdAt || 0));
    const operation = {
      id: crypto.randomUUID(), recordId: (after || before).id,
      before: copy(before), after: copy(after),
      createdAt: this.lastStamp = Math.max(Date.now(), this.lastStamp + 1)
    };
    try {
      this.storage.setItem(this.prefix + operation.id, JSON.stringify(operation));
    } catch {
      this.onError('无法保存本机待同步操作，请检查浏览器存储空间后重试。');
      return false;
    }
    this.lastError = '';
    this.refresh();
    void this.flush();
    return true;
  }

  async flush() {
    if (!this.active || this.busy) return;
    this.busy = true;
    this.lastError = '';
    this.refresh();
    const blocked = new Set();
    try {
      while (this.active) {
        this.operations = this.readOperations();
        for (const operation of this.operations) if (operation.conflict) blocked.add(operation.recordId);
        const operation = this.operations.find(item => !blocked.has(item.recordId));
        if (!operation) break;
        try {
          const snapshotVersion = this.snapshotVersion;
          const merged = await this.transact(operation, () => this.active && Boolean(this.storage.getItem(this.prefix + operation.id)));
          // Logout cannot cancel an already committed transaction, but never paints it into another account.
          if (!this.active) break;
          this.hasServerState = true;
          if (snapshotVersion === this.snapshotVersion) this.cloudItems = merged;
          this.storage.removeItem(this.prefix + operation.id);
        } catch (error) {
          if (!this.active) break;
          if (error.code === 'expense-cancelled') continue;
          if (error.code === 'expense-conflict') {
            this.cloudItems = this.cloudItems.filter(item => item.id !== operation.recordId);
            if (error.remote) this.cloudItems.push(copy(error.remote));
            // Do not revive a draft discarded from another tab while this transaction was running.
            if (this.storage.getItem(this.prefix + operation.id)) {
              this.storage.setItem(this.prefix + operation.id, JSON.stringify({
                ...operation, conflict: true, remote: error.remote
              }));
            }
            blocked.add(operation.recordId);
          } else {
            this.lastError = '云端同步失败，修改仍保存在本机。可重试或等待网络恢复。';
            break;
          }
        }
        this.refresh();
      }
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  resolve(recordId, keepLocal) {
    if (!this.active || this.busy) return;
    this.operations = this.readOperations();
    const changes = this.operations.filter(item => item.recordId === recordId);
    const conflict = changes.find(item => item.conflict);
    if (!conflict) return;
    if (keepLocal) {
      const latest = changes[changes.length - 1];
      const replacement = {
        id: crypto.randomUUID(), recordId,
        before: copy(this.cloudItems.find(item => item.id === recordId) || null),
        after: copy(latest.after), createdAt: Date.now()
      };
      // Persist the chosen replacement before removing old drafts.
      try { this.storage.setItem(this.prefix + replacement.id, JSON.stringify(replacement)); }
      catch { this.onError('无法保存冲突处理结果，请重试。'); return; }
    }
    for (const operation of changes) this.storage.removeItem(this.prefix + operation.id);
    this.refresh();
    void this.flush();
  }

  stop() { this.active = false; }
}
