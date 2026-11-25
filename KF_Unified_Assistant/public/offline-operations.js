const databaseName = "kf-knight-sheet";
const storeName = "sync";
const keyFor = (queue, id) => `operation:${queue}:${id}`;

function transaction(database, mode, update) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    update(tx.objectStore(storeName));
  });
}

async function indexedOperations() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Move the old arrays in a single transaction without upgrading the
  // database version, so a tab still running the old app cannot block boot.
  await transaction(database, "readwrite", store => {
    for (const [legacyKey, queue] of [["pending", "sheet"], ["campaign-pending", "campaign"]]) {
      const request = store.get(legacyKey);
      request.onsuccess = () => {
        if (!Array.isArray(request.result)) return;
        for (const [index, operation] of request.result.entries()) {
          if (!operation || typeof operation.id !== "string" || !operation.id) continue;
          const key = keyFor(queue, operation.id);
          const existing = store.get(key);
          existing.onsuccess = () => {
            if (existing.result === undefined) {
              store.put({queue, operation: {...operation, queuedAt: index - request.result.length}}, key);
            }
          };
        }
        store.delete(legacyKey);
      };
    }
  });

  return {
    async read() {
      let entries = [];
      await transaction(database, "readonly", store => {
        const request = store.getAll();
        request.onsuccess = () => { entries = request.result.filter(entry => entry?.queue && entry.operation); };
      });
      return entries;
    },
    put(queue, operation) {
      return transaction(database, "readwrite", store => store.put({queue, operation}, keyFor(queue, operation.id)));
    },
    remove(queue, ids) {
      return transaction(database, "readwrite", store => {
        for (const id of ids) store.delete(keyFor(queue, id));
      });
    },
    setBlocked(queue, ids, status) {
      return transaction(database, "readwrite", store => {
        for (const id of ids) {
          const key = keyFor(queue, id);
          const request = store.get(key);
          request.onsuccess = () => {
            const entry = request.result;
            // Another tab may have acknowledged this operation meanwhile.
            if (!entry) return;
            if (status) entry.operation.syncBlocked = status;
            else delete entry.operation.syncBlocked;
            store.put(entry, key);
          };
        }
      });
    },
  };
}

// Some browser modes disable IndexedDB while keeping localStorage available.
// Keep the same per-operation layout there so settings still survive reloads.
function localStorageOperations() {
  const prefix = "kf-offline-";
  const storageKey = (queue, id) => prefix + keyFor(queue, id);
  return {
    async read() {
      const rows = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix + "operation:")) continue;
        try {
          const entry = JSON.parse(localStorage.getItem(key));
          if (entry?.queue && entry.operation) rows.push(entry);
        } catch { /* A malformed record does not hide the rest of the queue. */ }
      }
      return rows;
    },
    async put(queue, operation) {
      localStorage.setItem(storageKey(queue, operation.id), JSON.stringify({queue, operation}));
    },
    async remove(queue, ids) {
      for (const id of ids) localStorage.removeItem(storageKey(queue, id));
    },
    async setBlocked(queue, ids, status) {
      for (const id of ids) {
        const key = storageKey(queue, id);
        const entry = JSON.parse(localStorage.getItem(key) || "null");
        if (!entry) continue;
        if (status) entry.operation.syncBlocked = status;
        else delete entry.operation.syncBlocked;
        localStorage.setItem(key, JSON.stringify(entry));
      }
    },
  };
}

export async function openOfflineOperations() {
  const fallback = localStorageOperations();
  let indexed;
  try { indexed = await indexedOperations(); }
  catch { return fallback; }
  return {
    async read() {
      const fallbackRows = await fallback.read();
      try { return [...await indexed.read(), ...fallbackRows]; }
      catch { return fallbackRows; }
    },
    put(queue, operation) {
      return indexed.put(queue, operation).catch(() => fallback.put(queue, operation));
    },
    remove(queue, ids) {
      return Promise.all([indexed.remove(queue, ids), fallback.remove(queue, ids)]);
    },
    setBlocked(queue, ids, status) {
      return Promise.all([indexed.setBlocked(queue, ids, status), fallback.setBlocked(queue, ids, status)]);
    },
  };
}
