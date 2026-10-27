import React from "react";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  Link2,
  Images,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";

export type EmptyStateType =
  | "no_source"
  | "no_spreadsheet"
  | "no_photos"
  | "no_products"
  | "link_failed";

interface EmptyStateProps {
  type: EmptyStateType;
  primaryAction: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  customMessage?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  primaryAction,
  secondaryAction,
  customMessage,
}) => {
  const configs = {
    no_source: {
      icon: ShoppingBag,
      title: "Comece seu encarte promocional",
      desc: "Escolha como deseja importar os dados dos produtos: por planilha Excel/CSV ou pelo link da categoria do fornecedor.",
    },
    no_spreadsheet: {
      icon: FileSpreadsheet,
      title: "Nenhuma planilha carregada",
      desc: "Envie um arquivo .xlsx ou .csv com as colunas código, descrição, embalagem, estoque e validade.",
    },
    no_photos: {
      icon: Images,
      title: "Nenhum banco de fotos adicionado",
      desc: "Você pode enviar fotos em lote ou arquivo .zip com os códigos dos produtos no nome do arquivo (opcional).",
    },
    no_products: {
      icon: ShoppingBag,
      title: "Nenhum produto cadastrado no encarte",
      desc: "Importe produtos da categoria do fornecedor ou carregue uma planilha para iniciar a montagem do encarte.",
    },
    link_failed: {
      icon: AlertCircle,
      title: "Falha na leitura da página do fornecedor",
      desc:
        customMessage ||
        "O site bloqueou o acesso automático aos produtos. Você pode importar seus produtos via planilha .xlsx ou .csv.",
    },
  };

  const current = configs[type];
  const Icon = current.icon;

  return (
    <div
      role="status"
      className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xs space-y-4"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        <Icon className="h-7 w-7 text-neutral-500" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-neutral-900">{current.title}</h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
          {current.desc}
        </p>
      </div>

      {/* Ações: Uma ação principal por tela + Uma secundária (Mínimo 44px de altura) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          type="button"
          onClick={primaryAction.onClick}
          className="min-h-[44px] px-6 text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs w-full sm:w-auto"
        >
          {primaryAction.icon && <span className="mr-1.5">{primaryAction.icon}</span>}
          {primaryAction.label}
        </Button>

        {secondaryAction && (
          <Button
            type="button"
            variant="outline"
            onClick={secondaryAction.onClick}
            className="min-h-[44px] px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 border-neutral-300 w-full sm:w-auto"
          >
            {secondaryAction.icon && (
              <span className="mr-1.5">{secondaryAction.icon}</span>
            )}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};
