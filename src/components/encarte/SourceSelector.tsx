import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseSpreadsheetFile, type SpreadsheetValidationResult } from "@/lib/spreadsheet-parser";
import { processPhotoBankUpload, matchPhotosWithProducts, type LoadedPhoto } from "@/lib/photo-bank";
import {
  extractDrivePhotos,
  indexDriveFolder,
  downloadCampaignDrivePhotos,
} from "@/lib/product.functions";
import { parseGoogleDriveUrl, type DriveIndexedPhoto } from "@/lib/drive-api";
import {
  getCachedPhoto,
  setCachedPhoto,
  isPhotoCacheValid,
} from "@/lib/drive-cache";
import { optimizeDataUrl } from "@/lib/image-normalizer";
import { DriveConnectorCard } from "./DriveConnectorCard";
import type { EncarteProduct } from "@/types/encarte";
import { DropzoneUpload } from "./DropzoneUpload";
import { EmptyState } from "./EmptyState";
import {
  FileSpreadsheet,
  Link2,
  Images,
  AlertCircle,
  Sparkles,
  ArrowRight,
  FileText,
  RotateCcw,
  Upload,
  CloudDownload,
  CheckCircle2,
  FolderCheck,
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
  const [photoBankSummary, setPhotoBankSummary] = useState<string | null>(null);
  const [unmatchedPhotoNames, setUnmatchedPhotoNames] = useState<string[]>([]);
  const [photoBankSource, setPhotoBankSource] = useState<"upload" | "drive">("upload");
  const [driveUrl, setDriveUrl] = useState("");
  const [loadingDrivePhotos, setLoadingDrivePhotos] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [driveImagesCount, setDriveImagesCount] = useState<number | null>(null);
  const [driveProgressMessage, setDriveProgressMessage] = useState<string | null>(null);
  const [driveConnectorStatus, setDriveConnectorStatus] = useState<"not_connected" | "token_expired" | null>(null);
  const [driveIndexedPhotos, setDriveIndexedPhotos] = useState<DriveIndexedPhoto[]>([]);
  const [corruptDriveFiles, setCorruptDriveFiles] = useState<{ name: string; reason: string }[]>([]);

  // Upload e Parse da Planilha (.xlsx ou .csv)
  const handleSpreadsheetFiles = async (files: File[] | FileList) => {
    const file = files[0];
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
        let prods = result.validProducts;

        // Se já tiver fotos indexadas do Google Drive, sincroniza e baixa para os produtos da planilha
        if (driveIndexedPhotos.length > 0) {
          const knownSet = new Set(prods.map((p) => p.code.toLowerCase().trim()));
          const matchedIndexed = driveIndexedPhotos.filter((item) => knownSet.has(item.code.toLowerCase().trim()));

          const photosToMatch: LoadedPhoto[] = [];
          const itemsToDownload: { id: string; code: string; filename: string; modifiedTime?: string; isPrimary: boolean }[] = [];

          for (const item of matchedIndexed) {
            if (isPhotoCacheValid(item.code, item.id, item.modifiedTime)) {
              const cached = getCachedPhoto(item.code);
              if (cached?.dataUrl) {
                photosToMatch.push({
                  filename: item.name,
                  dataUrl: cached.dataUrl,
                  extractedCode: item.code,
                  fileId: item.id,
                  isPrimary: item.isPrimary,
                  modifiedTime: item.modifiedTime,
                  source: "drive",
                });
                continue;
              }
            }
            itemsToDownload.push({
              id: item.id,
              code: item.code,
              filename: item.name,
              modifiedTime: item.modifiedTime,
              isPrimary: item.isPrimary,
            });
          }

          if (itemsToDownload.length > 0) {
            try {
              const dlRes = await downloadCampaignDrivePhotos({
                data: { items: itemsToDownload },
              });
              if (dlRes.ok) {
                for (const p of dlRes.photos) {
                  const optimizedUrl = await optimizeDataUrl(p.dataUrl);
                  setCachedPhoto({
                    code: p.code,
                    fileId: p.fileId,
                    filename: p.filename,
                    modifiedTime: p.modifiedTime,
                    dataUrl: optimizedUrl,
                    cachedAt: Date.now(),
                  });
                  photosToMatch.push({
                    filename: p.filename,
                    dataUrl: optimizedUrl,
                    extractedCode: p.code,
                    fileId: p.fileId,
                    isPrimary: p.isPrimary,
                    modifiedTime: p.modifiedTime,
                    source: "drive",
                  });
                }
              }
            } catch (err) {
              console.warn("Aviso ao baixar fotos do Drive para nova planilha:", err);
            }
          }

          const allLoaded = [...loadedPhotos, ...photosToMatch];
          setLoadedPhotos(allLoaded);
          const matchResult = matchPhotosWithProducts(allLoaded, prods, "drive");
          prods = matchResult.updatedProducts;
          setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
          setPhotoBankSummary(
            `${driveFolderName || "Google Drive"}: ${driveIndexedPhotos.length} fotos indexadas · ${matchResult.matchedCount} associadas à planilha`
          );
        } else if (loadedPhotos.length > 0) {
          const matchResult = matchPhotosWithProducts(loadedPhotos, prods, "upload");
          prods = matchResult.updatedProducts;
          setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
          setPhotoBankSummary(
            `${loadedPhotos.length} fotos recebidas · ${matchResult.matchedCount} associadas · ${matchResult.unmatchedPhotos.length} sem produto`
          );
        }

        setPendingProducts(prods);
        setSpreadsheetSuccessInfo(
          `${result.validProducts.length} produtos válidos identificados na planilha.`
        );
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
    }
  };

  // Upload do Banco de Fotos (múltiplas imagens ou arquivo .zip)
  const handlePhotoBankFiles = async (files: File[] | FileList) => {
    if (!files || files.length === 0) return;

    setProcessingPhotos(true);
    try {
      const knownCodes = pendingProducts.map((p) => p.code);
      const photos = await processPhotoBankUpload(files, knownCodes);
      setLoadedPhotos(photos);

      if (pendingProducts.length > 0) {
        const matchResult = matchPhotosWithProducts(photos, pendingProducts, "upload");
        setPendingProducts(matchResult.updatedProducts);
        setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
        setPhotoBankSummary(
          `${photos.length} fotos recebidas · ${matchResult.matchedCount} associadas · ${matchResult.unmatchedPhotos.length} sem produto`
        );
      } else {
        setPhotoBankSummary(`${photos.length} fotos recebidas no banco de fotos`);
        setUnmatchedPhotoNames(photos.map((p) => p.filename));
      }
    } catch (err) {
      console.error("Erro no processamento do banco de fotos:", err);
    } finally {
      setProcessingPhotos(false);
    }
  };

  // Puxar fotos do Google Drive (pasta via Google Drive API ou arquivo .zip)
  const handleFetchDrivePhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setLoadingDrivePhotos(true);
    setDriveError(null);
    setDriveConnectorStatus(null);
    setDriveFolderName(null);
    setDriveImagesCount(null);
    setDriveProgressMessage("Conectando ao Google Drive...");
    setCorruptDriveFiles([]);

    try {
      const linkInfo = parseGoogleDriveUrl(driveUrl.trim());

      // CASO 1: Pasta no Google Drive (leitura via API v3 com conector Lovable)
      if (linkInfo && linkInfo.type === "folder") {
        setDriveProgressMessage("Lendo pasta e subpastas via Google Drive API...");
        const knownCodes = pendingProducts.map((p) => p.code);
        const indexRes = await indexDriveFolder({
          data: {
            url: driveUrl.trim(),
            knownCodes: knownCodes.length > 0 ? knownCodes : undefined,
          },
        });

        if (!indexRes.ok) {
          if (indexRes.errorCode === "not_connected") {
            setDriveConnectorStatus("not_connected");
            setDriveError(null);
            return;
          }
          if (indexRes.errorCode === "token_expired") {
            setDriveConnectorStatus("token_expired");
            setDriveError(null);
            return;
          }
          setDriveError(
            indexRes.errorMessage ||
              "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive."
          );
          return;
        }

        setDriveFolderName(indexRes.folder?.name || "Pasta do Google Drive");
        setDriveImagesCount(indexRes.totalImages);
        setDriveIndexedPhotos(indexRes.indexedPhotos);

        // Baixar apenas as fotos dos produtos da campanha atual
        setDriveProgressMessage(
          `Pasta '${indexRes.folder?.name}' (${indexRes.totalImages} fotos). Baixando imagens da campanha...`
        );

        const photosToMatch: LoadedPhoto[] = [];
        const itemsToDownload: {
          id: string;
          code: string;
          filename: string;
          modifiedTime?: string;
          isPrimary: boolean;
        }[] = [];

        const knownSet = new Set(knownCodes.map((c) => c.toLowerCase().trim()));
        const targetIndexed =
          knownSet.size > 0
            ? indexRes.indexedPhotos.filter((p) => knownSet.has(p.code.toLowerCase().trim()))
            : indexRes.indexedPhotos.filter((p) => p.isPrimary).slice(0, 50);

        for (const item of targetIndexed) {
          if (isPhotoCacheValid(item.code, item.id, item.modifiedTime)) {
            const cached = getCachedPhoto(item.code);
            if (cached?.dataUrl) {
              photosToMatch.push({
                filename: item.name,
                dataUrl: cached.dataUrl,
                extractedCode: item.code,
                fileId: item.id,
                isPrimary: item.isPrimary,
                modifiedTime: item.modifiedTime,
                source: "drive",
              });
              continue;
            }
          }
          itemsToDownload.push({
            id: item.id,
            code: item.code,
            filename: item.name,
            modifiedTime: item.modifiedTime,
            isPrimary: item.isPrimary,
          });
        }

        if (itemsToDownload.length > 0) {
          setDriveProgressMessage(
            `Baixando ${itemsToDownload.length} foto(s) da campanha com files/{id}?alt=media...`
          );
          const dlRes = await downloadCampaignDrivePhotos({
            data: { items: itemsToDownload },
          });

          if (dlRes.ok) {
            for (const p of dlRes.photos) {
              const optimizedUrl = await optimizeDataUrl(p.dataUrl);
              setCachedPhoto({
                code: p.code,
                fileId: p.fileId,
                filename: p.filename,
                modifiedTime: p.modifiedTime,
                dataUrl: optimizedUrl,
                cachedAt: Date.now(),
              });
              photosToMatch.push({
                filename: p.filename,
                dataUrl: optimizedUrl,
                extractedCode: p.code,
                fileId: p.fileId,
                isPrimary: p.isPrimary,
                modifiedTime: p.modifiedTime,
                source: "drive",
              });
            }

            if (dlRes.corruptFiles && dlRes.corruptFiles.length > 0) {
              setCorruptDriveFiles(
                dlRes.corruptFiles.map((c) => ({
                  name: c.filename,
                  reason: c.reason,
                }))
              );
            }
          }
        }

        setDriveProgressMessage(null);
        const allLoaded = [...loadedPhotos, ...photosToMatch];
        setLoadedPhotos(allLoaded);

        if (pendingProducts.length > 0) {
          const matchResult = matchPhotosWithProducts(allLoaded, pendingProducts, "drive");
          setPendingProducts(matchResult.updatedProducts);
          setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
          setPhotoBankSummary(
            `Pasta '${indexRes.folder?.name}' (${indexRes.totalImages} imagens no Drive) · ${matchResult.matchedCount} associadas à campanha`
          );
        } else {
          setPhotoBankSummary(
            `Pasta '${indexRes.folder?.name}' lida com sucesso (${indexRes.totalImages} imagens indexadas no Drive)`
          );
          setUnmatchedPhotoNames(indexRes.indexedPhotos.map((p) => p.name));
        }
        return;
      }

      // CASO 2: Arquivo compartilhado no Drive ou arquivo .zip
      setDriveProgressMessage("Baixando arquivo do Google Drive...");
      const res = await extractDrivePhotos({
        data: {
          url: driveUrl.trim(),
          knownCodes: pendingProducts.map((p) => p.code),
        },
      });

      if (!res.ok) {
        if (res.errorCode === "not_connected") {
          setDriveConnectorStatus("not_connected");
          setDriveError(null);
          return;
        }
        if (res.errorCode === "token_expired") {
          setDriveConnectorStatus("token_expired");
          setDriveError(null);
          return;
        }
        setDriveError(
          res.error ||
            "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive."
        );
        return;
      }

      const photos = (res.photos || []).map((p) => ({
        ...p,
        source: "drive" as const,
      }));
      const allLoaded = [...loadedPhotos, ...photos];
      setLoadedPhotos(allLoaded);

      if (pendingProducts.length > 0) {
        const matchResult = matchPhotosWithProducts(allLoaded, pendingProducts, "drive");
        setPendingProducts(matchResult.updatedProducts);
        setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
        setPhotoBankSummary(
          `${photos.length} fotos recebidas do Google Drive · ${matchResult.matchedCount} associadas aos produtos`
        );
      } else {
        setPhotoBankSummary(`${photos.length} fotos recebidas do Google Drive`);
        setUnmatchedPhotoNames(photos.map((p) => p.filename));
      }
    } catch (err) {
      console.error("Erro ao puxar fotos do Google Drive:", err);
      setDriveError(
        "A pasta precisa estar compartilhada com a conta conectada e a conexão precisa de permissão de leitura do Drive."
      );
    } finally {
      setLoadingDrivePhotos(false);
      setDriveProgressMessage(null);
    }
  };

  // Concluir importação da planilha e avançar para preços
  const handleConfirmSpreadsheet = () => {
    if (pendingProducts.length === 0) return;
    try {
      onDataLoaded(pendingProducts, "spreadsheet", unmatchedPhotoNames);
    } catch (err) {
      console.error("Erro ao avançar para etapa de preços:", err);
      // Fallback seguro de chamada
      onDataLoaded(pendingProducts, "spreadsheet", unmatchedPhotoNames);
    }
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
        let unmatched = unmatchedPhotoNames;

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

  // Baixar modelo CSV
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
    <div className="rounded-xl border bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-600" />
            Origem dos Dados do Encarte
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione a fonte para carregar os produtos do encarte promocional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasExistingProducts && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              className="min-h-[44px] text-xs text-neutral-600"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Recomeçar Encarte
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onLoadSample}
            className="min-h-[44px] text-xs bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
            Carregar Demonstração (16 itens)
          </Button>
        </div>
      </div>

      {/* Seletor de Modo: Planilha ou Link (Áreas de toque mínimas de 44px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSourceMode("spreadsheet")}
          className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all min-h-[56px] focus-visible:ring-2 focus-visible:ring-red-600 ${
            sourceMode === "spreadsheet"
              ? "border-red-600 bg-red-50/50 shadow-xs ring-1 ring-red-500"
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
          className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all min-h-[56px] focus-visible:ring-2 focus-visible:ring-red-600 ${
            sourceMode === "link"
              ? "border-red-600 bg-red-50/50 shadow-xs ring-1 ring-red-500"
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

      {/* ÁREA DA OPÇÃO A: PLANILHA COM DRAG & DROP */}
      {sourceMode === "spreadsheet" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-neutral-900">
                Colunas esperadas na planilha:
              </span>
              <span className="text-xs text-neutral-500 ml-1.5 font-mono">
                código, descrição, embalagem (ex: "1X10 GR"), estoque, validade (dd/mm/aaaa)
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto min-h-[36px]"
            >
              <FileText className="h-3.5 w-3.5" />
              Baixar Modelo de Planilha (.csv)
            </button>
          </div>

          <DropzoneUpload
            type="spreadsheet"
            accept=".xlsx, .xls, .csv"
            multiple={false}
            title="Arraste e solte o arquivo da planilha aqui"
            subtitle="Suporta arquivos Excel (.xlsx, .xls) e planilhas de texto (.csv). Zeros à esquerda no código são preservados."
            isProcessing={parsingSpreadsheet}
            summaryText={spreadsheetSuccessInfo}
            onFilesSelected={handleSpreadsheetFiles}
          />

          {/* Validação: Lista de Erros Linha a Linha (se houver) */}
          {spreadsheetErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-xs text-red-900">
              <div className="flex items-center gap-1.5 font-bold text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Erros encontrados na validação da planilha ({spreadsheetErrors.length}):
              </div>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto pl-1">
                {spreadsheetErrors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Botão de Avanço (Ação Principal da Tela) */}
          {pendingProducts.length > 0 && (
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={handleConfirmSpreadsheet}
                className="min-h-[44px] px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
              >
                Avançar para Preços ({pendingProducts.length} produtos)
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ÁREA DA OPÇÃO B: LINK DA CATEGORIA */}
      {sourceMode === "link" && (
        <div className="space-y-4">
          <form onSubmit={handleExtractLink} className="space-y-3">
            <Label htmlFor="category-link" className="text-xs font-bold text-neutral-900">
              Cole a URL da categoria do fornecedor
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="category-link"
                type="url"
                placeholder="https://fornecedor.com.br/categoria/validade-proxima..."
                value={categoryUrl}
                onChange={(e) => setCategoryUrl(e.target.value)}
                required
                className="text-xs min-h-[44px]"
              />
              <Button
                type="submit"
                disabled={loadingLink}
                className="min-h-[44px] px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0"
              >
                {loadingLink ? "Lendo página..." : "Importar produtos"}
              </Button>
            </div>
          </form>

          {/* Estado de Falha no Link: Mensagem Clara + Alternativa da Planilha */}
          {linkError && (
            <EmptyState
              type="link_failed"
              customMessage={linkError}
              primaryAction={{
                label: "Usar Planilha (.xlsx / .csv)",
                onClick: () => setSourceMode("spreadsheet"),
                icon: <FileSpreadsheet className="h-4 w-4" />,
              }}
              secondaryAction={{
                label: "Tentar outro link",
                onClick: () => setLinkError(null),
              }}
            />
          )}
        </div>
      )}

      {/* BANCO DE FOTOS EM LOTE (Opcional: Upload do Computador ou Link do Google Drive) */}
      <div className="rounded-xl border bg-neutral-50/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Images className="h-5 w-5 text-neutral-700 shrink-0" />
            <div>
              <div className="text-sm font-bold text-neutral-900">
                Banco de Fotos em Lote (Opcional)
              </div>
              <p className="text-xs text-neutral-500">
                Puxe fotos por upload local ou informe o link de uma pasta/arquivo do Google Drive.
              </p>
            </div>
          </div>

          {/* Abas de Escolha da Origem das Fotos */}
          <div className="inline-flex rounded-lg border bg-neutral-200/60 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPhotoBankSource("upload")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "upload"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Upload className="h-3.5 w-3.5 text-red-600" />
              Computador / .ZIP
            </button>

            <button
              type="button"
              onClick={() => setPhotoBankSource("drive")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "drive"
                  ? "bg-white text-blue-900 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <CloudDownload className="h-3.5 w-3.5 text-blue-600" />
              Link do Google Drive
            </button>
          </div>
        </div>

        {/* MODO 1: UPLOAD LOCAL / DRAG & DROP / ZIP */}
        {photoBankSource === "upload" && (
          <DropzoneUpload
            type="photos"
            accept="image/*, .zip"
            multiple={true}
            title="Arraste as fotos dos produtos ou o arquivo .zip aqui"
            subtitle="Associação automática pelo código no nome do arquivo (ex: 24657.jpg). Quando houver mais de uma foto do mesmo código, a primeira em ordem alfabética é selecionada."
            isProcessing={processingPhotos}
            summaryText={photoBankSummary}
            onFilesSelected={handlePhotoBankFiles}
          />
        )}

        {/* MODO 2: IMPORTAÇÃO POR LINK DO GOOGLE DRIVE */}
        {photoBankSource === "drive" && (
          <div className="space-y-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            {/* Card de Conexão com o Conector Google Drive do Lovable */}
            {driveConnectorStatus && (
              <DriveConnectorCard
                reason={driveConnectorStatus}
                onSwitchToZip={() => setPhotoBankSource("upload")}
              />
            )}

            <form onSubmit={handleFetchDrivePhotos} className="space-y-3">
              <Label
                htmlFor="drive-url"
                className="text-xs font-bold text-neutral-900 flex items-center justify-between"
              >
                <span>Link da Pasta ou Arquivo (.zip) no Google Drive</span>
                <span className="text-[11px] font-semibold text-blue-600">
                  Google Drive API v3 (Conector Lovable)
                </span>
              </Label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <CloudDownload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    id="drive-url"
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/... ou drive/u/0/folders/..."
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    required
                    className="pl-9 text-xs min-h-[44px]"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loadingDrivePhotos}
                  className="min-h-[44px] px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 shadow-xs"
                >
                  {loadingDrivePhotos ? (
                    <>
                      <span className="animate-spin mr-1.5">⏳</span>
                      Puxando fotos do Drive...
                    </>
                  ) : (
                    <>
                      <CloudDownload className="h-4 w-4 mr-1.5" />
                      Puxar Fotos do Drive
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Progresso Detalhado com Nome da Pasta e Quantidade de Imagens */}
            {loadingDrivePhotos && driveProgressMessage && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  <span>{driveProgressMessage}</span>
                </div>
                {driveFolderName && (
                  <div className="text-[11.5px] text-blue-800 flex items-center gap-2 font-mono">
                    <FolderCheck className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                    <span>
                      Pasta: <strong>{driveFolderName}</strong>
                      {typeof driveImagesCount === "number" && (
                        <> · {driveImagesCount} imagens identificadas</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pasta e Quantidade de Imagens Encontradas com Sucesso */}
            {driveFolderName && !loadingDrivePhotos && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-900">
                <FolderCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Pasta: <strong>{driveFolderName}</strong>
                </span>
                {typeof driveImagesCount === "number" && (
                  <span className="bg-white px-2 py-0.5 rounded border border-blue-200 font-mono text-[11px] font-bold text-blue-800">
                    {driveImagesCount} imagens encontradas
                  </span>
                )}
              </div>
            )}

            {/* Alerta de Arquivos Corrompidos Pulados */}
            {corruptDriveFiles.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  Arquivos corrompidos ou ilegíveis ({corruptDriveFiles.length}):
                </div>
                <p className="text-[11px] text-amber-800">
                  Estes arquivos foram pulados automaticamente e não impediram a leitura dos demais. Estão registrados na lista de pendências.
                </p>
                <div className="font-mono text-[10.5px] text-amber-950 max-h-16 overflow-y-auto space-y-0.5 pt-1">
                  {corruptDriveFiles.map((c, i) => (
                    <div key={i}>• {c.name}: {c.reason}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagem de Erro Clara */}
            {driveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3.5 text-xs text-red-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  Falha ao acessar o Google Drive
                </div>
                <p className="text-neutral-800 leading-relaxed font-medium">{driveError}</p>
              </div>
            )}

            {/* Resumo de Sucesso */}
            {photoBankSummary && !loadingDrivePhotos && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-xs font-bold text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span>{photoBankSummary}</span>
              </div>
            )}

            {/* Guia Visual de Ajuda do Google Drive mantendo o ZIP como alternativa */}
            <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3.5 text-xs text-blue-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-blue-950">
                <span>💡 Como configurar e compartilhar as fotos no Google Drive:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-blue-900/90 leading-relaxed pl-1">
                <li>No Google Drive, clique com o botão direito na pasta (ou arquivo .zip) e escolha <strong>Compartilhar &gt; Compartilhar</strong>.</li>
                <li>Em <em>Acesso geral</em>, certifique-se de compartilhar com a conta conectada ou definir como <strong>Qualquer pessoa com o link</strong> (como Leitor).</li>
                <li>Copie o link e cole no campo acima. Os nomes das fotos devem conter o código do produto (ex: <code>24657.jpg</code> ou <code>24657-1.jpg</code>).</li>
              </ol>
              <div className="pt-1 text-[11px] text-blue-800 font-semibold border-t border-blue-200/80 mt-1.5">
                Dica alternativa: Se sua pasta corporativa for bloqueada para acesso externo, clique com o botão direito na pasta no Drive e selecione <strong>Fazer download</strong> (o Drive baixa um .zip) e envie na aba "Computador / .ZIP".
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
