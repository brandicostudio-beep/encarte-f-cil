import { describe, it, expect } from "vitest";
import type { EncarteProduct } from "@/types/encarte";
import {
  toMidnight,
  parseValidityDate,
  getDaysToExpiry,
  getExpiryUrgency,
  getDaysSinceRegistration,
  extractStockQuantity,
  parsePriceToNumber,
  calculateStockAnalytics,
  calculateTurnoverExecutiveSummary,
  applyQuickDiscount,
  exportStockTurnoverCsv,
} from "./stock-turnover-analytics";

describe("stock-turnover-analytics - Validade e Giro de Estoque Administrativo", () => {
  const baseProduct: EncarteProduct = {
    id: "prod-1",
    code: "12345",
    name: "ARROZ TIPO 1 5KG",
    packaging: "PACOTE 1X5 KG",
    validity: "22/11/2026",
    price: "24,90",
    unit: "UND",
    stock: "50 UND",
    badge: "nenhum",
    image: "https://example.com/arroz.jpg",
    included: true,
  };

  const fixedRefDate = new Date("2026-11-17T12:00:00"); // 17 de novembro de 2026

  describe("1. Funções Auxiliares de Datas e Números", () => {
    it("parseValidityDate converte datas em formato brasileiro dd/mm/aaaa", () => {
      const d = parseValidityDate("22/11/2026");
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(10); // Novembro é índice 10
      expect(d?.getDate()).toBe(22);
    });

    it("getDaysToExpiry calcula corretamente dias restantes até o vencimento", () => {
      // 22/11/2026 em relação a 17/11/2026 são exatamente 5 dias
      const days = getDaysToExpiry("22/11/2026", fixedRefDate);
      expect(days).toBe(5);

      // 15/11/2026 já venceu há 2 dias (-2)
      const expiredDays = getDaysToExpiry("15/11/2026", fixedRefDate);
      expect(expiredDays).toBe(-2);
    });

    it("getDaysSinceRegistration calcula dias desde o cadastro", () => {
      // Cadastrado em 12/11/2026 e referência em 17/11/2026 = 5 dias
      const days = getDaysSinceRegistration("2026-11-12T08:00:00.000Z", fixedRefDate);
      expect(days).toBe(5);
    });

    it("extractStockQuantity extrai números e somas matemáticas", () => {
      expect(extractStockQuantity("50 UND")).toBe(50);
      expect(extractStockQuantity("80+53")).toBe(133);
      expect(extractStockQuantity("12,5 KG")).toBe(12.5);
      expect(extractStockQuantity(40)).toBe(40);
      expect(extractStockQuantity("")).toBe(0);
      expect(extractStockQuantity(null)).toBe(0);
    });

    it("parsePriceToNumber converte formatos de moeda brasileiros", () => {
      expect(parsePriceToNumber("24,90")).toBe(24.9);
      expect(parsePriceToNumber("R$ 1.250,50")).toBe(1250.5);
      expect(parsePriceToNumber(19.99)).toBe(19.99);
      expect(parsePriceToNumber("")).toBe(0);
    });
  });

  describe("2. Gatilhos Obrigatórios de Regras de Negócio", () => {
    it("GATILHO 1: Dispara notificação crítica quando faltar 5 dias ou menos para vencer", () => {
      // Validade: 22/11/2026 (5 dias a contar de 17/11/2026)
      const product: EncarteProduct = {
        ...baseProduct,
        validity: "22/11/2026",
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.daysToExpiry).toBe(5);
      expect(analytics.isExpiringIn5DaysOrLess).toBe(true);
      expect(analytics.criticality).toBe("critico");

      const notif = analytics.notifications.find((n) => n.id === "critical-expiry-5d");
      expect(notif).toBeDefined();
      expect(notif?.title).toContain("5 dia");
      expect(notif?.message).toContain("Faltam apenas 5 dia(s) para o produto vencer");
    });

    it("SEMÁFORO DE VALIDADE (≤ 5 dias): classifica corretamente Vermelho (0-1d), Laranja (2-3d) e Amarelo (4-5d)", () => {
      // 0 a 1 dia: VERMELHO
      const urgency1 = getExpiryUrgency("18/11/2026", fixedRefDate); // 1 dia
      expect(urgency1.color).toBe("vermelho");
      expect(urgency1.level).toBe("vermelho");
      expect(urgency1.badgeText).toContain("AMANHÃ");

      const urgency0 = getExpiryUrgency("17/11/2026", fixedRefDate); // 0 dias (hoje)
      expect(urgency0.color).toBe("vermelho");
      expect(urgency0.badgeText).toContain("HOJE");

      // 2 a 3 dias: LARANJA
      const urgency2 = getExpiryUrgency("19/11/2026", fixedRefDate); // 2 dias
      expect(urgency2.color).toBe("laranja");
      expect(urgency2.level).toBe("laranja");
      expect(urgency2.badgeText).toContain("2d");

      const urgency3 = getExpiryUrgency("20/11/2026", fixedRefDate); // 3 dias
      expect(urgency3.color).toBe("laranja");
      expect(urgency3.badgeText).toContain("3d");

      // 4 a 5 dias: AMARELO
      const urgency4 = getExpiryUrgency("21/11/2026", fixedRefDate); // 4 dias
      expect(urgency4.color).toBe("amarelo");
      expect(urgency4.level).toBe("amarelo");
      expect(urgency4.badgeText).toContain("4d");

      const urgency5 = getExpiryUrgency("22/11/2026", fixedRefDate); // 5 dias
      expect(urgency5.color).toBe("amarelo");
      expect(urgency5.badgeText).toContain("5d");

      // > 5 dias: Normal
      const urgency6 = getExpiryUrgency("23/11/2026", fixedRefDate); // 6 dias
      expect(urgency6.color).toBe("cinza");
      expect(urgency6.level).toBe("normal");
    });

    it("REGRA PROPORCIONAL (Cenário 1): 700 un em estoque, vendeu 50, vence em 1 semana (7d) -> ALERTA VERMELHO (Não vai conseguir vender)", () => {
      // Cadastrado há 5 dias (12/11/2026), inicial 750, atual 700 (50 vendas em 5d = 10 un/dia)
      // Vence em 7 dias (24/11/2026) -> precisa de 70 dias para zerar, sobram ~630 un no vencimento
      const product: EncarteProduct = {
        ...baseProduct,
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 750,
        currentStockQuantity: 700,
        stock: "700 UND",
        validity: "24/11/2026", // 7 dias a partir de 17/11/2026
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.daysToExpiry).toBe(7);
      expect(analytics.expiryUrgency.color).toBe("vermelho");
      expect(analytics.expiryUrgency.level).toBe("vermelho_sobra");
      expect(analytics.expiryUrgency.badgeText).toContain("Não vai vender a tempo");
      expect(analytics.expiryUrgency.badgeText).toContain("630 un sobra");
      expect(analytics.expiryUrgency.projectedSurplusAtExpiry).toBe(630);
      expect(analytics.criticality).toBe("critico");
      expect(analytics.summaryBadge?.variant).toBe("destructive");
      expect(analytics.summaryBadge?.label).toContain("Não vai vender a tempo");
    });

    it("REGRA PROPORCIONAL (Cenário 2): 50 un estoque inicial, vendeu 20, resta 30, vence em 5 dias -> ALERTA AMARELO (Razoável / Venda Provável)", () => {
      // Cadastrado há 4 dias (13/11/2026), inicial 50, atual 30 (20 vendas em 4d = 5 un/dia)
      // Vence em 5 dias (22/11/2026) -> vende ~25 un em 5 dias, sobram apenas ~5 un (giro provável)
      const product: EncarteProduct = {
        ...baseProduct,
        registeredAt: "2026-11-13T10:00:00.000Z",
        initialStockQuantity: 50,
        currentStockQuantity: 30,
        stock: "30 UND",
        validity: "22/11/2026", // 5 dias
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.daysToExpiry).toBe(5);
      expect(analytics.expiryUrgency.color).toBe("amarelo");
      expect(analytics.expiryUrgency.level).toBe("amarelo_razoavel");
      expect(analytics.expiryUrgency.badgeText).toContain("Razoável");
      expect(analytics.expiryUrgency.badgeText).toContain("Venda provável");
      expect(analytics.expiryUrgency.isLikelyToSellOut).toBe(true);
      expect(analytics.summaryBadge?.variant).toBe("warning");
      expect(analytics.summaryBadge?.label).toContain("Razoável");
    });

    it("REGRA PROPORCIONAL (Cenário 3): Produto com estoque zerado não tem risco de perda por validade -> VERDE SEGURO", () => {
      const product: EncarteProduct = {
        ...baseProduct,
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 50,
        currentStockQuantity: 0,
        stock: "0 UND",
        validity: "19/11/2026", // 2 dias
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.expiryUrgency.color).toBe("verde");
      expect(analytics.expiryUrgency.level).toBe("verde_seguro");
      expect(analytics.expiryUrgency.badgeText).toContain("Saldo Liquidado");
    });

    it("GATILHO 2: Dispara notificação se NÃO vendeu nada durante 5 dias após o cadastro", () => {
      // Cadastrado há 5 dias (12/11/2026), estoque inicial 50, estoque atual 50 (0 vendas)
      const product: EncarteProduct = {
        ...baseProduct,
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 50,
        currentStockQuantity: 50,
        stock: "50 UND",
        validity: "30/12/2026", // Validade longa
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.daysSinceRegistration).toBe(5);
      expect(analytics.quantitySold).toBe(0);
      expect(analytics.hasZeroSales5Days).toBe(true);
      expect(analytics.criticality).toBe("critico");

      const notif = analytics.notifications.find((n) => n.id === "stagnant-5d");
      expect(notif).toBeDefined();
      expect(notif?.title).toContain("Sem Vendas há 5+ Dias");
      expect(notif?.message).toContain("Esse produto não vendeu nada nos últimos 5 dias");
    });

    it("GATILHO 3: Dispara notificação se vendeu apenas 10% ou menos do estoque após 5 dias", () => {
      // Cadastrado há 5 dias (12/11/2026), estoque inicial 100, estoque atual 92 (vendeu 8 un = 8% <= 10%)
      const product: EncarteProduct = {
        ...baseProduct,
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 100,
        currentStockQuantity: 92,
        stock: "92 UND",
        validity: "30/12/2026",
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.daysSinceRegistration).toBe(5);
      expect(analytics.quantitySold).toBe(8);
      expect(analytics.turnoverPercent).toBe(8);
      expect(analytics.hasLowTurnover10Percent).toBe(true);
      expect(analytics.criticality).toBe("alerta");

      const notif = analytics.notifications.find((n) => n.id === "low-turnover-10pct");
      expect(notif).toBeDefined();
      expect(notif?.title).toContain("Giro Muito Baixo (≤ 10%)");
      expect(notif?.message).toContain("Giro Crítico: apenas 8% do estoque vendido em 5 dias");
    });

    it("Cálculo de Capital em Risco e Giro com vendas normais (>10%)", () => {
      // Cadastrado há 5 dias, inicial 100, atual 60 (vendeu 40 = 40% de giro)
      const product: EncarteProduct = {
        ...baseProduct,
        price: "10,00",
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 100,
        currentStockQuantity: 60,
        stock: "60 UND",
        validity: "30/12/2026",
      };

      const analytics = calculateStockAnalytics(product, fixedRefDate);
      expect(analytics.quantitySold).toBe(40);
      expect(analytics.turnoverPercent).toBe(40);
      expect(analytics.capitalAtRisk).toBe(600); // 60 * 10
      expect(analytics.hasZeroSales5Days).toBe(false);
      expect(analytics.hasLowTurnover10Percent).toBe(false);
    });
  });

  describe("3. Sumário Executivo e Ações Rápidas", () => {
    it("calculateTurnoverExecutiveSummary consolida KPIs de múltiplos produtos", () => {
      const p1: EncarteProduct = {
        ...baseProduct,
        id: "p1",
        validity: "22/11/2026", // Faltam 5 dias
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 50,
        currentStockQuantity: 50, // 0 vendas em 5d
        price: "10,00",
      };

      const p2: EncarteProduct = {
        ...baseProduct,
        id: "p2",
        validity: "15/11/2026", // Vencido
        registeredAt: "2026-11-01T10:00:00.000Z",
        initialStockQuantity: 30,
        currentStockQuantity: 10,
        price: "20,00",
      };

      const p3: EncarteProduct = {
        ...baseProduct,
        id: "p3",
        validity: "15/12/2026", // Ok
        registeredAt: "2026-11-12T10:00:00.000Z",
        initialStockQuantity: 100,
        currentStockQuantity: 95, // Vendeu 5% em 5d (baixo giro)
        price: "5,00",
      };

      const summary = calculateTurnoverExecutiveSummary([p1, p2, p3], fixedRefDate);
      expect(summary.totalProducts).toBe(3);
      expect(summary.criticalExpiryCount).toBe(1); // p1
      expect(summary.expiredCount).toBe(1); // p2
      expect(summary.stagnantCount).toBe(1); // p1
      expect(summary.lowTurnoverCount).toBe(1); // p3
      expect(summary.totalCapitalAtRisk).toBeGreaterThan(0);
    });

    it("applyQuickDiscount reduz o preço em percentual e marca selo imperdível", () => {
      const discounted = applyQuickDiscount(baseProduct, 20); // 20% off em R$ 24,90 = 19,92
      expect(discounted.badge).toBe("imperdivel");
      expect(discounted.included).toBe(true);
      expect(discounted.price).toBe("19,92");
    });

    it("exportStockTurnoverCsv gera CSV válido com cabeçalhos e BOM", () => {
      const csv = exportStockTurnoverCsv([baseProduct], fixedRefDate);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Código;Produto;Validade;Dias p/ Vencer");
      expect(csv).toContain("12345");
      expect(csv).toContain("ARROZ TIPO 1 5KG");
    });
  });
});
