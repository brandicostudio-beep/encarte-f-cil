import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  const err = captured ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);
  return new Response(renderErrorPage(err), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (env && typeof env === "object") {
      try {
        (globalThis as any).__CF_ENV__ = env;
      } catch {}
    }

    // Proxy de imagens remoto com CORS irrestrito para recorte transparente no canvas
    try {
      const reqUrl = new URL(request.url);
      if (reqUrl.pathname === "/api/proxy-image") {
        const targetUrl = reqUrl.searchParams.get("url");
        if (!targetUrl) {
          return new Response("Missing url param", { status: 400 });
        }
        const upstream = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });
        if (!upstream.ok) {
          return new Response(`Upstream error: ${upstream.status}`, {
            status: upstream.status,
          });
        }
        const contentType = upstream.headers.get("content-type") || "image/jpeg";
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Cache-Control": "public, max-age=604800, immutable",
          },
        });
      }

      // Busca oficial de produto no site https://www.cescom.com.br por código ou descrição
      if (reqUrl.pathname === "/api/cescom-product") {
        const code = reqUrl.searchParams.get("code")?.trim();
        const query = reqUrl.searchParams.get("q")?.trim();
        const searchTerm = code || query;
        if (!searchTerm) {
          return new Response(JSON.stringify({ ok: false, error: "Missing code or q" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
        try {
          const upstream = await fetch(`https://www.cescom.com.br/busca?s=${encodeURIComponent(searchTerm)}`, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            },
          });
          if (!upstream.ok) {
            return new Response(JSON.stringify({ ok: false, error: `Cescom HTTP ${upstream.status}` }), {
              status: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }
          const html = await upstream.text();
          const { parse } = await import("node-html-parser");
          const root = parse(html);

          if (query && !code) {
            const items: Array<{ code: string; description: string; image: string; source: string }> = [];
            const seenCodes = new Set<string>();
            const cards = root.querySelectorAll(".product-card, [data-codigo-produto]");
            for (const card of cards) {
              const cardCode =
                card.getAttribute("data-codigo-produto")?.trim() ||
                card.querySelector("[data-codigo-produto]")?.getAttribute("data-codigo-produto")?.trim() ||
                card.getAttribute("data-id-produto")?.trim() ||
                card.querySelector("[data-id-produto]")?.getAttribute("data-id-produto")?.trim() ||
                "";
              const name =
                card.getAttribute("data-nome")?.trim() ||
                card.querySelector("[data-nome]")?.getAttribute("data-nome")?.trim() ||
                card.querySelector(".product-card__name a")?.text?.trim() ||
                card.querySelector(".product-card__name")?.text?.trim() ||
                "";
              if (cardCode && name && !seenCodes.has(cardCode)) {
                seenCodes.add(cardCode);
                items.push({
                  code: cardCode,
                  description: name.toUpperCase(),
                  image: `https://cescom.agilecdn.com.br/${cardCode}_thumb_1.jpg`,
                  source: "cescom.com.br",
                });
                if (items.length >= 10) break;
              }
            }

            return new Response(
              JSON.stringify({
                ok: items.length > 0,
                products: items,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "public, max-age=3600",
                },
              }
            );
          }

          let foundName = "";
          const matches = root.querySelectorAll(`[data-codigo-produto='${code}'], [data-id-produto='${code}']`);
          for (const m of matches) {
            const dn = m.getAttribute("data-nome");
            if (dn && dn.trim()) { foundName = dn.trim(); break; }
            const cn = m.querySelector(".product-card__name")?.text?.trim();
            if (cn) { foundName = cn; break; }
          }
          if (!foundName) {
            const allCards = root.querySelectorAll(".product-card");
            for (const card of allCards) {
              if (card.text.includes(code)) {
                const name = card.querySelector(".product-card__name a")?.text?.trim()
                  || card.querySelector("[data-nome]")?.getAttribute("data-nome")
                  || card.querySelector(".product-card__name")?.text?.trim();
                if (name) { foundName = name; break; }
              }
            }
          }
          if (!foundName) {
            const first = root.querySelector(".product-card");
            if (first) {
              const name = first.querySelector(".product-card__name a")?.text?.trim()
                || first.querySelector("[data-nome]")?.getAttribute("data-nome")
                || first.querySelector(".product-card__name")?.text?.trim();
              if (name) { foundName = name; }
            }
          }

          if (foundName) {
            return new Response(
              JSON.stringify({
                ok: true,
                product: {
                  code,
                  description: foundName.toUpperCase(),
                  image: `https://cescom.agilecdn.com.br/${code}_thumb_1.jpg`,
                  source: "cescom.com.br",
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "public, max-age=86400",
                },
              }
            );
          }

          return new Response(JSON.stringify({ ok: false, error: "Produto não encontrado no site Cescom" }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err?.message || "Erro de busca" }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
      }
    } catch (err: any) {
      console.warn("Proxy image / lookup error:", err);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(error), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
