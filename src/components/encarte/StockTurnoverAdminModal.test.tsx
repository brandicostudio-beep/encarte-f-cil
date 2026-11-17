import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Dialog } from "@/components/ui/dialog";
import type { EncarteProduct } from "@/types/encarte";
import {
  StockTurnoverAdminModal,
  StockTurnoverAdminContent,
} from "./StockTurnoverAdminModal";

describe("StockTurnoverAdminModal - Área Administrativa de Giro e Validade", () => {
  const sampleProducts: EncarteProduct[] = [
    {
      id: "p1",
      code: "1001",
      name: "LEITE INTEGRAL 1L",
      packaging: "CAIXA 1X12 UNID",
      validity: "22/11/2026", // Faltam 5 dias
      price: "5,00",
      unit: "UND",
      stock: "50 UND",
      badge: "nenhum",
      image: "https://example.com/leite.jpg",
      included: true,
      registeredAt: "2026-11-12T10:00:00.000Z",
      initialStockQuantity: 50,
      currentStockQuantity: 50, // 0 vendas em 5 dias!
    },
    {
      id: "p2",
      code: "1002",
      name: "BISCOITO RECHEADO 130G",
      packaging: "PACOTE 1X130 GR",
      validity: "20/12/2026", // Longa
      price: "3,00",
      unit: "UND",
      stock: "92 UND",
      badge: "nenhum",
      image: "https://example.com/biscoito.jpg",
      included: true,
      registeredAt: "2026-11-12T10:00:00.000Z",
      initialStockQuantity: 100,
      currentStockQuantity: 92, // Vendeu 8 un = 8% em 5 dias (baixo giro <= 10%)
    },
    {
      id: "p3",
      code: "1003",
      name: "SABONETE 90G",
      packaging: "UNIDADE 1X90 GR",
      validity: "30/12/2026",
      price: "2,50",
      unit: "UND",
      stock: "30 UND",
      badge: "nenhum",
      image: "https://example.com/sabonete.jpg",
      included: true,
      registeredAt: "2026-11-12T10:00:00.000Z",
      initialStockQuantity: 100,
      currentStockQuantity: 30, // Vendeu 70% (bom giro)
    },
  ];

  it("Renderiza StockTurnoverAdminModal com open=false e open=true sem quebrar", () => {
    expect(() => {
      renderToString(
        React.createElement(StockTurnoverAdminModal, {
          open: false,
          onOpenChange: vi.fn(),
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
        })
      );
    }).not.toThrow();

    expect(() => {
      renderToString(
        React.createElement(StockTurnoverAdminModal, {
          open: true,
          onOpenChange: vi.fn(),
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
        })
      );
    }).not.toThrow();
  });

  it("Renderiza StockTurnoverAdminContent com os KPIs executivos", () => {
    const html = renderToString(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(StockTurnoverAdminContent, {
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
          onClose: vi.fn(),
        })
      )
    );

    // Cards de KPIs mantidos
    expect(html).toContain("Vence em ≤ 5 dias");
    expect(html).toContain("0 Vendas (5d+)");
    expect(html).toContain("Giro Baixo (≤10%)");

    // Confirma remoção de Capital em Risco, Preço & Risco e Ações de Queima solicitada pelo usuário
    expect(html).not.toContain("Capital em Risco");
    expect(html).not.toContain("PREÇO &amp; RISCO");
    expect(html).not.toContain("Preço &amp; Risco");
    expect(html).not.toContain("Ações de Queima");
    expect(html).not.toContain("-20%");
    expect(html).not.toContain("-30%");

    // Botões de Ações e Filtros mantidos
    expect(html).toContain("Exportar Excel/CSV");
  });

  it("Exibe o diagnóstico específico de produto parado há 5 dias", () => {
    const html = renderToString(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(StockTurnoverAdminContent, {
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
          onClose: vi.fn(),
        })
      )
    );

    // Texto solicitado:
    expect(html).toContain("Esse produto não vendeu nada nos últimos 5 dias");
  });

  it("Exibe o diagnóstico de giro crítico de até 10%", () => {
    const html = renderToString(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(StockTurnoverAdminContent, {
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
          onClose: vi.fn(),
        })
      )
    );

    expect(html).toContain("Giro Crítico: apenas 8% do estoque vendido em 5 dias");
  });

  it("Garante que a indicação de visualização interna exclusiva esteja explícita", () => {
    const html = renderToString(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(StockTurnoverAdminContent, {
          products: sampleProducts,
          onUpdateProduct: vi.fn(),
          onClose: vi.fn(),
        })
      )
    );

    expect(html).toContain("Área Administrativa Interna");
    expect(html).toContain("NUNCA saem no encarte público dos clientes");
  });
});
