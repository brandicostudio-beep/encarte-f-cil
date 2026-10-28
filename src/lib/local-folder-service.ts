import type { EncarteProduct } from "@/types/encarte";
import { optimizeDataUrl } from "./image-normalizer";
import type { LoadedPhoto } from "./photo-bank";

export const SUPPORTED_LOCAL_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export interface LocalIndexedFile {
  name: string;
  handle: any; // FileSystemFileHandle
  relativePath: string;
  code: string;
  suffixOrder: number;
  suffixLabel: string;
  size?: number;
}

export interface LocalFolderScanProgress {
  scannedFiles: number;
  imagesFound: number;
  currentSubfolder?: string;
}

export interface LocalFolderLoadProgress {
  loaded: number;
  total: number;
  currentFile?: string;
}

export interface LocalFolderIndexResult {
  folderName: string;
  totalImagesRead: number;
  subfolderCount: number;
  files: LocalIndexedFile[];
}

export interface LocalFolderCrossingResult {
  folderName: string;
  totalImagesRead: number;
  matchedProductsCount: number;
  missingProducts: { code: string; name: string }[];
  unmatchedFilesCount: number;
  unmatchedFileNames: string[];
  matchesByProductCode: Map<string, LocalIndexedFile[]>;
}

/**
 * Verifica se a API File System Access (showDirectoryPicker) é suportada pelo navegador atual.
 * Chrome e Edge suportam nativamente. Firefox e Safari não suportam nativamente.
 */
export function isFileSystemAccessSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as any).showDirectoryPicker === "function";
}

/**
 * Valida correspondência de um arquivo de foto com o código de produto.
 * 
 * Regras obrigatórias:
 * 1. O nome do arquivo sem extensão deve ser igual ao código do produto (ex.: 14512.png → código 14512).
 * 2. Aceita sufixos após hífen ou underline (ex.: 24657-1.jpg e 24657_2.jpg para o código 24657).
 * 3. Quando houver mais de um arquivo para o mesmo código, usar o de menor sufixo (ou sem sufixo) como principal e os demais como alternativas.
 * 4. Não usar correspondência parcial: 221.png NÃO deve casar com 14221.png nem vice-versa.
 * 5. Códigos com zeros à esquerda devem ser tratados como texto, para que 0221 e 221 não se confundam.
 * 6. Extensões em maiúsculas (ex.: .PNG) são aceitas.
 */
export function matchPhotoFilenameWithCode(
  filename: string,
  targetCode: string
): { matches: boolean; suffixOrder: number; suffixLabel: string } | null {
  if (!filename || !targetCode) return null;

  const basename = filename.split("/").pop()?.split("\\").pop() || filename;
  if (!SUPPORTED_LOCAL_EXTENSIONS.test(basename)) {
    return null;
  }

  const cleanBase = basename.replace(SUPPORTED_LOCAL_EXTENSIONS, "").trim();
  const c = String(targetCode).trim();
  if (!cleanBase || !c) return null;

  // 1. Correspondência exata (zeros à esquerda preservados como texto)
  if (cleanBase.toLowerCase() === c.toLowerCase()) {
    return { matches: true, suffixOrder: 0, suffixLabel: "" };
  }

  // 2. Correspondência com sufixo (apenas se precedido de delimitador válido: hífen, underline, espaço ou parênteses)
  if (cleanBase.toLowerCase().startsWith(c.toLowerCase())) {
    const remainder = cleanBase.slice(c.length);
    const delimMatch = remainder.match(/^([-_ ]|\()/);
    if (delimMatch) {
      // Ex.: "-1", "_2", " (1)"
      const numMatch = remainder.match(/^[-_ ]?\(?(\d+)\)?$/);
      if (numMatch) {
        const num = parseInt(numMatch[1] ?? "0", 10);
        return {
          matches: true,
          suffixOrder: isNaN(num) ? 50 : num,
          suffixLabel: remainder,
        };
      }
      return {
        matches: true,
        suffixOrder: 100,
        suffixLabel: remainder,
      };
    }
  }

  return null;
}

/**
 * Extrai o código candidato e o sufixo de um arquivo para indexação rápida.
 */
export function parseFilenameForFolderIndex(
  filename: string,
  knownCodes: string[] = []
): { code: string; suffixOrder: number; suffixLabel: string } | null {
  if (!filename) return null;
  const basename = filename.split("/").pop()?.split("\\").pop() || filename;

  if (!SUPPORTED_LOCAL_EXTENSIONS.test(basename)) {
    return null;
  }

  const cleanBase = basename.replace(SUPPORTED_LOCAL_EXTENSIONS, "").trim();
  if (!cleanBase) return null;

  // Se tivermos os códigos da campanha, testa contra eles primeiro (ordem decrescente de tamanho)
  if (knownCodes && knownCodes.length > 0) {
    const sorted = [...knownCodes].sort((a, b) => b.length - a.length);
    for (const c of sorted) {
      const match = matchPhotoFilenameWithCode(basename, c);
      if (match?.matches) {
        return {
          code: c,
          suffixOrder: match.suffixOrder,
          suffixLabel: match.suffixLabel,
        };
      }
    }
  }

  // Heurística genérica de extração para arquivos sem códigos prévios:
  // "24657.jpg" -> "24657", order 0
  // "24657-1.jpg" -> "24657", order 1
  // "0221_frente.png" -> "0221", order 100
  const heuristicMatch = cleanBase.match(/^([a-zA-Z0-9]+)(?:(?:[-_ ]|\()(\d+)\)?|[-_ ](.+))?$/);
  if (heuristicMatch) {
    const code = heuristicMatch[1] ?? "";
    if (heuristicMatch[2]) {
      const num = parseInt(heuristicMatch[2], 10);
      return {
        code,
        suffixOrder: isNaN(num) ? 50 : num,
        suffixLabel: cleanBase.slice(code.length),
      };
    }
    if (heuristicMatch[3]) {
      return {
        code,
        suffixOrder: 100,
        suffixLabel: cleanBase.slice(code.length),
      };
    }
    return { code, suffixOrder: 0, suffixLabel: "" };
  }

  return { code: cleanBase, suffixOrder: 0, suffixLabel: "" };
}

/**
 * Converte um arquivo File em Data URL.
 */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  // Fallback seguro para ambientes sem FileReader (Bun / Node / Testes)
  const buffer = await file.arrayBuffer();
  let base64 = "";
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(buffer).toString("base64");
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    base64 = btoa(binary);
  }
  const type = file.type || "image/jpeg";
  return `data:${type};base64,${base64}`;
}

/**
 * Escaneia a pasta local de forma recursiva apenas lendo nomes e metadados,
 * sem carregar o conteúdo de 6.000 fotos na memória.
 */
export async function indexLocalFolder(
  dirHandle: any, // FileSystemDirectoryHandle
  options: {
    onProgress?: (progress: LocalFolderScanProgress) => void;
    signal?: AbortSignal;
    knownCodes?: string[];
  } = {}
): Promise<LocalFolderIndexResult> {
  const { onProgress, signal, knownCodes = [] } = options;
  const files: LocalIndexedFile[] = [];
  let scannedFiles = 0;
  let subfolderCount = 0;

  async function traverse(currentHandle: any, currentPath: string) {
    if (signal?.aborted) return;

    let entriesIterable: any = null;
    if (typeof currentHandle.values === "function") {
      entriesIterable = currentHandle.values();
    } else if (typeof currentHandle.entries === "function") {
      // Fallback para iteradores de chave-valor
      const entries = currentHandle.entries();
      entriesIterable = {
        async *[Symbol.asyncIterator]() {
          for await (const [, handle] of entries) {
            yield handle;
          }
        },
      };
    }

    if (!entriesIterable) return;

    for await (const handle of entriesIterable) {
      if (signal?.aborted) break;

      if (handle.kind === "file") {
        scannedFiles++;
        const name = handle.name;
        if (SUPPORTED_LOCAL_EXTENSIONS.test(name)) {
          const parsed = parseFilenameForFolderIndex(name, knownCodes);
          if (parsed) {
            files.push({
              name,
              handle,
              relativePath: currentPath ? `${currentPath}/${name}` : name,
              code: parsed.code,
              suffixOrder: parsed.suffixOrder,
              suffixLabel: parsed.suffixLabel,
            });
          }
        }

        if (scannedFiles % 50 === 0 && onProgress) {
          onProgress({
            scannedFiles,
            imagesFound: files.length,
            currentSubfolder: currentPath || undefined,
          });
        }
      } else if (handle.kind === "directory") {
        // Ignora pastas de sistema / controle de versão para máxima velocidade
        const dirName = handle.name;
        if (
          dirName.startsWith(".") ||
          dirName === "node_modules" ||
          dirName === "$RECYCLE.BIN"
        ) {
          continue;
        }

        subfolderCount++;
        const subPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        if (onProgress) {
          onProgress({
            scannedFiles,
            imagesFound: files.length,
            currentSubfolder: subPath,
          });
        }
        await traverse(handle, subPath);
      }
    }
  }

  await traverse(dirHandle, "");

  if (onProgress) {
    onProgress({
      scannedFiles,
      imagesFound: files.length,
    });
  }

  return {
    folderName: dirHandle.name || "Pasta de Fotos",
    totalImagesRead: files.length,
    subfolderCount,
    files,
  };
}

/**
 * Cruza os arquivos indexados com a lista de produtos da campanha.
 */
export function crossLocalFolderWithCampaign(
  indexedFiles: LocalIndexedFile[],
  products: EncarteProduct[]
): LocalFolderCrossingResult {
  const matchesByProductCode = new Map<string, LocalIndexedFile[]>();
  const productCodes = products.map((p) => p.code);
  const matchedCodes = new Set<string>();
  const matchedFilenames = new Set<string>();

  // Para cada produto, encontra arquivos correspondentes pelas regras estritas
  for (const prod of products) {
    const code = prod.code;
    const matching: LocalIndexedFile[] = [];

    for (const file of indexedFiles) {
      const match = matchPhotoFilenameWithCode(file.name, code);
      if (match?.matches) {
        matching.push({
          ...file,
          code,
          suffixOrder: match.suffixOrder,
          suffixLabel: match.suffixLabel,
        });
        matchedFilenames.add(file.name);
      }
    }

    if (matching.length > 0) {
      // Ordena por menor suffixOrder (0 sem sufixo primeiro, depois 1, 2...), e desempate alfabético
      matching.sort((a, b) => {
        if (a.suffixOrder !== b.suffixOrder) {
          return a.suffixOrder - b.suffixOrder;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

      matchesByProductCode.set(code.toLowerCase().trim(), matching);
      matchedCodes.add(code.toLowerCase().trim());
    }
  }

  // Identifica produtos sem foto
  const missingProducts: { code: string; name: string }[] = [];
  for (const prod of products) {
    if (!matchedCodes.has(prod.code.toLowerCase().trim())) {
      missingProducts.push({
        code: prod.code,
        name: prod.name,
      });
    }
  }

  // Identifica arquivos que não correspondem a nenhum código da campanha
  const unmatchedFileNames: string[] = [];
  for (const file of indexedFiles) {
    if (!matchedFilenames.has(file.name)) {
      unmatchedFileNames.push(file.name);
    }
  }

  return {
    folderName: "Pasta do Computador",
    totalImagesRead: indexedFiles.length,
    matchedProductsCount: matchedCodes.size,
    missingProducts,
    unmatchedFilesCount: unmatchedFileNames.length,
    unmatchedFileNames,
    matchesByProductCode,
  };
}

/**
 * Carrega APENAS as fotos dos produtos da campanha a partir dos handles de arquivo,
 * ignorando as milhares de fotos não utilizadas.
 * Suporta cancelamento e retomada sem recarregar itens já salvos.
 */
export async function loadCampaignPhotosFromFolder(
  crossing: LocalFolderCrossingResult,
  products: EncarteProduct[],
  options: {
    onProgress?: (progress: LocalFolderLoadProgress) => void;
    signal?: AbortSignal;
    alreadyLoadedCodes?: Set<string>;
  } = {}
): Promise<{
  loadedPhotos: LoadedPhoto[];
  updatedProducts: EncarteProduct[];
}> {
  const { onProgress, signal, alreadyLoadedCodes = new Set<string>() } = options;
  const loadedPhotos: LoadedPhoto[] = [];

  // Calcular itens a carregar (produtos com correspondência que ainda não foram carregados)
  const tasksToRun: {
    product: EncarteProduct;
    primaryFile: LocalIndexedFile;
    alternativeFiles: LocalIndexedFile[];
  }[] = [];

  for (const prod of products) {
    const key = prod.code.toLowerCase().trim();
    if (alreadyLoadedCodes.has(key)) continue;

    const files = crossing.matchesByProductCode.get(key);
    if (files && files.length > 0) {
      tasksToRun.push({
        product: prod,
        primaryFile: files[0]!,
        alternativeFiles: files.slice(1),
      });
    }
  }

  const total = tasksToRun.length;
  let loaded = 0;

  for (const task of tasksToRun) {
    if (signal?.aborted) break;

    try {
      if (onProgress) {
        onProgress({
          loaded,
          total,
          currentFile: task.primaryFile.name,
        });
      }

      // Lê o arquivo principal do produto
      const fileObj: File = await task.primaryFile.handle.getFile();
      const rawDataUrl = await fileToDataUrl(fileObj);
      const dataUrl = await optimizeDataUrl(rawDataUrl);

      loadedPhotos.push({
        filename: task.primaryFile.name,
        dataUrl,
        extractedCode: task.product.code,
        isPrimary: true,
        source: "folder",
      });

      // Se houver fotos alternativas para o mesmo código, lê também para permitir troca
      for (const altFile of task.alternativeFiles) {
        if (signal?.aborted) break;
        try {
          const altFileObj: File = await altFile.handle.getFile();
          const altRaw = await fileToDataUrl(altFileObj);
          const altDataUrl = await optimizeDataUrl(altRaw);
          loadedPhotos.push({
            filename: altFile.name,
            dataUrl: altDataUrl,
            extractedCode: task.product.code,
            isPrimary: false,
            source: "folder",
          });
        } catch (err) {
          console.warn(`Aviso ao ler foto alternativa ${altFile.name}:`, err);
        }
      }

      loaded++;
    } catch (err) {
      console.warn(`Erro ao ler foto do produto ${task.product.code}:`, err);
    }
  }

  if (onProgress) {
    onProgress({
      loaded,
      total,
    });
  }

  // Agrupa fotos carregadas por código para atualizar os produtos da campanha
  const photosByCode = new Map<
    string,
    { primary: LoadedPhoto; alternatives: LoadedPhoto[] }
  >();

  for (const photo of loadedPhotos) {
    const key = photo.extractedCode.toLowerCase().trim();
    if (!photosByCode.has(key)) {
      photosByCode.set(key, { primary: photo, alternatives: [] });
    } else {
      const entry = photosByCode.get(key)!;
      if (photo.isPrimary && !entry.primary) {
        entry.primary = photo;
      } else {
        entry.alternatives.push(photo);
      }
    }
  }

  const updatedProducts = products.map((prod) => {
    const key = prod.code.toLowerCase().trim();
    const entry = photosByCode.get(key);
    if (entry && entry.primary) {
      const alts = entry.alternatives.map((alt) => ({
        id: alt.filename,
        filename: alt.filename,
        dataUrl: alt.dataUrl,
        isPrimary: false,
        source: "folder" as const,
      }));

      return {
        ...prod,
        image: entry.primary.dataUrl,
        photoSource: "folder" as const,
        photoOriginName: entry.primary.filename,
        alternativePhotos: alts.length > 0 ? alts : undefined,
      };
    }
    return prod;
  });

  return {
    loadedPhotos,
    updatedProducts,
  };
}

// ============================================================================
// Persistência do Handle da Pasta em IndexedDB
// ============================================================================

const IDB_FOLDER_DB = "encarte_local_folder_db";
const IDB_FOLDER_STORE = "folder_handles";
const IDB_FOLDER_KEY = "active_photo_bank_folder";

function openFolderIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_FOLDER_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_FOLDER_STORE)) {
          db.createObjectStore(IDB_FOLDER_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Salva o FileSystemDirectoryHandle no IndexedDB para persistência após recarregar a página.
 */
export async function saveFolderHandle(dirHandle: any): Promise<void> {
  try {
    const db = await openFolderIdb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_FOLDER_STORE, "readwrite");
        const store = tx.objectStore(IDB_FOLDER_STORE);
        store.put({
          id: IDB_FOLDER_KEY,
          handle: dirHandle,
          folderName: dirHandle.name || "Pasta de Fotos",
          savedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn("Aviso ao salvar handle da pasta no IndexedDB:", err);
  }
}

/**
 * Recupera o FileSystemDirectoryHandle persistido no IndexedDB.
 */
export async function getSavedFolderHandle(): Promise<{
  handle: any;
  folderName: string;
  savedAt: number;
} | null> {
  try {
    const db = await openFolderIdb();
    if (!db) return null;

    return await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_FOLDER_STORE, "readonly");
        const store = tx.objectStore(IDB_FOLDER_STORE);
        const req = store.get(IDB_FOLDER_KEY);
        req.onsuccess = () => {
          if (req.result && req.result.handle) {
            resolve({
              handle: req.result.handle,
              folderName: req.result.folderName || req.result.handle.name || "Pasta de Fotos",
              savedAt: req.result.savedAt || Date.now(),
            });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Remove o handle persistido no IndexedDB.
 */
export async function clearSavedFolderHandle(): Promise<void> {
  try {
    const db = await openFolderIdb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_FOLDER_STORE, "readwrite");
        const store = tx.objectStore(IDB_FOLDER_STORE);
        store.delete(IDB_FOLDER_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

/**
 * Verifica ou solicita permissão de leitura para o FileSystemDirectoryHandle.
 */
export async function verifyFolderPermission(
  handle: any,
  request = false
): Promise<"granted" | "prompt" | "denied"> {
  try {
    if (!handle || typeof handle.queryPermission !== "function") {
      return "denied";
    }
    const status = await handle.queryPermission({ mode: "read" });
    if (status === "granted") return "granted";

    if (request && typeof handle.requestPermission === "function") {
      const requested = await handle.requestPermission({ mode: "read" });
      return requested === "granted" ? "granted" : "denied";
    }

    return status === "prompt" ? "prompt" : "denied";
  } catch {
    return "denied";
  }
}
