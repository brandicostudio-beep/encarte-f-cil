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