// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "proxy-image-dev-plugin",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith("/api/proxy-image")) {
              try {
                const parsedUrl = new URL(req.url, "http://localhost");
                const targetUrl = parsedUrl.searchParams.get("url");
                if (!targetUrl) {
                  res.statusCode = 400;
                  res.end("Missing url param");
                  return;
                }
                const upstream = await fetch(targetUrl, {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  },
                });
                res.statusCode = upstream.status;
                const contentType =
                  upstream.headers.get("content-type") || "image/jpeg";
                res.setHeader("Content-Type", contentType);
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                res.setHeader("Cache-Control", "public, max-age=604800, immutable");
                const buf = Buffer.from(await upstream.arrayBuffer());
                res.end(buf);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(err?.message || "Proxy error");
              }
            } else if (req.url && req.url.startsWith("/api/cescom-product")) {
              try {
                const parsedUrl = new URL(req.url, "http://localhost");
                const code = parsedUrl.searchParams.get("code")?.trim();
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                if (!code) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ ok: false, error: "Missing code" }));
                  return;
                }
                const upstream = await fetch(`https://www.cescom.com.br/busca?s=${encodeURIComponent(code)}`, {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  },
                });
                const html = await upstream.text();
                const { parse } = await import("node-html-parser");
                const root = parse(html);

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
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    ok: true,
                    product: {
                      code,
                      description: foundName.toUpperCase(),
                      image: `https://cescom.agilecdn.com.br/${code}_thumb_1.jpg`,
                      source: "cescom.com.br",
                    },
                  }));
                } else {
                  res.statusCode = 200;
                  res.end(JSON.stringify({ ok: false, error: "Produto não encontrado no site Cescom" }));
                }
              } catch (err: any) {
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: false, error: err?.message || "Erro de busca" }));
              }
            } else {
              next();
            }
          });
        },
      },
    ],
  },
});
