const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ").trim();

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c) : "";
}

function findProductLd(html: string): any {
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocks) {
    try {
      const stack: any[] = [JSON.parse(b[1].trim())];
      while (stack.length) {
        const n = stack.pop();
        if (!n || typeof n !== "object") continue;
        if (Array.isArray(n)) { stack.push(...n); continue; }
        const t = n["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return n;
        if (n["@graph"]) stack.push(n["@graph"]);
      }
    } catch { /* ignore */ }
  }
  return null;
}

export function formatPrice(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null || raw === "") return "";
  let s = String(raw).replace(/[^\d.,]/g, "");
  if (!s) return "";
  if (s.includes(",") ) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return "";
  return n.toFixed(2).replace(".", ",");
}

export function parseProductHtml(html: string, baseUrl: string) {
  const ld = findProductLd(html);
  const offers = ld ? (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) : null;

  const name =
    meta(html, "og:title") || (ld?.name ? decode(String(ld.name)) : "") ||
    decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "") ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const description =
    meta(html, "og:description") || (ld?.description ? decode(String(ld.description).replace(/<[^>]+>/g, "")) : "") ||
    meta(html, "description");

  const price = formatPrice(
    meta(html, "product:price:amount") || meta(html, "og:price:amount") ||
      offers?.price || offers?.lowPrice || meta(html, "price") ||
      html.match(/R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/)?.[1],
  );

  let img = meta(html, "og:image") || meta(html, "og:image:url") || meta(html, "twitter:image");
  if (!img && ld?.image) {
    const i = Array.isArray(ld.image) ? ld.image[0] : ld.image;
    img = typeof i === "string" ? i : i?.url ?? "";
  }
  let imageUrl = "";
  try { if (img) imageUrl = new URL(img, baseUrl).toString(); } catch { /* ignore */ }

  return { name: name.slice(0, 200), description: description.slice(0, 600), price, imageUrl };
}
