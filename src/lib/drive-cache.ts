/**
 * Gerenciador de cache local de fotos baixadas do Google Drive / Nuvem Lovable.
 * Armazena fotos usando o código do produto como chave e valida a data de modificação (modifiedTime).
 */

export interface CachedDrivePhoto {
  code: string;
  fileId: string;
  modifiedTime: string;
  dataUrl: string;
  cachedAt: number;
  filename: string;
}

const CACHE_KEY_PREFIX = "encarte_drive_photo_v2_";
const CACHE_INDEX_KEY = "encarte_drive_photo_index_v2";

const memoryStorage = new Map<string, string>();

interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeLocalStorage(): SimpleStorage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: SimpleStorage }).localStorage) {
    return (globalThis as unknown as { localStorage: SimpleStorage }).localStorage;
  }
  return {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStorage.set(k, v);
    },
    removeItem: (k: string) => {
      memoryStorage.delete(k);
    },
  };
}

/**
 * Retorna o índice de códigos de produtos atualmente em cache.
 */
export function getCachedPhotoCodes(): string[] {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(CACHE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Busca uma foto em cache pelo código do produto.
 */
export function getCachedPhoto(code: string): CachedDrivePhoto | null {
  const ls = safeLocalStorage();
  if (!ls || !code) return null;
  try {
    const key = `${CACHE_KEY_PREFIX}${code.toLowerCase().trim()}`;
    const raw = ls.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedDrivePhoto;
  } catch {
    return null;
  }
}

/**
 * Salva uma foto em cache usando o código do produto como chave.
 */
export function setCachedPhoto(entry: CachedDrivePhoto): void {
  const ls = safeLocalStorage();
  if (!ls || !entry.code) return;
  try {
    const normCode = entry.code.toLowerCase().trim();
    const key = `${CACHE_KEY_PREFIX}${normCode}`;
    ls.setItem(key, JSON.stringify(entry));

    // Atualiza índice de chaves
    const codes = new Set(getCachedPhotoCodes());
    codes.add(normCode);
    ls.setItem(CACHE_INDEX_KEY, JSON.stringify(Array.from(codes)));
  } catch (err) {
    // Se estourar a cota de localStorage, limpa entradas mais antigas
    console.warn("Aviso ao salvar cache de foto:", err);
  }
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
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    const codes = getCachedPhotoCodes();
    for (const code of codes) {
      ls.removeItem(`${CACHE_KEY_PREFIX}${code}`);
    }
    ls.removeItem(CACHE_INDEX_KEY);
  } catch {
    // Silencioso
  }
}
