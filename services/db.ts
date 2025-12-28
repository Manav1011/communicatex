const DB_NAME = 'NexusDB';
const DB_VERSION = 2; // Increment version to trigger upgrade

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store workspaces
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
      }
      // Store environments
      if (!db.objectStoreNames.contains('environments')) {
        db.createObjectStore('environments', { keyPath: 'id' });
      }
      // Store history items
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
      // Store app state (user session, active IDs) as key-value pairs
      if (!db.objectStoreNames.contains('app_state')) {
        db.createObjectStore('app_state', { keyPath: 'key' });
      }

      // V2: Collections
      if (!db.objectStoreNames.contains('collections')) {
        db.createObjectStore('collections', { keyPath: 'id' });
      }
      // V2: Saved Requests
      if (!db.objectStoreNames.contains('saved_requests')) {
        db.createObjectStore('saved_requests', { keyPath: 'id' });
      }
    };
  });
};

export const dbService = {
  // Get all items from a store
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Save an entire array of items to a store (replaces content)
  async saveAll(storeName: string, items: any[]) {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      // Clear existing data to ensure store matches state exactly (handling deletions)
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        items.forEach(item => store.put(item));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Add or Update a single item
  async put(storeName: string, item: any) {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(storeName: string, id: string) {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Helper for single key-value state (e.g. activeWorkspaceId)
  async setAppState(key: string, value: any) {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('app_state', 'readwrite');
      const store = tx.objectStore('app_state');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAppState<T>(key: string): Promise<T | null> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_state', 'readonly');
      const store = tx.objectStore('app_state');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  },
  
  async clearAppState(key: string) {
      const db = await initDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('app_state', 'readwrite');
        const store = tx.objectStore('app_state');
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
  }
};