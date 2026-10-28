import { describe, it, expect, vi } from "vitest";
import {
  extractUniqueProductCodes,
  buildSingleQueryString,
  generateWindowsSearchBatches,
  copyQueryToClipboard,
} from "./windows-search-helper";
import { matchPhotosWithProducts, type LoadedPhoto } from "./photo-bank";
import { matchPhotoFilenameWithCode } from "./local-folder-service";
import type { EncarteProduct } from "@/types/encarte";

describe("Gerador de Busca para o Windows Explorer (windows-search-helper)", () => {
  it("Planilha com 19 produtos: gera uma consulta com 19 termos copiada sem alteração", () => {
    const codes = Array.from({ length: 19 }, (_, i) => `PROD_${i + 1}`);
    const result = generateWindowsSearchBatches(codes, { extension: "png", batchSize: 30 });

    expect(result.totalCodes).toBe(19);
    expect(result.batches.length).toBe(1);

    const b1 = result.batches[0]!;
    expect(b1.codesCount).toBe(19);
    expect(b1.batchIndex).toBe(1);
    expect(b1.totalBatches).toBe(1);

    // Formato exato NOME:="PROD_1.png" OR ... OR NOME:="PROD_19.png"
    const expectedTerms = codes.map((c) => `NOME:="${c}.png"`).join(" OR ");
    expect(b1.query).toBe(expectedTerms);
    expect(b1.query.endsWith(" ")).toBe(false);
    expect(b1.query.includes("\n")).toBe(false);
  });

  it("Planilha com 100 códigos: gera 4 lotes de 30, 30, 30 e 10 códigos", () => {
    const codes = Array.from({ length: 100 }, (_, i) => `COD_${i + 1}`);
    const result = generateWindowsSearchBatches(codes, { extension: "jpg", batchSize: 30 });

    expect(result.totalCodes).toBe(100);
    expect(result.batches.length).toBe(4);

    expect(result.batches[0]?.codesCount).toBe(30);
    expect(result.batches[0]?.batchIndex).toBe(1);
    expect(result.batches[0]?.totalBatches).toBe(4);

    expect(result.batches[1]?.codesCount).toBe(30);
    expect(result.batches[1]?.batchIndex).toBe(2);

    expect(result.batches[2]?.codesCount).toBe(30);
    expect(result.batches[2]?.batchIndex).toBe(3);

    expect(result.batches[3]?.codesCount).toBe(10);
    expect(result.batches[3]?.batchIndex).toBe(4);
  });

  it('Código com zeros à esquerda (0221) gera NOME:="0221.png"', () => {
    const query = buildSingleQueryString(["0221"], "png");
    expect(query).toBe('NOME:="0221.png"');
  });

  it("Código repetido aparece apenas uma vez na consulta", () => {
    const raw = ["14512", "0221", "14512", "  0221  ", "44", "44"];
    const unique = extractUniqueProductCodes(raw);
    expect(unique).toEqual(["14512", "0221", "44"]);

    const query = buildSingleQueryString(raw as string[], "png");
    expect(query).toBe('NOME:="14512.png" OR NOME:="0221.png" OR NOME:="44.png"');
  });

  it('Opção "ambas" gera dois termos por código (.png e .jpg)', () => {
    const query = buildSingleQueryString(["24657", "10982"], "ambas");
    expect(query).toBe(
      'NOME:="24657.png" OR NOME:="24657.jpg" OR NOME:="10982.png" OR NOME:="10982.jpg"'
    );
  });

  it("Não usar correspondência parcial: Arquivo 221.png não casa com o código 14221", () => {
    const matchRes = matchPhotoFilenameWithCode("221.png", "14221");
    expect(matchRes).toBeNull();

    const reverseMatch = matchPhotoFilenameWithCode("14221.png", "221");
    expect(reverseMatch).toBeNull();
  });

  it("Código sem foto aparece na lista de pendências depois do upload do ZIP", () => {
    // Simula fotos descompactadas de um ZIP
    const photosFromZip: LoadedPhoto[] = [
      {
        filename: "1001.png",
        dataUrl: "data:image/png;base64,sample1001",
        extractedCode: "1001",
        source: "zip",
      },
    ];

    const campaignProducts: EncarteProduct[] = [
      {
        id: "p1",
        code: "1001",
        name: "PRODUTO 1",
        packaging: "1 UN",
        validity: "15/12/2026",
        price: "10,00",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
      {
        id: "p2",
        code: "1002",
        name: "PRODUTO SEM FOTO NO ZIP",
        packaging: "1 UN",
        validity: "20/12/2026",
        price: "20,00",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const matchResult = matchPhotosWithProducts(photosFromZip, campaignProducts, "zip");
    expect(matchResult.matchedCount).toBe(1);

    // Produto 1002 permaneceu sem foto
    const p2Updated = matchResult.updatedProducts.find((p) => p.code === "1002");
    expect(p2Updated?.image).toBe("");

    // Produto 1001 recebeu a foto do ZIP
    const p1Updated = matchResult.updatedProducts.find((p) => p.code === "1001");
    expect(p1Updated?.image).toBe("data:image/png;base64,sample1001");
    expect(p1Updated?.photoSource).toBe("zip");
  });

  it("Botão copiar coloca o texto exato na área de transferência", async () => {
    let copiedText = "";
    const mockClipboard = {
      writeText: async (text: string) => {
        copiedText = text;
      },
    };

    const originalNavigator = global.navigator;
    try {
      (global as any).navigator = {
        clipboard: mockClipboard,
      };

      const queryToCopy = 'NOME:="14512.png" OR NOME:="221.png" OR NOME:="44.png"';
      const success = await copyQueryToClipboard(queryToCopy);

      expect(success).toBe(true);
      expect(copiedText).toBe(queryToCopy);
    } finally {
      (global as any).navigator = originalNavigator;
    }
  });

  it("Alerta de limite seguro quando lote excede 50 códigos ou 2000 caracteres", () => {
    const codes = Array.from({ length: 60 }, (_, i) => `PRODUTO_SUPER_LONGO_${i}`);
    const res = generateWindowsSearchBatches(codes, { extension: "ambas", batchSize: 60 });

    expect(res.batches.length).toBe(1);
    expect(res.batches[0]?.isAboveSafeLimit).toBe(true);
    expect(res.hasSafeLimitWarning).toBe(true);
  });
});
