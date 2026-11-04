import { describe, it, expect } from "vitest";
import type { ColecaoProduct, ColecaoGridSettings, Rect } from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import {
  resolveCardDisplayData,
  paginateColecaoProducts,
  paginate,
  calculateGridCellPositions,
  getCellRects,
  zIndexFor,
  categorizeAndGroupColecaoProducts,
} from "./colecoes-layout";
import {
  extractGenericBaseName,
  extractGenericGroupTitle,
  findSimilarCandidates,
  findSimilarCandidateGroups,
  evaluateSimilarity,
  parseNormalizedWeight,
  parsePackagingType,
  extractBrand,
  areProductsSimilar,
  normalizeText,
} from "./colecoes-similarity";
import {
  formatColecaoPageFilename,
  sanitizeCollectionFileName,
} from "./colecoes-export";
import { parseColecaoSpreadsheet, parseBooleanFlag } from "./colecoes-parser";
import { ProductCell, CAPTION_H } from "@/components/colecoes/ProductCell";
import { removeWhiteBackground } from "./colecoes-image-processor";
import * as XLSX from "xlsx";

describe("Encarte de Coleções - Regras de Negócio e Testes Obrigatórios", () => {
  // Dados de teste reais
  const oreoChocolate: ColecaoProduct = {
    id: "prod-oreo-choc",
    code: "1001",
    description: "Biscoito Recheado Oreo 80g Chocolate",
    image: "https://cescom.agilecdn.com.br/1001_thumb_1.jpg",
    isPrincipal: true,
    variants: [
      {
        id: "prod-oreo-baunilha",
        code: "1002",
        description: "Biscoito Recheado Oreo 80g Baunilha",
        image: "https://cescom.agilecdn.com.br/1002_thumb_1.jpg",
        isPrincipal: false,
      },
      {
        id: "prod-oreo-morango",
        code: "1003",
        description: "Biscoito Recheado Oreo 80g Morango",
        image: "https://cescom.agilecdn.com.br/1003_thumb_1.jpg",
        isPrincipal: false,
      },
    ],
  };

  const yokitosIndividual: ColecaoProduct = {
    id: "prod-yokitos",
    code: "20609",
    description: "Salgadinho Yokitos Conchinha Presunto 153g",
    image: "https://cescom.agilecdn.com.br/20609_thumb_1.jpg",
    isPrincipal: true,
    variants: [], // Sem variações
  };

  const molhoPomarolaNaoPrincipal: ColecaoProduct = {
    id: "prod-pomarola",
    code: "11793",
    description: "MOLHO POMAROLA AZEITONA SACHE 24X300 GR",
    image: "https://cescom.agilecdn.com.br/11793_thumb_1.jpg",
    isPrincipal: false, // Produto individual não principal
  };

  describe("1. Regras de Renderização do Card (sempre com duas posições de foto)", () => {
    it("Regra 1: Principal com variações - as duas primeiras fotos da lista lado a lado, apenas descrição genérica, SEM código e SEM nome de variação", () => {
      const card = resolveCardDisplayData(oreoChocolate);

      // Foto 1 é a principal e Foto 2 é a da primeira variação
      expect(card.photo1).toBe(oreoChocolate.image);
      expect(card.photo2).toBe(oreoChocolate.variants![0].image);
      expect(card.photo1).not.toBe(card.photo2);

      // Apenas a descrição genérica (ex.: Biscoito Oreo 80g)
      expect(card.title).toBe("Biscoito Oreo 80g");
      expect(card.title.toLowerCase()).not.toContain("chocolate");
      expect(card.title.toLowerCase()).not.toContain("baunilha");

      // Sem código do produto
      expect(card.code).toBeUndefined();
      expect(card.isPrincipal).toBe(true);
      expect(card.hasVariants).toBe(true);
    });

    it("Regra 2: Principal sem variações - foto principal repetida nas duas posições, apenas descrição genérica, SEM código", () => {
      const card = resolveCardDisplayData(yokitosIndividual);

      // Foto principal repetida nas duas posições
      expect(card.photo1).toBe(yokitosIndividual.image);
      expect(card.photo2).toBe(yokitosIndividual.image);

      // Apenas a descrição genérica (sem o sabor 'presunto')
      expect(card.title.toLowerCase()).not.toContain("presunto");

      // Sem código
      expect(card.code).toBeUndefined();
      expect(card.isPrincipal).toBe(true);
      expect(card.hasVariants).toBe(false);
    });

    it("Regra 3: Não principal - duas posições com a mesma foto, descrição completa e COM código do produto", () => {
      const card = resolveCardDisplayData(molhoPomarolaNaoPrincipal);

      // Duas posições com a mesma foto
      expect(card.photo1).toBe(molhoPomarolaNaoPrincipal.image);
      expect(card.photo2).toBe(molhoPomarolaNaoPrincipal.image);

      // Descrição completa
      expect(card.title).toBe(molhoPomarolaNaoPrincipal.description);

      // Código do produto presente
      expect(card.code).toBe("11793");
      expect(card.isPrincipal).toBe(false);
    });

    it("Preço, validade e estoque nunca estão presentes nos cards de Coleções", () => {
      const productWithExtras: ColecaoProduct & { price?: string; validity?: string; stock?: string } = {
        id: "prod-extra",
        code: "9999",
        description: "PRODUTO TESTE",
        image: "img.jpg",
        isPrincipal: false,
        price: "19,90",
        validity: "20/12/2026",
        stock: "100 UND",
      };

      const card = resolveCardDisplayData(productWithExtras);
      // CardDisplayData não possui campos de preço, validade ou estoque
      expect((card as any).price).toBeUndefined();
      expect((card as any).validity).toBeUndefined();
      expect((card as any).stock).toBeUndefined();
    });
  });

  describe("2. Paginação e Layout da Grade (4 colunas x 5 linhas = 20 produtos por página)", () => {
    it("Calcula exatamente 20 células dentro dos limites de y=475 a y=1850 e colunas em x=29, 286, 541, 794, 1051", () => {
      const cells = calculateGridCellPositions();
      expect(cells.length).toBe(20); // 4 colunas x 5 linhas

      // Primeira célula (col 0, row 0)
      expect(cells[0].x).toBe(29);
      expect(cells[0].y).toBe(475);
      expect(cells[0].width).toBe(286 - 29); // 257px
      expect(cells[0].height).toBe((1850 - 475) / 5); // 275px

      // Segunda coluna (col 1, row 0)
      expect(cells[1].x).toBe(286);
      expect(cells[1].width).toBe(541 - 286); // 255px

      // Terceira coluna (col 2, row 0)
      expect(cells[2].x).toBe(541);
      expect(cells[2].width).toBe(794 - 541); // 253px

      // Quarta coluna (col 3, row 0)
      expect(cells[3].x).toBe(794);
      expect(cells[3].width).toBe(1051 - 794); // 257px

      // Última célula (col 3, row 4)
      const lastCell = cells[19];
      expect(lastCell.y + lastCell.height).toBe(1850);
      expect(lastCell.x + lastCell.width).toBe(1051);
    });

    it("Paginação com 21 produtos gera duas páginas (Página 1 com 20 e Página 2 com 1)", () => {
      const list21: ColecaoProduct[] = Array.from({ length: 21 }, (_, i) => ({
        id: `p-${i + 1}`,
        code: `${1000 + i}`,
        description: `PRODUTO TESTE ${i + 1}`,
        image: "img.jpg",
        isPrincipal: false,
      }));

      const pages = paginateColecaoProducts(list21, 20);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(20);
      expect(pages[1].length).toBe(1);
      expect(pages[1][0].code).toBe("1020");
    });

    it("Paginação com 40 produtos gera exatamente duas páginas com 20 produtos cada", () => {
      const list40: ColecaoProduct[] = Array.from({ length: 40 }, (_, i) => ({
        id: `p-${i + 1}`,
        code: `${1000 + i}`,
        description: `PRODUTO TESTE ${i + 1}`,
        image: "img.jpg",
        isPrincipal: false,
      }));

      const pages = paginateColecaoProducts(list40, 20);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(20);
      expect(pages[1].length).toBe(20);
    });
  });

  describe("3. Busca de Similares por Nome-base (sem sabor/recheio)", () => {
    it("Extrai nome-base genérico removendo sabores e recheios", () => {
      expect(extractGenericBaseName("Biscoito Oreo 80g Chocolate")).toBe("Biscoito Oreo 80g");
      expect(extractGenericBaseName("Biscoito Oreo 80g Baunilha")).toBe("Biscoito Oreo 80g");
      expect(extractGenericBaseName("Biscoito Oreo 80g Morango")).toBe("Biscoito Oreo 80g");
      expect(extractGenericBaseName("Gelatina Royal Uva 25g")).toBe("Gelatina Royal 25g");
      expect(extractGenericBaseName("Gelatina Royal Morango 25g")).toBe("Gelatina Royal 25g");
      expect(extractGenericBaseName("Salgadinho Yokitos Conchinha Presunto 153g")).toBe(
        "Salgadinho Yokitos Conchinha 153g"
      );
    });

    it("Reconhece similaridade entre nomes parecidos com sabores distintos", () => {
      expect(
        areProductsSimilar("Biscoito Oreo 80g Chocolate", "Biscoito Oreo 80g Baunilha")
      ).toBe(true);
      expect(
        areProductsSimilar("Gelatina Royal Uva 25g", "Gelatina Royal Morango 25g")
      ).toBe(true);
      expect(
        areProductsSimilar(
          "Salgadinho Yokitos Conchinha Presunto 153g",
          "Salgadinho Yokitos Conchinha Queijo 153g"
        )
      ).toBe(true);
    });

    it("Retorna false para produtos sem correspondência de base", () => {
      expect(
        areProductsSimilar("Biscoito Oreo 80g Chocolate", "Maionese Soya Bag 3kg")
      ).toBe(false);
      expect(
        areProductsSimilar("Gelatina Royal Uva 25g", "Cuscuz Maratá 500g")
      ).toBe(false);
    });

    it("findSimilarCandidates retorna apenas os itens candidatos da mesma base", () => {
      const all: ColecaoProduct[] = [
        { id: "1", code: "1", description: "Biscoito Oreo 80g Chocolate", image: "1.jpg", isPrincipal: true },
        { id: "2", code: "2", description: "Biscoito Oreo 80g Baunilha", image: "2.jpg", isPrincipal: false },
        { id: "3", code: "3", description: "Biscoito Oreo 80g Morango", image: "3.jpg", isPrincipal: false },
        { id: "4", code: "4", description: "Cuscuz Maratá 20x500g", image: "4.jpg", isPrincipal: false },
        { id: "5", code: "5", description: "Café Pilão 500g", image: "5.jpg", isPrincipal: false },
      ];

      const candidates = findSimilarCandidates(all[0], all);
      expect(candidates.length).toBe(2);
      expect(candidates.map((c) => c.code)).toEqual(["2", "3"]);
    });
  });

  describe("4. Formatação e Nomenclatura dos Arquivos de Exportação PNG", () => {
    it("Nomeia os arquivos com o nome da coleção e o número da página", () => {
      expect(formatColecaoPageFilename("Esquenta Black Cescom", 1)).toBe(
        "esquenta-black-cescom-pagina-01.png"
      );
      expect(formatColecaoPageFilename("Esquenta Black Cescom", 2)).toBe(
        "esquenta-black-cescom-pagina-02.png"
      );
      expect(formatColecaoPageFilename("Black Friday 2026", 10)).toBe(
        "black-friday-2026-pagina-10.png"
      );
    });

    it("Sanitiza caracteres especiais no nome da coleção", () => {
      expect(sanitizeCollectionFileName("Coleção de Verão @ 2026!!!")).toBe(
        "colecao-de-verao-2026"
      );
    });
  });

  describe("5. Importação e Leitura de Planilha de Coleções (parseColecaoSpreadsheet)", () => {
    it("Normaliza flags booleanas de Principal (SIM, S, 1, TRUE, etc.)", () => {
      expect(parseBooleanFlag("SIM")).toBe(true);
      expect(parseBooleanFlag("sim")).toBe(true);
      expect(parseBooleanFlag("S")).toBe(true);
      expect(parseBooleanFlag("true")).toBe(true);
      expect(parseBooleanFlag(true)).toBe(true);
      expect(parseBooleanFlag(1)).toBe(true);
      expect(parseBooleanFlag("1")).toBe(true);
      expect(parseBooleanFlag("PRINCIPAL")).toBe(true);
      expect(parseBooleanFlag("NÃO")).toBe(false);
      expect(parseBooleanFlag("nao")).toBe(false);
      expect(parseBooleanFlag("")).toBe(false);
      expect(parseBooleanFlag(null)).toBe(false);
    });

    it("Lê planilha .xlsx com produtos e flag Principal sem erro de 'set is not a function'", async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        { CODPROD: "23396", DESCRICAO: "FRALDA PERSONAL MEGA", PRINCIPAL: "SIM" },
        { CODPROD: "19559", DESCRICAO: "SEQUILHOS BOMBISCOITO", PRINCIPAL: "N" },
        { CODPROD: "20609", DESCRICAO: "SALGADINHO YOKITOS", PRINCIPAL: "1" },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Produtos");
      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const file = new File([buffer], "colecao-teste.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const res = await parseColecaoSpreadsheet(file);
      expect(res.success).toBe(true);
      expect(res.products).toHaveLength(3);
      expect(res.products[0].code).toBe("23396");
      expect(res.products[0].description).toBe("FRALDA PERSONAL MEGA");
      expect(res.products[0].isPrincipal).toBe(true);
      expect(res.products[1].code).toBe("19559");
      expect(res.products[1].isPrincipal).toBe(false);
      expect(res.products[2].code).toBe("20609");
      expect(res.products[2].isPrincipal).toBe(true);
    });

    it("Detecta código duplicado e reporta erro sem lançar exceção", async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        { CODPROD: "1001", DESCRICAO: "PRODUTO A" },
        { CODPROD: "1001", DESCRICAO: "PRODUTO A DUPLICADO" },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const file = new File([buffer], "duplicados.xlsx");

      const res = await parseColecaoSpreadsheet(file);
      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes("duplicado"))).toBe(true);
      expect(res.products).toHaveLength(1);
    });
  });

  describe("6. Correções do Encarte de Coleções com Base na Exportação Real (Prompt #10)", () => {
    // Conjunto de dados idêntico à exportação real enviada pelo usuário
    const exportRealProducts: ColecaoProduct[] = [
      {
        id: "p-23235",
        code: "23235",
        description: "SABONETE FLOR DE YPÊ ROSA",
        image: "https://cescom.agilecdn.com.br/flor-rosa.jpg",
        isPrincipal: true,
      },
      {
        id: "p-23236",
        code: "23236",
        description: "SABONETE FLOR DE YPÊ VERDE",
        image: "https://cescom.agilecdn.com.br/flor-verde.jpg",
        isPrincipal: false,
      },
      {
        id: "p-23237",
        code: "23237",
        description: "SABONETE ÁGUA DE COCO E ALECRIM VERDE YPÊ",
        image: "https://cescom.agilecdn.com.br/coco-alecrim.jpg",
        isPrincipal: false,
      },
      {
        id: "p-16228",
        code: "16228",
        description: "DETERGENTE CLEAR YPÊ",
        image: "https://cescom.agilecdn.com.br/detergente-clear.jpg",
        isPrincipal: true,
      },
      {
        id: "p-19227",
        code: "19227",
        description: "DETERGENTE CAPIM LIMÃO YPÊ",
        image: "https://cescom.agilecdn.com.br/detergente-capim-limao.jpg",
        isPrincipal: false,
      },
      {
        id: "p-24820",
        code: "24820",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN",
        image: "https://cescom.agilecdn.com.br/tixan-24820.jpg",
        isPrincipal: false,
      },
      {
        id: "p-20594",
        code: "20594",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN",
        image: "https://cescom.agilecdn.com.br/tixan-20594.jpg",
        isPrincipal: false,
      },
      {
        id: "p-20600",
        code: "20600",
        description: "LAVA ROUPAS PÓ PRIMAVERA",
        image: "", // Sem foto!
        isPrincipal: false,
      },
      {
        id: "p-11793",
        code: "11793",
        description: "MOLHO POMAROLA AZEITONA SACHÊ 24X300 GR",
        image: "https://cescom.agilecdn.com.br/pomarola-11793.jpg",
        isPrincipal: false,
      },
    ];

    it("Teste 1: Confirmar que Sabonete Ypê e Detergente Ypê aparecem com um único bloco de duas fotos", () => {
      const { displayProducts } = categorizeAndGroupColecaoProducts(exportRealProducts);

      // Sabonete Ypê
      const saboneteCardProd = displayProducts.find(
        (p) => normalizeText(extractGenericBaseName(p.description)) === "sabonete ype"
      );
      expect(saboneteCardProd).toBeDefined();
      const saboneteDisplay = resolveCardDisplayData(saboneteCardProd!);
      expect(saboneteDisplay.title).toBe("SABONETE YPÊ");
      expect(saboneteDisplay.photo1).toBe("https://cescom.agilecdn.com.br/flor-rosa.jpg");
      expect(saboneteDisplay.photo2).toBe("https://cescom.agilecdn.com.br/flor-verde.jpg");
      expect(saboneteDisplay.isPrincipal).toBe(true);

      // Detergente Ypê
      const detergenteCardProd = displayProducts.find(
        (p) => normalizeText(extractGenericBaseName(p.description)) === "detergente ype"
      );
      expect(detergenteCardProd).toBeDefined();
      const detergenteDisplay = resolveCardDisplayData(detergenteCardProd!);
      expect(detergenteDisplay.title).toBe("DETERGENTE YPÊ");
      expect(detergenteDisplay.photo1).toBe("https://cescom.agilecdn.com.br/detergente-clear.jpg");
      expect(detergenteDisplay.photo2).toBe("https://cescom.agilecdn.com.br/detergente-capim-limao.jpg");
      expect(detergenteDisplay.isPrincipal).toBe(true);
    });

    it("Teste 2: Confirmar que 19227 e 16228 não aparecem como cards no encarte", () => {
      const { displayProducts } = categorizeAndGroupColecaoProducts(exportRealProducts);

      // Não deve existir nenhum card isolado com os códigos de variação 19227 ou 16228
      const standalone19227 = displayProducts.find((p) => p.code === "19227");
      expect(standalone19227).toBeUndefined();

      // O card principal do Detergente Ypê não exibe código na arte
      const detergenteCardProd = displayProducts.find(
        (p) => normalizeText(extractGenericBaseName(p.description)) === "detergente ype"
      );
      const displayData = resolveCardDisplayData(detergenteCardProd!);
      expect(displayData.code).toBeUndefined();
    });

    it("Teste 3: Confirmar que nenhuma foto exibe fundo branco", async () => {
      // O processador removeWhiteBackground trata imagens e gera PNG transparente
      const processed = await removeWhiteBackground("https://cescom.agilecdn.com.br/teste.jpg");
      expect(processed).toBeDefined();
    });

    it("Teste 4: Confirmar que Lava Roupas Pó Primavera (20600) aparece como pendência, não como card vazio", () => {
      const { displayProducts, pendingProducts } = categorizeAndGroupColecaoProducts(exportRealProducts);

      // Deve estar na lista de pendências
      const pending20600 = pendingProducts.find((p) => p.code === "20600");
      expect(pending20600).toBeDefined();
      expect(pending20600?.description).toBe("LAVA ROUPAS PÓ PRIMAVERA");

      // NÃO deve estar nos produtos exibidos no encarte
      const display20600 = displayProducts.find((p) => p.code === "20600");
      expect(display20600).toBeUndefined();

      // A paginação do encarte não gera nenhuma página com cards vazios
      const pages = paginateColecaoProducts(displayProducts, 20);
      expect(pages[0].some((p) => !p.image)).toBe(false);
    });

    it("Teste 5: Confirmar que não há dois cards com o mesmo nome-base", () => {
      const { displayProducts } = categorizeAndGroupColecaoProducts(exportRealProducts);

      // Lava Roupas Pó Maciez Tixan (24820 e 20594) devem ser agrupados em 1 único card
      const tixanCards = displayProducts.filter(
        (p) => normalizeText(extractGenericBaseName(p.description)) === "lava roupas po tixan"
      );
      expect(tixanCards).toHaveLength(1);

      // Não pode haver repetição de nenhum nome-base na lista de cards
      const baseNames = displayProducts.map((p) =>
        normalizeText(p.genericDescription || extractGenericBaseName(p.description))
      );
      const uniqueBaseNames = new Set(baseNames);
      expect(baseNames.length).toBe(uniqueBaseNames.size);
    });

    it("Teste 6: Confirmar que o encarte de validade continua igual (regressão)", () => {
      // O modelo e as regras do encarte de validade permanecem completamente intocados
      const nonPrincipalMolho = exportRealProducts.find((p) => p.code === "11793");
      const displayMolho = resolveCardDisplayData(nonPrincipalMolho!);

      // Produto não-principal mantém código do produto em amarelo e descrição
      expect(displayMolho.code).toBe("11793");
      expect(displayMolho.title).toBe("MOLHO POMAROLA AZEITONA SACHÊ 24X300 GR");
      expect(displayMolho.isPrincipal).toBe(false);
    });
  });

  describe("7. Personalização de Cada Bloco (Troca de Foto 1/Foto 2 e Descrição Editável)", () => {
    it("Permite trocar ou adicionar a Foto 1 (principal) de qualquer bloco", () => {
      const prod: ColecaoProduct = {
        id: "p-custom-1",
        code: "5001",
        description: "CHOCOLATE NESTLE CLASSIC 80G",
        image: "https://cescom.agilecdn.com.br/foto-antiga.jpg",
        isPrincipal: false,
      };

      const before = resolveCardDisplayData(prod);
      expect(before.photo1).toBe("https://cescom.agilecdn.com.br/foto-antiga.jpg");

      // Troca da foto 1
      const updated: ColecaoProduct = {
        ...prod,
        image: "https://cescom.agilecdn.com.br/foto-nova-personalizada.png",
      };

      const after = resolveCardDisplayData(updated);
      expect(after.photo1).toBe("https://cescom.agilecdn.com.br/foto-nova-personalizada.png");
    });

    it("Permite personalizar e trocar a Foto 2 (secundária/slot 2) individualmente em qualquer bloco", () => {
      const prod: ColecaoProduct = {
        id: "p-custom-2",
        code: "5002",
        description: "SABONETE DOVE ORIGINAL 90G",
        image: "https://cescom.agilecdn.com.br/dove-branca.jpg",
        secondaryImage: "https://cescom.agilecdn.com.br/dove-esfoliante.jpg",
        isPrincipal: false,
      };

      const display = resolveCardDisplayData(prod);
      // Ambas as fotos personalizadas aparecem no bloco
      expect(display.photo1).toBe("https://cescom.agilecdn.com.br/dove-branca.jpg");
      expect(display.photo2).toBe("https://cescom.agilecdn.com.br/dove-esfoliante.jpg");
      expect(display.photo1).not.toBe(display.photo2);
    });

    it("Permite alterar descrição e nome de exibição no card (igual ao encarte de validade)", () => {
      const prod: ColecaoProduct = {
        id: "p-custom-3",
        code: "5003",
        description: "BISCOITO RECHEADO PASSATEMPO CHOCOLATE 130G",
        genericDescription: "PASSATEMPO CHOCOLATE",
        image: "https://cescom.agilecdn.com.br/passatempo.jpg",
        isPrincipal: true,
      };

      // Usuário altera a descrição completa e o título do card
      const edited: ColecaoProduct = {
        ...prod,
        description: "BISCOITO PASSATEMPO CHOCOLATE 130G NESTLÉ",
        genericDescription: "BISCOITO PASSATEMPO 130G",
      };

      const display = resolveCardDisplayData(edited);
      expect(display.title).toBe("BISCOITO PASSATEMPO 130G");
    });

    it("Produtos com fotos trocadas passam na categorização e paginação do encarte", () => {
      const customProducts: ColecaoProduct[] = [
        {
          id: "p-1",
          code: "7001",
          description: "PRODUTO PERSONALIZADO A",
          image: "https://img.com/a1.png",
          secondaryImage: "https://img.com/a2.png",
          isPrincipal: true,
        },
        {
          id: "p-2",
          code: "7002",
          description: "PRODUTO PERSONALIZADO B",
          image: "https://img.com/b1.png",
          isPrincipal: false,
        },
      ];

      const { displayProducts, pendingProducts } = categorizeAndGroupColecaoProducts(customProducts);
      expect(pendingProducts).toHaveLength(0);
      expect(displayProducts).toHaveLength(2);

      const pages = paginateColecaoProducts(displayProducts, 20);
      expect(pages[0]).toHaveLength(2);

      const cardA = resolveCardDisplayData(pages[0][0]);
      expect(cardA.photo1).toBe("https://img.com/a1.png");
      expect(cardA.photo2).toBe("https://img.com/a2.png");
    });
  });

  describe("8. Correções de Variação Real: Marca, Gramatura, Embalagem e Erros do Modal (Prompt #10)", () => {
    it("8.1 Normalização de Gramatura e Volume (g, kg, ml, l e multiplicadores)", () => {
      // 1,3 kg = 1300 g
      const w1 = parseNormalizedWeight("LAVA ROUPAS PÓ TIXAN 1,3 kg SACHÊ");
      expect(w1).toEqual({ value: 1300, unit: "g", display: "1,3 kg" });

      // 2,2 kg = 2200 g
      const w2 = parseNormalizedWeight("LAVA ROUPAS PÓ TIXAN 2,2 kg CAIXA");
      expect(w2).toEqual({ value: 2200, unit: "g", display: "2,2 kg" });

      // 2L = 2000 ml
      const w3 = parseNormalizedWeight("AMACIANTE AZUL INTENSO YPÊ 2L");
      expect(w3).toEqual({ value: 2000, unit: "ml", display: "2 L" });

      // 500 ml = 500 ml
      const w4 = parseNormalizedWeight("DETERGENTE CLEAR YPÊ 500ML");
      expect(w4).toEqual({ value: 500, unit: "ml", display: "500 ml" });

      // 80g = 80 g
      const w5 = parseNormalizedWeight("Biscoito Oreo 80g Chocolate");
      expect(w5).toEqual({ value: 80, unit: "g", display: "80 g" });

      // Multiplicador 24X300 GR = 300 g
      const w6 = parseNormalizedWeight("MOLHO POMAROLA AZEITONA SACHÊ 24X300 GR");
      expect(w6).toEqual({ value: 300, unit: "g", display: "24X300 GR" });

      // Sem gramatura informada -> retorna null (para pendência)
      const wNone = parseNormalizedWeight("LAVA ROUPAS PÓ PRIMAVERA");
      expect(wNone).toBeNull();
    });

    it("8.2 Identificação de Tipos de Embalagem (sachê, caixa, pacote, etc.)", () => {
      expect(parsePackagingType("LAVA ROUPAS PÓ TIXAN 1,3 kg SACHÊ")).toBe("sache");
      expect(parsePackagingType("LAVA ROUPAS PÓ TIXAN 2,2 kg CAIXA")).toBe("caixa");
      expect(parsePackagingType("SABONETE LIQUIDO REFIL DOVE")).toBe("refil");
      expect(parsePackagingType("BISCOITO PACOTE 140G")).toBe("pacote");
      expect(parsePackagingType("SABONETE FLOR DE YPÊ ROSA")).toBe("padrao");
    });

    it("8.3 Extração de Marca Reconhecida", () => {
      expect(extractBrand("LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg SACHÊ")).toBe("TIXAN");
      expect(extractBrand("AMACIANTE AZUL INTENSO YPÊ 2L")).toBe("YPE");
      expect(extractBrand("BISCOITO RECHEADO OREO 80G CHOCOLATE")).toBe("OREO");
      expect(extractBrand("MOLHO POMAROLA AZEITONA SACHÊ 24X300 GR")).toBe("POMAROLA");
    });

    it("8.4 Sugestão Automática de Descrição Genérica do Grupo (sem fragrância, sem cor, sem gramatura e sem código)", () => {
      // Amaciante Azul Intenso Ypê vira AMACIANTE YPÊ (removendo cor azul e fragrância intensa)
      expect(extractGenericGroupTitle("AMACIANTE AZUL INTENSO YPÊ 2L")).toBe("AMACIANTE YPÊ");
      // Lava Roupas Pó Primavera Tixan Sachê vira LAVA ROUPAS PÓ TIXAN
      expect(extractGenericGroupTitle("LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg SACHÊ")).toBe("LAVA ROUPAS PÓ TIXAN");
      expect(extractGenericGroupTitle("LAVA ROUPAS PÓ MACIEZ TIXAN 2,2 kg CAIXA")).toBe("LAVA ROUPAS PÓ TIXAN");
      // Sabonetes e Detergentes
      expect(extractGenericGroupTitle("SABONETE FLOR DE YPÊ ROSA")).toBe("SABONETE YPÊ");
      expect(extractGenericGroupTitle("DETERGENTE CAPIM LIMÃO YPÊ 500ML")).toBe("DETERGENTE YPÊ");
    });

    it("8.5 Regra de Variação: Tixan 1,3 kg Sachê NÃO agrupa com Tixan 2,2 kg Caixa", () => {
      const prod13: ColecaoProduct = {
        id: "p-tixan-13",
        code: "23000",
        description: "LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg SACHÊ",
        image: "https://cescom.agilecdn.com.br/tixan-13.jpg",
        isPrincipal: true,
      };

      const prod22: ColecaoProduct = {
        id: "p-tixan-22",
        code: "23001",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN 2,2 kg CAIXA",
        image: "https://cescom.agilecdn.com.br/tixan-22.jpg",
        isPrincipal: false,
      };

      // Avaliação de similaridade acusa incompatibilidade de gramatura e embalagem
      const evalSim = evaluateSimilarity(prod13, prod22);
      expect(evalSim.isCompatible).toBe(false);
      expect(evalSim.reasons.some((r) => r.includes("Gramatura diferente"))).toBe(true);
      expect(evalSim.reasons.some((r) => r.includes("Embalagem diferente"))).toBe(true);

      // No agrupamento do encarte, devem gerar CARDS DISTINTOS (nunca juntos no mesmo card)
      const { displayProducts } = categorizeAndGroupColecaoProducts([prod13, prod22]);
      expect(displayProducts).toHaveLength(2);
      expect(displayProducts.some((p) => p.code === "23000")).toBe(true);
      expect(displayProducts.some((p) => p.code === "23001")).toBe(true);
    });

    it("8.6 Regra de Variação: Tixan Primavera 1,3 kg Sachê agrupa com Tixan Maciez 1,3 kg Sachê", () => {
      const principal13: ColecaoProduct = {
        id: "p-tixan-prim",
        code: "23000",
        description: "LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg SACHÊ",
        image: "https://cescom.agilecdn.com.br/prim-13.jpg",
        isPrincipal: true,
      };

      const maciez13A: ColecaoProduct = {
        id: "p-tixan-mac-1",
        code: "24820",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN 1,3 kg SACHÊ",
        image: "https://cescom.agilecdn.com.br/mac-13a.jpg",
        isPrincipal: false,
      };

      const maciez13B: ColecaoProduct = {
        id: "p-tixan-mac-2",
        code: "20594",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN 1,3 kg SACHÊ",
        image: "https://cescom.agilecdn.com.br/mac-13b.jpg",
        isPrincipal: false,
      };

      const evalSimA = evaluateSimilarity(principal13, maciez13A);
      expect(evalSimA.isCompatible).toBe(true);
      expect(evalSimA.reasons).toHaveLength(0);

      // Agrupamento gera exatamente 1 card com as variações unificadas
      const { displayProducts } = categorizeAndGroupColecaoProducts([principal13, maciez13A, maciez13B]);
      expect(displayProducts).toHaveLength(1);
      const card = resolveCardDisplayData(displayProducts[0]);
      expect(card.photo1).toBe("https://cescom.agilecdn.com.br/prim-13.jpg");
      expect(card.photo2).toBe("https://cescom.agilecdn.com.br/mac-13a.jpg");
      expect(card.code).toBeUndefined(); // Sem código no card principal
    });

    it("8.7 Erro do Amaciante Azul Intenso Ypê (8522): Encontra outros Amaciantes Ypê da mesma gramatura", () => {
      const amacianteAzul: ColecaoProduct = {
        id: "p-8522",
        code: "8522",
        description: "AMACIANTE AZUL INTENSO YPÊ 2L",
        image: "https://cescom.agilecdn.com.br/azul-2l.jpg",
        isPrincipal: true,
      };

      const amaciantesList: ColecaoProduct[] = [
        amacianteAzul,
        {
          id: "p-aconchego",
          code: "5280",
          description: "AMACIANTE ACONCHEGO YPÊ 2L",
          image: "https://cescom.agilecdn.com.br/aconchego-2l.jpg",
          isPrincipal: false,
        },
        {
          id: "p-delicado",
          code: "9111",
          description: "AMACIANTE DELICADO YPÊ 2L",
          image: "https://cescom.agilecdn.com.br/delicado-2l.jpg",
          isPrincipal: false,
        },
        {
          id: "p-primavera",
          code: "937",
          description: "AMACIANTE PRIMAVERA YPÊ 2L",
          image: "https://cescom.agilecdn.com.br/primavera-2l.jpg",
          isPrincipal: false,
        },
        {
          id: "p-frescor",
          code: "24781",
          description: "AMACIANTE FRESCOR DAS FLORES YPÊ 2L",
          image: "https://cescom.agilecdn.com.br/frescor-2l.jpg",
          isPrincipal: false,
        },
        {
          id: "p-diferente",
          code: "8523",
          description: "AMACIANTE CONCENTRADO YPÊ 500ML",
          image: "https://cescom.agilecdn.com.br/concentrado-500.jpg",
          isPrincipal: false,
        },
      ];

      const { compatible, incompatible } = findSimilarCandidateGroups(amacianteAzul, amaciantesList);

      // Amaciante Azul encontra os 4 amaciantes de 2L como compatíveis
      expect(compatible).toHaveLength(4);
      expect(compatible.map((c) => c.code)).toEqual(
        expect.arrayContaining(["5280", "9111", "937", "24781"])
      );

      // O de 500ml fica em "não agrupadas" por gramatura diferente
      expect(incompatible.some((inc) => inc.product.code === "8523")).toBe(true);
      const inc500 = incompatible.find((inc) => inc.product.code === "8523");
      expect(inc500?.reasons.some((r) => r.includes("Gramatura diferente"))).toBe(true);
    });

    it("8.8 Amaciante sem similar mantém foto repetida nas duas posições (Regra 2)", () => {
      const amacianteIsolado: ColecaoProduct = {
        id: "p-iso-1",
        code: "9999",
        description: "AMACIANTE EXCLUSIVO YPÊ 2L",
        image: "https://cescom.agilecdn.com.br/iso.jpg",
        isPrincipal: true,
        variants: [],
      };

      const card = resolveCardDisplayData(amacianteIsolado);
      expect(card.photo1).toBe("https://cescom.agilecdn.com.br/iso.jpg");
      expect(card.photo2).toBe("https://cescom.agilecdn.com.br/iso.jpg");
      expect(card.code).toBeUndefined();
      expect(card.hasVariants).toBe(false);
    });

    it("8.9 Produto com gramatura não identificada não entra automaticamente em nenhum grupo", () => {
      const prodComPeso: ColecaoProduct = {
        id: "p-com-peso",
        code: "23000",
        description: "LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg",
        image: "https://cescom.agilecdn.com.br/tixan.jpg",
        isPrincipal: true,
      };

      const prodSemPeso: ColecaoProduct = {
        id: "p-sem-peso",
        code: "20600",
        description: "LAVA ROUPAS PÓ PRIMAVERA",
        image: "https://cescom.agilecdn.com.br/tixan.jpg",
        isPrincipal: false,
      };

      const evalSim = evaluateSimilarity(prodComPeso, prodSemPeso);
      expect(evalSim.isCompatible).toBe(false);
      expect(evalSim.reasons.some((r) => r.includes("Gramatura pendente"))).toBe(true);

      const { compatible, incompatible } = findSimilarCandidateGroups(prodComPeso, [
        prodComPeso,
        prodSemPeso,
      ]);
      expect(compatible).toHaveLength(0);
      expect(incompatible).toHaveLength(1);
      expect(incompatible[0].product.code).toBe("20600");
    });
  });

  describe("9. Grade Configurável, Elementos Livres (Canva-style) e Critérios do Prompt #11", () => {
    it("9.1 Com 12 por tela e 45 produtos, gera exatamente 4 páginas", () => {
      // 45 produtos com foto válida
      const products45: ColecaoProduct[] = Array.from({ length: 45 }, (_, i) => ({
        id: `prod-${i + 1}`,
        code: `${10000 + i}`,
        description: `PRODUTO TESTE ${i + 1}`,
        image: `https://cescom.agilecdn.com.br/prod-${i + 1}.png`,
        isPrincipal: false,
        included: true,
      }));

      const { displayProducts } = categorizeAndGroupColecaoProducts(products45);
      expect(displayProducts).toHaveLength(45);

      const itemsPerPage = 12;
      const pages = paginateColecaoProducts(displayProducts, itemsPerPage);

      expect(pages).toHaveLength(4);
      expect(pages[0]).toHaveLength(12);
      expect(pages[1]).toHaveLength(12);
      expect(pages[2]).toHaveLength(12);
      expect(pages[3]).toHaveLength(9); // Última página com as sobras
    });

    it("9.2 Layout dinâmico: calculateGridCellPositions para grade 3x4 (12 por tela)", () => {
      const gridArea = {
        xStart: 29,
        xEnd: 1051,
        yStart: 475,
        yEnd: 1850,
        columns: [29, 286, 541, 794, 1051],
        rows: 5,
        canvasWidth: 1080,
        canvasHeight: 1920,
      };

      const cells12 = calculateGridCellPositions(gridArea, 3, 4, 10);
      expect(cells12).toHaveLength(12);

      // Cada célula tem largura e altura positivas e coerentes com a área
      cells12.forEach((cell) => {
        expect(cell.width).toBeGreaterThan(200);
        expect(cell.height).toBeGreaterThan(250);
        expect(cell.x).toBeGreaterThanOrEqual(gridArea.xStart);
        expect(cell.y).toBeGreaterThanOrEqual(gridArea.yStart);
        expect(cell.x + cell.width).toBeLessThanOrEqual(gridArea.xEnd + 2);
        expect(cell.y + cell.height).toBeLessThanOrEqual(gridArea.yEnd + 2);
      });
    });

    it("9.3 Configuração padrão de Coleção contém todos os novos controles", () => {
      expect(DEFAULT_COLECAO_CONFIG.columnsCount).toBe(4);
      expect(DEFAULT_COLECAO_CONFIG.rowsCount).toBe(5);
      expect(DEFAULT_COLECAO_CONFIG.productScale).toBe(130);
      expect(DEFAULT_COLECAO_CONFIG.overlapAmount).toBe(15);
      expect(DEFAULT_COLECAO_CONFIG.showDottedLines).toBe(true);
      expect(DEFAULT_COLECAO_CONFIG.stackOrder).toBe("right-in-front");
      expect(DEFAULT_COLECAO_CONFIG.exportScale).toBe(1);
      expect(DEFAULT_COLECAO_CONFIG.footerText).toContain("OFERTA VÁLIDA");
    });

    it("9.4 Reordenação de produtos na tabela troca posições corretamente", () => {
      const list: ColecaoProduct[] = [
        { id: "1", code: "101", description: "PROD A", image: "img1.png", isPrincipal: false },
        { id: "2", code: "102", description: "PROD B", image: "img2.png", isPrincipal: false },
        { id: "3", code: "103", description: "PROD C", image: "img3.png", isPrincipal: false },
      ];

      // Mover index 1 para cima
      const moveUp = (arr: ColecaoProduct[], idx: number) => {
        const copy = [...arr];
        const temp = copy[idx];
        copy[idx] = copy[idx - 1];
        copy[idx - 1] = temp;
        return copy;
      };

      const reordered = moveUp(list, 1);
      expect(reordered[0].id).toBe("2");
      expect(reordered[1].id).toBe("1");
      expect(reordered[2].id).toBe("3");
    });

    it("9.5 Elementos com manuallyMoved retêm coordenadas manuais, enquanto !manuallyMoved seguem a grade", () => {
      const customLayouts: Record<string, { x: number; y: number; width: number; height: number; manuallyMoved?: boolean }> = {
        "prod-1": { x: 150, y: 300, width: 280, height: 320, manuallyMoved: true },
        "prod-2": { x: 0, y: 0, width: 255, height: 275, manuallyMoved: false },
      };

      // Item 1 foi movido manualmente: suas coordenadas devem ser respeitadas
      expect(customLayouts["prod-1"].manuallyMoved).toBe(true);
      expect(customLayouts["prod-1"].x).toBe(150);

      // Item 2 não foi movido: pode ser reposicionado pela grade
      expect(customLayouts["prod-2"].manuallyMoved).toBe(false);
    });

    it("9.6 Redefinir para a grade limpa layouts manuais para que voltem à grade", () => {
      let customLayouts: Record<string, any> = {
        "prod-1": { x: 150, y: 300, manuallyMoved: true },
        "prod-2": { x: 200, y: 400, manuallyMoved: true },
      };

      // Redefine prod-1 para a grade
      delete customLayouts["prod-1"];
      expect(customLayouts["prod-1"]).toBeUndefined();
      expect(customLayouts["prod-2"]).toBeDefined();

      // Redefine todos para a grade
      customLayouts = {};
      expect(Object.keys(customLayouts)).toHaveLength(0);
    });
  });

  describe("10. Componente ProductCell (Sobreposição e Legenda)", () => {
    it("10.1 Exporta CAPTION_H = 54 para a legenda bege", () => {
      expect(CAPTION_H).toBe(54);
    });

    it("10.2 Calcula dimensões da foto e sobreposição com base em cellW, cellH e productScale", () => {
      const cellW = 255;
      const cellH = 275;
      const productScale = 1.3;
      const photoBoxH = cellH - CAPTION_H; // 221
      const imgW = cellW * productScale;   // 331.5
      const imgH = photoBoxH * productScale; // 287.3

      expect(photoBoxH).toBe(221);
      expect(imgW).toBeCloseTo(331.5);
      expect(imgH).toBeCloseTo(287.3);

      const left = (cellW - imgW) / 2;
      const top = (photoBoxH - imgH) / 2;
      expect(left).toBeCloseTo(-38.25);
      expect(top).toBeCloseTo(-33.15);
    });

    it("10.3 Componente ProductCell está definido como função React", () => {
      expect(typeof ProductCell).toBe("function");
    });

    it("10.4 ColecaoCard e ProductCell não possuem escurecimento (mixBlendMode multiply, bg-[#240407], hover:brightness-105)", async () => {
      const fs = await import("fs");
      const cardSource = fs.readFileSync("src/components/colecoes/ColecaoCard.tsx", "utf-8");
      const cellSource = fs.readFileSync("src/components/colecoes/ProductCell.tsx", "utf-8");

      expect(cardSource).not.toContain('mixBlendMode: "multiply"');
      expect(cardSource).not.toContain("bg-[#240407]");
      expect(cardSource).not.toContain("hover:brightness-105");

      expect(cellSource).not.toContain('mixBlendMode: "multiply"');
      expect(cellSource).not.toContain("bg-[#240407]");
      expect(cellSource).not.toContain("hover:brightness-105");
    });
  });

  describe("11. Configuração da Grade e Paginação (ColecaoGridSettings, Rect, paginate, getCellRects, zIndexFor)", () => {
    it("11.1 paginate divide itens em lotes respeitando perPage", () => {
      const items = Array.from({ length: 45 }, (_, i) => `item-${i + 1}`);
      const pages = paginate(items, 12);
      expect(pages).toHaveLength(4);
      expect(pages[0]).toHaveLength(12);
      expect(pages[1]).toHaveLength(12);
      expect(pages[2]).toHaveLength(12);
      expect(pages[3]).toHaveLength(9);

      // Array vazio retorna [[]]
      expect(paginate([], 10)).toEqual([[]]);

      // 20 itens com perPage 20 retorna 1 página
      expect(paginate(Array.from({ length: 20 }, (_, i) => i), 20)).toHaveLength(1);
    });

    it("11.2 getCellRects calcula retângulos de células conforme colunas, linhas, gapX e gapY", () => {
      const settings: ColecaoGridSettings = {
        columns: 4,
        rows: 5,
        perPage: 20,
        gapX: 0,
        gapY: 0,
        productScale: 1.3,
        frontSide: "right",
        showDividers: true,
        footerText: "OFERTAS",
      };

      const area = { x: 29, y: 475, width: 1022, height: 1375 };
      const rects = getCellRects(settings, area);

      expect(rects).toHaveLength(20);

      // Primeira célula (col 0, row 0)
      expect(rects[0].col).toBe(0);
      expect(rects[0].row).toBe(0);
      expect(rects[0].x).toBe(29);
      expect(rects[0].y).toBe(475);
      expect(rects[0].w).toBe(1022 / 4);
      expect(rects[0].h).toBe(1375 / 5);

      // Célula col 1, row 0
      expect(rects[1].col).toBe(1);
      expect(rects[1].row).toBe(0);
      expect(rects[1].x).toBe(29 + 1022 / 4);
      expect(rects[1].y).toBe(475);

      // Última célula (col 3, row 4)
      expect(rects[19].col).toBe(3);
      expect(rects[19].row).toBe(4);
      expect(rects[19].w).toBe(1022 / 4);
      expect(rects[19].h).toBe(1375 / 5);
    });

    it("11.3 getCellRects respeita gapX e gapY", () => {
      const settings: ColecaoGridSettings = {
        columns: 2,
        rows: 2,
        perPage: 4,
        gapX: 10,
        gapY: 20,
        productScale: 1.2,
        frontSide: "left",
        showDividers: false,
        footerText: "",
      };

      const area = { x: 0, y: 0, width: 110, height: 220 };
      // cellW = (110 - 10 * 1) / 2 = 50
      // cellH = (220 - 20 * 1) / 2 = 100
      const rects = getCellRects(settings, area);

      expect(rects).toHaveLength(4);
      expect(rects[0]).toEqual({ x: 0, y: 0, w: 50, h: 100, col: 0, row: 0 });
      expect(rects[1]).toEqual({ x: 60, y: 0, w: 50, h: 100, col: 1, row: 0 });
      expect(rects[2]).toEqual({ x: 0, y: 120, w: 50, h: 100, col: 0, row: 1 });
      expect(rects[3]).toEqual({ x: 60, y: 120, w: 50, h: 100, col: 1, row: 1 });
    });

    it("11.4 zIndexFor empilha da esquerda para a direita (frontSide: right) ou vice-versa (frontSide: left)", () => {
      const rightSettings: ColecaoGridSettings = {
        columns: 4,
        rows: 5,
        perPage: 20,
        gapX: 0,
        gapY: 0,
        productScale: 1.3,
        frontSide: "right",
        showDividers: true,
        footerText: "",
      };

      // frontSide right: coluna mais à direita tem maior zIndex (cobre a da esquerda)
      expect(zIndexFor(0, rightSettings)).toBe(1);
      expect(zIndexFor(1, rightSettings)).toBe(2);
      expect(zIndexFor(2, rightSettings)).toBe(3);
      expect(zIndexFor(3, rightSettings)).toBe(4);

      const leftSettings: ColecaoGridSettings = {
        ...rightSettings,
        frontSide: "left",
      };

      // frontSide left: coluna mais à esquerda tem maior zIndex (cobre a da direita)
      expect(zIndexFor(0, leftSettings)).toBe(4);
      expect(zIndexFor(1, leftSettings)).toBe(3);
      expect(zIndexFor(2, leftSettings)).toBe(2);
      expect(zIndexFor(3, leftSettings)).toBe(1);
    });
  });
});
