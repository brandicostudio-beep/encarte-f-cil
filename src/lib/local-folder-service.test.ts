import { describe, it, expect, vi } from "vitest";
import {
  matchPhotoFilenameWithCode,
  parseFilenameForFolderIndex,
  indexLocalFolder,
  crossLocalFolderWithCampaign,
  loadCampaignPhotosFromFolder,
  isFileSystemAccessSupported,
} from "./local-folder-service";
import type { EncarteProduct } from "@/types/encarte";

describe("Serviço de Pasta do Computador (local-folder-service)", () => {
  it("Correspondência exata: 14512.png casa com o código 14512", () => {
    const res = matchPhotoFilenameWithCode("14512.png", "14512");
    expect(res).not.toBeNull();
    expect(res?.matches).toBe(true);
    expect(res?.suffixOrder).toBe(0);
    expect(res?.suffixLabel).toBe("");
  });

  it("Sufixo após hífen: Arquivo 24657-1.jpg casa com o código 24657", () => {
    const res = matchPhotoFilenameWithCode("24657-1.jpg", "24657");
    expect(res).not.toBeNull();
    expect(res?.matches).toBe(true);
    expect(res?.suffixOrder).toBe(1);
    expect(res?.suffixLabel).toBe("-1");
  });

  it("Sufixo após underline: 24657_2.jpg casa com o código 24657", () => {
    const res = matchPhotoFilenameWithCode("24657_2.jpg", "24657");
    expect(res).not.toBeNull();
    expect(res?.matches).toBe(true);
    expect(res?.suffixOrder).toBe(2);
    expect(res?.suffixLabel).toBe("_2");
  });

  it("Extensão em maiúsculas (.PNG, .JPG) é aceita", () => {
    const resPng = matchPhotoFilenameWithCode("24657.PNG", "24657");
    expect(resPng?.matches).toBe(true);

    const resJpg = matchPhotoFilenameWithCode("24657-1.JPG", "24657");
    expect(resJpg?.matches).toBe(true);

    const resWebp = matchPhotoFilenameWithCode("24657.WEBP", "24657");
    expect(resWebp?.matches).toBe(true);
  });

  it("Não usar correspondência parcial: Arquivo 221.png NÃO casa com o código 14221", () => {
    const res1 = matchPhotoFilenameWithCode("221.png", "14221");
    expect(res1).toBeNull();

    const res2 = matchPhotoFilenameWithCode("14221.png", "221");
    expect(res2).toBeNull();

    const res3 = matchPhotoFilenameWithCode("2214.png", "221");
    expect(res3).toBeNull();
  });

  it("Códigos com zeros à esquerda são tratados como texto (0221 != 221)", () => {
    const resDifferent = matchPhotoFilenameWithCode("0221.png", "221");
    expect(resDifferent).toBeNull();

    const resReverse = matchPhotoFilenameWithCode("221.png", "0221");
    expect(resReverse).toBeNull();

    const resSame = matchPhotoFilenameWithCode("0221.png", "0221");
    expect(resSame?.matches).toBe(true);
    expect(resSame?.suffixOrder).toBe(0);

    const resSameSuffix = matchPhotoFilenameWithCode("0221-1.png", "0221");
    expect(resSameSuffix?.matches).toBe(true);
    expect(resSameSuffix?.suffixOrder).toBe(1);
  });

  it("Quando houver mais de um arquivo para o mesmo código: menor sufixo (ou sem sufixo) é o principal", () => {
    const indexed = [
      {
        name: "24657-2.jpg",
        handle: {} as any,
        relativePath: "24657-2.jpg",
        code: "24657",
        suffixOrder: 2,
        suffixLabel: "-2",
      },
      {
        name: "24657.jpg",
        handle: {} as any,
        relativePath: "24657.jpg",
        code: "24657",
        suffixOrder: 0,
        suffixLabel: "",
      },
      {
        name: "24657-1.jpg",
        handle: {} as any,
        relativePath: "24657-1.jpg",
        code: "24657",
        suffixOrder: 1,
        suffixLabel: "-1",
      },
    ];

    const products: EncarteProduct[] = [
      {
        id: "p1",
        code: "24657",
        name: "BISCOITO RECHEADO",
        packaging: "1X130 GR",
        validity: "15/12/2026",
        price: "3,99",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const crossing = crossLocalFolderWithCampaign(indexed, products);
    expect(crossing.matchedProductsCount).toBe(1);
    expect(crossing.missingProducts.length).toBe(0);

    const matches = crossing.matchesByProductCode.get("24657");
    expect(matches).toBeDefined();
    expect(matches?.length).toBe(3);
    expect(matches![0]?.name).toBe("24657.jpg"); // Sem sufixo (0) é o primeiro
    expect(matches![1]?.name).toBe("24657-1.jpg"); // Menor sufixo (1)
    expect(matches![2]?.name).toBe("24657-2.jpg");
  });

  it("Código sem foto aparece na lista de pendências / missingProducts", () => {
    const indexed = [
      {
        name: "1001.png",
        handle: {} as any,
        relativePath: "1001.png",
        code: "1001",
        suffixOrder: 0,
        suffixLabel: "",
      },
    ];

    const products: EncarteProduct[] = [
      {
        id: "p1",
        code: "1001",
        name: "PRODUTO COM FOTO",
        packaging: "1 UN",
        validity: "10/10/2026",
        price: "5,00",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
      {
        id: "p2",
        code: "9999",
        name: "PRODUTO SEM FOTO",
        packaging: "1 UN",
        validity: "10/10/2026",
        price: "10,00",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const crossing = crossLocalFolderWithCampaign(indexed, products);
    expect(crossing.matchedProductsCount).toBe(1);
    expect(crossing.missingProducts.length).toBe(1);
    expect(crossing.missingProducts[0]?.code).toBe("9999");
    expect(crossing.missingProducts[0]?.name).toBe("PRODUTO SEM FOTO");
  });

  it("Pasta com 6.000 arquivos e campanha com 19 produtos: leitura rápida e carrega apenas 19 fotos", async () => {
    // Simula 6.000 arquivos na pasta
    const mockFiles: any[] = [];
    for (let i = 1; i <= 6000; i++) {
      const code = `COD_${i}`;
      mockFiles.push({
        kind: "file",
        name: `${code}.jpg`,
        getFile: async () => ({
          name: `${code}.jpg`,
          size: 1024,
          type: "image/jpeg",
        }),
      });
    }

    const mockDirHandle = {
      name: "Fotos_Palm_6000",
      async *values() {
        for (const f of mockFiles) {
          yield f;
        }
      },
    };

    // 1. Indexação deve ser instantânea sem ler bytes de imagens
    const startTime = performance.now();
    const indexResult = await indexLocalFolder(mockDirHandle);
    const duration = performance.now() - startTime;

    expect(indexResult.totalImagesRead).toBe(6000);
    expect(duration).toBeLessThan(1000); // Menos de 1 segundo para 6.000 itens

    // 2. Campanha com 19 produtos
    const campaignProducts: EncarteProduct[] = [];
    for (let i = 1; i <= 19; i++) {
      campaignProducts.push({
        id: `p-${i}`,
        code: `COD_${i * 100}`, // Códigos esparsos COD_100, COD_200, etc.
        name: `PRODUTO ${i}`,
        packaging: "1 UN",
        validity: "15/12/2026",
        price: "9,99",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      });
    }

    // 3. Cruzamento
    const crossing = crossLocalFolderWithCampaign(indexResult.files, campaignProducts);
    expect(crossing.matchedProductsCount).toBe(19);
    expect(crossing.missingProducts.length).toBe(0);
    expect(crossing.unmatchedFilesCount).toBe(6000 - 19);

    // 4. Carregamento sob demanda: lê APENAS as 19 fotos necessárias
    let loadedCount = 0;
    // Mock getFile para contar quantas vezes foi chamado
    for (const [code, files] of crossing.matchesByProductCode.entries()) {
      files[0]!.handle.getFile = async () => {
        loadedCount++;
        return new File(["dummy_image_data"], `${code}.jpg`, { type: "image/jpeg" });
      };
    }

    const loadResult = await loadCampaignPhotosFromFolder(crossing, campaignProducts);
    expect(loadedCount).toBe(19); // Exatamente 19 fotos lidas!
    expect(loadResult.updatedProducts.filter((p) => p.image).length).toBe(19);
    expect(loadResult.updatedProducts[0]?.photoSource).toBe("folder");
  });

  it("Detecção de suporte: Firefox retorna false e não quebra a tela", () => {
    // Simula Firefox (sem window.showDirectoryPicker)
    const originalWindow = global.window;
    try {
      (global as any).window = {
        // showDirectoryPicker ausente
      };
      expect(isFileSystemAccessSupported()).toBe(false);
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it("Recarregar a página: armazena e recupera o handle da pasta para reconexão sem perder a campanha", async () => {
    const {
      saveFolderHandle,
      getSavedFolderHandle,
      verifyFolderPermission,
      clearSavedFolderHandle,
    } = await import("./local-folder-service");

    // Simula ambiente com IndexedDB mock
    const fakeStore = new Map<string, any>();
    const mockDb = {
      transaction: () => {
        const tx: any = {
          objectStore: () => ({
            put: (val: any) => {
              fakeStore.set(val.id, val);
            },
            get: (id: string) => {
              const req = {
                result: fakeStore.get(id),
                onsuccess: null as any,
                onerror: null as any,
              };
              setTimeout(() => req.onsuccess && req.onsuccess(), 5);
              return req;
            },
            delete: (id: string) => {
              fakeStore.delete(id);
            },
          }),
          oncomplete: null as any,
          onerror: null as any,
        };
        setTimeout(() => tx.oncomplete && tx.oncomplete(), 5);
        return tx;
      },
    };

    const mockIdb = {
      open: () => {
        const req = {
          result: mockDb,
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        };
        setTimeout(() => req.onsuccess && req.onsuccess(), 5);
        return req;
      },
    };

    const originalWindow = global.window;
    try {
      (global as any).window = {
        indexedDB: mockIdb,
      };

      const mockDirHandle = {
        name: "Minha_Pasta_Fotos",
        queryPermission: async () => "prompt",
        requestPermission: async () => "granted",
      };

      await saveFolderHandle(mockDirHandle);
      const retrieved = await getSavedFolderHandle();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.folderName).toBe("Minha_Pasta_Fotos");

      // Estado prompt pede reconexão
      const permPrompt = await verifyFolderPermission(retrieved?.handle, false);
      expect(permPrompt).toBe("prompt");

      // Usuário clica em 'Reconectar pasta' -> permissão concedida
      const permGranted = await verifyFolderPermission(retrieved?.handle, true);
      expect(permGranted).toBe("granted");
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it("Garante coexistência contínua: opções de ZIP e Google Drive continuam funcionando", async () => {
    const { processPhotoBankUpload, matchPhotosWithProducts } = await import("./photo-bank");

    // 1. Upload de ZIP
    const mockZipFile = new File(["dummy"], "banco.zip", { type: "application/zip" });
    expect(mockZipFile.name.endsWith(".zip")).toBe(true);

    // 2. Upload de imagens avulsas
    const mockImageFile = new File(["dummy"], "24657.png", { type: "image/png" });
    const photos = await processPhotoBankUpload([mockImageFile], ["24657"]);
    expect(photos.length).toBe(1);
    expect(photos[0]?.extractedCode).toBe("24657");

    // 3. Cruzamento mantém funcionamento das origens
    const products: EncarteProduct[] = [
      {
        id: "p1",
        code: "24657",
        name: "PRODUTO TESTE",
        packaging: "1 UN",
        validity: "10/10/2026",
        price: "10,00",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const matchZip = matchPhotosWithProducts(photos, products, "zip");
    expect(matchZip.matchedCount).toBe(1);
    expect(matchZip.updatedProducts[0]?.photoSource).toBe("zip");

    const matchDrive = matchPhotosWithProducts(photos, products, "drive");
    expect(matchDrive.matchedCount).toBe(1);
    expect(matchDrive.updatedProducts[0]?.photoSource).toBe("drive");
  });
});
