// Reuse the same logic for IndexDB file handle storage
const DB_NAME = 'GTDFlowDB';
const STORE_NAME = 'FileHandles';
const KEY_NAME = 'currentFileHandle';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveFileHandle = async (handle) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, KEY_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFileHandle = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(KEY_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const removeFileHandle = async () => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(KEY_NAME);
};
