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

  it("Garante separação estrita do cliente: nenhum botão de exportação pública ou flyer existe no painel", () => {
    const html = renderToString(<PainelValidadeWorkspace />);
    const clean = html.replace(/<!--.*?-->/g, "");

    // Não deve conter exportar PDF, exportar PNG, exportar Encarte
    expect(clean).not.toContain("Exportar PDF");
    expect(clean).not.toContain("Exportar PNG");
    expect(clean).not.toContain("Exportar Encarte");
  });
});
