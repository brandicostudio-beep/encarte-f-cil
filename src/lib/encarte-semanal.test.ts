import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import {
  parseEncarteSemanalSpreadsheet,
} from "./encarte-semanal-parser";
import {
  calculateEncarteSemanalGridCells,
  paginateEncarteSemanalProducts,
} from "./encarte-semanal-layout";
import {
  matchPhotosWithSemanalProducts,
} from "./encarte-semanal-photos";
import {
  saveEncarteSemanalTemplate,
  loadEncarteSemanalTemplate,
  saveEncarteSemanalProducts,
  loadEncarteSemanalProducts,
  saveEncarteSemanalFooterText,
  loadEncarteSemanalFooterText,
  saveEncarteSemanalGridConfig,
  loadEncarteSemanalGridConfig,
  clearEncarteSemanalStorage,
  STORAGE_KEYS,
} from "./encarte-semanal-storage";
import {
  DEFAULT_ENCARTE_SEMANAL_CONFIG,
  DEFAULT_ENCARTE_SEMANAL_GRID,
  type EncarteSemanalProduct,
} from "@/types/encarte-semanal";

describe("Encarte Semanal - Regras de Negócio e Testes Obrigatórios", () => {
  beforeEach(() => {
    clearEncarteSemanalStorage();
  });

  // =========================================================================
  // Teste 1: Uma planilha com 20 códigos preenche as 20 células, com foto e descrição.
  // =========================================================================
  it("Teste 1: Uma planilha com 20 códigos preenche as 20 células, com foto e descrição", async () => {
    // 1. Cria uma planilha com 20 produtos (colunas codigo e descricao em ordem invertida)
    const rows = [
      ["Descrição Completa", "Outra Coluna Inútil", "Código"],
    ];

    for (let i = 1; i <= 20; i++) {
      rows.push([`PRODUTO TESTE ${i}`, `EXTRA ${i}`, `100${i}`]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Semanal");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "ofertas_semanais.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const parsed = await parseEncarteSemanalSpreadsheet(file);
    expect(parsed.success).toBe(true);
    expect(parsed.products.length).toBe(20);
    expect(parsed.validRows).toBe(20);

    // 2. Simula o casamento com 20 fotos
    const fakePhotos = parsed.products.map((p) => ({
      filename: `${p.code}.png`,
      dataUrl: `data:image/png;base64,fakePhotoData_${p.code}`,
      extractedCode: p.code,
    }));

    const matchResult = matchPhotosWithSemanalProducts(fakePhotos, parsed.products, "upload");
    expect(matchResult.matchedCount).toBe(20);

    // 3. Pagina os produtos na grade
    const pagination = paginateEncarteSemanalProducts(matchResult.updatedProducts, 20);
    expect(pagination.totalPages).toBe(1);
    expect(pagination.pages[0].length).toBe(20);
    expect(pagination.pendingProducts.length).toBe(0);

    // 4. Calcula as células da grade
    const cells = calculateEncarteSemanalGridCells(DEFAULT_ENCARTE_SEMANAL_GRID);
    expect(cells.length).toBe(20);

    // Cada uma das 20 células recebe seu produto com código, descrição e foto
    cells.forEach((cell, idx) => {
      const prod = pagination.pages[0][idx];
      expect(prod).toBeDefined();
      expect(prod.code).toBe(`100${idx + 1}`);
      expect(prod.description).toBe(`PRODUTO TESTE ${idx + 1}`);
      expect(prod.image).toBe(`data:image/png;base64,fakePhotoData_100${idx + 1}`);
    });
  });

  // =========================================================================
  // Teste 2: Um código sem foto aparece como pendência e não cria card vazio.
  // =========================================================================
  it("Teste 2: Um código sem foto aparece como pendência e não cria card vazio no encarte", () => {
    // 21 produtos, sendo 19 com foto e 2 sem foto
    const products: EncarteSemanalProduct[] = [];
    for (let i = 1; i <= 21; i++) {
      products.push({
        id: `p-${i}`,
        code: `COD-${i}`,
        description: `PRODUTO ${i}`,
        image: i <= 19 ? `data:image/png;base64,img-${i}` : undefined,
      });
    }

    const pagination = paginateEncarteSemanalProducts(products, 20);

    // Os 2 produtos sem foto foram para pendências
    expect(pagination.pendingProducts.length).toBe(2);
    expect(pagination.pendingProducts[0].code).toBe("COD-20");
    expect(pagination.pendingProducts[1].code).toBe("COD-21");

    // A página 1 tem exatamente 19 produtos (sem criar cards vazios)
    expect(pagination.pages[0].length).toBe(19);
    expect(pagination.totalPages).toBe(1);

    // Nenhum produto nas páginas do encarte tem foto indefinida
    pagination.pages.forEach((page) => {
      page.forEach((p) => {
        expect(p.image).toBeDefined();
        expect(p.image?.trim()).not.toBe("");
      });
    });
  });

  // =========================================================================
  // Teste 3: Um código duplicado mostra aviso.
  // =========================================================================
  it("Teste 3: Um código duplicado mostra aviso sem travar a importação", async () => {
    const csvContent =
      "codigo;descricao\n" +
      "1234;ARROZ BRANCO 5KG\n" +
      "5678;FEIJAO CARIOCA 1KG\n" +
      "1234;ARROZ BRANCO 5KG DUPLICADO\n" +
      " ;PRODUTO SEM CODIGO\n" +
      "9999;AZEITE EXTRA VIRGEM";

    const file = new File([csvContent], "produtos_duplicados.csv", {
      type: "text/csv",
    });

    const parsed = await parseEncarteSemanalSpreadsheet(file);
    expect(parsed.success).toBe(true);

    // Deve conter aviso sobre código duplicado '1234'
    const hasDuplicateWarning = parsed.warnings.some((w) =>
      w.toLowerCase().includes("duplicado") && w.includes("1234")
    );
    expect(hasDuplicateWarning).toBe(true);

    // Deve conter aviso sobre código vazio
    const hasEmptyCodeWarning = parsed.warnings.some((w) =>
      w.toLowerCase().includes("vazio")
    );
    expect(hasEmptyCodeWarning).toBe(true);

    // O código duplicado e a linha sem código não geram produtos duplicados ou em branco
    const code1234Count = parsed.products.filter((p) => p.code === "1234").length;
    expect(code1234Count).toBe(1);
    expect(parsed.products.length).toBe(3); // 1234, 5678, 9999
  });

  // =========================================================================
  // Teste 4: Trocar o modelo não apaga a planilha carregada.
  // =========================================================================
  it("Teste 4: Trocar o modelo não apaga a planilha ou produtos carregados", () => {
    // 1. Salva produtos carregados
    const initialProducts: EncarteSemanalProduct[] = [
      { id: "1", code: "24657", description: "ALMOND BREEZE", image: "data:img1" },
      { id: "2", code: "19396", description: "AMEIXA PREDILECTA", image: "data:img2" },
    ];
    saveEncarteSemanalProducts(initialProducts);

    // 2. Salva modelo inicial
    saveEncarteSemanalTemplate("/templates/modelo1.png");
    expect(loadEncarteSemanalTemplate()).toBe("/templates/modelo1.png");

    // 3. Usuário troca de modelo (ex: sobe MODELO_NOVO.jpg)
    saveEncarteSemanalTemplate("data:image/jpeg;base64,novoModeloArte");
    expect(loadEncarteSemanalTemplate()).toBe("data:image/jpeg;base64,novoModeloArte");

    // 4. Verifica que os produtos continuam salvos e intactos!
    const loadedProducts = loadEncarteSemanalProducts();
    expect(loadedProducts.length).toBe(2);
    expect(loadedProducts[0].code).toBe("24657");
    expect(loadedProducts[0].description).toBe("ALMOND BREEZE");
    expect(loadedProducts[1].code).toBe("19396");
  });

  // =========================================================================
  // Teste 5: Cálculo da Grade de 4 Colunas x 5 Linhas = 20 Células
  // =========================================================================
  it("Teste 5: Grade padrão respeita 4 colunas x 5 linhas dentro dos limites da arte", () => {
    const cells = calculateEncarteSemanalGridCells(DEFAULT_ENCARTE_SEMANAL_GRID);
    expect(cells.length).toBe(20);

    // Célula 0 (primeira célula): col 0, row 0
    expect(cells[0].colIndex).toBe(0);
    expect(cells[0].rowIndex).toBe(0);
    expect(cells[0].x).toBe(29);
    expect(cells[0].y).toBe(475);
    expect(cells[0].barHeight).toBe(54);

    // Célula 19 (última célula): col 3, row 4
    expect(cells[19].colIndex).toBe(3);
    expect(cells[19].rowIndex).toBe(4);
    expect(cells[19].y + cells[19].height).toBeCloseTo(1850, 0);

    // Altura de cada linha útil
    const expectedRowHeight = (1850 - 475) / 5; // 275px
    expect(cells[0].height).toBe(expectedRowHeight);
    expect(cells[0].photoAreaHeight).toBe(expectedRowHeight - 54);
  });

  // =========================================================================
  // Teste 6: Persistência do rodapé de datas da oferta
  // =========================================================================
  it("Teste 6: Salva e recupera o texto editável do rodapé", () => {
    const customFooter = "OFERTA VÁLIDA DE 20/11 A 26/11 OU ENQUANTO DURAREM OS ESTOQUES.";
    saveEncarteSemanalFooterText(customFooter);

    const loaded = loadEncarteSemanalFooterText();
    expect(loaded).toBe(customFooter);
  });

  // =========================================================================
  // Teste 7: Regra de fotos alternativas e foto principal por sufixo
  // =========================================================================
  it("Teste 7: Menor sufixo vira foto principal e demais viram alternativas", () => {
    const prods: EncarteSemanalProduct[] = [
      { id: "1", code: "25573", description: "MOLHO MADEIRA" },
    ];

    const photos = [
      { filename: "25573-2.png", dataUrl: "data:img2", extractedCode: "25573" },
      { filename: "25573.png", dataUrl: "data:imgPrincipal", extractedCode: "25573" },
      { filename: "25573-3.png", dataUrl: "data:img3", extractedCode: "25573" },
    ];

    const result = matchPhotosWithSemanalProducts(photos, prods, "upload");
    const updated = result.updatedProducts[0];

    // Foto principal deve ser a 25573.png (menor sufixo)
    expect(updated.image).toBe("data:imgPrincipal");

    // As outras duas devem estar em alternativePhotos
    expect(updated.alternativePhotos).toBeDefined();
    expect(updated.alternativePhotos?.length).toBe(2);
    expect(updated.alternativePhotos?.some((a) => a.dataUrl === "data:img2")).toBe(true);
    expect(updated.alternativePhotos?.some((a) => a.dataUrl === "data:img3")).toBe(true);
  });

  // =========================================================================
  // Teste 8: Serialização e Desserialização de Projeto para Pasta Local
  // =========================================================================
  it("Teste 8: Salva o encarte como arquivo do computador e reabre perfeitamente", async () => {
    const {
      serializeEncarteSemanalProject,
      deserializeEncarteSemanalProject,
      readEncarteSemanalFromFile,
      generateDefaultFilename,
    } = await import("./encarte-semanal-file-manager");

    const sampleProducts: EncarteSemanalProduct[] = [
      {
        id: "p1",
        code: "19396",
        description: "AMEIXA EM CALDA PREDILECTA",
        image: "data:image/png;base64,sampleImage1",
        scale: 1.25,
        offsetX: 4,
        offsetY: -2,
        overlapY: 18,
        limit: "1000CX",
      },
      {
        id: "p2",
        code: "5522",
        description: "GOIABADA BLOCO PREDILECTA",
        image: "data:image/png;base64,sampleImage2",
      },
    ];

    const config = {
      name: "Encarte Semanal - Novembro Semana 3",
      templateImage: "data:image/jpeg;base64,sampleBgTemplate",
      footerText: "OFERTA VÁLIDA DE 16/11 A 21/11 OU ATÉ DURAREM OS ESTOQUES",
      gridConfig: DEFAULT_ENCARTE_SEMANAL_GRID,
    };

    // 1. Serializa para JSON
    const jsonString = serializeEncarteSemanalProject(sampleProducts, config);
    expect(jsonString).toContain('"format": "encarte-semanal"');
    expect(jsonString).toContain("19396");
    expect(jsonString).toContain("1000CX");

    // 2. Desserializa a partir da string
    const deserialized = deserializeEncarteSemanalProject(jsonString);
    expect(deserialized.ok).toBe(true);
    expect(deserialized.project).toBeDefined();

    const proj = deserialized.project!;
    expect(proj.name).toBe("Encarte Semanal - Novembro Semana 3");
    expect(proj.footerText).toBe("OFERTA VÁLIDA DE 16/11 A 21/11 OU ATÉ DURAREM OS ESTOQUES");
    expect(proj.templateImage).toBe("data:image/jpeg;base64,sampleBgTemplate");
    expect(proj.products.length).toBe(2);
    expect(proj.products[0].code).toBe("19396");
    expect(proj.products[0].scale).toBe(1.25);
    expect(proj.products[0].limit).toBe("1000CX");

    // 3. Simula leitura de arquivo File real selecionado pelo usuário
    const mockFile = new File([jsonString], "encarte_semanal_18_11_2026.json", {
      type: "application/json",
    });

    const fileOpenResult = await readEncarteSemanalFromFile(mockFile);
    expect(fileOpenResult.ok).toBe(true);
    expect(fileOpenResult.filename).toBe("encarte_semanal_18_11_2026.json");
    expect(fileOpenResult.project?.products.length).toBe(2);

    // 4. Nome padrão padronizado com data
    const filename = generateDefaultFilename();
    expect(filename).toMatch(/^encarte_semanal_\d{2}_\d{2}_\d{4}\.json$/);
  });

  // =========================================================================
  // Teste 9: Tratamento de arquivo corrompido ou formato incompatível
  // =========================================================================
  it("Teste 9: Rejeita com mensagem amigável arquivos corrompidos ou inválidos", async () => {
    const { deserializeEncarteSemanalProject, readEncarteSemanalFromFile } = await import(
      "./encarte-semanal-file-manager"
    );

    const corruptJson = "{ produtos: indevidos sem fechar chaves";
    const corruptRes = deserializeEncarteSemanalProject(corruptJson);
    expect(corruptRes.ok).toBe(false);
    expect(corruptRes.error).toBeDefined();

    const notAnEncarte = JSON.stringify({ mensagem: "olá mundo" });
    const invalidRes = deserializeEncarteSemanalProject(notAnEncarte);
    expect(invalidRes.ok).toBe(false);

    const invalidFile = new File(["nada a ver"], "teste.txt", { type: "text/plain" });
    const fileRes = await readEncarteSemanalFromFile(invalidFile);
    expect(fileRes.ok).toBe(false);
  });

  // =========================================================================
  // Teste 10: Puxa fotos usando o mesmo sistema do Acompanhamento de Validade
  // =========================================================================
  it("Teste 10: Puxa fotos automaticamente usando o mesmo sistema do Acompanhamento de Validade", async () => {
    const { findKnownPhotoForCode, autoResolvePhotosForSemanalProducts } = await import(
      "./encarte-semanal-photos"
    );

    // 1. Código 23396 deve resolver automaticamente via AgileCDN / Validade Interno
    const photoUrl = findKnownPhotoForCode("23396");
    expect(photoUrl).toBeDefined();
    expect(photoUrl).toContain("23396");
    expect(photoUrl).toContain("cescom.agilecdn.com.br");

    // 2. autoResolvePhotosForSemanalProducts deve resolver em lote
    const mockProducts: EncarteSemanalProduct[] = [
      { id: "1", code: "23396", description: "PRODUTO CESCOM AGILE" },
      { id: "2", code: "19559", description: "OUTRO PRODUTO CESCOM" },
    ];

    const result = autoResolvePhotosForSemanalProducts(mockProducts);
    expect(result.resolvedCount).toBe(2);
    expect(result.updatedProducts[0].image).toContain("23396");
    expect(result.updatedProducts[1].image).toContain("19559");
  });

  // =========================================================================
  // Teste 11: Ignora linha de cabeçalho 'Codprod' / 'PRODUTO' e não cria produto fantasma
  // =========================================================================
  it("Teste 11: Ignora linha de cabeçalho 'Codprod' / 'PRODUTO' sem criar produto fantasma", async () => {
    const rows = [
      ["Codprod", "PRODUTO"], // Cabeçalho principal
      ["Codprod", "PRODUTO"], // Linha de cabeçalho duplicada no meio/início dos dados
      ["2110", "ALVEJANTE Q BOA FLORAL - 12X1 LT"],
      ["18689", "DESENGORDURANTE Q BOA COZINHA"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = await parseEncarteSemanalSpreadsheet(buffer, "teste_cabecalho.xlsx");
    expect(result.success).toBe(true);
    // Deve conter exatamente 2 produtos reais, ignorando "Codprod"
    expect(result.products.length).toBe(2);
    expect(result.products[0].code).toBe("2110");
    expect(result.products[0].description).toBe("ALVEJANTE Q BOA FLORAL - 12X1 LT");
    expect(result.products[1].code).toBe("18689");
  });

  // =========================================================================
  // Teste 12: Classificação como Produto Principal (sem código e sem fragrância/sabor/variação)
  // =========================================================================
  it("Teste 12: Classificar como Principal remove código e limpa fragrância, sabor e fardo da descrição", async () => {
    const { cleanPrincipalDescription } = await import("./encarte-semanal-catalog");

    // 1. Limpeza de descrição para produto principal
    expect(cleanPrincipalDescription("ALVEJANTE Q BOA FLORAL - 12X1 LT")).toBe("ALVEJANTE Q BOA");
    expect(cleanPrincipalDescription("DESENGORDURANTE Q BOA COZINHA - 1X500 ML")).toBe("DESENGORDURANTE Q BOA");
    expect(cleanPrincipalDescription("LIMPADOR SANITARIO Q BOA FLORAL - 12X1 LT")).toBe("LIMPADOR SANITARIO Q BOA");
    expect(cleanPrincipalDescription("CLORO GEL Q BOA - 12X1 LT")).toBe("CLORO GEL Q BOA");
    expect(cleanPrincipalDescription("BEBIDA DE AMENDOAS ALMOND BREEZE 1L BAUNILHA")).toBe("BEBIDA DE AMENDOAS ALMOND BREEZE");

    // 2. Importação de planilha com coluna Principal (como no anexo do usuário)
    const rows = [
      ["Codprod", "PRODUTO", "Principal"],
      ["2110", "ALVEJANTE Q BOA FLORAL - 12X1 LT", "NÃO"],
      ["1001", "LIMPADOR SANITARIO Q BOA FLORAL - 12X1 LT", "SIM"], // Linha marcada como Principal
      ["19386", "CLORO GEL Q BOA - 12X1 LT", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = await parseEncarteSemanalSpreadsheet(buffer, "teste_principal.xlsx");
    expect(result.success).toBe(true);
    expect(result.products.length).toBe(3);

    // O produto da linha 2 foi classificado como Principal
    const principalProd = result.products[1];
    expect(principalProd.isPrincipal).toBe(true);
    expect(principalProd.code).toBe(""); // Fica sem código na arte!
    expect(principalProd.description).toBe("LIMPADOR SANITARIO Q BOA"); // Limpo de fragrância e 12x1 lt!
  });

  // =========================================================================
  // Teste 13: Resolução de 2 fotos no box (Duplicação e Variação)
  // =========================================================================
  it("Teste 13: resolveSemanalCellPhotos suporta 1 foto única e espaçosa por padrão e 2 fotos lado a lado no box quando solicitado", async () => {
    const { resolveSemanalCellPhotos } = await import("./encarte-semanal-layout");

    // Caso A: Produto normal não-principal sem foto secundária -> mantém 1 foto única e centralizada para não espremer
    const normalProd: EncarteSemanalProduct = {
      id: "p1",
      code: "19396",
      description: "AMEIXA EM CALDA PREDILECTA",
      image: "data:image/png;base64,ameixa1",
    };
    const resA = resolveSemanalCellPhotos(normalProd);
    expect(resA.hasTwoPhotos).toBe(false);
    expect(resA.photo1).toBe("data:image/png;base64,ameixa1");
    expect(resA.photo2).toBe("");

    // Caso B: Produto Principal com foto alternativa de fragrância/sabor -> usa variação como foto 2
    const principalProd: EncarteSemanalProduct = {
      id: "p2",
      code: "",
      description: "REFRESCO TORNADO",
      isPrincipal: true,
      image: "data:image/png;base64,tornado_laranja",
      alternativePhotos: [
        { filename: "tornado_limao.png", dataUrl: "data:image/png;base64,tornado_limao" },
      ],
    };
    const resB = resolveSemanalCellPhotos(principalProd);
    expect(resB.hasTwoPhotos).toBe(true);
    expect(resB.photo1).toBe("data:image/png;base64,tornado_laranja");
    expect(resB.photo2).toBe("data:image/png;base64,tornado_limao");

    // Caso C: Produto com secondaryImage explícita
    const dualCodeProd: EncarteSemanalProduct = {
      id: "p3",
      code: "14352",
      secondaryCode: "17585",
      description: "LASANHA DIRETO AO FORNO E FERMENTO DONA BENTA",
      image: "data:image/png;base64,lasanha",
      secondaryImage: "data:image/png;base64,fermento",
    };
    const resC = resolveSemanalCellPhotos(dualCodeProd);
    expect(resC.hasTwoPhotos).toBe(true);
    expect(resC.photo1).toBe("data:image/png;base64,lasanha");
    expect(resC.photo2).toBe("data:image/png;base64,fermento");

    // Caso D: Usuário ativa duplicação explicitamente (duplicatePhoto: true)
    const dupProd: EncarteSemanalProduct = {
      id: "p4",
      code: "5522",
      description: "GOIABADA",
      image: "data:image/png;base64,goiabada",
      duplicatePhoto: true,
    };
    const resD = resolveSemanalCellPhotos(dupProd);
    expect(resD.hasTwoPhotos).toBe(true);
    expect(resD.photo1).toBe("data:image/png;base64,goiabada");
    expect(resD.photo2).toBe("data:image/png;base64,goiabada");
  });

  // =========================================================================
  // Teste 14: Busca de produto no site cescom.com.br quando não estiver na planilha
  // =========================================================================
  it("Teste 14: Busca automática de produto no site cescom.com.br quando não estiver na planilha", async () => {
    const { fetchCescomProductOnline, lookupProductByCode } = await import("./encarte-semanal-catalog");

    // Mock global de fetch para simular resposta do endpoint /api/cescom-product
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/cescom-product?code=99887")) {
        return new Response(
          JSON.stringify({
            ok: true,
            product: {
              code: "99887",
              description: "CHOCOLATE AO LEITE NESTLE 90G",
              image: "https://cescom.agilecdn.com.br/99887_thumb_1.jpg",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    }) as any;

    try {
      const onlineProd = await fetchCescomProductOnline("99887");
      expect(onlineProd).not.toBeNull();
      expect(onlineProd?.code).toBe("99887");
      expect(onlineProd?.description).toBe("CHOCOLATE AO LEITE NESTLE 90G");
      expect(onlineProd?.image).toContain("99887_thumb_1.jpg");

      // Uma vez buscado, lookupProductByCode também passa a conhecê-lo
      const lookedUp = lookupProductByCode("99887");
      expect(lookedUp.description).toBe("CHOCOLATE AO LEITE NESTLE 90G");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
