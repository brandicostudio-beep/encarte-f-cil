import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
} from "lucide-react";
import type { ValidadePreviewImport, ValidadeSnapshot } from "@/types/painel-validade";
import { parseWinthorCsv, parseWinthorXlsx, OBRIGATORIAS } from "@/lib/painel-validade-parser";
import {
  createSnapshotFromRaw,
  getActiveSnapshot,
  syncLastEncarteData,
} from "@/lib/painel-validade-storage";

interface PainelValidadeImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess: (snapshot: ValidadeSnapshot) => void;
}

export function PainelValidadeImportModal({
  open,
  onClose,
  onImportSuccess,
}: PainelValidadeImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ValidadePreviewImport | null>(null);
  const [showErrorsList, setShowErrorsList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza o último encarte da nuvem/local ao abrir o modal de importação
  useEffect(() => {
    if (open) {
      syncLastEncarteData().catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    setErrorMessage(null);
    setPreview(null);

    try {
      const fileNameLower = file.name.toLowerCase();
      const activeSnap = getActiveSnapshot();
      const existingRawLotes = activeSnap ? activeSnap.lotes.map((l) => ({
        codprod: l.codprod,
        descricao: l.descricao,
        embalagem: l.embalagem,
        dtval: l.dtval,
        qtdisp_wms: l.estoque,
        preco_venda: l.precoVenda,
        qtvendmes: l.vendaMesAtual,
        qtvendmes1: l.vendaM1,
        qtvendmes2: l.vendaM2,
        qtvendmes3: l.vendaM3,
        nomeComprador: l.nomeComprador,
        codcomprador: l.codcomprador,
      })) : [];

      let parsedPreview: ValidadePreviewImport;

      if (fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        parsedPreview = await parseWinthorXlsx(buffer, file.name, existingRawLotes);
      } else {
        const buffer = await file.arrayBuffer();
        parsedPreview = parseWinthorCsv(buffer, file.name, existingRawLotes);
      }

      setPreview(parsedPreview);
    } catch (err: unknown) {
      console.error("Erro ao analisar arquivo Winthor:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erro desconhecido ao processar o arquivo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!preview || preview.lotesValidos.length === 0) return;

    try {
      const snapshot = createSnapshotFromRaw(
        preview.lotesValidos,
        preview.nomeArquivo,
        "Gestor Interno",
        new Date()
      );
      onImportSuccess(snapshot);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar snapshot:", err);
      setErrorMessage("Falha ao salvar a nova versão do painel.");
    }
  };

  const hasMissingRequiredColumns = preview && preview.colunasFaltantes.length > 0;
  const canConfirm = preview && preview.lotesValidos.length > 0 && !hasMissingRequiredColumns;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                Importar Planilha Winthor / WMS
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Visualização interna de validade e giro por lote
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
                : "border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile
                    ? selectedFile.name
                    : "Arraste sua planilha ou clique para selecionar"}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Formatos aceitos: CSV delimitado por ponto e vírgula (;) ou pasta de trabalho Excel (.xlsx / .xls)
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5" /> ISO-8859-1, Windows-1252 e UTF-8 com vírgula decimal
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-3">
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Erro ao ler arquivo</p>
                <p className="text-sm mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Resultado da Prévia do Arquivo
              </h3>

              {/* Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Linhas Lidas
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                    {preview.totalLinhasLidas.toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                    Lotes Válidos
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 block">
                    {preview.lotesValidos.length.toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                    Produtos Novos
                  </span>
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 block">
                    +{preview.totalProdutosNovos}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                    Linhas Ignoradas
                  </span>
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1 block">
                    {preview.linhasComErro.length}
                  </span>
                </div>
              </div>

              {/* Required Columns Checklist */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Colunas Obrigatórias Verificadas
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {OBRIGATORIAS.map((col) => {
                    const ok = preview.colunasDetectadas.includes(col);
                    return (
                      <span
                        key={col}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          ok
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                            : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300"
                        }`}
                      >
                        {ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        )}
                        {col.toUpperCase()}
                      </span>
                    );
                  })}
                </div>

                {hasMissingRequiredColumns && (
                  <p className="text-sm font-semibold text-red-600 pt-2">
                    Importação bloqueada: colunas ausentes ({preview.colunasFaltantes.join(", ")}).
                  </p>
                )}
              </div>

              {/* Erros list toggler if any */}
              {preview.linhasComErro.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowErrorsList(!showErrorsList)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-semibold text-amber-800 dark:text-amber-300"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Ver {preview.linhasComErro.length} linhas ignoradas com aviso
                    </span>
                    {showErrorsList ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showErrorsList && (
                    <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-1.5 text-xs text-amber-900 dark:text-amber-200 border-t border-amber-200 dark:border-amber-900/60 pt-2">
                      {preview.linhasComErro.slice(0, 30).map((err, idx) => (
                        <div key={idx} className="flex gap-2 font-mono">
                          <span className="font-bold">Linha {err.linha}:</span>
                          <span>{err.erro}</span>
                        </div>
                      ))}
                      {preview.linhasComErro.length > 30 && (
                        <p className="text-xs text-amber-600 font-sans italic pt-1">
                          ... e mais {preview.linhasComErro.length - 30} linhas ignoradas.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] px-6 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirmImport}
            className={`min-h-[56px] px-8 text-lg font-bold rounded-xl transition-all shadow-md flex items-center gap-2 ${
              canConfirm
                ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            Confirmar Importação
          </button>
        </div>
      </div>
    </div>
  );
}
