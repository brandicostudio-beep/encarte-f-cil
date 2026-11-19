/**
 * Gerenciador de armazenamento no navegador para o Encarte Semanal.
 * Salva o modelo de fundo, a configuração da grade, os textos e os produtos.
 * Trocar o modelo NÃO apaga a planilha/produtos carregados.
 */

import {
  DEFAULT_ENCARTE_SEMANAL_CONFIG,
  DEFAULT_ENCARTE_SEMANAL_GRID,
  type EncarteSemanalConfig,
  type EncarteSemanalGridConfig,
  type EncarteSemanalProduct,
} from "@/types/encarte-semanal";

export const STORAGE_KEYS = {
  TEMPLATE: "encarte_semanal_template_v1",
  GRID: "encarte_semanal_grid_v1",
  FOOTER: "encarte_semanal_footer_v1",
  PRODUCTS: "encarte_semanal_products_v1",
  STORED_CATALOG: "encarte_semanal_stored_catalog_v1",
  FILL_MODE: "encarte_semanal_fill_mode_v1",
  CONFIG: "encarte_semanal_config_v1",
} as const;

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

const fallbackStorage = new MemoryStorage();

export function getSafeStorage(): Storage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return fallbackStorage;
}

export function clearEncarteSemanalStorage(): void {
  const storage = getSafeStorage();
  storage.removeItem(STORAGE_KEYS.TEMPLATE);
  storage.removeItem(STORAGE_KEYS.GRID);
  storage.removeItem(STORAGE_KEYS.FOOTER);
  storage.removeItem(STORAGE_KEYS.PRODUCTS);
  storage.removeItem(STORAGE_KEYS.CONFIG);
}

/**
 * Salva o modelo de arte (URL ou DataURL) no navegador.
 */
export function saveEncarteSemanalTemplate(templateDataUrl: string): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.TEMPLATE, templateDataUrl);
  } catch (err) {
    console.warn("Aviso ao salvar template no localStorage:", err);
  }
}

/**
 * Carrega o modelo de arte salvo ou retorna o padrão.
 */
export function loadEncarteSemanalTemplate(): string {
  const storage = getSafeStorage();
  if (!storage) return DEFAULT_ENCARTE_SEMANAL_CONFIG.templateImage;
  try {
    const saved = storage.getItem(STORAGE_KEYS.TEMPLATE);
    if (saved && saved.trim()) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_ENCARTE_SEMANAL_CONFIG.templateImage;
}

/**
 * Salva a configuração da grade (topo, base, divisórias, linhas).
 */
export function saveEncarteSemanalGridConfig(grid: EncarteSemanalGridConfig): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.GRID, JSON.stringify(grid));
  } catch (err) {
    console.warn("Erro ao salvar grade do encarte semanal:", err);
  }
}

/**
 * Carrega a configuração da grade salva ou retorna o padrão.
 */
export function loadEncarteSemanalGridConfig(): EncarteSemanalGridConfig {
  const storage = getSafeStorage();
  if (!storage) return DEFAULT_ENCARTE_SEMANAL_GRID;
  try {
    const saved = storage.getItem(STORAGE_KEYS.GRID);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_ENCARTE_SEMANAL_GRID,
        ...parsed,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ENCARTE_SEMANAL_GRID;
}

/**
 * Salva o texto do rodapé da oferta.
 */
export function saveEncarteSemanalFooterText(footerText: string): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.FOOTER, footerText);
  } catch {
    /* ignore */
  }
}

/**
 * Carrega o texto do rodapé salvo ou retorna o padrão.
 */
export function loadEncarteSemanalFooterText(): string {
  const storage = getSafeStorage();
  if (!storage) return DEFAULT_ENCARTE_SEMANAL_CONFIG.footerText;
  try {
    const saved = storage.getItem(STORAGE_KEYS.FOOTER);
    if (saved && saved.trim()) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_ENCARTE_SEMANAL_CONFIG.footerText;
}

/**
 * Salva a lista de produtos carregados/editados no navegador.
 */
export function saveEncarteSemanalProducts(products: EncarteSemanalProduct[]): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (err) {
    console.warn("Erro ao salvar produtos do encarte semanal:", err);
  }
}

/**
 * Carrega os produtos salvos.
 */
export function loadEncarteSemanalProducts(): EncarteSemanalProduct[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const saved = storage.getItem(STORAGE_KEYS.PRODUCTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Salva a lista completa da planilha carregada (catálogo armazenado da semana),
 * permitindo que ela permaneça salva em memória mesmo quando o usuário escolhe
 * preencher manualmente box por box.
 */
export function saveStoredCatalog(products: EncarteSemanalProduct[]): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.STORED_CATALOG, JSON.stringify(products));
  } catch (err) {
    console.warn("Aviso ao salvar catálogo armazenado:", err);
  }
}

/**
 * Carrega o catálogo armazenado da planilha.
 */
export function loadStoredCatalog(): EncarteSemanalProduct[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEYS.STORED_CATALOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva o modo de preenchimento atual ("auto" para preencher tudo, "manual" para boxes vazios).
 */
export function saveFillMode(mode: "auto" | "manual"): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.FILL_MODE, mode);
  } catch (err) {
    console.warn("Aviso ao salvar modo de preenchimento:", err);
  }
}

/**
 * Carrega o modo de preenchimento ("auto" ou "manual").
 */
export function loadFillMode(): "auto" | "manual" {
  const storage = getSafeStorage();
  if (!storage) return "auto";
  try {
    const mode = storage.getItem(STORAGE_KEYS.FILL_MODE);
    return mode === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Limpa apenas os produtos carregados (para iniciar um encarte limpo na nova semana),
 * mantendo o modelo de fundo e a configuração da grade intactos.
 */
export function clearEncarteSemanalProducts(): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEYS.PRODUCTS);
  } catch {
    /* ignore */
  }
}

/**
 * Carrega a configuração completa unificada.
 */
export function loadEncarteSemanalConfig(): EncarteSemanalConfig {
  return {
    name: DEFAULT_ENCARTE_SEMANAL_CONFIG.name,
    templateImage: loadEncarteSemanalTemplate(),
    footerText: loadEncarteSemanalFooterText(),
    gridConfig: loadEncarteSemanalGridConfig(),
    exportScale: DEFAULT_ENCARTE_SEMANAL_CONFIG.exportScale,
  };
}
