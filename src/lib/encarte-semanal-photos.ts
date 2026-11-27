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
import { getCachedPhoto } from "./drive-cache";
import { getActiveSnapshot, getActiveEncartePhotoMap } from "./painel-validade-storage";
import { getThumbnailFallbackUrl } from "./parse-product";

export interface LocalFolderPhotoStatus {
  connected: boolean;
  folderName: string;
  photoCount: number;
}

// Índice em memória da Pasta Local de Fotos conectada (Fotos_Palm) — Prioridade 1 absoluta
const localFolderPhotoMap = new Map<string, { dataUrl: string; suffixOrder: number; isPng: boolean }>();
let localFolderNameState = "";
let localFolderTotalCount = 0;

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
 * Busca foto apenas nas prioridades 1 a 3 (Pasta Local > Validade/Encartes > Drive Cache),
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

  // 2. Fotos do Acompanhamento de Validade / mapa de encartes salvos
  try {
    const encarteMap = getActiveEncartePhotoMap();
    const encartePhoto = encarteMap.get(cleanCode) || encarteMap.get(normalizedNum);
    if (encartePhoto && encartePhoto.trim()) {
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
      if (found && found.foto && !found.foto.includes("agilecdn.com.br")) {
        return found.foto;
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Cache do Google Drive
  try {
    const cached = getCachedPhoto(cleanCode) || getCachedPhoto(normalizedNum);
    if (cached && cached.dataUrl) return cached.dataUrl;
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
