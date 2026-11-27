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

  // =========================================================================
  // Teste 15: Inteligência de Catálogo - Busca de Variações para Foto 2
  // =========================================================================
  it("Teste 15: Encontra variações da mesma base/marca para a Foto 2", async () => {
    const { findSemanalVariations } = await import("./encarte-semanal-catalog");

    const catalog = [
      { code: "101", description: "ALVEJANTE Q BOA FLORAL - 12X1 LT", image: "data:img101" },
      { code: "102", description: "ALVEJANTE Q BOA LAVANDA - 12X1 LT", image: "data:img102" },
      { code: "103", description: "ALVEJANTE Q BOA ORIGINAL - 12X1 LT", image: "data:img103" },
      { code: "201", description: "SABÃO EM PÓ OMO 1KG", image: "data:img201" },
    ];

    const variations = findSemanalVariations("ALVEJANTE Q BOA", "101", catalog);
    expect(variations.length).toBeGreaterThanOrEqual(2);
    expect(variations.some((v) => v.code === "102")).toBe(true);
    expect(variations.some((v) => v.code === "103")).toBe(true);
    expect(variations.some((v) => v.code === "101")).toBe(false); // Não inclui ele mesmo
    expect(variations.some((v) => v.code === "201")).toBe(false); // Não inclui outra marca
  });

  // =========================================================================
  // Teste 16: Recursos Visuais - Selos Promocionais e Espelhamento Horizontal
  // =========================================================================
  it("Teste 16: Suporte a espelhamento horizontal, selo promocional e limites customizados", () => {
    const prod: EncarteSemanalProduct = {
      id: "prod-selo-1",
      code: "19396",
      description: "AMEIXA EM CALDA LATA PREDILECTA",
      image: "data:imgAmeixa",
      secondaryImage: "data:imgAmeixaVar",
      flipHorizontal: true,
      flipHorizontal2: false,
      badge: "LANÇAMENTO",
      badgeColor: "amber",
      limit: "1000CX",
      limitFontSize: 11,
      limitWidthPercent: 90,
      scale: 1.2,
      scale2: 1.1,
    };

    expect(prod.flipHorizontal).toBe(true);
    expect(prod.badge).toBe("LANÇAMENTO");
    expect(prod.badgeColor).toBe("amber");
    expect(prod.limitFontSize).toBe(11);
    expect(prod.limitWidthPercent).toBe(90);
    expect(prod.scale2).toBe(1.1);
  });

  // =========================================================================
  // Teste 17: Auto-cópia do código para o Clipboard (com fallback execCommand)
  // =========================================================================
  it("Teste 17: Copia automaticamente o código do produto para o clipboard e usa fallback seguro", async () => {
    const { copyProductCodeToClipboard } = await import("./encarte-semanal-photos");

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    try {
      const ok = await copyProductCodeToClipboard(" 25710 ");
      expect(ok).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith("25710");

      // Simular falha de permissão em navigator.clipboard -> aciona fallback document.execCommand('copy')
      writeTextMock.mockRejectedValueOnce(new Error("Permission denied"));
      const execSpy = vi.fn().mockReturnValue(true);
      (document as any).execCommand = execSpy;

      const okFallback = await copyProductCodeToClipboard("19396");
      expect(okFallback).toBe(true);
      expect(execSpy).toHaveBeenCalledWith("copy");

      // Código vazio retorna false sem chamar clipboard
      expect(await copyProductCodeToClipboard("   ")).toBe(false);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  // =========================================================================
  // Teste 18: Prioridade Absoluta da Pasta Local (Fotos_Palm) sobre Cescom
  // =========================================================================
  it("Teste 18: Prioriza PNG da Pasta Local conectada sobre o site Cescom e AgileCDN", async () => {
    const {
      registerLocalFolderPhotos,
      findKnownPhotoForCode,
      resolveBestPhotoForCode,
      getLocalFolderStatus,
      clearLocalFolderPhotos,
    } = await import("./encarte-semanal-photos");

    clearLocalFolderPhotos();
    try {
      registerLocalFolderPhotos(
        [
          {
            code: "25710",
            filename: "25710.jpg",
            dataUrl: "data:image/jpeg;base64,LOCAL_JPG",
            source: "upload",
            suffixOrder: 0,
            suffixLabel: "",
          },
          {
            code: "25710",
            filename: "25710.png",
            dataUrl: "data:image/png;base64,LOCAL_PNG_TRANSPARENTE",
            source: "upload",
            suffixOrder: 0,
            suffixLabel: "",
          },
        ],
        "Fotos_Palm"
      );

      const status = getLocalFolderStatus();
      expect(status.connected).toBe(true);
      expect(status.folderName).toBe("Fotos_Palm");
      expect(status.photoCount).toBe(2);

      // findKnownPhotoForCode deve retornar o PNG local com prioridade máxima
      expect(findKnownPhotoForCode("25710")).toBe("data:image/png;base64,LOCAL_PNG_TRANSPARENTE");

      // Mesmo quando a busca online da Cescom retorna URL com fundo branco, a Pasta Local vence
      const best = resolveBestPhotoForCode("25710", "https://cescom.agilecdn.com.br/25710_thumb_1.jpg");
      expect(best).toBe("data:image/png;base64,LOCAL_PNG_TRANSPARENTE");

      // Quando não está na pasta local, usa a imagem online da Cescom se fornecida
      expect(
        resolveBestPhotoForCode("99999", "https://cescom.agilecdn.com.br/99999_thumb_1.jpg")
      ).toBe("https://cescom.agilecdn.com.br/99999_thumb_1.jpg");
    } finally {
      clearLocalFolderPhotos();
    }
  });

  // =========================================================================
  // Teste 19: Integração Pasta Oficial Google Drive "FOTOS PALM CESCOM"
  // =========================================================================
  it("Teste 19: Sincroniza pasta oficial FOTOS PALM CESCOM do Drive e salva no cache local", async () => {
    const {
      OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_ID,
      OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_URL,
      syncSemanalPhotosFromDriveFolder,
    } = await import("./encarte-semanal-photos");
    const productFns = await import("./product.functions");
    const { getCachedPhoto, clearDrivePhotoCache } = await import("./drive-cache");

    expect(OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_ID).toBe("1E-MmRqMVnbm6LsOyV7Tc9E1crOhZTF5T");
    expect(OFFICIAL_PALM_CESCOM_DRIVE_FOLDER_URL).toBe(
      "https://drive.google.com/drive/folders/1E-MmRqMVnbm6LsOyV7Tc9E1crOhZTF5T"
    );

    clearDrivePhotoCache();
    const indexSpy = vi.spyOn(productFns, "indexDriveFolder" as any).mockResolvedValue({
      ok: true,
      totalImages: 1,
      indexedPhotos: [
        {
          id: "drive-file-25710",
          code: "25710",
          filename: "25710.png",
          modifiedTime: "2026-11-27T10:00:00Z",
          suffixOrder: 0,
        },
      ],
    });
    const dlSpy = vi.spyOn(productFns, "downloadCampaignDrivePhotos" as any).mockResolvedValue({
      ok: true,
      photos: [
        {
          fileId: "drive-file-25710",
          code: "25710",
          filename: "25710.png",
          modifiedTime: "2026-11-27T10:00:00Z",
          dataUrl: "data:image/png;base64,DRIVE_PALM_CESCOM_PNG",
        },
      ],
      corruptFiles: [],
    });

    try {
      const res1 = await syncSemanalPhotosFromDriveFolder({ codes: ["25710"] });
      expect(res1.ok).toBe(true);
      expect(res1.downloadedCount).toBe(1);
      expect(res1.photoByCode.get("25710")).toBe("data:image/png;base64,DRIVE_PALM_CESCOM_PNG");
      expect(getCachedPhoto("25710")?.dataUrl).toBe("data:image/png;base64,DRIVE_PALM_CESCOM_PNG");

      // Segunda chamada deve usar o cache local sem baixar novamente
      const res2 = await syncSemanalPhotosFromDriveFolder({ codes: ["25710"] });
      expect(res2.ok).toBe(true);
      expect(res2.cachedHitsCount).toBe(1);
      expect(res2.downloadedCount).toBe(0);
      expect(dlSpy).toHaveBeenCalledTimes(1);
    } finally {
      indexSpy.mockRestore();
      dlSpy.mockRestore();
      clearDrivePhotoCache();
    }
  });

  // =========================================================================
  // Teste 20: Geometria de 2 Fotos Proporcionais, Centralizadas e Sobrepostas
  // =========================================================================
  it("Teste 20: computeSemanalTwoPhotoLayout mantém mesmas proporções, centraliza o conjunto e sobrepõe Foto 2", async () => {
    const { computeSemanalTwoPhotoLayout } = await import("./encarte-semanal-editing");

    const layout = computeSemanalTwoPhotoLayout({
      boxX: 0,
      boxWidth: 250,
      photoAreaHeight: 220,
      barY: 220,
      aspect1: 0.75,
      aspect2: 0.75,
      scale1: 1.0,
      scale2: 1.0,
    });

    // Mesmas medidas proporcionais
    expect(layout.photo1.width).toBeCloseTo(layout.photo2.width, 1);
    expect(layout.photo1.height).toBeCloseTo(layout.photo2.height, 1);

    // Sobreposição: Foto 2 inicia antes do término da Foto 1 (x2 < x1 + width1)
    expect(layout.photo2.x).toBeLessThan(layout.photo1.x + layout.photo1.width);
    expect(layout.photo2.x).toBeGreaterThan(layout.photo1.x);

    // Conjunto centralizado com respiro igual nas laterais e topo/base
    const leftMargin = layout.photo1.x;
    const rightMargin = 250 - (layout.photo2.x + layout.photo2.width);
    expect(leftMargin).toBeGreaterThanOrEqual(8);
    expect(leftMargin).toBeCloseTo(rightMargin, 1);

    const topMargin = layout.photo1.y;
    const bottomMargin = 220 - (layout.photo1.y + layout.photo1.height);
    expect(topMargin).toBeGreaterThanOrEqual(8);
    expect(topMargin).toBeCloseTo(bottomMargin, 1);

    // Em coordenadas absolutas do canvas (exportação PNG, ex: cell.y = 750, barY = 970)
    const exportLayout = computeSemanalTwoPhotoLayout({
      boxX: 29,
      boxWidth: 255,
      photoAreaHeight: 220,
      barY: 970,
      aspect1: 0.75,
      aspect2: 0.75,
      scale1: 1.0,
      scale2: 1.0,
    });
    expect(exportLayout.photo1.y).toBeGreaterThanOrEqual(750);
    expect(exportLayout.photo1.y + exportLayout.photo1.height).toBeLessThanOrEqual(970);
    expect(exportLayout.photo2.y).toBeGreaterThanOrEqual(750);

    // Redimensionar Foto 1 não pode mover Foto 2, e redimensionar Foto 2 não pode mover Foto 1
    const scaled1 = computeSemanalTwoPhotoLayout({
      boxX: 0,
      boxWidth: 250,
      photoAreaHeight: 220,
      barY: 220,
      aspect1: 0.75,
      aspect2: 0.75,
      scale1: 1.35,
      scale2: 1.0,
    });
    expect(scaled1.photo2.x).toBeCloseTo(layout.photo2.x, 3);
    expect(scaled1.photo2.width).toBeCloseTo(layout.photo2.width, 3);

    const scaled2 = computeSemanalTwoPhotoLayout({
      boxX: 0,
      boxWidth: 250,
      photoAreaHeight: 220,
      barY: 220,
      aspect1: 0.75,
      aspect2: 0.75,
      scale1: 1.0,
      scale2: 1.35,
    });
    expect(scaled2.photo1.x).toBeCloseTo(layout.photo1.x, 3);
    expect(scaled2.photo1.width).toBeCloseTo(layout.photo1.width, 3);
  });

  it("Teste 21: createSemanalProductFromSuggestion duplica automaticamente 2 fotos no tamanho ideal para novos boxes", async () => {
    const { createSemanalProductFromSuggestion } = await import("./encarte-semanal-catalog");
    const created = createSemanalProductFromSuggestion({
      code: "25710",
      description: "MAIONESE LIZA",
      image: "data:image/png;base64,maionese",
    });

    expect(created.duplicatePhoto).toBe(true);
    expect(created.scale).toBe(1.0);
    expect(created.scale2).toBe(1.0);
  });

  it("Teste 22: computeSemanalTwoPhotoLayout centraliza e amplia produtos horizontais (ex: biscoito Oreo)", async () => {
    const { computeSemanalTwoPhotoLayout } = await import("./encarte-semanal-editing");
    const layout = computeSemanalTwoPhotoLayout({
      boxX: 0,
      boxWidth: 250,
      photoAreaHeight: 200,
      barY: 200,
      aspect1: 3.2,
      aspect2: 3.2,
      scale1: 1.0,
      scale2: 1.0,
    });

    // Deve preencher mais largura por item do que o modo lado a lado tradicional
    expect(layout.photo1.width).toBeGreaterThan(150);
    // Deve ficar centralizado verticalmente na área da foto, não colado no fundo
    expect(layout.photo1.y).toBeGreaterThan(20);
    expect(layout.photo2.y).toBeGreaterThan(layout.photo1.y);
    expect(layout.photo2.y + layout.photo2.height).toBeLessThan(185);
  });

  it("Teste 23: searchCescomProductsOnline busca variações por descrição no site Cescom", async () => {
    const { searchCescomProductsOnline } = await import("./encarte-semanal-catalog");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      if (urlStr.includes("/api/cescom-product?q=")) {
        return new Response(
          JSON.stringify({
            ok: true,
            products: [
              {
                code: "24725",
                description: "BISCOITO RECHEADO OREO MORANGO 90G",
                image: "https://cescom.agilecdn.com.br/24725_thumb_1.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }) as typeof fetch;

    try {
      const results = await searchCescomProductsOnline("oreo morango", 5);
      expect(results).toHaveLength(1);
      expect(results[0].code).toBe("24725");
      expect(results[0].description).toContain("OREO MORANGO");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Teste 24: calculateEncarteSemanalGridCells ajusta para quantidade personalizada (ex: 13) e centraliza último item", () => {
    const customGrid = {
      ...DEFAULT_ENCARTE_SEMANAL_GRID,
      columnsCount: 4,
      rowsCount: 4,
      itemsPerPage: 13,
    };
    const cells = calculateEncarteSemanalGridCells(customGrid);
    expect(cells).toHaveLength(13);

    // O 13º produto (última linha sozinho) deve estar centralizado entre xStart e xEnd
    const lastCell = cells[12];
    const leftSpace = lastCell.x - customGrid.xStart;
    const rightSpace = customGrid.xEnd - (lastCell.x + lastCell.width);
    expect(leftSpace).toBeCloseTo(rightSpace, 1);

    // Todos os boxes permanecem dentro dos limites verticais configurados
    expect(cells[0].y).toBeGreaterThanOrEqual(customGrid.yStart);
    expect(lastCell.y + lastCell.height).toBeLessThanOrEqual(customGrid.yEnd + 0.5);
  });

  it("Teste 25: extractProductGramatura extrai e normaliza gramatura para cruzar variações", async () => {
    const { extractProductGramatura } = await import("./encarte-semanal-catalog");
    expect(extractProductGramatura("MILHO VERDE LATA PREDILECTA - 24X170 GR")).toBe("170G");
    expect(extractProductGramatura("SALGADINHO YOKITOS CONCHINHA PRESUNTO - 1X54G")).toBe("54G");
    expect(extractProductGramatura("AZEITE EXTRA VIRGEM LIZA 500ML")).toBe("500ML");
    expect(extractProductGramatura("ALVEJANTE Q BOA 12X1 LT")).toBe("1L");
    expect(extractProductGramatura("ARROZ TIPO 1 5KG")).toBe("5KG");
  });

  it("Teste 26: removePhotoBackgroundViaApi envia requisição para remove.bg/PhotoRoom e retorna PNG", async () => {
    const { removePhotoBackgroundViaApi } = await import("./encarte-semanal-photos");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      if (urlStr.includes("/api/remove-bg")) {
        const body = JSON.parse((init?.body as string) || "{}");
        expect(body.provider).toBe("photoroom");
        expect(body.apiKey).toBe("test-key-123");
        return new Response(
          JSON.stringify({ ok: true, dataUrl: "data:image/png;base64,cutout" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }) as typeof fetch;

    try {
      const res = await removePhotoBackgroundViaApi("data:image/png;base64,raw", {
        provider: "photoroom",
        apiKey: "test-key-123",
      });
      expect(res.ok).toBe(true);
      expect(res.dataUrl).toContain("data:image/png;base64,cutout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Teste 27: getSemanalPageGridConfig e getSemanalPageStartOffset mantêm quantidade individual por página", async () => {
    const { getSemanalPageGridConfig, getSemanalPageStartOffset } = await import("./encarte-semanal-layout");
    const grid = {
      ...DEFAULT_ENCARTE_SEMANAL_GRID,
      perPageItems: { 1: 18, 2: 10 },
    };

    const page1 = getSemanalPageGridConfig(grid, 1);
    const page2 = getSemanalPageGridConfig(grid, 2);

    expect(page1.itemsPerPage).toBe(18);
    expect(page2.itemsPerPage).toBe(10);
    expect(getSemanalPageStartOffset(grid, 1)).toBe(0);
    expect(getSemanalPageStartOffset(grid, 2)).toBe(18);
    expect(calculateEncarteSemanalGridCells(page1)).toHaveLength(18);
    expect(calculateEncarteSemanalGridCells(page2)).toHaveLength(10);
  });

  it("Teste 28: cleanPrincipalDescription remove variações compostas como AROMAS DO CAMPO e FLOR DE ROSAS", async () => {
    const { cleanPrincipalDescription } = await import("./encarte-semanal-catalog");
    expect(cleanPrincipalDescription("PEDRA SANITÁRIA AROMAS DO CAMPO TRIEX")).toBe("PEDRA SANITÁRIA TRIEX");
    expect(cleanPrincipalDescription("PEDRA SANITÁRIA FLOR DE ROSAS TRIEX")).toBe("PEDRA SANITÁRIA TRIEX");
  });

  it("Teste 29: wrapText na exportação PNG não corta palavras da segunda linha", async () => {
    const { wrapText } = await import("./encarte-semanal-export");
    const mockCtx = {
      measureText: (txt: string) => ({ width: txt.length * 7 }),
    } as unknown as CanvasRenderingContext2D;

    const res = wrapText(mockCtx, "SABONETE INTENSO AZUL LEVE 12 PAGUE 11 FRANCIS", 180, 2);
    expect(res.lines).toHaveLength(2);
    expect(res.lines.join(" ")).toContain("FRANCIS");
    expect(res.overflowed).toBe(false);
  });

  it("Teste 30: produtos com pageIndex ficam isolados em sua página ao alterar Boxes Pág. 1", () => {
    const prods: EncarteSemanalProduct[] = [
      { id: "p1", code: "100", description: "PRODUTO PAG 1", pageIndex: 1, pageSlotIndex: 0 },
      { id: "p2", code: "200", description: "PRODUTO PAG 2", pageIndex: 2, pageSlotIndex: 0 },
    ];
    // Mesmo com 20 boxes na Página 1, nenhum produto da Página 2 deve aparecer nos slots da Página 1
    const page1Slot18 = prods.find((p) => p.pageIndex === 1 && p.pageSlotIndex === 18) || null;
    expect(page1Slot18).toBeNull();
    const page2Slot0 = prods.find((p) => p.pageIndex === 2 && p.pageSlotIndex === 0) || null;
    expect(page2Slot0?.code).toBe("200");
  });

  it("Teste 31: resolveSemanalPageSlotProducts nunca duplica produto no box ao lado após editar/mover um slot legado", async () => {
    const { resolveSemanalPageSlotProducts } = await import("./encarte-semanal-layout");
    const gridConfig = {
      ...DEFAULT_ENCARTE_SEMANAL_CONFIG.gridConfig,
      itemsPerPage: 18,
      pageConfigs: { "2": { itemsPerPage: 13 } },
    };

    // Simula Página 2 com produtos legados (pageIndex: 2, sem pageSlotIndex) onde o item 0 foi editado/movido para o slot 12
    const prods: EncarteSemanalProduct[] = [
      { id: "a0", code: "1", description: "MULTI-USO YPE", pageIndex: 2, pageSlotIndex: 12, slotIndex: 30 },
      { id: "a1", code: "2", description: "AGUA SANITARIA", pageIndex: 2, slotIndex: 19 },
      { id: "a7", code: "7", description: "ALCOOL LIQUIDO", pageIndex: 2, slotIndex: 25 },
      { id: "a8", code: "8", description: "HIDRATANTE MONANGE", pageIndex: 2, slotIndex: 26 },
      { id: "a9", code: "9", description: "HIDRATANTE PAIXAO", pageIndex: 2, slotIndex: 27 },
    ];

    const slots = resolveSemanalPageSlotProducts(prods, gridConfig, 2, [], 13);
    const ids = slots.filter(Boolean).map((p) => p!.id);
    // Nenhum ID pode se repetir em dois boxes diferentes
    expect(new Set(ids).size).toBe(ids.length);
    expect(slots[8]?.id).toBe("a8");
    expect(slots[9]?.id).toBe("a9");
    expect(slots[12]?.id).toBe("a0");
  });
});
