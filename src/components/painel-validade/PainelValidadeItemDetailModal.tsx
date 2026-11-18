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
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react";
import {
  gerarDiagnosticoSobraCompleto,
  formatRitmoBR,
} from "@/lib/painel-validade-analytics";
import { PainelValidadeProductImage } from "./PainelValidadeProductImage";

export interface PainelValidadeItemDetailContentProps {
  lote: ValidadeLoteCalculado;
  onToggleEncarte?: (lote: ValidadeLoteCalculado) => void;
  onOpenEncarteEditor?: () => void;
}

export const PainelValidadeItemDetailContent: React.FC<PainelValidadeItemDetailContentProps> = ({
  lote,
  onToggleEncarte,
  onOpenEncarteEditor,
}) => {
  const diagnostico = gerarDiagnosticoSobraCompleto(lote);

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
        <div className="flex items-start gap-4">
          <PainelValidadeProductImage
            src={lote.foto}
            alt={lote.descricao}
            codprod={lote.codprod}
            size="lg"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border">
                  {lote.codprod}
                </span>
                {lote.noEncarte ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-yellow-400 text-yellow-950 uppercase">
                    <Sparkles className="h-3.5 w-3.5" />
                    NO ENCARTE
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleEncarte?.(lote)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-neutral-900 hover:bg-red-700 text-white uppercase shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Zap className="h-3 w-3 text-yellow-400" />
                    + Adicionar ao Encarte
                  </button>
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
            <p className="text-xs text-neutral-500 mt-1">
              Embalagem: <strong className="text-neutral-700">{lote.embalagem}</strong> • Data de Validade: <strong className="text-neutral-800 font-mono">{lote.dtval}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* CARD DE AÇÃO 1-CLIQUE: ENVIAR PARA O ENCARTE MAIS RECENTE */}
      <div className="p-4 rounded-2xl bg-neutral-100/90 border border-neutral-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              lote.noEncarte ? "bg-yellow-400 text-yellow-950" : "bg-neutral-900 text-yellow-400"
            }`}
          >
            {lote.noEncarte ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
              <span>{lote.noEncarte ? "Produto no Encarte Mais Recente" : "Ação Comercial Rápida"}</span>
              {lote.noEncarte && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-300 text-yellow-900 uppercase">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-600 mt-0.5">
              {lote.noEncarte
                ? "Este produto já está incluído no editor de encartes ativo."
                : "Adicione ao encarte com 1 clique para acelerar o giro e escoar a tempo."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {lote.noEncarte ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleEncarte?.(lote)}
                className="text-xs font-semibold text-neutral-600 hover:text-red-700 hover:border-red-300"
              >
                Remover
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (onOpenEncarteEditor) onOpenEncarteEditor();
                  else if (typeof window !== "undefined") window.location.href = "/";
                }}
                className="text-xs font-bold bg-yellow-400 hover:bg-yellow-500 text-yellow-950 shadow-2xs"
              >
                Abrir no Encarte
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onToggleEncarte?.(lote)}
              className="w-full sm:w-auto text-xs font-black bg-neutral-900 hover:bg-red-700 text-white shadow-xs cursor-pointer"
            >
              <Zap className="h-4 w-4 mr-1 text-yellow-400" />
              Enviar para o Encarte Agora
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* SEÇÃO PRINCIPAL: POR QUE VAI SOBRAR (OU PREVISÃO DE SAÍDA) */}
        <section
          data-testid="secao-por-que-vai-sobrar"
          className={`p-5 rounded-2xl border-2 space-y-4 shadow-xs ${
            diagnostico.isEscoa100
              ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
              : diagnostico.isSemVenda
              ? "bg-rose-50/70 border-rose-300 text-rose-950"
              : "bg-amber-50/70 border-amber-300 text-amber-950"
          }`}
        >
          {/* Cabeçalho da Seção */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                  diagnostico.isEscoa100
                    ? "bg-emerald-600"
                    : diagnostico.isSemVenda
                    ? "bg-rose-600"
                    : "bg-amber-600"
                }`}
              >
                {diagnostico.isEscoa100 ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <HelpCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h4 className="text-lg font-black tracking-tight text-neutral-900">
                  {diagnostico.titulo}
                </h4>
                <p className="text-xs text-neutral-600 font-medium">
                  Diagnóstico passo a passo do lote
                </p>
              </div>
            </div>

            {/* Selo Resumo */}
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-2xs ${
                diagnostico.isSemEstoque || diagnostico.estoque === 0
                  ? "bg-neutral-200 text-neutral-800 border-neutral-300"
                  : diagnostico.isEscoa100
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : diagnostico.isSemVenda
                  ? "bg-rose-100 text-rose-900 border-rose-300"
                  : "bg-amber-100 text-amber-900 border-amber-300"
              }`}
            >
              {diagnostico.isSemEstoque || diagnostico.estoque === 0
                ? "Sem Estoque no Winthor"
                : diagnostico.isEscoa100
                ? "100% Escoa a tempo"
                : `~${diagnostico.sobraPrevista} un vão sobrar`}
            </span>
          </div>

          {/* 1. Vendas do histórico: Mês atual (QTVENDMES) e últimos 3 meses */}
          <div className="bg-white/95 p-3.5 rounded-xl border border-neutral-200/80 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Histórico de Vendas (Mês Atual + Últimos 3 Meses)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              {diagnostico.mesesFechados.map((m) => (
                <div
                  key={m.rotulo}
                  className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200"
                >
                  <span className="text-[10px] text-neutral-500 font-semibold block">
                    {m.rotulo} ({m.subtitulo})
                  </span>
                  <span
                    className={`font-mono font-bold text-sm block mt-0.5 ${
                      m.semDados ? "text-neutral-400 italic font-normal" : "text-neutral-900"
                    }`}
                  >
                    {m.textoFormatado}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Média mensal, ritmo por dia, estoque e dias até o vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Média e Ritmo */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-neutral-200/80 text-xs space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Média mensal e ritmo por dia
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-neutral-600">Média mensal:</span>
                <span className="font-mono font-bold text-neutral-900">
                  {diagnostico.isSemVenda
                    ? "0 un/mês (sem venda)"
                    : `${diagnostico.mediaMensalFechada} un/mês`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Ritmo de saída por dia:</span>
                <span className="font-mono font-black text-neutral-900 text-sm">
                  {diagnostico.isSemVenda
                    ? "0 un/dia (sem venda)"
                    : `${formatRitmoBR(diagnostico.ritmoAtualDia)} un/dia`}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 pt-0.5">
                (média dos períodos com dados ÷ 30 dias do mês)
              </p>
            </div>

            {/* Estoque e Dias até Vencer */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-neutral-200/80 text-xs space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Estoque atual e prazo
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-neutral-600">Disponível para venda:</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-neutral-900">
                    {diagnostico.isSemEstoque || diagnostico.estoque === 0 ? (
                      <span className="text-neutral-500 font-bold">Sem estoque (0 {lote.embalagem})</span>
                    ) : (
                      <>{diagnostico.estoque} <span className="text-neutral-500 font-normal">{lote.embalagem}</span></>
                    )}
                  </span>
                  {lote.qtdisp_wms !== undefined &&
                    lote.qtest_winthor !== undefined && (
                      <span className="text-[10px] text-neutral-500 block">
                        Winthor: {lote.qtest_winthor} un • WMS: {lote.qtdisp_wms} un
                      </span>
                    )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Dias até o vencimento:</span>
                <span className="font-mono font-black text-neutral-900">
                  {diagnostico.diasParaVencer} dias ({lote.dtval})
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-neutral-100">
                <span className="text-neutral-600">Venda prevista até vencer:</span>
                <span className="font-mono font-bold text-blue-700">
                  ~{diagnostico.vendaPrevista} un
                </span>
              </div>
            </div>
          </div>

          {/* 3. Projeção de Sobra e Percentual que Escoa a Tempo */}
          <div className="bg-white/95 p-3.5 rounded-xl border border-neutral-200/80 text-xs space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Sobra prevista e escoamento
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {diagnostico.isSemEstoque || diagnostico.estoque === 0 ? (
                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 col-span-2">
                  <span className="text-neutral-500 text-[11px] font-semibold block">
                    Situação do lote
                  </span>
                  <span className="text-sm font-bold text-neutral-700 block mt-1">
                    Sem estoque no Winthor (0 un) • Não há sobra prevista
                  </span>
                </div>
              ) : (
                <>
                  <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-500 text-[11px] block">Escoa a tempo</span>
                    <span
                      className={`text-xl font-black font-mono block mt-0.5 ${
                        diagnostico.isEscoa100
                          ? "text-emerald-700"
                          : diagnostico.escoaTempoPercent >= 60
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}
                    >
                      {diagnostico.escoaTempoPercent}%
                    </span>
                  </div>

                  {!diagnostico.isEscoa100 ? (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                      <span className="text-red-700 text-[11px] font-semibold block">
                        Sobra prevista (estoque − venda prevista)
                      </span>
                      <span className="text-xl font-black font-mono text-red-700 block mt-0.5">
                        ~{diagnostico.sobraPrevista} un
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-emerald-700 text-[11px] font-semibold block">
                        Situação do lote
                      </span>
                      <span className="text-sm font-bold text-emerald-800 block mt-1">
                        Demanda suficiente para escoar 100%
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 4. O cálculo escrito em frases simples, sem fórmulas */}
          <div className="bg-white/95 p-4 rounded-xl border border-neutral-200/80 text-xs space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <span>Explicação em Frases Simples:</span>
            </div>
            <p className="text-neutral-800 leading-relaxed font-medium text-sm">
              {diagnostico.explicacaoSimples}
            </p>
          </div>

          {/* 5. Ação Comercial Recomendada & Risco Financeiro Real da Sobra */}
          <div className="bg-white/95 p-4 rounded-xl border border-neutral-200/80 text-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-600" />
                <span>Diagnóstico Comercial & Ação Recomendada:</span>
              </div>

              {diagnostico.multiplicadorEsforco && diagnostico.multiplicadorEsforco > 1 && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                    diagnostico.multiplicadorEsforco > 2.5
                      ? "bg-red-100 text-red-800 border border-red-300"
                      : diagnostico.multiplicadorEsforco > 1.5
                      ? "bg-orange-100 text-orange-800 border border-orange-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  Acelerar giro em {diagnostico.multiplicadorEsforco}x
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/90 text-sm font-semibold text-neutral-800 leading-relaxed">
              {diagnostico.recomendacaoComercial}
            </div>

            {/* Prejuízo financeiro real previsto caso a sobra ocorra */}
            {diagnostico.sobraPrevista > 0 && diagnostico.prejuizoPrevistoSobra > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                <span className="text-neutral-600">
                  Prejuízo previsto se nada for feito (preço de venda da sobra):
                </span>
                <span className="font-mono font-black text-red-700 text-sm">
                  R$ {diagnostico.prejuizoPrevistoSobra.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* 5. Alerta de Venda Irregular (se houver) */}
          {diagnostico.avisoIrregularidade && (
            <div className="p-3.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Aviso de Venda Irregular:</strong>
                <span className="leading-relaxed">{diagnostico.avisoIrregularidade}</span>
              </div>
            </div>
          )}
        </section>

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
                <span className="font-mono font-bold">
                  {lote.vendaM3Raw === null ? "sem dados" : `${lote.vendaM3} un`}
                </span>
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
                <span className="font-mono font-bold">
                  {lote.vendaM2Raw === null ? "sem dados" : `${lote.vendaM2} un`}
                </span>
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
                <span className="font-mono font-bold">
                  {lote.vendaM1Raw === null ? "sem dados" : `${lote.vendaM1} un`}
                </span>
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
                <span className="font-mono font-bold text-neutral-900">
                  {lote.vendaMesAtualRaw === null ? "sem dados" : `${lote.vendaMesAtual} un`}
                  {diagnostico.vendaEsperadaMesAtual > 0 && (
                    <span className="text-[10px] font-normal text-neutral-500 ml-1.5">
                      (esperado: ~{diagnostico.vendaEsperadaMesAtual} un)
                    </span>
                  )}
                </span>
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
              Ritmo Atual de Venda
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
  onToggleEncarte?: (lote: ValidadeLoteCalculado) => void;
  onOpenEncarteEditor?: () => void;
}

export const PainelValidadeItemDetailModal: React.FC<PainelValidadeItemDetailModalProps> = ({
  lote,
  open,
  onOpenChange,
  onClose,
  onToggleEncarte,
  onOpenEncarteEditor,
}) => {
  if (!lote) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (onOpenChange) onOpenChange(isOpen);
    if (!isOpen && onClose) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-slate-800">
        <PainelValidadeItemDetailContent
          lote={lote}
          onToggleEncarte={onToggleEncarte}
          onOpenEncarteEditor={onOpenEncarteEditor}
        />
      </DialogContent>
    </Dialog>
  );
};
