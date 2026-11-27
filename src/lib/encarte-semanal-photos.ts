/**
 * Integração de Fotos para o Encarte Semanal.
 * Reaproveita rigorosamente matchPhotosWithProducts e as regras de sufixo de src/lib/photo-bank.ts.
 * Suporta Pasta Local do Computador, Upload de Imagens / ZIP e Google Drive.
 */

import type { EncarteSemanalProduct } from "@/types/encarte-semanal";
import type { EncarteProduct } from "@/types/encarte";
import {
  matchPhotosWithProducts,
  processPhotoBankUpload,
  type LoadedPhoto,
} from "./photo-bank";
import {
  getCachedPhoto,
  setCachedPhoto,
  isPhotoCacheValid,
} from "./drive-cache";
import { getActiveSnapshot, getActiveEncartePhotoMap } from "./painel-validade-storage";
import { getThumbnailFallbackUrl } from "./parse-product";
import {
  indexDriveFolder,
  downloadCampaignDrivePhotos,
} from "./product.functions";
import { fileToDataUrl, type LocalIndexedFile } from "./local-folder-service";
import { autoTrimImageWhitespace } from "./image-normalizer";

export async function trimEmptyMarginsSafe(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof window === "undefined" || typeof document === "undefined") return dataUrl;
  try {
    const res = await Promise.race([
      autoTrimImageWhitespace(dataUrl, 12),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    return res?.trimmedSrc || dataUrl;
  } catch {
    return dataUrl;
  }
}

export const OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_ID = "1E-MmRqMVnbm6LsOyV7Tc9E1crOhZTF5T";
export const OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1E-MmRqMVnbm6LsOyV7Tc9E1crOhZTF5T";

export interface LocalFolderPhotoStatus {
  connected: boolean;
  folderName: string;
  photoCount: number;
}

// Índice em memória da Pasta Local de Fotos conectada (Fotos_Palm) — Prioridade 1 absoluta
const localFolderPhotoMap = new Map<string, { dataUrl: string; suffixOrder: number; isPng: boolean }>();
const localFolderHandleMap = new Map<string, LocalIndexedFile>();
let localFolderNameState = "";
let localFolderTotalCount = 0;

/**
 * Registra os handles indexados da Pasta Local conectada para leitura sob demanda
 * mesmo quando a grade ainda está vazia (Modo Manual).
 */
export function registerLocalFolderHandles(
  files: LocalIndexedFile[],
  folderName = "Pasta Local"
): number {
  localFolderHandleMap.clear();
  localFolderNameState = folderName;
  localFolderTotalCount = files.length;

  for (const file of files) {
    if (!file.code || !file.handle) continue;
    const key = file.code.trim().toLowerCase();
    const isPng = /\.png$/i.test(file.name || "");
    const existing = localFolderHandleMap.get(key);
    const existingIsPng = existing ? /\.png$/i.test(existing.name || "") : false;

    if (
      !existing ||
      file.suffixOrder < existing.suffixOrder ||
      (file.suffixOrder === existing.suffixOrder && isPng && !existingIsPng)
    ) {
      localFolderHandleMap.set(key, file);
    }
  }

  return localFolderHandleMap.size;
}

/**
 * Lê sob demanda a foto original da Pasta Local conectada (preservando transparência PNG sem recomprimir em JPEG).
 */
export async function fetchLocalFolderHandlePhotoForCode(code: string): Promise<string | undefined> {
  const existing = getLocalFolderPhotoForCode(code);
  if (existing) return existing;

  if (!code || localFolderHandleMap.size === 0) return undefined;
  const clean = code.trim().toLowerCase();
  const stripped = /^\d+$/.test(clean) ? String(parseInt(clean, 10)) : clean;
  const fileEntry = localFolderHandleMap.get(clean) || localFolderHandleMap.get(stripped);
  if (!fileEntry?.handle?.getFile) return undefined;

  try {
    const fileObj: File = await fileEntry.handle.getFile();
    const rawDataUrl = await fileToDataUrl(fileObj);
    if (rawDataUrl) {
      const dataUrl = await trimEmptyMarginsSafe(rawDataUrl);
      localFolderPhotoMap.set(clean, {
        dataUrl,
        suffixOrder: fileEntry.suffixOrder ?? 0,
        isPng: /\.png$/i.test(fileEntry.name || ""),
      });
      return dataUrl;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Registra fotos indexadas da Pasta Local conectada (Fotos_Palm) para resolução instantânea com Prioridade 1.
 */
export function registerLocalFolderPhotos(
  photos: LoadedPhoto[],
  folderName = "Pasta Local"
): number {
  localFolderPhotoMap.clear();
  localFolderNameState = folderName;
  localFolderTotalCount = photos.length;

  for (const photo of photos) {
    if (!photo.code || !photo.dataUrl) continue;
    const key = photo.code.trim().toLowerCase();
    const suffixOrder = photo.suffixOrder ?? 0;
    const isPng = /\.png$/i.test(photo.filename || "");
    const existing = localFolderPhotoMap.get(key);

    // Mantém a foto de menor sufixo ou preferência para PNG transparente
    const shouldReplace =
      !existing ||
      suffixOrder < existing.suffixOrder ||
      (suffixOrder === existing.suffixOrder && isPng && !existing.isPng);

    if (shouldReplace) {
      localFolderPhotoMap.set(key, {
        dataUrl: photo.dataUrl,
        suffixOrder,
        isPng,
      });
    }
  }

  return localFolderPhotoMap.size;
}

/**
 * Retorna a foto da Pasta Local conectada para um código (Prioridade 1).
 */
export function getLocalFolderPhotoForCode(code: string): string | undefined {
  if (!code || localFolderPhotoMap.size === 0) return undefined;
  const clean = code.trim().toLowerCase();
  const exact = localFolderPhotoMap.get(clean);
  if (exact?.dataUrl) return exact.dataUrl;

  // Fallback removendo zeros à esquerda se for numérico
  if (/^\d+$/.test(clean)) {
    const stripped = String(parseInt(clean, 10));
    const alt = localFolderPhotoMap.get(stripped);
    if (alt?.dataUrl) return alt.dataUrl;
  }

  return undefined;
}

/**
 * Retorna o status atual da Pasta Local de Fotos conectada.
 */
export function getLocalFolderStatus(): LocalFolderPhotoStatus {
  return {
    connected: localFolderTotalCount > 0 || localFolderPhotoMap.size > 0,
    folderName: localFolderNameState,
    photoCount: localFolderTotalCount || localFolderPhotoMap.size,
  };
}

/**
 * Limpa o índice da Pasta Local de Fotos conectada (útil para testes e reset).
 */
export function clearLocalFolderPhotos(): void {
  localFolderPhotoMap.clear();
  localFolderHandleMap.clear();
  localFolderNameState = "";
  localFolderTotalCount = 0;
}

/**
 * Copia o código do produto para a Área de Transferência com fallback seguro via document.execCommand('copy').
 */
export async function copyProductCodeToClipboard(code?: string | null): Promise<boolean> {
  const clean = (code || "").trim();
  if (!clean) return false;

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(clean);
      return true;
    }
  } catch {
    // Fallback para execCommand abaixo
  }

  try {
    if (typeof document !== "undefined" && document.body) {
      const textarea = document.createElement("textarea");
      textarea.value = clean;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
      document.body.removeChild(textarea);
      return ok;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Associa as fotos carregadas aos produtos do Encarte Semanal.
 * Aplica a regra de sufixos de photo-bank.ts:
 * - Menor sufixo (ex: 24657.jpg ou 24657-1.jpg) vira a foto principal.
 * - As demais viram fotos alternativas.
 */
export function matchPhotosWithSemanalProducts(
  loadedPhotos: LoadedPhoto[],
  products: EncarteSemanalProduct[],
  defaultSource: "drive" | "zip" | "upload" | "folder" = "upload"
): {
  updatedProducts: EncarteSemanalProduct[];
  matchedCount: number;
  unmatchedPhotos: string[];
} {
  // Converte temporariamente para o formato EncarteProduct esperado por matchPhotosWithProducts
  const tempEncarteProducts: EncarteProduct[] = products.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
    image: p.image || "",
    name: p.description,
    packaging: "", validity: "", price: "", badge: "nenhum",
    unit: "UN",
    included: p.included !== false,
  }));

  const matchResult = matchPhotosWithProducts(
    loadedPhotos,
    tempEncarteProducts,
    defaultSource === "folder" ? "upload" : defaultSource
  );

  // Mapeia de volta para EncarteSemanalProduct mantendo customizações
  const updatedProducts = products.map((product, idx) => {
    const updated = matchResult.updatedProducts[idx];
    if (updated && updated.image && updated.image.trim() !== "") {
      const alternatives = (updated.alternativePhotos || []).filter(alt => Boolean(alt.dataUrl)).map((alt) => ({
        filename: alt.filename,
        dataUrl: alt.dataUrl || "",
        source: alt.source || defaultSource,
      }));

      return {
        ...product,
        image: updated.image,
        alternativePhotos: alternatives.length > 0 ? alternatives : undefined,
      };
    }
    return product;
  });

  return {
    updatedProducts,
    matchedCount: matchResult.matchedCount,
    unmatchedPhotos: matchResult.unmatchedPhotos,
  };
}

/**
 * Tenta encontrar automaticamente uma foto para o código seguindo a ordem estrita de prioridade:
 * 1. (Máxima) Pasta Local conectada (Fotos_Palm)
 * 2. Fotos do Acompanhamento de Validade / mapa de encartes salvos
 * 3. Cache local do Google Drive
 * 4. (Último recurso) Fallback Cescom AgileCDN (https://cescom.agilecdn.com.br/{code}_thumb_1.jpg)
 */
export function findKnownPhotoForCode(code: string): string | undefined {
  const priorityPhoto = findLocalOrCachedPhotoForCode(code);
  if (priorityPhoto) return priorityPhoto;

  if (!code) return undefined;
  const cleanCode = code.trim();

  // 4. Último recurso: Fallback direto do AgileCDN Cescom
  try {
    const cdnUrl = getThumbnailFallbackUrl(cleanCode);
    if (cdnUrl) return cdnUrl;
  } catch {}

  return undefined;
}

/**
 * Busca foto apenas nas prioridades locais/Drive (Pasta Local > Drive Cache > Validade/Encartes sem CDN branco),
 * sem recorrer ao fallback externo da Cescom.
 */
export function findLocalOrCachedPhotoForCode(code: string): string | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim();
  const cleanLower = cleanCode.toLowerCase();
  const normalizedNum = /^\d+$/.test(cleanCode) ? String(parseInt(cleanCode, 10)) : cleanCode;

  // 1. Prioridade Máxima: Pasta Local conectada (Fotos_Palm)
  const localPhoto = getLocalFolderPhotoForCode(cleanCode);
  if (localPhoto && localPhoto.trim()) {
    return localPhoto.trim();
  }

  // 2. Cache do Google Drive (PNGs baixados da pasta oficial FOTOS PALM CESCOM)
  try {
    const cached = getCachedPhoto(cleanCode) || getCachedPhoto(normalizedNum);
    if (cached && cached.dataUrl) return cached.dataUrl;
  } catch {
    /* ignore */
  }

  // 3. Fotos do Acompanhamento de Validade / mapa de encartes salvos (ignora URLs de fundo branco da Cescom)
  try {
    const encarteMap = getActiveEncartePhotoMap();
    const encartePhoto = encarteMap.get(cleanCode) || encarteMap.get(normalizedNum);
    if (
      encartePhoto &&
      encartePhoto.trim() &&
      !encartePhoto.includes("agilecdn.com.br") &&
      !encartePhoto.includes("cescom.com.br")
    ) {
      return encartePhoto.trim();
    }
  } catch (err) {
    console.warn("Aviso ao resolver foto pelo mapa de encartes:", err);
  }

  try {
    const snapshot = getActiveSnapshot();
    if (snapshot && snapshot.lotes) {
      const found = snapshot.lotes.find(
        (l) => l.codprod && l.codprod.trim().toLowerCase() === cleanLower
      );
      if (
        found &&
        found.foto &&
        !found.foto.includes("agilecdn.com.br") &&
        !found.foto.includes("cescom.com.br")
      ) {
        return found.foto;
      }
    }
  } catch {
    /* ignore */
  }

  return undefined;
}

/**
 * Resolve a melhor foto disponível garantindo que a Pasta Local (e caches locais) tenham
 * prioridade absoluta sobre a imagem retornada online pelo site da Cescom.
 */
export function resolveBestPhotoForCode(
  code: string,
  onlineImage?: string
): string | undefined {
  const localOrCached = findLocalOrCachedPhotoForCode(code);
  if (localOrCached) return localOrCached;
  if (onlineImage && onlineImage.trim()) return onlineImage.trim();
  return findKnownPhotoForCode(code);
}

export interface SyncDrivePhotosResult {
  ok: boolean;
  photoByCode: Map<string, string>;
  downloadedCount: number;
  cachedHitsCount: number;
  error?: string;
  errorCode?: string;
}

/**
 * Sincroniza fotos de uma pasta do Google Drive (padrão: FOTOS PALM CESCOM) para os códigos informados,
 * salvando cada foto baixada no cache local (setCachedPhoto) para carregamento instantâneo futuro.
 */
export async function syncSemanalPhotosFromDriveFolder(params: {
  url?: string;
  codes: string[];
}): Promise<SyncDrivePhotosResult> {
  const folderUrl = (params.url || OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_URL).trim();
  const cleanCodes = Array.from(
    new Set(params.codes.map((c) => c.trim()).filter(Boolean))
  );
  const photoByCode = new Map<string, string>();
  let cachedHitsCount = 0;
  let downloadedCount = 0;

  if (cleanCodes.length === 0) {
    return { ok: true, photoByCode, downloadedCount: 0, cachedHitsCount: 0 };
  }

  try {
    const indexRes = await indexDriveFolder({
      data: {
        url: folderUrl,
        knownCodes: cleanCodes,
      },
    });

    if (!indexRes || !indexRes.ok) {
      return {
        ok: false,
        photoByCode,
        downloadedCount: 0,
        cachedHitsCount: 0,
        error:
          (indexRes as { errorMessage?: string; error?: string })?.errorMessage ||
          (indexRes as { error?: string })?.error ||
          "Não foi possível acessar a pasta do Google Drive.",
        errorCode: (indexRes as { errorCode?: string })?.errorCode,
      };
    }

    const wantedSet = new Set<string>();
    for (const c of cleanCodes) {
      const lower = c.toLowerCase();
      wantedSet.add(lower);
      if (/^\d+$/.test(lower)) {
        wantedSet.add(String(parseInt(lower, 10)));
      }
    }
    const bestByCode = new Map<
      string,
      { id: string; code: string; filename: string; modifiedTime?: string; suffixOrder: number }
    >();

    for (const item of indexRes.indexedPhotos || []) {
      const codeLower = (item.code || "").trim().toLowerCase();
      const codeStripped = /^\d+$/.test(codeLower) ? String(parseInt(codeLower, 10)) : codeLower;
      if (!codeLower || (!wantedSet.has(codeLower) && !wantedSet.has(codeStripped))) continue;
      const targetKey = wantedSet.has(codeLower) ? codeLower : codeStripped;
      const existing = bestByCode.get(targetKey);
      const itemOrder = item.suffixOrder ?? 0;
      const isPng = /\.png$/i.test(item.filename || "");
      const existingIsPng = existing ? /\.png$/i.test(existing.filename || "") : false;

      if (
        !existing ||
        itemOrder < existing.suffixOrder ||
        (itemOrder === existing.suffixOrder && isPng && !existingIsPng)
      ) {
        bestByCode.set(targetKey, {
          id: item.id,
          code: item.code.trim(),
          filename: item.filename,
          modifiedTime: item.modifiedTime,
          suffixOrder: itemOrder,
        });
      }
    }

    const itemsToDownload: Array<{
      id: string;
      code: string;
      filename: string;
      modifiedTime?: string;
      isPrimary?: boolean;
    }> = [];

    for (const [, item] of bestByCode.entries()) {
      if (isPhotoCacheValid(item.code, item.id, item.modifiedTime)) {
        const cached = getCachedPhoto(item.code);
        if (cached?.dataUrl) {
          photoByCode.set(item.code.toLowerCase(), cached.dataUrl);
          cachedHitsCount++;
          continue;
        }
      }
      itemsToDownload.push({
        id: item.id,
        code: item.code,
        filename: item.filename,
        modifiedTime: item.modifiedTime,
        isPrimary: true,
      });
    }

    if (itemsToDownload.length > 0) {
      const dlRes = await downloadCampaignDrivePhotos({
        data: { items: itemsToDownload },
      });

      if (dlRes && dlRes.ok && Array.isArray(dlRes.photos)) {
        for (const p of dlRes.photos) {
          if (!p.code || !p.dataUrl) continue;
          const trimmedDataUrl = await trimEmptyMarginsSafe(p.dataUrl);
          setCachedPhoto({
            code: p.code,
            fileId: p.fileId,
            filename: p.filename,
            modifiedTime: p.modifiedTime,
            dataUrl: trimmedDataUrl,
            cachedAt: Date.now(),
          });
          photoByCode.set(p.code.trim().toLowerCase(), trimmedDataUrl);
          downloadedCount++;
        }
      }
    }

    return {
      ok: true,
      photoByCode,
      downloadedCount,
      cachedHitsCount,
    };
  } catch (err: any) {
    return {
      ok: false,
      photoByCode,
      downloadedCount: 0,
      cachedHitsCount: 0,
      error: err?.message || "Erro ao sincronizar pasta do Google Drive.",
    };
  }
}

/**
 * Busca dinamicamente a foto de um único código na pasta oficial do Google Drive (FOTOS PALM CESCOM)
 * quando não encontrada no cache local, salvando no cache (setCachedPhoto) após baixar.
 */
export async function fetchSingleDrivePhotoForCode(
  code: string,
  folderUrl = OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_URL
): Promise<string | undefined> {
  const clean = (code || "").trim();
  if (!clean) return undefined;

  const localOrCached = findLocalOrCachedPhotoForCode(clean);
  if (localOrCached) return localOrCached;

  const res = await syncSemanalPhotosFromDriveFolder({
    url: folderUrl,
    codes: [clean],
  });
  if (res.ok) {
    return res.photoByCode.get(clean.toLowerCase());
  }
  return undefined;
}

/**
 * Puxa automaticamente as fotos para todos os produtos que ainda não possuem foto,
 * utilizando o mesmo sistema do acompanhamento de validade.
 */
export function autoResolvePhotosForSemanalProducts(products: EncarteSemanalProduct[]): {
  updatedProducts: EncarteSemanalProduct[];
  resolvedCount: number;
} {
  let resolvedCount = 0;
  const updatedProducts = products.map((prod) => {
    if (prod.image && prod.image.trim()) {
      return prod;
    }

    const photo = findKnownPhotoForCode(prod.code);
    if (photo && photo.trim()) {
      resolvedCount++;
      return {
        ...prod,
        image: photo.trim(),
      };
    }
    return prod;
  });

  return {
    updatedProducts,
    resolvedCount,
  };
}

export { processPhotoBankUpload };
