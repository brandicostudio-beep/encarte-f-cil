import React from "react";
import type { ValidadeLoteCalculado } from "@/types/painel-validade";
import {
  Package,
  PackageX,
  Clock,
  TrendingDown,
  User,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Zap,
  Eye,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  gerarExplicacaoSobraLinha,
  formatRitmoBR,
} from "@/lib/painel-validade-analytics";
import { PainelValidadeProductImage } from "./PainelValidadeProductImage";

interface PainelValidadeCardProps {
  lote: ValidadeLoteCalculado;
  onOpenDetail?: (lote: ValidadeLoteCalculado) => void;
  onClick?: () => void;
  onToggleEncarte?: (lote: ValidadeLoteCalculado) => void;
}

export const PainelValidadeCard: React.FC<PainelValidadeCardProps> = ({
  lote,
  onOpenDetail,
  onClick,
  onToggleEncarte,
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const motivoLinha = gerarExplicacaoSobraLinha(lote);

  const handleOpenDetail = () => {
    setIsTooltipOpen(false);
    if (onOpenDetail) {
      onOpenDetail(lote);
    } else if (onClick) {
      onClick();
    }
  };
  // Cores da faixa de vencimento
  const getVencimentoBadge = () => {
    if (lote.isVencido) {
      return {
        bg: "bg-red-950 text-white border-red-900",
        label: `🚫 VENCIDO (${Math.abs(lote.diasParaVencer)}d atrás)`,
      };
    }
    if (lote.diasParaVencer === 0) {
      return {
        bg: "bg-red-700 text-white border-red-800 animate-pulse",
        label: "🚨 Vence HOJE!",
      };
    }
    if (lote.diasParaVencer === 1) {
      return {
        bg: "bg-red-600 text-white border-red-700 animate-pulse",
        label: "🚨 Vence AMANHÃ (1d)",
      };
    }
    if (lote.diasParaVencer <= 7) {
      return {
        bg: "bg-red-600 text-white border-red-700",
        label: `🔥 Vence em ${lote.diasParaVencer} dias`,
      };
    }
    if (lote.diasParaVencer <= 30) {
      return {
        bg: "bg-orange-500 text-white border-orange-600",
        label: `⏰ Vence em ${lote.diasParaVencer} dias`,
      };
    }
    if (lote.diasParaVencer <= 60) {
      return {
        bg: "bg-amber-400 text-amber-950 border-amber-500",
        label: `⚠️ Vence em ${lote.diasParaVencer} dias`,
      };
    }
    if (lote.diasParaVencer <= 90) {
      return {
        bg: "bg-emerald-600 text-white border-emerald-700",
        label: `🟢 Vence em ${lote.diasParaVencer} dias`,
      };
    }
    return {
      bg: "bg-neutral-100 text-neutral-800 border-neutral-300",
      label: `📅 ${lote.diasParaVencer} dias`,
    };
  };

  const vencBadge = getVencimentoBadge();

  // Cores da barra de Escoa a Tempo
  const getEscoaBarColors = () => {
    if (lote.escoaTempoPercent >= 100) {
      return {
        barBg: "bg-emerald-500",
        textClass: "text-emerald-700",
        label: "100% Escoa a tempo",
      };
    }
    if (lote.escoaTempoPercent >= 60) {
      return {
        barBg: "bg-amber-500",
        textClass: "text-amber-800",
        label: `${Math.round(lote.escoaTempoPercent)}% No limite`,
      };
    }
    return {
      barBg: "bg-red-600",
      textClass: "text-red-700",
      label: `${Math.round(lote.escoaTempoPercent)}% Vai sobrar`,
    };
  };

  const escoaBar = getEscoaBarColors();

  // Destaque de borda para casos críticos e sem estoque
  const isSemEstoque = lote.isSemEstoque || lote.estoque === 0;
  const isCritico =
    !isSemEstoque &&
    lote.diasParaVencer <= 30 &&
    lote.escoaTempoPercent < 60 &&
    !lote.isVencido;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            title={motivoLinha}
            data-motivo-sobra={motivoLinha}
            aria-label={`${lote.descricao}. ${motivoLinha}`}
            onClick={handleOpenDetail}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsTooltipOpen(false);
                return;
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenDetail();
              }
            }}
            className={`rounded-2xl border bg-white p-5 shadow-xs hover:shadow-md transition-all cursor-pointer text-left flex flex-col justify-between gap-4 group ${
              isSemEstoque
                ? "border-neutral-200 bg-neutral-50/50 opacity-90"
                : lote.isVencido
                ? "border-red-900/50 bg-red-50/20"
                : isCritico
                ? "border-l-8 border-l-red-600 border-neutral-200"
                : lote.diasParaVencer <= 7
                ? "border-l-8 border-l-orange-500 border-neutral-200"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {/* 1. TOPO: CÓDIGO, SELO NO ENCARTE & VENCIMENTO */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Código do produto */}
                <span className="font-mono font-bold text-sm bg-neutral-100 dark:bg-slate-800 text-neutral-800 dark:text-neutral-200 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-slate-700">
                  {lote.codprod}
                </span>

                {/* Selo SEM ESTOQUE quando estoque for zero no Winthor */}
                {isSemEstoque && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black bg-neutral-200 text-neutral-800 border border-neutral-300 shadow-2xs uppercase tracking-wider"
                    title="Produto sem estoque disponível no Winthor"
                  >
                    <PackageX className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    SEM ESTOQUE
                  </span>
                )}

                {/* Ação 1 Clique: NO ENCARTE / + ENCARTE */}
                {lote.noEncarte ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEncarte?.(lote);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border border-yellow-500 shadow-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                    title="Produto incluído no encarte mais recente. Clique para gerenciar ou remover"
                  >
                    <Sparkles className="h-4 w-4 text-yellow-900 shrink-0" />
                    NO ENCARTE
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEncarte?.(lote);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black bg-neutral-900 hover:bg-red-700 text-white border border-neutral-800 shadow-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer hover:shadow-md"
                    title="Enviar lote para o encarte mais recente com 1 clique"
                  >
                    <Zap className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    + ENCARTE
                  </button>
                )}
              </div>

              {/* Badge Vencimento com Dias em Evidência */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black border shadow-2xs ${vencBadge.bg}`}
              >
                <Clock className="h-4 w-4 shrink-0" />
                {vencBadge.label}
              </span>
            </div>

            {/* 2. NOME DO PRODUTO COM FOTO (>= 22px em negrito para 70+ e clareza visual) */}
            <div className="flex items-start gap-3 sm:gap-4">
              <PainelValidadeProductImage
                src={lote.foto}
                alt={lote.descricao}
                codprod={lote.codprod}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <h2
                  className="font-black text-neutral-900 dark:text-white tracking-tight leading-snug line-clamp-2 group-hover:text-red-700 transition-colors"
                  style={{ fontSize: "22px" }}
                  title={lote.descricao}
                >
                  {lote.descricao}
                </h2>
              </div>
            </div>

            {/* 3. AS DUAS INFORMAÇÕES MAIS PRINCIPAIS EM EVIDÊNCIA IMEDIATA (ESTOQUE ATUAL & DIAS PARA VENCER) */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Estoque Atual */}
              <div className="bg-neutral-50 dark:bg-slate-800/60 p-3 rounded-xl border border-neutral-200/90 dark:border-slate-700 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isSemEstoque
                      ? "bg-neutral-200 dark:bg-slate-700 text-neutral-500"
                      : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  {isSemEstoque ? <PackageX className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-black tracking-wider">
                    Estoque Atual
                  </div>
                  <div className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white font-mono leading-tight truncate">
                    {isSemEstoque ? (
                      <span className="text-xs font-bold text-neutral-500">Sem Estoque</span>
                    ) : (
                      <>
                        {lote.estoque}{" "}
                        <span className="text-xs font-bold text-neutral-500 block truncate">
                          {lote.embalagem}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Dias até Vencer */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  lote.isVencido
                    ? "bg-red-50/70 border-red-200 text-red-950 dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-300"
                    : lote.diasParaVencer <= 7
                    ? "bg-orange-50/70 border-orange-200 text-orange-950 dark:bg-orange-950/30 dark:border-orange-900/60 dark:text-orange-300"
                    : lote.diasParaVencer <= 30
                    ? "bg-amber-50/70 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300"
                    : "bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-300"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    lote.isVencido
                      ? "bg-red-700 text-white"
                      : lote.diasParaVencer <= 7
                      ? "bg-orange-500 text-white"
                      : lote.diasParaVencer <= 30
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-black tracking-wider opacity-80">
                    Validade
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono leading-tight truncate">
                    {lote.isVencido ? "Vencido" : `${lote.diasParaVencer} dias`}
                  </div>
                  <div className="text-[11px] font-sans opacity-75 font-medium truncate">
                    até {lote.dtval}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. RESUMO DE ESCOAMENTO (COMPACTO E SEM POLUIÇÃO) */}
            {isSemEstoque ? (
              <div className="bg-neutral-100/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-neutral-200/90 dark:border-slate-700/80 text-xs text-neutral-500">
                <div className="flex items-center justify-between font-bold">
                  <span>Situação:</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">Sem estoque no Winthor</span>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-neutral-200/80 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-600 dark:text-neutral-400">Escoa a tempo:</span>
                  <span className={`font-mono text-xs font-black ${escoaBar.textClass}`}>
                    {escoaBar.label}
                  </span>
                </div>

                {/* Barra de Progresso Colorida */}
                <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${escoaBar.barBg}`}
                    style={{ width: `${Math.min(100, Math.max(3, lote.escoaTempoPercent))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                  {lote.sobraPrevistaUnidades > 0 ? (
                    <span className="text-red-700 dark:text-red-400 font-bold">
                      Previsão de sobra: ~{Math.round(lote.sobraPrevistaUnidades)} un
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      Estoque deve escoar totalmente
                    </span>
                  )}
                  <span>{Math.round(lote.escoaTempoPercent)}%</span>
                </div>
              </div>
            )}

            {/* 5. RODAPÉ DO CARD: BOTÃO COM OLHINHO / LUPA PARA ABRIR ANÁLISE */}
            <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-slate-800 text-xs">
              <div className="inline-flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                <span className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-slate-800 group-hover:bg-red-700 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                  <Eye className="h-4 w-4" />
                </span>
                <span>Ver Análise & Detalhes</span>
              </div>

              <div className="h-8 w-8 rounded-xl bg-neutral-100 dark:bg-slate-800 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 flex items-center justify-center transition-colors">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="z-50 max-w-sm rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl border border-neutral-700 pointer-events-none select-none text-center leading-relaxed hidden sm:block"
        >
          {motivoLinha}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
