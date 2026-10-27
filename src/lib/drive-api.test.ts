import { describe, it, expect } from "vitest";
import {
  parseGoogleDriveUrl,
  parsePhotoCodeAndSuffix,
  listDriveFolderFilesRecursively,
  downloadCampaignPhotosFromDrive,
} from "./drive-api";
import {
  getCachedPhoto,
  setCachedPhoto,
  isPhotoCacheValid,
  clearDrivePhotoCache,
} from "./drive-cache";
import { matchPhotosWithProducts, type LoadedPhoto } from "./photo-bank";
import { extractPhotosFromZipBuffer } from "./drive-service";
import type { EncarteProduct } from "@/types/encarte";
import JSZip from "jszip";

describe("Google Drive API v3 (drive-api) & Conector Lovable", () => {
  it("Extrai corretamente o ID de URLs de pastas e arquivos do Google Drive", () => {
    const url1 = "https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs";
    const res1 = parseGoogleDriveUrl(url1);
    expect(res1?.type).toBe("folder");
    expect(res1?.id).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs");

    const url2 = "https://drive.google.com/drive/u/0/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345?usp=sharing";
    const res2 = parseGoogleDriveUrl(url2);
    expect(res2?.type).toBe("folder");
    expect(res2?.id).toBe("1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345");

    const url3 = "https://drive.google.com/file/d/1XyZ9876543210AbCdEfGhIjKlMnOpQrS/view";
    const res3 = parseGoogleDriveUrl(url3);
    expect(res3?.type).toBe("file");
    expect(res3?.id).toBe("1XyZ9876543210AbCdEfGhIjKlMnOpQrS");

    expect(parseGoogleDriveUrl("")).toBeNull();
    expect(parseGoogleDriveUrl("https://example.com")).toBeNull();
  });

  it("Analisa o código e a ordem de sufixo de fotos (24657.jpg vs 24657-1.jpg)", () => {
    const p1 = parsePhotoCodeAndSuffix("24657.jpg", ["24657"]);
    expect(p1?.code).toBe("24657");
    expect(p1?.suffixOrder).toBe(0);

    const p2 = parsePhotoCodeAndSuffix("24657-1.jpg", ["24657"]);
    expect(p2?.code).toBe("24657");
    expect(p2?.suffixOrder).toBe(1);

    const p3 = parsePhotoCodeAndSuffix("24657-2.png", ["24657"]);
    expect(p3?.code).toBe("24657");
    expect(p3?.suffixOrder).toBe(2);

    const p4 = parsePhotoCodeAndSuffix("24657_1.webp", ["24657"]);
    expect(p4?.code).toBe("24657");
    expect(p4?.suffixOrder).toBe(1);

    // Formatos não suportados retornam null (apenas jpg, jpeg, png, webp)
    expect(parsePhotoCodeAndSuffix("24657.pdf", ["24657"])).toBeNull();
    expect(parsePhotoCodeAndSuffix("planilha.xlsx", ["24657"])).toBeNull();
  });

  it("Associação por código: foto sem sufixo é principal, com sufixo fica como alternativa", () => {
    const loaded: LoadedPhoto[] = [
      { filename: "24657-2.jpg", dataUrl: "data:order2", extractedCode: "24657", source: "drive" },
      { filename: "24657.jpg", dataUrl: "data:order0", extractedCode: "24657", source: "drive" },
      { filename: "24657-1.jpg", dataUrl: "data:order1", extractedCode: "24657", source: "drive" },
    ];

    const products: EncarteProduct[] = [
      {
        id: "prod-1",
        code: "24657",
        name: "BISCOITO RECHEADO",
        packaging: "1X130 GR",
        validity: "15/12/2026",
        price: "3,99",
        unit: "UND",
        badge: "nenhum",
        image: "https://origin.com/old.jpg",
        included: true,
      },
    ];

    const matched = matchPhotosWithProducts(loaded, products, "drive");
    expect(matched.matchedCount).toBe(1);

    const prod = matched.updatedProducts[0];
    // A imagem principal deve ser a sem sufixo (24657.jpg)
    expect(prod.image).toBe("data:order0");
    expect(prod.photoSource).toBe("drive");
    expect(prod.photoOriginName).toBe("24657.jpg");

    // As demais fotos ficam como alternativas
    expect(prod.alternativePhotos).toBeDefined();
    expect(prod.alternativePhotos).toHaveLength(2);
    expect(prod.alternativePhotos?.map((a) => a.filename)).toEqual(["24657-1.jpg", "24657-2.jpg"]);
    expect(matched.ambiguousCodes).toContain("24657");
  });

  it("Associação com menor sufixo: quando não há foto sem sufixo, 24657-1.jpg é a principal", () => {
    const loaded: LoadedPhoto[] = [
      { filename: "24657-3.jpg", dataUrl: "data:order3", extractedCode: "24657" },
      { filename: "24657-1.jpg", dataUrl: "data:order1", extractedCode: "24657" },
    ];

    const products: EncarteProduct[] = [
      {
        id: "prod-1",
        code: "24657",
        name: "CAFÉ",
        packaging: "1X500 GR",
        validity: "20/12/2026",
        price: "15,90",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const matched = matchPhotosWithProducts(loaded, products, "drive");
    const prod = matched.updatedProducts[0];
    expect(prod.image).toBe("data:order1");
    expect(prod.alternativePhotos).toHaveLength(1);
    expect(prod.alternativePhotos?.[0]?.filename).toBe("24657-3.jpg");
  });

  it("Testa pasta com foto simples, sufixo -1, subpasta e código sem foto", async () => {
    // Mock do fetch da API do Google Drive v3
    const mockFetch: typeof fetch = async (input, init) => {
      const urlStr = String(input);

      const decodedUrl = decodeURIComponent(urlStr);

      // Metadados da pasta raiz
      if (urlStr.includes("files/root-folder-123?fields=")) {
        return new Response(JSON.stringify({ id: "root-folder-123", name: "Fotos Campanha Varejo" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Listagem da pasta raiz: contém 24657.jpg, 24657-1.jpg e 1 subpasta
      if (decodedUrl.includes("'root-folder-123' in parents")) {
        return new Response(
          JSON.stringify({
            files: [
              { id: "f-1", name: "24657.jpg", mimeType: "image/jpeg", size: 1024, modifiedTime: "2026-10-01T10:00:00Z" },
              { id: "f-2", name: "24657-1.jpg", mimeType: "image/jpeg", size: 2048, modifiedTime: "2026-10-01T10:05:00Z" },
              { id: "sub-1", name: "Bebidas", mimeType: "application/vnd.google-apps.folder" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Listagem da subpasta "Bebidas": contém 33104.png
      if (decodedUrl.includes("'sub-1' in parents")) {
        return new Response(
          JSON.stringify({
            files: [
              { id: "f-3", name: "33104.png", mimeType: "image/png", size: 5000, modifiedTime: "2026-10-02T12:00:00Z" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    };

    const result = await listDriveFolderFilesRecursively({
      folderId: "root-folder-123",
      token: "mock-valid-token",
      knownCodes: ["24657", "33104", "99999"], // 99999 é código sem foto
      fetchFn: mockFetch,
    });

    expect(result.ok).toBe(true);
    expect(result.folder?.name).toBe("Fotos Campanha Varejo");
    expect(result.subfolderCount).toBe(1);
    expect(result.totalImages).toBe(3);

    // Checa associação
    const indexed = result.indexedPhotos;
    const itemSimple = indexed.find((p) => p.name === "24657.jpg");
    expect(itemSimple?.isPrimary).toBe(true);

    const itemSuffix = indexed.find((p) => p.name === "24657-1.jpg");
    expect(itemSuffix?.isPrimary).toBe(false);

    const itemSubfolder = indexed.find((p) => p.name === "33104.png");
    expect(itemSubfolder?.folderPath).toBe("Bebidas");
    expect(itemSubfolder?.isPrimary).toBe(true);

    // Código 99999 não possui imagem
    const code99999 = indexed.find((p) => p.code === "99999");
    expect(code99999).toBeUndefined();
  });

  it("Testa paginação com mais de 1000 arquivos usando pageToken", async () => {
    const page1Files = Array.from({ length: 1000 }, (_, i) => ({
      id: `p1-file-${i}`,
      name: `prod-${i}.jpg`,
      mimeType: "image/jpeg",
      size: 1000 + i,
      modifiedTime: "2026-10-01T00:00:00Z",
    }));

    const page2Files = Array.from({ length: 200 }, (_, i) => ({
      id: `p2-file-${i}`,
      name: `prod-${1000 + i}.jpg`,
      mimeType: "image/jpeg",
      size: 2000 + i,
      modifiedTime: "2026-10-01T00:00:00Z",
    }));

    const mockFetch: typeof fetch = async (input) => {
      const urlStr = String(input);

      if (urlStr.includes("files/big-folder?fields=")) {
        return new Response(JSON.stringify({ id: "big-folder", name: "Catálogo Geral (1200 itens)" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Página 1 (sem pageToken) retorna 1000 arquivos e nextPageToken = token-page-2
      if (!urlStr.includes("pageToken=")) {
        return new Response(
          JSON.stringify({
            nextPageToken: "token-page-2",
            files: page1Files,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Página 2 (com pageToken=token-page-2) retorna mais 200 arquivos e sem nextPageToken
      if (urlStr.includes("pageToken=token-page-2")) {
        return new Response(
          JSON.stringify({
            files: page2Files,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    };

    const res = await listDriveFolderFilesRecursively({
      folderId: "big-folder",
      token: "mock-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(true);
    expect(res.totalImages).toBe(1200);
    expect(res.indexedPhotos).toHaveLength(1200);
  });

  it("Tratamento de erros: Sem conexão (conector não conectado)", async () => {
    const res = await listDriveFolderFilesRecursively({
      folderId: "qualquer-folder",
      token: null, // Sem token
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("not_connected");
  });

  it("Tratamento de erros: Conexão expirada (401)", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "Invalid Credentials", code: 401 } }), {
        status: 401,
      });
    };

    const res = await listDriveFolderFilesRecursively({
      folderId: "qualquer-folder",
      token: "expired-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("token_expired");
    expect(res.errorMessage).toContain("A conexão com o Google Drive expirou");
  });

  it("Tratamento de erros: Pasta não encontrada ou sem permissão (404/403) exibe mensagem padronizada", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response("File not found", { status: 404 });
    };

    const res = await listDriveFolderFilesRecursively({
      folderId: "folder-inexistente",
      token: "valid-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("not_found_or_forbidden");
    expect(res.errorMessage).toBe(
      "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive."
    );
  });

  it("Tratamento de erros: Pasta vazia exibe mensagem padronizada", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const urlStr = String(input);
      if (urlStr.includes("files/empty-folder?fields=")) {
        return new Response(JSON.stringify({ id: "empty-folder", name: "Pasta Vazia" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ files: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await listDriveFolderFilesRecursively({
      folderId: "empty-folder",
      token: "valid-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("empty");
    expect(res.errorMessage).toBe(
      "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive."
    );
  });

  it("Tratamento de erros: Limite de cota do Drive (quotaExceeded)", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "rateLimitExceeded", code: 403 } }), {
        status: 403,
      });
    };

    const res = await listDriveFolderFilesRecursively({
      folderId: "folder-quota",
      token: "valid-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("quota_exceeded");
    expect(res.errorMessage).toContain("Limite de cota da API do Google Drive atingido");
  });

  it("Download sob demanda e Cache: reutiliza cache e só baixa novamente se modifiedTime mudou", async () => {
    clearDrivePhotoCache();

    // 1. Salvar foto no cache
    setCachedPhoto({
      code: "24657",
      fileId: "f-123",
      filename: "24657.jpg",
      modifiedTime: "2026-10-01T10:00:00Z",
      dataUrl: "data:image/jpeg;base64,cache-bytes-v1",
      cachedAt: Date.now(),
    });

    // 2. Verificar validade do cache
    expect(isPhotoCacheValid("24657", "f-123", "2026-10-01T10:00:00Z")).toBe(true);

    // Se o modifiedTime for mais recente no Drive, o cache é invalidado
    expect(isPhotoCacheValid("24657", "f-123", "2026-10-05T12:00:00Z")).toBe(false);

    // Se o fileId mudou, o cache é invalidado
    expect(isPhotoCacheValid("24657", "f-novo", "2026-10-01T10:00:00Z")).toBe(false);

    // Foto recuperada do cache
    const cached = getCachedPhoto("24657");
    expect(cached?.dataUrl).toBe("data:image/jpeg;base64,cache-bytes-v1");
  });

  it("Download de fotos da campanha: pula arquivo corrompido e registra sem quebrar o fluxo", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const urlStr = String(input);
      if (urlStr.includes("files/good-file?alt=media")) {
        const dummyBytes = new Uint8Array(64).fill(1);
        return new Response(dummyBytes, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      if (urlStr.includes("files/corrupt-file?alt=media")) {
        // Retorna bytes vazios ou erro 500
        return new Response(new Uint8Array(0), { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }
      return new Response("Not Found", { status: 404 });
    };

    const res = await downloadCampaignPhotosFromDrive({
      items: [
        { id: "good-file", code: "24657", filename: "24657.jpg" },
        { id: "corrupt-file", code: "33104", filename: "33104.jpg" },
      ],
      token: "valid-token",
      fetchFn: mockFetch,
    });

    expect(res.ok).toBe(true);
    expect(res.photos).toHaveLength(1);
    expect(res.photos[0].code).toBe("24657");
    expect(res.corruptFiles).toHaveLength(1);
    expect(res.corruptFiles[0].code).toBe("33104");
  });

  it("Mantém funcionamento contínuo de arquivos .ZIP", async () => {
    const zip = new JSZip();
    zip.file("24657.jpg", "fake-image-bytes-1");
    zip.file("33104-1.png", "fake-image-bytes-2");
    zip.file("documento.txt", "ignorar-este-arquivo");

    const buffer = await zip.generateAsync({ type: "uint8array" });
    const photos = await extractPhotosFromZipBuffer(buffer, ["24657", "33104"]);

    expect(photos).toHaveLength(2);
    expect(photos.map((p) => p.extractedCode)).toContain("24657");
    expect(photos.map((p) => p.extractedCode)).toContain("33104");
  });
});
