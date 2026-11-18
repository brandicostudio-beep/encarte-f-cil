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
import { getActiveSnapshot } from "./painel-validade-storage";

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
    currentPrice: 0,
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
      const alternatives = (updated.alternativePhotos || []).map((alt) => ({
        filename: alt.filename,
        dataUrl: alt.dataUrl,
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
 * Tenta encontrar automaticamente uma foto para o código no cache local,
 * no snapshot ativo da Rotina 8230 ou nos projetos salvos.
 */
export function findKnownPhotoForCode(code: string): string | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim().toLowerCase();

  // 1. Tentar cache do Drive
  try {
    const cached = getCachedPhoto(cleanCode);
    if (cached && cached.dataUrl) return cached.dataUrl;
  } catch {
    /* ignore */
  }

  // 2. Tentar snapshot do painel de validade
  try {
    const snapshot = getActiveSnapshot();
    if (snapshot && snapshot.lotes) {
      const found = snapshot.lotes.find(
        (l) => l.codprod && l.codprod.trim().toLowerCase() === cleanCode
      );
      if (found && found.foto) return found.foto;
    }
  } catch {
    /* ignore */
  }

  return undefined;
}

export { processPhotoBankUpload };
