/**
 * Gerenciador de Armazenamento e Snapshots do Painel de Validade
 *
 * - Salva até os últimos 10 snapshots com data, hora e autor
 * - Permite recuperar o snapshot ativo e reverter para snapshots anteriores
 * - Lê os produtos ativos do Encarte ("encarte-products-v2") para alimentar o pino "NO ENCARTE"
 */

import type {
  ValidadeSnapshot,
  ValidadeLoteCalculado,
  ValidadeLoteRaw,
} from "@/types/painel-validade";
import { processarListaLotes } from "./painel-validade-analytics";

export const SNAPSHOTS_STORAGE_KEY = "painel_validade_snapshots_v1";
export const ACTIVE_SNAPSHOT_ID_KEY = "painel_validade_active_snapshot_id_v1";
export const MAX_SNAPSHOTS = 10;

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memoryStorageInstance = new MemoryStorage();

export function getStorage(): Storage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined" && localStorage) {
    return localStorage;
  }
  return memoryStorageInstance;
}

/**
 * Lê os códigos de produtos atualmente incluídos no encarte ativo
 */
export function getActiveEncarteProductCodes(): Set<string> {
  const storage = getStorage();
  const codes = new Set<string>();
  if (!storage) return codes;

  try {
    const raw =
      storage.getItem("encarte-products-v2") ||
      storage.getItem("encarte-products");

    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.included !== false && item.code) {
            const cleanCode = String(item.code).trim();
            if (cleanCode) codes.add(cleanCode);
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro ao ler produtos do encarte ativo:", err);
  }

  return codes;
}

/**
 * Salva a lista de snapshots no storage local
 */
export function saveSnapshotsList(snapshots: ValidadeSnapshot[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    // Mantém no máximo os últimos MAX_SNAPSHOTS
    const trimmed = snapshots.slice(0, MAX_SNAPSHOTS);
    storage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Erro ao salvar snapshots de validade:", err);
  }
}

/**
 * Recupera todos os snapshots salvos
 */
export function loadSnapshotsList(): ValidadeSnapshot[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Erro ao carregar snapshots de validade:", err);
    return [];
  }
}

/**
 * Recupera o snapshot ativo no momento
 */
export function getActiveSnapshot(): ValidadeSnapshot | null {
  const snapshots = loadSnapshotsList();
  if (snapshots.length === 0) return null;

  const storage = getStorage();
  const activeId = storage?.getItem(ACTIVE_SNAPSHOT_ID_KEY);

  if (activeId) {
    const found = snapshots.find((s) => s.id === activeId);
    if (found) return found;
  }

  // Se não houver ID gravado ou não encontrado, retorna o mais recente (primeiro)
  return snapshots[0];
}

/**
 * Define qual snapshot é o ativo
 */
export function setActiveSnapshotId(id: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ACTIVE_SNAPSHOT_ID_KEY, id);
}

/**
 * Cria um novo snapshot a partir de lotes brutos e salva no histórico
 */
export function createSnapshotFromRaw(
  rawLotes: ValidadeLoteRaw[],
  nomeArquivo: string,
  importadoPor: string = "Equipe Interna",
  referenceDate: Date = new Date()
): ValidadeSnapshot {
  const existingSnapshots = loadSnapshotsList();
  const previousSnapshot = existingSnapshots[0];

  const previousBatchKeys = previousSnapshot
    ? new Set(previousSnapshot.lotes.map((l) => l.id))
    : undefined;

  const previousEncarteCodes = previousSnapshot
    ? new Set(previousSnapshot.lotes.filter((l) => l.noEncarte).map((l) => l.codprod))
    : undefined;

  const activeEncarteCodes = getActiveEncarteProductCodes();

  const lotesCalculados: ValidadeLoteCalculado[] = processarListaLotes(
    rawLotes,
    referenceDate,
    activeEncarteCodes,
    previousBatchKeys,
    previousEncarteCodes
  );

  const uniqueProductCodes = new Set(rawLotes.map((l) => l.codprod));

  const newSnapshot: ValidadeSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    criadoEm: new Date().toISOString(),
    importadoPor,
    nomeArquivo,
    totalLotes: lotesCalculados.length,
    totalProdutosUnicos: uniqueProductCodes.size,
    lotes: lotesCalculados,
    referenceDate: referenceDate.toISOString(),
  };

  // Insere no início do histórico e salva
  const updatedList = [newSnapshot, ...existingSnapshots].slice(0, MAX_SNAPSHOTS);
  saveSnapshotsList(updatedList);
  setActiveSnapshotId(newSnapshot.id);

  return newSnapshot;
}

/**
 * Recalcula o pino "NO ENCARTE" do snapshot ativo quando o encarte for salvo
 */
export function refreshEncartePinsOnActiveSnapshot(): ValidadeSnapshot | null {
  const active = getActiveSnapshot();
  if (!active) return null;

  const activeEncarteCodes = getActiveEncarteProductCodes();
  const updatedLotes = active.lotes.map((lote) => ({
    ...lote,
    noEncarte: activeEncarteCodes.has(lote.codprod),
  }));

  const updatedSnapshot: ValidadeSnapshot = {
    ...active,
    lotes: updatedLotes,
  };

  const all = loadSnapshotsList().map((s) =>
    s.id === updatedSnapshot.id ? updatedSnapshot : s
  );

  saveSnapshotsList(all);
  return updatedSnapshot;
}
