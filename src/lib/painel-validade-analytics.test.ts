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
  calcularKpiCounts,
  calcularAlertCounts,
  filtrarLotes,
} from "./painel-validade-analytics";
import type { ValidadeLoteRaw } from "@/types/painel-validade";

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
      qtvendmes: 2,
      qtvendmes1: 12, // Média (12+12+12)/3 = 12
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
});
