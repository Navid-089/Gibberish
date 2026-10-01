const NAME = 'khoroch';
const VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('expenses')) {
        const s = db.createObjectStore('expenses', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

export const getAllExpenses = () => run('expenses', 'readonly', (s) => s.getAll());
export const putExpense = (e) => run('expenses', 'readwrite', (s) => s.put(e));
export const deleteExpense = (id) => run('expenses', 'readwrite', (s) => s.delete(id));
export const bulkPutExpenses = (list) => run('expenses', 'readwrite', (s) => { list.forEach((e) => s.put(e)); });

export const kvGet = (key) => run('kv', 'readonly', (s) => s.get(key)).then((r) => (r ? r.value : undefined));
export const kvSet = (key, value) => run('kv', 'readwrite', (s) => s.put({ key, value }));
export const kvDel = (key) => run('kv', 'readwrite', (s) => s.delete(key));
export const kvAll = () => run('kv', 'readonly', (s) => s.getAll()).then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));

export async function clearAll() {
  await run('expenses', 'readwrite', (s) => s.clear());
  await run('kv', 'readwrite', (s) => s.clear());
}
