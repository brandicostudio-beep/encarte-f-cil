import React from "react";
import type { ValidadeKpiCounts, FaixaVencimento } from "@/types/painel-validade";
import { AlertCircle, Clock, AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";

export interface PainelValidadeKpiCardsProps {
  kpiCounts?: ValidadeKpiCounts;
  counts?: ValidadeKpiCounts;
  activeFaixa?: FaixaVencimento | "todas";
  selectedFaixa?: FaixaVencimento | "todas";
  onSelectFaixa?: (faixa: FaixaVencimento) => void;
  onFaixaClick?: (faixa: FaixaVencimento) => void;
}

export const PainelValidadeKpiCards: React.FC<PainelValidadeKpiCardsProps> = ({
  kpiCounts,
  counts,
  activeFaixa,
  selectedFaixa,
  onSelectFaixa,
  onFaixaClick,
}) => {
  const effectiveCounts: ValidadeKpiCounts = kpiCounts || counts || {
    vencidos: 0,
    ate7d: 0,
    de8a30d: 0,
    de31a60d: 0,
    de61a90d: 0,
    acima90d: 0,
    total: 0,
  };

  const effectiveActive = activeFaixa || selectedFaixa || "todas";

  const handleSelect = (faixa: FaixaVencimento) => {
    if (onSelectFaixa) onSelectFaixa(faixa);
    if (onFaixaClick) onFaixaClick(faixa);
  };

  const cards: Array<{
    faixa: FaixaVencimento;
    titulo: string;
    subtitulo: string;
    contagem: number;
    bgClass: string;
    borderClass: string;
    textClass: string;
    badgeClass: string;
    activeRing: string;
    icon: React.ReactNode;
  }> = [
    {
      faixa: "vencido",
      titulo: "Vencidos",
      subtitulo: "Menos de 0 dias",
      contagem: effectiveCounts.vencidos,
      bgClass: "bg-red-950/10 hover:bg-red-950/20",
      borderClass: "border-red-900/60",
      textClass: "text-red-950 dark:text-red-200",
      badgeClass: "bg-red-900 text-white",
      activeRing: "ring-4 ring-red-900 bg-red-900/20",
      icon: <AlertCircle className="h-6 w-6 text-red-900 dark:text-red-400" />,
    },
    {
      faixa: "ate_7d",
      titulo: "Até 7 dias",
      subtitulo: "0 a 7 dias",
      contagem: effectiveCounts.ate7d,
      bgClass: "bg-red-500/10 hover:bg-red-500/20",
      borderClass: "border-red-600/50",
      textClass: "text-red-700 dark:text-red-300",
      badgeClass: "bg-red-600 text-white",
      activeRing: "ring-4 ring-red-600 bg-red-50 dark:bg-red-950/40",
      icon: <Clock className="h-6 w-6 text-red-600 dark:text-red-400" />,
    },
    {
      faixa: "8_a_30d",
      titulo: "8 a 30 dias",
      subtitulo: "8 a 30 dias",
      contagem: effectiveCounts.de8a30d,
      bgClass: "bg-orange-500/10 hover:bg-orange-500/20",
      borderClass: "border-orange-500/50",
      textClass: "text-orange-800 dark:text-orange-300",
      badgeClass: "bg-orange-500 text-white",
      activeRing: "ring-4 ring-orange-500 bg-orange-50 dark:bg-orange-950/40",
      icon: <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />,
    },
    {
      faixa: "31_a_60d",
      titulo: "31 a 60 dias",
      subtitulo: "31 a 60 dias",
      contagem: effectiveCounts.de31a60d,
      bgClass: "bg-amber-400/15 hover:bg-amber-400/25",
      borderClass: "border-amber-400/60",
      textClass: "text-amber-800 dark:text-amber-300",
      badgeClass: "bg-amber-500 text-neutral-900 font-black",
      activeRing: "ring-4 ring-amber-500 bg-amber-50 dark:bg-amber-950/40",
      icon: <Calendar className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    },
    {
      faixa: "61_a_90d",
      titulo: "61 a 90 dias",
      subtitulo: "61 a 90 dias",
      contagem: effectiveCounts.de61a90d,
      bgClass: "bg-emerald-500/10 hover:bg-emerald-500/20",
      borderClass: "border-emerald-500/50",
      textClass: "text-emerald-800 dark:text-emerald-300",
      badgeClass: "bg-emerald-600 text-white",
      activeRing: "ring-4 ring-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
          Urgência de Vencimento (Clique para filtrar)
        </span>
        <span className="text-xs font-mono text-neutral-500">
          Total de {effectiveCounts.total} lotes analisados
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => {
          const isSelected = effectiveActive === c.faixa;
          return (
            <button
              key={c.faixa}
              type="button"
              onClick={() => handleSelect(c.faixa)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group active:scale-97 ${
                c.bgClass
              } ${c.borderClass} ${
                isSelected ? c.activeRing : "shadow-xs hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {c.titulo}
                </span>
                <div className="p-1 rounded-lg bg-white/70 dark:bg-slate-800/80 shadow-2xs group-hover:scale-110 transition-transform">
                  {c.icon}
                </div>
              </div>

              {/* Número com pelo menos 48px (text-5xl) */}
              <div
                className={`text-5xl font-black font-mono tracking-tight mt-2 ${c.textClass}`}
              >
                {c.contagem}
              </div>

              <div className="text-[11px] opacity-75 font-medium mt-1">
                {c.subtitulo}
              </div>

              {isSelected && (
                <div className="mt-2 text-[10px] font-black uppercase text-center py-0.5 rounded bg-black/80 text-white">
                  Filtro Ativo
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
