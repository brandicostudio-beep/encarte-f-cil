/**
 * Cliente e utilitários para integração com o Google Drive v3 REST API
 * via conector Google Drive do Lovable.
 */

export interface GoogleDriveLinkInfo {
  url: string;
  type: "folder" | "file";
  id: string;
}

export interface DriveIndexedPhoto {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  code: string;
  suffixOrder: number;
  suffixLabel: string;
  isPrimary: boolean;
  folderId?: string;
  folderPath?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
}

export type DriveApiErrorCode =
  | "not_connected"
  | "not_found_or_forbidden"
  | "token_expired"
  | "quota_exceeded"
  | "empty"
  | "corrupt_files"
  | "generic";

export interface DriveIndexResult {
  ok: boolean;
  folder?: DriveFolderInfo;
  totalImages: number;
  indexedPhotos: DriveIndexedPhoto[];
  subfolderCount: number;
  ambiguousCodes: string[];
  error?: DriveApiErrorCode;
  errorMessage?: string;
  corruptFiles?: { id: string; name: string; reason: string }[];
}

export interface DriveDownloadResult {
  ok: boolean;
  photos: {
    code: string;
    fileId: string;
    filename: string;
    dataUrl: string;
    modifiedTime: string;
    isPrimary: boolean;
  }[];
  corruptFiles: { code: string; fileId: string; filename: string; reason: string }[];
  error?: DriveApiErrorCode;
  errorMessage?: string;
}

export const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
export const SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/**
 * Analisa e extrai o ID e tipo de um link do Google Drive.
 * Suporta:
 * - Pastas: drive.google.com/drive/folders/<id> ou drive/u/0/folders/<id>
 * - Arquivos / ZIP: drive.google.com/file/d/<id>/view ou open?id=<id>
 * - Links com parâmetros: ?id=<id> ou &id=<id>
 */
export function parseGoogleDriveUrl(rawUrl: string): GoogleDriveLinkInfo | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();

  // 1. Pasta: /drive/folders/<id> ou /drive/u/0/folders/<id>
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
 * Extrai o código do produto e a ordem do sufixo a partir do nome do arquivo.
 * Regras:
 * - "24657.jpg" -> code: "24657", suffixOrder: 0, suffixLabel: ""
 * - "24657-1.jpg" -> code: "24657", suffixOrder: 1, suffixLabel: "-1"
 * - "24657-2.jpg" -> code: "24657", suffixOrder: 2, suffixLabel: "-2"
 * - "24657_1.png" -> code: "24657", suffixOrder: 1, suffixLabel: "_1"
 * - "24657 (1).webp" -> code: "24657", suffixOrder: 1, suffixLabel: " (1)"
 * - "24657_frente.jpg" -> code: "24657", suffixOrder: 100, suffixLabel: "_frente"
 */
export function parsePhotoCodeAndSuffix(
  filename: string,
  knownCodes: string[] = []
): { code: string; suffixOrder: number; suffixLabel: string } | null {
  if (!filename) return null;
  const basename = filename.split("/").pop()?.split("\\").pop() || filename;

  if (!SUPPORTED_IMAGE_EXTENSIONS.test(basename)) {
    return null;
  }

  const cleanBase = basename.replace(SUPPORTED_IMAGE_EXTENSIONS, "").trim();
  if (!cleanBase) return null;

  // 1. Se códigos conhecidos forem fornecidos, testa correspondência com prioridade
  if (knownCodes && knownCodes.length > 0) {
    const sorted = [...knownCodes].sort((a, b) => b.length - a.length);
    for (const rawCode of sorted) {
      const c = rawCode.trim();
      if (!c) continue;

      if (cleanBase.toLowerCase() === c.toLowerCase()) {
        return { code: c, suffixOrder: 0, suffixLabel: "" };
      }

      if (cleanBase.toLowerCase().startsWith(c.toLowerCase())) {
        const remainder = cleanBase.slice(c.length);
        const numericMatch = remainder.match(/^[-_ ]?\(?(\d+)\)?$/);
        if (numericMatch) {
          const num = parseInt(numericMatch[1], 10);
          return { code: c, suffixOrder: isNaN(num) ? 50 : num, suffixLabel: remainder };
        }
        return { code: c, suffixOrder: 100, suffixLabel: remainder };
      }
    }
  }

  // 2. Extração heurística para arquivos sem knownCodes prévios:
  // "24657-1" -> code: "24657", num: 1
  const heuristicMatch = cleanBase.match(/^([a-zA-Z0-9]+)(?:[-_ ]?\(?(\d+)\)?|[-_ ](.+))?$/);
  if (heuristicMatch) {
    const code = heuristicMatch[1];
    if (heuristicMatch[2]) {
      const num = parseInt(heuristicMatch[2], 10);
      return {
        code,
        suffixOrder: isNaN(num) ? 50 : num,
        suffixLabel: cleanBase.slice(code.length),
      };
    }
    if (heuristicMatch[3]) {
      return {
        code,
        suffixOrder: 100,
        suffixLabel: cleanBase.slice(code.length),
      };
    }
    return { code, suffixOrder: 0, suffixLabel: "" };
  }

  return { code: cleanBase, suffixOrder: 0, suffixLabel: "" };
}

/**
 * Configuração de autenticação para chamadas à Drive API.
 * - Com `token` explícito (testes): chama a API do Google diretamente.
 * - Sem token (produção): usa o conector Google Drive do Lovable via gateway,
 *   com LOVABLE_API_KEY + GOOGLE_DRIVE_API_KEY do ambiente do servidor.
 */
export interface DriveRequestConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

export function getDriveRequestConfig(token?: string | null): DriveRequestConfig | null {
  if (token) {
    return {
      baseUrl: "https://www.googleapis.com/drive/v3",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    };
  }
  if (typeof process === "undefined" || !process.env) return null;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !connectionKey) return null;
  return {
    baseUrl: "https://connector-gateway.lovable.dev/google_drive/drive/v3",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
    },
  };
}

interface FetchDriveOptions {
  folderId: string;
  token?: string | null;
  knownCodes?: string[];
  fetchFn?: typeof fetch;
}

/**
 * Lista recursivamente todos os arquivos de imagem de uma pasta do Google Drive
 * e suas subpastas usando a Google Drive API v3.
 *
 * - Lê apenas metadados (id, name, mimeType, size, modifiedTime).
 * - Pagina com pageSize 1000 e pageToken.
 * - Suporta subpastas recursivas (mimeType application/vnd.google-apps.folder).
 * - Filtra estritamente jpg, jpeg, png e webp.
 * - Associa por código e define a imagem primária e alternativas.
 */
export async function listDriveFolderFilesRecursively({
  folderId,
  token,
  knownCodes = [],
  fetchFn = fetch,
}: FetchDriveOptions): Promise<DriveIndexResult> {
  const config = getDriveRequestConfig(token);

  if (!config) {
    return {
      ok: false,
      totalImages: 0,
      indexedPhotos: [],
      subfolderCount: 0,
      ambiguousCodes: [],
      error: "not_connected",
      errorMessage:
        "O conector do Google Drive não está conectado neste workspace do Lovable. Ative o conector no painel do Lovable ou use a alternativa de upload via arquivo .ZIP.",
    };
  }

  const { baseUrl, headers } = config;

  // 1. Buscar metadados da pasta raiz (nome)
  let folderInfo: DriveFolderInfo = { id: folderId, name: "Pasta do Google Drive" };
  try {
    const metaUrl = `${baseUrl}/files/${encodeURIComponent(
      folderId
    )}?fields=id,name,mimeType,trashed&supportsAllDrives=true`;
    const metaRes = await fetchFn(metaUrl, { headers });

    if (metaRes.status === 401) {
      return {
        ok: false,
        totalImages: 0,
        indexedPhotos: [],
        subfolderCount: 0,
        ambiguousCodes: [],
        error: "token_expired",
        errorMessage:
          "A conexão com o Google Drive expirou. Por favor, reconecte sua conta no painel de conectores do Lovable.",
      };
    }

    if (metaRes.status === 403 || metaRes.status === 404) {
      const errBody = await metaRes.text().catch(() => "");
      if (errBody.includes("rateLimitExceeded") || errBody.includes("userRateLimitExceeded")) {
        return {
          ok: false,
          totalImages: 0,
          indexedPhotos: [],
          subfolderCount: 0,
          ambiguousCodes: [],
          error: "quota_exceeded",
          errorMessage:
            "Limite de cota da API do Google Drive atingido. Por favor, aguarde alguns minutos e tente novamente.",
        };
      }
      return {
        ok: false,
        totalImages: 0,
        indexedPhotos: [],
        subfolderCount: 0,
        ambiguousCodes: [],
        error: "not_found_or_forbidden",
        errorMessage:
          "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive.",
      };
    }

    if (metaRes.ok) {
      const metaJson = await metaRes.json();
      if (metaJson && metaJson.name) {
        folderInfo = { id: metaJson.id || folderId, name: metaJson.name };
      }
    }
  } catch (err: unknown) {
    // Falha de rede genérica na meta da pasta
    console.warn("Falha ao obter metadados da pasta raiz do Drive:", err);
  }

  // 2. Fila de pastas para varredura recursiva
  const folderQueue: { id: string; path: string }[] = [{ id: folderId, path: "" }];
  const visitedFolders = new Set<string>();

  const rawImageFiles: {
    id: string;
    name: string;
    mimeType: string;
    size?: number;
    modifiedTime?: string;
    folderId: string;
    folderPath: string;
  }[] = [];

  let subfolderCount = 0;
  const corruptFiles: { id: string; name: string; reason: string }[] = [];

  while (folderQueue.length > 0) {
    const current = folderQueue.shift();
    if (!current || visitedFolders.has(current.id)) continue;
    visitedFolders.add(current.id);

    let pageToken: string | null = null;

    do {
      const q = `'${current.id}' in parents and trashed = false`;
      let listUrl = `${baseUrl}/files?q=${encodeURIComponent(
        q
      )}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      if (pageToken) {
        listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      let res: Response;
      try {
        res = await fetchFn(listUrl, { headers });
      } catch {
        corruptFiles.push({
          id: current.id,
          name: current.path || folderInfo.name,
          reason: "Falha na comunicação de rede ao ler subpasta",
        });
        break;
      }

      if (res.status === 401) {
        return {
          ok: false,
          totalImages: 0,
          indexedPhotos: [],
          subfolderCount,
          ambiguousCodes: [],
          error: "token_expired",
          errorMessage:
            "A conexão com o Google Drive expirou. Por favor, reconecte sua conta no painel de conectores do Lovable.",
        };
      }

      if (res.status === 403) {
        const errBody = await res.text().catch(() => "");
        if (errBody.includes("rateLimitExceeded") || errBody.includes("userRateLimitExceeded")) {
          return {
            ok: false,
            totalImages: 0,
            indexedPhotos: [],
            subfolderCount,
            ambiguousCodes: [],
            error: "quota_exceeded",
            errorMessage:
              "Limite de cota da API do Google Drive atingido. Por favor, aguarde alguns minutos e tente novamente.",
          };
        }
        return {
          ok: false,
          totalImages: 0,
          indexedPhotos: [],
          subfolderCount,
          ambiguousCodes: [],
          error: "not_found_or_forbidden",
          errorMessage:
            "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive.",
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          totalImages: 0,
          indexedPhotos: [],
          subfolderCount,
          ambiguousCodes: [],
          error: "not_found_or_forbidden",
          errorMessage:
            "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive.",
        };
      }

      interface DriveFileListResponse {
        nextPageToken?: string;
        files?: {
          id: string;
          name: string;
          mimeType: string;
          size?: string | number;
          modifiedTime?: string;
        }[];
      }

      const data: DriveFileListResponse = await res.json();
      const files = data.files || [];

      for (const item of files) {
        if (!item.id || !item.name) continue;

        // Subpasta
        if (item.mimeType === "application/vnd.google-apps.folder") {
          subfolderCount++;
          const subPath = current.path ? `${current.path}/${item.name}` : item.name;
          folderQueue.push({ id: item.id, path: subPath });
          continue;
        }

        // Filtro estrito: apenas jpg, jpeg, png, webp
        const isImageExt = SUPPORTED_IMAGE_EXTENSIONS.test(item.name);
        const isImageMime = item.mimeType ? SUPPORTED_IMAGE_MIMES.has(item.mimeType) : false;

        if (isImageExt || isImageMime) {
          rawImageFiles.push({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType || "image/jpeg",
            size: typeof item.size === "string" ? parseInt(item.size, 10) : item.size,
            modifiedTime: item.modifiedTime,
            folderId: current.id,
            folderPath: current.path,
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);
  }

  // Se a listagem voltar vazia:
  // "Se a listagem voltar vazia ou com erro 404, mostre: 'A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive.'"
  if (rawImageFiles.length === 0) {
    return {
      ok: false,
      folder: folderInfo,
      totalImages: 0,
      indexedPhotos: [],
      subfolderCount,
      ambiguousCodes: [],
      error: "empty",
      errorMessage:
        "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive.",
    };
  }

  // 3. Associação por código e ordenação de sufixos
  // Agrupar arquivos por código
  const photosByCode = new Map<
    string,
    {
      id: string;
      name: string;
      mimeType: string;
      size?: number;
      modifiedTime?: string;
      folderId: string;
      folderPath: string;
      code: string;
      suffixOrder: number;
      suffixLabel: string;
    }[]
  >();

  for (const file of rawImageFiles) {
    const parsed = parsePhotoCodeAndSuffix(file.name, knownCodes);
    if (!parsed) continue;

    const codeKey = parsed.code.toLowerCase().trim();
    if (!photosByCode.has(codeKey)) {
      photosByCode.set(codeKey, []);
    }

    photosByCode.get(codeKey)!.push({
      ...file,
      code: parsed.code,
      suffixOrder: parsed.suffixOrder,
      suffixLabel: parsed.suffixLabel,
    });
  }

  const indexedPhotos: DriveIndexedPhoto[] = [];
  const ambiguousCodes: string[] = [];

  for (const [codeKey, fileList] of photosByCode.entries()) {
    // Ordenar: menor suffixOrder primeiro (0 sem sufixo, depois 1, 2, ...), depois nome alfabético
    fileList.sort((a, b) => {
      if (a.suffixOrder !== b.suffixOrder) {
        return a.suffixOrder - b.suffixOrder;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    if (fileList.length > 1) {
      ambiguousCodes.push(fileList[0].code);
    }

    fileList.forEach((item, index) => {
      indexedPhotos.push({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        modifiedTime: item.modifiedTime,
        code: item.code,
        suffixOrder: item.suffixOrder,
        suffixLabel: item.suffixLabel,
        isPrimary: index === 0,
        folderId: item.folderId,
        folderPath: item.folderPath,
      });
    });
  }

  return {
    ok: true,
    folder: folderInfo,
    totalImages: indexedPhotos.length,
    indexedPhotos,
    subfolderCount,
    ambiguousCodes,
    corruptFiles: corruptFiles.length > 0 ? corruptFiles : undefined,
  };
}

interface DownloadFileOptions {
  fileId: string;
  token?: string | null;
  fetchFn?: typeof fetch;
}

/**
 * Baixa o conteúdo binário de uma foto via files/{id}?alt=media e converte para Data URL.
 */
export async function downloadDriveFileMedia({
  fileId,
  token,
  fetchFn = fetch,
}: DownloadFileOptions): Promise<{ dataUrl: string; mimeType: string } | null> {
  const config = getDriveRequestConfig(token);
  if (!config || !fileId) return null;

  const url = `${config.baseUrl}/files/${encodeURIComponent(
    fileId
  )}?alt=media&supportsAllDrives=true`;

  const res = await fetchFn(url, {
    headers: config.headers,
  });

  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());

  // Se o buffer for muito pequeno ou vazio
  if (buf.length < 16) return null;

  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }

  const base64 = btoa(binary);
  return {
    dataUrl: `data:${contentType};base64,${base64}`,
    mimeType: contentType,
  };
}

interface DownloadCampaignItemsOptions {
  items: {
    id: string;
    code: string;
    filename: string;
    modifiedTime?: string;
    isPrimary?: boolean;
  }[];
  token?: string | null;
  fetchFn?: typeof fetch;
  concurrency?: number;
}

/**
 * Baixa somente as imagens dos produtos da campanha atual.
 * Se algum arquivo estiver corrompido ou inacessível, pula e registra na lista de pendências.
 */
export async function downloadCampaignPhotosFromDrive({
  items,
  token,
  fetchFn = fetch,
  concurrency = 4,
}: DownloadCampaignItemsOptions): Promise<DriveDownloadResult> {
  const config = getDriveRequestConfig(token);

  if (!config) {
    return {
      ok: false,
      photos: [],
      corruptFiles: [],
      error: "not_connected",
      errorMessage:
        "O conector do Google Drive não está conectado neste workspace do Lovable.",
    };
  }

  const downloadedPhotos: DriveDownloadResult["photos"] = [];
  const corruptFiles: DriveDownloadResult["corruptFiles"] = [];

  // Execução paralela controlada
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        const media = await downloadDriveFileMedia({
          fileId: item.id,
          token,
          fetchFn,
        });

        if (media && media.dataUrl) {
          downloadedPhotos.push({
            code: item.code,
            fileId: item.id,
            filename: item.filename,
            dataUrl: media.dataUrl,
            modifiedTime: item.modifiedTime || "",
            isPrimary: item.isPrimary ?? true,
          });
        } else {
          corruptFiles.push({
            code: item.code,
            fileId: item.id,
            filename: item.filename,
            reason: "Arquivo corrompido ou bytes de imagem inválidos",
          });
        }
      } catch (err) {
        corruptFiles.push({
          code: item.code,
          fileId: item.id,
          filename: item.filename,
          reason: err instanceof Error ? err.message : "Erro no download do arquivo",
        });
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    () => worker()
  );
  await Promise.all(workers);

  return {
    ok: true,
    photos: downloadedPhotos,
    corruptFiles,
  };
}
