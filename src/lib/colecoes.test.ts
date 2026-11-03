import { describe, it, expect } from "vitest";
import type { ColecaoProduct } from "@/types/colecoes";
import {
  resolveCardDisplayData,
  paginateColecaoProducts,
  calculateGridCellPositions,
} from "./colecoes-layout";
import {
  extractGenericBaseName,
  findSimilarCandidates,
  areProductsSimilar,
} from "./colecoes-similarity";
import {
  formatColecaoPageFilename,
  sanitizeCollectionFileName,
} from "./colecoes-export";

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
});
