import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  ImageOff,
  DollarSign,
  Type,
  Maximize2,
} from "lucide-react";
import { PreflightIssue } from "@/types/editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PreflightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: PreflightIssue[];
  onFixIssue: (issue: PreflightIssue) => void;
  onProceedToExport: () => void;
}

export const PreflightModalContent: React.FC<{
  issues: PreflightIssue[];
  onFixIssue: (issue: PreflightIssue) => void;
  onProceedToExport: () => void;
  onClose?: () => void;
}> = ({ issues, onFixIssue, onProceedToExport, onClose }) => {
  const hasIssues = issues.length > 0;

  const getIssueIcon = (type: PreflightIssue["type"]) => {
    switch (type) {
      case "missing_photo":
        return <ImageOff className="w-4 h-4 text-amber-500" />;
      case "empty_price":
        return <DollarSign className="w-4 h-4 text-rose-500" />;
      case "font_below_min":
      case "text_overflow":
        return <Type className="w-4 h-4 text-orange-500" />;
      case "out_of_bounds":
        return <Maximize2 className="w-4 h-4 text-purple-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex items-center gap-2 mb-3">
        {hasIssues ? (
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        )}
        <div>
          <h3 className="text-base font-bold text-foreground">
            {hasIssues
              ? `Checagem Pré-Exportação: ${issues.length} aviso(s)`
              : "Checagem Pré-Exportação: Tudo Certo!"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {hasIssues
              ? "Recomendamos revisar os pontos abaixo para garantir a melhor qualidade gráfica do seu encarte."
              : "Todos os textos, fotos, preços e alinhamentos estão validados e prontos para geração em alta resolução."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
        {hasIssues ? (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIssueIcon(issue.type)}</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      {issue.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      Página {issue.page}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => {
                  onFixIssue(issue);
                  onClose?.();
                }}
              >
                Corrigir
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-semibold text-sm text-foreground">
              Nenhum problema encontrado no encarte!
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Todas as páginas respeitam os limites de segurança, as fotos estão nítidas e os preços estão perfeitamente visíveis.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-xs"
        >
          Voltar à Edição
        </Button>

        <Button
          onClick={() => {
            onClose?.();
            onProceedToExport();
          }}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          {hasIssues ? "Exportar Mesmo Assim" : "Prosseguir para Exportação"}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
};

export const PreflightModal: React.FC<PreflightModalProps> = ({
  open,
  onOpenChange,
  issues,
  onFixIssue,
  onProceedToExport,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] p-4">
        <PreflightModalContent
          issues={issues}
          onFixIssue={onFixIssue}
          onProceedToExport={onProceedToExport}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
