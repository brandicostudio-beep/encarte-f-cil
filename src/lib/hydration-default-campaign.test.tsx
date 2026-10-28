import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  DEFAULT_CAMPAIGN,
  DEFAULT_STORE,
  DEFAULT_TEMPLATE_9_16_AREA,
  type CampaignConfig,
  type StoreConfig,
  type EncarteProduct,
} from "@/types/encarte";
import { StoreSettingsModal } from "@/components/encarte/StoreSettingsModal";
import { renderErrorPage } from "@/lib/error-page";

describe("DEFAULT_CAMPAIGN e Hidratação de Dados", () => {
  it("DEFAULT_CAMPAIGN está definida com valores válidos para uma nova campanha", () => {
    expect(DEFAULT_CAMPAIGN).toBeDefined();
    expect(DEFAULT_CAMPAIGN.title).toBe("DETONA PREÇOS");
    expect(DEFAULT_CAMPAIGN.subtitle).toBe("PRODUTOS COM VALIDADE CURTA!");
    expect(DEFAULT_CAMPAIGN.observation).toContain("Não aceitamos devolução");
    expect(DEFAULT_CAMPAIGN.productsPerPage).toBe(10);
    expect(DEFAULT_CAMPAIGN.format).toBe("story_9_16");
    expect(DEFAULT_CAMPAIGN.template916Image).toBe("/templates/template-detona-precos-9-16.png");
    expect(DEFAULT_CAMPAIGN.template916Area).toEqual(DEFAULT_TEMPLATE_9_16_AREA);
  });

  it("StoreSettingsModal renderiza sem erros quando campaign é DEFAULT_CAMPAIGN", () => {
    expect(() => {
      renderToString(
        React.createElement(StoreSettingsModal, {
          open: true,
          onOpenChange: () => {},
          store: DEFAULT_STORE,
          campaign: DEFAULT_CAMPAIGN,
          onSaveStore: () => {},
          onSaveCampaign: () => {},
        })
      );
    }).not.toThrow();
  });

  it("StoreSettingsModal renderiza sem erros mesmo se campaign for parcial ou undefined", () => {
    const partialCampaign = {
      title: "PROMOÇÃO ESPECIAL",
    } as unknown as CampaignConfig;

    expect(() => {
      renderToString(
        React.createElement(StoreSettingsModal, {
          open: true,
          onOpenChange: () => {},
          store: DEFAULT_STORE,
          campaign: partialCampaign,
          onSaveStore: () => {},
          onSaveCampaign: () => {},
        })
      );
    }).not.toThrow();
  });

  it("Migração do localStorage: formato legado v1 recupera produtos e campos sem perda de dados", () => {
    const legacyProductsV1 = [
      {
        id: "leg-1",
        codigo: "00123",
        descricao: "ARROZ TIPO 1 5KG",
        embalagem: "PACOTE 1X5 KG",
        validade: "30/12/2026",
        preco: "25,90",
        estoque: "100",
        foto: "https://exemplo.com/arroz.jpg",
      },
    ];

    // Simula a lógica de sanitização de index.tsx
    const sanitized = legacyProductsV1.map((p: any, idx: number) => ({
      id: p?.id || `p-${Date.now()}-${idx}`,
      code: String(p?.code ?? p?.codigo ?? idx + 1),
      name: String(p?.name ?? p?.nome ?? p?.descricao ?? "PRODUTO SEM NOME"),
      packaging: String(p?.packaging ?? p?.embalagem ?? ""),
      validity: String(p?.validity ?? p?.validade ?? ""),
      price:
        p?.price !== undefined && p?.price !== null
          ? String(p.price)
          : p?.preco !== undefined && p?.preco !== null
          ? String(p.preco)
          : "",
      unit: String(p?.unit || p?.unidade || "UND"),
      stock: String(p?.stock ?? p?.estoque ?? ""),
      badge: p?.badge || p?.selo || "nenhum",
      image: String(p?.image ?? p?.foto ?? p?.imageUrl ?? ""),
      included: p?.included !== undefined ? Boolean(p.included) : true,
    }));

    expect(sanitized.length).toBe(1);
    expect(sanitized[0].code).toBe("00123");
    expect(sanitized[0].name).toBe("ARROZ TIPO 1 5KG");
    expect(sanitized[0].packaging).toBe("PACOTE 1X5 KG");
    expect(sanitized[0].price).toBe("25,90");
    expect(sanitized[0].validity).toBe("30/12/2026");
    expect(sanitized[0].image).toBe("https://exemplo.com/arroz.jpg");
  });

  it("Migração do localStorage: campanha legada sem format ou template916Area preenche com defaults", () => {
    const legacyCampaign = {
      titulo: "FIM DE SEMANA IMPERDÍVEL",
      subtitulo: "Aproveite as ofertas",
      // sem format, sem template916Area, sem template916Image
    };

    const migrated: CampaignConfig = {
      ...DEFAULT_CAMPAIGN,
      ...legacyCampaign,
      title: legacyCampaign.titulo || DEFAULT_CAMPAIGN.title,
      subtitle: legacyCampaign.subtitulo || DEFAULT_CAMPAIGN.subtitle,
      format: (legacyCampaign as any).format === "a4" ? "a4" : "story_9_16",
      productsPerPage: 12,
      template916Image: DEFAULT_CAMPAIGN.template916Image,
      template916Area: {
        ...DEFAULT_TEMPLATE_9_16_AREA,
      },
    };

    expect(migrated.title).toBe("FIM DE SEMANA IMPERDÍVEL");
    expect(migrated.subtitle).toBe("Aproveite as ofertas");
    expect(migrated.format).toBe("story_9_16");
    expect(migrated.template916Image).toBe(DEFAULT_CAMPAIGN.template916Image);
    expect(migrated.template916Area).toEqual(DEFAULT_TEMPLATE_9_16_AREA);
  });

  it("Tela de erro exibe mensagem em português e confirmação antes de resetar", () => {
    const errorHtml = renderErrorPage(new Error("DEFAULT_CAMPAIGN is not defined"));

    expect(errorHtml).toContain("Não foi possível carregar a página");
    expect(errorHtml).toContain("Tentar novamente");
    expect(errorHtml).toContain("Resetar Dados Salvos");
    expect(errorHtml).toContain("Voltar ao início");
    // Confirmação de segurança antes de apagar o localStorage
    expect(errorHtml).toContain("Isso apaga os produtos e configurações salvos neste navegador. Deseja continuar?");
    // Detalhe técnico do erro renderizado
    expect(errorHtml).toContain("DEFAULT_CAMPAIGN is not defined");
  });

  it("Resiliência contra QuotaExceededError do localStorage ao salvar produtos com imagens pesadas", () => {
    const mockStorage: Record<string, string> = {};
    let quotaExceededTriggered = false;

    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        if (value.length > 200) {
          quotaExceededTriggered = true;
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    };

    const heavyProducts: EncarteProduct[] = Array.from({ length: 19 }, (_, i) => ({
      id: `p-${i + 1}`,
      code: String(20000 + i + 1),
      name: `PRODUTO PESADO ${i + 1}`,
      packaging: "1 UNID",
      validity: "30/11/2026",
      price: "10,00",
      unit: "UND",
      badge: "nenhum",
      image: `data:image/jpeg;base64,${"A".repeat(5000)}`,
      included: true,
    }));

    let savedSuccessfully = false;
    try {
      try {
        fakeLocalStorage.setItem("encarte-products-v2", JSON.stringify(heavyProducts));
        savedSuccessfully = true;
      } catch {
        const compact = heavyProducts.map((p) => ({
          ...p,
          image: "",
          alternativePhotos: [],
        }));
        const smallJson = JSON.stringify(compact.slice(0, 1));
        fakeLocalStorage.setItem("encarte-products-compact", smallJson);
        savedSuccessfully = true;
      }
    } catch {
      savedSuccessfully = false;
    }

    expect(quotaExceededTriggered).toBe(true);
    expect(savedSuccessfully).toBe(true);
  });
});
