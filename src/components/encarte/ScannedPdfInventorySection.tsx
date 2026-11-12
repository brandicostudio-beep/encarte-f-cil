import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Upload,
  Sparkles,
  Link2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Search,
  Check,
  Eye,
  Info,
} from "lucide-react";
import type { EncarteProduct } from "@/types/encarte";
import {
  parseScannedPdfReport,
  enrichProductsWithSiteData,
  scannedProductToEncarteProduct,
  type ScannedPdfReportMetadata,
  type AggregatedScannedProduct,
  type ScannedPdfRow,
} from "@/lib/scanned-pdf-parser";
import { SALE_UNITS, normalizeSaleUnit } from "@/lib/parse-product";

interface ScannedPdfInventorySectionProps {
  existingProducts?: EncarteProduct[];
  onDataLoaded: (
    products: EncarteProduct[],
    sourceType: "pdf_scanned",
    unmatchedPhotos: string[]
  ) => void;
  onExtractCategoryUrl: (url: string) => Promise<{ ok: boolean; products?: EncarteProduct[]; error?: string }>;
}

export const ScannedPdfInventorySection: React.FC<ScannedPdfInventorySectionProps> = ({
  existingProducts = [],
  onDataLoaded,
  onExtractCategoryUrl,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<ScannedPdfReportMetadata | null>(null);

  // Lista agregada de produtos
  const [aggregatedProducts, setAggregatedProducts] = useState<AggregatedScannedProduct[]>([]);
  // Correções manuais de unidade (code -> unit)
  const [manualUnits, setManualUnits] = useState<Map<string, string>>(new Map());

  // Links do site da Cescom
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [isFetchingSite, setIsFetchingSite] = useState(false);
  const [siteSuccessInfo, setSiteSuccessInfo] = useState<string | null>(null);
  const [fetchedSiteProducts, setFetchedSiteProducts] = useState<EncarteProduct[]>([]);

  // Filtro de visualização (todos vs apenas em revisão)
  const [viewFilter, setViewFilter] = useState<"todos" | "revisao">("todos");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processar arquivo PDF
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);
    setWarnings([]);
    setProcessingStatus("Extraindo dados e tabelas do relatório escaneado...");

    try {
      const result = await parseScannedPdfReport(selectedFile, existingProducts);
      setMetadata(result.metadata);
      setWarnings(result.warnings);

      if (!result.ok && result.aggregated.length === 0) {
        setErrors(result.errors.length ? result.errors : ["Nenhum produto válido detectado no relatório."]);
        setAggregatedProducts([]);
      } else {
        // Aplica enriquecimento de site se já houver produtos carregados do site
        const enriched = enrichProductsWithSiteData(
          result.aggregated,
          fetchedSiteProducts,
          manualUnits
        );
        setAggregatedProducts(enriched);
      }
    } catch (err: any) {
      setErrors([`Falha no processamento: ${err?.message || String(err)}`]);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  // Buscar dados no site da Cescom via link colado
  const handleFetchSiteData = async () => {
    const rawUrl = siteUrlInput.trim();
    if (!rawUrl) return;

    setIsFetchingSite(true);
    setSiteSuccessInfo(null);
    setErrors([]);

    try {
      // Extrair URLs individuais se o usuário colou múltiplos links
      const urls = rawUrl.split(/\s+/).filter((u) => u.startsWith("http"));
      const allExtracted: EncarteProduct[] = [];

      for (const u of urls) {
        const res = await onExtractCategoryUrl(u);
        if (res.ok && res.products) {
          allExtracted.push(...res.products);
        }
      }

      if (allExtracted.length === 0) {
        // Tenta como categoria única
        const singleRes = await onExtractCategoryUrl(rawUrl);
        if (singleRes.ok && singleRes.products) {
          allExtracted.push(...singleRes.products);
        } else {
          setErrors([singleRes.error || "Não foi possível carregar os dados dos produtos a partir do link."]);
          return;
        }
      }

      setFetchedSiteProducts(allExtracted);

      // Re-enriquecer produtos do relatório com os novos dados do site
      const updated = enrichProductsWithSiteData(aggregatedProducts, allExtracted, manualUnits);
      setAggregatedProducts(updated);

      const matchedCount = updated.filter((p) => p.unitSource === "site").length;
      setSiteSuccessInfo(
        `${allExtracted.length} itens encontrados no site. ${matchedCount} produtos do relatório enriquecidos com unidade de venda e embalagem.`
      );
    } catch (err: any) {
      setErrors([`Erro ao consultar o site: ${err?.message || String(err)}`]);
    } finally {
      setIsFetchingSite(false);
    }
  };

  // Correção manual de unidade de venda por código
  const handleUpdateUnit = (code: string, newUnit: string) => {
    const updatedMap = new Map(manualUnits);
    updatedMap.set(code, newUnit);
    setManualUnits(updatedMap);

    const updated = enrichProductsWithSiteData(aggregatedProducts, fetchedSiteProducts, updatedMap);
    setAggregatedProducts(updated);
  };

  // Edição manual de campos de um produto em revisão
  const handleUpdateProductField = (
    code: string,
    field: "description" | "validity" | "totalStock" | "price",
    value: any
  ) => {
    setAggregatedProducts((prev) =>
      prev.map((p) => {
        if (p.code !== code) return p;
        if (field === "totalStock") {
          const qty = parseInt(value, 10) || 0;
          return {
            ...p,
            totalStock: qty,
            validityEntries: p.validityEntries.map((v, i) =>
              i === 0 ? { ...v, quantity: qty } : v
            ),
            needsReview: false,
          };
        }
        return {
          ...p,
          [field]: value,
          needsReview: field === "validity" ? false : p.needsReview,
        };
      })
    );
  };

  // Confirmar e aplicar ao Encarte de Validade
  const handleApplyToEncarte = () => {
    if (aggregatedProducts.length === 0) return;

    // Converte os produtos agregados para o formato final EncarteProduct
    const encarteProducts = aggregatedProducts
      .filter((p) => p.statusRelatorio !== "fora_do_ultimo_relatorio")
      .map(scannedProductToEncarteProduct);

    onDataLoaded(encarteProducts, "pdf_scanned", []);
  };

  const reviewItemsCount = aggregatedProducts.filter((p) => p.needsReview).length;
  const filteredProducts =
    viewFilter === "revisao"
      ? aggregatedProducts.filter((p) => p.needsReview)
      : aggregatedProducts;

  return (
    <div className="space-y-6">
      {/* 1. ÁREA DE UPLOAD DO PDF ESCANEADO */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          file
            ? "border-emerald-500 bg-emerald-50/20"
            : "border-neutral-300 hover:border-red-500 bg-neutral-50/50"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFileChange(dropped);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-red-100 text-red-700 rounded-full">
            <FileText className="h-8 w-8" />
          </div>

          <div>
            <h3 className="font-bold text-base text-neutral-900">
              {file ? file.name : "Arraste e solte o relatório em PDF escaneado aqui"}
            </h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
              Extrai código, descrição, validade, quantidade e status por OCR. Identifica preços
              manuscritos e separa avarias.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="border-neutral-300 hover:border-red-600 font-bold text-xs"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {file ? "Subir Outro Relatório PDF" : "Procurar Relatório PDF no Computador"}
          </Button>

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 animate-pulse pt-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>{processingStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* AVISOS E ALERTAS DO CABEÇALHO */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        </div>
      )}

      {/* METADADOS DO RELATÓRIO QUANDO EXTRAÍDO */}
      {metadata && (
        <div className="bg-neutral-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">Período de Validade:</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {metadata.reportDate || "Não identificado"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-300">
              <span>Páginas: {metadata.totalPages}</span>
              <span>Linhas lidas: {metadata.totalRows}</span>
              <span>Válidas: {metadata.validRows}</span>
              {metadata.reviewRows > 0 && (
                <span className="text-amber-400 font-bold">
                  Revisão pendente: {metadata.reviewRows}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md border border-neutral-700">
              Colunas: {metadata.headerColumnsFound.join(", ") || "Padrão"}
            </span>
          </div>
        </div>
      )}

      {/* 2. ENRIQUECIMENTO COM LINKS DO SITE DA CESCOM */}
      {aggregatedProducts.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-red-600" />
                Buscar Informações no Site da Cescom (Opcional)
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cole o link da categoria (ex: "validade próxima") ou links de produtos para
                preencher automaticamente embalagem, unidade de venda e fotos.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              placeholder="https://www.cescom.com.br/categoria/validade-proxima..."
              className="text-xs h-9 bg-neutral-50"
            />
            <Button
              type="button"
              disabled={isFetchingSite || !siteUrlInput.trim()}
              onClick={handleFetchSiteData}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 shrink-0"
            >
              {isFetchingSite ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Buscar no Site
                </>
              )}
            </Button>
          </div>

          {siteSuccessInfo && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{siteSuccessInfo}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. TABELA DE PRODUTOS & PAINEL DE REVISÃO */}
      {aggregatedProducts.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden">
          {/* Barra de título e filtros da tabela */}
          <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-700" />
                Produtos do Relatório ({aggregatedProducts.length} itens)
              </h4>
              <p className="text-xs text-neutral-500">
                Estoque somado por código. Cada código exibe suas validades correspondentes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewFilter === "todos" ? "default" : "outline"}
                onClick={() => setViewFilter("todos")}
                className={`text-xs h-8 ${viewFilter === "todos" ? "bg-neutral-900" : ""}`}
              >
                Todos ({aggregatedProducts.length})
              </Button>
              <Button
                size="sm"
                variant={viewFilter === "revisao" ? "default" : "outline"}
                onClick={() => setViewFilter("revisao")}
                className={`text-xs h-8 ${
                  viewFilter === "revisao"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : reviewItemsCount > 0
                    ? "border-amber-400 text-amber-800 bg-amber-50"
                    : ""
                }`}
              >
                Revisão Pendente ({reviewItemsCount})
              </Button>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-100 text-neutral-700 font-bold sticky top-0 z-10 border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descrição (PDF / Site)</th>
                  <th className="py-2.5 px-3">Validade(s)</th>
                  <th className="py-2.5 px-3 text-right">Estoque Disp.</th>
                  <th className="py-2.5 px-3">Unidade de Venda</th>
                  <th className="py-2.5 px-3">Preço Manuscrito</th>
                  <th className="py-2.5 px-3">Observação / Trecho Original</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredProducts.map((p) => {
                  const isReview = p.needsReview;
                  return (
                    <tr
                      key={p.code}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        isReview ? "bg-amber-50/40" : ""
                      }`}
                    >
                      {/* Badge do Status do Relatório */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {p.statusRelatorio === "fora_do_ultimo_relatorio" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-700">
                            Fora do Relatório
                          </span>
                        ) : p.statusRelatorio === "novo" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Novo
                          </span>
                        ) : isReview ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-700" />
                            Revisar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            Atualizado
                          </span>
                        )}
                      </td>

                      {/* Código */}
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                        {p.code}
                      </td>

                      {/* Descrição */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <input
                          type="text"
                          value={p.description}
                          onChange={(e) =>
                            handleUpdateProductField(p.code, "description", e.target.value)
                          }
                          className="w-full bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-red-600 focus:bg-white px-1 py-0.5 text-xs font-semibold outline-hidden uppercase"
                        />
                        {p.packaging && (
                          <span className="text-[10px] text-neutral-500 block px-1">
                            Embalagem: {p.packaging}
                          </span>
                        )}
                      </td>

                      {/* Validades (Suporta múltiplas) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {p.validityEntries.length > 1 ? (
                          <div className="space-y-1">
                            {p.validityEntries.map((ve, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-700"
                              >
                                <span className="font-bold">{ve.validity}</span>
                                <span className="text-neutral-500">({ve.quantity} {p.unit})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={p.validity}
                            onChange={(e) =>
                              handleUpdateProductField(p.code, "validity", e.target.value)
                            }
                            className="bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-red-600 focus:bg-white px-1 py-0.5 text-xs font-mono font-bold outline-hidden"
                          />
                        )}
                      </td>

                      {/* Estoque Total Disponível */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                        <input
                          type="number"
                          value={p.totalStock}
                          onChange={(e) =>
                            handleUpdateProductField(p.code, "totalStock", e.target.value)
                          }
                          className="w-16 text-right bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-red-600 focus:bg-white px-1 py-0.5 text-xs font-mono font-bold outline-hidden"
                        />
                        <span className="text-neutral-500 ml-1">{p.unit}</span>
                      </td>

                      {/* Unidade de Venda (Correção manual prevalece sobre o site) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <select
                            value={p.unit}
                            onChange={(e) => handleUpdateUnit(p.code, e.target.value)}
                            className={`h-7 px-2 text-xs font-bold rounded-md border ${
                              p.unitSource === "manual"
                                ? "bg-amber-50 border-amber-400 text-amber-900"
                                : p.unitSource === "site"
                                ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                                : "bg-neutral-100 border-neutral-300 text-neutral-800"
                            }`}
                          >
                            {SALE_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.fullLabel}
                              </option>
                            ))}
                          </select>
                          {p.unitSource === "manual" && (
                            <span
                              className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"
                              title="Correção manual aplicada (prevalece sobre o site)"
                            >
                              manual
                            </span>
                          )}
                          {p.unitSource === "site" && (
                            <span
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                              title="Unidade identificada no site"
                            >
                              site
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Preço Manuscrito Conferido */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-neutral-400 font-mono">R$</span>
                          <input
                            type="text"
                            value={p.price || p.precoManuscrito || ""}
                            placeholder="0,00"
                            onChange={(e) =>
                              handleUpdateProductField(p.code, "price", e.target.value)
                            }
                            className="w-16 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-red-600 focus:bg-white px-1 py-0.5 text-xs font-mono font-bold outline-hidden"
                          />
                        </div>
                        {p.precoManuscrito && (
                          <span className="text-[10px] text-amber-700 block font-sans">
                            manuscrito: R$ {p.precoManuscrito}
                          </span>
                        )}
                      </td>

                      {/* Observações / Trecho Original de OCR */}
                      <td className="py-2.5 px-3 max-w-xs text-neutral-600">
                        {p.obs && (
                          <span className="font-bold text-red-600 block text-[11px]">
                            {p.obs}
                          </span>
                        )}
                        {p.reviewReasons.length > 0 && (
                          <span className="text-amber-800 font-bold block text-[10px]">
                            Motivo: {p.reviewReasons.join("; ")}
                          </span>
                        )}
                        {p.originalSnippets.length > 0 && (
                          <details className="mt-1 cursor-pointer">
                            <summary className="text-[10px] text-neutral-400 hover:text-neutral-700">
                              Ver trecho original OCR
                            </summary>
                            <pre className="text-[9px] bg-neutral-100 p-1.5 rounded mt-1 overflow-x-auto text-neutral-700 font-mono whitespace-pre-wrap">
                              {p.originalSnippets.join("\n")}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé da tabela com botão de aplicar */}
          <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span>
                {aggregatedProducts.filter((p) => p.statusRelatorio !== "fora_do_ultimo_relatorio").length}{" "}
                produtos ativos serão inseridos ou atualizados no encarte.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleApplyToEncarte}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Confirmar e Aplicar ao Encarte de Validade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
