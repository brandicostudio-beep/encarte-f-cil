import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseSpreadsheetFile, type SpreadsheetValidationResult } from "@/lib/spreadsheet-parser";
import { processPhotoBankUpload, matchPhotosWithProducts, type LoadedPhoto } from "@/lib/photo-bank";
import type { EncarteProduct } from "@/types/encarte";
import {
  FileSpreadsheet,
  Link2,
  Images,
  Upload,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FileText,
  RotateCcw,
} from "lucide-react";

interface SourceSelectorProps {
  onDataLoaded: (
    products: EncarteProduct[],
    sourceType: "spreadsheet" | "link" | "sample",
    unmatchedPhotos: string[]
  ) => void;
  onExtractCategoryUrl: (url: string) => Promise<{ ok: boolean; products?: EncarteProduct[]; error?: string }>;
  onLoadSample: () => void;
  hasExistingProducts: boolean;
  onReset: () => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  onDataLoaded,
  onExtractCategoryUrl,
  onLoadSample,
  hasExistingProducts,
  onReset,
}) => {
  const [sourceMode, setSourceMode] = useState<"spreadsheet" | "link">("spreadsheet");

  // Estados de Planilha
  const [parsingSpreadsheet, setParsingSpreadsheet] = useState(false);
  const [spreadsheetErrors, setSpreadsheetErrors] = useState<{ line: number; message: string }[]>([]);
  const [spreadsheetSuccessInfo, setSpreadsheetSuccessInfo] = useState<string | null>(null);
  const [pendingProducts, setPendingProducts] = useState<EncarteProduct[]>([]);

  // Estados de Link da Categoria
  const [categoryUrl, setCategoryUrl] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Estados do Banco de Fotos
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<LoadedPhoto[]>([]);
  const [photoBankSummary, setPhotoBankSummary] = useState<{
    total: number;
    matched: number;
    unmatched: string[];
  } | null>(null);

  // Upload e Parse da Planilha (.xlsx ou .csv)
  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingSpreadsheet(true);
    setSpreadsheetErrors([]);
    setSpreadsheetSuccessInfo(null);
    setPendingProducts([]);

    try {
      const result: SpreadsheetValidationResult = await parseSpreadsheetFile(file);

      if (result.errors.length > 0) {
        setSpreadsheetErrors(result.errors);
      }

      if (result.validProducts.length > 0) {
        setPendingProducts(result.validProducts);
        setSpreadsheetSuccessInfo(
          `${result.validProducts.length} produtos válidos identificados na planilha.`
        );

        // Se já tiver fotos carregadas no banco de fotos, sincroniza
        if (loadedPhotos.length > 0) {
          const matchResult = matchPhotosWithProducts(loadedPhotos, result.validProducts);
          setPendingProducts(matchResult.updatedProducts);
          setPhotoBankSummary({
            total: loadedPhotos.length,
            matched: matchResult.matchedCount,
            unmatched: matchResult.unmatchedPhotos,
          });
        }
      }
    } catch (err) {
      console.error(err);
      setSpreadsheetErrors([
        {
          line: 1,
          message: "Não foi possível processar o arquivo. Verifique se é uma planilha .xlsx ou .csv válida.",
        },
      ]);
    } finally {
      setParsingSpreadsheet(false);
      e.target.value = "";
    }
  };

  // Upload do Banco de Fotos (múltiplas imagens ou arquivo .zip)
  const handlePhotoBankUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessingPhotos(true);
    try {
      // Coletar códigos conhecidos se já tiver produtos
      const knownCodes = pendingProducts.map((p) => p.code);
      const photos = await processPhotoBankUpload(files, knownCodes);
      setLoadedPhotos(photos);

      if (pendingProducts.length > 0) {
        const matchResult = matchPhotosWithProducts(photos, pendingProducts);
        setPendingProducts(matchResult.updatedProducts);
        setPhotoBankSummary({
          total: photos.length,
          matched: matchResult.matchedCount,
          unmatched: matchResult.unmatchedPhotos,
        });
      } else {
        setPhotoBankSummary({
          total: photos.length,
          matched: 0,
          unmatched: photos.map((p) => p.filename),
        });
      }
    } catch (err) {
      console.error("Erro no processamento do banco de fotos:", err);
    } finally {
      setProcessingPhotos(false);
      e.target.value = "";
    }
  };

  // Concluir importação da planilha
  const handleConfirmSpreadsheet = () => {
    if (pendingProducts.length === 0) return;
    onDataLoaded(
      pendingProducts,
      "spreadsheet",
      photoBankSummary?.unmatched || []
    );
  };

  // Extrair Link da Categoria
  const handleExtractLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryUrl.trim()) return;

    setLoadingLink(true);
    setLinkError(null);

    try {
      const res = await onExtractCategoryUrl(categoryUrl);
      if (!res.ok || !res.products || res.products.length === 0) {
        setLinkError(
          res.error ||
            "Não foi possível ler os produtos da página. Você pode optar por importar via planilha .xlsx ou .csv."
        );
      } else {
        let prods = res.products;
        let unmatched: string[] = [];

        // Se o banco de fotos já foi carregado, aplica prioridade
        if (loadedPhotos.length > 0) {
          const matchResult = matchPhotosWithProducts(loadedPhotos, prods);
          prods = matchResult.updatedProducts;
          unmatched = matchResult.unmatchedPhotos;
        }

        onDataLoaded(prods, "link", unmatched);
      }
    } catch {
      setLinkError(
        "Erro de conexão com a página do fornecedor. Utilize o upload de planilha para prosseguir."
      );
    } finally {
      setLoadingLink(false);
    }
  };

  // Criar e baixar modelo simples de planilha CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      "código;descrição;embalagem;estoque;validade\n" +
      "24657;BISCOITO RECHEADO CHOCOLATE;1X130 GR;140;15/12/2026\n" +
      "10982;CAFÉ TORRADO TRADICIONAL;1X500 GR;85;20/12/2026\n" +
      "00123;LEITE UHT INTEGRAL;1X1 L;220;05/11/2026\n" +
      "33104;MOLHO DE TOMATE SACHÊ;1X300 GR;300;18/11/2026\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-produtos-encarte.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-600" />
            Origem dos Dados do Encarte
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha como carregar os produtos do encarte promocional. O preço de venda será digitado na etapa seguinte.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasExistingProducts && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              className="text-xs text-neutral-600"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Recomeçar Encarte
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onLoadSample}
            className="text-xs bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
            Carregar Demonstração
          </Button>
        </div>
      </div>

      {/* Seletor de Modo: Planilha ou Link */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSourceMode("spreadsheet")}
          className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
            sourceMode === "spreadsheet"
              ? "border-red-600 bg-red-50/50 shadow-sm ring-1 ring-red-500"
              : "border-neutral-200 hover:border-neutral-300 bg-neutral-50/50"
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              sourceMode === "spreadsheet" ? "bg-red-600 text-white" : "bg-neutral-200 text-neutral-600"
            }`}
          >
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-sm text-neutral-900">
              A) Planilha (.xlsx ou .csv)
            </div>
            <div className="text-xs text-neutral-500">
              Upload com código, descrição, embalagem, estoque e validade.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSourceMode("link")}
          className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
            sourceMode === "link"
              ? "border-red-600 bg-red-50/50 shadow-sm ring-1 ring-red-500"
              : "border-neutral-200 hover:border-neutral-300 bg-neutral-50/50"
          }`}
        >
          <div
            className={`p-2.5 rounded-lg ${
              sourceMode === "link" ? "bg-red-600 text-white" : "bg-neutral-200 text-neutral-600"
            }`}
          >
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-sm text-neutral-900">
              B) Link da Categoria
            </div>
            <div className="text-xs text-neutral-500">
              Extrair da página do fornecedor (ex.: "validade próxima").
            </div>
          </div>
        </button>
      </div>

      {/* ÁREA DA OPÇÃO A: PLANILHA */}
      {sourceMode === "spreadsheet" && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-bold text-neutral-900">
                Selecione o arquivo da planilha (.xlsx ou .csv)
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Colunas esperadas: <strong>código</strong>, <strong>descrição</strong>, <strong>embalagem</strong> (ex.: "1X10 GR"), <strong>estoque</strong> e <strong>validade</strong> (dd/mm/aaaa).
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
              className="text-xs text-primary hover:underline h-8"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Baixar Modelo de Planilha (.csv)
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white border border-neutral-300 hover:border-red-500 shadow-sm text-xs font-semibold text-neutral-800 transition-colors">
              <Upload className="h-4 w-4 text-red-600" />
              {parsingSpreadsheet ? "Lendo e validando planilha..." : "Escolher arquivo .xlsx ou .csv"}
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                disabled={parsingSpreadsheet}
                onChange={handleSpreadsheetUpload}
              />
            </label>

            {spreadsheetSuccessInfo && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {spreadsheetSuccessInfo}
              </span>
            )}
          </div>

          {/* Lista de Erros com Número da Linha (se houver) */}
          {spreadsheetErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-xs text-red-900">
              <div className="flex items-center gap-1.5 font-bold text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Foram encontrados erros na validação da planilha ({spreadsheetErrors.length}):
              </div>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto pl-1">
                {spreadsheetErrors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
              {pendingProducts.length > 0 && (
                <div className="pt-2 text-[11px] text-neutral-700">
                  Você pode prosseguir com os {pendingProducts.length} produtos válidos identificados ou corrigir a planilha e reenviar.
                </div>
              )}
            </div>
          )}

          {/* Botão de Prosseguir se houver produtos válidos */}
          {pendingProducts.length > 0 && (
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={handleConfirmSpreadsheet}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Avançar para Revisão de Preços ({pendingProducts.length} produtos)
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ÁREA DA OPÇÃO B: LINK DA CATEGORIA */}
      {sourceMode === "link" && (
        <form onSubmit={handleExtractLink} className="space-y-4">
          <div className="rounded-xl border bg-neutral-50/60 p-5 space-y-3">
            <Label htmlFor="category-link" className="text-sm font-bold text-neutral-900">
              Cole o link da categoria ou página do fornecedor
            </Label>
            <p className="text-xs text-muted-foreground">
              O sistema extrai código, nome, validade, imagem, embalagem e estoque dos produtos encontrados.
            </p>

            <div className="flex gap-2">
              <Input
                id="category-link"
                type="url"
                placeholder="https://fornecedor.com.br/validade-proxima..."
                value={categoryUrl}
                onChange={(e) => setCategoryUrl(e.target.value)}
                required
                className="text-xs"
              />
              <Button
                type="submit"
                disabled={loadingLink}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0"
              >
                {loadingLink ? "Importando..." : "Importar produtos"}
              </Button>
            </div>

            {/* Mensagem de Erro Clara com Opção de Usar Planilha */}
            {linkError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-xs text-red-900">
                <div className="flex items-center gap-1.5 font-bold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Falha na leitura da página do fornecedor
                </div>
                <p className="text-[11px] text-neutral-700">{linkError}</p>
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSourceMode("spreadsheet")}
                    className="h-7 text-xs bg-white text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                    Alternar para Origem por Planilha (.xlsx / .csv)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* SEÇÃO DO BANCO DE FOTOS (Opcional, vale para as duas origens) */}
      <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-neutral-100/60 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-neutral-200 text-neutral-800">
              <Images className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                Banco de Fotos (Opcional)
                <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded font-normal">
                  Válido para ambas as origens
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie lote de fotos ou arquivo <strong>.zip</strong>. O sistema associa pelo código (ex.: <code>24657.jpg</code>, <code>24657-1.jpg</code>).
              </p>
            </div>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border hover:border-neutral-400 text-xs font-semibold shadow-sm transition-colors shrink-0">
            <Upload className="h-4 w-4 text-neutral-700" />
            {processingPhotos ? "Processando imagens..." : "Carregar fotos ou .zip"}
            <input
              type="file"
              multiple
              accept="image/*, .zip"
              className="hidden"
              disabled={processingPhotos}
              onChange={handlePhotoBankUpload}
            />
          </label>
        </div>

        {/* Resumo do Banco de Fotos */}
        {photoBankSummary && (
          <div className="rounded-lg bg-white border p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800">
                {photoBankSummary.total} imagens carregadas no banco de fotos
              </span>
              <span className="text-green-700 font-bold">
                {photoBankSummary.matched} produtos vinculados à foto
              </span>
            </div>

            {photoBankSummary.unmatched.length > 0 && (
              <div className="text-[11px] text-amber-800">
                <strong>{photoBankSummary.unmatched.length} fotos sem produto correspondente:</strong>{" "}
                <span className="font-mono text-neutral-600">
                  {photoBankSummary.unmatched.slice(0, 5).join(", ")}
                  {photoBankSummary.unmatched.length > 5 ? "..." : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
