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
  ListFilter,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  ValidadeFilterParams,
  FaixaVencimento,
  FaixaEscoaTempo,
  FaixaGiroMes,
  FaixaCobertura,
  RitmoMesStatus,
} from "@/types/painel-validade";

interface PainelValidadeFiltersProps {
  filters: ValidadeFilterParams;
  onChangeFilters: (newFilters: ValidadeFilterParams) => void;
  onClearFilters: () => void;
  buyersList: Array<{ code: string; name: string }>;
  counts: {
    total: number;
    critico: number;
    vence7d: number;
    vaiSobrar: number;
    parado: number;
  };
  hasActiveFilters: boolean;
}

export const PainelValidadeFilters: React.FC<PainelValidadeFiltersProps> = ({
  filters,
  onChangeFilters,
  onClearFilters,
  buyersList,
  counts,
  hasActiveFilters,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Contagem de filtros avançados ativos
  let advancedActiveCount = 0;
  if (filters.faixaVencimento && filters.faixaVencimento !== "todas") advancedActiveCount++;
  if (filters.faixaEscoaTempo && filters.faixaEscoaTempo !== "todas") advancedActiveCount++;
  if (filters.faixaGiroMes && filters.faixaGiroMes !== "todas") advancedActiveCount++;
  if (filters.faixaCobertura && filters.faixaCobertura !== "todas") advancedActiveCount++;
  if (filters.ritmoMes && filters.ritmoMes !== "todas") advancedActiveCount++;
  if (filters.noEncarte && filters.noEncarte !== "todos") advancedActiveCount++;
  if (filters.comprador && filters.comprador !== "todos") advancedActiveCount++;

  const handleQuickFilter = (tipo: ValidadeFilterParams["filtroRapido"]) => {
    onChangeFilters({
      ...filters,
      filtroRapido: filters.filtroRapido === tipo ? "todos" : tipo,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 shadow-xs space-y-4">
      {/* 1. LINHA PRINCIPAL: 5 BOTÕES GRANDES (Min 56px, Fonte >= 18px para 70+ e jovens) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Filtros Principais Rápidos
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs font-bold text-red-700 hover:text-red-800 hover:bg-red-50 h-8 px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar todos os filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* Botão 1: Todos */}
          <button
            type="button"
            onClick={() => handleQuickFilter("todos")}
            className={`min-h-[56px] px-3 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 ${
              !filters.filtroRapido || filters.filtroRapido === "todos"
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md ring-2 ring-neutral-400"
                : "bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 shrink-0" />
              <span className="text-base sm:text-lg font-bold">Todos</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-1.5">
              {counts.total}
            </span>
          </button>

          {/* Botão 2: Crítico */}
          <button
            type="button"
            onClick={() => handleQuickFilter("critico")}
            className={`min-h-[56px] px-3 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 ${
              filters.filtroRapido === "critico"
                ? "bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-400"
                : "bg-red-50 hover:bg-red-100 text-red-950 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 shrink-0 text-red-600" />
              <span className="text-base sm:text-lg font-bold">Crítico</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-1.5 text-red-700">
              {counts.critico}
            </span>
          </button>

          {/* Botão 3: Vence em 7d */}
          <button
            type="button"
            onClick={() => handleQuickFilter("vence_7d")}
            className={`min-h-[56px] px-3 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 ${
              filters.filtroRapido === "vence_7d"
                ? "bg-orange-600 text-white border-orange-700 shadow-md ring-2 ring-orange-300"
                : "bg-orange-50 hover:bg-orange-100 text-orange-950 border-orange-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 shrink-0 text-orange-600" />
              <span className="text-base sm:text-lg font-bold">Vence 7d</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-1.5 text-orange-800">
              {counts.vence7d}
            </span>
          </button>

          {/* Botão 4: Vai Sobrar */}
          <button
            type="button"
            onClick={() => handleQuickFilter("vai_sobrar")}
            className={`min-h-[56px] px-3 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 ${
              filters.filtroRapido === "vai_sobrar"
                ? "bg-red-800 text-white border-red-900 shadow-md ring-2 ring-red-400"
                : "bg-red-50/70 hover:bg-red-100 text-red-950 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 shrink-0 text-red-700" />
              <span className="text-base sm:text-lg font-bold">Vai Sobrar</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-1.5 text-red-900">
              {counts.vaiSobrar}
            </span>
          </button>

          {/* Botão 5: Parado */}
          <button
            type="button"
            onClick={() => handleQuickFilter("parado")}
            className={`min-h-[56px] px-3 py-2 rounded-xl border flex items-center justify-between transition-all active:scale-98 ${
              filters.filtroRapido === "parado"
                ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300"
                : "bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <span className="text-base sm:text-lg font-bold">Parado</span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono ml-1.5 text-amber-800">
              {counts.parado}
            </span>
          </button>
        </div>
      </div>

      {/* 2. BARRA DE BUSCA E BOTÃO MAIS FILTROS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Buscar por código, produto ou comprador..."
            value={filters.busca || ""}
            onChange={(e) => onChangeFilters({ ...filters, busca: e.target.value })}
            className="pl-11 min-h-[48px] text-sm bg-neutral-50/70 border-neutral-300 rounded-xl focus:bg-white"
          />
          {filters.busca && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, busca: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Botão Gaveta Mais Filtros */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`min-h-[48px] px-4 font-bold text-sm border-neutral-300 rounded-xl transition-all ${
            showAdvanced || advancedActiveCount > 0
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-800 hover:bg-neutral-100"
          }`}
        >
          <Filter className="h-4 w-4 mr-2" />
          <span>Mais Filtros</span>
          {advancedActiveCount > 0 && (
            <span className="ml-2 px-1.5 py-0.2 rounded-full text-xs font-black bg-emerald-500 text-white">
              {advancedActiveCount}
            </span>
          )}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 ml-1.5" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1.5" />
          )}
        </Button>
      </div>

      {/* 3. GAVETA EXPANSÍVEL: FILTROS SECUNDÁRIOS */}
      {showAdvanced && (
        <div className="pt-3 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-neutral-50/80 p-4 rounded-xl">
          {/* Filtro: No Encarte */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Presença no Encarte
            </label>
            <select
              value={filters.noEncarte || "todos"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  noEncarte: e.target.value as ValidadeFilterParams["noEncarte"],
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todos">Todos (Com e sem encarte)</option>
              <option value="sim">⭐ Só no encarte</option>
              <option value="nao">Fora do encarte</option>
            </select>
          </div>

          {/* Filtro: Comprador */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Comprador Responsável
            </label>
            <select
              value={filters.comprador || "todos"}
              onChange={(e) =>
                onChangeFilters({ ...filters, comprador: e.target.value })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todos">Todos os Compradores</option>
              {buyersList.map((b) => (
                <option key={b.code || b.name} value={b.name || b.code}>
                  {b.name || `Comprador ${b.code}`}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Escoa a Tempo */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Escoa a Tempo (%)
            </label>
            <select
              value={filters.faixaEscoaTempo || "todas"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  faixaEscoaTempo: e.target.value as FaixaEscoaTempo | "todas",
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todas">Todas as faixas</option>
              <option value="vai_sobrar">🚨 Vai Sobrar (&lt; 60%)</option>
              <option value="no_limite">⚠️ No Limite (60% a 99%)</option>
              <option value="escoa_tempo">✓ Escoa a Tempo (100%)</option>
            </select>
          </div>

          {/* Filtro: Faixa de Vencimento */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Prazo de Vencimento
            </label>
            <select
              value={filters.faixaVencimento || "todas"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  faixaVencimento: e.target.value as FaixaVencimento | "todas",
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todas">Todos os Prazos</option>
              <option value="vencido">🚫 Vencidos (&lt; 0 dias)</option>
              <option value="ate_7d">🔴 Até 7 dias</option>
              <option value="8_a_30d">🟠 8 a 30 dias</option>
              <option value="31_a_60d">🟡 31 a 60 dias</option>
              <option value="61_a_90d">🟢 61 a 90 dias</option>
              <option value="acima_90d">⚪ Acima de 90 dias</option>
            </select>
          </div>

          {/* Filtro: Cobertura de Estoque */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Cobertura (Meses)
            </label>
            <select
              value={filters.faixaCobertura || "todas"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  faixaCobertura: e.target.value as FaixaCobertura | "todas",
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todas">Todas as Coberturas</option>
              <option value="sem_venda">Sem Venda (Zero saída)</option>
              <option value="ate_2_meses">Até 2 meses de estoque</option>
              <option value="2_a_6_meses">2 a 6 meses de estoque</option>
              <option value="acima_6_meses">Acima de 6 meses (Excesso)</option>
            </select>
          </div>

          {/* Filtro: Giro no Mês */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Giro no Mês (%)
            </label>
            <select
              value={filters.faixaGiroMes || "todas"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  faixaGiroMes: e.target.value as FaixaGiroMes | "todas",
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todas">Todos os Giros</option>
              <option value="parado">Parado (0% giro)</option>
              <option value="baixo">Baixo (&lt; 10%)</option>
              <option value="medio">Médio (10% a 30%)</option>
              <option value="alto">Alto (&gt; 30%)</option>
            </select>
          </div>

          {/* Filtro: Ritmo do Mês Parcial */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Ritmo Mês Atual
            </label>
            <select
              value={filters.ritmoMes || "todas"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  ritmoMes: e.target.value as RitmoMesStatus | "todas",
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="todas">Todos</option>
              <option value="acima_normal">📈 Acima do normal (&gt;120%)</option>
              <option value="normal">✓ Normal (80% a 120%)</option>
              <option value="abaixo_normal">📉 Abaixo do normal (&lt;80%)</option>
            </select>
          </div>

          {/* Ordenação */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Ordenar Lista Por
            </label>
            <select
              value={filters.ordenacao || "critico_primeiro"}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  ordenacao: e.target.value as ValidadeFilterParams["ordenacao"],
                })
              }
              className="w-full min-h-[44px] px-3 text-xs font-semibold rounded-lg border border-neutral-300 bg-white"
            >
              <option value="critico_primeiro">🚨 Críticos Primeiro (Padrão)</option>
              <option value="escoa_tempo_asc">📉 Menor Escoamento a Tempo</option>
              <option value="vencimento_asc">⏰ Validade Mais Próxima</option>
              <option value="estoque_desc">📦 Maior Estoque em Unidades</option>
              <option value="nome_asc">🔤 Nome do Produto (A-Z)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
