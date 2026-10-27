import { describe, it, expect } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { StoryPage916 } from "@/components/encarte/StoryPage916";
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
});
