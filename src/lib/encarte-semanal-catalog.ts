/**
 * Catálogo e Sistema de Predição de Texto (Autocomplete) para o Encarte Semanal.
 * Permite buscar produtos por CÓDIGO ou DESCRIÇÃO com auto-preenchimento
 * de fotos, código e descrição diretamente na arte estilo Canva/Figma.
 *
 * Fontes de dados unificadas:
 * 1. Snapshot Ativo da Rotina 8230 (Winthor / Painel de Validade)
 * 2. Catálogo Oficial Cescom Distribuidor
 * 3. Produtos em cache no Encarte Principal e no Encarte Semanal
 */

import { getActiveSnapshot } from "./painel-validade-storage";
import { findKnownPhotoForCode } from "./encarte-semanal-photos";
import { extractGenericBaseName } from "./colecoes-similarity";
import type { EncarteSemanalProduct } from "@/types/encarte-semanal";

export interface ProductSuggestion {
  code: string;
  description: string;
  image?: string;
  source: "winthor" | "catalogo" | "encarte" | "custom" | "planilha" | "cescom";
}

/**
 * Catálogo padrão com os produtos oficiais e frequentes da Cescom.
 */
export const CESCOM_STANDARD_CATALOG: Array<{ code: string; description: string }> = [
  { code: "19396", description: "AMEIXA EM CALDA LATA PREDILECTA" },
  { code: "5522", description: "GOIABADA BLOCO PREDILECTA" },
  { code: "25573", description: "MOLHO MADEIRA STAND UP PREDILECTA" },
  {
    code: "10314",
    description: "AZEITONA 100G C/ CAROÇO, 120G S/CAROÇO, FATIADA VERDE E PRETA VALE FÉRTIL",
  },
  { code: "2647", description: "AZEITONA 120G SEM CAROÇO VALE FÉRTIL" },
  { code: "25541", description: "AZEITONA FATIADA VALE FÉRTIL" },
  { code: "24657", description: "BEBIDA DE AMENDOAS ALMOND BREEZE" },
  { code: "2664", description: "COCO RALADO ADOÇADO MENINA 50G" },
  { code: "3182", description: "REFRESCO TORNADO" },
  { code: "25710", description: "MAIONESE CASEIRA PET LIZA" },
  { code: "3246", description: "PÊSSEGO EM CALDA GB" },
  { code: "19124", description: "BATATA PALHA EXTRA FINA YOKI" },
  { code: "21061", description: "MOLHO TOMATE TRAD. SACHÊ POMAROLA 200G/300G" },
  { code: "26256", description: "MOLHO TOMATE SACHÊ POMAROLA" },
  { code: "400", description: "FERMENTO EM PÓ LEVE 12 E PAGUE 11 ROYAL" },
  { code: "5279", description: "AÇÚCAR CONFEITEIRO GLAÇÚCAR" },
  { code: "2201", description: "BEBIDA LÁCTEA 15GR PROFORCE ZERO LACTOSE" },
  { code: "1165", description: "CUSCUZ, AMIDO DE MILHO E ÓLEO COMPOSTO SINHÁ" },
  { code: "14311", description: "AMIDO DE MILHO SINHÁ" },
  { code: "14300", description: "ÓLEO COMPOSTO SINHÁ" },
  { code: "13678", description: "LEITE DE COCO TP DUCOCO 1L" },
  { code: "4201", description: "BEBIDA LÁCTEA IBITURUNA" },
  { code: "5794", description: "LASANHA DIRETO AO FORNO PETYBON" },
  {
    code: "14352",
    description: "LASANHA DIRETO AO FORNO E FERMENTO EM PÓ QUÍMICO DONA BENTA",
  },
  { code: "17585", description: "FERMENTO EM PÓ QUÍMICO DONA BENTA" },
  { code: "8501", description: "SUCO TP NECTAR 200ML E REFRESCO MARATÁ" },
  { code: "23396", description: "PRODUTO CESCOM AGILE" },
  { code: "19559", description: "PRODUTO CESCOM" },
  { code: "12345", description: "MOLHO DE TOMATE ESPECIAL" },
  { code: "7890", description: "ARROZ POLIDO TIPO 1" },
  { code: "9001", description: "FEIJÃO CARIOCA ESPECIAL" },
  { code: "11022", description: "CAFÉ TRADICIONAL A VÁCUO 500G" },
  { code: "15540", description: "ÓLEO DE SOJA REFINADO PET 900ML" },
  { code: "16200", description: "LEITE INTEGRAL UHT 1L" },
  { code: "18300", description: "FARINHA DE TRIGO ESPECIAL 1KG" },
  { code: "20100", description: "BISCOITO RECHEADO CHOCOLATE" },
  { code: "22400", description: "SABONETE EM BARRA SUAVE" },
  { code: "23500", description: "DETERGENTE LÍQUIDO CONCENTRADO" },
  { code: "24800", description: "ÁGUA SANITÁRIA 1L" },
  { code: "25900", description: "AMACIANTE DE ROUPAS 2L" },
];

/**
 * Coleta todo o catálogo de produtos disponíveis em memória e armazenamento local.
 */
export function getAllKnownProducts(): ProductSuggestion[] {
  const map = new Map<string, ProductSuggestion>();

  // 1. Planilha Armazenada do Encarte Semanal (Máxima Prioridade)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const storedCatalogRaw = window.localStorage.getItem("encarte_semanal_stored_catalog_v1");
      if (storedCatalogRaw) {
        const parsed = JSON.parse(storedCatalogRaw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (!p.code) continue;
            const code = String(p.code).trim();
            map.set(code, {
              code,
              description: (p.description || "").trim().toUpperCase(),
              image: p.image || findKnownPhotoForCode(code),
              source: "planilha",
            });
          }
        }
      }
      // Produtos ativos no encarte
      const activeProductsRaw = window.localStorage.getItem("encarte_semanal_products_v1");
      if (activeProductsRaw) {
        const parsed = JSON.parse(activeProductsRaw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (!p.code) continue;
            const code = String(p.code).trim();
            if (!map.has(code)) {
              map.set(code, {
                code,
                description: (p.description || "").trim().toUpperCase(),
                image: p.image || findKnownPhotoForCode(code),
                source: "planilha",
              });
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Catálogo Base Oficial Cescom
  for (const item of CESCOM_STANDARD_CATALOG) {
    const code = item.code.trim();
    if (!map.has(code)) {
      map.set(code, {
        code,
        description: item.description.trim().toUpperCase(),
        image: findKnownPhotoForCode(code),
        source: "catalogo",
      });
    }
  }

  // 2. Snapshot Ativo da Rotina 8230 (Winthor)
  try {
    const snap = getActiveSnapshot();
    if (snap?.lotes && Array.isArray(snap.lotes)) {
      for (const lote of snap.lotes) {
        if (!lote.codprod) continue;
        const code = String(lote.codprod).trim();
        const desc = (lote.descricao || "").trim().toUpperCase();
        if (code && !map.has(code)) {
          const img = lote.foto || findKnownPhotoForCode(code);
          map.set(code, {
            code,
            description: desc || `PRODUTO ${code}`,
            image: img,
            source: "winthor",
          });
        }
      }
    }
  } catch (err) {
    console.warn("Aviso ao ler snapshot no catálogo de predição:", err);
  }

  // 3. Produtos em cache no LocalStorage (Encarte Principal)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const rawMain =
        window.localStorage.getItem("encarte-products-v2") ||
        window.localStorage.getItem("encarte-products");
      if (rawMain) {
        const parsed = JSON.parse(rawMain);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (!p.code) continue;
            const code = String(p.code).trim();
            if (!map.has(code)) {
              map.set(code, {
                code,
                description: (p.description || "").trim().toUpperCase(),
                image: p.image || findKnownPhotoForCode(code),
                source: "encarte",
              });
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Inclui produtos obtidos online no site da Cescom
  for (const [code, item] of onlineProductCache.entries()) {
    if (!map.has(code)) {
      map.set(code, item);
    }
  }

  return Array.from(map.values());
}

/**
 * Normaliza string removendo acentos e pontuações para busca insensível.
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Realiza a busca com predição de texto para autocompletar código ou descrição.
 * Suporta busca por prefixo numérico (ex: "19" -> "19396", "19124") ou
 * palavras-chave de descrição (ex: "ameixa", "molho", "predilecta").
 */
export function searchProductSuggestions(query: string, limit = 8): ProductSuggestion[] {
  if (!query || !query.trim()) {
    return getAllKnownProducts().slice(0, limit);
  }

  const rawQuery = query.trim();
  const normQuery = normalizeForSearch(rawQuery);
  const isNumeric = /^\d+$/.test(rawQuery);
  const all = getAllKnownProducts();

  const exactCodeMatches: ProductSuggestion[] = [];
  const prefixCodeMatches: ProductSuggestion[] = [];
  const descWordMatches: ProductSuggestion[] = [];
  const otherMatches: ProductSuggestion[] = [];

  for (const item of all) {
    const itemCode = item.code.trim();
    const itemDescNorm = normalizeForSearch(item.description);

    if (itemCode === rawQuery) {
      exactCodeMatches.push(item);
    } else if (isNumeric && itemCode.startsWith(rawQuery)) {
      prefixCodeMatches.push(item);
    } else if (itemCode.includes(rawQuery)) {
      prefixCodeMatches.push(item);
    } else if (itemDescNorm.includes(normQuery)) {
      descWordMatches.push(item);
    }
  }

  const combined = [
    ...exactCodeMatches,
    ...prefixCodeMatches,
    ...descWordMatches,
    ...otherMatches,
  ];

  // Garante que cada item tenha sua foto resolvida
  return combined.slice(0, limit).map((item) => ({
    ...item,
    image: item.image || findKnownPhotoForCode(item.code),
  }));
}

const onlineProductCache = new Map<string, ProductSuggestion>();

/**
 * Busca o produto online no site oficial da Cescom (https://www.cescom.com.br/)
 * caso o código não esteja na planilha anexada nem no catálogo local.
 * Retorna código, descrição oficial e URL da foto em alta resolução.
 */
export async function fetchCescomProductOnline(code: string): Promise<ProductSuggestion | null> {
  const cleanCode = code.trim();
  if (!cleanCode) return null;

  if (onlineProductCache.has(cleanCode)) {
    return onlineProductCache.get(cleanCode)!;
  }

  // Verificar cache persistido no localStorage
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(`cescom_online_prod_${cleanCode}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ProductSuggestion;
        onlineProductCache.set(cleanCode, parsed);
        return parsed;
      }
    }
  } catch {}

  // Consulta o endpoint de proxy /api/cescom-product
  try {
    const res = await fetch(`/api/cescom-product?code=${encodeURIComponent(cleanCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.product && data.product.description) {
        const prod: ProductSuggestion = {
          code: cleanCode,
          description: data.product.description.toUpperCase(),
          image: data.product.image || findKnownPhotoForCode(cleanCode),
          source: "cescom",
        };
        onlineProductCache.set(cleanCode, prod);
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem(`cescom_online_prod_${cleanCode}`, JSON.stringify(prod));
          }
        } catch {}
        return prod;
      }
    }
  } catch (err) {
    console.warn(`Aviso ao buscar produto ${cleanCode} no site cescom.com.br:`, err);
  }

  return null;
}

/**
 * Busca dados completos de um produto a partir de um código exato.
 * Se não existir no catálogo, verifica o cache online do site da Cescom.
 */
export function lookupProductByCode(code: string): ProductSuggestion {
  const cleanCode = code.trim();
  const all = getAllKnownProducts();
  const found = all.find(
    (item) => item.code.toLowerCase() === cleanCode.toLowerCase()
  );

  const resolvedPhoto = findKnownPhotoForCode(cleanCode);

  if (found) {
    return {
      ...found,
      image: found.image || resolvedPhoto,
    };
  }

  if (onlineProductCache.has(cleanCode)) {
    const online = onlineProductCache.get(cleanCode)!;
    return {
      ...online,
      image: online.image || resolvedPhoto,
    };
  }

  return {
    code: cleanCode,
    description: `PRODUTO ${cleanCode}`,
    image: resolvedPhoto,
    source: "custom",
  };
}

/**
 * Cria ou atualiza um EncarteSemanalProduct a partir de uma sugestão de código/produto.
 */
export function createSemanalProductFromSuggestion(
  suggestion: ProductSuggestion,
  existingProduct?: EncarteSemanalProduct | null
): EncarteSemanalProduct {
  const image = suggestion.image || findKnownPhotoForCode(suggestion.code);

  return {
    id: existingProduct?.id || `semanal-prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: suggestion.code,
    description: suggestion.description,
    image,
    duplicatePhoto: existingProduct ? existingProduct.duplicatePhoto : true,
    limit: existingProduct?.limit,
    scale: existingProduct?.scale ?? 1.0,
    scale2: existingProduct?.scale2 ?? 1.0,
    offsetX: existingProduct?.offsetX ?? 0,
    offsetY: existingProduct?.offsetY ?? 0,
    offsetX2: existingProduct?.offsetX2 ?? 0,
    offsetY2: existingProduct?.offsetY2 ?? 0,
    overlapY: existingProduct?.overlapY ?? 2,
    included: true,
    originalCode: existingProduct?.originalCode || suggestion.code,
    originalDescription: existingProduct?.originalDescription || suggestion.description,
    originalImage: existingProduct?.originalImage || image,
  };
}

/**
 * Limpa a descrição para produtos classificados como PRINCIPAL no Encarte Semanal.
 * Remove embalagem/fardos (ex: - 12X1 LT, 1X500 ML, 6X2 LT), gramaturas redundantes,
 * fragrâncias, sabores, aromas e variações, deixando apenas a descrição genérica pura.
 * Exemplo:
 * - "ALVEJANTE Q BOA FLORAL - 12X1 LT" -> "ALVEJANTE Q BOA"
 * - "LIMPADOR SANITARIO Q BOA FLORAL - 12X1 LT" -> "LIMPADOR SANITARIO Q BOA"
 * - "DESENGORDURANTE Q BOA COZINHA - 1X500 ML" -> "DESENGORDURANTE Q BOA"
 */
export function cleanPrincipalDescription(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Remove multiplicadores e formatos de caixa / fardo / embalagem como:
  // - 12X1 LT, 1X500 ML, 6X2 LT, 24X100G, 12X1L, CX, FD, UNID
  s = s.replace(/[-–—/]?\s*\b\d+\s*X\s*\d+[\d.,]*\s*(?:LT|L|ML|KG|G|GR|UNID|UN|CX|FD)?\b/gi, " ");
  s = s.replace(/[-–—/]?\s*\b\d+[\d.,]*\s*(?:LT|L|ML|KG|G|GR)\b/gi, " ");

  // Extrai o nome-base removendo fragrâncias, sabores e recheios
  s = extractGenericBaseName(s);

  // Variações específicas comuns de limpeza e sub-linhas
  s = s.replace(/\b(cozinha|banheiro)\b/gi, " ");

  // Remove sobras de traços, barras e espaços repetidos
  s = s
    .replace(/[-–—/]\s*[-–—/]/g, " ")
    .replace(/\s*[-–—/]\s*$/g, "")
    .replace(/^\s*[-–—/]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return s.toUpperCase();
}

/**
 * Encontra variações (outros sabores, fragrâncias ou aromas) da mesma marca/família
 * para serem sugeridos como Foto 2 no Encarte Semanal.
 */
export function findSemanalVariations(
  targetDescription: string,
  targetCode?: string,
  catalogProducts?: Array<{ code: string; description: string; image?: string }>
): Array<{ code: string; description: string; image?: string }> {
  if (!targetDescription) return [];
  const baseTarget = cleanPrincipalDescription(targetDescription);
  if (!baseTarget || baseTarget.length < 3) return [];

  const candidates: Array<{ code: string; description: string; image?: string }> = [];
  const seenCodes = new Set<string>();
  if (targetCode) seenCodes.add(targetCode.trim());

  // Combina lista fornecida com o catálogo padrão da Cescom
  const allItems: Array<{ code: string; description: string; image?: string }> = [
    ...(catalogProducts || []),
    ...CESCOM_STANDARD_CATALOG,
  ];

  for (const item of allItems) {
    const code = (item.code || "").trim();
    if (!code || seenCodes.has(code)) continue;

    const desc = item.description || "";
    const baseItem = cleanPrincipalDescription(desc);

    // Verifica se a base bate (ex: ambos são "ALVEJANTE Q BOA" ou compartilham a base principal)
    const matchesBase =
      baseItem.includes(baseTarget) ||
      baseTarget.includes(baseItem) ||
      (baseTarget.length > 5 && desc.toUpperCase().includes(baseTarget));

    if (matchesBase) {
      seenCodes.add(code);
      const img = item.image || findKnownPhotoForCode(code);
      candidates.push({
        code,
        description: desc,
        image: img,
      });
    }

    if (candidates.length >= 8) break;
  }

  return candidates;
}
