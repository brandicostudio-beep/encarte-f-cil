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
 * Extrai múltiplos produtos de uma página de categoria ou busca de fornecedor (ex: "validade próxima").
 */
export function parseCategoryHtml(html: string, baseUrl: string): EncarteProduct[] {
  const products: EncarteProduct[] = [];
  const seenCodes = new Set<string>();

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

    // Gerar código único se não encontrado
    let code = (raw.code || "").trim().replace(/[^\w-]/g, "");
    if (!code) {
      code = String(10000 + products.length + 1);
    }
    if (seenCodes.has(code)) {
      code = `${code}-${products.length + 1}`;
    }
    seenCodes.add(code);

    // Tentar deduzir embalagem a partir do nome se não fornecido
    let packaging = (raw.packaging || "").trim().toUpperCase();
    if (!packaging) {
      const packMatch =
        name.match(/(\d+\s*X\s*\d+\s*(?:GR|G|KG|ML|L|UN))\b/i) ||
        name.match(/(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i);
      if (packMatch) packaging = (packMatch[1] ?? "").replace(/\s+/g, " ");
      else packaging = "1 UN";
    }

    // Tentar deduzir validade
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

    products.push({
      id: `p-${Date.now()}-${products.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      packaging,
      validity,
      price: raw.price ? formatPrice(raw.price) : "", // Regra 2: campo de preço vazio inicialmente
      unit: packaging.toLowerCase().includes("kg") ? "KG" : "UND",
      stock: raw.stock ? `${raw.stock} UND` : "",
      badge: "nenhum",
      image: resolvedImg,
      included: true,
    });
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
          addProduct({
            name,
            code: item.sku || item.productID || item.identifier,
            image: img,
          });
        }
      }
    } else if (block?.["@type"] === "Product" || (Array.isArray(block?.["@type"]) && block["@type"].includes("Product"))) {
      const name = block.name;
      if (name) {
        const img = typeof block.image === "string" ? block.image : block.image?.url || (Array.isArray(block.image) ? block.image[0] : "");
        addProduct({
          name,
          code: block.sku || block.productID || block.identifier,
          image: img,
        });
      }
    }
  }

  // 2. Heurística de HTML: Procurar cartões de produtos
  if (products.length === 0) {
    const cardRegex = /<(?:article|div|li)[^>]+class=["'][^"']*(?:product|produto|shelf-item|card|item)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;
    let cardMatch;
    let count = 0;

    while ((cardMatch = cardRegex.exec(html)) !== null && count < 60) {
      const card = cardMatch[1];
      if (!card) continue;

      // Nome
      const nameMatch =
        card.match(/<(?:h[2-4]|a|span)[^>]+class=["'][^"']*(?:title|name|nome|descricao)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[2-4]|a|span)>/i) ||
        card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i) ||
        card.match(/<img[^>]+alt=["']([^"']{3,100})["']/i);

      if (!nameMatch) continue;
      const rawName = decode((nameMatch[1] ?? "").replace(/<[^>]+>/g, ""));
      if (!rawName || rawName.length < 3) continue;

      // Imagem
      const imgMatch = card.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i);
      const imgSrc = imgMatch ? (imgMatch[1] ?? "") : "";

      // Código / SKU
      const codeMatch =
        card.match(/(?:data-sku|data-product-id|data-id)=["']([^"']+)["']/i) ||
        card.match(/(?:cód|código|sku|ref)[:.\s]*([A-Za-z0-9_-]+)/i);
      const code = codeMatch ? (codeMatch[1] ?? "") : "";

      // Validade
      const valMatch = card.match(/(?:validade|vencimento|val|venc)[\s:.]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i);
      const validity = valMatch ? (valMatch[1] ?? "").replace(/-/g, "/") : "";

      // Embalagem
      const packMatch =
        card.match(/(\d+\s*X\s*\d+\s*(?:GR|G|KG|ML|L|UN))\b/i) ||
        rawName.match(/(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i);
      const packaging = packMatch ? (packMatch[1] ?? "") : "";

      // Estoque
      const stockMatch = card.match(/(?:estoque|saldo|qtd|unidades)[:.\s]*(\d+)/i);
      const stock = stockMatch ? (stockMatch[1] ?? "") : "";

      addProduct({
        name: rawName,
        code,
        image: imgSrc,
        validity,
        packaging,
        stock,
      });
      count++;
    }
  }

  return products;
}
