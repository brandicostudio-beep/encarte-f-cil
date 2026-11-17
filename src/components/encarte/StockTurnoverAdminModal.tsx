import React, { useState, useMemo } from "react";
import type { EncarteProduct } from "@/types/encarte";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  calculateStockAnalytics,
  calculateTurnoverExecutiveSummary,
  exportStockTurnoverCsv,
  type ProductStockAnalytics,
} from "@/lib/stock-turnover-analytics";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Download,
  Search,
  Package,
  CheckCircle2,
  ShieldAlert,
  Flame,
  ArrowRight,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface StockTurnoverAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: EncarteProduct[];
  onUpdateProduct: (product: EncarteProduct) => void;
  onEditProduct?: (product: EncarteProduct) => void;
}

export const StockTurnoverAdminContent: React.FC<{
  products: EncarteProduct[];
  onUpdateProduct: (product: EncarteProduct) => void;
  onEditProduct?: (product: EncarteProduct) => void;
  onClose?: () => void;
}> = ({ products = [], onUpdateProduct, onEditProduct, onClose }) => {
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<
    "todos" | "criticos" | "vencendo5d" | "sem_giro" | "giro_baixo"
  >("todos");

  // Sumário Executivo
  const summary = useMemo(() => {
    return calculateTurnoverExecutiveSummary(products);
  }, [products]);

  // Lista com métricas calculadas
  const analyticsList = useMemo(() => {
    return products.map((p) => ({
      product: p,
      analytics: calculateStockAnalytics(p),
    }));
  }, [products]);

  // Filtragem
  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();

    return analyticsList.filter(({ product, analytics }) => {
      // Filtro de busca
      if (term) {
        const matchCode = (product.code || "").toLowerCase().includes(term);
        const matchName = (product.name || "").toLowerCase().includes(term);
        if (!matchCode && !matchName) return false;
      }

      // Filtro por categoria/tab
      if (filterTab === "criticos") {
        return analytics.criticality === "critico";
      }
      if (filterTab === "vencendo5d") {
        return analytics.isExpiringIn5DaysOrLess || analytics.expiryUrgency.level === "vermelho_sobra";
      }
      if (filterTab === "sem_giro") {
        return analytics.hasZeroSales5Days;
      }
      if (filterTab === "giro_baixo") {
        return analytics.hasLowTurnover10Percent;
      }

      return true;
    });
  }, [analyticsList, search, filterTab]);

  // Download do relatório CSV para Excel
  const handleExportCsv = () => {
    const csv = exportStockTurnoverCsv(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `relatorio-giro-validade-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Alternar inclusão no encarte
  const handleToggleIncluded = (product: EncarteProduct) => {
    onUpdateProduct({ ...product, included: !product.included });
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] space-y-4">
      {/* 1. TOPO: CARDS DE KPI EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI 1: Vencimento <= 5 dias */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFilterTab("vencendo5d")}
          onKeyDown={(e) => e.key === "Enter" && setFilterTab("vencendo5d")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filterTab === "vencendo5d"
              ? "ring-2 ring-red-600 bg-red-50/70 border-red-300"
              : "bg-white hover:bg-neutral-50 border-neutral-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-tight">
              Vence em ≤ 5 dias
            </span>
            <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-700">
              {summary.criticalExpiryCount}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">
              {summary.criticalExpiryCount === 1 ? "produto crítico" : "produtos críticos"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[9px] font-bold flex-wrap">
            <span className="text-red-700 bg-red-100 px-1 py-0.2 rounded border border-red-200">
              🔴 {summary.redExpiryCount} Vermelho (0-1d)
            </span>
            <span className="text-orange-800 bg-orange-100 px-1 py-0.2 rounded border border-orange-200">
              🟠 {summary.orangeExpiryCount} Laranja (2-3d)
            </span>
            <span className="text-amber-900 bg-yellow-100 px-1 py-0.2 rounded border border-yellow-300">
              🟡 {summary.yellowExpiryCount} Amarelo (4-5d)
            </span>
          </div>
          <p className="mt-1 text-[10.5px] text-red-800 font-semibold line-clamp-1">
            Semáforo de Validade ≤ 5 dias
          </p>
        </div>

        {/* KPI 2: Sem vendas há 5+ dias */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFilterTab("sem_giro")}
          onKeyDown={(e) => e.key === "Enter" && setFilterTab("sem_giro")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filterTab === "sem_giro"
              ? "ring-2 ring-amber-600 bg-amber-50/70 border-amber-300"
              : "bg-white hover:bg-neutral-50 border-neutral-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-tight">
              0 Vendas (5d+)
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-800">
              {summary.stagnantCount}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">
              estagnados
            </span>
          </div>
          <p className="mt-1 text-[10.5px] text-amber-800 font-semibold line-clamp-1">
            Não vendeu nada há 5 dias
          </p>
        </div>

        {/* KPI 3: Giro Baixo <= 10% */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFilterTab("giro_baixo")}
          onKeyDown={(e) => e.key === "Enter" && setFilterTab("giro_baixo")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filterTab === "giro_baixo"
              ? "ring-2 ring-orange-600 bg-orange-50/70 border-orange-300"
              : "bg-white hover:bg-neutral-50 border-neutral-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-tight">
              Giro Baixo (≤10%)
            </span>
            <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-orange-800">
              {summary.lowTurnoverCount}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">
              baixa saída
            </span>
          </div>
          <p className="mt-1 text-[10.5px] text-orange-800 font-semibold line-clamp-1">
            Apenas 10% ou menos vendido
          </p>
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS & FILTROS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
        {/* Abas / Filtros Rápidos */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={filterTab === "todos" ? "default" : "outline"}
            onClick={() => setFilterTab("todos")}
            className="text-xs h-8 font-semibold"
          >
            Todos ({products.length})
          </Button>

          <Button
            size="sm"
            variant={filterTab === "criticos" ? "destructive" : "outline"}
            onClick={() => setFilterTab("criticos")}
            className="text-xs h-8 font-semibold"
          >
            🚨 Críticos ({summary.criticalExpiryCount + summary.stagnantCount})
          </Button>

          <Button
            size="sm"
            variant={filterTab === "vencendo5d" ? "default" : "outline"}
            onClick={() => setFilterTab("vencendo5d")}
            className={`text-xs h-8 font-semibold ${
              filterTab === "vencendo5d" ? "bg-red-700 hover:bg-red-800 text-white" : "text-red-700 border-red-200"
            }`}
          >
            ⏰ Vence ≤ 5d ({summary.criticalExpiryCount})
          </Button>

          <Button
            size="sm"
            variant={filterTab === "sem_giro" ? "default" : "outline"}
            onClick={() => setFilterTab("sem_giro")}
            className={`text-xs h-8 font-semibold ${
              filterTab === "sem_giro" ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-amber-800 border-amber-200"
            }`}
          >
            ⚠️ 0 Vendas 5d ({summary.stagnantCount})
          </Button>

          <Button
            size="sm"
            variant={filterTab === "giro_baixo" ? "default" : "outline"}
            onClick={() => setFilterTab("giro_baixo")}
            className={`text-xs h-8 font-semibold ${
              filterTab === "giro_baixo" ? "bg-orange-600 hover:bg-orange-700 text-white" : "text-orange-800 border-orange-200"
            }`}
          >
            📉 Giro ≤ 10% ({summary.lowTurnoverCount})
          </Button>
        </div>

        {/* Busca e Exportação */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              placeholder="Buscar código ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-white"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="text-xs h-8 font-bold border-neutral-300 bg-white hover:bg-neutral-100 whitespace-nowrap"
            title="Baixar planilha CSV com colunas de giro e validade para Excel"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-emerald-700" />
            Exportar Excel/CSV
          </Button>
        </div>
      </div>

      {/* 3. TABELA DETALHADA COM ROLAGEM */}
      <div className="flex-1 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-neutral-100/90 text-neutral-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b">
            <tr>
              <th scope="col" className="p-3 w-16 text-center">Encarte</th>
              <th scope="col" className="p-3">Produto</th>
              <th scope="col" className="p-3 w-36">Validade</th>
              <th scope="col" className="p-3 w-48">Giro & Desempenho</th>
              <th scope="col" className="p-3">Diagnóstico Interno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    <p className="font-bold text-neutral-800 text-sm">
                      Nenhum produto encontrado neste filtro
                    </p>
                    <p className="text-xs text-neutral-500">
                      Não há itens críticos com estes parâmetros. Bom trabalho de gestão!
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map(({ product: p, analytics: a }) => {
                const percentTurnover = a.turnoverPercent;

                return (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-neutral-50/90 ${
                      a.isExpired
                        ? "bg-red-100/60 border-l-4 border-l-red-800"
                        : a.expiryUrgency.level !== "normal" && a.expiryUrgency.level !== "verde_seguro"
                        ? a.expiryUrgency.rowClass
                        : a.hasZeroSales5Days
                        ? "bg-amber-50/40 border-l-4 border-l-amber-500"
                        : a.hasLowTurnover10Percent
                        ? "bg-orange-50/30 border-l-4 border-l-orange-400"
                        : ""
                    }`}
                  >
                    {/* Status no encarte (com toggle) */}
                    <td className="p-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleToggleIncluded(p)}
                        className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border transition-colors ${
                          p.included
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                            : "bg-neutral-100 text-neutral-400 border-neutral-300 hover:bg-neutral-200"
                        }`}
                        title={
                          p.included
                            ? "Produto está ATIVO no encarte. Clique para pausar."
                            : "Produto está FORA do encarte. Clique para incluir."
                        }
                        aria-label={`Alternar inclusão de ${p.name}`}
                      >
                        {p.included ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </td>

                    {/* Produto (Código, Foto, Nome) */}
                    <td className="p-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-10 w-10 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0 ${
                            onEditProduct ? "cursor-pointer hover:border-red-400 transition-colors" : ""
                          }`}
                          onClick={onEditProduct ? () => onEditProduct(p) : undefined}
                          title={onEditProduct ? "Clique para editar produto" : undefined}
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt=""
                              className="h-full w-full object-contain p-0.5"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono font-bold text-red-700 bg-red-50 px-1 rounded text-[10.5px] border border-red-200">
                              {p.code}
                            </span>
                            {p.badge && p.badge !== "nenhum" && (
                              <Badge className="text-[9px] px-1 py-0 uppercase bg-yellow-400 text-black font-black">
                                {p.badge}
                              </Badge>
                            )}
                          </div>
                          <div
                            className={`font-bold text-neutral-900 text-xs truncate max-w-xs ${
                              onEditProduct ? "cursor-pointer hover:text-red-700 transition-colors" : ""
                            }`}
                            title={onEditProduct ? `Clique para editar ${p.name}` : p.name}
                            onClick={onEditProduct ? () => onEditProduct(p) : undefined}
                          >
                            {p.name}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-medium">
                            {p.packaging || "Embalagem padrão"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Validade & Dias Restantes */}
                    <td className="p-3 align-middle font-mono">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-neutral-900">
                          {p.validity || "--/--/----"}
                        </div>
                        {a.isExpired ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.2 rounded bg-red-800 text-white border border-red-900 shadow-2xs">
                            <AlertTriangle className="h-3 w-3" />
                            VENCIDO ({Math.abs(a.daysToExpiry!)}d atrás)
                          </span>
                        ) : (a.isExpiringIn5DaysOrLess || a.expiryUrgency.level === "vermelho_sobra" || a.expiryUrgency.level === "amarelo_razoavel") ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded border ${a.expiryUrgency.pillClass}`}>
                            <Clock className="h-3 w-3" />
                            {a.expiryUrgency.badgeText}
                          </span>
                        ) : a.daysToExpiry !== null && a.daysToExpiry <= 10 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Faltam {a.daysToExpiry} dias
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-500">
                            {a.daysToExpiry !== null ? `${a.daysToExpiry} dias restantes` : "Sem data"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Giro & Desempenho (Cadastro vs Atual) */}
                    <td className="p-3 align-middle">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-neutral-500">
                            Cadastrado há <strong className="text-neutral-800">{a.daysSinceRegistration}d</strong>
                          </span>
                          <span className="font-bold font-mono text-neutral-900">
                            {percentTurnover}% vendido
                          </span>
                        </div>

                        {/* Barra de Progresso do Giro */}
                        <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              percentTurnover >= 50
                                ? "bg-emerald-500"
                                : percentTurnover > 10
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(3, percentTurnover))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-neutral-600 font-mono">
                          <span>Inicial: <strong>{a.initialStock}</strong></span>
                          <span>Atual: <strong>{a.currentStock}</strong></span>
                          <span className="text-emerald-700 font-bold">Vendeu: {a.quantitySold}</span>
                        </div>
                      </div>
                    </td>

                    {/* Diagnóstico Interno & Notificações Solicitadas */}
                    <td className="p-3 align-middle">
                      <div className="space-y-1">
                        {a.hasZeroSales5Days && (
                          <div className="rounded-md bg-amber-100 border border-amber-300 p-1.5 text-[10.5px] text-amber-950 font-bold flex items-start gap-1.5 shadow-2xs">
                            <TrendingDown className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span>Esse produto não vendeu nada nos últimos 5 dias</span>
                              <div className="text-[9.5px] font-normal text-amber-900">
                                {`Estoque parado em ${a.currentStock} un`}
                              </div>
                            </div>
                          </div>
                        )}

                        {a.hasLowTurnover10Percent && (
                          <div className="rounded-md bg-orange-100 border border-orange-300 p-1.5 text-[10.5px] text-orange-950 font-bold flex items-start gap-1.5 shadow-2xs">
                            <ShieldAlert className="h-3.5 w-3.5 text-orange-700 shrink-0 mt-0.5" />
                            <div>
                              <span>{`Giro Crítico: apenas ${percentTurnover}% do estoque vendido em ${a.daysSinceRegistration} dias`}</span>
                              <div className="text-[9.5px] font-normal text-orange-900">
                                {`${a.quantitySold} vendidas de ${a.initialStock} un`}
                              </div>
                            </div>
                          </div>
                        )}

                        {(a.isExpiringIn5DaysOrLess || a.expiryUrgency.level === "vermelho_sobra" || a.expiryUrgency.level === "amarelo_razoavel") && (
                          <div className={`rounded-md p-1.5 text-[10.5px] font-bold flex items-start gap-1.5 shadow-2xs ${
                            a.expiryUrgency.color === "vermelho"
                              ? "bg-red-100 border border-red-400 text-red-950"
                              : a.expiryUrgency.color === "laranja"
                              ? "bg-orange-100 border border-orange-400 text-orange-950"
                              : "bg-yellow-100 border border-yellow-400 text-yellow-950"
                          }`}>
                            <Flame className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                              a.expiryUrgency.color === "vermelho"
                                ? "text-red-600 animate-pulse"
                                : a.expiryUrgency.color === "laranja"
                                ? "text-orange-600"
                                : "text-yellow-700"
                            }`} />
                            <div>
                              <span>
                                {a.expiryUrgency.level === "vermelho_sobra"
                                  ? `🚨 NÃO VAI VENDER A TEMPO: Sobra de ~${a.expiryUrgency.projectedSurplusAtExpiry} un (${a.daysToExpiry}d)`
                                  : a.expiryUrgency.level === "amarelo_razoavel"
                                  ? `⚠️ GIRO RAZOÁVEL: Venda Provável (${a.daysToExpiry}d)`
                                  : a.expiryUrgency.color === "vermelho"
                                  ? `🚨 AVISO VERMELHO: Vence em ${a.daysToExpiry} dia(s) (Ação imediata)`
                                  : a.expiryUrgency.color === "laranja"
                                  ? `🔥 AVISO LARANJA: Vence em ${a.daysToExpiry} dia(s) (Queima urgente)`
                                  : `⚠️ AVISO AMARELO: Vence em ${a.daysToExpiry} dia(s) (Atenção de giro)`}
                              </span>
                              <div className="text-[9.5px] font-normal opacity-90">
                                {a.expiryUrgency.description}
                              </div>
                            </div>
                          </div>
                        )}

                        {!a.hasZeroSales5Days && !a.hasLowTurnover10Percent && !a.isExpiringIn5DaysOrLess && a.expiryUrgency.level !== "vermelho_sobra" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Ritmo regular de estoque
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. RODAPÉ COM RESUMO E NOTA DE PRIVACIDADE */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2 border-t pt-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-700">
            🔒 Área Administrativa Interna:
          </span>
          <span>
            Essas métricas e avisos são exclusivamente para acompanhamento de gestão e NUNCA saem no encarte público dos clientes.
          </span>
        </div>

        {onClose && (
          <Button
            size="sm"
            onClick={onClose}
            className="text-xs h-8 font-bold min-w-[100px]"
          >
            Concluir
          </Button>
        )}
      </div>
    </div>
  );
};

export const StockTurnoverAdminModal: React.FC<StockTurnoverAdminModalProps> = ({
  open,
  onOpenChange,
  products,
  onUpdateProduct,
  onEditProduct,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full p-6 max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                Área Administrativa: Giro de Estoque & Controle de Validade
                <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-900 text-white rounded-full uppercase tracking-wider">
                  Interno
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Acompanhamento automático do ritmo de vendas desde o cadastro, alertas de validade crítica (≤ 5 dias), detecção de produtos parados e ações rápidas de liquidação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <StockTurnoverAdminContent
          products={products}
          onUpdateProduct={onUpdateProduct}
          onEditProduct={onEditProduct}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
