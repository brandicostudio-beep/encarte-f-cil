import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Dialog } from "@/components/ui/dialog";
import { PdfStockModal, PdfStockContent } from "./PdfStockModal";
import type { EncarteProduct } from "@/types/encarte";

describe("PdfStockModal - Atualização automática de estoque por relatório PDF", () => {
  const mockProducts: EncarteProduct[] = [
    {
      id: "prod-1",
      code: "22292",
      name: "BATATA PALHA BELLA PALHA",
      packaging: "UNIDADE 1X80 GR",
      validity: "20/11/2026",
      price: "",
      unit: "UND",
      stock: "",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "prod-2",
      code: "26032",
      name: "SALGADINHO BATATA SALT VINEGAR LAYS",
      packaging: "UNIDADE 1X62 GR",
      validity: "23/11/2026",
      price: "0,00",
      unit: "UND",
      stock: "",
      badge: "nenhum",
      image: "",
      included: true,
    },
  ];

  it("Renderiza PdfStockContent com zona de upload e regras", () => {
    const html = renderToString(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(PdfStockContent, {
          products: mockProducts,
          onApplyStock: vi.fn(),
          onClose: vi.fn(),
        })
      )
    );

    expect(html).toContain("Atualizar Estoque por Relatório PDF");
    expect(html).toContain("Clique para selecionar o relatório PDF");
    expect(html).toContain("Preencher Estoque Automaticamente");
  });

  it("Renderiza PdfStockModal com open=false e open=true sem quebrar", () => {
    expect(() => {
      renderToString(
        React.createElement(PdfStockModal, {
          open: false,
          onOpenChange: vi.fn(),
          products: mockProducts,
          onApplyStock: vi.fn(),
        })
      );
    }).not.toThrow();

    expect(() => {
      renderToString(
        React.createElement(PdfStockModal, {
          open: true,
          onOpenChange: vi.fn(),
          products: mockProducts,
          onApplyStock: vi.fn(),
        })
      );
    }).not.toThrow();
  });
});
