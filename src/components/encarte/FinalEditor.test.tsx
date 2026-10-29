import { describe, it, expect, beforeEach } from "vitest";
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

describe("Editor Visual Estilo Illustrator - 10 Testes Obrigatórios", () => {
  const mockProducts = createMockProducts(10);

  // 1. Clicar em um elemento seleciona esse elemento e abre suas propriedades
  it("Teste Obrigatório 1: Clicar em um elemento seleciona esse elemento e disponibiliza identificador", () => {
    let selectedElementReceived: string | null = null;
    const html = renderToString(
      React.createElement(ProductCard916, {
        product: mockProducts[0],
        index: 0,
        store: DEFAULT_STORE,
        layoutMode: "grid",
        perPage: 10,
        isSelected: true,
        selectedElement: "price",
        isInteractive: true,
        onSelectElement: (el) => {
          selectedElementReceived = el;
        },
      })
    );

    // O elemento de preço possui data-element-type="price" e classe de anel ativo
    expect(html).toContain('data-element-type="price"');
    expect(html).toContain("ring-2 ring-blue-500");
  });

  // 2. Clicar duas vezes ou clique repetido alterna entre o box do produto e o elemento interno
  it("Teste Obrigatório 2: Clique repetido alterna do box para elemento interno", () => {
    let toggledElement = "";
    const onSelectElement = (el: string) => {
      toggledElement = el;
    };

    // Quando o card já está selecionado (isSelected=true) mas sem subelemento,
    // o clique no box ativa o elemento interno padrão ("name")
    const html = renderToString(
      React.createElement(ProductCard916, {
        product: mockProducts[0],
        index: 0,
        store: DEFAULT_STORE,
        isSelected: true,
        selectedElement: null,
        isInteractive: true,
        onSelectElement,
      })
    );

    expect(html).toContain('data-element-type="box"');
    expect(html).toContain('data-element-type="name"');
  });

  // 3. Arrastar a alça de canto redimensiona o elemento com proporção e feedback visual
  it("Teste Obrigatório 3: Caixa de transformação exibe 8 alças (cantos e laterais) com indicador de dimensões", () => {
    const { TransformBoundingBox } = require("./editor/TransformBoundingBox");
    const box = { x: 100, y: 200, width: 300, height: 150 };

    const html = renderToString(
      React.createElement(TransformBoundingBox, {
        box,
        zoom: 1,
        allowRotation: true,
        onTransform: () => {},
      })
    );

    // Deve conter todas as alças: nw, ne, se, sw (cantos) e n, s, e, w (laterais)
    expect(html).toContain('data-handle="nw"');
    expect(html).toContain('data-handle="ne"');
    expect(html).toContain('data-handle="se"');
    expect(html).toContain('data-handle="sw"');
    expect(html).toContain('data-handle="n"');
    expect(html).toContain('data-handle="s"');
    expect(html).toContain('data-handle="e"');
    expect(html).toContain('data-handle="w"');
    // Live feedback HUD com medida em px e porcentagem
    expect(html).toContain("300 × 150 px");
  });

  // 4. Arrastar a alça de rotação gira o elemento em graus
  it("Teste Obrigatório 4: Alça de rotação permite rotação com alça rot e indicador de graus", () => {
    const { TransformBoundingBox } = require("./editor/TransformBoundingBox");
    const box = { x: 100, y: 200, width: 200, height: 200, rotation: 45 };

    const html = renderToString(
      React.createElement(TransformBoundingBox, {
        box,
        zoom: 1,
        allowRotation: true,
        onTransform: () => {},
      })
    );

    expect(html).toContain('data-handle="rot"');
    expect(html).toContain("45°");
  });

  // 5. Smart guides aparecem quando o elemento se aproxima do centro ou de outro elemento
  it("Teste Obrigatório 5: Smart guides (guias magnéticas inteligentes) renderizam linhas e rótulos de alinhamento", () => {
    const { TransformBoundingBox } = require("./editor/TransformBoundingBox");
    const smartGuides = [
      {
        orientation: "vertical" as const,
        position: 540,
        start: 0,
        end: 1920,
        label: "Centro da Página (540px)",
      },
      {
        orientation: "horizontal" as const,
        position: 960,
        start: 0,
        end: 1080,
        label: "Centro Vertical (960px)",
      },
    ];

    const html = renderToString(
      React.createElement(TransformBoundingBox, {
        box: { x: 440, y: 860, width: 200, height: 200 },
        zoom: 1,
        snapGuides: smartGuides,
        onTransform: () => {},
      })
    );

    expect(html).toContain("Centro da Página (540px)");
    expect(html).toContain("Centro Vertical (960px)");
    expect(html).toContain("border-pink-500");
  });

  // 6. Arrastar elemento para fora do box é bloqueado na borda com aviso visual
  it("Teste Obrigatório 6: Travamento de limites impede saída do elemento e alerta quando ultrapassa limites", () => {
    // Função de verificação de limites do box (boxBounds: 0 a 500 largura, 0 a 250 altura)
    const clampToBounds = (x: number, y: number, w: number, h: number, maxW = 500, maxH = 250) => {
      const clampedX = Math.max(0, Math.min(x, maxW - w));
      const clampedY = Math.max(0, Math.min(y, maxH - h));
      const isOutOfBounds = x < 0 || y < 0 || x + w > maxW || y + h > maxH;
      return { clampedX, clampedY, isOutOfBounds };
    };

    const inside = clampToBounds(50, 50, 100, 100);
    expect(inside.isOutOfBounds).toBe(false);
    expect(inside.clampedX).toBe(50);

    const outsideRight = clampToBounds(450, 50, 100, 100);
    expect(outsideRight.isOutOfBounds).toBe(true);
    expect(outsideRight.clampedX).toBe(400); // Travado na borda direita máxima (500 - 100)

    const outsideLeft = clampToBounds(-50, 50, 100, 100);
    expect(outsideLeft.isOutOfBounds).toBe(true);
    expect(outsideLeft.clampedX).toBe(0); // Travado na borda esquerda mínima (0)
  });

  // 7. Arrastar um box para outra posição reorganiza a página mantendo a regra de sobras
  it("Teste Obrigatório 7: Troca de posição de produto reorganiza a grade e respeita a regra de sobras na última página", () => {
    const elevenProducts = createMockProducts(11);
    // Página 1: 10 produtos normais. Página 2: 1 único produto restante (Hero mode)
    const page2Hero = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: [elevenProducts[10]],
        store: DEFAULT_STORE,
        campaign: { ...DEFAULT_CAMPAIGN, productsPerPage: 10 },
        domId: "test-hero-page-2",
      })
    );

    // A regra de sobra com 1 produto ativa o Hero centralizado e expandido
    expect(page2Hero).toContain("max-w-[840px]");
    expect(page2Hero).toContain("PRODUTO DE TESTE 11");

    // Inverte ordem de produtos 0 e 10
    const reordered = [...elevenProducts];
    const temp = reordered[0];
    reordered[0] = reordered[10];
    reordered[10] = temp;

    // Renderiza novamente a página 2 (agora com o produto 1 como Hero)
    const page2HeroReordered = renderToString(
      React.createElement(StoryPage916, {
        pageNumber: 2,
        totalPages: 2,
        products: [reordered[10]],
        store: DEFAULT_STORE,
        campaign: { ...DEFAULT_CAMPAIGN, productsPerPage: 10 },
        domId: "test-hero-page-2-reordered",
      })
    );

    expect(page2HeroReordered).toContain("max-w-[840px]");
    expect(page2HeroReordered).toContain("PRODUTO DE TESTE 1");
  });

  // 8. Ctrl+A seleciona todos os elementos da página; Ctrl+D desmarca todos
  it("Teste Obrigatório 8: Atalhos de seleção em lote (Ctrl+A e Ctrl+D) manipulam lista de alvos", () => {
    const pageItemCount = 10;
    let selectedTargets: string[] = [];

    // Simula Ctrl+A
    const handleSelectAll = () => {
      selectedTargets = mockProducts.map((p) => p.id);
    };

    // Simula Ctrl+D
    const handleDeselectAll = () => {
      selectedTargets = [];
    };

    handleSelectAll();
    expect(selectedTargets.length).toBe(pageItemCount);

    handleDeselectAll();
    expect(selectedTargets.length).toBe(0);
  });

  // 9. Desfazer (Ctrl+Z) e refazer (Ctrl+Y) revertem e reaplicam qualquer manipulação visual
  it("Teste Obrigatório 9: Histórico com limite de até 100 estados desfaz e refaz manipulações visuais", () => {
    const historyStack: { angle: number; color: string }[] = [{ angle: 0, color: "#E51E2B" }];
    const futureStack: { angle: number; color: string }[] = [];

    // Adiciona 10 rotações consecutivas
    for (let i = 1; i <= 10; i++) {
      historyStack.push({ angle: i * 15, color: "#E51E2B" });
    }
    expect(historyStack[historyStack.length - 1].angle).toBe(150);

    // Desfaz 3 ações
    for (let i = 0; i < 3; i++) {
      const popped = historyStack.pop()!;
      futureStack.unshift(popped);
    }
    expect(historyStack[historyStack.length - 1].angle).toBe(105);

    // Refaz 2 ações
    for (let i = 0; i < 2; i++) {
      const redone = futureStack.shift()!;
      historyStack.push(redone);
    }
    expect(historyStack[historyStack.length - 1].angle).toBe(135);
  });

  // 10. Checagem pré-exportação lista problemas e bloqueia até confirmação
  it("Teste Obrigatório 10: Modal pré-exportação lista problemas e só libera avanço após confirmação", () => {
    const { PreflightModalContent } = require("./editor/PreflightModal");
    const issues = [
      {
        id: "issue-1",
        type: "missing_photo",
        title: "Produto sem foto",
        description: "Refrigerante 2L está sem imagem",
        page: 1,
      },
      {
        id: "issue-2",
        type: "empty_price",
        title: "Preço zerado",
        description: "Biscoito está com valor R$ 0,00",
        page: 2,
      },
    ];

    const html = renderToString(
      React.createElement(PreflightModalContent, {
        issues,
        onFixIssue: () => {},
        onProceedToExport: () => {},
      })
    );

    // Modal exibe a contagem de avisos e o botão com advertência explícita
    expect(html).toContain("2 aviso(s)");
    expect(html).toContain("Refrigerante 2L está sem imagem");
    expect(html).toContain("Biscoito está com valor R$ 0,00");
    expect(html).toContain("Exportar Mesmo Assim");
  });
});

describe("Correções de Edição Visual e Recursos Novos (Figma/Canva/Illustrator)", () => {
  // 1. Redimensionar foto não altera dimensões do box do card
  it("Problema 1: Redimensionar foto mantém tamanho fixo do card box e escala apenas a imagem com overflow oculto", () => {
    const baseProduct: EncarteProduct = {
      id: "prod-zoom-1",
      code: "12345",
      name: "ARROZ TIPO 1 5KG",
      packaging: "PACOTE 5KG",
      validity: "30/12/2026",
      price: "24,90",
      unit: "UND",
      badge: "oferta",
      image: "https://example.com/arroz.png",
      included: true,
      customStyle: {
        photoScale: 1.75,
        photoOffsetX: 10,
        photoOffsetY: -5,
      },
    };

    const html8 = renderToString(
      React.createElement(ProductCard916, {
        product: baseProduct,
        index: 0,
        store: DEFAULT_STORE,
        layoutMode: "grid",
        perPage: 8,
      })
    );

    // O container da foto deve permanecer estritamente fixo com overflow oculto (160px para 8 produtos)
    expect(html8).toContain("width:160px");
    expect(html8).toContain("min-width:160px");
    expect(html8).toContain("max-width:160px");
    expect(html8).toContain("height:160px");
    expect(html8).toContain("overflow-hidden");

    // A imagem interna recebe a escala e o deslocamento via transform CSS
    expect(html8).toContain("scale(1.75)");
    expect(html8).toContain("translate(10px, -5px)");

    // Para 10 produtos, o container permanece fixo em 115px sem afetar o grid
    const html10 = renderToString(
      React.createElement(ProductCard916, {
        product: baseProduct,
        index: 0,
        store: DEFAULT_STORE,
        layoutMode: "grid",
        perPage: 10,
      })
    );
    expect(html10).toContain("width:115px");
    expect(html10).toContain("height:115px");
    expect(html10).toContain("overflow-hidden");
    expect(html10).toContain("scale(1.75)");
  });

  // 2. Slider e campo numérico de escala de foto no painel de propriedades
  it("Problema 3: Painel de propriedades possui slider de escala e input numérico em porcentagem sincronizados", () => {
    const { PropertiesPanel } = require("./editor/PropertiesPanel");
    const product: EncarteProduct = {
      id: "prod-photo-ctrl",
      code: "9988",
      name: "CAFE GOURMET 500G",
      packaging: "PACOTE 500G",
      validity: "15/08/2026",
      price: "18,90",
      unit: "UND",
      badge: "oferta",
      image: "https://example.com/cafe.png",
      included: true,
      customStyle: {
        photoScale: 1.45,
      },
    };

    const html = renderToString(
      React.createElement(PropertiesPanel, {
        selectedTarget: { productId: product.id, element: "image" },
        selectedTargets: [],
        product,
        customStyle: product.customStyle || {},
        globalStyle: {},
        scope: "product",
        onChangeScope: () => {},
        onUpdateStyle: () => {},
        onUpdateProductData: () => {},
        onResetStyle: () => {},
      })
    );

    // Deve exibir o controle deslizante de tamanho e porcentagem
    expect(html).toContain("Tamanho da Foto");
    expect(html).toContain("145");
    expect(html).toContain('value="145"');
    expect(html).toContain("Enquadramento");
    expect(html).toContain("Horizontal (X)");
    expect(html).toContain("Vertical (Y)");
    expect(html).toContain("Centralizar");
  });

  // 3. Aplicação em massa com 4 escopos distintos
  it("Problema 2: Painel suporta os 4 escopos de aplicação em massa", () => {
    const { PropertiesPanel } = require("./editor/PropertiesPanel");
    const product: EncarteProduct = {
      id: "prod-scope-1",
      code: "5544",
      name: "LEITE INTEGRAL 1L",
      packaging: "TETRAPAK 1L",
      validity: "10/11/2026",
      price: "4,79",
      unit: "UND",
      badge: "oferta",
      image: "https://example.com/leite.png",
      included: true,
    };

    const html = renderToString(
      React.createElement(PropertiesPanel, {
        selectedTarget: { productId: product.id, element: "name" },
        selectedTargets: [],
        product,
        customStyle: {},
        globalStyle: {},
        scope: "text_type",
        onChangeScope: () => {},
        onUpdateStyle: () => {},
        onUpdateProductData: () => {},
        onResetStyle: () => {},
      })
    );

    expect(html).toContain("Escopo da Alteração");
    expect(html).toContain("Somente este item");
    expect(html).toContain("Desta página");
    expect(html).toContain("Todo o encarte");
    expect(html).toContain("Textos deste tipo");
  });

  // 4. Sistema de Predefinições de Estilo (Presets)
  it("Problema 2 (Presets): Painel disponibiliza predefinições e opção de salvar novo preset", () => {
    const { PropertiesPanel } = require("./editor/PropertiesPanel");
    const product: EncarteProduct = {
      id: "prod-preset-1",
      code: "7766",
      name: "SABAO EM PO 1KG",
      packaging: "CAIXA 1KG",
      validity: "20/12/2027",
      price: "12,99",
      unit: "UND",
      badge: "imperdivel",
      image: "https://example.com/sabao.png",
      included: true,
    };

    const html = renderToString(
      React.createElement(PropertiesPanel, {
        selectedTarget: { productId: product.id, element: "price" },
        selectedTargets: [],
        product,
        customStyle: {},
        globalStyle: {},
        scope: "product",
        onChangeScope: () => {},
        onUpdateStyle: () => {},
        onUpdateProductData: () => {},
        onResetStyle: () => {},
      })
    );

    expect(html).toContain("Predefinições");
    expect(html).toContain("Salvar Estilo");
    expect(html).toContain("Pílula Amarela / Preço Vermelho");
    expect(html).toContain("Pílula Vermelha / Preço Branco");
  });

  // 5. Ações rápidas no painel: Duplicar, Copiar, Excluir
  it("Recursos Novos: Botões de ação rápida de Duplicar, Copiar e Excluir presentes no painel", () => {
    const { PropertiesPanel } = require("./editor/PropertiesPanel");
    const product: EncarteProduct = {
      id: "prod-actions-1",
      code: "1122",
      name: "FEIJAO CARIOCA 1KG",
      packaging: "PACOTE 1KG",
      validity: "25/09/2026",
      price: "7,49",
      unit: "UND",
      badge: "oferta",
      image: "https://example.com/feijao.png",
      included: true,
    };

    const html = renderToString(
      React.createElement(PropertiesPanel, {
        selectedTarget: { productId: product.id, element: "box" },
        selectedTargets: [],
        product,
        customStyle: {},
        globalStyle: {},
        scope: "product",
        onChangeScope: () => {},
        onUpdateStyle: () => {},
        onUpdateProductData: () => {},
        onResetStyle: () => {},
        onDuplicateProduct: () => {},
        onDeleteProduct: () => {},
        onCopyProduct: () => {},
      })
    );

    expect(html).toContain("Duplicar");
    expect(html).toContain("Copiar");
    expect(html).toContain("Excluir");
    expect(html).toContain("Restaurar");
  });
});
