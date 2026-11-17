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
export function classifyFaixaVencimento(dias: number): FaixaVencimento {
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

  const estoque = Math.max(0, raw.qtdisp_wms || 0);
  const precoVenda = Math.max(0, raw.preco_venda || 0);

  // Vendas
  const vendaMesAtual = Math.max(0, raw.qtvendmes || 0);
  const vendaM1 = Math.max(0, raw.qtvendmes1 || 0);
  const vendaM2 = Math.max(0, raw.qtvendmes2 || 0);
  const vendaM3 = Math.max(0, raw.qtvendmes3 || 0);

  // Média mensal dos 3 meses fechados (mês com zero conta como zero)
  const somaFechada = vendaM1 + vendaM2 + vendaM3;
  const mediaMensalFechada = Math.round((somaFechada / 3) * 10) / 10;
  const isSemVenda = somaFechada === 0;

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

  // Valor financeiro em risco
  const valorEmRisco = Math.round(precoVenda * sobraPrevistaUnidades * 100) / 100;

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
    precoVenda,
    precoTotalPlanilha: raw.preco_total,
    valorEmRisco,
    vendaMesAtual,
    vendaM1,
    vendaM2,
    vendaM3,
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
    }
  }

  return {
    vencidos,
    ate7d,
    de8a30d,
    de31a60d,
    de61a90d,
    acima90d,
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
    } else if (params.filtroRapido === "parado") {
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
