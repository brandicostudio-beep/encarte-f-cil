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
    expect(html).toContain("Encartes");

    // 2. Botão Menu Drawer lateral com data-testid
    expect(html).toContain('data-testid="btn-semanal-menu-drawer"');

    // 3. Segmented control com os fluxos do sistema (Encartes, Semanal, Validade, Coleções)
    expect(html).toContain("Validade");
    expect(html).toContain("Coleções");
    expect(html).toContain("Semanal");
  });

  it("renderiza a aba de preview com o modelo de fundo mesmo sem produtos, sem travar o usuário", () => {
    clearEncarteSemanalStorage();
    const html = renderToString(<EncarteSemanalWorkspace />);

    // Deve conter a barra de zoom e navegação
    expect(html).toContain("Visualizar Encarte");
    expect(html).toContain("Lista de Produtos");
    expect(html).toContain("Pendências / Sem Foto");

    // Deve conter o banner explicativo não-bloqueante
    expect(html).toContain("Nenhum produto carregado na grade");
    expect(html).toContain("Carregar Planilha &amp; Fotos");

    // E deve renderizar o canvas com o modelo de fundo
    expect(html).toContain('alt="Modelo Encarte Semanal"');
    expect(html).toContain("data-testid=\"semanal-rendered-footer\"");
  });
});
