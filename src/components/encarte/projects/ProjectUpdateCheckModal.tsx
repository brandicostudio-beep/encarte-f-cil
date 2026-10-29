import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Upload,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import type { ProjectData, ProductChangeDiff } from "@/types/project";
import type { EncarteProduct } from "@/types/encarte";
import { parseSpreadsheetFile } from "@/lib/spreadsheet-parser";
import { analyzeProjectUpdates } from "@/lib/project-serializer";
import { applySelectedUpdates, saveProjectUnified } from "@/lib/project-sync-manager";

interface ProjectUpdateCheckModalProps {
  project: ProjectData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyUpdates: (updatedProducts: EncarteProduct[]) => void;
}

export const ProjectUpdateCheckModal: React.FC<ProjectUpdateCheckModalProps> = ({
  project,
  open,
  onOpenChange,
  onApplyUpdates,
}) => {
  const [diffs, setDiffs] = useState<ProductChangeDiff[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");

  if (!open || !project) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsAnalyzing(true);
    try {
      const res = await parseSpreadsheetFile(file);
      if (res.success && res.validProducts.length > 0) {
        const analysis = analyzeProjectUpdates(project.products, res.validProducts);
        setDiffs(analysis.diffs);
        setHasChecked(true);
      } else {
        alert("Não foi possível ler os produtos da planilha enviada.");
      }
    } catch (err) {
      alert("Erro ao processar planilha: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleDiff = (code: string) => {
    setDiffs((prev) =>
      prev.map((d) => (d.code === code ? { ...d, selected: !d.selected } : d))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setDiffs((prev) => prev.map((d) => ({ ...d, selected: select })));
  };

  const handleApply = async () => {
    const selectedCount = diffs.filter((d) => d.selected).length;
    if (selectedCount === 0) {
      alert("Nenhuma alteração selecionada para aplicar.");
      return;
    }

    const updatedProducts = applySelectedUpdates(project.products, diffs);
    onApplyUpdates(updatedProducts);

    // Salvar nova versão do projeto com as alterações aplicadas
    const updatedProject: ProjectData = {
      ...project,
      products: updatedProducts,
      version: (project.version || 1) + 1,
    };
    await saveProjectUnified(updatedProject, true);

    onOpenChange(false);
  };

  const selectedCount = diffs.filter((d) => d.selected).length;
  const newCount = diffs.filter((d) => d.type === "added").length;
  const removedCount = diffs.filter((d) => d.type === "removed").length;
  const changedCount = diffs.filter((d) => d.type === "changed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-red-600" />
            Verificar Atualizações: {project.name}
          </DialogTitle>
        </DialogHeader>

        {!hasChecked ? (
          <div className="py-8 space-y-4 text-center">
            <p className="text-xs text-neutral-600 max-w-lg mx-auto">
              Envie a versão mais recente da sua planilha de produtos (ERP ou arquivo Excel/CSV) para comparar automaticamente preços, estoques, validades e produtos novos ou esgotados.
            </p>

            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-300 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors">
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 mb-2" />
              <label
                htmlFor="update-spreadsheet-input"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                <Upload className="w-4 h-4" />
                {isAnalyzing ? "Analisando planilha..." : "Selecionar Planilha Atualizada (.xlsx ou .csv)"}
              </label>
              <input
                id="update-spreadsheet-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={isAnalyzing}
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-[11px] text-neutral-400 mt-2">
                Suporta o modelo padrão do WinThor e planilhas de varejo.
              </span>
            </div>
          </div>
        ) : diffs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-800">Tudo em dia!</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Nenhuma diferença encontrada entre a planilha enviada ({fileName}) e os produtos deste projeto.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden space-y-3">
            {/* Resumo de Diferenças */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-neutral-700">Diferenças encontradas:</span>
                {changedCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300">
                    {changedCount} alterados
                  </Badge>
                )}
                {newCount > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">
                    {newCount} novos
                  </Badge>
                )}
                {removedCount > 0 && (
                  <Badge className="bg-red-100 text-red-900 border-red-300">
                    {removedCount} não encontrados
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                  className="h-7 text-xs font-semibold"
                >
                  Marcar Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                  className="h-7 text-xs font-semibold"
                >
                  Desmarcar
                </Button>
              </div>
            </div>

            {/* Lista de Itens com Diferenças */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[45vh]">
              {diffs.map((d) => (
                <div
                  key={d.code}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-3 transition-colors ${
                    d.selected
                      ? "bg-white border-neutral-300 shadow-2xs"
                      : "bg-neutral-50/60 border-neutral-200 opacity-60"
                  }`}
                >
                  <Checkbox
                    checked={d.selected}
                    onCheckedChange={() => handleToggleDiff(d.code)}
                    id={`diff-${d.code}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-500 text-[11px]">
                        [{d.code}]
                      </span>
                      <label
                        htmlFor={`diff-${d.code}`}
                        className="font-bold text-neutral-900 truncate cursor-pointer"
                      >
                        {d.name}
                      </label>
                      {d.type === "added" && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Novo na planilha
                        </span>
                      )}
                      {d.type === "removed" && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          Removido na planilha
                        </span>
                      )}
                    </div>

                    {/* Detalhamento dos campos alterados */}
                    {d.type === "changed" && d.changes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        {d.changes.map((c, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded border text-neutral-700 font-mono"
                          >
                            <span className="font-sans font-bold capitalize text-neutral-500">
                              {c.field === "price"
                                ? "Preço"
                                : c.field === "stock"
                                ? "Estoque"
                                : c.field === "validity"
                                ? "Validade"
                                : c.field === "unit"
                                ? "Unidade"
                                : "Embalagem"}
                              :
                            </span>
                            <span className="line-through text-neutral-400">
                              {c.oldValue || "(vazio)"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-neutral-400" />
                            <span className="font-bold text-emerald-700">
                              {c.newValue}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {hasChecked && diffs.length > 0 && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Aplicar {selectedCount} {selectedCount === 1 ? "Alteração" : "Alterações"} Selecionadas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
