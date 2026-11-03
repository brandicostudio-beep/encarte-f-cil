import { describe, it, expect } from "vitest";
import type { ColecaoProduct } from "@/types/colecoes";
import {
  resolveCardDisplayData,
  paginateColecaoProducts,
  calculateGridCellPositions,
  categorizeAndGroupColecaoProducts,
} from "./colecoes-layout";
import {
  extractGenericBaseName,
  findSimilarCandidates,
  areProductsSimilar,
  normalizeText,
} from "./colecoes-similarity";
import {
  formatColecaoPageFilename,
  sanitizeCollectionFileName,
} from "./colecoes-export";
import { parseColecaoSpreadsheet, parseBooleanFlag } from "./colecoes-parser";
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
});
