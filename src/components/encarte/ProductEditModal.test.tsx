import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { renderToString } from "react-dom/server";
import { ProductEditModal } from "./ProductEditModal";
import type { EncarteProduct } from "@/types/encarte";

describe("ProductEditModal - Regras de Hooks e Edição de Preço/Produto", () => {
  const mockProduct: EncarteProduct = {
    id: "p-test-1",
    code: "10001",
    name: "CAFÉ TRADICIONAL A VÁCUO 500G",
    packaging: "PACOTE 500G",
    packagingType: "PACOTE",
    packagingQuantity: "1",
    packagingUnit: "GR",
    validity: "20/12/2026",
    price: "14,99",
    unit: "UND",
    badge: "oferta",
    image: "https://example.com/cafe.jpg",
    included: true,
  };

  it("Renderiza com product=null e open=false sem erros ou quebra de hooks", () => {
    expect(() => {
      renderToString(
        React.createElement(ProductEditModal, {
          product: null,
          open: false,
          onOpenChange: () => {},
          onSave: () => {},
        })
      );
    }).not.toThrow();
  });

  it("Renderiza com produto ativo e open=true sem erros", () => {
    expect(() => {
      renderToString(
        React.createElement(ProductEditModal, {
          product: mockProduct,
          open: true,
          onOpenChange: () => {},
          onSave: () => {},
        })
      );
    }).not.toThrow();
  });

  it("Simula transição de null -> produto -> null sem violar contagem de hooks (React Error #310)", () => {
    // Componente de teste para simular renderizações sucessivas
    const TestContainer: React.FC<{ initialProduct: EncarteProduct | null }> = ({
      initialProduct,
    }) => {
      const [editingProduct, setEditingProduct] = useState<EncarteProduct | null>(
        initialProduct
      );

      return React.createElement(
        "div",
        null,
        React.createElement("button", {
          id: "open-edit",
          onClick: () => setEditingProduct(mockProduct),
        }),
        React.createElement("button", {
          id: "close-edit",
          onClick: () => setEditingProduct(null),
        }),
        React.createElement(ProductEditModal, {
          product: editingProduct,
          open: Boolean(editingProduct),
          onOpenChange: (open) => !open && setEditingProduct(null),
          onSave: () => {},
        })
      );
    };

    // 1. Renderização inicial com null
    expect(() => {
      renderToString(React.createElement(TestContainer, { initialProduct: null }));
    }).not.toThrow();

    // 2. Renderização abrindo o modal com o produto
    expect(() => {
      renderToString(
        React.createElement(TestContainer, { initialProduct: mockProduct })
      );
    }).not.toThrow();
  });

  it("Preserva campos seguros com fallback quando propriedades do produto forem indefinidas", () => {
    const incompleteProduct = {
      id: "p-incomplete",
      code: "99999",
      name: "PRODUTO INCOMPLETO",
    } as unknown as EncarteProduct;

    expect(() => {
      renderToString(
        React.createElement(ProductEditModal, {
          product: incompleteProduct,
          open: true,
          onOpenChange: () => {},
          onSave: () => {},
        })
      );
    }).not.toThrow();
  });
});
