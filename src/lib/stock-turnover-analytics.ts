import type { EncarteProduct, BadgeType } from "@/types/encarte";
import { evaluateStockExpression, formatPrice } from "./parse-product";

export interface StockHistoryEntry {
  date: string;
  quantity: number;
  source: "cadastro" | "pdf" | "manual";
  obs?: string;
}

export interface TurnoverNotification {
  id: string;
  level: "critico" | "alerta" | "atencao" | "info";
  title: string;
  message: string;
  actionSuggestion?: string;
}

export type ExpiryUrgencyLevel = "vencido" | "vermelho" | "laranja" | "amarelo" | "normal";

export interface ExpiryUrgencyInfo {
  level: ExpiryUrgencyLevel;
  color: "vermelho" | "laranja" | "amarelo" | "cinza";
  daysToExpiry: number | null;
  label: string;
  badgeText: string;
  pillClass: string;
  rowClass: string;
  borderClass: string;
  description: string;
}

export interface ProductStockAnalytics {
  productId: string;
  code: string;
  name: string;
  validity: string;
  daysToExpiry: number | null;
  isExpired: boolean;
  isExpiringIn5DaysOrLess: boolean;
  expiryUrgency: ExpiryUrgencyInfo;

  registeredAt: string;
  daysSinceRegistration: number;

  initialStock: number;
  currentStock: number;
  quantitySold: number;
  turnoverPercent: number; // 0 a 100
  turnoverRatePerDay: number; // unidades/dia
  estimatedDaysToZeroStock: number | null;

  unitPrice: number;
  capitalAtRisk: number; // currentStock * unitPrice

  criticality: "critico" | "alerta" | "atencao" | "ok";

  // Gatilhos de regras de negócio específicas
  hasZeroSales5Days: boolean;
  hasLowTurnover10Percent: boolean;

  notifications: TurnoverNotification[];

  summaryBadge: {
    label: string;
    variant: "destructive" | "warning" | "default" | "secondary" | "outline";
    tooltip: string;
  };
}

export interface TurnoverExecutiveSummary {
  totalProducts: number;
  criticalExpiryCount: number; // <= 5 dias
  redExpiryCount: number;      // 0 a 1 dia (Vermelho)
  orangeExpiryCount: number;   // 2 a 3 dias (Laranja)
  yellowExpiryCount: number;   // 4 a 5 dias (Amarelo)
  expiredCount: number;        // < 0 dias
  stagnantCount: number;       // 5+ dias sem vender nada
  lowTurnoverCount: number;    // 5+ dias vendendo <= 10%
  totalCapitalAtRisk: number;  // R$ em risco
  totalCurrentStock: number;   // Peças atuais em estoque
  totalQuantitySold: number;   // Peças vendidas desde o cadastro
  averageTurnoverPercent: number; // Giro médio %
}

/**
 * Normaliza uma data para meia-noite (00:00:00.000) no horário local
 */
export function toMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Converte string de validade (dd/mm/aaaa ou aaaa-mm-dd) em objeto Date normalizado para meia-noite
 */
export function parseValidityDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  let day: number, month: number, year: number;

  const brMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    day = parseInt(brMatch[1] ?? "0", 10);
    month = parseInt(brMatch[2] ?? "0", 10) - 1;
    year = parseInt(brMatch[3] ?? "0", 10);
    if (year < 100) year += 2000;
  } else {
    const isoMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1] ?? "0", 10);
      month = parseInt(isoMatch[2] ?? "0", 10) - 1;
      day = parseInt(isoMatch[3] ?? "0", 10);
    } else {
      return null;
    }
  }

  const d = new Date(year, month, day, 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calcula a quantidade de dias restantes até o vencimento.
 * Se já venceu, retorna valor negativo (ex: -2 dias).
 * Se data for inválida ou vazia, retorna null.
 */
export function getDaysToExpiry(validityStr?: string | null, referenceDate: Date = new Date()): number | null {
  const expiryDate = parseValidityDate(validityStr);
  if (!expiryDate) return null;

  const refMidnight = toMidnight(referenceDate);
  const diffMs = expiryDate.getTime() - refMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Classifica a urgência de vencimento nas cores Vermelho / Laranja / Amarelo
 * quando faltam 5 dias ou menos para vencer:
 * - 0 a 1 dia: VERMELHO (Crítico - Hoje ou amanhã)
 * - 2 a 3 dias: LARANJA (Urgente - Ação de queima)
 * - 4 a 5 dias: AMARELO (Atenção - Alerta de giro)
 */
export function getExpiryUrgency(
  validityStr?: string | null,
  referenceDate: Date = new Date()
): ExpiryUrgencyInfo {
  const days = getDaysToExpiry(validityStr, referenceDate);

  if (days === null) {
    return {
      level: "normal",
      color: "cinza",
      daysToExpiry: null,
      label: "Sem data",
      badgeText: "Sem data",
      pillClass: "bg-neutral-100 text-neutral-600 border-neutral-300",
      rowClass: "",
      borderClass: "border-transparent",
      description: "Data de validade não informada",
    };
  }

  if (days < 0) {
    const pastDays = Math.abs(days);
    return {
      level: "vencido",
      color: "vermelho",
      daysToExpiry: days,
      label: "Vencido",
      badgeText: `🚫 VENCIDO (${pastDays}d)`,
      pillClass: "bg-red-800 text-white border-red-900 font-black shadow-2xs",
      rowClass: "bg-red-100/60 border-l-4 border-l-red-800",
      borderClass: "border-red-800",
      description: `Produto vencido há ${pastDays} dia(s). Proibida a comercialização.`,
    };
  }

  // 0 a 1 dia: VERMELHO (Crítico Máximo)
  if (days <= 1) {
    return {
      level: "vermelho",
      color: "vermelho",
      daysToExpiry: days,
      label: "Vermelho (Crítico)",
      badgeText: days === 0 ? "🚨 Vence HOJE!" : "🚨 Vence AMANHÃ (1d)",
      pillClass: "bg-red-600 text-white border-red-700 font-black animate-pulse shadow-2xs",
      rowClass: "bg-red-50/80 border-l-4 border-l-red-600",
      borderClass: "border-red-600",
      description: `Urgência Máxima (Vermelho): resta(m) apenas ${days} dia(s) para vencer. Liquidação imediata!`,
    };
  }

  // 2 a 3 dias: LARANJA (Urgente)
  if (days <= 3) {
    return {
      level: "laranja",
      color: "laranja",
      daysToExpiry: days,
      label: "Laranja (Urgente)",
      badgeText: `🔥 Vence em ${days}d`,
      pillClass: "bg-orange-500 text-white border-orange-600 font-bold shadow-2xs",
      rowClass: "bg-orange-50/70 border-l-4 border-l-orange-500",
      borderClass: "border-orange-500",
      description: `Urgência Alta (Laranja): restam ${days} dias para vencer. Ação de queima recomendada.`,
    };
  }

  // 4 a 5 dias: AMARELO (Atenção)
  if (days <= 5) {
    return {
      level: "amarelo",
      color: "amarelo",
      daysToExpiry: days,
      label: "Amarelo (Atenção)",
      badgeText: `⚠️ Vence em ${days}d`,
      pillClass: "bg-yellow-400 text-yellow-950 border-yellow-500 font-bold shadow-2xs",
      rowClass: "bg-yellow-50/60 border-l-4 border-l-yellow-400",
      borderClass: "border-yellow-400",
      description: `Atenção (Amarelo): restam ${days} dias para vencer. Monitorar giro de estoque.`,
    };
  }

  return {
    level: "normal",
    color: "cinza",
    daysToExpiry: days,
    label: "Normal",
    badgeText: `${days} dias`,
    pillClass: "bg-neutral-100 text-neutral-700 border-neutral-300",
    rowClass: "",
    borderClass: "border-transparent",
    description: `Validade regular (${days} dias restantes).`,
  };
}

/**
 * Calcula a quantidade de dias transcorridos desde o cadastro do produto
 */
export function getDaysSinceRegistration(registeredAt?: string | null, referenceDate: Date = new Date()): number {
  if (!registeredAt) return 0;
  const regDate = new Date(registeredAt);
  if (isNaN(regDate.getTime())) return 0;

  const regMidnight = toMidnight(regDate);
  const refMidnight = toMidnight(referenceDate);
  const diffMs = refMidnight.getTime() - regMidnight.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Extrai a quantidade numérica de estoque a partir de string ou número.
 * Suporta expressões matemáticas como "80+53" e sufixos de unidades (ex: "50 UND").
 */
export function extractStockQuantity(stockInput?: string | number | null): number {
  if (typeof stockInput === "number") {
    return isNaN(stockInput) || stockInput < 0 ? 0 : stockInput;
  }
  if (!stockInput) return 0;

  const raw = String(stockInput).trim();
  if (!raw) return 0;

  // Se contiver expressão matemática (ex: "80+53"), avalia primeiro
  const evaluated = evaluateStockExpression(raw);
  const targetStr = evaluated || raw;

  // Extrai o primeiro número (inteiro ou decimal com vírgula ou ponto)
  const match = targetStr.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;

  const numStr = match[1].replace(",", ".");
  const val = parseFloat(numStr);
  return isNaN(val) || val < 0 ? 0 : val;
}

/**
 * Converte string de preço (ex: "4,99" ou "R$ 10,50") em número de ponto flutuante
 */
export function parsePriceToNumber(priceInput?: string | number | null): number {
  if (typeof priceInput === "number") {
    return isNaN(priceInput) || priceInput < 0 ? 0 : priceInput;
  }
  if (!priceInput) return 0;
  const raw = String(priceInput).replace(/[^\d.,]/g, "").trim();
  if (!raw) return 0;

  // Tratar formato brasileiro "1.250,50" ou "4,99"
  let clean = raw;
  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  const val = parseFloat(clean);
  return isNaN(val) || val < 0 ? 0 : val;
}

/**
 * Analisa o giro de estoque e o status de validade de um produto individual.
 */
export function calculateStockAnalytics(
  product: EncarteProduct,
  referenceDate: Date = new Date()
): ProductStockAnalytics {
  const currentStock =
    product.currentStockQuantity !== undefined
      ? product.currentStockQuantity
      : extractStockQuantity(product.stock);

  // Se não houver estoque inicial registrado, assume o estoque atual como ponto de partida
  const initialStock =
    product.initialStockQuantity !== undefined && product.initialStockQuantity > 0
      ? product.initialStockQuantity
      : currentStock;

  // Quantidade vendida: se o estoque diminuiu, a diferença foram vendas.
  // Se aumentou (reabastecimento), quantidade vendida mínima é 0.
  const quantitySold = Math.max(0, initialStock - currentStock);

  // Giro percentual do estoque inicial
  const turnoverPercent =
    initialStock > 0 ? Math.min(100, Math.round((quantitySold / initialStock) * 100 * 10) / 10) : 0;

  // Data de cadastro e dias transcorridos
  const registeredAt = product.registeredAt || new Date().toISOString();
  const daysSinceRegistration = getDaysSinceRegistration(registeredAt, referenceDate);

  // Dias até o vencimento
  const daysToExpiry = getDaysToExpiry(product.validity, referenceDate);
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
  const isExpiringIn5DaysOrLess = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 5;
  const expiryUrgency = getExpiryUrgency(product.validity, referenceDate);

  // Velocidade de vendas (unidades / dia)
  const turnoverRatePerDay =
    daysSinceRegistration > 0
      ? Math.round((quantitySold / daysSinceRegistration) * 10) / 10
      : quantitySold;

  // Estimativa de dias para zerar o estoque restante no ritmo atual
  const estimatedDaysToZeroStock =
    currentStock <= 0
      ? 0
      : turnoverRatePerDay > 0
      ? Math.ceil(currentStock / turnoverRatePerDay)
      : null;

  // Preço unitário e capital financeiro em risco
  const unitPrice = parsePriceToNumber(product.price || product.precoManuscrito);
  const capitalAtRisk = Math.round(currentStock * unitPrice * 100) / 100;

  // ==========================================
  // GATILHOS DE REGRAS DE NEGÓCIO EXIGIDOS:
  // ==========================================
  // 1. Não vendeu nada durante 5 dias (daysSinceRegistration >= 5 && quantitySold === 0)
  const hasZeroSales5Days = daysSinceRegistration >= 5 && quantitySold === 0 && currentStock > 0;

  // 2. Vendeu apenas 10% ou menos do estoque após 5 dias
  const hasLowTurnover10Percent =
    daysSinceRegistration >= 5 && quantitySold > 0 && turnoverPercent <= 10 && currentStock > 0;

  // Notificações acumuladas
  const notifications: TurnoverNotification[] = [];

  // Alerta de Validade Crítica (<= 5 dias)
  if (isExpired) {
    notifications.push({
      id: "expired",
      level: "critico",
      title: "Produto Vencido",
      message: `Este produto está vencido há ${Math.abs(daysToExpiry!)} dia(s). Não pode ser comercializado.`,
      actionSuggestion: "Retirar da área de venda e registrar perda ou devolução.",
    });
  } else if (isExpiringIn5DaysOrLess) {
    let title = `Vencimento em ${daysToExpiry} dia(s)`;
    let suggestion = "Aplicar desconto de 20% a 30% e destacar como 'Imperdível' no encarte.";

    if (expiryUrgency.color === "vermelho") {
      title = daysToExpiry === 0 ? "🚨 AVISO VERMELHO: Vence HOJE!" : "🚨 AVISO VERMELHO: Vence AMANHÃ (1d)";
      suggestion = "Urgência Máxima! Aplicar queima imediata (-30%) ou retirar do salão.";
    } else if (expiryUrgency.color === "laranja") {
      title = `🔥 AVISO LARANJA: Vence em ${daysToExpiry} dias`;
      suggestion = "Urgência Alta! Aplicar desconto de 20% a 30% com selo Imperdível no encarte.";
    } else if (expiryUrgency.color === "amarelo") {
      title = `⚠️ AVISO AMARELO: Vence em ${daysToExpiry} dias`;
      suggestion = "Atenção de Validade! Acompanhar giro e planejar promoção de queima.";
    }

    notifications.push({
      id: "critical-expiry-5d",
      level: expiryUrgency.color === "vermelho" ? "critico" : expiryUrgency.color === "laranja" ? "alerta" : "atencao",
      title,
      message: `Faltam apenas ${daysToExpiry} dia(s) para o produto vencer. Classificação do Semáforo: ${expiryUrgency.label.toUpperCase()}.`,
      actionSuggestion: suggestion,
    });
  }

  // Notificação Exigida: Não vendeu nada durante 5 dias
  if (hasZeroSales5Days) {
    notifications.push({
      id: "stagnant-5d",
      level: "critico",
      title: "Sem Vendas há 5+ Dias",
      message: `Esse produto não vendeu nada nos últimos ${daysSinceRegistration} dias (Estoque inicial: ${initialStock}, Atual: ${currentStock}).`,
      actionSuggestion: "Verificar posicionamento no ponto de venda e reduzir o preço no encarte.",
    });
  }

  // Notificação Exigida: Vendeu apenas 10% ou menos
  if (hasLowTurnover10Percent) {
    notifications.push({
      id: "low-turnover-10pct",
      level: "alerta",
      title: "Giro Muito Baixo (≤ 10%)",
      message: `Giro Crítico: apenas ${turnoverPercent}% do estoque vendido em ${daysSinceRegistration} dias (${quantitySold} de ${initialStock} unidades).`,
      actionSuggestion: "Acelerar saída com ação promocional 'Leve Mais por Menos' ou desconto de queima.",
    });
  }

  // Alerta de incompatibilidade entre ritmo de giro e dias restantes de validade
  if (
    !isExpired &&
    daysToExpiry !== null &&
    daysToExpiry <= 10 &&
    estimatedDaysToZeroStock !== null &&
    estimatedDaysToZeroStock > daysToExpiry &&
    currentStock > 0
  ) {
    notifications.push({
      id: "risk-of-spoilage",
      level: "alerta",
      title: "Risco de Quebra por Validade",
      message: `No ritmo atual (${turnoverRatePerDay} un/dia), o estoque levará ~${estimatedDaysToZeroStock} dias para esgotar, mas a validade acaba em ${daysToExpiry} dias.`,
      actionSuggestion: "Aumentar a agressividade do preço no encarte para liquidar o saldo restante.",
    });
  }

  // Determinar criticidade global
  let criticality: "critico" | "alerta" | "atencao" | "ok" = "ok";
  if (isExpired || isExpiringIn5DaysOrLess || hasZeroSales5Days) {
    criticality = "critico";
  } else if (hasLowTurnover10Percent || (daysToExpiry !== null && daysToExpiry <= 10)) {
    criticality = "alerta";
  } else if ((daysToExpiry !== null && daysToExpiry <= 15) || (daysSinceRegistration >= 3 && turnoverPercent < 30)) {
    criticality = "atencao";
  } else {
    criticality = "ok";
  }

  // Distintivo Resumido (Badge visual)
  let summaryBadge: ProductStockAnalytics["summaryBadge"];
  if (isExpired) {
    summaryBadge = {
      label: `Vencido (${Math.abs(daysToExpiry!)}d)`,
      variant: "destructive",
      tooltip: "Produto com data de validade expirada",
    };
  } else if (isExpiringIn5DaysOrLess) {
    summaryBadge = {
      label: expiryUrgency.badgeText,
      variant: expiryUrgency.color === "vermelho" ? "destructive" : "warning",
      tooltip: expiryUrgency.description,
    };
  } else if (hasZeroSales5Days) {
    summaryBadge = {
      label: `⚠️ 0 vendas (${daysSinceRegistration}d)`,
      variant: "destructive",
      tooltip: `Produto cadastrado há ${daysSinceRegistration} dias e nenhuma unidade vendida.`,
    };
  } else if (hasLowTurnover10Percent) {
    summaryBadge = {
      label: `📉 Giro ${turnoverPercent}% (${daysSinceRegistration}d)`,
      variant: "warning",
      tooltip: `Apenas ${turnoverPercent}% vendido em ${daysSinceRegistration} dias.`,
    };
  } else if (daysToExpiry !== null && daysToExpiry <= 10) {
    summaryBadge = {
      label: `📅 Vence em ${daysToExpiry}d`,
      variant: "warning",
      tooltip: `Faltam ${daysToExpiry} dias para o vencimento.`,
    };
  } else {
    summaryBadge = {
      label: `✓ Giro ${turnoverPercent}%`,
      variant: "outline",
      tooltip: `Estoque: ${currentStock} / Vendido: ${quantitySold} (${turnoverPercent}%)`,
    };
  }

  return {
    productId: product.id,
    code: product.code,
    name: product.name,
    validity: product.validity,
    daysToExpiry,
    isExpired,
    isExpiringIn5DaysOrLess,
    expiryUrgency,
    registeredAt,
    daysSinceRegistration,
    initialStock,
    currentStock,
    quantitySold,
    turnoverPercent,
    turnoverRatePerDay,
    estimatedDaysToZeroStock,
    unitPrice,
    capitalAtRisk,
    criticality,
    hasZeroSales5Days,
    hasLowTurnover10Percent,
    notifications,
    summaryBadge,
  };
}

/**
 * Calcula o sumário executivo de todos os produtos para os KPIs do painel administrativo
 */
export function calculateTurnoverExecutiveSummary(
  products: EncarteProduct[],
  referenceDate: Date = new Date()
): TurnoverExecutiveSummary {
  let criticalExpiryCount = 0;
  let redExpiryCount = 0;
  let orangeExpiryCount = 0;
  let yellowExpiryCount = 0;
  let expiredCount = 0;
  let stagnantCount = 0;
  let lowTurnoverCount = 0;
  let totalCapitalAtRisk = 0;
  let totalCurrentStock = 0;
  let totalQuantitySold = 0;
  let sumTurnoverPercent = 0;

  for (const p of products) {
    const a = calculateStockAnalytics(p, referenceDate);
    if (a.isExpired) {
      expiredCount++;
    } else if (a.isExpiringIn5DaysOrLess) {
      criticalExpiryCount++;
      if (a.expiryUrgency.color === "vermelho") {
        redExpiryCount++;
      } else if (a.expiryUrgency.color === "laranja") {
        orangeExpiryCount++;
      } else if (a.expiryUrgency.color === "amarelo") {
        yellowExpiryCount++;
      }
    }

    if (a.hasZeroSales5Days) {
      stagnantCount++;
    } else if (a.hasLowTurnover10Percent) {
      lowTurnoverCount++;
    }

    // Capital em risco considera produtos em situação de criticidade ou alerta
    if (a.criticality === "critico" || a.criticality === "alerta") {
      totalCapitalAtRisk += a.capitalAtRisk;
    }

    totalCurrentStock += a.currentStock;
    totalQuantitySold += a.quantitySold;
    sumTurnoverPercent += a.turnoverPercent;
  }

  const averageTurnoverPercent =
    products.length > 0 ? Math.round((sumTurnoverPercent / products.length) * 10) / 10 : 0;

  return {
    totalProducts: products.length,
    criticalExpiryCount,
    redExpiryCount,
    orangeExpiryCount,
    yellowExpiryCount,
    expiredCount,
    stagnantCount,
    lowTurnoverCount,
    totalCapitalAtRisk: Math.round(totalCapitalAtRisk * 100) / 100,
    totalCurrentStock,
    totalQuantitySold,
    averageTurnoverPercent,
  };
}

/**
 * Aplica desconto comercial rápido (ex: 20% ou 30%) e marca selo imperdível
 */
export function applyQuickDiscount(
  product: EncarteProduct,
  discountPercent: number,
  badge: BadgeType = "imperdivel"
): EncarteProduct {
  const currentPrice = parsePriceToNumber(product.price || product.precoManuscrito);
  if (currentPrice <= 0) return product;

  const discounted = currentPrice * (1 - discountPercent / 100);
  const formatted = formatPrice(discounted.toFixed(2));

  return {
    ...product,
    price: formatted || discounted.toFixed(2).replace(".", ","),
    badge,
    included: true, // Garante que o item com queima de preço entra no encarte
  };
}

/**
 * Gera arquivo CSV compatível com Excel brasileiro (separado por ponto e vírgula com BOM UTF-8)
 * para a gerência de loja acompanhar o giro de estoque e validade.
 */
export function exportStockTurnoverCsv(
  products: EncarteProduct[],
  referenceDate: Date = new Date()
): string {
  const headers = [
    "Código",
    "Produto",
    "Validade",
    "Dias p/ Vencer",
    "Status Validade",
    "Data Cadastro",
    "Dias Ativo",
    "Estoque Inicial",
    "Estoque Atual",
    "Qtd Vendida",
    "% Giro",
    "Preço Unitário (R$)",
    "Risco Financeiro (R$)",
    "Status do Giro",
    "Diagnóstico / Notificação",
  ];

  const rows = products.map((p) => {
    const a = calculateStockAnalytics(p, referenceDate);

    let statusValidade = "Normal";
    if (a.isExpired) statusValidade = "VENCIDO";
    else if (a.isExpiringIn5DaysOrLess) statusValidade = `CRÍTICO (${a.daysToExpiry}d)`;
    else if (a.daysToExpiry !== null && a.daysToExpiry <= 10) statusValidade = `Alerta (${a.daysToExpiry}d)`;

    let statusGiro = "Normal";
    if (a.hasZeroSales5Days) statusGiro = "PARADO (0 vendas em 5d+)";
    else if (a.hasLowTurnover10Percent) statusGiro = `BAIXO (≤10% em ${a.daysSinceRegistration}d)`;

    const diagnostico = a.notifications.map((n) => `${n.title}: ${n.message}`).join(" | ");

    return [
      `"${p.code}"`,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${p.validity || ""}"`,
      a.daysToExpiry !== null ? String(a.daysToExpiry) : '""',
      `"${statusValidade}"`,
      `"${a.registeredAt.slice(0, 10)}"`,
      String(a.daysSinceRegistration),
      String(a.initialStock),
      String(a.currentStock),
      String(a.quantitySold),
      `"${a.turnoverPercent.toFixed(1).replace(".", ",")}%"`,
      `"${a.unitPrice.toFixed(2).replace(".", ",")}"`,
      `"${a.capitalAtRisk.toFixed(2).replace(".", ",")}"`,
      `"${statusGiro}"`,
      `"${diagnostico.replace(/"/g, '""')}"`,
    ].join(";");
  });

  // BOM UTF-8 (\uFEFF) para abrir com acentuação correta no Excel brasileiro
  return "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
}
