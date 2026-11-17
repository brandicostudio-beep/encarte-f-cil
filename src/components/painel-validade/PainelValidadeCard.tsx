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
}

export const PainelValidadeCard: React.FC<PainelValidadeCardProps> = ({
  lote,
  onOpenDetail,
  onClick,
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
                <span className="font-mono font-bold text-sm bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-md border border-neutral-200">
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

                {/* Selo Amarelo Grande NO ENCARTE (Conforme Especificação) */}
                {lote.noEncarte && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black bg-yellow-400 text-yellow-950 border border-yellow-500 shadow-xs uppercase tracking-wider"
                    title="Este produto está incluído e ativo no encarte do Geraencarte"
                  >
                    <Sparkles className="h-4 w-4 text-yellow-900 shrink-0" />
                    NO ENCARTE
                  </span>
                )}

                {/* Lote novo no snapshot */}
                {lote.isNovoLote && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Novo Lote
                  </span>
                )}

                {/* Badge Aceleração de Giro (Multiplicador de Esforço) */}
                {lote.multiplicadorEsforco && lote.multiplicadorEsforco > 1.5 && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border ${
                      lote.multiplicadorEsforco > 2.5
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-orange-100 text-orange-800 border-orange-300"
                    }`}
                    title={`Necessita acelerar vendas em ${lote.multiplicadorEsforco}x`}
                  >
                    <Zap className="h-3 w-3" />
                    {lote.multiplicadorEsforco}x giro
                  </span>
                )}
              </div>

              {/* Badge Vencimento */}
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
                  className="font-black text-neutral-900 tracking-tight leading-snug line-clamp-2 group-hover:text-red-700 transition-colors"
                  style={{ fontSize: "22px" }}
                  title={lote.descricao}
                >
                  {lote.descricao}
                </h2>
                <div className="text-xs text-neutral-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                  <span>Embalagem: <strong className="text-neutral-700">{lote.embalagem}</strong></span>
                  <span>•</span>
                  <span>Validade: <strong className="text-neutral-800 font-mono">{lote.dtval}</strong></span>
                </div>
              </div>
            </div>

            {/* 3. BARRA DE ESCOA A TEMPO (%) OU SITUAÇÃO SEM ESTOQUE */}
            {isSemEstoque ? (
              <div className="bg-neutral-100/70 p-3 rounded-xl border border-neutral-200/90 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-600 flex items-center gap-1.5">
                    <PackageX className="h-4 w-4 text-neutral-500" />
                    Situação do Estoque:
                  </span>
                  <span className="font-mono text-xs font-black text-neutral-700 uppercase bg-neutral-200 px-2 py-0.5 rounded border border-neutral-300">
                    Sem Estoque
                  </span>
                </div>

                {/* Barra de Progresso Zerada */}
                <div className="w-full h-2.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full rounded-full bg-neutral-400 w-0" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium pt-0.5">
                  <span>Estoque zerado no Winthor</span>
                  <span className="text-neutral-600 font-bold">Sem sobra prevista</span>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-600">Escoa a tempo até o vencimento:</span>
                  <span className={`font-mono text-sm font-black ${escoaBar.textClass}`}>
                    {escoaBar.label}
                  </span>
                </div>

                {/* Barra de Progresso Colorida */}
                <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${escoaBar.barBg}`}
                    style={{ width: `${Math.min(100, Math.max(3, lote.escoaTempoPercent))}%` }}
                  />
                </div>

                {/* Projeção de Sobra ou Saída */}
                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium pt-0.5">
                  <span>Ritmo atual: <strong>{formatRitmoBR(lote.ritmoAtualDia)} un/dia</strong></span>
                  {lote.sobraPrevistaUnidades > 0 ? (
                    <span className="text-red-700 font-bold">
                      Previsão de sobra: ~{Math.round(lote.sobraPrevistaUnidades)} un
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      Estoque deve escoar totalmente
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 4. RODAPÉ DO CARD: ESTOQUE, COMPRADOR E BOTÃO DETALHES */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
              {/* Estoque em destaque */}
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    isSemEstoque
                      ? "bg-neutral-100 text-neutral-400"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {isSemEstoque ? <PackageX className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase font-semibold">
                    {isSemEstoque ? "Estoque (Winthor)" : "Estoque Atual"}
                  </div>
                  <div className="text-base font-black text-neutral-900 font-mono leading-none">
                    {isSemEstoque ? (
                      <span className="text-xs sm:text-sm font-bold text-neutral-500">
                        Sem estoque
                      </span>
                    ) : (
                      <>
                        {lote.estoque} <span className="text-xs font-normal text-neutral-500">{lote.embalagem}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Comprador & Ação */}
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-neutral-500 uppercase font-semibold">
                    Comprador
                  </div>
                  <div className="text-xs font-bold text-neutral-700 truncate max-w-[120px]">
                    {lote.nomeComprador}
                  </div>
                </div>

                <div className="h-9 w-9 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
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
