import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  X,
  FileSpreadsheet,
  FileText,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Download,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface StepData {
  stepNumber: number;
  title: string;
  shortAction: string;
  description: string;
  illustration: React.ReactNode;
}

export const HOW_IT_WORKS_STEPS: StepData[] = [
  {
    stepNumber: 1,
    title: "Envie a planilha ou o PDF de validade",
    shortAction: "Escolha o arquivo com seus produtos para começar.",
    description:
      "Você pode subir uma planilha Excel (.xlsx), CSV ou o relatório de estoque escaneado em PDF. O Geraencarte organiza os códigos e estoques automaticamente.",
    illustration: (
      <svg
        viewBox="0 0 320 200"
        className="w-full h-full max-h-[200px] select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="20"
          y="20"
          width="280"
          height="160"
          rx="12"
          fill="#FEF2F2"
          stroke="#DC2626"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <g transform="translate(65, 50)">
          <rect x="0" y="0" width="70" height="90" rx="6" fill="#FFFFFF" stroke="#DC2626" strokeWidth="2" />
          <rect x="12" y="14" width="46" height="6" rx="3" fill="#DC2626" />
          <rect x="12" y="28" width="46" height="4" rx="2" fill="#FCA5A5" />
          <rect x="12" y="38" width="36" height="4" rx="2" fill="#FCA5A5" />
          <rect x="12" y="48" width="40" height="4" rx="2" fill="#FCA5A5" />
          <circle cx="35" cy="72" r="10" fill="#DC2626" />
          <text x="35" y="75" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
            PDF
          </text>
        </g>
        <g transform="translate(145, 80)">
          <circle cx="15" cy="15" r="22" fill="#DC2626" />
          <path d="M15 7L9 14H13V22H17V14H21L15 7Z" fill="#FFFFFF" />
        </g>
        <g transform="translate(185, 50)">
          <rect x="0" y="0" width="70" height="90" rx="6" fill="#FFFFFF" stroke="#16A34A" strokeWidth="2" />
          <rect x="12" y="14" width="46" height="6" rx="3" fill="#16A34A" />
          <rect x="12" y="28" width="20" height="8" rx="2" fill="#BBF7D0" />
          <rect x="38" y="28" width="20" height="8" rx="2" fill="#BBF7D0" />
          <rect x="12" y="40" width="20" height="8" rx="2" fill="#BBF7D0" />
          <rect x="38" y="40" width="20" height="8" rx="2" fill="#BBF7D0" />
          <circle cx="35" cy="72" r="10" fill="#16A34A" />
          <text x="35" y="75" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
            XLS
          </text>
        </g>
        <rect x="80" y="152" width="160" height="20" rx="10" fill="#DC2626" />
        <text x="160" y="165" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
          Arraste e solte o arquivo aqui
        </text>
      </svg>
    ),
  },
  {
    stepNumber: 2,
    title: "Cole o link do produto ou da categoria",
    shortAction: "Se quiser, o sistema busca a embalagem e a unidade sozinho.",
    description:
      "Cole o link da página do fornecedor na Cescom. O aplicativo descobre se é Unidade, Caixa, Fardo ou Pacote sem você precisar digitar.",
    illustration: (
      <svg
        viewBox="0 0 320 200"
        className="w-full h-full max-h-[200px] select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="25" y="25" width="270" height="150" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
        <rect x="25" y="25" width="270" height="28" rx="8" fill="#E2E8F0" />
        <circle cx="40" cy="39" r="4" fill="#EF4444" />
        <circle cx="52" cy="39" r="4" fill="#F59E0B" />
        <circle cx="64" cy="39" r="4" fill="#10B981" />
        <rect x="80" y="31" width="200" height="16" rx="8" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
        <text x="90" y="42" fill="#0284C7" fontSize="8" fontWeight="medium">
          https://cescom.com.br/validade-proxima
        </text>
        <g transform="translate(45, 75)">
          <rect x="0" y="0" width="105" height="75" rx="6" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
          <rect x="10" y="12" width="60" height="8" rx="2" fill="#E0F2FE" />
          <rect x="10" y="26" width="85" height="4" rx="2" fill="#CBD5E1" />
          <rect x="10" y="34" width="70" height="4" rx="2" fill="#CBD5E1" />
          <rect x="10" y="48" width="45" height="16" rx="4" fill="#0284C7" />
          <text x="32" y="59" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
            Buscar
          </text>
        </g>
        <path d="M160 110 H175" stroke="#0284C7" strokeWidth="3" strokeDasharray="3 3" />
        <polygon points="175,106 183,110 175,114" fill="#0284C7" />
        <g transform="translate(185, 65)">
          <rect x="0" y="0" width="95" height="95" rx="6" fill="#FFFFFF" stroke="#16A34A" strokeWidth="1.5" />
          <text x="47" y="20" fill="#15803D" fontSize="9" fontWeight="bold" textAnchor="middle">
            Unidade detectada:
          </text>
          <rect x="10" y="28" width="75" height="18" rx="4" fill="#DCFCE7" stroke="#16A34A" strokeWidth="1" />
          <text x="47" y="40" fill="#166534" fontSize="8" fontWeight="bold" textAnchor="middle">
            CX (Caixa com 24)
          </text>
          <rect x="10" y="52" width="75" height="18" rx="4" fill="#DCFCE7" stroke="#16A34A" strokeWidth="1" />
          <text x="47" y="64" fill="#166534" fontSize="8" fontWeight="bold" textAnchor="middle">
            UND (Unidade)
          </text>
          <rect x="10" y="74" width="75" height="14" rx="4" fill="#16A34A" />
          <text x="47" y="84" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">
            Preenchido 100% auto
          </text>
        </g>
      </svg>
    ),
  },
  {
    stepNumber: 3,
    title: "Revise só o que estiver marcado como pendente",
    shortAction: "Apenas corrija os itens com aviso. O resto já fica pronto.",
    description:
      "Os produtos calculam quantidade e data sozinhos. Se algum item tiver avaria ou precisar de conferência, ele aparece destacado para você tocar e ajustar.",
    illustration: (
      <svg
        viewBox="0 0 320 200"
        className="w-full h-full max-h-[200px] select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="25" y="25" width="270" height="150" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <rect x="25" y="25" width="270" height="24" rx="8" fill="#F1F5F9" />
        <text x="35" y="40" fill="#64748B" fontSize="8" fontWeight="bold">CÓDIGO</text>
        <text x="90" y="40" fill="#64748B" fontSize="8" fontWeight="bold">PRODUTO</text>
        <text x="185" y="40" fill="#64748B" fontSize="8" fontWeight="bold">VALIDADE</text>
        <text x="245" y="40" fill="#64748B" fontSize="8" fontWeight="bold">STATUS</text>

        <rect x="25" y="52" width="270" height="26" fill="#F0FDF4" />
        <text x="35" y="68" fill="#166534" fontSize="8" fontWeight="bold">23000</text>
        <text x="90" y="68" fill="#166534" fontSize="8">LAVA ROUPAS TIXAN</text>
        <text x="185" y="68" fill="#166534" fontSize="8">15/12/2026</text>
        <circle cx="260" cy="65" r="7" fill="#16A34A" />
        <path d="M257 65L259 67L263 63" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

        <rect x="25" y="82" width="270" height="34" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
        <text x="35" y="101" fill="#92400E" fontSize="8" fontWeight="bold">8522</text>
        <text x="90" y="101" fill="#92400E" fontSize="8" fontWeight="bold">AMACIANTE YPÊ</text>
        <text x="185" y="101" fill="#92400E" fontSize="8">20/11/2026</text>
        <rect x="235" y="90" width="50" height="18" rx="4" fill="#D97706" />
        <text x="260" y="102" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
          Revisar
        </text>

        <g transform="translate(245, 115)">
          <circle cx="12" cy="12" r="16" fill="#D97706" fillOpacity="0.2" />
          <path
            d="M10 5L15 17L12 16L10 21L8 20L10 15L6 14L10 5Z"
            fill="#D97706"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        </g>

        <rect x="25" y="120" width="270" height="26" fill="#F0FDF4" />
        <text x="35" y="136" fill="#166534" fontSize="8" fontWeight="bold">14611</text>
        <text x="90" y="136" fill="#166534" fontSize="8">SILICONE CASCOLA</text>
        <text x="185" y="136" fill="#166534" fontSize="8">05/01/2027</text>
        <circle cx="260" cy="133" r="7" fill="#16A34A" />
        <path d="M257 133L259 135L263 131" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

        <rect x="50" y="152" width="220" height="18" rx="9" fill="#1E293B" />
        <text x="160" y="164" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
          128 itens prontos · Apenas 1 precisa de toque
        </text>
      </svg>
    ),
  },
  {
    stepNumber: 4,
    title: "Baixe o encarte",
    shortAction: "Seu encarte em alta resolução pronto para WhatsApp e Instagram!",
    description:
      "Clique em Baixar PNG para publicar nas redes sociais ou exportar em PDF para impressão. O trabalho está concluído em minutos.",
    illustration: (
      <svg
        viewBox="0 0 320 200"
        className="w-full h-full max-h-[200px] select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(60, 20)">
          <rect x="0" y="0" width="90" height="160" rx="8" fill="#1E1E1E" stroke="#DC2626" strokeWidth="2" />
          <rect x="8" y="8" width="74" height="24" rx="4" fill="#DC2626" />
          <text x="45" y="23" fill="#FFFFFF" fontSize="7" fontWeight="black" textAnchor="middle">
            OFERTAS
          </text>
          <rect x="12" y="38" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="48" y="38" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="12" y="74" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="48" y="74" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="12" y="110" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="48" y="110" width="30" height="32" rx="3" fill="#FFFFFF" />
          <rect x="8" y="146" width="74" height="8" rx="2" fill="#F59E0B" />
        </g>

        <path d="M165 95 H185" stroke="#16A34A" strokeWidth="3" strokeDasharray="3 3" />
        <polygon points="185,91 193,95 185,99" fill="#16A34A" />

        <g transform="translate(195, 45)">
          <rect x="0" y="0" width="95" height="42" rx="6" fill="#16A34A" stroke="#15803D" strokeWidth="1.5" />
          <circle cx="20" cy="21" r="10" fill="#FFFFFF" />
          <path d="M20 16V26M16 22L20 26L24 22" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
          <text x="36" y="18" fill="#FFFFFF" fontSize="9" fontWeight="bold">
            Baixar PNG
          </text>
          <text x="36" y="28" fill="#DCFCE7" fontSize="7">
            1080 × 1920
          </text>
          <text x="36" y="36" fill="#DCFCE7" fontSize="6">
            Story / WhatsApp
          </text>
        </g>

        <g transform="translate(195, 100)">
          <rect x="0" y="0" width="95" height="42" rx="6" fill="#DC2626" stroke="#B91C1C" strokeWidth="1.5" />
          <circle cx="20" cy="21" r="10" fill="#FFFFFF" />
          <path d="M20 16V26M16 22L20 26L24 22" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          <text x="36" y="18" fill="#FFFFFF" fontSize="9" fontWeight="bold">
            Baixar PDF
          </text>
          <text x="36" y="28" fill="#FEE2E2" fontSize="7">
            A4 Impressão
          </text>
          <text x="36" y="36" fill="#FEE2E2" fontSize="6">
            Pronto para imprimir
          </text>
        </g>
      </svg>
    ),
  },
];

interface HowItWorksContentProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  handlePrev: () => void;
  handleNext: () => void;
  handleSkip: () => void;
  prefersReducedMotion: boolean;
}

export const HowItWorksContent: React.FC<HowItWorksContentProps> = ({
  currentStep,
  setCurrentStep,
  isPlaying,
  togglePlay,
  handlePrev,
  handleNext,
  handleSkip,
  prefersReducedMotion,
}) => {
  const current = HOW_IT_WORKS_STEPS[currentStep] || HOW_IT_WORKS_STEPS[0];

  return (
    <div className="w-full flex flex-col bg-white overflow-hidden" data-testid="how-it-works-modal">
      <div className="p-4 sm:p-5 pb-3 border-b bg-neutral-50/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                Como funciona o Geraencarte
              </h2>
              <p className="text-xs text-neutral-500">
                Guia rápido em 4 passos simples. Qualquer pessoa consegue criar em minutos!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="rounded-md p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            title="Fechar guia (Esc)"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-4 gap-2 mb-1.5">
            {HOW_IT_WORKS_STEPS.map((st, idx) => (
              <button
                key={st.stepNumber}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`text-left text-[11px] font-bold transition-colors truncate ${
                  idx === currentStep
                    ? "text-red-600"
                    : idx < currentStep
                    ? "text-neutral-700"
                    : "text-neutral-400"
                }`}
              >
                Passo {st.stepNumber}
              </button>
            ))}
          </div>

          <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-300 rounded-full"
              style={{ width: `${((currentStep + 1) / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="w-full h-[210px] sm:h-[230px] rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center p-3 overflow-hidden shadow-inner">
          {current.illustration}
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
            Passo {current.stepNumber} de 4
          </div>
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 leading-snug">
            {current.title}
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-neutral-700">
            {current.shortAction}
          </p>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {current.description}
          </p>
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-neutral-50 border-t flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!prefersReducedMotion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={togglePlay}
              className="min-h-[38px] text-xs font-semibold gap-1.5 border-neutral-300"
              title={isPlaying ? "Pausar avanço automático" : "Reproduzir automaticamente"}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-neutral-600" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-neutral-600" />
                  <span>Reproduzir</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="min-h-[38px] text-xs font-semibold text-neutral-500 hover:text-neutral-800"
          >
            Pular
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="min-h-[38px] text-xs font-semibold"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleNext}
            className="min-h-[38px] px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
          >
            {currentStep < 3 ? (
              <>
                <span>Próximo</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            ) : (
              <span>Começar Agora</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Detecta preferência por movimento reduzido do sistema
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
        if (e.matches) setIsPlaying(false);
      };

      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  // Reinicia para o primeiro passo sempre que abrir
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setIsPlaying(!prefersReducedMotion);
    } else {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open, prefersReducedMotion]);

  // Avanço automático na animação quando ativo
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isPlaying && !prefersReducedMotion && open) {
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => (prev >= 3 ? 0 : prev + 1));
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, prefersReducedMotion, open]);

  // Navegação manual por teclado
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentStep((prev) => Math.min(prev + 1, 3));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      } else if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      setCurrentStep((c) => c + 1);
    } else {
      onOpenChange(false);
    }
  }, [currentStep, onOpenChange]);

  const handlePrev = useCallback(() => {
    setCurrentStep((c) => Math.max(c - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <HowItWorksContent
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          handlePrev={handlePrev}
          handleNext={handleNext}
          handleSkip={handleSkip}
          prefersReducedMotion={prefersReducedMotion}
        />
      </DialogContent>
    </Dialog>
  );
};
