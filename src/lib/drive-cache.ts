/**
 * Gerenciador de cache local de fotos baixadas do Google Drive / Nuvem Lovable.
 * Armazena fotos em memória e IndexedDB para nunca esgotar a cota de 5MB do localStorage.
 * Valida a data de modificação (modifiedTime) e associa pelo código do produto.
 */

export interface CachedDrivePhoto {
  code: string;
  fileId: string;
  modifiedTime: string;
  dataUrl: string;
  cachedAt: number;
  filename: string;
}

const memoryPhotoCache = new Map<string, CachedDrivePhoto>();

const IDB_NAME = "encarte_drive_cache_db";
const IDB_STORE = "drive_photos";
const IDB_VERSION = 1;

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = idb.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "code" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

// Limpa chaves legadas pesadas do localStorage para liberar a cota de 5MB imediatamente
if (typeof window !== "undefined" && window.localStorage) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("encarte_drive_photo_v2_") || k === "encarte_drive_photo_index_v2")) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {}

  // Carrega do IndexedDB para a memória ao iniciar
  openIdb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          for (const item of req.result) {
            if (item && item.code) {
              memoryPhotoCache.set(item.code.toLowerCase().trim(), item);
            }
          }
        }
      };
    } catch {}
  });
}

/**
 * Retorna o índice de códigos de produtos atualmente em cache.
 */
export function getCachedPhotoCodes(): string[] {
  return Array.from(memoryPhotoCache.keys());
}

/**
 * Busca uma foto em cache pelo código do produto.
 */
export function getCachedPhoto(code: string): CachedDrivePhoto | null {
  if (!code) return null;
  const norm = code.toLowerCase().trim();
  return memoryPhotoCache.get(norm) ?? null;
}

/**
 * Salva uma foto em cache usando o código do produto como chave.
 */
export function setCachedPhoto(entry: CachedDrivePhoto): void {
  if (!entry || !entry.code) return;
  const norm = entry.code.toLowerCase().trim();
  memoryPhotoCache.set(norm, entry);

  // Persiste no IndexedDB de forma assíncrona sem tocar no localStorage
  openIdb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put({ ...entry, code: norm });
    } catch (err) {
      console.warn("Aviso ao persistir foto no IndexedDB:", err);
    }
  });
}

/**
 * Salva múltiplas fotos no cache.
 */
export function saveMultipleCachedPhotos(entries: CachedDrivePhoto[]): void {
  for (const entry of entries) {
    setCachedPhoto(entry);
  }
}

/**
 * Verifica se o cache para um produto é válido.
 * É válido se existir, tiver dataUrl e o modifiedTime bater com o metadado atual do Drive.
 */
export function isPhotoCacheValid(
  code: string,
  fileId: string,
  modifiedTime?: string
): boolean {
  const cached = getCachedPhoto(code);
  if (!cached || !cached.dataUrl) return false;
  if (cached.fileId !== fileId) return false;
  if (modifiedTime && cached.modifiedTime && cached.modifiedTime !== modifiedTime) {
    return false;
  }
  return true;
}

/**
 * Limpa todo o cache de fotos do Drive.
 */
export function clearDrivePhotoCache(): void {
  memoryPhotoCache.clear();

  // Limpa localStorage legado se houver
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith("encarte_drive_photo_v2_") || k === "encarte_drive_photo_index_v2")) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {}
  }

  // Limpa IndexedDB
  openIdb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
    } catch {}
  });
}
