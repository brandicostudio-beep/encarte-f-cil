import React from "react";
import {
  AlertOctagon,
  Flame,
  PauseCircle,
  TrendingDown,
  Sparkles,
  Info,
} from "lucide-react";
import type { ValidadeAlertCounts, ValidadeFilterParams } from "@/types/painel-validade";

export interface PainelValidadeAlertsBarProps {
  alertCounts?: ValidadeAlertCounts;
  counts?: ValidadeAlertCounts;
  onApplyQuickAlertFilter?: (filter: ValidadeFilterParams["filtroRapido"]) => void;
  onAlertClick?: (tipo: keyof ValidadeAlertCounts | ValidadeFilterParams["filtroRapido"]) => void;
  activeFilter?: ValidadeFilterParams["filtroRapido"];
}

export const PainelValidadeAlertsBar: React.FC<PainelValidadeAlertsBarProps> = ({
  alertCounts,
  counts,
  onApplyQuickAlertFilter,
  onAlertClick,
  activeFilter,
}) => {
  const effectiveCounts: ValidadeAlertCounts = alertCounts || counts || {
    critico: 0,
    urgente: 0,
    parado: 0,
    ritmoCaiu: 0,
    novoLote: 0,
    saiuDoEncarte: 0,
  };

  const handleFilter = (filterKey: ValidadeFilterParams["filtroRapido"], alertKey: keyof ValidadeAlertCounts) => {
    if (onApplyQuickAlertFilter) onApplyQuickAlertFilter(filterKey);
    if (onAlertClick) onAlertClick(alertKey);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-neutral-200/80 dark:border-slate-800 p-3 shadow-xs">
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <Info className="h-4 w-4 text-neutral-500" />
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
          Alertas Operacionais de Validade (Toque para filtrar)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Alerta 1: Crítico */}
        <button
          type="button"
          onClick={() => handleFilter("critico", "critico")}
          className={`min-h-[56px] flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-98 ${
            activeFilter === "critico"
              ? "bg-red-700 text-white border-red-800 shadow-sm ring-2 ring-red-400"
              : effectiveCounts.critico > 0
              ? "bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-200 border-red-200 dark:border-red-900 hover:bg-red-100"
              : "bg-neutral-50 dark:bg-slate-800 text-neutral-500 border-neutral-200 dark:border-slate-700"
          }`}
          title="Vence em até 30 dias E previsão de escoar menos de 60%"
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                activeFilter === "critico"
                  ? "bg-red-800 text-white"
                  : "bg-red-200/80 dark:bg-red-900/60 text-red-800 dark:text-red-200"
              }`}
            >
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-tight leading-tight">
                Crítico (≤ 30d)
              </div>
              <div className="text-[11px] opacity-80 leading-none mt-0.5">
                Escoa &lt; 60%
              </div>
            </div>
          </div>
          <span className="text-2xl font-black font-mono ml-2">
            {effectiveCounts.critico}
          </span>
        </button>

        {/* Alerta 2: Urgente (Até 7 dias) */}
        <button
          type="button"
          onClick={() => handleFilter("vence_7d", "urgente")}
          className={`min-h-[56px] flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-98 ${
            activeFilter === "vence_7d"
              ? "bg-orange-600 text-white border-orange-700 shadow-sm ring-2 ring-orange-300"
              : effectiveCounts.urgente > 0
              ? "bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-900 hover:bg-orange-100"
              : "bg-neutral-50 dark:bg-slate-800 text-neutral-500 border-neutral-200 dark:border-slate-700"
          }`}
          title="Vence nos próximos 7 dias e não tem saída garantida"
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                activeFilter === "vence_7d"
                  ? "bg-orange-700 text-white"
                  : "bg-orange-200/80 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200"
              }`}
            >
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-tight leading-tight">
                Vence em 7 dias
              </div>
              <div className="text-[11px] opacity-80 leading-none mt-0.5">
                Urgência Máxima
              </div>
            </div>
          </div>
          <span className="text-2xl font-black font-mono ml-2">
            {effectiveCounts.urgente}
          </span>
        </button>

        {/* Alerta 3: Parado */}
        <button
          type="button"
          onClick={() => handleFilter("parado", "parado")}
          className={`min-h-[56px] flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-98 ${
            activeFilter === "parado"
              ? "bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300"
              : effectiveCounts.parado > 0
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900 hover:bg-amber-100"
              : "bg-neutral-50 dark:bg-slate-800 text-neutral-500 border-neutral-200 dark:border-slate-700"
          }`}
          title="Sem nenhuma venda nos 3 meses fechados e vence em até 90 dias"
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                activeFilter === "parado"
                  ? "bg-amber-700 text-white"
                  : "bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
              }`}
            >
              <PauseCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-tight leading-tight">
                Sem Vendas (3m)
              </div>
              <div className="text-[11px] opacity-80 leading-none mt-0.5">
                Estoque Parado
              </div>
            </div>
          </div>
          <span className="text-2xl font-black font-mono ml-2">
            {effectiveCounts.parado}
          </span>
        </button>

        {/* Alerta 4: Vai Sobrar */}
        <button
          type="button"
          onClick={() => handleFilter("vai_sobrar", "ritmoCaiu")}
          className={`min-h-[56px] flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-98 ${
            activeFilter === "vai_sobrar"
              ? "bg-red-800 text-white border-red-900 shadow-sm ring-2 ring-red-400"
              : effectiveCounts.ritmoCaiu > 0
              ? "bg-red-50/70 dark:bg-red-950/40 text-red-950 dark:text-red-200 border-red-200 dark:border-red-900 hover:bg-red-100"
              : "bg-neutral-50 dark:bg-slate-800 text-neutral-500 border-neutral-200 dark:border-slate-700"
          }`}
          title="Ritmo atual insuficiente: sobra prevista no vencimento"
        >
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                activeFilter === "vai_sobrar"
                  ? "bg-red-900 text-white"
                  : "bg-red-200/80 dark:bg-red-900/60 text-red-800 dark:text-red-200"
              }`}
            >
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-tight leading-tight">
                Vai Sobrar Lote
              </div>
              <div className="text-[11px] opacity-80 leading-none mt-0.5">
                Escoa &lt; 60%
              </div>
            </div>
          </div>
          <span className="text-2xl font-black font-mono ml-2">
            {effectiveCounts.ritmoCaiu}
          </span>
        </button>
      </div>
    </div>
  );
};
