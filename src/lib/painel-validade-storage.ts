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
import {
  processarListaLotes,
  normalizeProductCode,
  resolverFotoProduto,
} from "./painel-validade-analytics";
import { listProjectsLocal, loadProjectLocal } from "./project-indexeddb";

export const SNAPSHOTS_STORAGE_KEY = "painel_validade_snapshots_v1";
export const ACTIVE_SNAPSHOT_ID_KEY = "painel_validade_active_snapshot_id_v1";
export const LAST_PROJECT_CACHE_KEY = "painel_validade_last_project_cache_v1";
export const MAX_SNAPSHOTS = 10;

export interface ActiveEncarteInfo {
  codes: Set<string>;
  photoByCode: Map<string, string>;
  productNameByCode: Map<string, string>;
  sourceEncarteName?: string;
  sourceUpdatedAt?: string;
}

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
 * Salva cache compacto dos produtos do último projeto salvo
 */
export function saveLastProjectEncarteCache(project: {
  id: string;
  name?: string;
  updatedAt?: string;
  products?: Array<{
    code?: string | number;
    name?: string;
    image?: string;
    included?: boolean;
  }>;
}): void {
  const storage = getStorage();
  if (!storage || !project || !Array.isArray(project.products)) return;

  try {
    const compact = {
      id: project.id,
      name: project.name || "Último Encarte",
      updatedAt: project.updatedAt || new Date().toISOString(),
      products: project.products.map((p) => ({
        code: String(p?.code ?? ""),
        name: p?.name || "",
        image: p?.image || "",
        included: p?.included !== false,
      })),
    };
    storage.setItem(LAST_PROJECT_CACHE_KEY, JSON.stringify(compact));
  } catch (err) {
    console.warn("Aviso ao salvar cache do último encarte:", err);
  }
}

/**
 * Lê informações completas do último encarte feito:
 * 1. Produtos do encarte ativo em edição no localStorage ("encarte-products-v2")
 * 2. Cache do último projeto salvo ("painel_validade_last_project_cache_v1")
 * 3. Registra códigos (com e sem zeros à esquerda) e mapa de fotos
 */
export function getActiveEncarteInfo(): ActiveEncarteInfo {
  const storage = getStorage();
  const codes = new Set<string>();
  const photoByCode = new Map<string, string>();
  const productNameByCode = new Map<string, string>();
  let sourceEncarteName: string | undefined;
  let sourceUpdatedAt: string | undefined;

  if (!storage) {
    return { codes, photoByCode, productNameByCode };
  }

  const registerProduct = (item: {
    code?: string | number;
    name?: string;
    image?: string;
    included?: boolean;
  }) => {
    if (!item || item.included === false || !item.code) return;
    const clean = String(item.code).trim();
    if (!clean) return;
    const normalized = normalizeProductCode(clean);

    codes.add(clean);
    codes.add(clean.toLowerCase());
    codes.add(clean.toUpperCase());
    if (normalized) codes.add(normalized);

    if (item.image && typeof item.image === "string" && item.image.trim()) {
      const img = item.image.trim();
      if (!photoByCode.has(clean)) photoByCode.set(clean, img);
      if (normalized && !photoByCode.has(normalized)) photoByCode.set(normalized, img);
    }

    if (item.name && typeof item.name === "string" && item.name.trim()) {
      const nm = item.name.trim();
      if (!productNameByCode.has(clean)) productNameByCode.set(clean, nm);
      if (normalized && !productNameByCode.has(normalized)) productNameByCode.set(normalized, nm);
    }
  };

  // 1. Prioridade: Encarte ativo em edição no editor
  try {
    const rawActive =
      storage.getItem("encarte-products-v2") ||
      storage.getItem("encarte-products");

    if (rawActive) {
      const items = JSON.parse(rawActive);
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(registerProduct);
        sourceEncarteName = "Editor Ativo";
      }
    }
  } catch (err) {
    console.error("Erro ao ler produtos do encarte ativo:", err);
  }

  // 2. Complemento: Cache do último projeto salvo (IndexedDB)
  try {
    const rawCache = storage.getItem(LAST_PROJECT_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (parsed && Array.isArray(parsed.products)) {
        if (!sourceEncarteName) {
          sourceEncarteName = parsed.name || "Último Projeto Salvo";
          sourceUpdatedAt = parsed.updatedAt;
        }
        parsed.products.forEach(registerProduct);
      }
    }
  } catch (err) {
    console.warn("Aviso ao ler cache do último projeto:", err);
  }

  return {
    codes,
    photoByCode,
    productNameByCode,
    sourceEncarteName,
    sourceUpdatedAt,
  };
}

/**
 * Lê os códigos de produtos atualmente incluídos no último encarte feito
 */
export function getActiveEncarteProductCodes(): Set<string> {
  return getActiveEncarteInfo().codes;
}

/**
 * Lê o mapa de fotos do último encarte feito (código -> URL/DataUrl da foto)
 */
export function getActiveEncartePhotoMap(): Map<string, string> {
  return getActiveEncarteInfo().photoByCode;
}

/**
 * Sincroniza de forma assíncrona o último encarte feito a partir do IndexedDB
 * (busca o projeto mais recente salvo pelo usuário e atualiza os pinos do painel)
 */
export async function syncLastEncarteData(): Promise<ActiveEncarteInfo> {
  try {
    const projects = await listProjectsLocal(false);
    if (projects && projects.length > 0) {
      // O primeiro item é o mais recentemente atualizado (updatedAt desc)
      const newestSummary = projects[0];
      const res = await loadProjectLocal(newestSummary.id);
      if (res.ok && res.project && Array.isArray(res.project.products)) {
        saveLastProjectEncarteCache(res.project);
      }
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar último encarte do IndexedDB:", err);
  }

  refreshEncartePinsOnActiveSnapshot();
  return getActiveEncarteInfo();
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

  const activeEncarteInfo = getActiveEncarteInfo();

  const lotesCalculados: ValidadeLoteCalculado[] = processarListaLotes(
    rawLotes,
    referenceDate,
    activeEncarteInfo.codes,
    previousBatchKeys,
    previousEncarteCodes,
    activeEncarteInfo.photoByCode
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

  const encarteInfo = getActiveEncarteInfo();
  const updatedLotes = active.lotes.map((lote) => {
    const isNoEncarte =
      encarteInfo.codes.has(lote.codprod) ||
      encarteInfo.codes.has(normalizeProductCode(lote.codprod));

    const foto = resolverFotoProduto(lote.codprod, lote.foto, encarteInfo.photoByCode);

    return {
      ...lote,
      noEncarte: isNoEncarte,
      foto: foto || lote.foto,
    };
  });

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
