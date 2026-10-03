/**
 * VRMStorage: Robust client-side IndexedDB database for persistent 3D VRM models.
 * Ensures custom uploaded VRM models are stored permanently in the browser database
 * and never vanish after page reload or server restart.
 */

export interface SavedVRMRecord {
  id: string;
  name: string;
  blob: Blob;
  size: number;
  updatedAt: number;
}

const DB_NAME = 'AgentAvatarVRM_DB';
const DB_VERSION = 1;
const STORE_NAME = 'vrm_models';
const ACTIVE_KEY = 'active_model_id';

class VRMStorageManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB não está disponível neste navegador.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save or update a VRM model file in the local IndexedDB database.
   */
  public async saveModel(file: File | Blob, name: string): Promise<{ id: string; url: string }> {
    const db = await this.getDB();
    const id = `vrm_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const record: SavedVRMRecord = {
      id,
      name,
      blob: file,
      size: file.size,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const putReq = store.put(record);
      putReq.onsuccess = () => {
        // Save as active model ID in localStorage
        try {
          localStorage.setItem(ACTIVE_KEY, id);
        } catch {}

        const url = URL.createObjectURL(file);
        resolve({ id, url });
      };

      putReq.onerror = () => reject(putReq.error);
    });
  }

  /**
   * Get the currently active VRM model from IndexedDB.
   */
  public async getActiveModel(): Promise<{ id: string; name: string; url: string; size: number } | null> {
    try {
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const list = await this.listModels();
      if (list.length === 0) return null;

      const target = list.find((m) => m.id === activeId) || list[0];
      const model = await this.getModelById(target.id);
      if (!model) return null;

      const url = URL.createObjectURL(model.blob);
      return {
        id: model.id,
        name: model.name,
        url,
        size: model.size,
      };
    } catch (err) {
      console.warn('[VRMStorage] Erro ao recuperar modelo ativo:', err);
      return null;
    }
  }

  /**
   * List all stored VRM models.
   */
  public async listModels(): Promise<Array<{ id: string; name: string; size: number; updatedAt: number }>> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: SavedVRMRecord[] = req.result || [];
        const sorted = records
          .map((r) => ({
            id: r.id,
            name: r.name,
            size: r.size,
            updatedAt: r.updatedAt,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sorted);
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get a specific model by its ID.
   */
  public async getModelById(id: string): Promise<SavedVRMRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result || null);
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Set active model ID.
   */
  public async setActiveModelId(id: string): Promise<{ id: string; name: string; url: string } | null> {
    const model = await this.getModelById(id);
    if (!model) return null;

    localStorage.setItem(ACTIVE_KEY, id);
    const url = URL.createObjectURL(model.blob);
    return { id: model.id, name: model.name, url };
  }

  /**
   * Delete a stored VRM model from database.
   */
  public async deleteModel(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => {
        if (localStorage.getItem(ACTIVE_KEY) === id) {
          localStorage.removeItem(ACTIVE_KEY);
        }
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Reset / clear stored VRMs.
   */
  public async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        localStorage.removeItem(ACTIVE_KEY);
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }
}

export const vrmStorage = new VRMStorageManager();
