/**
 * Motor de Análise e Métricas do Painel de Validade
 *
 * Visão de Gestor de Distribuição e Comprador:
 * - Escoa a tempo (%)
 * - Ritmo necessário x Ritmo atual (unidades/dia)
 * - Cobertura em meses
 * - Sobra prevista no vencimento
 * - Ritmo do mês atual vs esperado
 * - Faixas de urgência e Alertas operacionais
 * - Pino "NO ENCARTE"
 */

import type {
  ValidadeLoteRaw,
  ValidadeLoteCalculado,
  ValidadeFilterParams,
  ValidadeAlertCounts,
  ValidadeKpiCounts,
  ValidadeDiagnosticoSobra,
  FaixaVencimento,
  FaixaEscoaTempo,
  FaixaGiroMes,
  FaixaCobertura,
  RitmoMesStatus,
} from "@/types/painel-validade";

/**
 * Converte data em formato brasileiro "dd/mm/aaaa" para objeto Date à meia-noite
 */
export function parseDateBR(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);

  const d = new Date(year, month, day, 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza qualquer data para meia-noite local para cálculo exato de dias
 */
export function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Calcula a diferença em dias entre a data de validade e a data de referência
 */
export function calcDaysToExpiry(validityStr?: string | null, referenceDate: Date = new Date()): number {
  const targetDate = parseDateBR(validityStr);
  if (!targetDate) return 999;

  const targetMid = toLocalMidnight(targetDate);
  const refMid = toLocalMidnight(referenceDate);

  const diffMs = targetMid.getTime() - refMid.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Classifica os dias em faixas de vencimento
 */
export function classifyFaixaVencimento(dias: number | null | undefined): FaixaVencimento {
  if (dias === null || dias === undefined || isNaN(dias)) return "sem_validade";
  if (dias < 0) return "vencido";
  if (dias <= 7) return "ate_7d";
  if (dias <= 30) return "8_a_30d";
  if (dias <= 60) return "31_a_60d";
  if (dias <= 90) return "61_a_90d";
  return "acima_90d";
}

/**
 * Classifica a porcentagem de escoamento a tempo
 */
export function classifyFaixaEscoaTempo(escoaPercent: number): FaixaEscoaTempo {
  if (escoaPercent < 60) return "vai_sobrar";
  if (escoaPercent < 100) return "no_limite";
  return "escoa_tempo";
}

/**
 * Classifica o giro mensal em relação ao estoque
 */
export function classifyFaixaGiroMes(giroPercent: number): FaixaGiroMes {
  if (giroPercent <= 0) return "parado";
  if (giroPercent < 10) return "baixo";
  if (giroPercent <= 30) return "medio";
  return "alto";
}

/**
 * Classifica a cobertura de estoque em meses
 */
export function classifyFaixaCobertura(cobertura: number | null): FaixaCobertura {
  if (cobertura === null) return "sem_venda";
  if (cobertura <= 2) return "ate_2_meses";
  if (cobertura <= 6) return "2_a_6_meses";
  return "acima_6_meses";
}

/**
 * Avalia o ritmo do mês parcial em curso (QTVENDMES) contra o esperado para o dia do mês
 */
export function evaluateRitmoMes(
  vendaMesAtual: number,
  mediaMensalFechada: number,
  referenceDate: Date = new Date()
): RitmoMesStatus {
  if (mediaMensalFechada <= 0) return "sem_base";

  const diaDaImportacao = referenceDate.getDate();
  const diasDoMes = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0
  ).getDate();

  const fracMes = Math.max(0.03, diaDaImportacao / diasDoMes);
  const esperadoAteHoje = mediaMensalFechada * fracMes;

  if (esperadoAteHoje <= 0) return "sem_base";

  const ratio = vendaMesAtual / esperadoAteHoje;
  if (ratio > 1.2) return "acima_normal";
  if (ratio < 0.8) return "abaixo_normal";
  return "normal";
}

/**
 * Detecta venda irregular nos 3 meses fechados
 */
export function isVendaIrregular(m1: number, m2: number, m3: number): boolean {
  const vals = [m1, m2, m3];
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  // Um mês zero e outro positivo
  if (min === 0 && max > 0) return true;

  // Maior mês é 3x ou mais que o menor
  if (min > 0 && max >= min * 3) return true;

  return false;
}

/**
 * Processa um lote bruto da planilha aplicando todas as regras de negócio
 */
export function processarLote(
  raw: ValidadeLoteRaw,
  referenceDate: Date = new Date(),
  activeEncarteCodes: Set<string> = new Set(),
  previousBatchKeys?: Set<string>,
  previousEncarteBatchKeys?: Set<string>
): ValidadeLoteCalculado {
  const codprod = String(raw.codprod).trim();
  const dtval = raw.dtval;
  const dtvalDate = parseDateBR(dtval);
  const diasParaVencer = calcDaysToExpiry(dtval, referenceDate);
  const isVencido = diasParaVencer < 0;

  // Estoque atual considerado: QTDISP_WMS e também QEST_WINTHOR
  const estoqueWms = raw.qtdisp_wms !== undefined && raw.qtdisp_wms !== null ? raw.qtdisp_wms : 0;
  const estoqueWinthor = raw.qtest_winthor !== undefined && raw.qtest_winthor !== null ? raw.qtest_winthor : 0;
  const estoque = Math.max(
    0,
    estoqueWms > 0 ? estoqueWms : (estoqueWinthor > 0 ? estoqueWinthor : (estoqueWms || estoqueWinthor || 0))
  );
  const precoVenda = Math.max(0, raw.preco_venda || 0);

  // Vendas com preservação de ausência de dados (null) vs zero numérico (0)
  const vendaMesAtualRaw = raw.qtvendmes !== undefined ? raw.qtvendmes : null;
  const vendaM1Raw = raw.qtvendmes1 !== undefined ? raw.qtvendmes1 : null;
  const vendaM2Raw = raw.qtvendmes2 !== undefined ? raw.qtvendmes2 : null;
  const vendaM3Raw = raw.qtvendmes3 !== undefined ? raw.qtvendmes3 : null;

  const vendaMesAtual = Math.max(0, vendaMesAtualRaw || 0);
  const vendaM1 = Math.max(0, vendaM1Raw || 0);
  const vendaM2 = Math.max(0, vendaM2Raw || 0);
  const vendaM3 = Math.max(0, vendaM3Raw || 0);

  // Vendas dos 4 períodos: QTVENDMES (mês atual) entra na conta + QTVENDMES1, QTVENDMES2, QTVENDMES3
  const somaTotalVendas = vendaMesAtual + vendaM1 + vendaM2 + vendaM3;
  const periodosComDados = [vendaMesAtualRaw, vendaM1Raw, vendaM2Raw, vendaM3Raw].filter(
    (v) => v !== null
  );
  const qtdPeriodos = Math.max(1, periodosComDados.length > 0 ? periodosComDados.length : 4);
  const mediaMensalFechada = Math.round((somaTotalVendas / qtdPeriodos) * 10) / 10;
  const isSemVenda = somaTotalVendas === 0;

  // Ritmo atual de vendas (unidades / dia)
  const ritmoAtualDia = Math.round((mediaMensalFechada / 30) * 100) / 100;

  // Ritmo necessário para escoar todo o lote (unidades / dia)
  const ritmoNecessarioDia =
    diasParaVencer > 0
      ? Math.round((estoque / diasParaVencer) * 100) / 100
      : 0;

  // Escoa a tempo (%)
  let escoaTempoPercent = 100;
  if (estoque > 0) {
    if (diasParaVencer <= 0) {
      escoaTempoPercent = 0;
    } else {
      const vendaProjetada = ritmoAtualDia * diasParaVencer;
      const pct = (vendaProjetada / estoque) * 100;
      escoaTempoPercent = Math.min(100, Math.round(pct * 10) / 10);
    }
  }

  // Sobra prevista (unidades)
  let sobraPrevistaUnidades = 0;
  if (estoque > 0) {
    if (diasParaVencer <= 0) {
      sobraPrevistaUnidades = estoque;
    } else {
      const vendaAteVencer = ritmoAtualDia * diasParaVencer;
      sobraPrevistaUnidades = Math.max(
        0,
        Math.round((estoque - vendaAteVencer) * 10) / 10
      );
    }
  }

  // Cobertura em meses
  const coberturaMeses =
    mediaMensalFechada > 0
      ? Math.round((estoque / mediaMensalFechada) * 10) / 10
      : null;

  // Giro no mês (%)
  const giroMesPercent =
    estoque > 0
      ? Math.min(100, Math.round((mediaMensalFechada / estoque) * 100 * 10) / 10)
      : 0;

  // Ritmo do mês e irregularidade
  const ritmoMesStatus = evaluateRitmoMes(
    vendaMesAtual,
    mediaMensalFechada,
    referenceDate
  );
  const vendaIrregular = isVendaIrregular(vendaM1, vendaM2, vendaM3);

  // Valor financeiro em risco focado na sobra prevista
  const valorEmRisco = Math.round(precoVenda * sobraPrevistaUnidades * 100) / 100;
  const prejuizoPrevistoSobra = valorEmRisco;

  // Multiplicador de Esforço Comercial e Recomendação Acionável
  let multiplicadorEsforco: number | null = null;
  if (!isVencido && diasParaVencer > 0 && estoque > 0) {
    if (ritmoAtualDia > 0) {
      multiplicadorEsforco = Math.round((ritmoNecessarioDia / ritmoAtualDia) * 10) / 10;
    }
  }

  let nivelEsforco: "normal" | "atencao" | "alerta_promocao" | "critico_queima" = "normal";
  let recomendacaoComercial = "Demanda suficiente para escoar todo o lote no ritmo natural.";

  if (isVencido || diasParaVencer < 0) {
    nivelEsforco = "critico_queima";
    recomendacaoComercial = "Lote vencido. Retirar da área de venda e providenciar descarte ou devolução.";
  } else if (isSemVenda || mediaMensalFechada === 0) {
    nivelEsforco = "critico_queima";
    recomendacaoComercial = "Sem saída nos últimos 3 meses. Requer queima agressiva imediata no encarte ou negociação de devolução.";
  } else if (escoaTempoPercent >= 100 || sobraPrevistaUnidades <= 0) {
    nivelEsforco = "normal";
    recomendacaoComercial = "Demanda suficiente para escoar 100% do lote dentro do prazo no ritmo normal.";
  } else if (multiplicadorEsforco !== null && multiplicadorEsforco <= 1.5) {
    nivelEsforco = "atencao";
    recomendacaoComercial = `Necessita aceleração leve (${multiplicadorEsforco}x). Recomenda-se destaque de ponta de gôndola ou cartazeamento.`;
  } else if (multiplicadorEsforco !== null && multiplicadorEsforco <= 2.5) {
    nivelEsforco = "alerta_promocao";
    recomendacaoComercial = `Necessita acelerar ${multiplicadorEsforco}x o giro. Recomenda-se incluir no Encarte com desconto promocional leve (15% a 20%).`;
  } else {
    const multTxt = multiplicadorEsforco ? `${multiplicadorEsforco}x` : "muito elevado";
    nivelEsforco = "critico_queima";
    recomendacaoComercial = `Situação crítica (precisa acelerar ${multTxt}). Recomenda-se super queima de validade (30% a 50%) ou repasse comercial urgente.`;
  }

  // Proporcional esperado do mês em curso (QTVENDMES)
  const diaDaImportacao = referenceDate.getDate();
  const diasDoMes = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  const vendaEsperadaMesAtual = Math.round(mediaMensalFechada * (diaDaImportacao / diasDoMes) * 10) / 10;

  // Faixas
  const faixaVencimento = classifyFaixaVencimento(diasParaVencer);
  const faixaEscoaTempo = classifyFaixaEscoaTempo(escoaTempoPercent);
  const faixaGiroMes = classifyFaixaGiroMes(giroMesPercent);
  const faixaCobertura = classifyFaixaCobertura(coberturaMeses);

  // Integração com Encarte (Pino NO ENCARTE)
  const noEncarte = activeEncarteCodes.has(codprod);

  // Chave única do lote
  const loteId = `${codprod}_${dtval}_${raw.loteNumero || "0"}`;
  const isNovoLote = previousBatchKeys
    ? !previousBatchKeys.has(loteId)
    : false;
  const saiuDoEncarte = previousEncarteBatchKeys
    ? previousEncarteBatchKeys.has(codprod) && !noEncarte
    : false;

  return {
    id: loteId,
    codprod,
    descricao: raw.descricao || `PRODUTO ${codprod}`,
    embalagem: raw.embalagem || "UND",
    dtval,
    dtvalDate,
    diasParaVencer,
    isVencido,
    estoque,
    qtdisp_wms: estoqueWms,
    qtest_winthor: estoqueWinthor,
    precoVenda,
    precoTotalPlanilha: raw.preco_total,
    valorEmRisco,
    vendaMesAtual,
    vendaM1,
    vendaM2,
    vendaM3,
    vendaMesAtualRaw,
    vendaM1Raw,
    vendaM2Raw,
    vendaM3Raw,
    mediaMensalFechada,
    isSemVenda,
    ritmoAtualDia,
    ritmoNecessarioDia,
    escoaTempoPercent,
    sobraPrevistaUnidades,
    coberturaMeses,
    giroMesPercent,
    ritmoMesStatus,
    vendaIrregular,
    faixaVencimento,
    faixaEscoaTempo,
    faixaGiroMes,
    faixaCobertura,
    noEncarte,
    codcomprador: raw.codcomprador || "",
    nomeComprador: raw.nomeComprador || "Não informado",
    prazoval: raw.prazoval,
    percentTolerancia: raw.percentTolerancia,
    multiplicadorEsforco,
    nivelEsforco,
    recomendacaoComercial,
    prejuizoPrevistoSobra,
    vendaEsperadaMesAtual,
    isNovoLote,
    saiuDoEncarte,
  };
}

/**
 * Processa uma lista de lotes brutos
 */
export function processarListaLotes(
  rawList: ValidadeLoteRaw[],
  referenceDate: Date = new Date(),
  activeEncarteCodes: Set<string> = new Set(),
  previousBatchKeys?: Set<string>,
  previousEncarteBatchKeys?: Set<string>
): ValidadeLoteCalculado[] {
  return rawList.map((raw) =>
    processarLote(
      raw,
      referenceDate,
      activeEncarteCodes,
      previousBatchKeys,
      previousEncarteBatchKeys
    )
  );
}

/**
 * Calcula os contadores dos cartões de KPI por faixa de vencimento
 */
export function calcularKpiCounts(lotes: ValidadeLoteCalculado[]): ValidadeKpiCounts {
  let vencidos = 0;
  let ate7d = 0;
  let de8a30d = 0;
  let de31a60d = 0;
  let de61a90d = 0;
  let acima90d = 0;
  let semValidade = 0;

  for (const lote of lotes) {
    switch (lote.faixaVencimento) {
      case "vencido":
        vencidos++;
        break;
      case "ate_7d":
        ate7d++;
        break;
      case "8_a_30d":
        de8a30d++;
        break;
      case "31_a_60d":
        de31a60d++;
        break;
      case "61_a_90d":
        de61a90d++;
        break;
      case "acima_90d":
        acima90d++;
        break;
      case "sem_validade":
        semValidade++;
        break;
      default:
        if (typeof lote.diasParaVencer === "number" && !isNaN(lote.diasParaVencer)) {
          if (lote.diasParaVencer < 0) vencidos++;
          else if (lote.diasParaVencer <= 7) ate7d++;
          else if (lote.diasParaVencer <= 30) de8a30d++;
          else if (lote.diasParaVencer <= 60) de31a60d++;
          else if (lote.diasParaVencer <= 90) de61a90d++;
          else acima90d++;
        } else {
          semValidade++;
        }
        break;
    }
  }

  return {
    vencidos,
    ate7d,
    de8a30d,
    de31a60d,
    de61a90d,
    acima90d,
    semValidade,
    total: lotes.length,
  };
}

/**
 * Calcula os alertas do painel de avisos no topo
 */
export function calcularAlertCounts(lotes: ValidadeLoteCalculado[]): ValidadeAlertCounts {
  let critico = 0;
  let urgente = 0;
  let parado = 0;
  let ritmoCaiu = 0;
  let novoLote = 0;
  let saiuDoEncarte = 0;

  for (const lote of lotes) {
    // Crítico: vence em até 30 dias E escoa a tempo abaixo de 60%
    if (lote.diasParaVencer >= 0 && lote.diasParaVencer <= 30 && lote.escoaTempoPercent < 60) {
      critico++;
    }

    // Urgente: vence em até 7 dias E escoa a tempo abaixo de 100%
    if (lote.diasParaVencer >= 0 && lote.diasParaVencer <= 7 && lote.escoaTempoPercent < 100) {
      urgente++;
    }

    // Parado: sem venda nos 3 meses fechados E vence em até 90 dias
    if (lote.isSemVenda && lote.diasParaVencer >= 0 && lote.diasParaVencer <= 90) {
      parado++;
    }

    // Ritmo caiu: mês parcial abaixo do normal E escoa a tempo abaixo de 100%
    if (lote.ritmoMesStatus === "abaixo_normal" && lote.escoaTempoPercent < 100 && !lote.isVencido) {
      ritmoCaiu++;
    }

    if (lote.isNovoLote) novoLote++;
    if (lote.saiuDoEncarte) saiuDoEncarte++;
  }

  return {
    critico,
    urgente,
    parado,
    ritmoCaiu,
    novoLote,
    saiuDoEncarte,
  };
}

export const calcularContadoresAlertas = calcularAlertCounts;
export const calcularContadoresKpi = calcularKpiCounts;

/**
 * Filtra e ordena a lista de lotes segundo os parâmetros da barra de filtros
 */
export function filtrarLotes(
  lotes: ValidadeLoteCalculado[],
  params: ValidadeFilterParams
): ValidadeLoteCalculado[] {
  const busca = (params.busca || "").toLowerCase().trim();

  const filtrados = lotes.filter((l) => {
    // 1. Busca textual (código, descrição ou comprador)
    if (busca) {
      const matchCod = l.codprod.toLowerCase().includes(busca);
      const matchDesc = l.descricao.toLowerCase().includes(busca);
      const matchComp = l.nomeComprador.toLowerCase().includes(busca);
      if (!matchCod && !matchDesc && !matchComp) return false;
    }

    // 2. Filtro Rápido Principal
    if (params.filtroRapido === "critico") {
      if (!(l.diasParaVencer >= 0 && l.diasParaVencer <= 30 && l.escoaTempoPercent < 60)) {
        return false;
      }
    } else if (params.filtroRapido === "vence_7d") {
      if (!(l.diasParaVencer >= 0 && l.diasParaVencer <= 7)) {
        return false;
      }
    } else if (params.filtroRapido === "vai_sobrar") {
      if (!(l.escoaTempoPercent < 60 && !l.isVencido)) {
        return false;
      }
    } else if (params.filtroRapido === "parado" || params.filtroRapido === "sem_vendas_3m") {
      if (!(l.isSemVenda && l.diasParaVencer >= 0 && l.diasParaVencer <= 90)) {
        return false;
      }
    }

    // 3. Faixa de Vencimento
    if (params.faixaVencimento && params.faixaVencimento !== "todas") {
      if (l.faixaVencimento !== params.faixaVencimento) return false;
    }

    // 4. Faixa de Escoamento
    if (params.faixaEscoaTempo && params.faixaEscoaTempo !== "todas") {
      if (l.faixaEscoaTempo !== params.faixaEscoaTempo) return false;
    }

    // 5. Faixa de Giro no Mês
    if (params.faixaGiroMes && params.faixaGiroMes !== "todas") {
      if (l.faixaGiroMes !== params.faixaGiroMes) return false;
    }

    // 6. Faixa de Cobertura
    if (params.faixaCobertura && params.faixaCobertura !== "todas") {
      if (l.faixaCobertura !== params.faixaCobertura) return false;
    }

    // 7. Ritmo do Mês
    if (params.ritmoMes && params.ritmoMes !== "todas") {
      if (l.ritmoMesStatus !== params.ritmoMes) return false;
    }

    // 8. No Encarte
    if (params.noEncarte === "sim" && !l.noEncarte) return false;
    if (params.noEncarte === "nao" && l.noEncarte) return false;

    // 9. Comprador
    if (params.comprador && params.comprador !== "todos") {
      if (
        l.codcomprador !== params.comprador &&
        l.nomeComprador !== params.comprador
      ) {
        return false;
      }
    }

    return true;
  });

  // Ordenação
  const ord = params.ordenacao || "critico_primeiro";

  return filtrados.sort((a, b) => {
    if (ord === "critico_primeiro") {
      // Vencidos primeiro
      if (a.isVencido && !b.isVencido) return -1;
      if (!a.isVencido && b.isVencido) return 1;

      // Depois críticos (<= 30d e < 60%)
      const aCrit = a.diasParaVencer <= 30 && a.escoaTempoPercent < 60 ? 1 : 0;
      const bCrit = b.diasParaVencer <= 30 && b.escoaTempoPercent < 60 ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;

      // Depois menor escoamento
      if (a.escoaTempoPercent !== b.escoaTempoPercent) {
        return a.escoaTempoPercent - b.escoaTempoPercent;
      }

      // Depois menos dias para vencer
      if (a.diasParaVencer !== b.diasParaVencer) {
        return a.diasParaVencer - b.diasParaVencer;
      }

      return b.estoque - a.estoque;
    }

    if (ord === "escoa_tempo_asc") {
      return a.escoaTempoPercent - b.escoaTempoPercent;
    }

    if (ord === "vencimento_asc") {
      return a.diasParaVencer - b.diasParaVencer;
    }

    if (ord === "estoque_desc") {
      return b.estoque - a.estoque;
    }

    if (ord === "nome_asc") {
      return a.descricao.localeCompare(b.descricao);
    }

    return 0;
  });
}

/**
 * Formata o ritmo de vendas diário com vírgula decimal no padrão brasileiro (ex: 0,54 ou 2)
 */
export function formatRitmoBR(ritmo: number): string {
  if (ritmo === 0 || isNaN(ritmo)) return "0";
  const str = ritmo.toFixed(2).replace(".", ",");
  return str.replace(/,00$/, "").replace(/,(\d)0$/, ",$1");
}

/**
 * Gera a explicação de sobra em uma única linha para o balão (tooltip)
 *
 * Regras:
 * - Exemplo com sobra: "Em 23 dias, no ritmo de 0,54 un/dia, vende ~12 un. Sobram ~215 un."
 * - Venda zero nos 3 meses: "Sem venda nos últimos 3 meses (ritmo 0 un/dia). Em X dias, todo o estoque de Y un deve sobrar." (mostra 'sem venda' e não divide por zero)
 * - Escoa 100%: "Em X dias, no ritmo de Y un/dia, vende todo o estoque de Z un (escoa 100%)." (NÃO mostra 'sobra')
 * - Vencido: "Lote vencido há X dias. Todo o estoque de Y un sobrou."
 */
export function gerarExplicacaoSobraLinha(lote: ValidadeLoteCalculado): string {
  const estoque = lote.estoque;
  const dias = lote.diasParaVencer;
  const ritmoStr = formatRitmoBR(lote.ritmoAtualDia);

  // 1. Caso Vencido (< 0 dias)
  if (lote.isVencido || dias < 0) {
    const diasAtras = Math.abs(dias);
    return `Lote vencido há ${diasAtras} dia${diasAtras === 1 ? "" : "s"}. Todo o estoque de ${estoque} un sobrou.`;
  }

  // 2. Caso Venda Zero nos 3 meses fechados (sem venda)
  // Regra: "Lote com venda zero nos 3 meses mostra 'sem venda' e não divide por zero."
  if (lote.isSemVenda || lote.mediaMensalFechada === 0 || lote.ritmoAtualDia === 0) {
    if (dias === 0) {
      return `Sem venda nos últimos meses (ritmo 0 un/dia). Vence hoje e todo o estoque de ${estoque} un deve sobrar.`;
    }
    const diasTxt = dias === 1 ? "Em 1 dia" : `Em ${dias} dias`;
    return `Sem venda nos últimos meses (ritmo 0 un/dia). ${diasTxt}, todo o estoque de ${estoque} un deve sobrar.`;
  }

  // 3. Caso Histórico Ausente (todos os 3 meses com null)
  const semDadosHistorico =
    lote.vendaM1Raw === null &&
    lote.vendaM2Raw === null &&
    lote.vendaM3Raw === null;
  if (semDadosHistorico) {
    const diasTxt = dias === 1 ? "Em 1 dia" : `Em ${dias} dias`;
    return `Sem dados de vendas nos últimos meses. ${diasTxt}, estoque de ${estoque} un pode sobrar.`;
  }

  // 4. Caso Escoa 100% (sobra 0)
  // Regra: "Lote que escoa 100% não mostra 'sobra'."
  if (lote.escoaTempoPercent >= 100 || lote.sobraPrevistaUnidades <= 0) {
    const diasTxt = dias === 1 ? "Em 1 dia" : `Em ${dias} dias`;
    return `${diasTxt}, no ritmo de ${ritmoStr} un/dia, vende todo o estoque de ${estoque} un (escoa 100%).`;
  }

  // 5. Caso Normal com Previsão de Sobra
  // Exemplo do prompt: "Em 23 dias, no ritmo de 0,54 un/dia, vende ~12 un. Sobram ~215 un."
  const vendaPrevista = Math.round(lote.ritmoAtualDia * Math.max(0, dias));
  const sobraPrevista = Math.round(lote.sobraPrevistaUnidades);

  if (dias === 0) {
    return `Vence hoje. No ritmo de ${ritmoStr} un/dia, vende ~${vendaPrevista} un. Sobram ~${sobraPrevista} un.`;
  }

  const diasTxt = dias === 1 ? "Em 1 dia" : `Em ${dias} dias`;
  return `${diasTxt}, no ritmo de ${ritmoStr} un/dia, vende ~${vendaPrevista} un. Sobram ~${sobraPrevista} un.`;
}

/**
 * Gera os dados completos da seção "Por que vai sobrar" para o modal de detalhe
 */
export function gerarDiagnosticoSobraCompleto(
  lote: ValidadeLoteCalculado
): ValidadeDiagnosticoSobra {
  const estoque = lote.estoque;
  const dias = lote.diasParaVencer;
  const isEscoa100 = lote.escoaTempoPercent >= 100 || lote.sobraPrevistaUnidades <= 0;
  const isSemVenda = lote.isSemVenda || lote.mediaMensalFechada === 0;
  const ritmoStr = formatRitmoBR(lote.ritmoAtualDia);
  const mediaStr = lote.mediaMensalFechada.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const vendaPrevista = Math.round(lote.ritmoAtualDia * Math.max(0, dias));
  const sobraPrevista = Math.round(lote.sobraPrevistaUnidades);

  const mesesFechados = [
    {
      rotulo: "M-3",
      subtitulo: "3 meses atrás",
      valor: lote.vendaM3Raw !== undefined ? lote.vendaM3Raw : lote.vendaM3,
      textoFormatado:
        lote.vendaM3Raw === null
          ? "sem dados"
          : `${lote.vendaM3} un`,
      semDados: lote.vendaM3Raw === null,
    },
    {
      rotulo: "M-2",
      subtitulo: "2 meses atrás",
      valor: lote.vendaM2Raw !== undefined ? lote.vendaM2Raw : lote.vendaM2,
      textoFormatado:
        lote.vendaM2Raw === null
          ? "sem dados"
          : `${lote.vendaM2} un`,
      semDados: lote.vendaM2Raw === null,
    },
    {
      rotulo: "M-1",
      subtitulo: "mês passado",
      valor: lote.vendaM1Raw !== undefined ? lote.vendaM1Raw : lote.vendaM1,
      textoFormatado:
        lote.vendaM1Raw === null
          ? "sem dados"
          : `${lote.vendaM1} un`,
      semDados: lote.vendaM1Raw === null,
    },
    {
      rotulo: "Mês Atual",
      subtitulo: "mês em curso",
      valor: lote.vendaMesAtualRaw !== undefined ? lote.vendaMesAtualRaw : lote.vendaMesAtual,
      textoFormatado:
        lote.vendaMesAtualRaw === null
          ? "sem dados"
          : `${lote.vendaMesAtual} un`,
      semDados: lote.vendaMesAtualRaw === null,
    },
  ];

  // Cálculo escrito em frases simples, sem fórmulas
  let explicacaoSimples = "";
  if (lote.isVencido) {
    const diasAtras = Math.abs(dias);
    explicacaoSimples = `Este lote venceu há ${diasAtras} dia${diasAtras === 1 ? "" : "s"}. Como a data de validade já expirou, todo o estoque restante de ${estoque} unidades no centro de distribuição sobrou e requer descarte ou devolução imediata.`;
  } else if (isSemVenda) {
    explicacaoSimples = `Este produto não registrou nenhuma venda no histórico recente (sem venda). Com o ritmo diário zerado, todo o estoque atual de ${estoque} unidades deverá sobrar ao final dos ${dias} dias até o vencimento se nenhuma ação comercial for realizada.`;
  } else if (isEscoa100) {
    explicacaoSimples = `Com base no histórico recente de vendas (mês atual e últimos meses), este produto vende em média ${mediaStr} unidades por mês (${ritmoStr} unidades por dia). Nos ${dias} dias até a validade, a demanda prevista de cerca de ${vendaPrevista} unidades supera o estoque atual de ${estoque} unidades, portanto todo o lote deve ser vendido a tempo (100% escoado).`;
  } else {
    explicacaoSimples = `Com base no histórico recente de vendas (mês atual e últimos meses), este produto vende em média ${mediaStr} unidades por mês, o que dá um ritmo de ${ritmoStr} unidades por dia. Como faltam ${dias} dias para o lote vencer, a previsão é vender cerca de ${vendaPrevista} unidades. Como o estoque atual no CD é de ${estoque} unidades, sobram cerca de ${sobraPrevista} unidades sem vender até a data de validade (${lote.escoaTempoPercent}% escoado).`;
  }

  const avisoIrregularidade = lote.vendaIrregular
    ? "As vendas oscilaram bastante nos últimos 3 meses (venda irregular: um mês zerado ou 3x maior que outro). Por isso, o ritmo real de saída e a previsão de sobra podem variar."
    : null;

  const titulo = isEscoa100 ? "Previsão de Saída do Lote" : "Por que vai sobrar?";

  return {
    titulo,
    resumoLinha: gerarExplicacaoSobraLinha(lote),
    explicacaoSimples,
    mesesFechados,
    mediaMensalFechada: lote.mediaMensalFechada,
    ritmoAtualDia: lote.ritmoAtualDia,
    estoque,
    diasParaVencer: dias,
    vendaPrevista,
    sobraPrevista,
    escoaTempoPercent: lote.escoaTempoPercent,
    isSemVenda,
    isEscoa100,
    isVencido: lote.isVencido,
    vendaIrregular: lote.vendaIrregular,
    avisoIrregularidade,
    multiplicadorEsforco: lote.multiplicadorEsforco ?? null,
    nivelEsforco: lote.nivelEsforco ?? "normal",
    recomendacaoComercial: lote.recomendacaoComercial || "",
    prejuizoPrevistoSobra: lote.prejuizoPrevistoSobra ?? lote.valorEmRisco ?? 0,
    vendaEsperadaMesAtual: lote.vendaEsperadaMesAtual ?? 0,
  };
}
