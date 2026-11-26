import { describe, it, expect } from "vitest";
import {
  calcDaysToExpiry,
  classifyFaixaVencimento,
  classifyFaixaEscoaTempo,
  classifyFaixaGiroMes,
  classifyFaixaCobertura,
  evaluateRitmoMes,
  isVendaIrregular,
  processarLote,
  processarListaLotes,
  calcularKpiCounts,
  calcularAlertCounts,
  filtrarLotes,
  formatRitmoBR,
  gerarExplicacaoSobraLinha,
  gerarDiagnosticoSobraCompleto,
} from "./painel-validade-analytics";
import type { ValidadeLoteRaw, ValidadeSnapshot } from "@/types/painel-validade";

describe("Painel de Validade - Motor de Análise e Métricas", () => {
  const fixedRefDate = new Date("2026-11-17T12:00:00"); // 17 de Novembro de 2026

  it("calcula dias até o vencimento a partir de data brasileira", () => {
    // 20/11/2026 vs 17/11/2026 = 3 dias
    expect(calcDaysToExpiry("20/11/2026", fixedRefDate)).toBe(3);

    // 07/12/2026 vs 17/11/2026 = 20 dias
    expect(calcDaysToExpiry("07/12/2026", fixedRefDate)).toBe(20);

    // 15/11/2026 já venceu há 2 dias (-2)
    expect(calcDaysToExpiry("15/11/2026", fixedRefDate)).toBe(-2);
  });

  it("reproduz exatamente o EXEMPLO DE CONFERÊNCIA da especificação", () => {
    // Especificação:
    // estoque 36, média mensal 12, dias para vencer 20.
    // Ritmo atual = 0,4 un/dia. Venda até vencer = 8.
    // Escoa a tempo = 22%. Sobra prevista = 28 unidades.
    const raw: ValidadeLoteRaw = {
      codprod: "1001",
      descricao: "PRODUTO TESTE CONFERÊNCIA",
      embalagem: "UNIDADE",
      dtval: "07/12/2026", // Exatamente 20 dias a partir de 17/11/2026
      qtdisp_wms: 36,
      preco_venda: 10.0,
      qtvendmes: 12, // Mês atual QTVENDMES incluído na conta
      qtvendmes1: 12, // Média (12+12+12+12)/4 = 12
      qtvendmes2: 12,
      qtvendmes3: 12,
    };

    const calculado = processarLote(raw, fixedRefDate);

    expect(calculado.diasParaVencer).toBe(20);
    expect(calculado.estoque).toBe(36);
    expect(calculado.mediaMensalFechada).toBe(12);
    expect(calculado.ritmoAtualDia).toBe(0.4); // 12 / 30 = 0.4 un/dia
    expect(calculado.ritmoNecessarioDia).toBe(1.8); // 36 / 20 = 1.8 un/dia
    expect(calculado.escoaTempoPercent).toBe(22.2); // (8 / 36) * 100 = 22.2% (arredondado 22%)
    expect(Math.round(calculado.escoaTempoPercent)).toBe(22);
    expect(calculado.sobraPrevistaUnidades).toBe(28); // 36 - 8 = 28 unidades
    expect(calculado.coberturaMeses).toBe(3); // 36 / 12 = 3 meses de cobertura
    expect(calculado.valorEmRisco).toBe(280.0); // 28 un * R$ 10,00 = R$ 280,00
    expect(calculado.faixaEscoaTempo).toBe("vai_sobrar"); // < 60%
  });

  it("classifica corretamente as 6 faixas de vencimento", () => {
    expect(classifyFaixaVencimento(-1)).toBe("vencido");
    expect(classifyFaixaVencimento(0)).toBe("ate_7d");
    expect(classifyFaixaVencimento(7)).toBe("ate_7d");
    expect(classifyFaixaVencimento(8)).toBe("8_a_30d");
    expect(classifyFaixaVencimento(30)).toBe("8_a_30d");
    expect(classifyFaixaVencimento(31)).toBe("31_a_60d");
    expect(classifyFaixaVencimento(60)).toBe("31_a_60d");
    expect(classifyFaixaVencimento(61)).toBe("61_a_90d");
    expect(classifyFaixaVencimento(90)).toBe("61_a_90d");
    expect(classifyFaixaVencimento(91)).toBe("acima_90d");
  });

  it("avalia o ritmo do mês parcial comparado com o dia da importação", () => {
    // 17 de novembro (dia 17 de um mês de 30 dias -> fracção ~0.567)
    // Se a média mensal é 30, o esperado até o dia 17 é ~17 unidades.
    // Se vendeu 25 un (> 17 * 1.2 = 20.4) -> acima_normal
    expect(evaluateRitmoMes(25, 30, fixedRefDate)).toBe("acima_normal");

    // Se vendeu 16 un (entre 80% e 120%) -> normal
    expect(evaluateRitmoMes(16, 30, fixedRefDate)).toBe("normal");

    // Se vendeu 5 un (< 17 * 0.8 = 13.6) -> abaixo_normal
    expect(evaluateRitmoMes(5, 30, fixedRefDate)).toBe("abaixo_normal");

    // Se média mensal é zero -> sem_base
    expect(evaluateRitmoMes(5, 0, fixedRefDate)).toBe("sem_base");
  });

  it("detecta venda irregular nos 3 meses fechados", () => {
    expect(isVendaIrregular(0, 10, 5)).toBe(true); // Um mês zero e outro positivo
    expect(isVendaIrregular(30, 10, 8)).toBe(true); // 30 >= 3*8 (24) -> irregular
    expect(isVendaIrregular(10, 12, 11)).toBe(false); // Estável
  });

  it("associa o selo 'NO ENCARTE' quando o produto está no encarte ativo", () => {
    const raw: ValidadeLoteRaw = {
      codprod: "22292",
      descricao: "BATATA PALHA BELLA",
      embalagem: "1X80G",
      dtval: "20/11/2026",
      qtdisp_wms: 10,
      preco_venda: 4.5,
      qtvendmes: 2,
      qtvendmes1: 10,
      qtvendmes2: 10,
      qtvendmes3: 10,
    };

    const activeEncarte = new Set(["22292", "99999"]);
    const calculado = processarLote(raw, fixedRefDate, activeEncarte);
    expect(calculado.noEncarte).toBe(true);

    const semEncarte = processarLote(raw, fixedRefDate, new Set(["88888"]));
    expect(semEncarte.noEncarte).toBe(false);
  });

  it("calcula conferência de contagens de faixas com precisão", () => {
    // Gera mock de lotes com as contagens exatas da conferência do prompt:
    // 1 vencido, 31 em até 30d (ex: 7 em ate_7d + 24 em 8_a_30d = 31),
    // 46 em 31 a 60d, 61 em 61 a 90d -> total em até 90 dias = 1 + 31 + 46 + 61 = 139 lotes
    const mockLotes: ValidadeLoteRaw[] = [];

    // 1 vencido (-2 dias: 15/11/2026)
    mockLotes.push({
      codprod: "v-1",
      descricao: "Item Vencido",
      embalagem: "UN",
      dtval: "15/11/2026",
      qtdisp_wms: 5,
      preco_venda: 10,
      qtvendmes: 0,
      qtvendmes1: 0,
      qtvendmes2: 0,
      qtvendmes3: 0,
    });

    // 31 em até 30 dias (7 até 7d, 24 de 8 a 30d)
    for (let i = 0; i < 7; i++) {
      mockLotes.push({
        codprod: `7d-${i}`,
        descricao: `Item 7d ${i}`,
        embalagem: "UN",
        dtval: "20/11/2026", // 3 dias
        qtdisp_wms: 10,
        preco_venda: 5,
        qtvendmes: 2,
        qtvendmes1: 10,
        qtvendmes2: 10,
        qtvendmes3: 10,
      });
    }

    for (let i = 0; i < 24; i++) {
      mockLotes.push({
        codprod: `30d-${i}`,
        descricao: `Item 30d ${i}`,
        embalagem: "UN",
        dtval: "05/12/2026", // 18 dias
        qtdisp_wms: 20,
        preco_venda: 5,
        qtvendmes: 2,
        qtvendmes1: 10,
        qtvendmes2: 10,
        qtvendmes3: 10,
      });
    }

    // 46 em 31 a 60 dias
    for (let i = 0; i < 46; i++) {
      mockLotes.push({
        codprod: `60d-${i}`,
        descricao: `Item 60d ${i}`,
        embalagem: "UN",
        dtval: "15/01/2027", // ~59 dias
        qtdisp_wms: 20,
        preco_venda: 5,
        qtvendmes: 2,
        qtvendmes1: 10,
        qtvendmes2: 10,
        qtvendmes3: 10,
      });
    }

    // 61 em 61 a 90 dias
    for (let i = 0; i < 61; i++) {
      mockLotes.push({
        codprod: `90d-${i}`,
        descricao: `Item 90d ${i}`,
        embalagem: "UN",
        dtval: "05/02/2027", // ~80 dias
        qtdisp_wms: 20,
        preco_venda: 5,
        qtvendmes: 2,
        qtvendmes1: 10,
        qtvendmes2: 10,
        qtvendmes3: 10,
      });
    }

    const calculados = mockLotes.map((l) => processarLote(l, fixedRefDate));
    const kpis = calcularKpiCounts(calculados);

    expect(kpis.vencidos).toBe(1);
    expect(kpis.ate7d + kpis.de8a30d).toBe(31);
    expect(kpis.de31a60d).toBe(46);
    expect(kpis.de61a90d).toBe(61);
    expect(kpis.vencidos + kpis.ate7d + kpis.de8a30d + kpis.de31a60d + kpis.de61a90d).toBe(139);
  });

  it("calcula os alertas de Crítico, Urgente e Parado", () => {
    const rawCritico: ValidadeLoteRaw = {
      codprod: "c-1",
      descricao: "Item Crítico",
      embalagem: "UN",
      dtval: "07/12/2026", // 20 dias (<= 30d)
      qtdisp_wms: 100,
      preco_venda: 5,
      qtvendmes: 1,
      qtvendmes1: 3, // Média = 3 un/mês -> 0.1 un/dia -> em 20d vende 2 un -> escoa 2% (< 60%)
      qtvendmes2: 3,
      qtvendmes3: 3,
    };

    const rawParado: ValidadeLoteRaw = {
      codprod: "p-1",
      descricao: "Item Parado",
      embalagem: "UN",
      dtval: "15/01/2027", // 59 dias (<= 90d)
      qtdisp_wms: 50,
      preco_venda: 5,
      qtvendmes: 0,
      qtvendmes1: 0, // Sem venda
      qtvendmes2: 0,
      qtvendmes3: 0,
    };

    const calculados = [rawCritico, rawParado].map((l) => processarLote(l, fixedRefDate));
    const alerts = calcularAlertCounts(calculados);

    expect(alerts.critico).toBe(1);
    expect(alerts.parado).toBe(1);
  });

  it("filtra lotes por busca, filtro rápido e comprador", () => {
    const rawList: ValidadeLoteRaw[] = [
      {
        codprod: "101",
        descricao: "ARROZ TIPO 1",
        embalagem: "PCT",
        dtval: "20/11/2026", // 3d
        qtdisp_wms: 10,
        preco_venda: 25,
        qtvendmes: 5,
        qtvendmes1: 150, // Média = 150 un/mês -> 5 un/dia -> escoa 100%
        qtvendmes2: 150,
        qtvendmes3: 150,
        codcomprador: "01",
        nomeComprador: "CARLOS",
      },
      {
        codprod: "102",
        descricao: "FEIJAO PRETO",
        embalagem: "PCT",
        dtval: "20/11/2026", // 3d
        qtdisp_wms: 100, // Sobra crítica
        preco_venda: 8,
        qtvendmes: 1,
        qtvendmes1: 3,
        qtvendmes2: 3,
        qtvendmes3: 3,
        codcomprador: "02",
        nomeComprador: "MARCOS",
      },
    ];

    const calculados = rawList.map((l) => processarLote(l, fixedRefDate));

    // Filtro por comprador Carlos
    const porCarlos = filtrarLotes(calculados, { comprador: "CARLOS" });
    expect(porCarlos.length).toBe(1);
    expect(porCarlos[0].codprod).toBe("101");

    // Filtro rápido "critico"
    const criticos = filtrarLotes(calculados, { filtroRapido: "critico" });
    expect(criticos.length).toBe(1);
    expect(criticos[0].codprod).toBe("102");
  });

  describe("Diagnóstico de Sobra (Por que vai sobrar)", () => {
    // Data de referência de 17/11/2026
    const refDate = new Date("2026-11-17T12:00:00");

    it("reproduz o exemplo de referência (código 11096, estoque 227, vencimento 10/12/2026, ritmo 0,54 un/dia) gerando sobra de ~215 un", () => {
      // 10/12/2026 - 17/11/2026 = 23 dias
      // Ritmo de 0,54 un/dia -> média mensal de ~16,2 un/mês
      // Venda prevista: 0,54 * 23 = ~12 un
      // Sobra prevista: 227 - 12,42 = 214,58 -> ~215 un
      const raw: ValidadeLoteRaw = {
        codprod: "11096",
        descricao: "PRODUTO REFERENCIA EXATIDAO",
        embalagem: "UN",
        dtval: "10/12/2026",
        qtdisp_wms: 227,
        preco_venda: 15.0,
        qtvendmes: 16, // Mês atual QTVENDMES incluído na conta
        qtvendmes1: 16,
        qtvendmes2: 17,
        qtvendmes3: 16, // Média (16+16+17+16)/4 = 16.3 un/mês -> 16.3/30 = 0.54 un/dia
      };

      const lote = processarLote(raw, refDate);

      expect(lote.diasParaVencer).toBe(23);
      expect(lote.estoque).toBe(227);
      expect(lote.ritmoAtualDia).toBe(0.54);
      expect(Math.round(lote.sobraPrevistaUnidades)).toBe(215);

      // Balão (tooltip) de uma linha
      const balao = gerarExplicacaoSobraLinha(lote);
      expect(balao).toBe("Em 23 dias, no ritmo de 0,54 un/dia, vende ~12 un. Sobram ~215 un.");

      // Diagnóstico detalhado para o modal
      const diag = gerarDiagnosticoSobraCompleto(lote);
      expect(diag.titulo).toBe("Por que vai sobrar?");
      expect(diag.estoque).toBe(227);
      expect(diag.diasParaVencer).toBe(23);
      expect(diag.ritmoAtualDia).toBe(0.54);
      expect(diag.vendaPrevista).toBe(12);
      expect(diag.sobraPrevista).toBe(215);
      expect(diag.explicacaoSimples).toContain("vende em média");
      expect(diag.explicacaoSimples).toContain("ritmo de 0,54 unidades por dia");
      expect(diag.explicacaoSimples).toContain("sobram cerca de 215 unidades");
    });

    it("lote com venda zero nos 3 meses mostra 'sem venda' e não divide por zero", () => {
      const raw: ValidadeLoteRaw = {
        codprod: "9900",
        descricao: "PRODUTO SEM VENDA HISTORICA",
        embalagem: "CX",
        dtval: "27/11/2026", // 10 dias
        qtdisp_wms: 50,
        preco_venda: 20.0,
        qtvendmes: 0,
        qtvendmes1: 0,
        qtvendmes2: 0,
        qtvendmes3: 0,
      };

      const lote = processarLote(raw, refDate);
      expect(lote.isSemVenda).toBe(true);
      expect(lote.mediaMensalFechada).toBe(0);
      expect(lote.ritmoAtualDia).toBe(0);
      expect(lote.sobraPrevistaUnidades).toBe(50);
      expect(lote.coberturaMeses).toBeNull(); // Não divide por zero

      // Balão
      const balao = gerarExplicacaoSobraLinha(lote);
      expect(balao.toLowerCase()).toContain("sem venda");
      expect(balao).toContain("ritmo 0 un/dia");
      expect(balao).toContain("todo o estoque de 50 un deve sobrar");
      expect(balao).not.toContain("NaN");
      expect(balao).not.toContain("Infinity");

      // Diagnóstico detalhado
      const diag = gerarDiagnosticoSobraCompleto(lote);
      expect(diag.isSemVenda).toBe(true);
      expect(diag.explicacaoSimples.toLowerCase()).toContain("sem venda");
      expect(diag.explicacaoSimples).toContain("todo o estoque atual de 50 unidades deverá sobrar");
      expect(diag.explicacaoSimples).not.toContain("NaN");
    });

    it("lote que escoa 100% não mostra 'sobra'", () => {
      const raw: ValidadeLoteRaw = {
        codprod: "8800",
        descricao: "PRODUTO ALTO GIRO ESCOAMENTO TOTAL",
        embalagem: "UN",
        dtval: "07/12/2026", // 20 dias
        qtdisp_wms: 40,
        preco_venda: 5.0,
        qtvendmes: 30,
        qtvendmes1: 150, // 150/mês -> 5 un/dia -> em 20 dias vende 100 (supera 40)
        qtvendmes2: 150,
        qtvendmes3: 150,
      };

      const lote = processarLote(raw, refDate);
      expect(lote.escoaTempoPercent).toBe(100);
      expect(lote.sobraPrevistaUnidades).toBe(0);

      // Balão NÃO pode conter a palavra "sobra" ou "Sobram"
      const balao = gerarExplicacaoSobraLinha(lote);
      expect(balao).toContain("vende todo o estoque de 40 un (escoa 100%)");
      expect(balao.toLowerCase()).not.toContain("sobra");

      // Diagnóstico detalhado NÃO pode conter "sobra" como problema
      const diag = gerarDiagnosticoSobraCompleto(lote);
      expect(diag.isEscoa100).toBe(true);
      expect(diag.titulo).toBe("Previsão de Saída do Lote");
      expect(diag.explicacaoSimples).toContain("100% escoado");
    });

    it("se faltar histórico de vendas de algum mês, mostra 'sem dados' sem assumir zero no texto", () => {
      const raw: ValidadeLoteRaw = {
        codprod: "7700",
        descricao: "PRODUTO NOVO COM HISTORICO PARCIAL",
        embalagem: "UN",
        dtval: "17/12/2026", // 30 dias
        qtdisp_wms: 30,
        preco_venda: 10.0,
        qtvendmes: 5,
        qtvendmes1: 15,
        qtvendmes2: null, // sem dados no M-2
        qtvendmes3: null, // sem dados no M-3
      };

      const lote = processarLote(raw, refDate);
      const diag = gerarDiagnosticoSobraCompleto(lote);

      // M-1 tem dados
      expect(diag.mesesFechados[2].rotulo).toBe("M-1");
      expect(diag.mesesFechados[2].semDados).toBe(false);
      expect(diag.mesesFechados[2].textoFormatado).toBe("15 un");

      // M-2 e M-3 mostram "sem dados"
      expect(diag.mesesFechados[1].rotulo).toBe("M-2");
      expect(diag.mesesFechados[1].semDados).toBe(true);
      expect(diag.mesesFechados[1].textoFormatado).toBe("sem dados");

      expect(diag.mesesFechados[0].rotulo).toBe("M-3");
      expect(diag.mesesFechados[0].semDados).toBe(true);
      expect(diag.mesesFechados[0].textoFormatado).toBe("sem dados");
    });

    it("avisa quando a venda for irregular nos 3 meses", () => {
      const raw: ValidadeLoteRaw = {
        codprod: "6600",
        descricao: "PRODUTO COM VENDA OSCILANTE",
        embalagem: "UN",
        dtval: "27/11/2026", // 10 dias
        qtdisp_wms: 80,
        preco_venda: 12.0,
        qtvendmes: 2,
        qtvendmes1: 50,
        qtvendmes2: 0, // Um mês zerado -> irregular
        qtvendmes3: 10,
      };

      const lote = processarLote(raw, refDate);
      expect(lote.vendaIrregular).toBe(true);

      const diag = gerarDiagnosticoSobraCompleto(lote);
      expect(diag.vendaIrregular).toBe(true);
      expect(diag.avisoIrregularidade).toContain("previsão de sobra podem variar");
    });

    it("o balão e o detalhe batem com o card (mesmo estoque, ritmo e sobra)", () => {
      const raw: ValidadeLoteRaw = {
        codprod: "5500",
        descricao: "PRODUTO TESTE CONSISTENCIA",
        embalagem: "UN",
        dtval: "02/12/2026", // 15 dias
        qtdisp_wms: 100,
        preco_venda: 8.0,
        qtvendmes: 30, // Mês atual QTVENDMES incluído na conta
        qtvendmes1: 30,
        qtvendmes2: 30,
        qtvendmes3: 30, // 30/mês -> 1 un/dia -> 15 dias -> vende 15 un -> sobra 85 un
      };

      const lote = processarLote(raw, refDate);
      const balao = gerarExplicacaoSobraLinha(lote);
      const diag = gerarDiagnosticoSobraCompleto(lote);

      // Card tem:
      // estoque: 100
      // ritmoAtualDia: 1
      // sobraPrevistaUnidades: 85
      // diasParaVencer: 15
      expect(lote.estoque).toBe(100);
      expect(lote.ritmoAtualDia).toBe(1);
      expect(lote.sobraPrevistaUnidades).toBe(85);

      // Balão tem os mesmos números:
      expect(balao).toContain("Em 15 dias");
      expect(balao).toContain("ritmo de 1 un/dia");
      expect(balao).toContain("vende ~15 un");
      expect(balao).toContain("Sobram ~85 un");

      // Detalhe tem os mesmos números:
      expect(diag.estoque).toBe(lote.estoque);
      expect(diag.ritmoAtualDia).toBe(lote.ritmoAtualDia);
      expect(diag.sobraPrevista).toBe(Math.round(lote.sobraPrevistaUnidades));
      expect(diag.vendaPrevista).toBe(15);
    });
  });

  describe("Ritmo Recente Pós-Ação e Comparativo entre Importações", () => {
    it("reconhece aceleração de vendas do Café 3 Corações entre 16/11 e 19/11 (40 un em 3 dias) e zera a sobra prevista", () => {
      const refDate1 = new Date("2026-11-16T10:00:00");
      const rawSnap1: ValidadeLoteRaw[] = [
        {
          codprod: "8540",
          descricao: "CAFE 3 CORACOES TRADICIONAL 500G",
          embalagem: "PCT",
          dtval: "25/12/2026", // 39 dias em 16/11, 36 dias em 19/11
          qtdisp_wms: 135,
          preco_venda: 18.9,
          qtvendmes: 21,
          qtvendmes1: 21,
          qtvendmes2: 21,
          qtvendmes3: 22, // Média 21.3 -> ritmo histórico 0.71 un/dia
          datafinal: "16/11/2026",
        },
      ];

      const lotesSnap1 = processarListaLotes(rawSnap1, refDate1);
      expect(lotesSnap1[0].ritmoAtualDia).toBe(0.71);
      expect(lotesSnap1[0].sobraPrevistaUnidades).toBeGreaterThan(0);

      const previousSnapshot: ValidadeSnapshot = {
        id: "snap_1",
        criadoEm: "2026-11-16T10:00:00.000Z",
        importadoPor: "Comprador",
        nomeArquivo: "rotina_8230_16_11.xlsx",
        totalLotes: lotesSnap1.length,
        totalProdutosUnicos: 1,
        lotes: lotesSnap1,
        referenceDate: refDate1.toISOString(),
      };

      const refDate2 = new Date("2026-11-19T10:00:00");
      const rawSnap2: ValidadeLoteRaw[] = [
        {
          codprod: "8540",
          descricao: "CAFE 3 CORACOES TRADICIONAL 500G",
          embalagem: "PCT",
          dtval: "25/12/2026", // 36 dias restantes
          qtdisp_wms: 95, // Caiu de 135 para 95
          preco_venda: 14.9, // Rebaixa de preço
          qtvendmes: 61, // Subiu de 21 para 61 (+40 unidades em 3 dias)
          qtvendmes1: 21,
          qtvendmes2: 21,
          qtvendmes3: 22,
          datafinal: "19/11/2026",
        },
      ];

      const lotesSnap2 = processarListaLotes(
        rawSnap2,
        refDate2,
        new Set(["8540"]),
        undefined,
        undefined,
        undefined,
        previousSnapshot
      );

      const cafe = lotesSnap2[0];
      expect(cafe.diasIntervaloSnapshots).toBe(3);
      expect(cafe.vendasNoIntervalo).toBe(40);
      expect(cafe.ritmoRecenteDia).toBe(13.33); // 40 / 3 = 13.33 un/dia
      expect(cafe.acelerouPosAcao).toBe(true);
      expect(cafe.diasParaZerarRitmoRecente).toBe(7.1); // 95 / 13.33 = ~7.1 dias
      expect(cafe.sobraPrevistaUnidades).toBe(0);
      expect(cafe.escoaTempoPercent).toBe(100);
      expect(cafe.faixaEscoaTempo).toBe("escoa_tempo");
      expect(cafe.valorEmRisco).toBe(0);

      const diag = gerarDiagnosticoSobraCompleto(cafe);
      expect(diag.titulo).toBe("Ação Comercial com Sucesso");
      expect(diag.isEscoa100).toBe(true);
      expect(diag.sobraPrevista).toBe(0);
      expect(diag.escoaTempoPercent).toBe(100);
      expect(diag.explicacaoSimples).toContain("13,33 un/dia");
      expect(diag.explicacaoSimples).toContain("Sobra prevista no vencimento: 0 unidades");
    });

    it("usa delta de estoque no CD como fallback quando qtvendmes está ausente", () => {
      const refDate1 = new Date("2026-11-16T10:00:00");
      const rawSnap1: ValidadeLoteRaw[] = [
        {
          codprod: "8540",
          descricao: "CAFE 3 CORACOES",
          embalagem: "PCT",
          dtval: "25/12/2026",
          qtdisp_wms: 135,
          preco_venda: 18.9,
          qtvendmes: null,
          qtvendmes1: 20,
          qtvendmes2: 20,
          qtvendmes3: 20,
        },
      ];
      const lotesSnap1 = processarListaLotes(rawSnap1, refDate1);
      const previousSnapshot: ValidadeSnapshot = {
        id: "snap_prev",
        criadoEm: refDate1.toISOString(),
        importadoPor: "Comprador",
        nomeArquivo: "snap1.xlsx",
        totalLotes: 1,
        totalProdutosUnicos: 1,
        lotes: lotesSnap1,
        referenceDate: refDate1.toISOString(),
      };

      const refDate2 = new Date("2026-11-19T10:00:00");
      const rawSnap2: ValidadeLoteRaw[] = [
        {
          codprod: "8540",
          descricao: "CAFE 3 CORACOES",
          embalagem: "PCT",
          dtval: "25/12/2026",
          qtdisp_wms: 95,
          preco_venda: 14.9,
          qtvendmes: null,
          qtvendmes1: 20,
          qtvendmes2: 20,
          qtvendmes3: 20,
        },
      ];

      const lotesSnap2 = processarListaLotes(
        rawSnap2,
        refDate2,
        new Set(),
        undefined,
        undefined,
        undefined,
        previousSnapshot
      );

      expect(lotesSnap2[0].diasIntervaloSnapshots).toBe(3);
      expect(lotesSnap2[0].vendasNoIntervalo).toBe(40);
      expect(lotesSnap2[0].ritmoRecenteDia).toBe(13.33);
      expect(lotesSnap2[0].sobraPrevistaUnidades).toBe(0);
    });

    it("alerta quando produto está no encarte mas ritmo recente não acelerou o suficiente", () => {
      const refDate1 = new Date("2026-11-16T10:00:00");
      const rawSnap1: ValidadeLoteRaw[] = [
        {
          codprod: "9910",
          descricao: "PRODUTO LENTO NO ENCARTE",
          embalagem: "UN",
          dtval: "29/11/2026", // 10 dias em 19/11
          qtdisp_wms: 100,
          preco_venda: 10,
          qtvendmes: 10,
          qtvendmes1: 30,
          qtvendmes2: 30,
          qtvendmes3: 30, // Ritmo histórico 0.83 un/dia
        },
      ];
      const lotesSnap1 = processarListaLotes(rawSnap1, refDate1);
      const previousSnapshot: ValidadeSnapshot = {
        id: "snap_prev2",
        criadoEm: refDate1.toISOString(),
        importadoPor: "Comprador",
        nomeArquivo: "snap1.xlsx",
        totalLotes: 1,
        totalProdutosUnicos: 1,
        lotes: lotesSnap1,
        referenceDate: refDate1.toISOString(),
      };

      const refDate2 = new Date("2026-11-19T10:00:00");
      const rawSnap2: ValidadeLoteRaw[] = [
        {
          codprod: "9910",
          descricao: "PRODUTO LENTO NO ENCARTE",
          embalagem: "UN",
          dtval: "29/11/2026", // 10 dias -> ritmo necessário 9.9 un/dia
          qtdisp_wms: 99,
          preco_venda: 10,
          qtvendmes: 11, // Vendeu só 1 un em 3 dias -> 0.33 un/dia
          qtvendmes1: 30,
          qtvendmes2: 30,
          qtvendmes3: 30,
        },
      ];

      const lotesSnap2 = processarListaLotes(
        rawSnap2,
        refDate2,
        new Set(["9910"]),
        undefined,
        undefined,
        undefined,
        previousSnapshot
      );

      expect(lotesSnap2[0].acelerouPosAcao).toBe(false);
      expect(lotesSnap2[0].recomendacaoComercial).toContain("Mesmo após a ação/rebaixa");
      expect(lotesSnap2[0].recomendacaoComercial).toContain("corte de preço mais agressivo");
    });
  });
});
