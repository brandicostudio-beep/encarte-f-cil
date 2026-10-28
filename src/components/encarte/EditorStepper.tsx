import React from "react";
import { Check, ChevronRight, RotateCcw } from "lucide-react";

export type EditorStep = "origem" | "dados" | "precos" | "campanha" | "exportar";

interface StepConfig {
  id: EditorStep;
  title: string;
  shortDesc: string;
}

const STEPS: StepConfig[] = [
  { id: "origem", title: "1. Origem", shortDesc: "Planilha ou Link" },
  { id: "dados", title: "2. Dados", shortDesc: "Fotos & Validação" },
  { id: "precos", title: "3. Preços", shortDesc: "Revisão e Valores" },
  { id: "campanha", title: "4. Campanha", shortDesc: "Textos & Loja" },
  { id: "exportar", title: "5. Exportar", shortDesc: "PDF & Impressão" },
];

interface EditorStepperProps {
  currentStep: EditorStep;
  completedSteps: Set<EditorStep>;
  onStepClick: (step: EditorStep) => void;
  savedNotice?: string;
  hasUndo?: boolean;
  onUndo?: () => void;
  onReset?: () => void;
}

export const EditorStepper: React.FC<EditorStepperProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
  savedNotice = "Salvo agora há pouco",
  hasUndo = false,
  onUndo,
  onReset,
}) => {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="bg-white border-b sticky top-[57px] z-30 shadow-xs">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Passos do Fluxo com área de toque mínima de 44px */}
        <nav
          aria-label="Etapas do Encarte"
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 scrollbar-none"
        >
          {STEPS.map((step, idx) => {
            const isCurrent = step.id === currentStep;
            const isCompleted = completedSteps.has(step.id);
            const isPast = idx < currentIndex;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <ChevronRight
                    className="h-4 w-4 text-neutral-300 shrink-0 select-none"
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`min-h-[44px] px-3 py-1.5 rounded-lg flex items-center gap-2.5 transition-all text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-600 ${
                    isCurrent
                      ? "bg-red-50 text-red-700 font-bold shadow-xs border border-red-200"
                      : isCompleted || isPast
                      ? "text-neutral-700 hover:bg-neutral-100 font-medium"
                      : "text-neutral-400 hover:text-neutral-600 font-normal"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCurrent
                        ? "bg-red-600 text-white"
                        : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    ) : (
                      idx + 1
                    )}
                  </span>

                  <div className="flex flex-col leading-tight pr-1">
                    <span className="text-xs font-bold uppercase tracking-tight">
                      {step.title.split(". ")[1]}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">
                      {step.shortDesc}
                    </span>
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Indicador de Salvamento Automático, Novo Encarte & Desfazer */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center text-xs">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-[44px] px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-600"
              title="Iniciar novo encarte e zerar dados atuais"
            >
              <RotateCcw className="h-3.5 w-3.5 text-neutral-500" />
              <span>Novo Encarte</span>
            </button>
          )}

          {hasUndo && onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="min-h-[44px] px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:text-red-700 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-600"
              title="Desfazer última alteração (Ctrl+Z)"
            >
              <span>Desfazer</span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 text-[10px] font-mono text-neutral-700">
                Ctrl+Z
              </kbd>
            </button>
          )}

          <div
            className="flex items-center gap-1.5 text-neutral-500 font-medium text-[11px] select-none"
            aria-live="polite"
          >
            <span
              className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
              aria-hidden="true"
            />
            <span>{savedNotice}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
