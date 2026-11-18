import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { WelcomeHubModal } from "./WelcomeHubModal";
import { NavigationDrawerContent } from "./NavigationDrawer";
import { ProjectTopBar } from "./projects/ProjectTopBar";

describe("UI/UX Redesign: WelcomeHubModal & NavigationDrawer (Estilo Apple)", () => {
  it("WelcomeHubModal: renderiza os dois fluxos centrais (Encartes e Validade Rotina 8230)", () => {
    const html = renderToString(
      <WelcomeHubModal
        open={true}
        onClose={() => {}}
        onSelectFlow={() => {}}
      />
    );

    // Título e identificação do sistema
    expect(html).toContain("Central Comercial &amp; Estoque");
    expect(html).toContain("Controle de Validade");
    expect(html).toContain("Marketing e Acompanhamento");
    expect(html).toContain("logo-cescom-trimmed.png");

    // Fluxo 1: Gerador de Encartes
    expect(html).toContain("Gerador de Encartes");
    expect(html).toContain("Criação &amp; Marketing");
    expect(html).toContain("Entrar no Gerador de Encartes");
    expect(html).toContain("Design em alta resolução no formato Story 9:16");

    // Fluxo 2: Painel de Validade & Giro
    expect(html).toContain("Painel de Validade &amp; Giro");
    expect(html).toContain("Rotina 8230 • Winthor");
    expect(html).toContain("Acessar Painel de Validade");
    expect(html).toContain("Sincronizado diretamente com a Rotina 8230");

    // Opção de não mostrar novamente
    expect(html).toContain("Não exibir esta tela automaticamente ao entrar");
  });

  it("WelcomeHubModal: não renderiza nada quando open=false", () => {
    const html = renderToString(
      <WelcomeHubModal
        open={false}
        onClose={() => {}}
        onSelectFlow={() => {}}
      />
    );
    expect(html).toBe("");
  });

  it("NavigationDrawerContent: renderiza lista categorizada estilo Apple com 3 pontos", () => {
    const html = renderToString(
      <NavigationDrawerContent
        onClose={() => {}}
        onOpenHowItWorks={() => {}}
        onOpenStoreSettings={() => {}}
        onOpenStockTurnover={() => {}}
        onOpenResetModal={() => {}}
        onOpenWelcomeHub={() => {}}
        onNavigateToValidade={() => {}}
        onLogout={() => {}}
        turnoverAlertCount={3}
      />
    );

    // Header do menu lateral Cescom
    expect(html).toContain("Controle de Validade");
    expect(html).toContain("Marketing e Acompanhamento");
    expect(html).toContain("logo-cescom-trimmed.png");
    expect(html).toContain("Cescom Distribuidor");

    // Seção de fluxos
    expect(html).toContain("Gerador de Encartes");
    expect(html).toContain("Painel de Validade");
    expect(html).toContain("Rotina 8230");
    expect(html).toContain("Tela de Boas-Vindas");

    // Seção de configurações e administração
    expect(html).toContain("Configurar Loja &amp; Cores");
    expect(html).toContain("Área Administrativa: Giro &amp; Validade");
    expect(html).toContain("3"); // Badge de alertas

    // Seção de ajuda
    expect(html).toContain("Como funciona");

    // Seção de ações rápidas
    expect(html).toContain("Novo Encarte (Zerar Dados)");

    // Seção de logout
    expect(html).toContain("Encerrar Sessão (Sair)");

    // Garante que Coleções Esquenta Black foi omitido conforme solicitado
    expect(html).not.toContain("Esquenta Black");
  });

  it("NavigationDrawerContent: exibe Meus Projetos e Histórico quando fornecidos", () => {
    const html = renderToString(
      <NavigationDrawerContent
        onClose={() => {}}
        onOpenHowItWorks={() => {}}
        onOpenStoreSettings={() => {}}
        onOpenStockTurnover={() => {}}
        onOpenResetModal={() => {}}
        onOpenWelcomeHub={() => {}}
        onNavigateToValidade={() => {}}
        onLogout={() => {}}
        onOpenProjects={() => {}}
        onOpenVersionHistory={() => {}}
      />
    );

    expect(html).toContain("Projetos &amp; Histórico");
    expect(html).toContain("Meus Projetos");
    expect(html).toContain("Histórico de Versões");
  });

  it("ProjectTopBar: elimina o botão duplicado de 3 pontos e exibe dropdown com ações do projeto e botão Versões", () => {
    const html = renderToString(
      <ProjectTopBar
        projectName="Encarte Ofertas da Semana"
        saveStatus="synced"
        statusNotice="Sincronizado no Google Drive"
        onSave={() => {}}
        onSaveAs={() => {}}
        onRename={() => {}}
        onOpenProjects={() => {}}
        onOpenVersionHistory={() => {}}
        onOpenUpdateCheck={() => {}}
        onNewProject={() => {}}
      />
    );

    // Contém Meus Projetos e Salvar
    expect(html).toContain("Meus Projetos");
    expect(html).toContain("Salvar");
    expect(html).toContain("Encarte Ofertas da Semana");
    expect(html).toContain("Versões");

    // NÃO contém MoreVertical (três pontos duplicados)
    expect(html).not.toContain("lucide-more-vertical");
    // Não contém texto A4
    expect(html).not.toContain("A4");
  });
});
