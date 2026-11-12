import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Tag,
  DollarSign,
} from "lucide-react";
import type { EncarteProduct } from "@/types/encarte";
import {
  parseScannedPdfReport,
  type AggregatedScannedProduct,
  type ScannedPdfReportMetadata,
} from "@/lib/scanned-pdf-parser";
import { formatPrice } from "@/lib/parse-product";
import { parseSpreadsheetPrices } from "@/lib/encarte-helpers";

export interface PdfPriceMatch {
  code: string;
  name: string;
  newPrice: string;
  currentPrice: string;
  isUnpriced: boolean;
}

export interface PdfPriceContentProps {
  products: EncarteProduct[];
  onApplyPrices: (updates: { code: string; price: string }[]) => void;
  onClose?: () => void;
}

export const PdfPriceContent: React.FC<PdfPriceContentProps> = ({
  products = [],
  onApplyPrices,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ScannedPdfReportMetadata | null>(null);
  const [extractedPrices, setExtractedPrices] = useState<
    Map<string, { price: string; description?: string }>
  >(new Map());

  // Opção: apenas itens sem preço vs sobrescrever todos
  const [onlyUnpriced, setOnlyUnpriced] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapa de produtos existentes por código normalizado
  const existingCodesMap = new Map(
    products.map((p) => [String(p.code || "").trim().toLowerCase(), p])
  );

  // Cruzar preços extraídos do PDF com os produtos existentes
  const matches: PdfPriceMatch[] = [];
  for (const [codeKey, data] of extractedPrices.entries()) {
    const existing = existingCodesMap.get(codeKey);
    if (existing && data.price) {
      const isUnpriced =
        !existing.price ||
        existing.price === "0,00" ||
        existing.price === "0" ||
        existing.price.trim() === "";

      matches.push({
        code: existing.code || codeKey,
        name: existing.name || data.description || `PRODUTO ${codeKey}`,
        newPrice: data.price,
        currentPrice: existing.price || "",
        isUnpriced,
      });
    }
  }

  // Filtrar de acordo com a opção selecionada
  const activeMatches = onlyUnpriced
    ? matches.filter((m) => m.isUnpriced)
    : matches;

  const handleReset = () => {
    setFile(null);
    setIsProcessing(false);
    setError(null);
    setMetadata(null);
    setExtractedPrices(new Map());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleProcessFile = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);

    try {
      const result = await parseScannedPdfReport(selectedFile, products);
      const priceMap = new Map<string, { price: string; description?: string }>();

      // 1. Extrair preços de result.aggregated (preços manuscritos ou de tabela detectados)
      if (result.aggregated && result.aggregated.length > 0) {
        for (const agg of result.aggregated) {
          const rawPrice = agg.price || agg.precoManuscrito;
          if (rawPrice && String(rawPrice).trim()) {
            const formatted = formatPrice(String(rawPrice));
            if (formatted) {
              const cleanCode = String(agg.code || "").trim().toLowerCase();
              if (cleanCode) {
                priceMap.set(cleanCode, {
                  price: formatted,
                  description: agg.description,
                });
              }
            }
          }
        }
      }

      // 2. Se nenhuma linha teve preço pelo layout padrão, tentar extrair linhas tabulares
      if (priceMap.size === 0 && result.rows) {
        const fullRawText = result.rows.map((r) => r.rawText).join("\n");
        const fallbackParsed = parseSpreadsheetPrices(fullRawText);
        for (const p of fallbackParsed) {
          const cleanCode = String(p.code || "").trim().toLowerCase();
          if (cleanCode && p.price) {
            priceMap.set(cleanCode, {
              price: p.price,
              description: p.productName,
            });
          }
        }
      }

      if (priceMap.size === 0) {
        setError(
          "Nenhum preço reconhecido no arquivo PDF. Verifique se o relatório contém anotações de preço ou coluna de preço de venda."
        );
        setExtractedPrices(new Map());
      } else {
        setMetadata(result.metadata);
        setExtractedPrices(priceMap);
      }
    } catch (err: any) {
      setError(`Falha ao ler o PDF: ${err?.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    const updates = activeMatches.map((m) => ({
      code: m.code,
      price: m.newPrice,
    }));

    onApplyPrices(updates);
    handleReset();
    if (onClose) onClose();
  };

  return (
    <>
      <DialogHeader className="border-b pb-3">
        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-neutral-900">
          <Tag className="h-5 w-5 text-emerald-600" />
          Atualizar Preços por Relatório PDF
        </DialogTitle>
        <DialogDescription className="text-xs text-neutral-500">
          Suba a tabela ou relatório de preços em PDF. O sistema lerá os valores
          (impressos ou manuscritos à caneta) e preencherá automaticamente cada produto pelo código correspondente.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* Zona de Upload do PDF */}
        {!file && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleProcessFile(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
          >
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-neutral-900">
                Clique para selecionar o PDF de preços ou arraste aqui
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Formatos suportados: Relatório de preços ou estoque escaneado (.pdf)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />
          </div>
        )}

        {/* Estado de Processamento */}
        {isProcessing && (
          <div className="p-8 text-center rounded-xl border bg-neutral-50 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <div>
              <p className="font-bold text-sm text-neutral-900">
                Lendo preços e cruzando com os produtos da tela...
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Identificando códigos, valores em R$ e anotações à caneta
              </p>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Não foi possível ler o arquivo:</p>
              <p className="mt-0.5">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="mt-2 text-xs h-7 bg-white"
              >
                Tentar outro arquivo
              </Button>
            </div>
          </div>
        )}

        {/* Pré-visualização dos Resultados */}
        {file && !isProcessing && extractedPrices.size > 0 && (
          <div className="space-y-4">
            {/* Barra de Informações do Arquivo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-neutral-50 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-neutral-900 truncate max-w-xs">
                  {file.name}
                </span>
                {metadata?.totalPages && (
                  <span className="text-[10px] bg-neutral-200 px-1.5 py-0.2 rounded font-mono">
                    {metadata.totalPages} pág(s)
                  </span>
                )}
                {metadata?.reportDate && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono">
                    Data: {metadata.reportDate}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                className="text-xs h-7 text-neutral-600 hover:text-neutral-900"
              >
                Trocar arquivo
              </Button>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  Produtos Correspondentes
                </span>
                <span className="text-2xl font-black text-emerald-950">
                  {activeMatches.length}
                </span>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  Códigos que receberão preço
                </p>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block">
                  Total com Preço no PDF
                </span>
                <span className="text-2xl font-black text-neutral-900">
                  {extractedPrices.size}
                </span>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Itens com preço identificados
                </p>
              </div>

              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                  Itens Sem Preço na Tela
                </span>
                <span className="text-2xl font-black text-amber-950">
                  {matches.filter((m) => m.isUnpriced).length}
                </span>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Pendentes de precificação
                </p>
              </div>
            </div>

            {/* Opções de Aplicação de Preço */}
            <div className="p-3.5 rounded-lg border bg-white space-y-2.5">
              <span className="text-xs font-bold text-neutral-900 block">
                Regras de Preenchimento:
              </span>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-unpriced-only"
                  checked={onlyUnpriced}
                  onCheckedChange={(val) => setOnlyUnpriced(Boolean(val))}
                />
                <Label
                  htmlFor="opt-unpriced-only"
                  className="text-xs cursor-pointer text-neutral-700"
                >
                  Preencher apenas produtos <strong>sem preço</strong> (preserva preços que você já digitou manualmente)
                </Label>
              </div>

              {!onlyUnpriced && (
                <p className="text-[11px] text-amber-700 font-medium pl-6">
                  ⚠️ Atenção: Todos os {matches.length} produtos correspondentes terão o preço substituído pelo valor do PDF.
                </p>
              )}
            </div>

            {/* Tabela de Produtos Correspondentes */}
            <div>
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Produtos que receberão preço ({activeMatches.length})
              </h4>

              {activeMatches.length === 0 ? (
                <div className="p-4 text-center rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
                  {onlyUnpriced
                    ? "Nenhum produto sem preço foi encontrado no PDF. Desmarque a opção acima se desejar substituir os preços existentes."
                    : "Nenhum dos códigos dos produtos que estão na tela foi encontrado no PDF."}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-100 text-neutral-700 font-bold sticky top-0 border-b">
                      <tr>
                        <th className="p-2 w-20">Código</th>
                        <th className="p-2">Nome no Encarte</th>
                        <th className="p-2 w-28 text-right">Preço PDF</th>
                        <th className="p-2 w-28 text-right">Preço Atual</th>
                        <th className="p-2 w-24 text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {activeMatches.map((m) => (
                        <tr key={m.code} className="hover:bg-neutral-50/80">
                          <td className="p-2 font-mono font-bold text-red-700">
                            {m.code}
                          </td>
                          <td className="p-2 font-semibold text-neutral-900 truncate max-w-xs">
                            {m.name}
                          </td>
                          <td className="p-2 font-mono font-bold text-emerald-800 text-right whitespace-nowrap">
                            R$ {m.newPrice}
                          </td>
                          <td className="p-2 font-mono text-neutral-500 text-right whitespace-nowrap">
                            {m.currentPrice ? `R$ ${m.currentPrice}` : "--"}
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            {m.isUnpriced ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                                Sem preço
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                                Substituir
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
        <Button
          variant="outline"
          onClick={() => {
            handleReset();
            if (onClose) onClose();
          }}
          className="text-xs"
        >
          Cancelar
        </Button>

        <Button
          onClick={handleApply}
          disabled={isProcessing || activeMatches.length === 0}
          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px] px-4"
        >
          Preencher Preços Automaticamente ({activeMatches.length} produtos)
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </DialogFooter>
    </>
  );
};

export const PdfPriceModal: React.FC<PdfPriceModalProps> = ({
  open,
  onOpenChange,
  products = [],
  onApplyPrices,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <PdfPriceContent
          products={products}
          onApplyPrices={onApplyPrices}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
