import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parse } from "node-html-parser";
import {
  parseProductHtml,
  parseCategoryHtml,
  getThumbnailFallbackUrl,
  parsePackaging,
} from "./parse-product";
import {
  parseGoogleDriveUrl,
  extractPhotosFromZipBuffer,
} from "./drive-service";
import {
  listDriveFolderFilesRecursively,
  downloadCampaignPhotosFromDrive,
  type DriveIndexedPhoto,
  type DriveApiErrorCode,
} from "./drive-api";
import { extractProductCodeFromFilename } from "./photo-bank";
import type { LoadedPhoto } from "./photo-bank";
import type { EncarteProduct } from "@/types/encarte";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
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

async function fetchProductDetails(url: string): Promise<{ packaging: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const html = await res.text();
    const root = parse(html);

    let packaging = "";
    const featEls = root.querySelectorAll(".product__features--embalagem-nome");
    for (const f of featEls) {
      const txt = f.text.replace(/embalagem\s*:\s*/i, "").trim();
      const parsed = parsePackaging(txt);
      if (parsed) {
        packaging = parsed.label;
        break;
      }
    }
    if (!packaging) {
      const selectOpts = root.querySelectorAll("select option, .product-card__embalagem-select option, .product__options option");
      for (const opt of selectOpts) {
        const parsed = parsePackaging(opt.text);
        if (parsed) {
          packaging = parsed.label;
          break;
        }
      }
    }
    return { packaging };
  } catch {
    return null;
  }
}

async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 12): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
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
        signal: AbortSignal.timeout(8000),
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
    const parsedPack = parsePackaging(p.name) || parsePackaging(p.description);

    return {
      ok: true as const,
      product: {
        name: p.name,
        description: p.description,
        price: p.price,
        image: image ?? "",
        packaging: parsedPack?.label || "",
      },
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
        signal: AbortSignal.timeout(12000),
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

    // Processar produtos com concorrência controlada:
    // 1. Converter imagens para Data URL para evitar bloqueios de CORS no canvas/PDF
    // 2. Aplicar fallback por código (ex.: Cescom agilecdn) se não houver foto válida no card
    // 3. Deixar com imagem vazia se não houver foto válida após o fallback
    // 4. Buscar embalagem na página do produto se não foi detectada no card da categoria
    const products: EncarteProduct[] = await pMap(
      rawProducts,
      async (prod) => {
        let finalImage = "";

        // 1. Se já tem imagem resolvida do card, validar e converter para Data URL
        if (prod.image && prod.image.startsWith("http")) {
          const dataUrl = await toDataUrl(prod.image);
          if (dataUrl) {
            finalImage = dataUrl;
          }
        }

        // 2. Fallback de imagem: se não houver foto válida no card (ou se falhou a conversão),
        // tentar montar a URL da miniatura pelo código e validar que é imagem válida antes de usar
        if (!finalImage && prod.code) {
          const cleanCode = prod.code.split("-")[0]; // caso tenha sufixo de opção
          const fallbackUrl = getThumbnailFallbackUrl(cleanCode, u.toString());
          if (fallbackUrl) {
            const dataUrl = await toDataUrl(fallbackUrl);
            if (dataUrl) {
              finalImage = dataUrl;
            }
          }
        }

        // 3. Embalagem: se não identificada no card, tentar enriquecer a partir da página do produto
        let finalPackaging = prod.packaging;
        if (!finalPackaging && prod.productUrl) {
          const details = await fetchProductDetails(prod.productUrl);
          if (details?.packaging) {
            finalPackaging = details.packaging;
          }
        }

        return {
          ...prod,
          image: finalImage,
          packaging: finalPackaging,
        };
      },
      12,
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

export const extractDrivePhotos = createServerFn({ method: "POST" })
  .validator((d: { url: string; knownCodes?: string[] }) =>
    z.object({
      url: z.string().url().max(2000),
      knownCodes: z.array(z.string()).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const rawUrl = data.url.trim();
    const linkInfo = parseGoogleDriveUrl(rawUrl);

    // Caso 1: Link direto de arquivo ZIP (Drive ou Cloud direto)
    if (!linkInfo && /\.zip(\?.*)?$/i.test(rawUrl)) {
      try {
        const res = await fetch(rawUrl, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          return { ok: false as const, error: `Falha ao baixar o arquivo .zip (código ${res.status}).` };
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        const photos = await extractPhotosFromZipBuffer(buf, data.knownCodes || []);
        return { ok: true as const, photos, totalFound: photos.length };
      } catch {
        return { ok: false as const, error: "Não foi possível baixar ou descompactar o arquivo .zip indicado." };
      }
    }

    if (!linkInfo) {
      return {
        ok: false as const,
        error: "Link do Google Drive não reconhecido. Certifique-se de colar o link de uma pasta (/drive/folders/...) ou arquivo (/file/d/...).",
      };
    }

    // Caso 2: Arquivo compartilhado no Drive (Arquivo ZIP ou Imagem única)
    if (linkInfo.type === "file") {
      try {
        let downloadUrl = `https://drive.usercontent.google.com/download?id=${linkInfo.id}&export=download`;
        let res = await fetch(downloadUrl, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(35000),
        });

        // Caso o Google mostre página de aviso para arquivos grandes
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            const html = await res.text();
            const confirmMatch = html.match(/confirm=([0-9A-Za-z_]+)/);
            if (confirmMatch) {
              const confirmedUrl = `https://drive.usercontent.google.com/download?id=${linkInfo.id}&export=download&confirm=${confirmMatch[1]}`;
              res = await fetch(confirmedUrl, {
                headers: { "User-Agent": UA },
                signal: AbortSignal.timeout(35000),
              });
            }
          }
        }

        if (!res.ok) {
          // Fallback para uc endpoint
          downloadUrl = `https://docs.google.com/uc?export=download&id=${linkInfo.id}&confirm=t`;
          res = await fetch(downloadUrl, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(35000),
          });
        }

        if (!res.ok) {
          return {
            ok: false as const,
            error: "Não foi possível baixar o arquivo do Google Drive. Verifique se as permissões de compartilhamento estão abertas ('Qualquer pessoa com o link pode ver').",
          };
        }

        const buf = new Uint8Array(await res.arrayBuffer());

        // Se for ZIP (magic bytes PK\x03\x04 ou PK\x05\x06)
        if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
          const photos = await extractPhotosFromZipBuffer(buf, data.knownCodes || []);
          if (photos.length === 0) {
            return {
              ok: false as const,
              error: "O arquivo .zip do Drive foi baixado com sucesso, mas nenhuma imagem válida (.jpg, .png, etc.) foi encontrada dentro dele.",
            };
          }
          return { ok: true as const, photos, totalFound: photos.length };
        }

        // Se for imagem avulsa
        const type = res.headers.get("content-type") || "image/jpeg";
        if (type.startsWith("image/")) {
          let bin = "";
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          const dataUrl = `data:${type};base64,${btoa(bin)}`;
          const code = (data.knownCodes && data.knownCodes[0]) || linkInfo.id;
          return {
            ok: true as const,
            photos: [{ filename: `${code}.jpg`, dataUrl, extractedCode: code }],
            totalFound: 1,
          };
        }

        return {
          ok: false as const,
          error: "O arquivo fornecido não é uma imagem nem um arquivo compactado (.zip) válido.",
        };
      } catch {
        return {
          ok: false as const,
          error: "Ocorreu um erro ao baixar o arquivo do Google Drive. Verifique o link e tente novamente.",
        };
      }
    }

    // Caso 3: Pasta compartilhada no Google Drive via Google Drive API v3
    if (linkInfo.type === "folder") {
      try {
        const indexResult = await listDriveFolderFilesRecursively({
          folderId: linkInfo.id,
          knownCodes: data.knownCodes || [],
        });

        if (!indexResult.ok) {
          return {
            ok: false as const,
            error:
              indexResult.errorMessage ||
              "Não foi possível acessar a pasta do Google Drive. Verifique as permissões de acesso.",
            errorCode: indexResult.error,
          };
        }

        // Determinar quais fotos baixar:
        // Prioriza as fotos dos produtos da campanha atual (knownCodes)
        const knownSet = new Set((data.knownCodes || []).map((c) => c.toLowerCase().trim()));
        let itemsToDownload: typeof indexResult.indexedPhotos = [];

        if (knownSet.size > 0) {
          itemsToDownload = indexResult.indexedPhotos.filter(
            (p) => knownSet.has(p.code.toLowerCase().trim()) && p.isPrimary
          );
        } else {
          // Se não há produtos na campanha ainda, baixa as primárias até um limite inicial razoável
          itemsToDownload = indexResult.indexedPhotos.filter((p) => p.isPrimary).slice(0, 50);
        }

        let downloadedPhotos: LoadedPhoto[] = [];
        let corruptFilesList: { id?: string; code?: string; name?: string; reason: string }[] = [];

        if (itemsToDownload.length > 0) {
          const downloadRes = await downloadCampaignPhotosFromDrive({
            items: itemsToDownload.map((item) => ({
              id: item.id,
              code: item.code,
              filename: item.name,
              modifiedTime: item.modifiedTime,
              isPrimary: item.isPrimary,
            })),
          });

          downloadedPhotos = downloadRes.photos.map((p) => ({
            filename: p.filename,
            dataUrl: p.dataUrl,
            extractedCode: p.code,
          }));

          corruptFilesList = downloadRes.corruptFiles.map((c) => ({
            id: c.fileId,
            code: c.code,
            name: c.filename,
            reason: c.reason,
          }));
        }

        return {
          ok: true as const,
          folderName: indexResult.folder?.name || "Pasta do Google Drive",
          photos: downloadedPhotos,
          totalFound: downloadedPhotos.length,
          totalImagesIndexed: indexResult.totalImages,
          indexedPhotos: indexResult.indexedPhotos,
          ambiguousCodes: indexResult.ambiguousCodes,
          subfolderCount: indexResult.subfolderCount,
          corruptFiles: corruptFilesList,
        };
      } catch (err) {
        console.error("Erro na leitura da pasta via Drive API:", err);
        return {
          ok: false as const,
          error: "Falha na comunicação com o Google Drive ao ler a pasta. Verifique a conexão e o link.",
          errorCode: "generic" as const,
        };
      }
    }

    return { ok: false as const, error: "Tipo de link não suportado." };
  });

export const indexDriveFolder = createServerFn({ method: "POST" })
  .validator((d: { url: string; knownCodes?: string[] }) =>
    z.object({
      url: z.string().url().max(2000),
      knownCodes: z.array(z.string()).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const linkInfo = parseGoogleDriveUrl(data.url.trim());
    if (!linkInfo || linkInfo.type !== "folder") {
      return {
        ok: false as const,
        error: "O link fornecido não é uma pasta válida do Google Drive.",
        errorCode: "not_found_or_forbidden" as DriveApiErrorCode,
      };
    }

    const result = await listDriveFolderFilesRecursively({
      folderId: linkInfo.id,
      knownCodes: data.knownCodes || [],
    });

    return result;
  });

export const downloadCampaignDrivePhotos = createServerFn({ method: "POST" })
  .validator((d: { items: { id: string; code: string; filename: string; modifiedTime?: string; isPrimary?: boolean }[] }) =>
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          code: z.string(),
          filename: z.string(),
          modifiedTime: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      ),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const result = await downloadCampaignPhotosFromDrive({
      items: data.items,
    });
    return result;
  });
