import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  DEFAULT_CAMPAIGN,
  DEFAULT_STORE,
  DEFAULT_TEMPLATE_9_16_AREA,
  type EncarteProduct,
} from "@/types/encarte";
import { ProductCard916 } from "@/components/encarte/ProductCard916";
import { ProductCardA4 } from "@/components/encarte/ProductCardA4";
import { sortProductsByValidityAsc, isDateExpired } from "./encarte-helpers";
import fs from "fs";
import path from "path";

describe("Testes de Regressão Obrigatórios - Encarte de Validade", () => {
  const mockValidityProduct: EncarteProduct = {
    id: "val-1",
    code: "23396",
    name: "FRALDA PERSONAL PREMIUM MEGA XXG",
    packaging: "1X24 UNID",
    validity: "26/11/2026",
    price: "22,47",
    unit: "UND",
    unitConfirmed: true,
    stock: "28 UND",
    badge: "oferta",
    image: "https://cescom.agilecdn.com.br/23396_thumb_1.jpg",
    included: true,
  };

  it("1. Configurações padrão do Encarte de Validade permanecem rigorosamente inalteradas", () => {
    expect(DEFAULT_CAMPAIGN.title).toBe("DETONA PREÇOS");
    expect(DEFAULT_CAMPAIGN.subtitle).toBe("PRODUTOS COM VALIDADE CURTA!");
    expect(DEFAULT_CAMPAIGN.observation).toBe("Não aceitamos devolução. Prazo 07 dias.");
    expect(DEFAULT_CAMPAIGN.productsPerPage).toBe(10);
    expect(DEFAULT_CAMPAIGN.format).toBe("story_9_16");
    expect(DEFAULT_CAMPAIGN.template916Image).toBe("/templates/template-detona-precos-9-16.png");
    expect(DEFAULT_CAMPAIGN.template916Area).toEqual(DEFAULT_TEMPLATE_9_16_AREA);
    expect(DEFAULT_CAMPAIGN.template916Area.x).toBe(46);
    expect(DEFAULT_CAMPAIGN.template916Area.y).toBe(661);
    expect(DEFAULT_CAMPAIGN.template916Area.width).toBe(1012);
    expect(DEFAULT_CAMPAIGN.template916Area.height).toBe(1202);
  });

  it("2. Template Detona Preços 9:16 do encarte de validade existe e está preservado", () => {
    const templatePath = path.resolve("public/templates/template-detona-precos-9-16.png");
    expect(fs.existsSync(templatePath)).toBe(true);
    const stats = fs.statSync(templatePath);
    expect(stats.size).toBeGreaterThan(100_000);
  });

  it("3. ProductCard916 renderiza todos os elementos do encarte de validade (Preço, Validade, Estoque, Código, Selo)", () => {
    const html = renderToString(
      React.createElement(ProductCard916, {
        product: mockValidityProduct,
        store: DEFAULT_STORE,
      })
    );

    // Validação da integridade de exibição dos dados no card 9:16
    expect(html).toContain("23396"); // Código
    expect(html).toContain("FRALDA PERSONAL PREMIUM MEGA XXG"); // Descrição
    expect(html).toContain("22,47"); // Preço de venda
    expect(html).toContain("26/11/2026"); // Barra de validade
    expect(html).toContain("28 UND"); // Barra de estoque
    expect(html).toContain("UND"); // Unidade de medida
  });

  it("4. ProductCardA4 renderiza todos os elementos do encarte impresso A4", () => {
    const html = renderToString(
      React.createElement(ProductCardA4, {
        product: mockValidityProduct,
        store: DEFAULT_STORE,
        index: 0,
      })
    );

    expect(html).toContain("23396");
    expect(html).toContain("FRALDA PERSONAL PREMIUM MEGA XXG");
    expect(html).toContain("22");
    expect(html).toContain("47");
    expect(html).toContain("26/11/2026");
    expect(html).toContain("28 UND");
  });

  it("5. Regra de ordenação por validade crescente (mais próxima primeiro) continua ativa", () => {
    const prods: EncarteProduct[] = [
      { ...mockValidityProduct, id: "1", code: "1", validity: "25/12/2026" },
      { ...mockValidityProduct, id: "2", code: "2", validity: "04/11/2026" },
      { ...mockValidityProduct, id: "3", code: "3", validity: "18/11/2026" },
    ];

    const sorted = sortProductsByValidityAsc(prods);
    expect(sorted[0].code).toBe("2"); // 04/11/2026
    expect(sorted[1].code).toBe("3"); // 18/11/2026
    expect(sorted[2].code).toBe("1"); // 25/12/2026
  });

  it("6. Cálculo de data vencida continua preciso para avisos do encarte de validade", () => {
    expect(isDateExpired("01/01/2020")).toBe(true);
    expect(isDateExpired("01/01/2099")).toBe(false);
  });
});
