import { parse, HTMLElement } from "node-html-parser";
import type { EncarteProduct } from "@/types/encarte";

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
    validity?: string | undefined;
    image?: string | undefined;
    stock?: string | undefined;
    price?: string | undefined;
  }) => {
    if (!raw.name || raw.name.length < 2) return;
    const name = decode(raw.name).toUpperCase().slice(0, 120);

    let code = (raw.code || "").trim().replace(/[^\w-]/g, "");
    if (!code) {
      code = String(10000 + products.length + 1);
    }

    let packaging = (raw.packaging || "").trim().toUpperCase();
    if (!packaging || /^\d{8,}$/.test(packaging)) {
      const packMatch =
        name.match(/(\d+\s*X\s*\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i) ||
        name.match(/(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i);
      if (packMatch) packaging = (packMatch[1] ?? "").replace(/\s+/g, " ");
      else packaging = "1 UN";
    }

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
      return;
    }

    const prod: EncarteProduct = {
      id: `p-${Date.now()}-${products.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      packaging,
      validity,
      price: raw.price ? formatPrice(raw.price) : "", // Regra de negócio: preço manual e vazio no início
      unit: packaging.toLowerCase().includes("kg") ? "KG" : "UND",
      stock: raw.stock ? `${raw.stock} UND` : "",
      badge: "nenhum",
      image: resolvedImg,
      included: true,
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
          // Ignorar se a URL do JSON-LD contiver banners/ ou selos
          const safeImg = !/banners?\/|\/selos?\/|\/badges?\/|logo/i.test(img) ? img : "";
          addProduct({
            name,
            code: item.sku || item.productID || item.identifier,
            image: safeImg,
          });
        }
      }
    } else if (block?.["@type"] === "Product" || (Array.isArray(block?.["@type"]) && block["@type"].includes("Product"))) {
      const name = block.name;
      if (name) {
        const img = typeof block.image === "string" ? block.image : block.image?.url || (Array.isArray(block.image) ? block.image[0] : "");
        const safeImg = !/banners?\/|\/selos?\/|\/badges?\/|logo/i.test(img) ? img : "";
        addProduct({
          name,
          code: block.sku || block.productID || block.identifier,
          image: safeImg,
        });
      }
    }
  }

  // 2. Parser HTML estruturado com node-html-parser (lê cards completos sem cortar em divs aninhadas)
  const root = parse(html);

  // Seletores candidatos a contêineres de cards de produtos
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
      // Ignorar cabeçalhos de tabela
      if (el.rawTagName === "tr" && el.querySelector("th")) return false;
      return el.text.trim().length > 5;
    });
    if (matched.length > 0) {
      cardElements = matched;
      break;
    }
  }

  // Evitar elementos aninhados duplicados (manter apenas os contêineres de topo)
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

    // Embalagem
    const packEl = card.querySelector(".embalagem, .pack, [data-embalagem]");
    let packaging = packEl ? (packEl.getAttribute("data-embalagem") || packEl.text).trim().toUpperCase() : "";

    // Estoque
    const stockMatch =
      card.querySelector("[data-estoque], [data-stock]")?.getAttribute("data-estoque") ||
      card.text.match(/(?:estoque|saldo|qtd|unidades)[:.\s]*(\d+)/i)?.[1] ||
      "";

    // Imagem do card
    const rawImg = extractCardImage(card, code);

    addProduct({
      code,
      name,
      validity,
      packaging,
      stock: stockMatch,
      image: rawImg,
    });
  }

  // 5. Garantir que a mesma imagem não seja atribuída a vários produtos diferentes
  // Se acontecer, tratar como imagem inválida para permitir posterior fallback
  const imgCounts = new Map<string, number>();
  for (const p of products) {
    if (p.image) {
      imgCounts.set(p.image, (imgCounts.get(p.image) || 0) + 1);
    }
  }
  for (const p of products) {
    if (p.image && (imgCounts.get(p.image) || 0) > 1) {
      p.image = ""; // Imagem duplicada invalidada
    }
  }

  return products;
}
