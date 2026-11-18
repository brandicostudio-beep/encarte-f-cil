import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CalendarClock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  Image,
  Printer,
  TrendingDown,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const WELCOME_DISMISSED_KEY = "encarte_welcome_dismissed_v1";

interface WelcomeHubModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFlow: (flow: "encarte" | "validade") => void;
}

export const WelcomeHubModal: React.FC<WelcomeHubModalProps> = ({
  open,
  onClose,
  onSelectFlow,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
      setDontShowAgain(isDismissed);
    }
  }, [open]);

  if (!open) return null;

  const handleChooseFlow = (flow: "encarte" | "validade") => {
    if (typeof window !== "undefined") {
      if (dontShowAgain) {
        localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
      } else {
        localStorage.removeItem(WELCOME_DISMISSED_KEY);
      }
    }
    onSelectFlow(flow);
    onClose();
  };

  const handleToggleDontShow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    if (typeof window !== "undefined") {
      if (checked) {
        localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
      } else {
        localStorage.removeItem(WELCOME_DISMISSED_KEY);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-hub-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 text-white rounded-3xl shadow-2xl flex flex-col">
        {/* Botão de Fechar discreto estilo Apple */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar boas-vindas"
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header com design limpo e moderno */}
        <div className="px-6 sm:px-10 pt-10 pb-6 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Central Comercial & Estoque
          </div>

          <h2
            id="welcome-hub-title"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
          >
            Bem-vindo à Plataforma
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
            Selecione o fluxo de trabalho que você deseja acessar agora. Você pode alternar entre eles a qualquer momento pelo menu.
          </p>
        </div>

        {/* Grade com os Dois Fluxos Principais */}
        <div className="p-6 sm:p-10 pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Gerador de Encartes */}
          <div
            onClick={() => handleChooseFlow("encarte")}
            className="group relative cursor-pointer rounded-2xl border border-neutral-800 hover:border-red-500/50 bg-gradient-to-b from-neutral-850 to-neutral-900/90 hover:from-neutral-800 hover:to-neutral-850 p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/30 text-red-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  Criação & Marketing
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
                  Gerador de Encartes
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
                  Criação e diagramação visual de encartes de ofertas semanais com fotos em alta resolução, cálculo de preços e exportação gráfica.
                </p>
              </div>

              <ul className="space-y-2 pt-2 border-t border-neutral-800 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Diagramação A4 para gráfica e formatos digitais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Banco de imagens integrado com busca automática</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Preço de atacado, varejo e parcelamento</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                className="w-full min-h-[48px] bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg group-hover:shadow-red-600/30 transition-all"
              >
                <span>Entrar no Gerador de Encartes</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          {/* Card 2: Painel de Validade */}
          <div
            onClick={() => handleChooseFlow("validade")}
            className="group relative cursor-pointer rounded-2xl border border-neutral-800 hover:border-blue-500/50 bg-gradient-to-b from-neutral-850 to-neutral-900/90 hover:from-neutral-800 hover:to-neutral-850 p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CalendarClock className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Rotina 8230 • Winthor
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  Painel de Validade & Giro
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
                  Controle de lotes a vencer, cálculo inteligente de sobra e giro dos últimos 4 períodos com envio comercial em 1 clique para o encarte.
                </p>
              </div>

              <ul className="space-y-2 pt-2 border-t border-neutral-800 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sincronizado diretamente com a Rotina 8230</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Diagnóstico de esforço de venda e dias de estoque</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1-Clique para enviar produtos em risco para o Encarte</span>
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg group-hover:shadow-blue-600/30 transition-all"
              >
                <span>Acessar Painel de Validade</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>

        {/* Rodapé da tela de boas-vindas */}
        <div className="px-6 sm:px-10 py-4 border-t border-neutral-800/80 bg-neutral-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleToggleDontShow}
              className="rounded border-neutral-700 bg-neutral-800 text-red-600 focus:ring-0 cursor-pointer h-4 w-4"
            />
            <span>Não exibir esta tela automaticamente ao entrar</span>
          </label>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white underline underline-offset-4 text-xs font-medium cursor-pointer"
          >
            Continuar para o editor atual
          </button>
        </div>
      </div>
    </div>
  );
};
