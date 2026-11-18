import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PainelValidadeWorkspace } from "./PainelValidadeWorkspace";
import { PainelValidadeCard } from "./PainelValidadeCard";
import { PainelValidadeKpiCards } from "./PainelValidadeKpiCards";
import { PainelValidadeAlertsBar } from "./PainelValidadeAlertsBar";
import { PainelValidadeFilters } from "./PainelValidadeFilters";
import { PainelValidadeHeader } from "./PainelValidadeHeader";
import { PainelValidadeItemDetailContent } from "./PainelValidadeItemDetailModal";
import { PainelValidadeImportModal } from "./PainelValidadeImportModal";
import {
  createSnapshotFromRaw,
  getStorage,
  SNAPSHOTS_STORAGE_KEY,
  ACTIVE_SNAPSHOT_ID_KEY,
} from "@/lib/painel-validade-storage";
import {
  calcularContadoresKpi,
  filtrarLotes,
  processarLote,
  gerarExplicacaoSobraLinha,
  gerarDiagnosticoSobraCompleto,
} from "@/lib/painel-validade-analytics";
import type { ValidadeLoteCalculado, ValidadeLoteRaw, ValidadeSnapshot } from "@/types/painel-validade";

describe("Painel de Validade (Visualização Interna do Gestor e Comprador)", () => {
  beforeEach(() => {
    const storage = getStorage();
    storage.removeItem(SNAPSHOTS_STORAGE_KEY);
    storage.removeItem(ACTIVE_SNAPSHOT_ID_KEY);
    storage.removeItem("encarte-products-v2");
    storage.removeItem("encarte-products");
  });

  it("Renderiza estado inicial vazio com orientações e botões de ação", () => {
    const html = renderToString(<PainelValidadeWorkspace />);
    const clean = html.replace(/<!--.*?-->/g, "");

    expect(clean).toContain("Nenhuma planilha de validade carregada");
    expect(clean).toContain("Importar Planilha Winthor");
    expect(clean).toContain("Carregar Exemplo de Teste");
    expect(clean).toContain("Interno");
  });

  it("PainelValidadeCard: renderiza título com pelo menos 22px (text-xl/text-2xl) e barra de progresso com número escrito", () => {
    const mockLote: ValidadeLoteCalculado = {
      id: "22292_20_11_2026_0",
      codprod: "22292",
      descricao: "BATATA PALHA BELLA PALHA 80G",
      embalagem: "UNIDADE 1X80 GR",
      dtval: "20/11/2026",
      dtvalDate: new Date(),
      diasParaVencer: 20,
      isVencido: false,
      isSemEstoque: false,
      estoque: 36,
      precoVenda: 4.9,
      valorEmRisco: 137.2,
      vendaMesAtual: 5,
      vendaM1: 12,
      vendaM2: 14,
      vendaM3: 10,
      mediaMensalFechada: 12,
      isSemVenda: false,
      ritmoAtualDia: 0.4,
      ritmoNecessarioDia: 1.8,
      escoaTempoPercent: 22,
      sobraPrevistaUnidades: 28,
      coberturaMeses: 3,
      giroMesPercent: 33.3,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "alto",
      faixaCobertura: "2_a_6_meses",
      noEncarte: true,
      codcomprador: "10",
      nomeComprador: "JOAO SILVA",
    };

    const html = renderToString(
      <PainelValidadeCard lote={mockLote} onClick={() => {}} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // Selo NO ENCARTE visível e amarelo
    expect(clean).toContain("NO ENCARTE");

    // Texto de dias para vencer
    expect(clean).toContain("Vence em 20 dias");

    // Estoque
    expect(clean).toContain("36");
    expect(clean).toContain("UNIDADE 1X80 GR");

    // Barra de escoamento com o percentual de 22% escrito
    expect(clean).toContain("22%");

    // Título possui tamanho 22px ou classe text-xl
    expect(clean).toContain("BATATA PALHA BELLA PALHA 80G");
    expect(clean).toContain("22px");
  });

  it("PainelValidadeKpiCards: renderiza os números dos 5 cartões com fonte grande (48px / text-5xl)", () => {
    const counts = {
      vencidos: 1,
      ate7d: 5,
      de8a30d: 31,
      de31a60d: 46,
      de61a90d: 61,
      acima90d: 10,
      semValidade: 0,
      total: 154,
    };

    const html = renderToString(
      <PainelValidadeKpiCards counts={counts} onFaixaClick={() => {}} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    expect(clean).toContain("Vencidos");
    expect(clean).toContain("Até 7 dias");
    expect(clean).toContain("8 a 30 dias");
    expect(clean).toContain("31 a 60 dias");
    expect(clean).toContain("61 a 90 dias");

    // Verifica que contém os números
    expect(clean).toContain("1");
    expect(clean).toContain("5");
    expect(clean).toContain("31");
    expect(clean).toContain("46");
    expect(clean).toContain("61");

    // Verifica classes com tamanho de 48px (text-5xl)
    expect(clean).toContain("text-5xl");
  });

  it("PainelValidadeFilters: faixa unificada com busca, 5 atalhos principais de 56px e faixas de validade", () => {
    const counts = {
      todos: 100,
      critico: 15,
      vence7d: 8,
      vaiSobrar: 25,
      semVendas3M: 12,
      parado: 12,
    };

    const validityCounts = {
      vencidos: 1,
      ate7d: 6,
      de8a30d: 25,
      de31a60d: 46,
      de61a90d: 61,
      acima90d: 800,
      semValidade: 0,
      total: 939,
    };

    const html = renderToString(
      <PainelValidadeFilters
        filters={{
          busca: "",
          filtroRapido: "todos",
          faixaVencimento: "todas",
          faixaEscoaTempo: "todas",
          faixaGiroMes: "todas",
          faixaCobertura: "todas",
          ritmoMes: "todas",
          noEncarte: "todos",
          comprador: "todos",
          ordenacao: "critico_primeiro",
        }}
        onFiltersChange={() => {}}
        counts={counts}
        validityCounts={validityCounts}
        totalLotes={100}
        totalFiltrados={100}
        compradores={["JOAO SILVA", "MARIA OLIVEIRA"]}
      />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // Campo de busca sempre visível
    expect(clean).toContain("Buscar por código, produto ou comprador...");

    // 5 Atalhos principais unificados
    expect(clean).toContain("Todos");
    expect(clean).toContain("Crítico");
    expect(clean).toContain("Vence em 7 dias");
    expect(clean).toContain("Vai sobrar");
    expect(clean).toContain("Sem vendas (3M)");

    // Botão Mais Filtros
    expect(clean).toContain("Mais Filtros");

    // Barra de validade integrada com contagem e todas as faixas
    expect(clean).toContain("Faixas de Validade");
    expect(clean).toContain("Acima de 90 dias");
    expect(clean).toContain("800");

    // Altura mínima de 56px para os botões de atalho
    expect(clean).toContain("min-h-[56px]");
  });

  it("PainelValidadeAlertsBar: exibe os cartões de alerta com contagens e cores", () => {
    const alertCounts = {
      critico: 4,
      urgente: 2,
      parado: 7,
      ritmoCaiu: 3,
      novoLote: 1,
      saiuDoEncarte: 0,
    };

    const html = renderToString(
      <PainelValidadeAlertsBar alertCounts={alertCounts} onAlertClick={() => {}} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    expect(clean).toContain("Crítico");
    expect(clean).toContain("Vence em 7 dias");
    expect(clean).toContain("Sem Vendas");
    expect(clean).toContain("Vai Sobrar");
    expect(clean).toContain("4");
    expect(clean).toContain("2");
    expect(clean).toContain("7");
    expect(clean).toContain("3");
  });

  it("PainelValidadeItemDetailContent: exibe análise completa de vendas dos 4 meses e ritmo diário", () => {
    const mockLote: ValidadeLoteCalculado = {
      id: "22292_20_11_2026_0",
      codprod: "22292",
      descricao: "BATATA PALHA BELLA PALHA 80G",
      embalagem: "UNIDADE 1X80 GR",
      dtval: "20/11/2026",
      dtvalDate: new Date(),
      diasParaVencer: 20,
      isVencido: false,
      isSemEstoque: false,
      estoque: 36,
      precoVenda: 4.9,
      valorEmRisco: 137.2,
      vendaMesAtual: 5,
      vendaM1: 12,
      vendaM2: 14,
      vendaM3: 10,
      mediaMensalFechada: 12,
      isSemVenda: false,
      ritmoAtualDia: 0.4,
      ritmoNecessarioDia: 1.8,
      escoaTempoPercent: 22,
      sobraPrevistaUnidades: 28,
      coberturaMeses: 3,
      giroMesPercent: 33.3,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "alto",
      faixaCobertura: "2_a_6_meses",
      noEncarte: true,
      codcomprador: "10",
      nomeComprador: "JOAO SILVA",
    };

    const html = renderToString(
      <PainelValidadeItemDetailContent lote={mockLote} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    expect(clean).toContain("BATATA PALHA BELLA PALHA 80G");
    expect(clean).toContain("Histórico de Vendas Mensais");
    expect(clean).toContain("Mês Atual (parcial)");
    expect(clean).toContain("Ritmo Atual");
    expect(clean).toContain("Ritmo Necessário");
    expect(clean).toContain("Cobertura Prevista");
    expect(clean).toContain("Sobra Prevista");
    expect(clean).toContain("28 un");
  });

  it("PainelValidadeCard: balão (tooltip) exibe motivo em uma linha e é acessível", () => {
    const mockLote11096: ValidadeLoteCalculado = {
      id: "11096_10_12_2026_0",
      codprod: "11096",
      descricao: "PRODUTO REFERENCIA EXATIDAO",
      embalagem: "UN",
      dtval: "10/12/2026",
      dtvalDate: new Date("2026-12-10"),
      diasParaVencer: 23,
      isVencido: false,
      isSemEstoque: false,
      estoque: 227,
      precoVenda: 15.0,
      valorEmRisco: 3225.0,
      vendaMesAtual: 3,
      vendaM1: 16,
      vendaM2: 17,
      vendaM3: 16,
      mediaMensalFechada: 16.3,
      isSemVenda: false,
      ritmoAtualDia: 0.54,
      ritmoNecessarioDia: 9.87,
      escoaTempoPercent: 5.5,
      sobraPrevistaUnidades: 215,
      coberturaMeses: 13.9,
      giroMesPercent: 7.2,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "baixo",
      faixaCobertura: "acima_6_meses",
      noEncarte: false,
      codcomprador: "01",
      nomeComprador: "MARIANA",
    };

    const html = renderToString(
      <PainelValidadeCard lote={mockLote11096} onOpenDetail={() => {}} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // Verifica que o card possui atributos de acessibilidade e o motivo em uma linha
    expect(clean).toContain("data-motivo-sobra=\"Em 23 dias, no ritmo de 0,54 un/dia, vende ~12 un. Sobram ~215 un.\"");
    expect(clean).toContain("role=\"button\"");
    expect(clean).toContain("tabindex=\"0\"");
    expect(clean).toContain("aria-label=");
    expect(clean).toContain("Em 23 dias, no ritmo de 0,54 un/dia, vende ~12 un. Sobram ~215 un.");
  });

  it("PainelValidadeItemDetailContent: exibe seção 'Por que vai sobrar' completa e detalhada", () => {
    const mockLote11096: ValidadeLoteCalculado = {
      id: "11096_10_12_2026_0",
      codprod: "11096",
      descricao: "PRODUTO REFERENCIA EXATIDAO",
      embalagem: "UN",
      dtval: "10/12/2026",
      dtvalDate: new Date("2026-12-10"),
      diasParaVencer: 23,
      isVencido: false,
      isSemEstoque: false,
      estoque: 227,
      precoVenda: 15.0,
      valorEmRisco: 3225.0,
      vendaMesAtual: 3,
      vendaM1: 16,
      vendaM2: 17,
      vendaM3: 16,
      mediaMensalFechada: 16.3,
      isSemVenda: false,
      ritmoAtualDia: 0.54,
      ritmoNecessarioDia: 9.87,
      escoaTempoPercent: 5.5,
      sobraPrevistaUnidades: 215,
      coberturaMeses: 13.9,
      giroMesPercent: 7.2,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "baixo",
      faixaCobertura: "acima_6_meses",
      noEncarte: false,
      codcomprador: "01",
      nomeComprador: "MARIANA",
    };

    const html = renderToString(
      <PainelValidadeItemDetailContent lote={mockLote11096} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // 1. Título da Seção
    expect(clean).toContain("Por que vai sobrar?");

    // 2. Vendas mês a mês
    expect(clean).toContain("M-3 (3 meses atrás)");
    expect(clean).toContain("M-2 (2 meses atrás)");
    expect(clean).toContain("M-1 (mês passado)");
    expect(clean).toContain("16 un");
    expect(clean).toContain("17 un");

    // 3. Média e Ritmo por dia
    expect(clean).toContain("Média mensal");
    expect(clean).toContain("16.3 un/mês");
    expect(clean).toContain("0,54 un/dia");
    expect(clean).toContain("÷ 30 dias do mês");

    // 4. Estoque atual e dias até o vencimento
    expect(clean).toContain("227 un");
    expect(clean).toContain("23 dias");
    expect(clean).toContain("10/12/2026");

    // 5. Venda prevista até vencer e sobra prevista
    expect(clean).toContain("~12 un");
    expect(clean).toContain("~215 un");

    // 6. Frases simples sem fórmulas
    expect(clean).toContain("Explicação em Frases Simples");
    expect(clean).toContain("vende em média");
    expect(clean).toContain("ritmo de 0,54 unidades por dia");
    expect(clean).toContain("sobram cerca de 215 unidades");
  });

  it("PainelValidadeItemDetailContent: lote que escoa 100% não exibe a palavra 'sobra'", () => {
    const mockEscoa100: ValidadeLoteCalculado = {
      id: "8800_07_12_2026_0",
      codprod: "8800",
      descricao: "PRODUTO ESCOA TOTAL",
      embalagem: "UN",
      dtval: "07/12/2026",
      dtvalDate: new Date(),
      diasParaVencer: 20,
      isVencido: false,
      isSemEstoque: false,
      estoque: 40,
      precoVenda: 5.0,
      valorEmRisco: 0,
      vendaMesAtual: 30,
      vendaM1: 150,
      vendaM2: 150,
      vendaM3: 150,
      mediaMensalFechada: 150,
      isSemVenda: false,
      ritmoAtualDia: 5,
      ritmoNecessarioDia: 2,
      escoaTempoPercent: 100,
      sobraPrevistaUnidades: 0,
      coberturaMeses: 0.3,
      giroMesPercent: 100,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "escoa_tempo",
      faixaGiroMes: "alto",
      faixaCobertura: "ate_2_meses",
      noEncarte: false,
      codcomprador: "01",
      nomeComprador: "MARIANA",
    };

    const html = renderToString(
      <PainelValidadeItemDetailContent lote={mockEscoa100} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // Título muda para Previsão de Saída
    expect(clean).toContain("Previsão de Saída do Lote");
    expect(clean).toContain("100% Escoa a tempo");
    expect(clean).toContain("Demanda suficiente para escoar 100%");
    // Não deve exibir "Sobra prevista no vencimento"
    expect(clean).not.toContain("Sobra prevista no vencimento");
  });

  it("PainelValidadeItemDetailContent: quando faltar histórico mostra 'sem dados' sem assumir zero", () => {
    const mockSemDados: ValidadeLoteCalculado = {
      id: "7700_17_12_2026_0",
      codprod: "7700",
      descricao: "PRODUTO NOVO SEM DADOS",
      embalagem: "UN",
      dtval: "17/12/2026",
      dtvalDate: new Date(),
      diasParaVencer: 30,
      isVencido: false,
      isSemEstoque: false,
      estoque: 30,
      precoVenda: 10.0,
      valorEmRisco: 200.0,
      vendaMesAtual: 5,
      vendaM1: 15,
      vendaM2: 0,
      vendaM3: 0,
      vendaM2Raw: null,
      vendaM3Raw: null,
      mediaMensalFechada: 5,
      isSemVenda: false,
      ritmoAtualDia: 0.17,
      ritmoNecessarioDia: 1,
      escoaTempoPercent: 17,
      sobraPrevistaUnidades: 25,
      coberturaMeses: 6,
      giroMesPercent: 16.7,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "medio",
      faixaCobertura: "2_a_6_meses",
      noEncarte: false,
      codcomprador: "01",
      nomeComprador: "MARIANA",
    };

    const html = renderToString(
      <PainelValidadeItemDetailContent lote={mockSemDados} />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // M-2 e M-3 exibem "sem dados"
    expect(clean).toContain("sem dados");
  });

  it("Garante separação estrita do cliente: nenhum botão de exportação pública ou flyer existe no painel", () => {
    const html = renderToString(<PainelValidadeWorkspace />);
    const clean = html.replace(/<!--.*?-->/g, "");

    // Não deve conter exportar PDF, exportar PNG, exportar Encarte
    expect(clean).not.toContain("Exportar PDF");
    expect(clean).not.toContain("Exportar PNG");
    expect(clean).not.toContain("Exportar Encarte");
  });

  it("Faixas de validade: soma de todas as faixas é exatamente igual ao total de lotes", () => {
    const testLotes: ValidadeLoteCalculado[] = [
      {
        id: "1",
        codprod: "1",
        descricao: "P1",
        embalagem: "UN",
        dtval: "01/01/2026",
        dtvalDate: new Date("2026-01-01"),
        diasParaVencer: -5,
        isVencido: true,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 0,
        vendaM1: 0,
        vendaM2: 0,
        vendaM3: 0,
        vendaM2Raw: 0,
        vendaM3Raw: 0,
        mediaMensalFechada: 0,
        isSemVenda: true,
        ritmoAtualDia: 0,
        ritmoNecessarioDia: 0,
        escoaTempoPercent: 0,
        sobraPrevistaUnidades: 10,
        coberturaMeses: 999,
        giroMesPercent: 0,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "vencido",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "sem_venda",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "2",
        codprod: "2",
        descricao: "P2",
        embalagem: "UN",
        dtval: "20/11/2026",
        dtvalDate: new Date("2026-11-20"),
        diasParaVencer: 3,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 3.3,
        escoaTempoPercent: 1,
        sobraPrevistaUnidades: 9.9,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "ate_7d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "3",
        codprod: "3",
        descricao: "P3",
        embalagem: "UN",
        dtval: "05/12/2026",
        dtvalDate: new Date("2026-12-05"),
        diasParaVencer: 18,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 0.5,
        escoaTempoPercent: 6,
        sobraPrevistaUnidades: 9.4,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "8_a_30d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "4",
        codprod: "4",
        descricao: "P4",
        embalagem: "UN",
        dtval: "05/01/2027",
        dtvalDate: new Date("2027-01-05"),
        diasParaVencer: 49,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 0.2,
        escoaTempoPercent: 15,
        sobraPrevistaUnidades: 8.5,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "31_a_60d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "5",
        codprod: "5",
        descricao: "P5",
        embalagem: "UN",
        dtval: "05/02/2027",
        dtvalDate: new Date("2027-02-05"),
        diasParaVencer: 80,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 0.12,
        escoaTempoPercent: 25,
        sobraPrevistaUnidades: 7.6,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "61_a_90d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "6",
        codprod: "6",
        descricao: "P6",
        embalagem: "UN",
        dtval: "05/06/2027",
        dtvalDate: new Date("2027-06-05"),
        diasParaVencer: 200,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 0.05,
        escoaTempoPercent: 60,
        sobraPrevistaUnidades: 4,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "acima_90d",
        faixaEscoaTempo: "no_limite",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "7",
        codprod: "7",
        descricao: "P7",
        embalagem: "UN",
        dtval: "",
        dtvalDate: null,
        diasParaVencer: 9999,
        isVencido: false,
        isSemEstoque: false,
        estoque: 10,
        precoVenda: 1,
        valorEmRisco: 10,
        vendaMesAtual: 1,
        vendaM1: 1,
        vendaM2: 1,
        vendaM3: 1,
        vendaM2Raw: 1,
        vendaM3Raw: 1,
        mediaMensalFechada: 1,
        isSemVenda: false,
        ritmoAtualDia: 0.03,
        ritmoNecessarioDia: 0,
        escoaTempoPercent: 100,
        sobraPrevistaUnidades: 0,
        coberturaMeses: 10,
        giroMesPercent: 10,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "sem_validade",
        faixaEscoaTempo: "escoa_tempo",
        faixaGiroMes: "baixo",
        faixaCobertura: "acima_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
    ];

    const kpi = calcularContadoresKpi(testLotes);
    const somaFaixas =
      kpi.vencidos +
      kpi.ate7d +
      kpi.de8a30d +
      kpi.de31a60d +
      kpi.de61a90d +
      kpi.acima90d +
      kpi.semValidade;

    expect(somaFaixas).toBe(testLotes.length);
    expect(kpi.total).toBe(testLotes.length);
  });

  it("Consistência de métricas: 'Parado' e 'Sem vendas (3M)' filtram os mesmos lotes e exibem a mesma contagem", () => {
    const lotesSemVenda: ValidadeLoteCalculado[] = [
      {
        id: "1",
        codprod: "101",
        descricao: "PROD PARADO 1",
        embalagem: "UN",
        dtval: "10/12/2026",
        dtvalDate: new Date(),
        diasParaVencer: 25,
        isVencido: false,
        isSemEstoque: false,
        estoque: 50,
        precoVenda: 5,
        valorEmRisco: 250,
        vendaMesAtual: 0,
        vendaM1: 0,
        vendaM2: 0,
        vendaM3: 0,
        vendaM2Raw: 0,
        vendaM3Raw: 0,
        mediaMensalFechada: 0,
        isSemVenda: true,
        ritmoAtualDia: 0,
        ritmoNecessarioDia: 2,
        escoaTempoPercent: 0,
        sobraPrevistaUnidades: 50,
        coberturaMeses: 999,
        giroMesPercent: 0,
        ritmoMesStatus: "sem_base",
        vendaIrregular: false,
        faixaVencimento: "8_a_30d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "baixo",
        faixaCobertura: "sem_venda",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
      {
        id: "2",
        codprod: "102",
        descricao: "PROD ATIVO 2",
        embalagem: "UN",
        dtval: "10/12/2026",
        dtvalDate: new Date(),
        diasParaVencer: 25,
        isVencido: false,
        isSemEstoque: false,
        estoque: 50,
        precoVenda: 5,
        valorEmRisco: 250,
        vendaMesAtual: 10,
        vendaM1: 20,
        vendaM2: 25,
        vendaM3: 30,
        vendaM2Raw: 25,
        vendaM3Raw: 30,
        mediaMensalFechada: 25,
        isSemVenda: false,
        ritmoAtualDia: 0.83,
        ritmoNecessarioDia: 2,
        escoaTempoPercent: 41.5,
        sobraPrevistaUnidades: 29.25,
        coberturaMeses: 2,
        giroMesPercent: 50,
        ritmoMesStatus: "normal",
        vendaIrregular: false,
        faixaVencimento: "8_a_30d",
        faixaEscoaTempo: "vai_sobrar",
        faixaGiroMes: "medio",
        faixaCobertura: "2_a_6_meses",
        noEncarte: false,
        codcomprador: "",
        nomeComprador: "",
      },
    ];

    const filtradosParado = filtrarLotes(lotesSemVenda, {
      busca: "",
      filtroRapido: "parado",
      faixaVencimento: "todas",
      faixaEscoaTempo: "todas",
      faixaGiroMes: "todas",
      faixaCobertura: "todas",
      ritmoMes: "todas",
      noEncarte: "todos",
      comprador: "todos",
      ordenacao: "critico_primeiro",
    });

    const filtradosSemVendas3M = filtrarLotes(lotesSemVenda, {
      busca: "",
      filtroRapido: "sem_vendas_3m",
      faixaVencimento: "todas",
      faixaEscoaTempo: "todas",
      faixaGiroMes: "todas",
      faixaCobertura: "todas",
      ritmoMes: "todas",
      noEncarte: "todos",
      comprador: "todos",
      ordenacao: "critico_primeiro",
    });

    expect(filtradosParado.length).toBe(1);
    expect(filtradosSemVendas3M.length).toBe(1);
    expect(filtradosParado[0].id).toBe(filtradosSemVendas3M[0].id);
  });

  it("Chips de filtros ativos e Limpar tudo: exibe chips para filtros aplicados e permite remoção individual", () => {
    let capturedFilters: any = null;

    const html = renderToString(
      <PainelValidadeFilters
        filters={{
          busca: "Biscoito",
          filtroRapido: "critico",
          faixaVencimento: "ate_7d",
          faixaEscoaTempo: "todas",
          faixaGiroMes: "todas",
          faixaCobertura: "todas",
          ritmoMes: "todas",
          noEncarte: "todos",
          comprador: "JOAO SILVA",
          ordenacao: "critico_primeiro",
        }}
        onFiltersChange={(f) => {
          capturedFilters = f;
        }}
        counts={{
          todos: 50,
          critico: 10,
          vence7d: 5,
          vaiSobrar: 8,
          semVendas3M: 2,
        }}
        validityCounts={{
          vencidos: 0,
          ate7d: 5,
          de8a30d: 15,
          de31a60d: 10,
          de61a90d: 10,
          acima90d: 10,
          semValidade: 0,
          total: 50,
        }}
        totalLotes={50}
        totalFiltrados={3}
      />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    // Exibe chips de busca, atalho, validade e comprador
    expect(clean).toContain("Busca:");
    expect(clean).toContain("Biscoito");
    expect(clean).toContain("Atalho: Crítico");
    expect(clean).toContain("Validade: Até 7 dias");
    expect(clean).toContain("Comprador: JOAO SILVA");

    // Exibe Mostrando 3 de 50 lotes
    expect(clean).toContain("Mostrando");
    expect(clean).toContain("3");
    expect(clean).toContain("50");

    // Botão Limpar tudo presente
    expect(clean).toContain("Limpar tudo");
  });

  it("Cálculo Inteligente: considera estritamente QTDISP_WMS, calcula multiplicador de esforço e prejuízo real da sobra", () => {
    const rawLote = {
      codprod: "26032",
      descricao: "SALGADINHO LAYS BATATA SALT VINEGAR",
      embalagem: "1X62 GR",
      dtval: "07/12/2026", // 20 dias a partir de 17/11/2026
      qtdisp_wms: 35,      // Estoque oficial considerado
      qtest_winthor: 50,   // Estoque contábil diferente (deve ser IGNORADO)
      preco_venda: 4.90,
      qtvendmes: 20,       // Mês atual em curso (incluído na conta de vendas)
      qtvendmes1: 24,      // M-1
      qtvendmes2: 18,      // M-2
      qtvendmes3: 18,      // M-3
      codcomprador: "18031",
      nomeComprador: "LUDMYLLA",
    };

    const refDate = new Date("2026-11-17T00:00:00");
    const lote = processarLote(rawLote, refDate);

    // 1. Confirma que o estoque considerado é estritamente qtdisp_wms (35), e não qtest_winthor (50)
    expect(lote.estoque).toBe(35);
    expect(lote.qtdisp_wms).toBe(35);
    expect(lote.qtest_winthor).toBe(50);

    // 2. Média mensal: (20 + 24 + 18 + 18) / 4 = 20 un/mês
    expect(lote.mediaMensalFechada).toBe(20);

    // 3. Ritmo atual: 20 / 30 = 0.67 un/dia
    expect(lote.ritmoAtualDia).toBeCloseTo(0.67, 2);

    // 4. Dias para vencer: 20 dias
    expect(lote.diasParaVencer).toBe(20);

    // 5. Ritmo necessário para escoar: 35 un / 20 dias = 1.75 un/dia
    expect(lote.ritmoNecessarioDia).toBeCloseTo(1.75, 2);

    // 6. Multiplicador de Esforço Comercial: 1.75 / 0.67 ~= 2.6x (aceleração crítica)
    expect(lote.multiplicadorEsforco).toBeGreaterThanOrEqual(2.5);
    expect(lote.nivelEsforco).toBe("critico_queima");
    expect(lote.recomendacaoComercial).toContain("queima");

    // 7. Venda prevista em 20 dias: 0.67 * 20 ~= 13.4 un
    // Sobra prevista: 35 - 13.4 = 21.6 un
    expect(lote.sobraPrevistaUnidades).toBeCloseTo(21.6, 1);

    // 8. Prejuízo financeiro real previsto na sobra: sobra * precoVenda = 21.6 * 4.90 = R$ 105.84
    expect(lote.prejuizoPrevistoSobra).toBeCloseTo(105.84, 1);

    // 9. Diagnóstico renderizado no modal
    const diag = gerarDiagnosticoSobraCompleto(lote);
    expect(diag.estoque).toBe(35);
    expect(diag.multiplicadorEsforco).toBeGreaterThanOrEqual(2.5);
    expect(diag.recomendacaoComercial).toContain("queima");
  });

  it("Suporta QEST_WINTHOR como estoque quando QTDISP_WMS for ausente ou zerado", () => {
    const rawLote = {
      codprod: "22292",
      descricao: "BATATA PALHA BELLA PALHA",
      embalagem: "1X80 GR",
      dtval: "20/11/2026",
      qtdisp_wms: 0,
      qtest_winthor: 42, // Somente Winthor tem estoque
      preco_venda: 1.93,
      qtvendmes: 30,
      qtvendmes1: 0,
      qtvendmes2: 75,
      qtvendmes3: 1735,
    };

    const lote = processarLote(rawLote, new Date("2026-11-17T00:00:00"));
    expect(lote.estoque).toBe(42);
    expect(lote.qtdisp_wms).toBe(0);
    expect(lote.qtest_winthor).toBe(42);

    // QTVENDMES impede que seja classificado como sem venda
    expect(lote.isSemVenda).toBe(false);
    expect(lote.mediaMensalFechada).toBeGreaterThan(0);
  });

  it("Modal 'Por que vai sobrar' inclui todos os 4 períodos de vendas (M-3, M-2, M-1, Mês Atual)", () => {
    const rawLote = {
      codprod: "23035",
      descricao: "SALGADINHO CHEETOS MIX",
      embalagem: "1X36 GR",
      dtval: "23/11/2026",
      qtdisp_wms: 15,
      qtest_winthor: 1,
      preco_venda: 3.41,
      qtvendmes: 317,
      qtvendmes1: 1190,
      qtvendmes2: 724,
      qtvendmes3: 0,
    };

    const lote = processarLote(rawLote, new Date("2026-11-17T00:00:00"));
    const diag = gerarDiagnosticoSobraCompleto(lote);

    expect(diag.mesesFechados).toHaveLength(4);
    expect(diag.mesesFechados[0].rotulo).toBe("M-3");
    expect(diag.mesesFechados[1].rotulo).toBe("M-2");
    expect(diag.mesesFechados[2].rotulo).toBe("M-1");
    expect(diag.mesesFechados[3].rotulo).toBe("Mês Atual");
    expect(diag.mesesFechados[3].valor).toBe(317);
    expect(diag.mesesFechados[3].textoFormatado).toBe("317 un");
  });

  it("Produto com QEST_WINTHOR = 0 aparece como SEM ESTOQUE e é excluído de alertas de sobra", () => {
    // Exemplo real da Batata Palha Bella Palha (Row 3 do TESTE_VALIDADE.csv)
    // QTDISP_WMS = 7 (reservado), mas QTEST_WINTHOR = 0
    const rawLote = {
      codprod: "22292",
      descricao: "BATATA PALHA BELLA PALHA",
      embalagem: "1X80 GR",
      dtval: "20/11/2026", // Vence em 3 dias
      qtdisp_wms: 7,
      qtest_winthor: 0,    // Sem estoque no Winthor
      preco_venda: 1.93,
      qtvendmes: 30,
      qtvendmes1: 0,
      qtvendmes2: 75,
      qtvendmes3: 1735,
    };

    const lote = processarLote(rawLote, new Date("2026-11-17T00:00:00"));

    // 1. Estoque considerado é 0 e isSemEstoque é true
    expect(lote.estoque).toBe(0);
    expect(lote.isSemEstoque).toBe(true);
    expect(lote.sobraPrevistaUnidades).toBe(0);
    expect(lote.faixaEscoaTempo).toBe("sem_estoque");

    // 2. Balão explica sem estoque e sem sobra
    const balao = gerarExplicacaoSobraLinha(lote);
    expect(balao).toContain("sem estoque no Winthor");
    expect(balao).toContain("0 un");

    // 3. Diagnóstico detalhado para o modal
    const diag = gerarDiagnosticoSobraCompleto(lote);
    expect(diag.isSemEstoque).toBe(true);
    expect(diag.sobraPrevista).toBe(0);
    expect(diag.explicacaoSimples).toContain("sem estoque disponível no Winthor");

    // 4. Excluído dos filtros rápidos de 'vai_sobrar' e 'critico'
    const filtradosVaiSobrar = filtrarLotes([lote], { filtroRapido: "vai_sobrar" });
    expect(filtradosVaiSobrar).toHaveLength(0);

    const filtradosCritico = filtrarLotes([lote], { filtroRapido: "critico" });
    expect(filtradosCritico).toHaveLength(0);

    // 5. Renderização no Card exibe 'Sem estoque'
    const html = renderToString(<PainelValidadeCard lote={lote} />);
    expect(html).toContain("Sem Estoque");
    expect(html).toContain("Sem estoque");
  });

  it("exibe foto do produto no Card e no Modal de Detalhes com fallback seguro", () => {
    const rawProd: ValidadeLoteRaw = {
      codprod: "22743",
      descricao: "MARIA MOLE CHOCOLATE APTI",
      embalagem: "1X50 GR",
      dtval: "30/11/2026",
      qtdisp_wms: 17,
      preco_venda: 1.67,
      qtvendmes: 4,
      qtvendmes1: 0,
      qtvendmes2: 0,
      qtvendmes3: 0,
    };

    // 1. Lote COM foto vinculada (ex: vinda do último encarte ou CDN)
    const loteComFoto: ValidadeLoteCalculado = {
      ...processarLote(rawProd, new Date("2026-11-17T00:00:00")),
      foto: "https://cescom.agilecdn.com.br/22743_thumb_1.jpg",
      noEncarte: true,
    };

    const cardHtml = renderToString(<PainelValidadeCard lote={loteComFoto} />);
    expect(cardHtml).toContain("https://cescom.agilecdn.com.br/22743_thumb_1.jpg");
    expect(cardHtml).toContain("NO ENCARTE");

    const modalHtml = renderToString(<PainelValidadeItemDetailContent lote={loteComFoto} />);
    expect(modalHtml).toContain("https://cescom.agilecdn.com.br/22743_thumb_1.jpg");
    expect(modalHtml).toContain("MARIA MOLE CHOCOLATE APTI");

    // 2. Lote SEM foto (renderiza placeholder com código do produto e ícone sem quebrar)
    const rawSemFoto: ValidadeLoteRaw = {
      codprod: "99999",
      descricao: "PRODUTO TESTE SEM FOTO",
      embalagem: "UN",
      dtval: "30/11/2026",
      qtdisp_wms: 10,
      preco_venda: 5.0,
    };
    const loteSemFoto: ValidadeLoteCalculado = {
      ...processarLote(rawSemFoto, new Date("2026-11-17T00:00:00")),
      foto: undefined,
      noEncarte: false,
    };

    const cardSemFotoHtml = renderToString(<PainelValidadeCard lote={loteSemFoto} />);
    expect(cardSemFotoHtml).toContain("99999");
    expect(cardSemFotoHtml).not.toContain("NO ENCARTE");

    const modalSemFotoHtml = renderToString(<PainelValidadeItemDetailContent lote={loteSemFoto} />);
    expect(modalSemFotoHtml).toContain("PRODUTO TESTE SEM FOTO");
  });

  it("PainelValidade: exibe botão de ação 1-clique para enviar ao encarte tanto no card quanto no modal de detalhes", () => {
    // 1. Lote fora do encarte: exibe botão '+ ENCARTE' no card e 'Enviar para o Encarte Agora' no modal
    const rawFora: ValidadeLoteRaw = {
      codprod: "11096",
      descricao: "BEBIDA LACTEA PIRACANJUBA",
      embalagem: "CX",
      dtval: "10/12/2026",
      qtdisp_wms: 227,
      preco_venda: 2.5,
    };
    const loteFora = processarLote(rawFora, new Date("2026-11-17T00:00:00"));

    const cardForaHtml = renderToString(<PainelValidadeCard lote={loteFora} />);
    expect(cardForaHtml).toContain("+ ENCARTE");

    const modalForaHtml = renderToString(<PainelValidadeItemDetailContent lote={loteFora} />);
    expect(modalForaHtml).toContain("Enviar para o Encarte Agora");
    expect(modalForaHtml).toContain("Ação Comercial Rápida");

    // 2. Lote já no encarte: exibe 'NO ENCARTE' no card e opções de 'Abrir no Encarte' / 'Remover' no modal
    const loteNoEncarte: ValidadeLoteCalculado = {
      ...loteFora,
      noEncarte: true,
    };

    const cardNoEncarteHtml = renderToString(<PainelValidadeCard lote={loteNoEncarte} />);
    expect(cardNoEncarteHtml).toContain("NO ENCARTE");

    const modalNoEncarteHtml = renderToString(<PainelValidadeItemDetailContent lote={loteNoEncarte} />);
    expect(modalNoEncarteHtml).toContain("Abrir no Encarte");
    expect(modalNoEncarteHtml).toContain("Remover");
    expect(modalNoEncarteHtml).toContain("Produto no Encarte Mais Recente");
  });

  it("PainelValidade: exibe sincronização com Rotina 8230 no Header, Modal de Importação e Rodapé com data e horário", () => {
    // 1. Header com snapshot ativo contendo data e horário
    const mockSnapshot: ValidadeSnapshot = {
      id: "snap_test_8230",
      criadoEm: "2026-11-18T10:04:00.000Z",
      nomeArquivo: "rotina_8230_validade.xlsx",
      totalLotes: 1,
      importadoPor: "test",
      totalProdutosUnicos: 1,
      referenceDate: "2026-11-18T00:00:00.000Z",
      lotes: [],
    };

    const headerComSnapshotHtml = renderToString(
      <PainelValidadeHeader
        activeSnapshot={mockSnapshot}
        snapshotsList={[mockSnapshot]}
        onSelectSnapshot={() => {}}
      />
    );
    expect(headerComSnapshotHtml).toContain("Dados sincronizados com a Rotina 8230");
    expect(headerComSnapshotHtml).toContain("Rotina 8230");
    expect(headerComSnapshotHtml).toContain("logo-cescom-trimmed.png");
    // Verifica presença de horário e data formatada
    expect(headerComSnapshotHtml).toMatch(/18\/11(\/2026)?/);

    // 2. Header sem snapshot (estado inicial)
    const headerSemSnapshotHtml = renderToString(
      <PainelValidadeHeader
        activeSnapshot={null}
        snapshotsList={[]}
        onSelectSnapshot={() => {}}
      />
    );
    expect(headerSemSnapshotHtml).toContain("Dados sincronizados com a Rotina 8230");
    expect(headerSemSnapshotHtml).toContain("Aguardando importação");

    // 3. Modal de importação com identificação da Rotina 8230
    const modalHtml = renderToString(
      <PainelValidadeImportModal
        open={true}
        onClose={() => {}}
        onImportSuccess={() => {}}
      />
    );
    expect(modalHtml).toContain("Rotina 8230");
    expect(modalHtml).toContain("Dados sincronizados com a Rotina 8230");

    // 4. Rodapé no Workspace
    const workspaceHtml = renderToString(<PainelValidadeWorkspace />);
    expect(workspaceHtml).toContain("Dados sincronizados com a Rotina 8230 (Winthor)");
    expect(workspaceHtml).toContain("<footer");
  });

  it("PainelValidadeCard: despoluído com Estoque Atual e Dias para Vencer em evidência máxima e botão de olhinho/lupa", () => {
    const mockLote: ValidadeLoteCalculado = {
      id: "33333_15_12_2026_0",
      codprod: "33333",
      descricao: "AZEITE EXTRA VIRGEM ANDORINHA 500ML",
      embalagem: "CX C/ 12",
      dtval: "15/12/2026",
      dtvalDate: new Date("2026-12-15"),
      diasParaVencer: 28,
      isVencido: false,
      isSemEstoque: false,
      estoque: 48,
      precoVenda: 39.9,
      valorEmRisco: 399.0,
      vendaMesAtual: 10,
      vendaM1: 30,
      vendaM2: 32,
      vendaM3: 28,
      mediaMensalFechada: 30,
      isSemVenda: false,
      ritmoAtualDia: 1.0,
      ritmoNecessarioDia: 1.7,
      escoaTempoPercent: 58,
      sobraPrevistaUnidades: 20,
      coberturaMeses: 1.6,
      giroMesPercent: 62.5,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "alto",
      faixaCobertura: "ate_2_meses",
      noEncarte: false,
      codcomprador: "12",
      nomeComprador: "MARIA OLIVEIRA",
    };

    const html = renderToString(<PainelValidadeCard lote={mockLote} />);

    // 1. Estoque Atual em destaque
    expect(html).toContain("Estoque Atual");
    expect(html).toContain("48");
    expect(html).toContain("CX C/ 12");

    // 2. Dias para vencer em destaque
    expect(html).toContain("Validade");
    expect(html).toContain("28 dias");
    expect(html).toContain("15/12/2026");

    // 3. Botão com olhinho / lupa para ver análise e detalhes
    expect(html).toContain("Ver Análise &amp; Detalhes");

    // 4. Ação direta de encarte
    expect(html).toContain("+ ENCARTE");

    // 5. Card despoluído (sem repetição de comprador poluindo a grade inicial)
    expect(html).not.toContain("Comprador: MARIA OLIVEIRA");
  });

  it("PainelValidadeItemDetailModal: Explicação em Frases Simples em evidência imediata e dados técnicos avançados recolhidos", () => {
    const mockLote: ValidadeLoteCalculado = {
      id: "44444_25_11_2026_0",
      codprod: "44444",
      descricao: "CAFÉ TRÊS CORAÇÕES TRADICIONAL 500G",
      embalagem: "FD C/ 20",
      dtval: "25/11/2026",
      dtvalDate: new Date("2026-11-25"),
      diasParaVencer: 8,
      isVencido: false,
      isSemEstoque: false,
      estoque: 60,
      precoVenda: 18.9,
      valorEmRisco: 756.0,
      vendaMesAtual: 5,
      vendaM1: 40,
      vendaM2: 38,
      vendaM3: 42,
      mediaMensalFechada: 40,
      isSemVenda: false,
      ritmoAtualDia: 1.33,
      ritmoNecessarioDia: 7.5,
      escoaTempoPercent: 18,
      sobraPrevistaUnidades: 40,
      coberturaMeses: 1.5,
      giroMesPercent: 66.7,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "8_a_30d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "alto",
      faixaCobertura: "ate_2_meses",
      noEncarte: false,
      codcomprador: "10",
      nomeComprador: "JOAO SILVA",
    };

    const html = renderToString(<PainelValidadeItemDetailContent lote={mockLote} />);

    // 1. Explicação em frases simples no topo em destaque
    expect(html).toContain("Explicação em Frases Simples:");
    expect(html).toContain("Diagnóstico Comercial &amp; Ação Recomendada:");

    // 2. Botão de comando para expandir informações avançadas
    expect(html).toContain("Ver Histórico Completo &amp; Informações Avançadas");

    // 3. Informações avançadas presentes para consulta com toggle
    expect(html).toContain("Histórico de Vendas (Mês Atual + Últimos 3 Meses)");
    expect(html).toContain("Ritmo Atual de Venda");
  });

  it("filtrarLotes: suporte a ocultarSemEstoque para despoluir listagem excluindo produtos com estoque zerado por padrão", () => {
    const comEstoque: ValidadeLoteCalculado = {
      id: "101",
      codprod: "101",
      descricao: "PRODUTO COM ESTOQUE",
      embalagem: "UN",
      dtval: "20/11/2026",
      dtvalDate: new Date(),
      diasParaVencer: 5,
      isVencido: false,
      isSemEstoque: false,
      estoque: 50,
      precoVenda: 10,
      valorEmRisco: 0,
      vendaMesAtual: 10,
      vendaM1: 10,
      vendaM2: 10,
      vendaM3: 10,
      mediaMensalFechada: 10,
      isSemVenda: false,
      ritmoAtualDia: 0.33,
      ritmoNecessarioDia: 10,
      escoaTempoPercent: 3,
      sobraPrevistaUnidades: 48,
      coberturaMeses: 5,
      giroMesPercent: 20,
      ritmoMesStatus: "normal",
      vendaIrregular: false,
      faixaVencimento: "ate_7d",
      faixaEscoaTempo: "vai_sobrar",
      faixaGiroMes: "baixo",
      faixaCobertura: "2_a_6_meses",
      noEncarte: false,
      codcomprador: "01",
      nomeComprador: "CARLOS",
    };

    const semEstoque: ValidadeLoteCalculado = {
      ...comEstoque,
      id: "102",
      codprod: "102",
      descricao: "PRODUTO SEM ESTOQUE",
      isSemEstoque: true,
      estoque: 0,
    };

    const lista = [comEstoque, semEstoque];

    // Quando ocultarSemEstoque = true (padrão) -> apenas o produto com estoque aparece
    const filtradosOcultando = filtrarLotes(lista, { ocultarSemEstoque: true });
    expect(filtradosOcultando).toHaveLength(1);
    expect(filtradosOcultando[0].codprod).toBe("101");

    // Quando ocultarSemEstoque = false -> ambos aparecem
    const filtradosTodos = filtrarLotes(lista, { ocultarSemEstoque: false });
    expect(filtradosTodos).toHaveLength(2);

    // Quando filtro rápido for explicitamente 'sem_estoque' -> exibe o produto sem estoque mesmo com ocultarSemEstoque: true
    const filtradosApenasSemEstoque = filtrarLotes(lista, {
      filtroRapido: "sem_estoque",
      ocultarSemEstoque: true,
    });
    expect(filtradosApenasSemEstoque).toHaveLength(1);
    expect(filtradosApenasSemEstoque[0].codprod).toBe("102");
  });
});
