import { parse, HTMLElement } from "node-html-parser";
import type { EncarteProduct, PackagingType, MeasureUnit } from "@/types/encarte";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ")
    .trim();

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c) : "";
}

function findJsonLd(html: string): any[] {
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  const results: any[] = [];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse((b[1] ?? "").trim());
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch {
      /* ignore */
    }
  }
  return results;
}

export function formatPrice(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || raw === "") return "";
  let s = String(raw).replace(/[^\d.,]/g, "");
  if (!s) return "";
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return "";
  return n.toFixed(2).replace(".", ",");
}

export interface DerivedSaleUnit {
  unit: string;
  hasUnitWord: boolean;
}

/**
 * As 5 medidas oficiais do varejo: Caixa (CX), Pacote (PCT), Display (DISP), Unidade (UND) e Fardo (FD).
 */
export const SALE_UNITS = [
  { value: "UND", label: "UND", fullName: "Unidade", fullLabel: "Unidade (UND)" },
  { value: "CX", label: "CX", fullName: "Caixa", fullLabel: "Caixa (CX)" },
  { value: "PCT", label: "PCT", fullName: "Pacote", fullLabel: "Pacote (PCT)" },
  { value: "FD", label: "FD", fullName: "Fardo", fullLabel: "Fardo (FD)" },
  { value: "DISP", label: "DISP", fullName: "Display", fullLabel: "Display (DISP)" },
] as const;

export type SaleUnitValue = (typeof SALE_UNITS)[number]["value"];

/**
 * Normaliza qualquer variação de texto para uma das 5 unidades canônicas ou mantém customizada.
 */
export function normalizeSaleUnit(unit?: string | null): string {
  const u = (unit || "").trim().toUpperCase();
  if (!u) return "UND";
  if (/^CXA?$|^CAIXA$/.test(u)) return "CX";
  if (/^PCTE?$|^PC$|^PACOTE$/.test(u)) return "PCT";
  if (/^FD$|^FARDO$|^FRD$/.test(u)) return "FD";
  if (/^DISP$|^DSP$|^DISPLAY$|^DP$/.test(u)) return "DISP";
  if (/^UND?$|^UN$|^UNIDADE$|^UNID$/.test(u)) return "UND";
  return u;
}

/**
 * Deriva a unidade de venda a partir da embalagem e/ou do nome do produto.
 * Suporta as 5 medidas oficiais: Caixa (CX), Pacote (PCT), Display (DISP), Unidade (UND) e Fardo (FD).
 * - CAIXA ou CX → CX
 * - PACOTE ou PCT → PCT
 * - DISPLAY, DISP ou DSP → DISP
 * - UNIDADE ou UNID → UND
 * - FARDO ou FD → FD
 * - Multiplicador > 1X (ex.: "20X500 GR") → CX
 * - Multiplicador 1X (ex.: "1X234 ML", "1X153 GR") → UND
 * - Se manualUnit for fornecido e confirmado, respeita a escolha manual.
 */
export function deriveSaleUnit(
  packaging?: string | null,
  explicitUnit?: string | null,
  productName?: string | null,
  unitConfirmed?: boolean
): DerivedSaleUnit {
  const cleanPack = (packaging || "").trim();
  const cleanName = (productName || "").trim();
  const manualUnit = explicitUnit ? normalizeSaleUnit(explicitUnit) : "";

  // Se o usuário confirmou manualmente a unidade (ex: select na tabela, modal ou painel)
  if (unitConfirmed && manualUnit) {
    return {
      unit: manualUnit,
      hasUnitWord: true,
    };
  }

  // 1. Se não há embalagem, tentar extrair padrão do nome se disponível
  let textToAnalyze = cleanPack;
  if (!textToAnalyze && cleanName) {
    const fromName =
      cleanName.match(/\b(\d+\s*[Xx]\s*[\d.,]+\s*(?:GR?|KG|ML|L|LT|UNID?|UN|G)?)\b/i) ||
      cleanName.match(/\b(CAIXA|FARDO|PACOTE|DISPLAY|UNIDADE|CX|FD|PCT|DISP|DSP|UND)\b/i);
    if (fromName) {
      textToAnalyze = fromName[0];
    }
  }

  if (!textToAnalyze) {
    return {
      unit: manualUnit || "UND",
      hasUnitWord: false,
    };
  }

  // Remove parênteses, colchetes ou caracteres iniciais, ex: "(PACOTE 1) 1X24 UNID" -> "PACOTE"
  const stripped = textToAnalyze.replace(/^[([{\s]+/, "").trim();
  const firstWord = stripped.split(/[\s\-_/()[\]{}!?:;,.]+/)[0]?.toUpperCase() || "";

  // 2. Palavras de unidade explícitas no início ou texto (ex.: "FARDO 9X24", "PACOTE 1X24", "CAIXA 12X1", "DISPLAY 12X")
  if (/^FARDO$|^FD$|^FRD$/.test(firstWord) || /\b(FARDO|FD)\b/i.test(stripped) || /\b(FARDO)\b/i.test(cleanName)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "FD", hasUnitWord: true };
  }
  if (/^DISPLAY$|^DISP$|^DSP$|^DP$/.test(firstWord) || /\b(DISPLAY|DISP|DSP)\b/i.test(stripped) || /\b(DISPLAY)\b/i.test(cleanName)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "DISP", hasUnitWord: true };
  }
  if (/^PACOTE$|^PCTE?$|^PC$|^PCT$/.test(firstWord) || /\b(PACOTE|PCT)\b/i.test(stripped) || /\b(PACOTE)\b/i.test(cleanName)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "PCT", hasUnitWord: true };
  }
  if (/^CAIXA$|^CXA?$|^CX$/.test(firstWord) || /\b(CAIXA|CX)\b/i.test(stripped) || /\b(CAIXA)\b/i.test(cleanName)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "CX", hasUnitWord: true };
  }
  if (/^BALDE$|^BLD$/.test(firstWord) || /\b(BALDE|BLD)\b/i.test(stripped)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "BLD", hasUnitWord: true };
  }
  if (/^BANDEJA$|^BDJ$/.test(firstWord) || /\b(BANDEJA|BDJ)\b/i.test(stripped)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "BDJ", hasUnitWord: true };
  }
  if (/^SACH[EÊ]$|^SCH$/.test(firstWord) || /\b(SACH[EÊ]|SCH)\b/i.test(stripped)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "SCH", hasUnitWord: true };
  }
  if (/^POTE$|^PT$/.test(firstWord) || /\b(POTE|PT)\b/i.test(stripped)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "PT", hasUnitWord: true };
  }
  if (/^GARRAFA$|^GF$|^GRF$/.test(firstWord) || /\b(GARRAFA|GF)\b/i.test(stripped)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "GF", hasUnitWord: true };
  }
  if (/^LATA$|^LT$/.test(firstWord)) {
    return { unit: manualUnit && manualUnit !== "UND" ? manualUnit : "LT", hasUnitWord: true };
  }

  // 3. Multiplicador com X: ex.: "20X500 GR", "1X234 ML", "10X1 KG", "1X1,01KG", "30X120 GR", "12X1 LT"
  // Regra do Varejo / Atacado / Distribuição:
  // Se multiplicador > 1 (ex.: 2X, 10X, 20X, 24X, 30X) -> é CAIXA ("CX")!
  // Se multiplicador <= 1 (ex.: 1X) -> é UNIDADE ("UND")!
  const multiplierMatch =
    stripped.match(/^(\d+(?:[.,]\d+)?)\s*[Xx]\s*(.+)?/i) ||
    stripped.match(/\b(\d+(?:[.,]\d+)?)\s*[Xx]\s*(?:[\d.,]+)?\s*(?:GR?|KG|ML|L|LT|UNID?|UN|G)?\b/i);

  if (multiplierMatch) {
    const qty = parseFloat(multiplierMatch[1].replace(",", "."));
    // Se o usuário selecionou manualmente uma unidade customizada diferente de UND e CX (ex: PCT, FD, DISP, KG), respeita
    if (manualUnit && manualUnit !== "UND" && manualUnit !== "CX") {
      return { unit: manualUnit, hasUnitWord: true };
    }
    if (qty > 1) {
      return { unit: "CX", hasUnitWord: true };
    } else {
      return { unit: "UND", hasUnitWord: true };
    }
  }

  // 4. Padrão com UNID / UNIDADE / UND:
  // "1 UNID", "1 UN", "UNIDADE" -> UND
  // "12 UNID", "24 UN" -> CX
  const unidMatch = stripped.match(/^(\d+)?\s*(?:UNID(?:ADE)?|UND|UN)\b/i);
  if (unidMatch) {
    const qty = unidMatch[1] ? parseInt(unidMatch[1], 10) : 1;
    if (manualUnit && manualUnit !== "UND") {
      return { unit: manualUnit, hasUnitWord: true };
    }
    if (qty > 1) {
      return { unit: "CX", hasUnitWord: true };
    }
    return { unit: "UND", hasUnitWord: true };
  }

  // 5. Se começar com dígito mas sem multiplicador X (ex.: "23 GR", "500G", "1,01"),
  // a embalagem NÃO possui palavra de unidade identificada
  if (!firstWord || /^\d/.test(firstWord)) {
    return {
      unit: manualUnit && manualUnit !== "UND" ? manualUnit : "UND",
      hasUnitWord: false,
    };
  }

  // Caso seja outra palavra descritiva (ex: "VIDRO" -> "VDR", "TUBO" -> "TUBO"):
  if (manualUnit && manualUnit !== "UND") {
    return { unit: manualUnit, hasUnitWord: true };
  }

  const abbreviated = firstWord.length <= 4 ? firstWord : firstWord.slice(0, 3);
  return {
    unit: abbreviated,
    hasUnitWord: true,
  };
}

export interface ParsedPackaging {
  tipo: PackagingType;
  quantidade: string;
  unidadeMedida: MeasureUnit;
  gramatura: string;
  label: string;
}

/**
 * Faz o parsing estruturado de embalagens, separando em:
 * tipo (UNIDADE, PACOTE, CAIXA, FARDO), quantidade (ex: 1X24),
 * unidade de medida (UNID, GR, KG, ML, L, LT) e gramatura (ex: 320 GR).
 * Reconhece variações com/sem espaço, vírgula decimal (ex: 1,01 KG) etc.
 * Se não for identificada nenhuma embalagem, retorna null (sem preencher valor padrão "1 UN").
 */
export function parsePackaging(raw: string | undefined | null): ParsedPackaging | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s || /^\d{8,}$/.test(s)) return null;

  // 1. Extrair tipo: UNIDADE, PACOTE, CAIXA, FARDO, BANDEJA, POTE, BALDE, SACHÊ, VIDRO
  let tipo: PackagingType = "";
  const tipoMatch = s.match(/\b(UNIDADE|PACOTE|CAIXA|FARDO)\b/i);
  if (tipoMatch) {
    tipo = tipoMatch[1].toUpperCase() as PackagingType;
  }

  // 2. Extrair unidade de medida e multiplicador
  let unidadeMedida: MeasureUnit = "";
  let quantidade = "";
  let gramatura = "";

  // Padrão multiplicador: ex.: 1X24 UNID, 1X320 GR, 18X320 GR, 9X24 UNID, 1X10 GR
  const multMatch = s.match(/(\d+\s*X\s*[\d.,]+)\s*(UNID(?:ADE)?|UN|GR?|KG|ML|L|LT)?\b/i);

  // Padrão simples: ex.: 1,01 KG, 320 GR, 500 G, 24 UNID
  const singleMatch = s.match(/([\d.,]+)\s*(UNID(?:ADE)?|UN|GR?|KG|ML|L|LT)\b/i);

  if (multMatch) {
    quantidade = multMatch[1].replace(/\s+/g, "");
    if (multMatch[2]) {
      const u = multMatch[2].toUpperCase();
      if (u === "G") unidadeMedida = "GR";
      else if (u === "UN" || u === "UNIDADE") unidadeMedida = "UNID";
      else unidadeMedida = u as MeasureUnit;
    }

    if (unidadeMedida && unidadeMedida !== "UNID") {
      const parts = quantidade.split("X");
      if (parts.length === 2) {
        gramatura = `${parts[1]} ${unidadeMedida}`;
      }
    }
  } else if (singleMatch) {
    const val = singleMatch[1];
    const u = singleMatch[2].toUpperCase();
    if (u === "G") unidadeMedida = "GR";
    else if (u === "UN" || u === "UNIDADE") unidadeMedida = "UNID";
    else unidadeMedida = u as MeasureUnit;

    if (unidadeMedida === "UNID") {
      quantidade = `${val} UNID`;
    } else {
      gramatura = `${val} ${unidadeMedida}`;
    }
  }

  // Se não foi identificado tipo, nem multiplicador, nem gramatura -> inválido
  if (!tipo && !quantidade && !gramatura) {
    return null;
  }

  // Montar label conciso e padronizado: ex.: "PACOTE 1X24 UNID", "UNIDADE 1X320 GR", "1X10 GR"
  const labelParts: string[] = [];
  if (tipo) labelParts.push(tipo);
  if (quantidade) {
    if (unidadeMedida && !quantidade.toUpperCase().includes(unidadeMedida) && !gramatura) {
      labelParts.push(`${quantidade} ${unidadeMedida}`);
    } else {
      labelParts.push(quantidade);
      if (unidadeMedida && !quantidade.toUpperCase().includes(unidadeMedida)) {
        labelParts.push(unidadeMedida);
      }
    }
  } else if (gramatura) {
    labelParts.push(gramatura);
  }

  const label = labelParts.join(" ").trim();
  if (!label) return null;

  return {
    tipo,
    quantidade,
    unidadeMedida,
    gramatura,
    label,
  };
}

export function parseProductHtml(html: string, baseUrl: string) {
  const ldList = findJsonLd(html);
  let ldProduct: any = null;
  for (const item of ldList) {
    if (item?.["@type"] === "Product" || (Array.isArray(item?.["@type"]) && item["@type"].includes("Product"))) {
      ldProduct = item;
      break;
    }
  }
  const offers = ldProduct ? (Array.isArray(ldProduct.offers) ? ldProduct.offers[0] : ldProduct.offers) : null;

  const name =
    meta(html, "og:title") ||
    (ldProduct?.name ? decode(String(ldProduct.name)) : "") ||
    decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "") ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const description =
    meta(html, "og:description") ||
    (ldProduct?.description ? decode(String(ldProduct.description).replace(/<[^>]+>/g, "")) : "") ||
    meta(html, "description");

  const price = formatPrice(
    meta(html, "product:price:amount") ||
      meta(html, "og:price:amount") ||
      offers?.price ||
      offers?.lowPrice ||
      meta(html, "price") ||
      html.match(/R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/)?.[1],
  );

  let img = meta(html, "og:image") || meta(html, "og:image:url") || meta(html, "twitter:image");
  if (!img && ldProduct?.image) {
    const i = Array.isArray(ldProduct.image) ? ldProduct.image[0] : ldProduct.image;
    img = typeof i === "string" ? i : i?.url ?? "";
  }
  let imageUrl = "";
  try {
    if (img) imageUrl = new URL(img, baseUrl).toString();
  } catch {
    /* ignore */
  }

  return { name: name.slice(0, 200), description: description.slice(0, 600), price, imageUrl };
}

/**
 * Retorna se um elemento img é um selo, banner promocional ou badge que não deve ser usado como foto de produto.
 */
export function isBadgeOrBanner(img: HTMLElement, card: HTMLElement): boolean {
  const src = (
    img.getAttribute("src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original") ||
    img.getAttribute("data-lazy-src") ||
    img.getAttribute("data-img") ||
    ""
  ).toLowerCase();
  const alt = (img.getAttribute("alt") || "").toLowerCase();
  const title = (img.getAttribute("title") || "").toLowerCase();

  // 1. Ignorar imagens vazias ou placeholders/spacers SVG/1x1
  if (
    !src ||
    src.startsWith("data:image/svg") ||
    src.includes("blank.gif") ||
    src.includes("pixel.gif") ||
    src.includes("spacer.gif")
  ) {
    return true;
  }

  // 2. Ignorar caminhos conhecidos de banners, selos institucionais e ícones
  if (/banners?\/|\/selos?\/|\/badges?\/|logo|bandeira|icon/i.test(src)) {
    return true;
  }

  // 3. Ignorar selos conhecidos pelo alt ou title (ex: "VALIDADE PRÓXIMA", "OFERTA", etc.)
  const badgeRegex =
    /validade\s+pr[oó]xima|oferta|desconto|imperd[ií]vel|leve\s+j[aá]|leve\s+mais|promo[cç][aã]o|selo|badge|banner/i;
  if (badgeRegex.test(alt) || badgeRegex.test(title)) {
    return true;
  }

  // 4. Ignorar imagens contidas dentro de containers de badges, selos ou coleções
  let cur: any = img.parentNode;
  while (cur && cur !== card) {
    const cls = ((cur.getAttribute && cur.getAttribute("class")) || "").toLowerCase();
    const id = ((cur.getAttribute && cur.getAttribute("id")) || "").toLowerCase();
    if (/badge|selo|banner|collection|stamp/.test(cls) || /badge|selo|banner|collection|stamp/.test(id)) {
      return true;
    }
    cur = cur.parentNode;
  }

  return false;
}

/**
 * Extrai a melhor URL de imagem de um card, ignorando selos e banners e priorizando containers de foto.
 */
export function extractCardImage(card: HTMLElement, code?: string): string {
  // 1. Priorizar containers de foto do produto (ex: .product-card__image, .cart-table__column--image)
  const preferredSelectors = [
    ".product-card__image img",
    ".cart-table__column--image img",
    ".product-image img",
    ".product__image img",
    ".product-img img",
    "[class*='image'] img",
    "[class*='foto'] img",
  ];
  for (const sel of preferredSelectors) {
    const candidate = card.querySelector(sel);
    if (candidate && !isBadgeOrBanner(candidate, card)) {
      const src =
        candidate.getAttribute("src") ||
        candidate.getAttribute("data-src") ||
        candidate.getAttribute("data-original") ||
        candidate.getAttribute("data-lazy-src") ||
        candidate.getAttribute("data-img");
      if (src) return src.trim();
    }
  }

  // 2. Buscar todas as tags <img> válidas no card
  const allImgs = card.querySelectorAll("img").filter((img) => !isBadgeOrBanner(img, card));
  if (allImgs.length > 0) {
    // Preferir imagens com _thumb_ ou que contenham o código do produto
    const withThumbOrCode = allImgs.find((img) => {
      const src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src") ||
        "";
      return src.includes("_thumb_") || (code && src.includes(code));
    });
    const chosen = withThumbOrCode || allImgs[0];
    const src =
      chosen.getAttribute("src") ||
      chosen.getAttribute("data-src") ||
      chosen.getAttribute("data-original") ||
      chosen.getAttribute("data-lazy-src") ||
      chosen.getAttribute("data-img") ||
      "";
    return src.trim();
  }

  return "";
}

/**
 * Retorna a URL de fallback da miniatura a partir do código do produto para o fornecedor Cescom.
 */
export function getThumbnailFallbackUrl(code: string, baseUrl?: string): string | null {
  const cleanCode = (code || "").trim().replace(/[^\w-]/g, "");
  if (!cleanCode) return null;
  if (!baseUrl || baseUrl.includes("cescom")) {
    return `https://cescom.agilecdn.com.br/${cleanCode}_thumb_1.jpg`;
  }
  return null;
}

/**
 * Extrai múltiplos produtos de uma página de categoria ou busca de fornecedor (ex: "validade próxima").
 * Utiliza um parser HTML estruturado (node-html-parser) para ler o card completo, evitando cortes em divs aninhadas.
 */
export function parseCategoryHtml(html: string, baseUrl: string): EncarteProduct[] {
  const products: EncarteProduct[] = [];
  const productByCode = new Map<string, EncarteProduct>();

  const addProduct = (raw: {
    code?: string | undefined;
    name: string;
    packaging?: string | undefined;
    packagingType?: PackagingType;
    packagingQuantity?: string;
    packagingUnit?: MeasureUnit;
    packagingWeight?: string;
    validity?: string | undefined;
    image?: string | undefined;
    stock?: string | undefined;
    price?: string | undefined;
    included?: boolean;
    productUrl?: string;
  }) => {
    if (!raw.name || raw.name.length < 2) return;
    const name = decode(raw.name).toUpperCase().slice(0, 120);

    let code = (raw.code || "").trim().replace(/[^\w-]/g, "");
    if (!code) {
      code = String(10000 + products.length + 1);
    }

    // Validação de embalagem: nunca preencher "1 UN" como valor padrão
    const packaging = (raw.packaging || "").trim();

    let validity = (raw.validity || "").trim();
    if (!validity) {
      const valMatch = html.match(/(?:validade|vencimento|val|venc)[\s:.]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i);
      if (valMatch) validity = (valMatch[1] ?? "").replace(/-/g, "/");
    }

    let resolvedImg = "";
    if (raw.image) {
      try {
        resolvedImg = new URL(raw.image, baseUrl).toString();
      } catch {
        resolvedImg = raw.image;
      }
    }

    if (productByCode.has(code)) {
      const existing = productByCode.get(code)!;
      if (!existing.image && resolvedImg) existing.image = resolvedImg;
      if (!existing.validity && validity) existing.validity = validity;
      if (!existing.stock && raw.stock) existing.stock = `${raw.stock} UND`;
      if (!existing.packaging && packaging) {
        existing.packaging = packaging;
        existing.packagingType = raw.packagingType;
        existing.packagingQuantity = raw.packagingQuantity;
        existing.packagingUnit = raw.packagingUnit;
        existing.packagingWeight = raw.packagingWeight;
      }
      return;
    }

    const prod: EncarteProduct = {
      id: `p-${Date.now()}-${products.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      packaging,
      packagingType: raw.packagingType,
      packagingQuantity: raw.packagingQuantity,
      packagingUnit: raw.packagingUnit,
      packagingWeight: raw.packagingWeight,
      validity,
      price: raw.price ? formatPrice(raw.price) : "", // Regra de negócio: preço manual e vazio no início
      unit: deriveSaleUnit(packaging).unit,
      stock: raw.stock ? `${raw.stock} UND` : "",
      badge: "nenhum",
      image: resolvedImg,
      included: raw.included !== undefined ? raw.included : true,
      productUrl: raw.productUrl,
    };

    products.push(prod);
    productByCode.set(code, prod);
  };

  // 1. Procurar em JSON-LD (ItemList ou múltiplos Products)
  const ldList = findJsonLd(html);
  for (const block of ldList) {
    if (block?.["@type"] === "ItemList" && Array.isArray(block.itemListElement)) {
      for (const el of block.itemListElement) {
        const item = el.item || el;
        const name = item.name || el.name;
        if (name) {
          const img = typeof item.image === "string" ? item.image : item.image?.url || (Array.isArray(item.image) ? item.image[0] : "");
          const safeImg = !/banners?\/|\/selos?\/|\/badges?\/|logo/i.test(img) ? img : "";
          const parsedPack = parsePackaging(name) || parsePackaging(item.description);
          addProduct({
            name,
            code: item.sku || item.productID || item.identifier,
            image: safeImg,
            packaging: parsedPack?.label || "",
            packagingType: parsedPack?.tipo,
            packagingQuantity: parsedPack?.quantidade,
            packagingUnit: parsedPack?.unidadeMedida,
            packagingWeight: parsedPack?.gramatura,
          });
        }
      }
    } else if (block?.["@type"] === "Product" || (Array.isArray(block?.["@type"]) && block["@type"].includes("Product"))) {
      const name = block.name;
      if (name) {
        const img = typeof block.image === "string" ? block.image : block.image?.url || (Array.isArray(block.image) ? block.image[0] : "");
        const safeImg = !/banners?\/|\/selos?\/|\/badges?\/|logo/i.test(img) ? img : "";
        const parsedPack = parsePackaging(name) || parsePackaging(block.description);
        addProduct({
          name,
          code: block.sku || block.productID || block.identifier,
          image: safeImg,
          packaging: parsedPack?.label || "",
          packagingType: parsedPack?.tipo,
          packagingQuantity: parsedPack?.quantidade,
          packagingUnit: parsedPack?.unidadeMedida,
          packagingWeight: parsedPack?.gramatura,
        });
      }
    }
  }

  // 2. Parser HTML estruturado com node-html-parser
  const root = parse(html);

  const candidateSelectors = [
    ".products-list__item",
    "tr.cart-table__row",
    ".product-card",
    ".product-item",
    ".produto-item",
    ".shelf-item",
    ".product-box",
    "[data-codigo-produto]",
    "[data-id-produto]",
    "[data-sku]",
    "article",
  ];

  let cardElements: HTMLElement[] = [];
  for (const sel of candidateSelectors) {
    const matched = root.querySelectorAll(sel).filter((el) => {
      if (el.rawTagName === "tr" && el.querySelector("th")) return false;
      return el.text.trim().length > 5;
    });
    if (matched.length > 0) {
      cardElements = matched;
      break;
    }
  }

  const topCards = cardElements.filter((el) => {
    let parent = el.parentNode as HTMLElement | null;
    while (parent && parent !== root) {
      if (cardElements.includes(parent)) return false;
      parent = parent.parentNode as HTMLElement | null;
    }
    return true;
  });

  for (const card of topCards) {
    // Código / SKU
    let code = (
      card.querySelector("[data-codigo-produto]")?.getAttribute("data-codigo-produto") ||
      card.querySelector("[data-id-produto]")?.getAttribute("data-id-produto") ||
      card.querySelector("[data-sku]")?.getAttribute("data-sku") ||
      card.getAttribute("data-codigo-produto") ||
      card.getAttribute("data-id-produto") ||
      card.getAttribute("data-sku") ||
      card.text.match(/(?:código|cód|ref|sku)[:.\s]*([A-Za-z0-9_-]+)/i)?.[1] ||
      ""
    ).trim();

    // Nome
    const nameEl =
      card.querySelector(".product-card__name a") ||
      card.querySelector(".product-card__name") ||
      card.querySelector(".product-title, .title, .nome, [data-nome]") ||
      card.querySelector("h2, h3, h4") ||
      card.querySelector("a[data-click='produto']");

    let rawName = nameEl ? nameEl.text : "";
    if (!rawName) {
      const imgWithAlt = card
        .querySelectorAll("img")
        .find((img) => !isBadgeOrBanner(img, card) && img.getAttribute("alt"));
      if (imgWithAlt) rawName = imgWithAlt.getAttribute("alt") || "";
    }
    const name = decode(rawName).toUpperCase().slice(0, 120);
    if (!name || name.length < 2) continue;

    // Link do produto
    const linkEl = card.querySelector("a[href*='/']") || (card.rawTagName === "a" ? card : null);
    let productUrl = "";
    if (linkEl) {
      const href = linkEl.getAttribute("href") || "";
      try {
        productUrl = new URL(href, baseUrl).toString();
      } catch {
        productUrl = href;
      }
    }

    // Validade
    const valEl = card.querySelector(".product-card__rating-subtitle, .validade, .vencimento, [data-validade]");
    let validity = "";
    if (valEl) {
      const vm = valEl.text.match(/([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/);
      if (vm) validity = vm[1].replace(/-/g, "/");
    }
    if (!validity) {
      const vm = card.text.match(/(?:validade|vencimento|val|venc)[\s:.]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i);
      if (vm) validity = vm[1].replace(/-/g, "/");
    }

    // Estoque
    const stockMatch =
      card.querySelector("[data-estoque], [data-stock]")?.getAttribute("data-estoque") ||
      card.text.match(/(?:estoque|saldo|qtd|unidades)[:.\s]*(\d+)/i)?.[1] ||
      "";

    // Imagem do card
    const rawImg = extractCardImage(card, code);

    // Seletor de opções de compra (embalagem, tipo, quantidade):
    // Quando a página tiver seletor de opções, cada opção vira uma linha com tipo e embalagem.
    // O usuário escolhe qual entra no encarte.
    const optionCandidates: string[] = [];
    const selectOpts = card.querySelectorAll(
      "select option, .product-card__embalagem-select option, .product__options option"
    );
    for (const opt of selectOpts) {
      const txt = opt.text.trim();
      if (txt && !txt.toLowerCase().includes("selecione") && parsePackaging(txt)) {
        optionCandidates.push(txt);
      }
    }

    if (optionCandidates.length === 0) {
      const featEls = card.querySelectorAll(".product__features--embalagem-nome");
      for (const f of featEls) {
        const txt = f.text.replace(/embalagem\s*:\s*/i, "").trim();
        if (txt && parsePackaging(txt)) {
          optionCandidates.push(txt);
        }
      }
    }

    if (optionCandidates.length === 0) {
      const packEl = card.querySelector(".embalagem, .pack, [data-embalagem]");
      const txt = packEl ? (packEl.getAttribute("data-embalagem") || packEl.text).trim() : "";
      if (txt && parsePackaging(txt)) {
        optionCandidates.push(txt);
      } else {
        const fromName = parsePackaging(name);
        if (fromName) {
          optionCandidates.push(fromName.label);
        }
      }
    }

    if (optionCandidates.length > 0) {
      // Cada opção vira uma linha com tipo e embalagem
      optionCandidates.forEach((optStr, optIdx) => {
        const parsed = parsePackaging(optStr);
        const optCode = optIdx === 0 ? code : `${code}-OP${optIdx + 1}`;
        addProduct({
          code: optCode,
          name,
          validity,
          packaging: parsed?.label || "",
          packagingType: parsed?.tipo,
          packagingQuantity: parsed?.quantidade,
          packagingUnit: parsed?.unidadeMedida,
          packagingWeight: parsed?.gramatura,
          stock: stockMatch,
          image: rawImg,
          included: optIdx === 0, // Primeira opção marcada, opções secundárias para o usuário escolher
          productUrl,
        });
      });
    } else {
      // Sem embalagem identificada: não preencher padrão ("1 UN"), deixar em branco
      addProduct({
        code,
        name,
        validity,
        packaging: "",
        stock: stockMatch,
        image: rawImg,
        included: true,
        productUrl,
      });
    }
  }

  // 5. Garantir que a mesma imagem não seja atribuída a vários produtos diferentes
  const imgToCodes = new Map<string, Set<string>>();
  for (const p of products) {
    if (p.image) {
      const baseCode = p.code.replace(/-OP\d+$/, "");
      if (!imgToCodes.has(p.image)) {
        imgToCodes.set(p.image, new Set());
      }
      imgToCodes.get(p.image)!.add(baseCode);
    }
  }
  for (const p of products) {
    if (p.image) {
      const distinctCodes = imgToCodes.get(p.image);
      if (distinctCodes && distinctCodes.size > 1) {
        p.image = ""; // Mesma imagem em produtos DIFERENTES -> tratar como inválida para acionar fallback
      }
    }
  }

  return products;
}
