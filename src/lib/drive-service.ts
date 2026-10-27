import JSZip from "jszip";
import { extractProductCodeFromFilename } from "./photo-bank";
import type { LoadedPhoto } from "./photo-bank";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

export interface GoogleDriveLinkInfo {
  url: string;
  type: "folder" | "file";
  id: string;
}

/**
 * Analisa e extrai o ID e tipo de um link do Google Drive.
 * Suporta:
 * - Pastas: drive.google.com/drive/folders/<id> ou drive/u/0/folders/<id>
 * - Arquivos / ZIP: drive.google.com/file/d/<id>/view ou open?id=<id>
 * - Links diretos de download ou uc?id=<id>
 */
export function parseGoogleDriveUrl(rawUrl: string): GoogleDriveLinkInfo | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();

  // 1. Pasta: /drive/folders/<id>
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{15,})/i);
  if (folderMatch) {
    return { url, type: "folder", id: folderMatch[1] };
  }

  // 2. Arquivo: /file/d/<id>
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/i);
  if (fileMatch) {
    return { url, type: "file", id: fileMatch[1] };
  }

  // 3. Query param id: ?id=<id> ou &id=<id>
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/i);
  if (idMatch) {
    return { url, type: "file", id: idMatch[1] };
  }

  return null;
}

/**
 * Descompacta um buffer de arquivo .zip em memória e extrai as fotos com seus códigos de produto.
 */
export async function extractPhotosFromZipBuffer(
  buffer: ArrayBuffer | Uint8Array,
  knownCodes: string[] = []
): Promise<LoadedPhoto[]> {
  const zip = await JSZip.loadAsync(buffer);
  const loadedPhotos: LoadedPhoto[] = [];

  const entries = Object.keys(zip.files).filter(
    (path) => !path.startsWith("__MACOSX") && IMAGE_EXTENSIONS.test(path)
  );

  for (const path of entries) {
    const zipEntry = zip.files[path];
    if (zipEntry && !zipEntry.dir) {
      const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : ext === "svg"
          ? "image/svg+xml"
          : "image/jpeg";

      const base64 = await zipEntry.async("base64");
      const dataUrl = `data:${mime};base64,${base64}`;
      const filename = path.split("/").pop() || path;
      const extractedCode = extractProductCodeFromFilename(filename, knownCodes);

      loadedPhotos.push({
        filename,
        dataUrl,
        extractedCode,
      });
    }
  }

  return loadedPhotos;
}

/**
 * Raspa a página HTML de uma pasta pública do Google Drive em busca de arquivos de imagem.
 */
export function scrapeFolderHtmlFiles(html: string): { id: string; filename: string }[] {
  const results: { id: string; filename: string }[] = [];
  const seenIds = new Set<string>();

  // Padrão 1: Arrays JSON com [id, [filename, mime, ...]]
  // Ex: ["1a2b3c4d5e6f7g8h9i0j-k_l",["24657.jpg","image/jpeg"...]]
  const regex1 = /\["([a-zA-Z0-9_-]{25,50})",\s*\["([^"]+\.(?:jpe?g|png|webp|gif|svg))"/gi;
  let m1: RegExpExecArray | null;
  while ((m1 = regex1.exec(html)) !== null) {
    const id = m1[1];
    const filename = m1[2];
    if (id && filename && !seenIds.has(id)) {
      seenIds.add(id);
      results.push({ id, filename });
    }
  }

  // Padrão 2: data-id seguido de nome de arquivo
  const regex2 = /data-id="([a-zA-Z0-9_-]{25,50})"[^>]*?aria-label="([^"]+\.(?:jpe?g|png|webp|gif|svg))"/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = regex2.exec(html)) !== null) {
    const id = m2[1];
    const filename = m2[2];
    if (id && filename && !seenIds.has(id)) {
      seenIds.add(id);
      results.push({ id, filename });
    }
  }

  // Padrão 3: Procura qualquer ocorrência de id de arquivo associado a uma extensão de imagem
  if (results.length === 0) {
    const regex3 = /"([a-zA-Z0-9_-]{28,45})"[^"]{1,100}?"([a-zA-Z0-9_ -]+\.(?:jpe?g|png|webp))"/gi;
    let m3: RegExpExecArray | null;
    while ((m3 = regex3.exec(html)) !== null) {
      const id = m3[1];
      const filename = m3[2];
      if (id && filename && !seenIds.has(id)) {
        seenIds.add(id);
        results.push({ id, filename });
      }
    }
  }

  return results;
}
