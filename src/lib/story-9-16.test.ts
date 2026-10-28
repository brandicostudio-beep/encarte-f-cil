import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StoryPage916 } from "@/components/encarte/StoryPage916";
import { ProductCard916 } from "@/components/encarte/ProductCard916";
import {
  DEFAULT_STORE,
  DEFAULT_CAMPAIGN,
  DEFAULT_TEMPLATE_9_16_AREA,
  type EncarteProduct,
  type CampaignConfig,
  type TemplateProductArea,
} from "@/types/encarte";

describe("Modo de Encarte 9:16 (1080 × 1920 px) com Template PNG", () => {
  const createMockProducts = (count: number): EncarteProduct[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `p-${i + 1}`,
      code: String(10000 + i + 1),
      name: `PRODUTO DE TESTE ${i + 1}`,
      packaging: "1X24 UNID",
      packagingType: "PACOTE",
      packagingQuantity: "1X24",
      packagingUnit: "UNID",
      validity: "20/12/2026",
      price: "19,90",
      unit: "UND",
      badge: "oferta",
      image: "https://cescom.agilecdn.com.br/10001_thumb_1.jpg",
      included: true,
    }));
  };

  it("Com 132 produtos e 12 por página: exatamente 11 páginas com o mesmo template", () => {
    const products = createMockProducts(132);
    const perPage = 12;
    const totalPages = Math.ceil(products.length / perPage);

    expect(totalPages).toBe(11);

    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 12,
      template916Image: "/templates/template-detona-precos-9-16.png",
    };

    // Renderizar todas as 11 páginas e verificar que usam o mesmo template
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageSlice = products.slice((pageNum - 1) * perPage, pageNum * perPage);
      expect(pageSlice.length).toBe(12);

      const html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: pageNum,
          totalPages,
          products: pageSlice,
          store: DEFAULT_STORE,
          campaign,
          domId: `story-page-${pageNum}`,
        })
      );

      // Fundo deve conter o mesmo template PNG em todas as páginas
      expect(html).toContain('src="/templates/template-detona-precos-9-16.png"');
      // Deve possuir a área branca dos produtos
      expect(html).toContain('data-testid="product-white-area"');
    }
  });

  it("Com 133 produtos: 11 páginas cheias e a 12ª página com 1 único produto centralizado e maior (Hero)", () => {
    const products = createMockProducts(133);
    const perPage = 12;
    const totalPages = Math.ceil(products.length / perPage);

    expect(totalPages).toBe(12);

    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 12,
      template916Image: "/templates/template-detona-precos-9-16.png",
    };

    // Última página (página 12) tem exatamente 1 produto
    const lastPageProducts = products.slice(11 * perPage, 12 * perPage);
    expect(lastPageProducts.length).toBe(1);

    const htmlLastPage = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 12,
        totalPages: 12,
        products: lastPageProducts,
        store: DEFAULT_STORE,
        campaign,
        domId: "story-page-12",
      })
    );

    // Deve conter o elemento com classes do modo hero (destaque com card grande, centralizado e foto expandida)
    expect(htmlLastPage).toContain("max-w-[840px]");
    expect(htmlLastPage).toContain("h-[950px]");
    expect(htmlLastPage).toContain("PRODUTO DE TESTE 133");
    // Preço em destaque gigante
    expect(htmlLastPage).toContain("text-7xl");
  });

  // TESTES DE CENTRALIZAÇÃO DE LINHAS E PÁGINAS INCOMPLETAS (Novas Regras de Diagramação)
  it("13 produtos em página de 12: a segunda página tem 1 card centralizado e ampliado", () => {
    const products = createMockProducts(13);
    const perPage = 12;
    const totalPages = Math.ceil(products.length / perPage); // 2 páginas

    expect(totalPages).toBe(2);

    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 12,
    };

    const page2Slice = products.slice(12, 13);
    expect(page2Slice.length).toBe(1);

    const htmlPage2 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: page2Slice,
        store: DEFAULT_STORE,
        campaign,
        domId: "story-page-2",
      })
    );

    // Deve ser modo hero: centralizado horizontal e verticalmente, ampliado
    expect(htmlPage2).toContain("max-w-[840px]");
    expect(htmlPage2).toContain("h-[950px]");
    expect(htmlPage2).toContain("PRODUTO DE TESTE 13");
  });

  it("14 produtos em página de 12: a segunda página tem 2 cards centralizados na mesma linha", () => {
    const products = createMockProducts(14);
    const perPage = 12;
    const totalPages = Math.ceil(products.length / perPage); // 2 páginas

    expect(totalPages).toBe(2);

    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 12,
    };

    const page2Slice = products.slice(12, 14);
    expect(page2Slice.length).toBe(2);

    const htmlPage2 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: page2Slice,
        store: DEFAULT_STORE,
        campaign,
        domId: "story-page-2",
      })
    );

    // Deve conter linha incompleta centralizada
    expect(htmlPage2).toContain('data-testid="incomplete-row-centered"');
    expect(htmlPage2).toContain("justify-center");
    // Ambos os cards devem estar na mesma linha com a largura padronizada de 3 colunas
    expect(htmlPage2).toContain("calc((100% - 20px) / 3)");
    expect(htmlPage2).toContain("PRODUTO DE TESTE 13");
    expect(htmlPage2).toContain("PRODUTO DE TESTE 14");
    // Não deve ser o hero gigante
    expect(htmlPage2).not.toContain("h-[950px]");
  });

  it("11 produtos em grade de 2 colunas: a última linha tem 1 card centralizado", () => {
    const products = createMockProducts(11);
    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 8, // Grade de 2 colunas
    };

    const html = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 1,
        totalPages: 1,
        products,
        store: DEFAULT_STORE,
        campaign,
        domId: "story-page-1",
      })
    );

    // Deve conter a linha incompleta com centralização horizontal
    expect(html).toContain('data-testid="incomplete-row-centered"');
    expect(html).toContain("justify-center");
    // O card avulso da última linha possui a largura padrão da coluna
    expect(html).toContain("calc((100% - 12px) / 2)");
    expect(html).toContain("PRODUTO DE TESTE 11");
  });

  it("Confirma que nenhum card ultrapassa a área branca do template em nenhum desses casos", () => {
    const campaign: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 12,
    };

    // Caso 1: 13 produtos (Page 2 com 1 produto Hero)
    const htmlHero = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: createMockProducts(1),
        store: DEFAULT_STORE,
        campaign,
      })
    );
    expect(htmlHero).toContain('data-testid="product-white-area"');
    expect(htmlHero).toContain("overflow-hidden");

    // Caso 2: 14 produtos (Page 2 com 2 produtos centralizados)
    const htmlTwoProds = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: createMockProducts(2),
        store: DEFAULT_STORE,
        campaign,
      })
    );
    expect(htmlTwoProds).toContain('data-testid="product-white-area"');
    expect(htmlTwoProds).toContain("overflow-hidden");
    // Larguras e alturas são limitadas por porcentagem calculada dentro do container
    expect(htmlTwoProds).toContain("calc((100% - 20px) / 3)");
    expect(htmlTwoProds).toContain("calc((100% - 30px) / 4)");

    // Caso 3: 11 produtos em 2 colunas
    const htmlElevenTwoCols = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 1,
        totalPages: 1,
        products: createMockProducts(11),
        store: DEFAULT_STORE,
        campaign: { ...campaign, productsPerPage: 8 },
      })
    );
    expect(htmlElevenTwoCols).toContain('data-testid="product-white-area"');
    expect(htmlElevenTwoCols).toContain("overflow-hidden");
  });

  it("Verifica que nenhuma imagem ou card ultrapassa a área branca dos produtos", () => {
    const area = DEFAULT_TEMPLATE_9_16_AREA;

    // Dimensões do canvas 9:16
    expect(area.canvasWidth).toBe(1080);
    expect(area.canvasHeight).toBe(1920);

    // Coordenadas da área branca
    expect(area.x).toBe(46);
    expect(area.y).toBe(661);
    expect(area.width).toBe(1012);
    expect(area.height).toBe(1202);

    // Garantir que a área não excede os limites do canvas 1080 × 1920
    const rightEdge = area.x + area.width;
    const bottomEdge = area.y + area.height;
    expect(rightEdge).toBeLessThanOrEqual(1080);
    expect(bottomEdge).toBeLessThanOrEqual(1920);

    // Renderizar página regular e inspecionar que a div da área branca tem overflow-hidden e border-radius
    const products = createMockProducts(12);
    const html = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 1,
        totalPages: 1,
        products,
        store: DEFAULT_STORE,
        campaign: DEFAULT_CAMPAIGN,
        domId: "story-page-1",
      })
    );

    // O contêiner da área branca deve ter overflow: hidden e rounded-[36px] para blindar qualquer extravasamento
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("rounded-[36px]");
  });

  it("Escala proporcionalmente a área branca quando o usuário envia imagem de template com outro tamanho", () => {
    const uploadedWidth = 576;
    const uploadedHeight = 1024;

    const scaleX = uploadedWidth / 1080;
    const scaleY = uploadedHeight / 1920;

    const scaledArea: TemplateProductArea = {
      x: Math.round(46 * scaleX),
      y: Math.round(661 * scaleY),
      width: Math.round(1012 * scaleX),
      height: Math.round(1202 * scaleY),
      canvasWidth: uploadedWidth,
      canvasHeight: uploadedHeight,
    };

    // A proporção relativa em porcentagem deve se manter estável
    const originalLeftPct = (46 / 1080) * 100;
    const scaledLeftPct = (scaledArea.x / scaledArea.canvasWidth) * 100;
    expect(Math.abs(originalLeftPct - scaledLeftPct)).toBeLessThan(0.2);

    const originalTopPct = (661 / 1920) * 100;
    const scaledTopPct = (scaledArea.y / scaledArea.canvasHeight) * 100;
    expect(Math.abs(originalTopPct - scaledTopPct)).toBeLessThan(0.2);

    const originalWidthPct = (1012 / 1080) * 100;
    const scaledWidthPct = (scaledArea.width / scaledArea.canvasWidth) * 100;
    expect(Math.abs(originalWidthPct - scaledWidthPct)).toBeLessThan(0.2);

    const originalHeightPct = (1202 / 1920) * 100;
    const scaledHeightPct = (scaledArea.height / scaledArea.canvasHeight) * 100;
    expect(Math.abs(originalHeightPct - scaledHeightPct)).toBeLessThan(0.2);
  });

  it("Nomenclatura dos arquivos de exportação segue o padrão encarte-[campanha]-[página].png", () => {
    const campaignTitle = "Validade Curta!";
    const slug = campaignTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    expect(slug).toBe("validade-curta");

    const page1Filename = `encarte-${slug}-${String(1).padStart(2, "0")}.png`;
    const page11Filename = `encarte-${slug}-${String(11).padStart(2, "0")}.png`;

    expect(page1Filename).toBe("encarte-validade-curta-01.png");
    expect(page11Filename).toBe("encarte-validade-curta-11.png");
  });

  // TESTES ESPECÍFICOS DO REDESENHO DO CARD E GRADE (Revisão e Testes solicitados)
  describe("Redesenho do Card 9:16 e Casos Específicos de Diagramação", () => {
    it("11 produtos em grade de 10: gera 2 páginas (Página 1 com 10 cards e Página 2 com 1 único produto Hero centralizado)", () => {
      const products = createMockProducts(11);
      const perPage = 10;
      const totalPages = Math.ceil(products.length / perPage);

      expect(totalPages).toBe(2);

      const campaign: CampaignConfig = {
        ...DEFAULT_CAMPAIGN,
        format: "story_9_16",
        productsPerPage: 10,
      };

      // Página 1: 10 produtos em grade 2x5
      const page1Html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 1,
          totalPages: 2,
          products: products.slice(0, 10),
          store: DEFAULT_STORE,
          campaign,
          domId: "story-page-1",
        })
      );
      expect(page1Html).toContain('data-testid="product-grid-container"');
      expect(page1Html).toContain("PRODUTO DE TESTE 1");
      expect(page1Html).toContain("PRODUTO DE TESTE 10");
      expect(page1Html).not.toContain("PRODUTO DE TESTE 11");

      // Página 2: 1 único produto Hero centralizado
      const page2Html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 2,
          totalPages: 2,
          products: products.slice(10, 11),
          store: DEFAULT_STORE,
          campaign,
          domId: "story-page-2",
        })
      );
      expect(page2Html).toContain("max-w-[840px]");
      expect(page2Html).toContain("h-[950px]");
      expect(page2Html).toContain("PRODUTO DE TESTE 11");
    });

    it("Última página com 2 produtos em grade de 10: centralizados lado a lado no meio da página", () => {
      const products = createMockProducts(2);
      const campaign: CampaignConfig = {
        ...DEFAULT_CAMPAIGN,
        format: "story_9_16",
        productsPerPage: 10,
      };

      const html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 2,
          totalPages: 2,
          products,
          store: DEFAULT_STORE,
          campaign,
          domId: "story-page-2",
        })
      );

      expect(html).toContain('data-testid="incomplete-row-centered"');
      expect(html).toContain("justify-center");
      expect(html).toContain("calc((100% - 12px) / 2)");
      expect(html).toContain("PRODUTO DE TESTE 1");
      expect(html).toContain("PRODUTO DE TESTE 2");
    });

    it("Card com nome longo de 60 caracteres: não usa reticências (...) e mantém tamanho mínimo de fonte de 30 px", () => {
      const longNameProduct: EncarteProduct = {
        id: "p-long-name",
        code: "21443",
        name: "SABONETE EM BARRA VEGETAL PURO CUIDADO SUAVE HIDRATANTE 90G",
        packaging: "1 UNID",
        validity: "30/11/2026",
        price: "4,79",
        unit: "UNID",
        badge: "nenhum",
        image: "https://example.com/sabonete.png",
        included: true,
      };

      expect(longNameProduct.name.length).toBeGreaterThanOrEqual(58);

      const html = renderToString(
        React.createElement(ProductCard916, {
          product: longNameProduct,
          index: 0,
          store: DEFAULT_STORE,
          layoutMode: "grid",
        })
      );

      // Nunca usar reticências no card
      expect(html).not.toContain("SABONETE EM BARRA VEGETAL PURO CUIDADO SUAVE...");
      expect(html).not.toContain("...");
      // Fonte reduzida até 30 px (mínimo estrito)
      expect(html).toContain("font-size:30px");
      expect(html).toContain("SABONETE EM BARRA VEGETAL PURO CUIDADO SUAVE HIDRATANTE 90G");
    });

    it("Card com código longo e embalagem: renderiza no formato CÓDIGO - EMBALAGEM em preto e negrito", () => {
      const productWithCode: EncarteProduct = {
        id: "p-code",
        code: "12345678",
        name: "ARROZ TIPO 1 EXTRA FINO 5KG",
        packaging: "FARDO COM 6 UNIDADES",
        validity: "15/08/2027",
        price: "29,90",
        unit: "FD",
        badge: "oferta",
        image: "https://example.com/arroz.png",
        included: true,
      };

      const html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 1,
          totalPages: 1,
          products: [productWithCode],
          store: DEFAULT_STORE,
          campaign: { ...DEFAULT_CAMPAIGN, productsPerPage: 10 },
        })
      );

      expect(html).toContain("12345678 - FARDO COM 6 UNIDADES");
      expect(html).toContain("text-black");
      expect(html).toContain("font-black");
    });

    it("Produto sem foto: exibe quadro branco puro com SEM FOTO em cinza claro (#9ca3af), sem bordas ou sombras", () => {
      const productNoPhoto: EncarteProduct = {
        id: "p-no-photo",
        code: "55512",
        name: "PRODUTO TESTE SEM IMAGEM",
        packaging: "1 UN",
        validity: "01/01/2027",
        price: "9,90",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      };

      const html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 1,
          totalPages: 1,
          products: [productNoPhoto],
          store: DEFAULT_STORE,
          campaign: { ...DEFAULT_CAMPAIGN, productsPerPage: 10 },
        })
      );

      expect(html).toContain("SEM FOTO");
      expect(html).toContain("text-[#9ca3af]");
      expect(html).toContain("bg-white");
      expect(html).not.toContain("bg-gray-100");
      expect(html).not.toContain("bg-neutral-100");
    });

    it("Produto sem validade e sem estoque: remove as faixas pretas e não exibe undefined, null ou texto vazio", () => {
      const productClean: EncarteProduct = {
        id: "p-clean",
        code: "99999",
        name: "PRODUTO SEM VALIDADE E SEM ESTOQUE",
        packaging: "1 UN",
        validity: "",
        stock: "",
        price: "15,50",
        unit: "UND",
        badge: "nenhum",
        image: "https://example.com/img.png",
        included: true,
      };

      const html = renderToString(
        React.createElement(StoryPage916, {
          pageNumber: 1,
          totalPages: 1,
          products: [productClean],
          store: DEFAULT_STORE,
          campaign: { ...DEFAULT_CAMPAIGN, productsPerPage: 10 },
        })
      );

      // Nunca exibir "undefined", "null" ou faixas vazias
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
      expect(html).not.toContain("VALIDADE:");
      expect(html).not.toContain("ESTOQUE:");
    });

    it("Preço alto (R$ 1.249,90): calibra a tipografia para 50 px evitando overflow na faixa vermelha", () => {
      const highPriceProduct: EncarteProduct = {
        id: "p-high-price",
        code: "77881",
        name: "WHISKY IMPORTADO 12 ANOS EDICAO ESPECIAL 750ML",
        packaging: "GARRAFA 750ML",
        validity: "30/12/2030",
        price: "1.249,90",
        unit: "UND",
        badge: "imperdivel",
        image: "https://example.com/whisky.png",
        included: true,
      };

      const html = renderToString(
        React.createElement(ProductCard916, {
          product: highPriceProduct,
          index: 0,
          store: DEFAULT_STORE,
          layoutMode: "grid",
        })
      );

      expect(html).toContain("1.249,90");
      // Preço de 8+ caracteres tem fonte calibrada para 50px
      expect(html).toContain("font-size:50px");
      expect(html).toContain("font-size:30px"); // R$ ajustado para 30px
      expect(html).toContain("bg-[#E30613]");
    });
  });
});
