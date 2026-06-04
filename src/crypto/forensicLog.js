const DB_NAME = 'securechat-forensic-log';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const memoryStore = [];

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new TypeError('entry is required.');
  if (!entry.conversationId) throw new TypeError('entry.conversationId is required.');
  if (!entry.messageId) throw new TypeError('entry.messageId is required.');
  return {
    timestamp: new Date().toISOString(),
    ...entry,
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

function inDateRange(entry, dateRange = {}) {
  const time = new Date(entry.timestamp).getTime();
  const from = dateRange.from ?? dateRange.dateFrom;
  const to = dateRange.to ?? dateRange.dateTo;
  if (from && time < new Date(from).getTime()) return false;
  if (to && time > new Date(to).getTime()) return false;
  return true;
}

export async function appendLog(entry) {
  const normalized = normalizeEntry(entry);
  if (!hasIndexedDb()) {
    memoryStore.push({ id: memoryStore.length + 1, ...normalized });
    return normalized;
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(normalized);
    tx.objectStore(STORE_NAME).add(normalized);
  });
}

export async function getLogs(conversationId, dateRange = {}) {
  if (!conversationId) throw new TypeError('conversationId is required.');
  if (!hasIndexedDb()) {
    return memoryStore
      .filter((entry) => entry.conversationId === conversationId && inDateRange(entry, dateRange))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const logs = [];
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('conversationId');
    const request = index.openCursor(IDBKeyRange.only(conversationId));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(logs.filter((entry) => inDateRange(entry, dateRange)));
        return;
      }
      logs.push(cursor.value);
      cursor.continue();
    };
  });
}

export async function clearSession(conversationId) {
  if (!conversationId) {
    memoryStore.length = 0;
  } else {
    for (let i = memoryStore.length - 1; i >= 0; i -= 1) {
      if (memoryStore[i].conversationId === conversationId) memoryStore.splice(i, 1);
    }
  }

  if (!hasIndexedDb()) return;
  const db = await openDb();
  const logs = await getLogs(conversationId);
  await Promise.all(logs.map((entry) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = resolve;
    tx.objectStore(STORE_NAME).delete(entry.id);
  })));
}
