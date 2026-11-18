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
import {
  listProjectsLocal,
  loadProjectLocal,
  saveProjectLocal,
} from "./project-indexeddb";
import {
  listAllProjectsUnified,
  loadProjectUnified,
  saveProjectUnified,
} from "./project-sync-manager";
import { deriveSaleUnit, getThumbnailFallbackUrl } from "./parse-product";

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
  const excludedCodes = new Set<string>();
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
    if (!item || !item.code) return;
    const clean = String(item.code).trim();
    if (!clean) return;
    const normalized = normalizeProductCode(clean);

    // Se o item estiver desmarcado do encarte (included: false), registra exclusão
    if (item.included === false) {
      excludedCodes.add(clean);
      excludedCodes.add(clean.toLowerCase());
      excludedCodes.add(clean.toUpperCase());
      if (normalized) excludedCodes.add(normalized);
      return;
    }

    // Se já foi explicitamente excluído no encarte ativo, não reativa por cache antigo
    if (excludedCodes.has(clean) || (normalized && excludedCodes.has(normalized))) {
      return;
    }

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
 * Sincroniza de forma assíncrona o último encarte feito a partir do IndexedDB e Google Drive
 * (busca o projeto mais recente salvo pelo usuário em qualquer computador e atualiza os pinos do painel)
 */
export async function syncLastEncarteData(): Promise<ActiveEncarteInfo> {
  try {
    const unified = await listAllProjectsUnified(false);
    if (unified && unified.items && unified.items.length > 0) {
      // O primeiro item é o mais recentemente atualizado (updatedAt desc)
      const newestSummary = unified.items[0];
      const res = await loadProjectUnified(newestSummary.id);
      if (res.ok && res.project && Array.isArray(res.project.products)) {
        saveLastProjectEncarteCache(res.project);
      }
    } else {
      // Fallback local caso o manager unificado falhe
      const projects = await listProjectsLocal(false);
      if (projects && projects.length > 0) {
        const newestSummary = projects[0];
        const res = await loadProjectLocal(newestSummary.id);
        if (res.ok && res.project && Array.isArray(res.project.products)) {
          saveLastProjectEncarteCache(res.project);
        }
      }
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar último encarte do IndexedDB/Drive:", err);
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

/**
 * Adiciona um lote com 1 clique ao encarte mais recente
 */
export function addLoteToEncarte(lote: ValidadeLoteCalculado): {
  ok: boolean;
  action: "added" | "updated";
  productCode: string;
  productName: string;
  encarteName: string;
} {
  const storage = getStorage();
  const cleanCode = (lote.codprod || "").trim();
  const normalizedCode = normalizeProductCode(cleanCode);

  if (!storage || !cleanCode) {
    return {
      ok: false,
      action: "updated",
      productCode: cleanCode,
      productName: lote.descricao,
      encarteName: "Encarte",
    };
  }

  let products: any[] = [];
  try {
    const raw =
      storage.getItem("encarte-products-v2") ||
      storage.getItem("encarte-products");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) products = parsed;
    }
  } catch {}

  // Se encarte-products-v2 estiver vazio, recupera do cache do último projeto
  if (products.length === 0) {
    try {
      const rawCache = storage.getItem(LAST_PROJECT_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (parsed && Array.isArray(parsed.products)) {
          products = parsed.products;
        }
      }
    } catch {}
  }

  // Verifica se o produto já existe no encarte
  const existingIndex = products.findIndex((p) => {
    if (!p || !p.code) return false;
    const pCode = String(p.code).trim();
    return pCode === cleanCode || normalizeProductCode(pCode) === normalizedCode;
  });

  let action: "added" | "updated" = "added";
  const photoUrl =
    lote.foto ||
    getThumbnailFallbackUrl(cleanCode) ||
    "";

  const derivedUnit = deriveSaleUnit(
    lote.embalagem,
    undefined,
    lote.descricao
  ).unit;

  const formattedPrice =
    lote.precoVenda > 0
      ? lote.precoVenda.toFixed(2).replace(".", ",")
      : "";

  if (existingIndex >= 0) {
    // Atualiza produto existente para incluído
    action = "updated";
    const existing = products[existingIndex];
    products[existingIndex] = {
      ...existing,
      included: true,
      price: existing.price || formattedPrice,
      validity: existing.validity || lote.dtval,
      image: existing.image || photoUrl,
      stock: existing.stock || (lote.estoque > 0 ? `${lote.estoque} ${lote.embalagem}` : ""),
    };
  } else {
    // Cria novo produto no formato EncarteProduct
    action = "added";
    const newProduct = {
      id: `p-${Date.now()}-${cleanCode}`,
      code: cleanCode,
      name: lote.descricao.toUpperCase(),
      packaging: lote.embalagem,
      validity: lote.dtval,
      price: formattedPrice,
      unit: derivedUnit,
      unitConfirmed: false,
      stock: lote.estoque > 0 ? `${lote.estoque} ${lote.embalagem}` : "",
      badge: "",
      image: photoUrl,
      included: true,
      source: "painel-validade",
    };
    products.push(newProduct);
  }

  // Salva no localStorage imediatamente
  try {
    storage.setItem("encarte-products-v2", JSON.stringify(products));
  } catch (err) {
    console.warn("Aviso ao salvar encarte-products-v2:", err);
  }

  // Atualiza cache do último projeto
  try {
    const rawCache = storage.getItem(LAST_PROJECT_CACHE_KEY);
    const prevCache = rawCache ? JSON.parse(rawCache) : {};
    storage.setItem(
      LAST_PROJECT_CACHE_KEY,
      JSON.stringify({
        ...prevCache,
        updatedAt: new Date().toISOString(),
        products,
      })
    );
  } catch {}

  // Sincroniza de forma assíncrona com o IndexedDB e Google Drive caso exista projeto recente salvo
  if (typeof window !== "undefined") {
    listAllProjectsUnified(false)
      .then(async (unified) => {
        const projectList = unified.items || [];
        if (projectList.length > 0) {
          const newest = projectList[0];
          const fullRes = await loadProjectUnified(newest.id);
          if (fullRes.ok && fullRes.project) {
            const projectProducts = [...(fullRes.project.products || [])];
            const pIdx = projectProducts.findIndex(
              (p) =>
                String(p.code).trim() === cleanCode ||
                normalizeProductCode(String(p.code)) === normalizedCode
            );
            if (pIdx >= 0) {
              projectProducts[pIdx] = { ...projectProducts[pIdx], included: true };
            } else {
              projectProducts.push(products[products.length - 1]);
            }
            await saveProjectUnified(
              {
                ...fullRes.project,
                products: projectProducts,
                updatedAt: new Date().toISOString(),
              },
              false
            );
          }
        }
      })
      .catch(() => {});
  }

  // Recalcula os pinos e atualiza o snapshot ativo
  refreshEncartePinsOnActiveSnapshot();

  const encarteInfo = getActiveEncarteInfo();

  return {
    ok: true,
    action,
    productCode: cleanCode,
    productName: lote.descricao,
    encarteName: encarteInfo.sourceEncarteName || "Encarte Mais Recente",
  };
}

/**
 * Remove um lote do encarte com 1 clique (desmarca included: false)
 */
export function removeLoteFromEncarte(codprod: string): {
  ok: boolean;
  productCode: string;
} {
  const storage = getStorage();
  const cleanCode = (codprod || "").trim();
  const normalizedCode = normalizeProductCode(cleanCode);

  if (!storage || !cleanCode) {
    return { ok: false, productCode: cleanCode };
  }

  try {
    const raw =
      storage.getItem("encarte-products-v2") ||
      storage.getItem("encarte-products");
    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        const updated = items.map((p) => {
          if (!p || !p.code) return p;
          const pCode = String(p.code).trim();
          if (pCode === cleanCode || normalizeProductCode(pCode) === normalizedCode) {
            return { ...p, included: false };
          }
          return p;
        });
        storage.setItem("encarte-products-v2", JSON.stringify(updated));
      }
    }
  } catch {}

  // Também atualiza cache do último projeto se houver
  try {
    const rawCache = storage.getItem(LAST_PROJECT_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (parsed && Array.isArray(parsed.products)) {
        const cacheUpdated = parsed.products.map((p: any) => {
          if (!p || !p.code) return p;
          const pCode = String(p.code).trim();
          if (pCode === cleanCode || normalizeProductCode(pCode) === normalizedCode) {
            return { ...p, included: false };
          }
          return p;
        });
        storage.setItem(
          LAST_PROJECT_CACHE_KEY,
          JSON.stringify({ ...parsed, products: cacheUpdated })
        );
      }
    }
  } catch {}

  // Recalcula os pinos no snapshot ativo
  refreshEncartePinsOnActiveSnapshot();

  return { ok: true, productCode: cleanCode };
}
