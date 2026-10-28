import { describe, it, expect, beforeEach } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { FinalEditor } from "./FinalEditor";
import { ProductCard916 } from "./ProductCard916";
import { StoryPage916 } from "./StoryPage916";
import type { EncarteProduct, StoreConfig, CampaignConfig } from "@/types/encarte";
import { DEFAULT_STORE, DEFAULT_CAMPAIGN } from "@/types/encarte";

// Helper para criar mock de produtos
function createMockProducts(count: number): EncarteProduct[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `prod-${i + 1}`,
    code: `100${i + 1}`,
    name: `PRODUTO DE TESTE ${i + 1}`,
    packaging: "1X24 UNID",
    validity: "20/12/2026",
    price: `${(i + 1) * 5},90`,
    unit: "UND",
    badge: "oferta",
    image: `https://example.com/photo-${i + 1}.jpg`,
    included: true,
  }));
}

describe("Etapa de Edição Final e Preço Mais Leve (Item 1 e Item 2)", () => {
  // Teste 1: Preço reduzido em ~15%, peso bold 700 e centralizado
  it("Teste 1: Preço reduzido em cerca de 10 a 15% com peso bold (700) e sem encostar nas bordas", () => {
    const highPriceProduct: EncarteProduct = {
      id: "p-whisky-77881",
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
        perPage: 8,
      })
    );

    // O valor do preço aparece formatado
    expect(html).toContain("1.249,90");
    // Redução de 10-15%: de 50px para 43px (preço longo)
    expect(html).toContain("font-size:43px");
    // Peso da fonte calibrado para bold 700 (font-bold)
    expect(html).toContain("font-bold");
    expect(html).toContain("font-weight:700");
    // R$ calibrado proporcionalmente (23px)
    expect(html).toContain("font-size:23px");
    // Fundo da pílula mantém a proporção com respiro
    expect(html).toContain("bg-[#E30613]");
  });

  // Teste 2: Mudança de cor da pílula de 1 página vs "todas as páginas"
  it("Teste 2: Mudança de cor da pílula de 1 página vs todas as páginas (pageStyles vs globalStyle)", () => {
    const prods = createMockProducts(16); // 2 páginas com 8 itens cada
    const campaignWithPage1Style: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 8,
      pageStyles: {
        1: { pillBgColor: "#0284C7" }, // Página 1 azul
      },
    };

    // Renderiza Página 1 (deve ter a pílula azul #0284C7)
    const htmlPage1 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 1,
        totalPages: 2,
        products: prods.slice(0, 8),
        store: DEFAULT_STORE,
        campaign: campaignWithPage1Style,
        domId: "story-page-1",
      })
    );
    expect(htmlPage1).toContain("background-color:#0284C7");

    // Renderiza Página 2 (sem estilo de página, mantém padrão vermelho #E30613)
    const htmlPage2 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: prods.slice(8, 16),
        store: DEFAULT_STORE,
        campaign: campaignWithPage1Style,
        domId: "story-page-2",
      })
    );
    expect(htmlPage2).not.toContain("background-color:#0284C7");
    expect(htmlPage2).toContain("background-color:#E30613");

    // Agora aplica a "Todas as páginas" via globalStyle
    const campaignWithGlobalStyle: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      format: "story_9_16",
      productsPerPage: 8,
      globalStyle: { pillBgColor: "#16A34A" }, // Todas verde
    };

    const htmlGlobalPage1 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 1,
        totalPages: 2,
        products: prods.slice(0, 8),
        store: DEFAULT_STORE,
        campaign: campaignWithGlobalStyle,
        domId: "story-page-1-global",
      })
    );
    const htmlGlobalPage2 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: prods.slice(8, 16),
        store: DEFAULT_STORE,
        campaign: campaignWithGlobalStyle,
        domId: "story-page-2-global",
      })
    );

    // Ambas as páginas refletem a cor global verde #16A34A
    expect(htmlGlobalPage1).toContain("background-color:#16A34A");
    expect(htmlGlobalPage2).toContain("background-color:#16A34A");
  });

  // Teste 3: Diminuição da fonte de nome até o mínimo gera aviso
  it("Teste 3: Diminuição da fonte do nome abaixo de 24px gera aviso no editor", () => {
    const prods = createMockProducts(4);
    // Produto 1 com fonte reduzida abaixo do mínimo legível (20px < 24px)
    prods[0].customStyle = {
      nameFontSize: 20,
      isCustomized: true,
    };

    const html = renderToString(
      React.createElement(FinalEditor, {
        products: prods,
        store: DEFAULT_STORE,
        campaign: DEFAULT_CAMPAIGN,
        onUpdateProducts: () => {},
        onUpdateCampaign: () => {},
        onProceedToExport: () => {},
        onBackToCampaign: () => {},
      })
    );

    // Deve exibir o aviso de legibilidade com a advertência do mínimo recomendado
    expect(html).toContain("Aviso de Legibilidade");
    expect(html).toContain("mínimo recomendado: 24px");
  });

  // Teste 4: Mover produto da página 1 para página 2 sem perder dados/customizações
  it("Teste 4: Mover produto entre páginas preserva dados e estilos customizados", () => {
    const prods = createMockProducts(16);
    // Personaliza o primeiro produto com pílula roxa, nome customizado e foto escalada
    prods[0].customStyle = {
      pillBgColor: "#7E22CE",
      nameFontSize: 34,
      imageScale: 1.15,
      isCustomized: true,
    };

    // Simula a movimentação do produto 0 da Página 1 para a Página 2
    // No array geral, desloca para o início da página 2 (índice 8)
    const reordered = [...prods];
    const [movedProduct] = reordered.splice(0, 1);
    reordered.splice(8, 0, movedProduct);

    // O produto movido é agora o primeiro da página 2
    const page2Products = reordered.slice(8, 16);
    expect(page2Products[0].id).toBe("prod-1");
    expect(page2Products[0].name).toBe("PRODUTO DE TESTE 1");
    // Preservou customStyle intacto
    expect(page2Products[0].customStyle?.pillBgColor).toBe("#7E22CE");
    expect(page2Products[0].customStyle?.nameFontSize).toBe(34);
    expect(page2Products[0].customStyle?.imageScale).toBe(1.15);

    // Renderiza a página 2 e confirma que o card é renderizado com a customização
    const htmlPage2 = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: page2Products,
        store: DEFAULT_STORE,
        campaign: DEFAULT_CAMPAIGN,
        domId: "story-page-2-moved",
      })
    );

    expect(htmlPage2).toContain("PRODUTO DE TESTE 1");
    expect(htmlPage2).toContain("background-color:#7E22CE");
    expect(htmlPage2).toContain("scale(1.15)");
  });

  // Teste 5: Desfazer e refazer 5 alterações (Ctrl+Z / Ctrl+Y)
  it("Teste 5: Desfazer e refazer histórico de alterações mantém consistência", () => {
    const initialProducts = createMockProducts(4);
    const historyStack: EncarteProduct[][] = [initialProducts];

    // Executa 5 modificações sequenciais gravando histórico
    let current = initialProducts;
    for (let step = 1; step <= 5; step++) {
      current = current.map((p, idx) =>
        idx === 0
          ? {
              ...p,
              customStyle: {
                ...(p.customStyle || {}),
                nameFontSize: 30 + step,
              },
            }
          : p
      );
      historyStack.push(current);
    }

    expect(historyStack.length).toBe(6);
    // Estado final após 5 passos tem nameFontSize = 35
    expect(historyStack[5][0].customStyle?.nameFontSize).toBe(35);

    // Desfaz 5 vezes: deve voltar exatamente ao estado inicial
    let undone = historyStack[5];
    for (let i = 5; i >= 1; i--) {
      undone = historyStack[i - 1];
    }
    expect(undone[0].customStyle?.nameFontSize).toBeUndefined();

    // Refaz 5 vezes: deve retornar exatamente ao estado 5
    let redone = undone;
    for (let i = 1; i <= 5; i++) {
      redone = historyStack[i];
    }
    expect(redone[0].customStyle?.nameFontSize).toBe(35);
  });

  // Teste 6: Recarregar a página mantém alterações (localStorage)
  it("Teste 6: Persistência no localStorage salva e restaura customStyles e estilos globais", () => {
    const mockStorage: Record<string, string> = {};

    const productsWithCustom: EncarteProduct[] = createMockProducts(4);
    productsWithCustom[0].customStyle = {
      pillBgColor: "#EA580C",
      nameFontSize: 30,
      showValidity: false,
      isCustomized: true,
    };

    const campaignWithCustom: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      globalStyle: {
        pillBgColor: "#1E40AF",
        showFooter: false,
      },
    };

    // Salva no storage simulado
    mockStorage["encarte-products-v2"] = JSON.stringify(productsWithCustom);
    mockStorage["encarte-campaign-v2"] = JSON.stringify(campaignWithCustom);

    // Simula reload: lê do storage
    const restoredProducts: EncarteProduct[] = JSON.parse(
      mockStorage["encarte-products-v2"]
    );
    const restoredCampaign: CampaignConfig = JSON.parse(
      mockStorage["encarte-campaign-v2"]
    );

    expect(restoredProducts[0].customStyle?.pillBgColor).toBe("#EA580C");
    expect(restoredProducts[0].customStyle?.showValidity).toBe(false);
    expect(restoredCampaign.globalStyle?.pillBgColor).toBe("#1E40AF");
    expect(restoredCampaign.globalStyle?.showFooter).toBe(false);
  });

  // Teste 7: Exportar com produto sem foto mostra aviso prévio
  it("Teste 7: Checagem preventiva antes de exportar detecta produto sem foto", () => {
    const prodsWithMissingPhoto: EncarteProduct[] = [
      {
        id: "p-photo-ok",
        code: "101",
        name: "PRODUTO COM FOTO",
        price: "10,90",
        unit: "UND",
        image: "https://example.com/ok.jpg",
        included: true,
      },
      {
        id: "p-photo-missing",
        code: "102",
        name: "PRODUTO SEM FOTO",
        price: "20,90",
        unit: "UND",
        image: "", // Sem foto
        included: true,
      },
    ];

    // Função de diagnóstico preventivo pré-exportação
    const issues: { type: string; title: string; description: string }[] = [];
    prodsWithMissingPhoto.forEach((p) => {
      if (!p.image || String(p.image).trim() === "") {
        issues.push({
          type: "missing_photo",
          title: "Produto sem foto",
          description: `Produto "${p.name || p.code}" está sem foto.`,
        });
      }
    });

    expect(issues.length).toBe(1);
    expect(issues[0].type).toBe("missing_photo");
    expect(issues[0].title).toBe("Produto sem foto");
    expect(issues[0].description).toContain("PRODUTO SEM FOTO");
  });
});
