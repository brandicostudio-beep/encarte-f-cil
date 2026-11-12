import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReviewTable } from "./ReviewTable";
import type { EncarteProduct } from "@/types/encarte";

describe("ReviewTable - Edição rápida de estoque e preço", () => {
  const mockProducts: EncarteProduct[] = [
    {
      id: "prod-1",
      code: "22292",
      name: "BATATA PALHA BELLA PALHA",
      packaging: "UNIDADE 1X80 GR",
      validity: "20/11/2026",
      price: "",
      unit: "UND",
      stock: "50 UND",
      badge: "nenhum",
      image: "https://example.com/batata.jpg",
      included: true,
    },
    {
      id: "prod-2",
      code: "26032",
      name: "SALGADINHO BATATA SALT VINEGAR LAYS",
      packaging: "UNIDADE 1X62 GR",
      validity: "23/11/2026",
      price: "4,90",
      unit: "UND",
      stock: "",
      badge: "nenhum",
      image: "https://example.com/lays.jpg",
      included: true,
    },
  ];

  it("Renderiza ReviewTable com colunas Embalagem e Estoque separadas", () => {
    const html = renderToString(
      React.createElement(ReviewTable, {
        products: mockProducts,
        onPriceChange: vi.fn(),
        onStockChange: vi.fn(),
        onUnitChange: vi.fn(),
        onToggleIncluded: vi.fn(),
        onEditProduct: vi.fn(),
        onDeleteProduct: vi.fn(),
      })
    );

    // Cabeçalhos
    expect(html).toContain("Embalagem");
    expect(html).toContain("Estoque");
    expect(html).toContain("Preço de Venda (R$)");

    // Conteúdo da embalagem e inputs
    expect(html).toContain("UNIDADE 1X80 GR");
    expect(html).toContain("UNIDADE 1X62 GR");
    expect(html).toContain('id="stock-prod-1"');
    expect(html).toContain('id="stock-prod-2"');
    expect(html).toContain('value="50 UND"');
    expect(html).toContain('placeholder="Ex: 50"');
  });

  it("Renderiza input de preço e unidade", () => {
    const html = renderToString(
      React.createElement(ReviewTable, {
        products: mockProducts,
        onPriceChange: vi.fn(),
        onStockChange: vi.fn(),
        onToggleIncluded: vi.fn(),
        onEditProduct: vi.fn(),
        onDeleteProduct: vi.fn(),
      })
    );

    expect(html).toContain('id="price-prod-1"');
    expect(html).toContain('id="price-prod-2"');
    expect(html).toContain('value="4,90"');
  });
});
