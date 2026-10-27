import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseProductHtml, parseCategoryHtml } from "./parse-product";
import type { EncarteProduct } from "@/types/encarte";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 8_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

export const extractProduct = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!/^https?:$/.test(u.protocol)) return { ok: false as const, error: "Use um link http(s) válido." };
    let html: string;
    try {
      const r = await fetch(u.toString(), {
        headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "pt-BR,pt;q=0.9" },
        redirect: "follow",
      });
      if (!r.ok)
        return {
          ok: false as const,
          error: `O site bloqueou a leitura da página (código ${r.status}). Preencha os dados manualmente.`,
        };
      html = (await r.text()).slice(0, 3_000_000);
    } catch {
      return { ok: false as const, error: "Não foi possível acessar o site. Preencha os dados manualmente." };
    }
    const p = parseProductHtml(html, u.toString());
    const image = p.imageUrl ? await toDataUrl(p.imageUrl) : null;
    const found = [p.name, p.description, p.price, image].filter(Boolean).length;
    return {
      ok: true as const,
      product: { name: p.name, description: p.description, price: p.price, image: image ?? "" },
      warning: found === 0 ? "O site não forneceu os dados do produto. Preencha manualmente." : undefined,
    };
  });

export const extractCategoryProducts = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!/^https?:$/.test(u.protocol)) return { ok: false as const, error: "Use um link http(s) válido." };
    let html: string;
    try {
      const r = await fetch(u.toString(), {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        redirect: "follow",
      });
      if (!r.ok) {
        return {
          ok: false as const,
          error: `O site bloqueou o acesso à categoria (código ${r.status}). Adicione os produtos manualmente ou cole uma lista.`,
        };
      }
      html = (await r.text()).slice(0, 5_000_000);
    } catch {
      return {
        ok: false as const,
        error: "Não foi possível acessar a página da categoria. Verifique o link ou adicione produtos manualmente.",
      };
    }

    const rawProducts = parseCategoryHtml(html, u.toString());
    if (rawProducts.length === 0) {
      return {
        ok: false as const,
        error: "Nenhum produto foi detectado automaticamente nesta página. Você pode adicionar manualmente ou colar a lista.",
      };
    }

    // Converter as imagens dos primeiros 24 produtos para Data URL se possível, para evitar problemas de CORS no canvas/PDF
    const products: EncarteProduct[] = await Promise.all(
      rawProducts.slice(0, 48).map(async (prod) => {
        if (prod.image && prod.image.startsWith("http")) {
          const dataUrl = await toDataUrl(prod.image);
          if (dataUrl) return { ...prod, image: dataUrl };
        }
        return prod;
      }),
    );

    return {
      ok: true as const,
      products,
      totalFound: rawProducts.length,
    };
  });

export const fetchImage = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => ({ image: await toDataUrl(data.url) }));
