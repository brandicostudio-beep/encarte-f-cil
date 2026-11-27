import type { EncarteSemanalProduct } from "@/types/encarte-semanal";
import { resolveSemanalCellPhotos } from "./encarte-semanal-layout";

export function parseSemanalCodes(value: string): string[] {
  return [...new Set(value.split(/[\s/,;]+/).map(code => code.trim()).filter(Boolean))];
}

export function semanalCodes(product: EncarteSemanalProduct): string[] {
  return parseSemanalCodes([product.code, product.secondaryCode, ...(product.additionalProducts || []).map(p => p.code)].filter(Boolean).join(" / "));
}

export function semanalPhotos(product: EncarteSemanalProduct): string[] {
  const { photo1, photo2 } = resolveSemanalCellPhotos(product);
  return [photo1, photo2, ...(product.additionalProducts || []).map(p => p.image || "")].filter(Boolean);
}

export function semanalPhotoBounds(product: EncarteSemanalProduct, index: number, count: number, width: number, height: number, aspect: number) {
  const raw = product.scale ?? 1;
  const transform = product.photoTransforms?.[index];
  const scale = (raw > 10 ? raw / 100 : raw) * (transform?.scale ?? 1);
  const maxWidth = (width - 16) * (count === 1 ? 0.88 : Math.min(0.54, 1.08 / count)) * scale;
  const maxHeight = (height - 16) * scale;
  const w = Math.min(maxWidth, maxHeight * aspect);
  const h = w / aspect;
  const center = count === 1 ? width / 2 : 8 + (width - 16) * (index + 0.5) / count;
  return { x: center - w / 2 + (product.offsetX ?? 0) + (transform?.x ?? 0), y: height - h + (product.overlapY ?? 4) + (product.offsetY ?? 0) + (transform?.y ?? 0), width: w, height: h };
}

export interface SemanalTwoPhotoLayout {
  photo1: { x: number; y: number; width: number; height: number };
  photo2: { x: number; y: number; width: number; height: number };
}

/**
 * Calcula o layout proporcional, centralizado e com sobreposição natural para 2 fotos no mesmo box.
 * Compartilhado entre o preview (EncarteSemanalCell) e o exportador PNG (encarte-semanal-export).
 */
export function computeSemanalTwoPhotoLayout(params: {
  boxX?: number;
  boxWidth: number;
  photoAreaHeight: number;
  barY: number;
  aspect1: number;
  aspect2: number;
  scale1: number;
  scale2: number;
  overlapY?: number;
  offsetX1?: number;
  offsetY1?: number;
  offsetX2?: number;
  offsetY2?: number;
  overlapRatio?: number;
}): SemanalTwoPhotoLayout {
  const {
    boxX = 0,
    boxWidth,
    photoAreaHeight,
    barY,
    aspect1: rawAspect1,
    aspect2: rawAspect2,
    scale1: rawScale1,
    scale2: rawScale2,
    overlapY = 2,
    offsetX1 = 0,
    offsetY1 = 0,
    offsetX2 = 0,
    offsetY2 = 0,
    overlapRatio = 0.28,
  } = params;

  const aspect1 = rawAspect1 > 0 && isFinite(rawAspect1) ? rawAspect1 : 1;
  const aspect2 = rawAspect2 > 0 && isFinite(rawAspect2) ? rawAspect2 : aspect1;
  const s1 = rawScale1 > 10 ? rawScale1 / 100 : rawScale1 || 1;
  const s2 = rawScale2 > 10 ? rawScale2 / 100 : rawScale2 || s1;

  const availableW = Math.max(20, boxWidth - 16);
  const availableH = Math.max(20, photoAreaHeight - 14);

  const fitBaseSize = (aspect: number) => {
    const maxItemW = availableW * 0.62;
    const maxItemH = availableH * 0.94;
    let w = maxItemW;
    let h = w / aspect;
    if (h > maxItemH) {
      h = maxItemH;
      w = h * aspect;
    }
    return { w, h };
  };

  let base1 = fitBaseSize(aspect1);
  let base2 = fitBaseSize(aspect2);

  const baseOverlapPx = Math.min(base1.w, base2.w) * overlapRatio;
  let basePairW = base1.w + base2.w - baseOverlapPx;

  // Garante que na escala padrão (1.0) o par caiba perfeitamente no box com respiro
  const maxPairW = availableW * 0.96;
  if (basePairW > maxPairW && basePairW > 0) {
    const ratio = maxPairW / basePairW;
    base1 = { w: base1.w * ratio, h: base1.h * ratio };
    base2 = { w: base2.w * ratio, h: base2.h * ratio };
  }

  // Aplica o zoom individual livremente após o ajuste base, sem travar crescimento manual
  const size1 = { w: base1.w * s1, h: base1.h * s1 };
  const size2 = { w: base2.w * s2, h: base2.h * s2 };
  const overlapPx = Math.min(size1.w, size2.w) * overlapRatio;
  const pairW = size1.w + size2.w - overlapPx;

  const pairStartX = boxX + (boxWidth - pairW) / 2;

  return {
    photo1: {
      x: pairStartX + offsetX1,
      y: barY - size1.h + overlapY + offsetY1,
      width: size1.w,
      height: size1.h,
    },
    photo2: {
      x: pairStartX + pairW - size2.w + offsetX2,
      y: barY - size2.h + overlapY + offsetY2,
      width: size2.w,
      height: size2.h,
    },
  };
}

export interface SemanalHistory<T> { past: T[]; present: T; future: T[] }
export function changeSemanalHistory<T>(state: SemanalHistory<T>, next: T): SemanalHistory<T> {
  return { past: [...state.past.slice(-49), state.present], present: next, future: [] };
}
export function undoSemanalHistory<T>(state: SemanalHistory<T>): SemanalHistory<T> {
  const previous = state.past.at(-1);
  if (previous === undefined) return state;
  return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
}
export function redoSemanalHistory<T>(state: SemanalHistory<T>): SemanalHistory<T> {
  const next = state.future[0];
  if (next === undefined) return state;
  return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
}