import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  X,
  AlertOctagon,
  Flame,
  PauseCircle,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type {
  ValidadeFilterParams,
  FaixaVencimento,
  FaixaEscoaTempo,
  FaixaGiroMes,
  FaixaCobertura,
  ValidadeKpiCounts,
} from "@/types/painel-validade";

export interface PainelValidadeFiltersProps {
  filters: ValidadeFilterParams;
  onFiltersChange?: (newFilters: ValidadeFilterParams) => void;
  onChangeFilters?: (newFilters: ValidadeFilterParams) => void;
  onClearFilters?: () => void;
  compradores?: string[];
  buyersList?: Array<{ code: string; name: string }>;
  counts: {
    todos: number;
    critico: number;
    vence7d: number;
    vaiSobrar: number;
    semVendas3M?: number;
    parado?: number;
    total?: number;
  };
  validityCounts?: ValidadeKpiCounts;
  totalLotes?: number;
  totalFiltrados?: number;
  hasActiveFilters?: boolean;
}

export const PainelValidadeFilters: React.FC<PainelValidadeFiltersProps> = ({
  filters,
  onFiltersChange,
  onChangeFilters,
  onClearFilters,
  compradores = [],
  buyersList = [],
  counts,
  validityCounts,
  totalLotes,
  totalFiltrados,
}) => {
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false);

  // Função unificada para atualizar filtros garantindo compatibilidade de props
  const updateFilters = (newFilters: ValidadeFilterParams) => {
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
    if (onChangeFilters) {
      onChangeFilters(newFilters);
    }
  };

  // Lista padronizada de nomes de compradores
  const listaCompradores = React.useMemo(() => {
    if (compradores && compradores.length > 0) return compradores;
    if (buyersList && buyersList.length > 0) {
      return buyersList.map((b) => b.name || b.code).filter(Boolean);
    }
    return [];
  }, [compradores, buyersList]);

  // Contagem unificada para Sem Vendas (3M) / Parado
  const countSemVendas3M = counts.semVendas3M ?? counts.parado ?? 0;
  const countTodos = counts.todos ?? counts.total ?? 0;

  // Handler para clique nos atalhos principais com toggle (clicar de novo desmarca)
  const handleToggleQuickFilter = (
    tipo: "critico" | "vence_7d" | "vai_sobrar" | "sem_vendas_3m"
  ) => {
    const isCurrentActive =
      filters.filtroRapido === tipo ||
      (tipo === "sem_vendas_3m" && filters.filtroRapido === "parado");

    updateFilters({
      ...filters,
      filtroRapido: isCurrentActive ? "todos" : tipo,
    });
  };

  // Handler para clique nas faixas de validade com toggle
  const handleToggleFaixaValidade = (faixa: FaixaVencimento) => {
    const isCurrent = filters.faixaVencimento === faixa;
    updateFilters({
      ...filters,
      faixaVencimento: isCurrent ? "todas" : faixa,
    });
  };

  // Contagem de filtros secundários ativos em "Mais Filtros"
  let advancedActiveCount = 0;
  if (filters.comprador && filters.comprador !== "todos") advancedActiveCount++;
  if (filters.noEncarte && filters.noEncarte !== "todos") advancedActiveCount++;
  if (filters.faixaVencimento && filters.faixaVencimento !== "todas") advancedActiveCount++;
  if (filters.faixaEscoaTempo && filters.faixaEscoaTempo !== "todas") advancedActiveCount++;
  if (filters.faixaCobertura && filters.faixaCobertura !== "todas") advancedActiveCount++;

  // Chips de filtros ativos
  const activeChips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  if (filters.busca && filters.busca.trim()) {
    activeChips.push({
      id: "busca",
      label: `Busca: "${filters.busca.trim()}"`,
      onRemove: () => updateFilters({ ...filters, busca: "" }),
    });
  }

  if (filters.filtroRapido && filters.filtroRapido !== "todos") {
    const labels: Record<string, string> = {
      critico: "Crítico",
      vence_7d: "Vence em 7 dias",
      vai_sobrar: "Vai sobrar",
      sem_vendas_3m: "Sem vendas (3M)",
      parado: "Sem vendas (3M)",
    };
    activeChips.push({
      id: "filtroRapido",
      label: `Atalho: ${labels[filters.filtroRapido] || filters.filtroRapido}`,
      onRemove: () => updateFilters({ ...filters, filtroRapido: "todos" }),
    });
  }

  if (filters.faixaVencimento && filters.faixaVencimento !== "todas") {
    const labels: Record<string, string> = {
      vencido: "Vencidos",
      ate_7d: "Até 7 dias",
      "8_a_30d": "8 a 30 dias",
      "31_a_60d": "31 a 60 dias",
      "61_a_90d": "61 a 90 dias",
      acima_90d: "Acima de 90 dias",
      sem_validade: "Sem validade",
    };
    activeChips.push({
      id: "faixaVencimento",
      label: `Validade: ${labels[filters.faixaVencimento] || filters.faixaVencimento}`,
      onRemove: () => updateFilters({ ...filters, faixaVencimento: "todas" }),
    });
  }

  if (filters.comprador && filters.comprador !== "todos") {
    activeChips.push({
      id: "comprador",
      label: `Comprador: ${filters.comprador}`,
      onRemove: () => updateFilters({ ...filters, comprador: "todos" }),
    });
  }

  if (filters.noEncarte && filters.noEncarte !== "todos") {
    activeChips.push({
      id: "noEncarte",
      label: filters.noEncarte === "sim" ? "No Encarte: Sim" : "Fora do Encarte",
      onRemove: () => updateFilters({ ...filters, noEncarte: "todos" }),
    });
  }

  if (filters.faixaEscoaTempo && filters.faixaEscoaTempo !== "todas") {
    const labels: Record<string, string> = {
      no_limite: "No limite (60% a 99%)",
      escoa_tempo: "100% no prazo",
      sem_estoque: "Sem estoque",
    };
    activeChips.push({
      id: "faixaEscoaTempo",
      label: `Tempo: ${labels[filters.faixaEscoaTempo] || filters.faixaEscoaTempo}`,
      onRemove: () => updateFilters({ ...filters, faixaEscoaTempo: "todas" }),
    });
  }

  if (filters.faixaCobertura && filters.faixaCobertura !== "todas") {
    const labels: Record<string, string> = {
      sem_venda: "Sem venda",
      ate_2_meses: "Até 2 meses",
      "2_a_6_meses": "2 a 6 meses",
      acima_6_meses: "> 6 meses",
    };
    activeChips.push({
      id: "faixaCobertura",
      label: `Cobertura: ${labels[filters.faixaCobertura] || filters.faixaCobertura}`,
      onRemove: () => updateFilters({ ...filters, faixaCobertura: "todas" }),
    });
  }

  const handleClearAll = () => {
    if (onClearFilters) {
      onClearFilters();
    } else {
      updateFilters({
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
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-neutral-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
      {/* 1. BUSCA SEMPRE VISÍVEL + BOTÃO MAIS FILTROS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Campo de Busca Livre (Código, Descrição ou Comprador) */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar por código, produto ou comprador..."
            value={filters.busca || ""}
            onChange={(e) => updateFilters({ ...filters, busca: e.target.value })}
            autoComplete="off"
            className="pl-11 pr-10 min-h-[48px] text-sm bg-neutral-50/80 dark:bg-slate-800/80 border-neutral-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 transition-colors"
          />
          {filters.busca && (
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, busca: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              title="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Botão Mais Filtros (Abre painel de baixo para cima) */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAdvancedSheet(true)}
          className={`min-h-[48px] px-4 font-bold text-sm rounded-xl border border-neutral-300 dark:border-slate-700 transition-all shrink-0 flex items-center justify-center gap-2 ${
            advancedActiveCount > 0
              ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-slate-900"
              : "bg-white dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-slate-700"
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>Mais Filtros</span>
          {advancedActiveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
              {advancedActiveCount}
            </span>
          )}
        </Button>
      </div>

      {/* 2. UMA ÚNICA FAIXA DE ATALHOS PRINCIPAIS */}
      {/* No celular: rolagem horizontal suave. No desktop: grade de 5 botões de >= 56px */}
      <div className="overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <div className="flex sm:grid sm:grid-cols-5 gap-2.5 min-w-[580px] sm:min-w-0">
          {/* Atalho 1: Todos */}
          <button
            type="button"
            onClick={() => updateFilters({ ...filters, filtroRapido: "todos" })}
            className={`min-h-[56px] px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 flex-1 sm:flex-initial ${
              !filters.filtroRapido || filters.filtroRapido === "todos"
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md ring-2 ring-neutral-400 dark:bg-white dark:text-slate-900"
                : "bg-neutral-50 dark:bg-slate-800/60 hover:bg-neutral-100 dark:hover:bg-slate-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 shrink-0" />
              <span className="text-base sm:text-lg font-bold">Todos</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-2">
              {countTodos}
            </span>
          </button>

          {/* Atalho 2: Crítico */}
          <button
            type="button"
            onClick={() => handleToggleQuickFilter("critico")}
            className={`min-h-[56px] px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 flex-1 sm:flex-initial ${
              filters.filtroRapido === "critico"
                ? "bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-400"
                : "bg-red-50/70 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-950 dark:text-red-300 border-red-200 dark:border-red-900/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-base sm:text-lg font-bold">Crítico</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-2 text-red-700 dark:text-red-400">
              {counts.critico}
            </span>
          </button>

          {/* Atalho 3: Vence em 7 dias */}
          <button
            type="button"
            onClick={() => handleToggleQuickFilter("vence_7d")}
            className={`min-h-[56px] px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 flex-1 sm:flex-initial ${
              filters.filtroRapido === "vence_7d"
                ? "bg-orange-600 text-white border-orange-700 shadow-md ring-2 ring-orange-300"
                : "bg-orange-50/70 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-900/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
              <span className="text-base sm:text-lg font-bold">Vence em 7 dias</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-2 text-orange-800 dark:text-orange-300">
              {counts.vence7d}
            </span>
          </button>

          {/* Atalho 4: Vai Sobrar */}
          <button
            type="button"
            onClick={() => handleToggleQuickFilter("vai_sobrar")}
            className={`min-h-[56px] px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 flex-1 sm:flex-initial ${
              filters.filtroRapido === "vai_sobrar"
                ? "bg-rose-800 text-white border-rose-900 shadow-md ring-2 ring-rose-400"
                : "bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-400" />
              <span className="text-base sm:text-lg font-bold">Vai sobrar</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-2 text-rose-900 dark:text-rose-300">
              {counts.vaiSobrar}
            </span>
          </button>

          {/* Atalho 5: Sem vendas (3M) - regra idêntica à de parado */}
          <button
            type="button"
            onClick={() => handleToggleQuickFilter("sem_vendas_3m")}
            className={`min-h-[56px] px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 flex-1 sm:flex-initial ${
              filters.filtroRapido === "sem_vendas_3m" || filters.filtroRapido === "parado"
                ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300"
                : "bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 text-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-base sm:text-lg font-bold">Sem vendas (3M)</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-2 text-amber-900 dark:text-amber-300">
              {countSemVendas3M}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BARRA DE FAIXAS DE VALIDADE (A soma bate 100% com o total de lotes) */}
      <div className="pt-2 border-t border-neutral-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Faixas de Validade (Soma: {validityCounts?.total ?? countTodos} lotes)
          </span>
          {filters.faixaVencimento && filters.faixaVencimento !== "todas" && (
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, faixaVencimento: "todas" })}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Exibir todas as faixas
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {/* Vencidos */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("vencido")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "vencido"
                ? "bg-red-950 text-white border-red-900 ring-2 ring-red-400 font-bold shadow-xs"
                : "bg-red-50/70 hover:bg-red-100 dark:bg-red-950/30 text-red-950 dark:text-red-200 border-red-200 dark:border-red-900/60"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400">
              🚫 Vencidos
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.vencidos ?? 0}
            </div>
          </button>

          {/* Até 7 dias */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("ate_7d")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "ate_7d"
                ? "bg-red-600 text-white border-red-700 ring-2 ring-red-300 font-bold shadow-xs"
                : "bg-red-50/70 hover:bg-red-100 dark:bg-red-950/30 text-red-950 dark:text-red-200 border-red-200 dark:border-red-900/60"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400">
              🔥 Até 7 dias
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.ate7d ?? 0}
            </div>
          </button>

          {/* 8 a 30 dias */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("8_a_30d")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "8_a_30d"
                ? "bg-orange-600 text-white border-orange-700 ring-2 ring-orange-300 font-bold shadow-xs"
                : "bg-orange-50/70 hover:bg-orange-100 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-900/60"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-400">
              ⏰ 8 a 30 dias
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.de8a30d ?? 0}
            </div>
          </button>

          {/* 31 a 60 dias */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("31_a_60d")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "31_a_60d"
                ? "bg-amber-500 text-amber-950 border-amber-600 ring-2 ring-amber-300 font-bold shadow-xs"
                : "bg-amber-50/70 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900/60"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400">
              ⚠️ 31 a 60 dias
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.de31a60d ?? 0}
            </div>
          </button>

          {/* 61 a 90 dias */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("61_a_90d")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "61_a_90d"
                ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300 font-bold shadow-xs"
                : "bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/60"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400">
              🟢 61 a 90 dias
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.de61a90d ?? 0}
            </div>
          </button>

          {/* Acima de 90 dias */}
          <button
            type="button"
            onClick={() => handleToggleFaixaValidade("acima_90d")}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              filters.faixaVencimento === "acima_90d"
                ? "bg-neutral-800 text-white border-neutral-900 ring-2 ring-neutral-400 font-bold shadow-xs"
                : "bg-neutral-50 hover:bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-slate-700"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400">
              📦 Acima de 90 dias
            </div>
            <div className="text-lg font-black font-mono mt-0.5">
              {validityCounts?.acima90d ?? 0}
            </div>
          </button>

          {/* Sem validade (exibido apenas se houver algum item) */}
          {(validityCounts?.semValidade ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => handleToggleFaixaValidade("sem_validade")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                filters.faixaVencimento === "sem_validade"
                  ? "bg-neutral-700 text-white border-neutral-800 ring-2 ring-neutral-300 font-bold"
                  : "bg-neutral-50 hover:bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 border-neutral-200"
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-neutral-500">
                ❓ Sem validade
              </div>
              <div className="text-lg font-black font-mono mt-0.5">
                {validityCounts?.semValidade ?? 0}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTAGEM E CHIPS DE FILTROS ATIVOS + BOTÃO LIMPAR TUDO */}
      <div className="pt-2 border-t border-neutral-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Texto "Mostrando X de Y lotes" */}
          <div className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
            Mostrando{" "}
            <span className="font-mono text-neutral-900 dark:text-white font-black">
              {totalFiltrados ?? countTodos}
            </span>{" "}
            de{" "}
            <span className="font-mono text-neutral-900 dark:text-white font-black">
              {totalLotes ?? countTodos}
            </span>{" "}
            lotes
          </div>

          {activeChips.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-bold text-red-700 hover:text-red-900 dark:text-red-400 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Limpar tudo
            </button>
          )}
        </div>

        {/* Chips removíveis com 1 clique */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {activeChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-slate-700 shadow-2xs"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-neutral-300 dark:hover:bg-slate-600 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  title={`Remover filtro: ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5. PAINEL DE BAIXO PARA CIMA: MAIS FILTROS */}
      <Sheet open={showAdvancedSheet} onOpenChange={setShowAdvancedSheet}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-6 bg-white dark:bg-slate-900 border-t border-neutral-200 dark:border-slate-800 space-y-6"
        >
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-xl font-black text-neutral-900 dark:text-white">
              Mais Filtros
            </SheetTitle>
            <SheetDescription className="text-xs text-neutral-500">
              Filtros complementares que não possuem atalho direto na barra principal.
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* 1. Comprador Responsável */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Comprador Responsável
              </label>
              <select
                value={filters.comprador || "todos"}
                onChange={(e) =>
                  updateFilters({ ...filters, comprador: e.target.value })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="todos">Todos os Compradores</option>
                {listaCompradores.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Presença no Encarte */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Presença no Encarte
              </label>
              <select
                value={filters.noEncarte || "todos"}
                onChange={(e) =>
                  updateFilters({
                    ...filters,
                    noEncarte: e.target.value as ValidadeFilterParams["noEncarte"],
                  })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="todos">Todos (Com e sem encarte)</option>
                <option value="sim">⭐ Apenas no encarte</option>
                <option value="nao">Fora do encarte</option>
              </select>
            </div>

            {/* 3. Faixa de Validade */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Faixa de Validade
              </label>
              <select
                value={filters.faixaVencimento || "todas"}
                onChange={(e) =>
                  updateFilters({
                    ...filters,
                    faixaVencimento: e.target.value as FaixaVencimento | "todas",
                  })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="todas">Todas as Validades</option>
                <option value="vencido">🚫 Vencidos (&lt; 0 dias)</option>
                <option value="ate_7d">🔴 Até 7 dias</option>
                <option value="8_a_30d">🟠 8 a 30 dias</option>
                <option value="31_a_60d">🟡 31 a 60 dias</option>
                <option value="61_a_90d">🟢 61 a 90 dias</option>
                <option value="acima_90d">⚪ Acima de 90 dias</option>
                <option value="sem_validade">❓ Sem validade</option>
              </select>
            </div>

            {/* 4. Rótulo sem jargão: Vai dar tempo de vender? (Sem opção duplicada 'Vai Sobrar') */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Vai dar tempo de vender?
              </label>
              <select
                value={filters.faixaEscoaTempo || "todas"}
                onChange={(e) =>
                  updateFilters({
                    ...filters,
                    faixaEscoaTempo: e.target.value as FaixaEscoaTempo | "todas",
                  })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="todas">Todas as situações</option>
                <option value="no_limite">⚠️ No limite (60% a 99%)</option>
                <option value="escoa_tempo">✓ 100% no prazo</option>
                <option value="sem_estoque">📦 Sem estoque</option>
              </select>
            </div>

            {/* 5. Cobertura de Estoque (Meses) */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Cobertura de Estoque
              </label>
              <select
                value={filters.faixaCobertura || "todas"}
                onChange={(e) =>
                  updateFilters({
                    ...filters,
                    faixaCobertura: e.target.value as FaixaCobertura | "todas",
                  })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="todas">Todas as coberturas</option>
                <option value="sem_venda">Sem venda (Zero saída)</option>
                <option value="ate_2_meses">Até 2 meses de estoque</option>
                <option value="2_a_6_meses">2 a 6 meses de estoque</option>
                <option value="acima_6_meses">Acima de 6 meses (Excesso)</option>
              </select>
            </div>

            {/* 6. Ordenação da Lista */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Ordenar Produtos
              </label>
              <select
                value={filters.ordenacao || "critico_primeiro"}
                onChange={(e) =>
                  updateFilters({
                    ...filters,
                    ordenacao: e.target.value as ValidadeFilterParams["ordenacao"],
                  })
                }
                className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white"
              >
                <option value="critico_primeiro">Críticos primeiro (Padrão)</option>
                <option value="escoa_tempo_asc">Menor escoamento primeiro</option>
                <option value="vencimento_asc">Mais próximos de vencer</option>
                <option value="estoque_desc">Maior estoque disponível</option>
                <option value="nome_asc">Nome do produto (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Rodapé do painel */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                updateFilters({
                  ...filters,
                  comprador: "todos",
                  noEncarte: "todos",
                  faixaVencimento: "todas",
                  faixaEscoaTempo: "todas",
                  faixaCobertura: "todas",
                })
              }
              className="text-xs font-bold text-neutral-500 hover:text-red-700"
            >
              Limpar estes filtros
            </Button>

            <Button
              type="button"
              onClick={() => setShowAdvancedSheet(false)}
              className="min-h-[44px] px-6 text-sm font-bold bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 dark:bg-white dark:text-slate-900"
            >
              Ver Resultados
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
