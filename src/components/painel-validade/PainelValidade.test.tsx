import { describe, it, expect, beforeEach } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { PainelValidadeWorkspace } from "./PainelValidadeWorkspace";
import { PainelValidadeCard } from "./PainelValidadeCard";
import { PainelValidadeKpiCards } from "./PainelValidadeKpiCards";
import { PainelValidadeAlertsBar } from "./PainelValidadeAlertsBar";
import { PainelValidadeFilters } from "./PainelValidadeFilters";
import { PainelValidadeHeader } from "./PainelValidadeHeader";
import { PainelValidadeItemDetailContent } from "./PainelValidadeItemDetailModal";
import {
  createSnapshotFromRaw,
  getStorage,
  SNAPSHOTS_STORAGE_KEY,
  ACTIVE_SNAPSHOT_ID_KEY,
} from "@/lib/painel-validade-storage";
import type { ValidadeLoteCalculado, ValidadeSnapshot } from "@/types/painel-validade";

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

  it("PainelValidadeFilters: botões principais possuem altura mínima de 56px", () => {
    const counts = {
      todos: 100,
      critico: 15,
      vence_7d: 8,
      vai_sobrar: 25,
      parado: 12,
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
        compradores={["JOAO SILVA", "MARIA OLIVEIRA"]}
      />
    );
    const clean = html.replace(/<!--.*?-->/g, "");

    expect(clean).toContain("Todos");
    expect(clean).toContain("Crítico");
    expect(clean).toContain("Vence 7d");
    expect(clean).toContain("Vai Sobrar");
    expect(clean).toContain("Parado");

    // Verifica a classe min-h-[56px]
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
    expect(clean).toContain("Média mensal fechada");
    expect(clean).toContain("16.3 un/mês");
    expect(clean).toContain("0,54 un/dia");
    expect(clean).toContain("média dos 3 meses ÷ 30 dias do mês");

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
});
