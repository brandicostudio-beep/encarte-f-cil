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
import { resolverFotoProduto } from "./painel-validade-analytics";
import { getThumbnailFallbackUrl } from "./parse-product";

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
 * Tenta encontrar automaticamente uma foto para o código usando
 * O MESMO SISTEMA DE RESOLUÇÃO DO ACOMPANHAMENTO DE VALIDADE INTERNO:
 * 1. resolverFotoProduto (com mapa de fotos do último encarte/editor)
 * 2. Cache local do Google Drive / Nuvem
 * 3. Snapshot ativo da Rotina 8230 (lote.foto)
 * 4. Fallback Cescom AgileCDN (https://cescom.agilecdn.com.br/{code}_thumb_1.jpg)
 */
export function findKnownPhotoForCode(code: string): string | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim();

  // 1. Usar a mesma resolução do Acompanhamento de Validade Interno
  try {
    const encarteMap = getActiveEncartePhotoMap();
    const resolved = resolverFotoProduto(cleanCode, undefined, encarteMap);
    if (resolved && resolved.trim()) {
      return resolved.trim();
    }
  } catch (err) {
    console.warn("Aviso ao resolver foto pelo painel de validade:", err);
  }

  // 2. Tentar snapshot do painel de validade (Rotina 8230)
  try {
    const snapshot = getActiveSnapshot();
    if (snapshot && snapshot.lotes) {
      const cleanLower = cleanCode.toLowerCase();
      const found = snapshot.lotes.find(
        (l) => l.codprod && l.codprod.trim().toLowerCase() === cleanLower
      );
      if (found && found.foto) return found.foto;
    }
  } catch {
    /* ignore */
  }

  // 3. Fallback do cache do Drive direto
  try {
    const cached = getCachedPhoto(cleanCode);
    if (cached && cached.dataUrl) return cached.dataUrl;
  } catch {
    /* ignore */
  }

  // 4. Fallback direto do AgileCDN Cescom
  try {
    const cdnUrl = getThumbnailFallbackUrl(cleanCode);
    if (cdnUrl) return cdnUrl;
  } catch {}

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
