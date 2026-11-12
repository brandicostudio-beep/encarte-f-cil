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
  Calendar,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import type { EncarteProduct } from "@/types/encarte";
import {
  parseScannedPdfReport,
  scannedProductToEncarteProduct,
  type AggregatedScannedProduct,
  type ScannedPdfReportMetadata,
} from "@/lib/scanned-pdf-parser";

interface PdfStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: EncarteProduct[];
  onApplyStock: (
    updates: {
      code: string;
      stock: string;
      validity?: string;
      price?: string;
      obs?: string;
    }[],
    newProductsToAdd?: EncarteProduct[]
  ) => void;
}

export interface PdfStockContentProps {
  products: EncarteProduct[];
  onApplyStock: (
    updates: {
      code: string;
      stock: string;
      validity?: string;
      price?: string;
      obs?: string;
    }[],
    newProductsToAdd?: EncarteProduct[]
  ) => void;
  onClose?: () => void;
}

export const PdfStockContent: React.FC<PdfStockContentProps> = ({
  products = [],
  onApplyStock,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ScannedPdfReportMetadata | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedScannedProduct[]>([]);

  // Opções de preenchimento
  const [fillPriceIfEmpty, setFillPriceIfEmpty] = useState(true);
  const [updateValidity, setUpdateValidity] = useState(true);
  const [includeNewProducts, setIncludeNewProducts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapa de produtos existentes por código normalizado
  const existingCodesMap = new Map(
    products.map((p) => [String(p.code || "").trim().toLowerCase(), p])
  );

  // Itens correspondentes (estão no encarte e no PDF)
  const matchedItems = aggregated.filter((agg) =>
    existingCodesMap.has(String(agg.code || "").trim().toLowerCase())
  );

  // Itens do PDF que NÃO estão no encarte (mas que possuem preço ou estoque)
  const unmatchedItems = aggregated.filter(
    (agg) =>
      !existingCodesMap.has(String(agg.code || "").trim().toLowerCase()) &&
      Boolean(agg.price || agg.precoManuscrito)
  );

  const handleReset = () => {
    setFile(null);
    setIsProcessing(false);
    setError(null);
    setMetadata(null);
    setAggregated([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleProcessFile = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);

    try {
      const result = await parseScannedPdfReport(selectedFile, products);
      if (!result.ok && result.aggregated.length === 0) {
        setError(
          result.errors.length
            ? result.errors.join("; ")
            : "Nenhum produto ou código reconhecido no arquivo PDF."
        );
        setAggregated([]);
      } else {
        setMetadata(result.metadata);
        setAggregated(result.aggregated);
      }
    } catch (err: any) {
      setError(`Falha ao ler o PDF: ${err?.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    const updates: {
      code: string;
      stock: string;
      validity?: string;
      price?: string;
      obs?: string;
    }[] = [];

    for (const match of matchedItems) {
      const existing = existingCodesMap.get(
        String(match.code || "").trim().toLowerCase()
      );
      if (!existing) continue;

      const effectiveStock =
        match.totalStock > 0
          ? `${match.totalStock} ${match.unit || existing.unit || "UND"}`
          : "";

      const priceToApply =
        fillPriceIfEmpty &&
        (!existing.price ||
          existing.price === "0,00" ||
          existing.price === "0" ||
          existing.price.trim() === "")
          ? match.price || match.precoManuscrito
          : undefined;

      const validityToApply =
        updateValidity && match.validity ? match.validity : undefined;

      updates.push({
        code: match.code,
        stock: effectiveStock,
        validity: validityToApply,
        price: priceToApply,
        obs: match.obs,
      });
    }

    let newProductsToAdd: EncarteProduct[] | undefined;
    if (includeNewProducts && unmatchedItems.length > 0) {
      newProductsToAdd = unmatchedItems.map((agg) =>
        scannedProductToEncarteProduct(agg)
      );
    }

    onApplyStock(updates, newProductsToAdd);
    handleReset();
    if (onClose) onClose();
  };

  return (
    <>
      <DialogHeader className="border-b pb-3">
        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-neutral-900">
          <FileText className="h-5 w-5 text-red-600" />
          Atualizar Estoque por Relatório PDF
        </DialogTitle>
        <DialogDescription className="text-xs text-neutral-500">
          Suba o relatório escaneado de estoque em PDF. O sistema lerá os estoques
          e preencherá automaticamente cada produto pelo código correspondente.
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
            className="border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/30 hover:bg-red-50/60 rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
          >
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-neutral-900">
                Clique para selecionar o relatório PDF ou arraste aqui
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Formatos suportados: Relatórios escaneados do ERP em PDF (.pdf)
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
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <div>
              <p className="font-bold text-sm text-neutral-900">
                Lendo e associando dados do relatório escaneado...
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Analisando páginas, tabelas e cruzando códigos com os produtos da tela
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
        {file && !isProcessing && aggregated.length > 0 && (
          <div className="space-y-4">
            {/* Barra de Informações do Arquivo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-neutral-50 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-600" />
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
                    Período: {metadata.reportDate}
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
                  {matchedItems.length}
                </span>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  Códigos encontrados no encarte atual
                </p>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block">
                  Total Lido no PDF
                </span>
                <span className="text-2xl font-black text-neutral-900">
                  {aggregated.length}
                </span>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Itens identificados no relatório
                </p>
              </div>

              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                  Preços Manuscritos
                </span>
                <span className="text-2xl font-black text-amber-950">
                  {aggregated.filter((a) => Boolean(a.precoManuscrito || a.price)).length}
                </span>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Anotações à caneta identificadas
                </p>
              </div>
            </div>

            {/* Opções de Preenchimento */}
            <div className="p-3.5 rounded-lg border bg-white space-y-2.5">
              <span className="text-xs font-bold text-neutral-900 block">
                Regras de Preenchimento Automático:
              </span>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-price"
                  checked={fillPriceIfEmpty}
                  onCheckedChange={(val) => setFillPriceIfEmpty(Boolean(val))}
                />
                <Label htmlFor="opt-price" className="text-xs cursor-pointer text-neutral-700">
                  Preencher preço com o valor manuscrito do PDF caso o produto esteja <strong>sem preço</strong> (ex: R$ 2,00)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-validity"
                  checked={updateValidity}
                  onCheckedChange={(val) => setUpdateValidity(Boolean(val))}
                />
                <Label htmlFor="opt-validity" className="text-xs cursor-pointer text-neutral-700">
                  Atualizar data de validade com a lida no PDF
                </Label>
              </div>

              {unmatchedItems.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Checkbox
                    id="opt-add-new"
                    checked={includeNewProducts}
                    onCheckedChange={(val) => setIncludeNewProducts(Boolean(val))}
                  />
                  <Label htmlFor="opt-add-new" className="text-xs cursor-pointer text-neutral-700">
                    Também adicionar ao encarte outros <strong>{unmatchedItems.length} produtos do PDF</strong> que possuem preço
                  </Label>
                </div>
              )}
            </div>

            {/* Tabela de Produtos Correspondentes */}
            <div>
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Produtos que receberão estoque ({matchedItems.length})
              </h4>

              {matchedItems.length === 0 ? (
                <div className="p-4 text-center rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
                  Nenhum dos códigos dos produtos que estão na tela foi encontrado neste PDF.
                  Verifique se o relatório corresponde à mesma loja/produtos.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-neutral-100 text-neutral-700 font-bold sticky top-0 border-b">
                      <tr>
                        <th className="p-2 w-20">Código</th>
                        <th className="p-2">Nome no Encarte</th>
                        <th className="p-2 w-28 text-right">Estoque PDF</th>
                        <th className="p-2 w-24">Validade</th>
                        <th className="p-2 w-24 text-right">Preço PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {matchedItems.map((m) => {
                        const existing = existingCodesMap.get(
                          String(m.code || "").trim().toLowerCase()
                        );
                        const priceVal = m.price || m.precoManuscrito;
                        return (
                          <tr key={m.code} className="hover:bg-neutral-50/80">
                            <td className="p-2 font-mono font-bold text-red-700">
                              {m.code}
                            </td>
                            <td className="p-2 font-semibold text-neutral-900 truncate max-w-xs">
                              {existing?.name || m.description}
                            </td>
                            <td className="p-2 font-mono font-bold text-emerald-800 text-right whitespace-nowrap">
                              {m.totalStock > 0 ? `${m.totalStock} ${m.unit || "UND"}` : "--"}
                            </td>
                            <td className="p-2 font-mono text-neutral-600 whitespace-nowrap">
                              {m.validity || "--/--/----"}
                            </td>
                            <td className="p-2 font-mono font-bold text-neutral-900 text-right whitespace-nowrap">
                              {priceVal ? `R$ ${priceVal}` : "--"}
                            </td>
                          </tr>
                        );
                      })}
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
          disabled={isProcessing || matchedItems.length === 0}
          className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white min-h-[40px] px-4"
        >
          Preencher Estoque Automaticamente ({matchedItems.length} produtos)
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </DialogFooter>
    </>
  );
};

export const PdfStockModal: React.FC<PdfStockModalProps> = ({
  open,
  onOpenChange,
  products = [],
  onApplyStock,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <PdfStockContent
          products={products}
          onApplyStock={onApplyStock}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
