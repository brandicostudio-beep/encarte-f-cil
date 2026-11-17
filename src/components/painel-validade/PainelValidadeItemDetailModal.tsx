import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ValidadeLoteCalculado } from "@/types/painel-validade";
import {
  Clock,
  Package,
  TrendingDown,
  BarChart3,
  Calendar,
  AlertTriangle,
  User,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export interface PainelValidadeItemDetailContentProps {
  lote: ValidadeLoteCalculado;
}

export const PainelValidadeItemDetailContent: React.FC<PainelValidadeItemDetailContentProps> = ({
  lote,
}) => {
  // Encontra o maior valor entre os 4 meses para dimensionar as barras do gráfico
  const maxVenda = Math.max(
    1,
    lote.vendaM3,
    lote.vendaM2,
    lote.vendaM1,
    lote.vendaMesAtual
  );

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border">
              {lote.codprod}
            </span>
            {lote.noEncarte && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-yellow-400 text-yellow-950 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                NO ENCARTE
              </span>
            )}
          </div>

          <span
            className={`px-3 py-1 rounded-xl text-xs font-black font-mono border ${
              lote.isVencido
                ? "bg-red-950 text-white border-red-900"
                : lote.diasParaVencer <= 7
                ? "bg-red-600 text-white border-red-700"
                : lote.diasParaVencer <= 30
                ? "bg-orange-500 text-white border-orange-600"
                : "bg-emerald-600 text-white border-emerald-700"
            }`}
          >
            {lote.isVencido
              ? `Vencido (${Math.abs(lote.diasParaVencer)}d)`
              : `Vence em ${lote.diasParaVencer} dias`}
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-2 leading-tight">
          {lote.descricao}
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Embalagem: {lote.embalagem} • Data de Validade: {lote.dtval}
        </p>
      </div>

      <div className="space-y-6">
        {/* Gráfico Visual de 4 Meses de Vendas */}
        <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 font-bold text-sm text-neutral-800">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span>Histórico de Vendas Mensais</span>
            </div>
            {lote.vendaIrregular && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="h-3 w-3 text-amber-700" />
                Venda Irregular
              </span>
            )}
          </div>

          {/* Barras Horizontais */}
          <div className="space-y-2 text-xs">
            {/* M-3 */}
            <div>
              <div className="flex justify-between text-neutral-600 mb-1">
                <span>M-3 (3 meses atrás)</span>
                <span className="font-mono font-bold">{lote.vendaM3} un</span>
              </div>
              <div className="h-3 w-full bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(lote.vendaM3 / maxVenda) * 100}%` }}
                />
              </div>
            </div>

            {/* M-2 */}
            <div>
              <div className="flex justify-between text-neutral-600 mb-1">
                <span>M-2 (2 meses atrás)</span>
                <span className="font-mono font-bold">{lote.vendaM2} un</span>
              </div>
              <div className="h-3 w-full bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(lote.vendaM2 / maxVenda) * 100}%` }}
                />
              </div>
            </div>

            {/* M-1 */}
            <div>
              <div className="flex justify-between text-neutral-600 mb-1">
                <span>M-1 (mês passado)</span>
                <span className="font-mono font-bold">{lote.vendaM1} un</span>
              </div>
              <div className="h-3 w-full bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(lote.vendaM1 / maxVenda) * 100}%` }}
                />
              </div>
            </div>

            {/* Mês atual parcial */}
            <div className="pt-1 border-t border-neutral-200">
              <div className="flex justify-between text-neutral-700 mb-1 font-semibold">
                <span className="flex items-center gap-1">
                  Mês Atual (parcial)
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      lote.ritmoMesStatus === "acima_normal"
                        ? "bg-emerald-100 text-emerald-800"
                        : lote.ritmoMesStatus === "abaixo_normal"
                        ? "bg-red-100 text-red-800"
                        : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {lote.ritmoMesStatus === "acima_normal"
                      ? "Acima do normal"
                      : lote.ritmoMesStatus === "abaixo_normal"
                      ? "Abaixo do normal"
                      : "Normal"}
                  </span>
                </span>
                <span className="font-mono font-bold text-neutral-900">{lote.vendaMesAtual} un</span>
              </div>
              <div className="h-3 w-full bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    lote.ritmoMesStatus === "abaixo_normal" ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${(lote.vendaMesAtual / maxVenda) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Comparação Crucial de Ritmo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
            <div className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              Ritmo Atual (3m)
            </div>
            <div className="text-2xl font-black font-mono text-blue-950 mt-1">
              {lote.ritmoAtualDia.toFixed(1).replace(".", ",")} <span className="text-xs font-normal">un/dia</span>
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              Média mensal de {lote.mediaMensalFechada} un ÷ 30 dias
            </p>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            lote.ritmoNecessarioDia > lote.ritmoAtualDia
              ? "border-red-300 bg-red-50/60 text-red-950"
              : "border-emerald-300 bg-emerald-50/60 text-emerald-950"
          }`}>
            <div className="text-xs font-bold uppercase tracking-wide">
              Ritmo Necessário
            </div>
            <div className="text-2xl font-black font-mono mt-1">
              {lote.isVencido
                ? "Vencido"
                : `${lote.ritmoNecessarioDia.toFixed(1).replace(".", ",")} un/dia`}
            </div>
            <p className="text-[11px] opacity-80 mt-1">
              Estoque {lote.estoque} un ÷ {lote.diasParaVencer} dias para vencer
            </p>
          </div>
        </div>

        {/* Resumo de Estoque & Escoamento */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center text-xs">
          <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200">
            <span className="text-neutral-500 block">Estoque Lote</span>
            <span className="text-lg font-black font-mono text-neutral-900 block mt-0.5">
              {lote.estoque} un
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200">
            <span className="text-neutral-500 block">Escoa a Tempo</span>
            <span className={`text-lg font-black font-mono block mt-0.5 ${
              lote.escoaTempoPercent >= 100
                ? "text-emerald-700"
                : lote.escoaTempoPercent >= 60
                ? "text-amber-700"
                : "text-red-700"
            }`}>
              {lote.escoaTempoPercent}%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 col-span-2 sm:col-span-1">
            <span className="text-neutral-500 block">Sobra Prevista</span>
            <span className="text-lg font-black font-mono text-red-700 block mt-0.5">
              {lote.sobraPrevistaUnidades} un
            </span>
          </div>
        </div>

        {/* Dados Complementares e Risco Financeiro */}
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Cobertura Prevista de Estoque:</span>
              <span className="font-bold font-mono text-neutral-900">
                {lote.coberturaMeses !== null
                  ? `${lote.coberturaMeses} meses`
                  : "Sem Venda (Cobertura infinita)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Preço de Venda Unitário:</span>
              <span className="font-bold font-mono text-neutral-900">
                R$ {lote.precoVenda.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5">
              <span className="text-neutral-500 font-semibold">Previsão Valor em Risco:</span>
              <span className="font-black font-mono text-red-700 text-sm">
                R$ {lote.valorEmRisco.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-neutral-200 bg-white space-y-2">
            <div className="font-bold text-neutral-800 uppercase text-[11px]">
              Metadados Winthor / WMS
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Comprador:</span>
              <span className="font-bold text-neutral-900">{lote.nomeComprador}</span>
            </div>
            {lote.prazoval !== undefined && lote.prazoval > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Prazo de Validade (dias):</span>
                <span className="font-bold font-mono text-neutral-900">{lote.prazoval} dias</span>
              </div>
            )}
            {lote.percentTolerancia !== undefined && lote.percentTolerancia > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">% Tolerância Recebimento:</span>
                <span className="font-bold font-mono text-neutral-900">{lote.percentTolerancia}%</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-1.5">
              <span className="text-neutral-500">Presença no Encarte:</span>
              <span className={`font-bold ${lote.noEncarte ? "text-yellow-700" : "text-neutral-500"}`}>
                {lote.noEncarte ? "⭐ Sim (Ativo no Geraencarte)" : "Não incluído"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface PainelValidadeItemDetailModalProps {
  lote: ValidadeLoteCalculado | null;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export const PainelValidadeItemDetailModal: React.FC<PainelValidadeItemDetailModalProps> = ({
  lote,
  open,
  onOpenChange,
  onClose,
}) => {
  if (!lote) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (onOpenChange) onOpenChange(isOpen);
    if (!isOpen && onClose) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-slate-800">
        <PainelValidadeItemDetailContent lote={lote} />
      </DialogContent>
    </Dialog>
  );
};
