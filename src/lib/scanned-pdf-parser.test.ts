import { describe, it, expect } from "vitest";
import {
  extractReportMetadata,
  parseQuantityAndStatusCell,
  parseScannedPdfLine,
  aggregateScannedRows,
  enrichProductsWithSiteData,
  parseScannedPdfReport,
  scannedProductToEncarteProduct,
} from "./scanned-pdf-parser";
import type { EncarteProduct } from "@/types/encarte";

describe("Scanned PDF Inventory Parser & OCR Rules", () => {
  describe("1. Leitura de Metadados e Cabeçalho do Relatório", () => {
    it("1.1 Extrai Período de Validade do cabeçalho", () => {
      const headerLines = [
        "CESCOM DISTRIBUIDORA DE ALIMENTOS LTDA",
        "RELATÓRIO DE ESTOQUE POR PRAZO DE VALIDADE",
        "Período de Validade: 29/10/2026 a 29/01/2027",
        "Código Descrição Validade % Tolerância QtDisp Status",
      ];

      const meta = extractReportMetadata(headerLines, 3);
      expect(meta.reportDate).toBe("29/10/2026 a 29/01/2027");
      expect(meta.periodStart).toBe("29/10/2026");
      expect(meta.periodEnd).toBe("29/01/2027");
      expect(meta.totalPages).toBe(3);
    });

    it("1.2 Identifica colunas esperadas e ignora % Tolerância", () => {
      const headerLines = [
        "Código Descrição Validade % Tolerância QtDisp Status",
      ];
      const meta = extractReportMetadata(headerLines);
      expect(meta.headerColumnsFound).toContain("Código");
      expect(meta.headerColumnsFound).toContain("Descrição");
      expect(meta.headerColumnsFound).toContain("Validade");
      expect(meta.headerColumnsFound).toContain("% Tolerância");
      expect(meta.headerColumnsFound).toContain("QtDisp");
      expect(meta.headerColumnsFound).toContain("Status");
      expect(meta.headerWarning).toBeUndefined();
    });

    it("1.3 Emite aviso caso o cabeçalho mude ou faltem colunas essenciais", () => {
      const modifiedHeader = ["Código Descrição Observacao Quantidade"];
      const meta = extractReportMetadata(modifiedHeader);
      expect(meta.headerWarning).toBeDefined();
      expect(meta.headerWarning).toContain("layout do relatório pode ter mudado");
    });
  });

  describe("2. Regras de Quantidade e Preço Manuscrito", () => {
    it("2.1 Se houver dois números, o primeiro é preço manuscrito e o último é quantidade", () => {
      // Exemplo: "3,50 43 NORMAL"
      const res = parseQuantityAndStatusCell("3,50 43 NORMAL");
      expect(res.precoManuscrito).toBe("3,50");
      expect(res.quantity).toBe(43);
      expect(res.status).toBe("NORMAL");
      expect(res.needsReview).toBe(false);

      // Exemplo com casas decimais ponto: "4.99 12 NORMAL"
      const res2 = parseQuantityAndStatusCell("4.99 12 NORMAL");
      expect(res2.precoManuscrito).toBe("4,99");
      expect(res2.quantity).toBe(12);
      expect(res2.status).toBe("NORMAL");
    });

    it("2.2 Descarte de nome de local antes do número (Estoque, Cozinha, Restaurante etc.)", () => {
      // "Estoque 43 NORMAL"
      const res1 = parseQuantityAndStatusCell("Estoque 43 NORMAL");
      expect(res1.quantity).toBe(43);
      expect(res1.status).toBe("NORMAL");

      // "Cozinha 15 NORMAL"
      const res2 = parseQuantityAndStatusCell("Cozinha 15 NORMAL");
      expect(res2.quantity).toBe(15);
      expect(res2.status).toBe("NORMAL");

      // "Restaurante 8 AVARIA"
      const res3 = parseQuantityAndStatusCell("Restaurante 8 AVARIA");
      expect(res3.quantity).toBe(0); // AVARIA não conta no estoque
      expect(res3.obs).toBe("AVARIA: 8 UND");
      expect(res3.status).toBe("AVARIA");
    });

    it("2.3 NORMAL conta no estoque, AVARIA vai para obs e não conta no total", () => {
      const normalRes = parseQuantityAndStatusCell("50 NORMAL");
      expect(normalRes.quantity).toBe(50);
      expect(normalRes.obs).toBeUndefined();

      const avariaRes = parseQuantityAndStatusCell("5 AVARIA");
      expect(avariaRes.quantity).toBe(0);
      expect(avariaRes.obs).toBe("AVARIA: 5 UND");
    });

    it("2.4 Quantidade não numérica ou status desconhecido vai para revisão", () => {
      // Quantidade não numérica
      const badQty = parseQuantityAndStatusCell("ABC NORMAL");
      expect(badQty.needsReview).toBe(true);
      expect(badQty.quantity).toBe(0);

      // Status desconhecido
      const unknownStatus = parseQuantityAndStatusCell("43 BLOQUEADO");
      expect(unknownStatus.needsReview).toBe(true);
      expect(unknownStatus.status).toBe("BLOQUEADO");
      expect(unknownStatus.reviewReason).toContain("Status 'BLOQUEADO' requer revisão manual");
    });

    it("2.5 % Tolerância puro (sem %) é ignorado e não vira preço nem estoque", () => {
      // "85 91,00 AVARIA" -> 85 é % Tolerância, 91 é qt, AVARIA não conta no estoque
      const res1 = parseQuantityAndStatusCell("85 91,00 AVARIA");
      expect(res1.precoManuscrito).toBeUndefined();
      expect(res1.quantity).toBe(0);
      expect(res1.obs).toBe("AVARIA: 91 UND");
      expect(res1.status).toBe("AVARIA");
      expect(res1.needsReview).toBe(false);

      // "80 256,00 NORMAL" -> 80 é tolerância, 256 é qt
      const res2 = parseQuantityAndStatusCell("80 256,00 NORMAL");
      expect(res2.precoManuscrito).toBeUndefined();
      expect(res2.quantity).toBe(256);
      expect(res2.status).toBe("NORMAL");
      expect(res2.needsReview).toBe(false);

      // "95 6,00 NORMAL" -> Ruffles 21818
      const res3 = parseQuantityAndStatusCell("95 6,00 NORMAL");
      expect(res3.precoManuscrito).toBeUndefined();
      expect(res3.quantity).toBe(6);
      expect(res3.status).toBe("NORMAL");

      // "95 10,00 NORMAL" -> Ruffles 23054
      const res4 = parseQuantityAndStatusCell("95 10,00 NORMAL");
      expect(res4.quantity).toBe(10);
    });

    it("2.6 Trata decimais brasileiros (,00) sem multiplicar por 100", () => {
      const res1 = parseQuantityAndStatusCell("50 440,00 NORMAL");
      expect(res1.quantity).toBe(440);

      const res2 = parseQuantityAndStatusCell("50 2,00 NORMAL");
      expect(res2.quantity).toBe(2);

      const res3 = parseQuantityAndStatusCell("50 101,00 NORMAL");
      expect(res3.quantity).toBe(101);
    });

    it("2.7 Identifica preço manuscrito e quantidade com % Tolerância", () => {
      // "50 1,99 440,00 AVARIA" -> 50 tolerância, 1,99 preço, 440 quantidade AVARIA
      const res1 = parseQuantityAndStatusCell("50 1,99 440,00 AVARIA");
      expect(res1.precoManuscrito).toBe("1,99");
      expect(res1.quantity).toBe(0);
      expect(res1.obs).toBe("AVARIA: 440 UND");

      // "50 49,90 71,00 NORMAL" -> 50 tolerância, 49,90 preço, 71 quantidade NORMAL
      const res2 = parseQuantityAndStatusCell("50 49,90 71,00 NORMAL");
      expect(res2.precoManuscrito).toBe("49,90");
      expect(res2.quantity).toBe(71);
      expect(res2.status).toBe("NORMAL");

      // "50 1,90 101,00 NORMAL"
      const res3 = parseQuantityAndStatusCell("50 1,90 101,00 NORMAL");
      expect(res3.precoManuscrito).toBe("1,90");
      expect(res3.quantity).toBe(101);
    });

    it("2.8 Tolera variações de OCR em status (ex: NQBM8L -> NORMAL, 8VABI8 -> AVARIA)", () => {
      const resNorm = parseQuantityAndStatusCell("80 25 NORMAL");
      expect(resNorm.status).toBe("NORMAL");

      const resAvaria = parseQuantityAndStatusCell("50 12 AVARIA");
      expect(resAvaria.status).toBe("AVARIA");
      expect(resAvaria.obs).toBe("AVARIA: 12 UND");
    });
  });

  describe("3. Validação Linha a Linha (parseScannedPdfLine)", () => {
    it("3.1 Extrai linha válida completa", () => {
      const line = "11782 MOLHO P/SALADA LIZA LIMAO 04/11/2026 80% 43 NORMAL";
      const parsed = parseScannedPdfLine(line, 1, 1);

      expect(parsed).not.toBeNull();
      expect(parsed?.code).toBe("11782");
      expect(parsed?.description).toBe("MOLHO P/SALADA LIZA LIMAO");
      expect(parsed?.validity).toBe("04/11/2026");
      expect(parsed?.quantity).toBe(43);
      expect(parsed?.status).toBe("NORMAL");
      expect(parsed?.needsReview).toBe(false);
      expect(parsed?.rawText).toBe(line);
    });

    it("3.2 Linha com leitura duvidosa preserva trecho original visível para revisão", () => {
      const lineDuvidosa = "??998 BISCOITO SEM VALIDADE 43 NORMAL";
      const parsed = parseScannedPdfLine(lineDuvidosa, 2, 1);

      expect(parsed).not.toBeNull();
      expect(parsed?.needsReview).toBe(true);
      expect(parsed?.rawText).toBe(lineDuvidosa);
    });
  });

  describe("4. Agregação e Atualização a Cada Upload", () => {
    it("4.1 Some por código, nunca por nome: nomes iguais com códigos diferentes são itens separados", () => {
      const rows = [
        {
          code: "1001",
          description: "SABONETE FLOR DE YPE",
          validity: "15/11/2026",
          quantity: 20,
          status: "NORMAL",
          rawText: "1001 SABONETE FLOR DE YPE 15/11/2026 20 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
        {
          code: "1002",
          description: "SABONETE FLOR DE YPE",
          validity: "15/11/2026",
          quantity: 30,
          status: "NORMAL",
          rawText: "1002 SABONETE FLOR DE YPE 15/11/2026 30 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
      ];

      const agg = aggregateScannedRows(rows);
      expect(agg).toHaveLength(2);
      expect(agg[0].code).toBe("1001");
      expect(agg[0].totalStock).toBe(20);
      expect(agg[1].code).toBe("1002");
      expect(agg[1].totalStock).toBe(30);
    });

    it("4.2 Se um código tiver mais de uma validade, mostra cada validade e o total do código", () => {
      const rows = [
        {
          code: "25154",
          description: "SALGADINHO GULAO BACON",
          validity: "17/11/2026",
          quantity: 5,
          status: "NORMAL",
          rawText: "25154 SALGADINHO GULAO BACON 17/11/2026 5 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
        {
          code: "25154",
          description: "SALGADINHO GULAO BACON",
          validity: "24/11/2026",
          quantity: 10,
          status: "NORMAL",
          rawText: "25154 SALGADINHO GULAO BACON 24/11/2026 10 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
      ];

      const agg = aggregateScannedRows(rows);
      expect(agg).toHaveLength(1);
      expect(agg[0].code).toBe("25154");
      expect(agg[0].totalStock).toBe(15);
      expect(agg[0].validityEntries).toHaveLength(2);
      expect(agg[0].validityEntries[0].validity).toBe("17/11/2026");
      expect(agg[0].validityEntries[0].quantity).toBe(5);
      expect(agg[0].validityEntries[1].validity).toBe("24/11/2026");
      expect(agg[0].validityEntries[1].quantity).toBe(10);
      expect(agg[0].validity).toBe("17/11/2026"); // validade mais próxima
    });

    it("4.3 Código novo é criado; existente tem validade e estoque substituídos", () => {
      const previousProducts: EncarteProduct[] = [
        {
          id: "prod-11782",
          code: "11782",
          name: "MOLHO LIZA",
          packaging: "1X234 ML",
          validity: "01/11/2026",
          price: "3,00",
          unit: "UND",
          stock: "20 UND",
          badge: "nenhum",
          image: "",
          included: true,
        },
      ];

      const newRows = [
        {
          code: "11782",
          description: "MOLHO P/SALADA LIZA LIMAO",
          validity: "04/11/2026",
          quantity: 43,
          status: "NORMAL",
          rawText: "11782 MOLHO P/SALADA LIZA LIMAO 04/11/2026 43 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
        {
          code: "99999",
          description: "PRODUTO NOVO",
          validity: "30/11/2026",
          quantity: 10,
          status: "NORMAL",
          rawText: "99999 PRODUTO NOVO 30/11/2026 10 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
      ];

      const agg = aggregateScannedRows(newRows, previousProducts);
      const updatedItem = agg.find((p) => p.code === "11782");
      const newItem = agg.find((p) => p.code === "99999");

      expect(updatedItem?.statusRelatorio).toBe("atualizado");
      expect(updatedItem?.totalStock).toBe(43);
      expect(updatedItem?.validity).toBe("04/11/2026");

      expect(newItem?.statusRelatorio).toBe("novo");
      expect(newItem?.totalStock).toBe(10);
    });

    it("4.4 Código ausente no novo relatório é marcado como 'fora do último relatório' e sai do total", () => {
      const previousProducts: EncarteProduct[] = [
        {
          id: "prod-antigo",
          code: "77777",
          name: "PRODUTO ESGOTADO",
          packaging: "1X1 UNID",
          validity: "10/11/2026",
          price: "5,00",
          unit: "UND",
          stock: "5 UND",
          badge: "nenhum",
          image: "",
          included: true,
        },
      ];

      const newRows = [
        {
          code: "88888",
          description: "OUTRO PRODUTO",
          validity: "20/11/2026",
          quantity: 12,
          status: "NORMAL",
          rawText: "88888 OUTRO PRODUTO 20/11/2026 12 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
      ];

      const agg = aggregateScannedRows(newRows, previousProducts);
      const esgotado = agg.find((p) => p.code === "77777");
      expect(esgotado).toBeDefined();
      expect(esgotado?.statusRelatorio).toBe("fora_do_ultimo_relatorio");
      expect(esgotado?.totalStock).toBe(0);
      expect(esgotado?.included).toBe(false);
    });

    it("4.5 Subir o mesmo PDF novamente não duplica estoque", () => {
      const rows = [
        {
          code: "11782",
          description: "MOLHO LIZA",
          validity: "04/11/2026",
          quantity: 43,
          status: "NORMAL",
          rawText: "11782 MOLHO LIZA 04/11/2026 43 NORMAL",
          needsReview: false,
          pageNumber: 1,
        },
      ];

      // Primeiro upload
      const agg1 = aggregateScannedRows(rows, []);
      expect(agg1[0].totalStock).toBe(43);

      const encarteProducts1 = agg1.map(scannedProductToEncarteProduct);

      // Segundo upload idêntico
      const agg2 = aggregateScannedRows(rows, encarteProducts1);
      expect(agg2[0].totalStock).toBe(43); // continua 43, não 86!
    });
  });

  describe("5. Unidade de Venda e Enriquecimento pelo Site", () => {
    it("5.1 Enriquece unidade de venda (UNIDADE, CAIXA, FARDO, PACOTE, DISPLAY) pelo site", () => {
      const aggProducts = [
        {
          code: "11782",
          description: "MOLHO P/SALADA LIZA LIMAO",
          validity: "04/11/2026",
          validityEntries: [{ validity: "04/11/2026", quantity: 43, status: "NORMAL" }],
          totalStock: 43,
          unit: "UND",
          unitSource: "padrao" as const,
          packaging: "",
          needsReview: false,
          reviewReasons: [],
          originalSnippets: [],
          included: true,
        },
        {
          code: "25154",
          description: "SALGADINHO GULAO BACON",
          validity: "17/11/2026",
          validityEntries: [{ validity: "17/11/2026", quantity: 5, status: "NORMAL" }],
          totalStock: 5,
          unit: "UND",
          unitSource: "padrao" as const,
          packaging: "",
          needsReview: false,
          reviewReasons: [],
          originalSnippets: [],
          included: true,
        },
      ];

      const siteProducts: EncarteProduct[] = [
        {
          id: "sp-1",
          code: "11782",
          name: "MOLHO P/SALADA LIZA LIMAO",
          packaging: "1X234 ML",
          validity: "04/11/2026",
          price: "3,00",
          unit: "UND",
          badge: "nenhum",
          image: "https://site.com/11782.png",
          productUrl: "https://site.com/produto/11782",
          included: true,
        },
        {
          id: "sp-2",
          code: "25154",
          name: "SALGADINHO GULAO BACON",
          packaging: "10X100 GR",
          validity: "17/11/2026",
          price: "19,23",
          unit: "CX",
          badge: "nenhum",
          image: "https://site.com/25154.png",
          productUrl: "https://site.com/produto/25154",
          included: true,
        },
      ];

      const enriched = enrichProductsWithSiteData(aggProducts, siteProducts);
      expect(enriched[0].unit).toBe("UND");
      expect(enriched[0].packaging).toBe("1X234 ML");
      expect(enriched[0].unitSource).toBe("site");

      expect(enriched[1].unit).toBe("CX");
      expect(enriched[1].packaging).toBe("10X100 GR");
      expect(enriched[1].unitSource).toBe("site");
    });

    it("5.2 Correção manual da unidade prevalece sobre o site e é marcada como 'manual'", () => {
      const aggProducts = [
        {
          code: "25154",
          description: "SALGADINHO GULAO BACON",
          validity: "17/11/2026",
          validityEntries: [{ validity: "17/11/2026", quantity: 5, status: "NORMAL" }],
          totalStock: 5,
          unit: "UND",
          unitSource: "padrao" as const,
          packaging: "10X100 GR",
          needsReview: false,
          reviewReasons: [],
          originalSnippets: [],
          included: true,
        },
      ];

      const siteProducts: EncarteProduct[] = [
        {
          id: "sp-2",
          code: "25154",
          name: "SALGADINHO GULAO BACON",
          packaging: "10X100 GR",
          validity: "17/11/2026",
          price: "19,23",
          unit: "CX",
          badge: "nenhum",
          image: "",
          included: true,
        },
      ];

      const manualUnits = new Map<string, string>();
      manualUnits.set("25154", "FD"); // usuário corrigiu manualmente para FARDO (FD)

      const enriched = enrichProductsWithSiteData(aggProducts, siteProducts, manualUnits);
      expect(enriched[0].unit).toBe("FD");
      expect(enriched[0].unitSource).toBe("manual");
    });

    it("5.3 Sem unidade no site e sem correção manual, linha vai para revisão", () => {
      const aggProducts = [
        {
          code: "33333",
          description: "PRODUTO SEM CADASTRO NO SITE",
          validity: "10/12/2026",
          validityEntries: [{ validity: "10/12/2026", quantity: 4, status: "NORMAL" }],
          totalStock: 4,
          unit: "UND",
          unitSource: "padrao" as const,
          packaging: "",
          needsReview: false,
          reviewReasons: [],
          originalSnippets: [],
          included: true,
        },
      ];

      const enriched = enrichProductsWithSiteData(aggProducts, []);
      expect(enriched[0].needsReview).toBe(true);
      expect(enriched[0].reviewReasons).toContain("Unidade de venda ausente (verificar no site ou corrigir manualmente)");
    });

    it("5.4 Descrição vem do PDF; se estiver vazia, vem da página do produto", () => {
      const aggProducts = [
        {
          code: "44444",
          description: "", // vazia no PDF
          validity: "10/12/2026",
          validityEntries: [{ validity: "10/12/2026", quantity: 2, status: "NORMAL" }],
          totalStock: 2,
          unit: "UND",
          unitSource: "padrao" as const,
          packaging: "",
          needsReview: false,
          reviewReasons: [],
          originalSnippets: [],
          included: true,
        },
      ];

      const siteProducts: EncarteProduct[] = [
        {
          id: "sp-4",
          code: "44444",
          name: "DETERGENTE YPE CLEAR 500ML",
          packaging: "24X500 ML",
          validity: "10/12/2026",
          price: "",
          unit: "CX",
          badge: "nenhum",
          image: "",
          included: true,
        },
      ];

      const enriched = enrichProductsWithSiteData(aggProducts, siteProducts);
      expect(enriched[0].description).toBe("DETERGENTE YPE CLEAR 500ML");
    });
  });

  describe("6. Relatório Completo Simulado", () => {
    it("6.1 Processa texto completo de relatório escaneado", async () => {
      const fullReportText = `
CESCOM DISTRIBUIDORA DE ALIMENTOS LTDA
RELATÓRIO DE ESTOQUE POR PRAZO DE VALIDADE
Período de Validade: 01/11/2026 a 30/11/2026
Código Descrição Validade % Tolerância QtDisp Status
11782 MOLHO P/SALADA LIZA LIMAO 04/11/2026 80% Estoque 43 NORMAL
45206 TRIDENT 21 S XSENSES INTENSE 09/11/2026 70% 24,90 4 NORMAL
24628 BEB.LAC.ITALAC.15GR COCO 12/11/2026 80% 2 NORMAL
25154 SALGADINHO GULAO BACON 17/11/2026 95% 5 NORMAL
25154 SALGADINHO GULAO BACON 25/11/2026 95% 10 NORMAL
3946 AZEITE ANDORINHA PURO LATA 21/11/2026 50% Restaurante 8 AVARIA
      `;

      const result = await parseScannedPdfReport(fullReportText);
      expect(result.ok).toBe(true);
      expect(result.metadata.reportDate).toBe("01/11/2026 a 30/11/2026");
      expect(result.aggregated.length).toBe(5);

      // 11782: descartou Estoque, qt = 43
      const liza = result.aggregated.find((p) => p.code === "11782");
      expect(liza?.totalStock).toBe(43);

      // 45206: primeiro número é preço manuscrito (24,90), qt = 4
      const trident = result.aggregated.find((p) => p.code === "45206");
      expect(trident?.precoManuscrito).toBe("24,90");
      expect(trident?.totalStock).toBe(4);

      // 25154: duas validades somadas
      const gulao = result.aggregated.find((p) => p.code === "25154");
      expect(gulao?.totalStock).toBe(15);
      expect(gulao?.validityEntries).toHaveLength(2);

      // 3946: AVARIA não conta no total
      const azeite = result.aggregated.find((p) => p.code === "3946");
      expect(azeite?.totalStock).toBe(0);
      expect(azeite?.obs).toBe("AVARIA: 8 UND");
    });

    it("6.2 Processa linhas reais do ERP com % Tolerância inteiro, preços manuscritos e avarias", async () => {
      const realReportText = `
1707 - Validade de produtos Page 2 of 5
Filial: 2 12/11/2026 09:45:54
Período de Validade: 12/11/2026 a 12/02/2027
Código Descrição Validade % Tolerância QtDisp Status
26465 BISC.FAZENDINHA LEITE MALTADO 17/12/2026 50 1,99 440,00 AVARIA
26465 BISC.FAZENDINHA LEITE MALTADO 17/12/2026 50 730,00 NORMAL
2607 LEITE CONDENSADO MOCA 10/12/2026 50 1,90 101,00 NORMAL
24853 DOCE DE LEITE BALDE 20/12/2026 50 Estoque 2,00 NORMAL
11096 CHOCOLATE BIS LAKA 15/12/2026 50 7,00 NORMAL
11096 CHOCOLATE BIS LAKA 22/12/2026 50 49,90 71,00 NORMAL
11096 CHOCOLATE BIS LAKA 29/12/2026 50 150,00 NORMAL
11793 BISC RECHEADO OREO 18/12/2026 50 2,00 NORMAL
11793 BISC RECHEADO OREO 25/12/2026 50 49,90 13,00 NORMAL
13830 CAFE 3 CORACOES EXTRA FORTE 30/12/2026 50 4,00 AVARIA
13830 CAFE 3 CORACOES EXTRA FORTE 30/12/2026 50 45,00 NORMAL
13830 CAFE 3 CORACOES EXTRA FORTE 30/12/2026 50 54,00 NORMAL
21818 SALGADINHO RUFFLES BATATA CES.SALSA 21/12/2026 95 6,00 NORMAL
23054 SALGADINHO RUFFLES BATATA CES.SALSA 21/12/2026 95 10,00 NORMAL
      `;

      const result = await parseScannedPdfReport(realReportText);
      expect(result.ok).toBe(true);
      expect(result.metadata.reportDate).toBe("12/11/2026 a 12/02/2027");

      // 26465: 440 AVARIA com preço 1,99 e 730 NORMAL -> estoque total = 730, preco = 1,99, obs = "AVARIA: 440 UND"
      const p26465 = result.aggregated.find((p) => p.code === "26465");
      expect(p26465).toBeDefined();
      expect(p26465?.totalStock).toBe(730);
      expect(p26465?.precoManuscrito).toBe("1,99");
      expect(p26465?.obs).toBe("AVARIA: 440 UND");

      // 2607: preço manuscrito 1,90 e estoque 101
      const p2607 = result.aggregated.find((p) => p.code === "2607");
      expect(p2607?.totalStock).toBe(101);
      expect(p2607?.precoManuscrito).toBe("1,90");

      // 24853: descarta Estoque, estoque = 2
      const p24853 = result.aggregated.find((p) => p.code === "24853");
      expect(p24853?.totalStock).toBe(2);

      // 11096: 3 entradas (7 + 71 + 150 = 228), preço manuscrito 49,90
      const p11096 = result.aggregated.find((p) => p.code === "11096");
      expect(p11096?.totalStock).toBe(228);
      expect(p11096?.precoManuscrito).toBe("49,90");
      expect(p11096?.validityEntries).toHaveLength(3);

      // 11793: 2 entradas (2 + 13 = 15), preço 49,90
      const p11793 = result.aggregated.find((p) => p.code === "11793");
      expect(p11793?.totalStock).toBe(15);
      expect(p11793?.precoManuscrito).toBe("49,90");

      // 13830: 4 AVARIA e (45 + 54 = 99) NORMAL
      const p13830 = result.aggregated.find((p) => p.code === "13830");
      expect(p13830?.totalStock).toBe(99);
      expect(p13830?.obs).toBe("AVARIA: 4 UND");

      // Ruffles 21818 e 23054
      const p21818 = result.aggregated.find((p) => p.code === "21818");
      expect(p21818?.totalStock).toBe(6);

      const p23054 = result.aggregated.find((p) => p.code === "23054");
      expect(p23054?.totalStock).toBe(10);
    });

    it("6.3 Só puxa os produtos com preço na frente; os sem preço não devem ser considerados (included: false)", async () => {
      const reportText = `
1707 - Validade de produtos
Período de Validade: 12/11/2026 a 12/02/2027
Código Descrição Validade % Tolerância QtDisp Status
26465 BISC.FAZENDINHA LEITE MALTADO 17/12/2026 50 1,99 440,00 NORMAL
6549 OLEO MILHO SINHA 18/12/2026 85 91,00 NORMAL
21818 SALGADINHO RUFFLES BATATA 21/12/2026 95 6,00 NORMAL
22694 MARIA MOLE MORANGO APTI 30/12/2026 50 5,00 43,00 NORMAL
      `;

      const result = await parseScannedPdfReport(reportText);
      expect(result.ok).toBe(true);
      expect(result.metadata.productsWithPrice).toBe(2);
      expect(result.metadata.productsWithoutPrice).toBe(2);

      const p26465 = result.aggregated.find((p) => p.code === "26465");
      expect(p26465?.included).toBe(true);
      expect(p26465?.precoManuscrito).toBe("1,99");

      const p22694 = result.aggregated.find((p) => p.code === "22694");
      expect(p22694?.included).toBe(true);
      expect(p22694?.precoManuscrito).toBe("5,00");

      const p6549 = result.aggregated.find((p) => p.code === "6549");
      expect(p6549?.included).toBe(false);
      expect(p6549?.precoManuscrito).toBeUndefined();

      const p21818 = result.aggregated.find((p) => p.code === "21818");
      expect(p21818?.included).toBe(false);
      expect(p21818?.precoManuscrito).toBeUndefined();

      // Ao converter para EncarteProduct:
      const encarte26465 = scannedProductToEncarteProduct(p26465!);
      expect(encarte26465.included).toBe(true);

      const encarte6549 = scannedProductToEncarteProduct(p6549!);
      expect(encarte6549.included).toBe(false);
    });
  });
});
