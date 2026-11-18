import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import { EncarteSemanalWorkspace } from "./EncarteSemanalWorkspace";
import { clearEncarteSemanalStorage } from "@/lib/encarte-semanal-storage";

describe("EncarteSemanalWorkspace: Navegação e Desbloqueio de Abas", () => {
  it("renderiza os botões de navegação para sair do Encarte Semanal (Voltar e Menu)", () => {
    clearEncarteSemanalStorage();
    const html = renderToString(<EncarteSemanalWorkspace />);

    // 1. Botão Voltar aos Encartes com data-testid
    expect(html).toContain('data-testid="btn-back-to-encartes"');
    expect(html).toContain("Voltar ao Menu Principal");
    expect(html).toContain("Encartes");

    // 2. Botão Menu Drawer lateral com data-testid
    expect(html).toContain('data-testid="btn-semanal-menu-drawer"');

    // 3. Segmented control com os fluxos do sistema (Encartes, Semanal, Validade, Coleções)
    expect(html).toContain("Validade");
    expect(html).toContain("Coleções");
    expect(html).toContain("Semanal");
  });

  it("renderiza a aba de preview com o modelo de fundo e 20 boxes interativos estilo Canva/Figma mesmo sem produtos", () => {
    clearEncarteSemanalStorage();
    const html = renderToString(<EncarteSemanalWorkspace />);

    // Deve conter a barra de zoom e navegação
    expect(html).toContain("Visualizar Encarte");
    expect(html).toContain("Lista de Produtos");
    expect(html).toContain("Pendências / Sem Foto");

    // Deve conter o banner explicativo de edição direta estilo Canva/Figma
    expect(html).toContain("Edição Direta na Arte (Estilo Canva/Figma)");
    expect(html).toContain("Clique em qualquer box");

    // E deve renderizar os boxes vazios com os botões de digitar código na arte
    expect(html).toContain('data-testid="semanal-cell-empty"');
    expect(html).toContain("+ DIGITAR CÓDIGO");
    expect(html).toContain("Clique p/ Digitar Código");

    // E deve renderizar o canvas com o modelo de fundo e o rodapé
    expect(html).toContain('alt="Modelo Encarte Semanal"');
    expect(html).toContain('data-testid="semanal-rendered-footer"');
    // Não deve conter a máscara artificial #330409 que descoloria o primeiro quadro
    expect(html).not.toContain('backgroundColor: "#330409"');
    expect(html).not.toContain('background-color:#330409');
    expect(html).toContain('Clique para editar o rodapé');
  });

  it("renderiza célula do Encarte Semanal com barra bege em zIndex 20 na frente da foto", async () => {
    const { EncarteSemanalCell } = await import("./EncarteSemanalCell");
    const { DEFAULT_ENCARTE_SEMANAL_GRID } = await import("@/types/encarte-semanal");
    const { calculateEncarteSemanalGridCells } = await import("@/lib/encarte-semanal-layout");

    const cells = calculateEncarteSemanalGridCells(DEFAULT_ENCARTE_SEMANAL_GRID);
    const mockProduct = {
      id: "prod-1",
      code: "2110",
      description: "ALVEJANTE Q BOA FLORAL - 12X1 LT",
      image: "https://example.com/qboa.png",
    };

    const html = renderToString(
      <EncarteSemanalCell
        product={mockProduct}
        cell={cells[0]}
        interactive={true}
        isSelected={false}
      />
    );

    // Barra bege deve estar com zIndex: 20
    expect(html).toContain("z-index:20");
    expect(html).toContain("2110");
    expect(html).toContain("ALVEJANTE Q BOA FLORAL - 12X1 LT");
  });

  it("busca produtos com predição de texto por código ou descrição", async () => {
    const { searchProductSuggestions, lookupProductByCode } = await import(
      "@/lib/encarte-semanal-catalog"
    );

    // 1. Busca por código "19" deve sugerir 19396 (Ameixa Predilecta) e 19124 (Batata Palha Yoki)
    const suggestions19 = searchProductSuggestions("19");
    expect(suggestions19.some((s) => s.code === "19396")).toBe(true);
    expect(suggestions19.some((s) => s.code === "19124")).toBe(true);

    // 2. Busca por palavra-chave da descrição (ex: "predilecta")
    const suggestionsPredilecta = searchProductSuggestions("predilecta");
    expect(suggestionsPredilecta.length).toBeGreaterThan(0);
    expect(suggestionsPredilecta.some((s) => s.description.includes("PREDILECTA"))).toBe(true);

    // 3. lookupProductByCode com código 19396
    const lookedUp = lookupProductByCode("19396");
    expect(lookedUp.code).toBe("19396");
    expect(lookedUp.description).toContain("AMEIXA");
  });
});
