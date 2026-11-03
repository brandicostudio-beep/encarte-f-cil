import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropzoneUpload } from "@/components/encarte/DropzoneUpload";
import { DriveConnectorCard } from "@/components/encarte/DriveConnectorCard";
import { parseColecaoSpreadsheet } from "@/lib/colecoes-parser";
import { processPhotoBankUpload, matchPhotosWithProducts, type LoadedPhoto } from "@/lib/photo-bank";
import {
  extractDrivePhotos,
  indexDriveFolder,
  downloadCampaignDrivePhotos,
  extractCategoryProducts,
} from "@/lib/product.functions";
import { parseGoogleDriveUrl, type DriveIndexedPhoto } from "@/lib/drive-api";
import { getCachedPhoto, setCachedPhoto, isPhotoCacheValid } from "@/lib/drive-cache";
import { optimizeDataUrl } from "@/lib/image-normalizer";
import {
  isFileSystemAccessSupported,
  indexLocalFolder,
  crossLocalFolderWithCampaign,
  loadCampaignPhotosFromFolder,
  saveFolderHandle,
  getSavedFolderHandle,
  verifyFolderPermission,
  type LocalIndexedFile,
  type LocalFolderScanProgress,
  type LocalFolderLoadProgress,
  type LocalFolderCrossingResult,
} from "@/lib/local-folder-service";
import {
  generateWindowsSearchBatches,
  copyQueryToClipboard,
  type WindowsSearchExtension,
} from "@/lib/windows-search-helper";
import type { ColecaoProduct } from "@/types/colecoes";
import {
  FileSpreadsheet,
  Link2,
  Folder,
  FolderCheck,
  RefreshCw,
  FolderSync,
  Search,
  Upload,
  CloudDownload,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FileText,
  Terminal,
  Check,
  Copy,
  RotateCcw,
  X,
  Layers,
} from "lucide-react";

export interface ColecoesSourceSelectorProps {
  onProductsLoaded: (
    products: ColecaoProduct[],
    sourceType: "spreadsheet" | "link" | "sample"
  ) => void;
  onUpdateExistingPhotos?: (updated: ColecaoProduct[]) => void;
  existingProducts?: ColecaoProduct[];
  hasExistingProducts?: boolean;
  onClose?: () => void;
}

export const ColecoesSourceSelector: React.FC<ColecoesSourceSelectorProps> = ({
  onProductsLoaded,
  onUpdateExistingPhotos,
  existingProducts = [],
  hasExistingProducts = false,
  onClose,
}) => {
  const [sourceMode, setSourceMode] = useState<"spreadsheet" | "link">("spreadsheet");

  // Estados de Planilha
  const [parsingSpreadsheet, setParsingSpreadsheet] = useState(false);
  const [spreadsheetErrors, setSpreadsheetErrors] = useState<string[]>([]);
  const [spreadsheetSuccessInfo, setSpreadsheetSuccessInfo] = useState<string | null>(null);
  const [pendingProducts, setPendingProducts] = useState<ColecaoProduct[]>([]);

  // Estados de Link da Categoria
  const [categoryUrl, setCategoryUrl] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Estados do Banco de Fotos
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<LoadedPhoto[]>([]);
  const [photoBankSummary, setPhotoBankSummary] = useState<string | null>(null);
  const [unmatchedPhotoNames, setUnmatchedPhotoNames] = useState<string[]>([]);
  const [photoBankSource, setPhotoBankSource] = useState<"folder" | "upload" | "windows_search" | "drive">("folder");

  // Estados do Gerador de Busca para o Windows Explorer (AQS)
  const [searchExtension, setSearchExtension] = useState<WindowsSearchExtension>("png");
  const [searchBatchSize, setSearchBatchSize] = useState<number>(30);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);

  // Estados da Pasta do Computador (showDirectoryPicker)
  const [isFsSupported, setIsFsSupported] = useState(true);
  const [folderHandle, setFolderHandle] = useState<any>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [totalLocalImages, setTotalLocalImages] = useState<number | null>(null);
  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const [scanProgress, setScanProgress] = useState<LocalFolderScanProgress | null>(null);
  const [localCrossingResult, setLocalCrossingResult] = useState<LocalFolderCrossingResult | null>(null);
  const [isLoadingLocalPhotos, setIsLoadingLocalPhotos] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LocalFolderLoadProgress | null>(null);
  const [folderPermissionStatus, setFolderPermissionStatus] = useState<"granted" | "prompt" | "denied" | null>(null);
  const [folderAccessError, setFolderAccessError] = useState<string | null>(null);
  const [indexedFiles, setIndexedFiles] = useState<LocalIndexedFile[]>([]);
  const [missingPhotosExpanded, setMissingPhotosExpanded] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Estados do Google Drive
  const [driveUrl, setDriveUrl] = useState("");
  const [loadingDrivePhotos, setLoadingDrivePhotos] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveConnectorStatus, setDriveConnectorStatus] = useState<"not_connected" | "token_expired" | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [driveProgressMessage, setDriveProgressMessage] = useState<string | null>(null);
  const [driveIndexedPhotos, setDriveIndexedPhotos] = useState<DriveIndexedPhoto[]>([]);

  // Inicializa suporte e reconecta a pasta salva no IndexedDB (mesma do encarte de validade)
  useEffect(() => {
    const supported = isFileSystemAccessSupported();
    setIsFsSupported(supported);
    if (!supported) {
      setPhotoBankSource("upload");
      return;
    }

    getSavedFolderHandle().then(async (saved) => {
      if (saved && saved.handle) {
        setFolderHandle(saved.handle);
        setLocalFolderName(saved.folderName);
        const perm = await verifyFolderPermission(saved.handle, false);
        setFolderPermissionStatus(perm);
        if (perm === "granted") {
          scanAndCrossFolder(saved.handle, false);
        }
      }
    });
  }, []);

  // Lista atual de produtos e códigos
  const currentProductsList = pendingProducts.length > 0 ? pendingProducts : existingProducts;
  const currentProductCodes = useMemo(() => {
    return currentProductsList.map((p) => p.code);
  }, [currentProductsList]);

  const windowsSearchResult = useMemo(() => {
    return generateWindowsSearchBatches(currentProductCodes, {
      extension: searchExtension,
      batchSize: searchBatchSize,
    });
  }, [currentProductCodes, searchExtension, searchBatchSize]);

  const handleCopyBatchQuery = async (batchIndex: number, query: string) => {
    const ok = await copyQueryToClipboard(query);
    if (ok) {
      setCopiedBatchIndex(batchIndex);
      setTimeout(() => {
        setCopiedBatchIndex((prev) => (prev === batchIndex ? null : prev));
      }, 2000);
    }
  };

  // Escaneia a pasta selecionada e cruza com os produtos atuais
  const scanAndCrossFolder = async (handle: any, autoLoadPhotos = true) => {
    setIsScanningFolder(true);
    setFolderAccessError(null);
    setScanProgress({ scannedFiles: 0, imagesFound: 0 });

    try {
      const prodsToCross = pendingProducts.length > 0 ? pendingProducts : existingProducts;
      const indexResult = await indexLocalFolder(handle, {
        onProgress: (p) => setScanProgress(p),
        knownCodes: prodsToCross.map((p) => p.code),
      });

      setIndexedFiles(indexResult.files);
      setTotalLocalImages(indexResult.totalImagesRead);
      setLocalFolderName(indexResult.folderName);

      const crossing = crossLocalFolderWithCampaign(indexResult.files, prodsToCross as any);
      setLocalCrossingResult(crossing);

      if (autoLoadPhotos && prodsToCross.length > 0 && crossing.matchedProductsCount > 0) {
        await loadLocalCampaignPhotos(crossing, prodsToCross);
      } else {
        setPhotoBankSummary(
          `Pasta '${indexResult.folderName}': ${indexResult.totalImagesRead} imagens encontradas · ${crossing.matchedProductsCount} casam com a coleção`
        );
        setUnmatchedPhotoNames(crossing.unmatchedFileNames);
      }
    } catch (err: any) {
      console.error("Erro ao escanear pasta do computador:", err);
      setFolderAccessError("Erro ao ler a pasta de fotos. Verifique as permissões de acesso da pasta.");
    } finally {
      setIsScanningFolder(false);
      setScanProgress(null);
    }
  };

  // Carrega as fotos locais apenas para os produtos da coleção
  const loadLocalCampaignPhotos = async (
    crossing: LocalFolderCrossingResult,
    targetProds: ColecaoProduct[]
  ) => {
    setIsLoadingLocalPhotos(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const loadRes = await loadCampaignPhotosFromFolder(crossing, targetProds as any, {
        signal: controller.signal,
        onProgress: (p) => setLoadProgress(p),
      });

      const updatedMap = new Map(loadRes.updatedProducts.map((p) => [p.code.toLowerCase().trim(), p.image]));

      const nextProds = targetProds.map((prod) => {
        const newImg = updatedMap.get(prod.code.toLowerCase().trim());
        if (newImg) return { ...prod, image: newImg };
        return prod;
      });

      if (pendingProducts.length > 0) {
        setPendingProducts(nextProds);
      } else if (onUpdateExistingPhotos) {
        onUpdateExistingPhotos(nextProds);
      }

      setLoadedPhotos((prev) => [...prev, ...loadRes.loadedPhotos]);
      setUnmatchedPhotoNames(crossing.unmatchedFileNames);
      setPhotoBankSummary(
        `Pasta '${localFolderName || "Fotos"}': ${crossing.totalImagesRead} imagens indexadas · ${loadRes.loadedPhotos.length} fotos carregadas para a coleção`
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Erro ao carregar fotos locais:", err);
      }
    } finally {
      setIsLoadingLocalPhotos(false);
      setLoadProgress(null);
    }
  };

  const handleChooseLocalFolder = async () => {
    if (!isFileSystemAccessSupported()) return;
    setFolderAccessError(null);

    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "read" });
      setFolderHandle(handle);
      setLocalFolderName(handle.name || "Pasta de Fotos");
      setFolderPermissionStatus("granted");
      await saveFolderHandle(handle);
      await scanAndCrossFolder(handle, true);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Erro ao escolher pasta:", err);
    }
  };

  const handleReconnectFolder = async () => {
    if (!folderHandle) return;
    try {
      const perm = await verifyFolderPermission(folderHandle, true);
      setFolderPermissionStatus(perm);
      if (perm === "granted") {
        await scanAndCrossFolder(folderHandle, true);
      }
    } catch (err) {
      console.error("Erro ao reconectar pasta:", err);
    }
  };

  const handleRefreshFolder = async () => {
    if (!folderHandle) {
      await handleChooseLocalFolder();
      return;
    }
    await scanAndCrossFolder(folderHandle, true);
  };

  // Upload e Parse da Planilha (.xlsx ou .csv)
  const handleSpreadsheetFiles = async (files: File[] | FileList) => {
    const file = files[0];
    if (!file) return;

    setParsingSpreadsheet(true);
    setSpreadsheetErrors([]);
    setSpreadsheetSuccessInfo(null);
    setPendingProducts([]);

    try {
      const result = await parseColecaoSpreadsheet(file);

      if (result.errors.length > 0) {
        setSpreadsheetErrors(result.errors);
      }

      if (result.products.length > 0) {
        let prods = result.products;

        // Se já tiver fotos indexadas da pasta da rede/local, cruza imediatamente
        if (indexedFiles.length > 0) {
          const crossing = crossLocalFolderWithCampaign(indexedFiles, prods as any);
          setLocalCrossingResult(crossing);
          const loadRes = await loadCampaignPhotosFromFolder(crossing, prods as any);
          const updatedMap = new Map(loadRes.updatedProducts.map((p) => [p.code.toLowerCase().trim(), p.image]));
          prods = prods.map((p) => {
            const img = updatedMap.get(p.code.toLowerCase().trim());
            return img ? { ...p, image: img } : p;
          });
          setLoadedPhotos((prev) => [...prev, ...loadRes.loadedPhotos]);
          setUnmatchedPhotoNames(crossing.unmatchedFileNames);
          setPhotoBankSummary(
            `Pasta '${localFolderName || "Computador"}': ${crossing.totalImagesRead} imagens indexadas · ${loadRes.loadedPhotos.length} fotos associadas à planilha`
          );
        }

        setPendingProducts(prods);
        setSpreadsheetSuccessInfo(
          `${result.products.length} produtos válidos identificados na planilha (${prods.filter((p) => p.isPrincipal).length} principais).`
        );
      }
    } catch (err: any) {
      console.error(err);
      setSpreadsheetErrors([
        "Não foi possível processar o arquivo. Verifique se é uma planilha .xlsx ou .csv válida: " +
          (err?.message || String(err)),
      ]);
    } finally {
      setParsingSpreadsheet(false);
    }
  };

  // Extrair Link da Categoria (URL Cescom)
  const handleExtractLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryUrl.trim()) return;

    setLoadingLink(true);
    setLinkError(null);

    try {
      const res = await extractCategoryProducts({ data: { url: categoryUrl.trim() } });
      if (!res.ok || !res.products || res.products.length === 0) {
        setLinkError(
          res.error ||
            "Não foi possível ler os produtos da página. Você pode optar por importar via planilha .xlsx ou .csv."
        );
      } else {
        // Converte EncarteProduct para ColecaoProduct
        let prods: ColecaoProduct[] = res.products.map((p) => ({
          id: `col-prod-${p.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: p.code,
          description: p.name || `PRODUTO ${p.code}`,
          image: p.image || "",
          isPrincipal: false,
          included: true,
        }));

        // Se tiver fotos da pasta de rede local, cruza também
        if (indexedFiles.length > 0) {
          const crossing = crossLocalFolderWithCampaign(indexedFiles, prods as any);
          setLocalCrossingResult(crossing);
          const loadRes = await loadCampaignPhotosFromFolder(crossing, prods as any);
          const updatedMap = new Map(loadRes.updatedProducts.map((p) => [p.code.toLowerCase().trim(), p.image]));
          prods = prods.map((p) => {
            const img = updatedMap.get(p.code.toLowerCase().trim());
            return img ? { ...p, image: img } : p;
          });
        }

        setPendingProducts(prods);
        setSpreadsheetSuccessInfo(`${prods.length} produtos extraídos do link com sucesso.`);
      }
    } catch (err: any) {
      setLinkError("Erro de conexão ao acessar o link: " + (err?.message || String(err)));
    } finally {
      setLoadingLink(false);
    }
  };

  // Baixar Modelo CSV de Coleções
  const handleDownloadTemplate = () => {
    const csvContent =
      "CODPROD,DESCRICAO,PRINCIPAL,FOTO\n" +
      '23396,"FRALDA PERSONAL PREM MEGA XXG",SIM,\n' +
      '19559,"SEQUILHOS BOMBISCOITO 320 GR",NAO,\n' +
      '20609,"SALGADINHO YOKITOS CONCHINHA 153 GR",SIM,\n' +
      '21620,"CHOCOLATE GRANULADO DORI 30X120 GR",NAO,\n';

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo-encarte-colecoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Upload do Banco de Fotos (ZIP / Múltiplas Imagens)
  const handlePhotoBankFiles = async (files: File[] | FileList) => {
    if (!files || files.length === 0) return;

    setProcessingPhotos(true);
    try {
      const prodsToCross = pendingProducts.length > 0 ? pendingProducts : existingProducts;
      const knownCodes = prodsToCross.map((p) => p.code);
      const photos = await processPhotoBankUpload(files, knownCodes);
      setLoadedPhotos(photos);

      if (prodsToCross.length > 0) {
        const matchResult = matchPhotosWithProducts(photos, prodsToCross as any, "upload");
        const updatedMap = new Map(matchResult.updatedProducts.map((p: any) => [p.code.toLowerCase().trim(), p.image]));
        const nextProds = prodsToCross.map((p) => {
          const img = updatedMap.get(p.code.toLowerCase().trim());
          return img ? { ...p, image: img } : p;
        });

        if (pendingProducts.length > 0) {
          setPendingProducts(nextProds);
        } else if (onUpdateExistingPhotos) {
          onUpdateExistingPhotos(nextProds);
        }

        setUnmatchedPhotoNames(matchResult.unmatchedPhotos);
        setPhotoBankSummary(
          `Upload / ZIP: ${photos.length} fotos recebidas · ${matchResult.matchedCount} associadas à coleção`
        );
      }
    } catch (err) {
      console.error("Erro no processamento do banco de fotos:", err);
    } finally {
      setProcessingPhotos(false);
    }
  };

  // Fotos do Google Drive
  const handleFetchDrivePhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setLoadingDrivePhotos(true);
    setDriveError(null);
    setDriveConnectorStatus(null);
    setDriveFolderName(null);
    setDriveProgressMessage("Conectando ao Google Drive...");

    try {
      const linkInfo = parseGoogleDriveUrl(driveUrl.trim());

      if (linkInfo && linkInfo.type === "folder") {
        setDriveProgressMessage("Lendo pasta e subpastas via Google Drive API...");
        const prodsToCross = pendingProducts.length > 0 ? pendingProducts : existingProducts;
        const indexRes = await indexDriveFolder({
          data: {
            url: driveUrl.trim(),
            knownCodes: prodsToCross.map((p) => p.code),
          },
        });

        if (!indexRes.ok) {
          const errCode = (indexRes as any).errorCode;
          if (errCode === "not_connected") setDriveConnectorStatus("not_connected");
          else if (errCode === "token_expired") setDriveConnectorStatus("token_expired");
          else setDriveError("Não foi possível acessar a pasta do Google Drive.");
          return;
        }

        setDriveFolderName(indexRes.folder?.name || "Google Drive");
        setDriveIndexedPhotos(indexRes.indexedPhotos);

        const knownSet = new Set(prodsToCross.map((p) => p.code.toLowerCase().trim()));
        const matchedIndexed = indexRes.indexedPhotos.filter((item) => knownSet.has(item.code.toLowerCase().trim()));

        const photosToMatch: LoadedPhoto[] = [];
        const itemsToDownload: any[] = [];

        for (const item of matchedIndexed) {
          if (isPhotoCacheValid(item.code, item.id, item.modifiedTime)) {
            const cached = getCachedPhoto(item.code);
            if (cached?.dataUrl) {
              photosToMatch.push({
                filename: item.name,
                dataUrl: cached.dataUrl,
                extractedCode: item.code,
                fileId: item.id,
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
          const dlRes = await downloadCampaignDrivePhotos({ data: { items: itemsToDownload } });
          if (dlRes.ok) {
            for (const p of dlRes.photos) {
              const optUrl = await optimizeDataUrl(p.dataUrl);
              setCachedPhoto({
                code: p.code,
                fileId: p.fileId,
                filename: p.filename,
                dataUrl: optUrl,
                cachedAt: Date.now(),
              });
              photosToMatch.push({
                filename: p.filename,
                dataUrl: optUrl,
                extractedCode: p.code,
                fileId: p.fileId,
                source: "drive",
              });
            }
          }
        }

        const allLoaded = [...loadedPhotos, ...photosToMatch];
        setLoadedPhotos(allLoaded);

        if (prodsToCross.length > 0) {
          const matchResult = matchPhotosWithProducts(allLoaded, prodsToCross as any, "drive");
          const updatedMap = new Map(matchResult.updatedProducts.map((p: any) => [p.code.toLowerCase().trim(), p.image]));
          const nextProds = prodsToCross.map((p) => {
            const img = updatedMap.get(p.code.toLowerCase().trim());
            return img ? { ...p, image: img } : p;
          });

          if (pendingProducts.length > 0) {
            setPendingProducts(nextProds);
          } else if (onUpdateExistingPhotos) {
            onUpdateExistingPhotos(nextProds);
          }

          setPhotoBankSummary(
            `Pasta '${indexRes.folder?.name}' (${indexRes.totalImages} imagens no Drive) · ${matchResult.matchedCount} associadas`
          );
        }
      } else {
        const res = await extractDrivePhotos({
          data: { url: driveUrl.trim(), knownCodes: currentProductCodes },
        });

        if (!res.ok) {
          setDriveError(res.error || "Erro ao ler link do Drive.");
          return;
        }

        const photos = (res.photos || []).map((p) => ({ ...p, source: "drive" as const }));
        setLoadedPhotos((prev) => [...prev, ...photos]);
      }
    } catch (err: any) {
      setDriveError("Erro ao processar Google Drive: " + (err?.message || String(err)));
    } finally {
      setLoadingDrivePhotos(false);
      setDriveProgressMessage(null);
    }
  };

  // Concluir e enviar produtos para o Workspace de Coleções
  const handleConfirmProducts = () => {
    if (pendingProducts.length === 0) return;
    onProductsLoaded(pendingProducts, sourceMode);
    if (onClose) onClose();
  };

  return (
    <div className="space-y-6">
      {/* 1. SELETOR DE MODO: PLANILHA vs LINK DA CATEGORIA */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-red-600" />
              Origem dos Produtos de Coleções
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Importe os produtos para a grade do Esquenta Black (20 por página). Preço, validade e estoque são ocultados automaticamente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <Button size="sm" variant="outline" onClick={onClose} className="text-xs font-semibold">
                <X className="h-3.5 w-3.5 mr-1" />
                Fechar
              </Button>
            )}
          </div>
        </div>

        {/* Botoes de selecao: A) Planilha e B) Link da Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSourceMode("spreadsheet")}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all min-h-[56px] ${
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
              <div className="font-bold text-sm text-neutral-900">A) Planilha (.xlsx ou .csv)</div>
              <div className="text-xs text-neutral-500">
                Upload com código, descrição, foto opcional e flag Principal.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode("link")}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all min-h-[56px] ${
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
              <div className="font-bold text-sm text-neutral-900">B) Link da Categoria</div>
              <div className="text-xs text-neutral-500">
                Extrair da página do fornecedor (ex.: Cescom).
              </div>
            </div>
          </button>
        </div>

        {/* OPÇÃO A: PLANILHA COM DRAG & DROP */}
        {sourceMode === "spreadsheet" && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-neutral-900">Colunas esperadas na planilha:</span>
                <span className="text-xs text-neutral-500 ml-1.5 font-mono">
                  código, descrição (nome), foto (opcional), principal (opcional: SIM/NÃO)
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

            {/* Erros Linha a Linha (se houver) */}
            {spreadsheetErrors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-xs text-red-900">
                <div className="flex items-center gap-1.5 font-bold text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Problemas identificados na planilha:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 max-h-36 overflow-y-auto pl-1">
                  {spreadsheetErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* OPÇÃO B: LINK DA CATEGORIA */}
        {sourceMode === "link" && (
          <div className="space-y-4 pt-1">
            <form onSubmit={handleExtractLink} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="category-url" className="text-xs font-bold text-neutral-900">
                  Cole o link da categoria com os produtos:
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="category-url"
                      type="url"
                      placeholder="https://exemplo.com.br/categoria-produtos..."
                      value={categoryUrl}
                      onChange={(e) => setCategoryUrl(e.target.value)}
                      className="pl-9 h-11 text-xs"
                      disabled={loadingLink}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loadingLink || !categoryUrl.trim()}
                    className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 shadow-xs shrink-0"
                  >
                    {loadingLink ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Lendo produtos...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Carregar Produtos do Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {linkError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{linkError}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Resumo quando há produtos pendentes */}
        {pendingProducts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-green-950 font-bold">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span>
                {pendingProducts.length} produtos prontos para a coleção (
                {pendingProducts.filter((p) => p.image).length} com foto)
              </span>
            </div>
            <Button
              type="button"
              onClick={handleConfirmProducts}
              className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-bold text-xs h-10 px-6 shadow-xs"
            >
              Aplicar na Coleção
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}
      </div>

      {/* 2. SEÇÃO: BANCO DE FOTOS EM LOTE (SINCRONIZAÇÃO DE REDE, WINDOWS EXPLORER, ZIP, DRIVE) */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0 shadow-xs">
              <FolderSync className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <span>Banco de Fotos em Lote (Opcional)</span>
                {totalLocalImages !== null && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                    {totalLocalImages} fotos indexadas
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Puxe fotos por upload local ou informe o link de uma pasta/arquivo do Google Drive.
              </p>
            </div>
          </div>

          {/* Abas do Banco de Fotos */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200/80 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPhotoBankSource("folder")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "folder"
                  ? "bg-white text-amber-950 shadow-xs ring-1 ring-amber-400"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <FolderCheck className="h-3.5 w-3.5 text-amber-600" />
              Pasta do computador
            </button>

            <button
              type="button"
              onClick={() => setPhotoBankSource("windows_search")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "windows_search"
                  ? "bg-white text-purple-950 shadow-xs ring-1 ring-purple-400"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Search className="h-3.5 w-3.5 text-purple-600" />
              Gerar busca para o Windows
            </button>

            <button
              type="button"
              onClick={() => setPhotoBankSource("upload")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "upload"
                  ? "bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-400"
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
                  ? "bg-white text-blue-900 shadow-xs ring-1 ring-blue-400"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <CloudDownload className="h-3.5 w-3.5 text-blue-600" />
              Link do Google Drive
            </button>
          </div>
        </div>

        {/* ABA 1: PASTA DO COMPUTADOR / REDE */}
        {photoBankSource === "folder" && (
          <div className="space-y-4">
            {!isFsSupported ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  Recurso exclusivo do Chrome e Edge
                </div>
                <p>Use o Chrome ou Edge para selecionar a pasta local/rede, ou envie via ZIP ou Google Drive.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pasta já conectada (ex: Fotos_Palm) */}
                {localFolderName ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200">
                      <div className="flex items-center gap-2.5">
                        <FolderCheck className="h-5 w-5 text-amber-700 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
                            <span>
                              Pasta: <strong>{localFolderName}</strong>
                            </span>
                            {typeof totalLocalImages === "number" && (
                              <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono text-[11px] font-bold text-amber-900">
                                {totalLocalImages} fotos lidas
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-600">
                            {indexedFiles.length} fotos indexadas disponíveis para cruzar com a coleção.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {folderPermissionStatus === "prompt" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleReconnectFolder}
                            disabled={isScanningFolder || isLoadingLocalPhotos}
                            className="min-h-[36px] text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Reconectar pasta
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshFolder}
                          disabled={isScanningFolder || isLoadingLocalPhotos}
                          className="min-h-[36px] text-xs border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${isScanningFolder ? "animate-spin" : ""}`}
                          />
                          Atualizar leitura
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleChooseLocalFolder}
                          disabled={isScanningFolder || isLoadingLocalPhotos}
                          className="min-h-[36px] text-xs text-neutral-600 hover:text-neutral-900"
                        >
                          Trocar pasta
                        </Button>
                      </div>
                    </div>

                    {/* Feedback de escaneamento em tempo real */}
                    {isScanningFolder && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2 animate-pulse">
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                        <span>
                          Lendo pasta e subpastas... ({scanProgress?.scannedFiles || 0} arquivos verificados,{" "}
                          {scanProgress?.imagesFound || 0} fotos encontradas)
                        </span>
                      </div>
                    )}

                    {/* Progresso de carregamento de fotos */}
                    {isLoadingLocalPhotos && loadProgress && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-amber-900">
                          <span>Carregando fotos da coleção ({loadProgress.loaded} de {loadProgress.total})...</span>
                          <span>{Math.round((loadProgress.loaded / (loadProgress.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-600 h-full transition-all"
                            style={{
                              width: `${Math.round((loadProgress.loaded / (loadProgress.total || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Resumo do cruzamento */}
                    {localCrossingResult && !isScanningFolder && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-3 rounded-lg border border-green-200 bg-green-50/70 text-green-900">
                          <div className="text-lg font-black font-mono">
                            {localCrossingResult.matchedProductsCount}
                          </div>
                          <div className="font-semibold">produtos com foto encontrada</div>
                        </div>

                        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900">
                          <div className="text-lg font-black font-mono">
                            {localCrossingResult.missingProducts.length}
                          </div>
                          <div className="font-semibold">produtos sem foto na pasta</div>
                        </div>

                        <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800">
                          <div className="text-lg font-black font-mono">
                            {localCrossingResult.unmatchedFilesCount}
                          </div>
                          <div className="font-semibold">fotos sobressalentes na pasta</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-amber-200 bg-amber-50/40 rounded-xl text-center space-y-3">
                    <div className="p-3 bg-amber-100 rounded-full text-amber-800">
                      <Folder className="h-8 w-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <div className="font-bold text-sm text-neutral-900">
                        Selecione a Pasta de Fotos no seu Computador ou Rede
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        O navegador lê os nomes das fotos, cruza com os códigos da coleção e carrega automaticamente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleChooseLocalFolder}
                      disabled={isScanningFolder}
                      className="min-h-[44px] px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      Escolher pasta de fotos
                    </Button>
                  </div>
                )}

                {/* Dica para pasta na rede local (exatamente como no encarte de validade) */}
                <div className="rounded-lg bg-neutral-100/80 border border-neutral-200 p-3 text-xs text-neutral-700 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-neutral-900">
                    <FolderSync className="h-3.5 w-3.5 text-neutral-600" />
                    Dica para pasta na rede local:
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Em um servidor da rede local (ex.: <code>\\10.248.22.8\Fotos_Palm</code>), o navegador pode não aceitar o caminho UNC diretamente. Se acontecer, mapeie o compartilhamento para uma letra de unidade (ex.: <code>Z:</code>) no Windows Explorer e selecione essa unidade.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: GERAR BUSCA PARA O WINDOWS EXPLORER (AQS) */}
        {photoBankSource === "windows_search" && (
          <div className="space-y-4 bg-white p-4 rounded-xl border border-neutral-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900">
                <Terminal className="h-4 w-4 text-purple-600" />
                Gerador de Busca para o Windows Explorer (AQS)
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Gere consultas de busca com os códigos dos produtos da coleção para colar na pesquisa do Windows Explorer ou servidor de rede.
              </p>
            </div>

            {currentProductCodes.length === 0 ? (
              <div className="p-6 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-center text-xs text-neutral-500">
                Nenhum produto carregado ainda. Faça o upload da planilha ou insira o link acima para gerar as consultas.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold">Extensão:</Label>
                    <select
                      value={searchExtension}
                      onChange={(e) => setSearchExtension(e.target.value as WindowsSearchExtension)}
                      className="border rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="png">.png</option>
                      <option value="jpg">.jpg</option>
                      <option value="all">Todas (.png, .jpg, .webp)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold">Tamanho do Lote:</Label>
                    <select
                      value={searchBatchSize}
                      onChange={(e) => setSearchBatchSize(Number(e.target.value))}
                      className="border rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value={20}>20 produtos por lote</option>
                      <option value={30}>30 produtos por lote</option>
                      <option value={50}>50 produtos por lote</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  {windowsSearchResult.batches.map((batch, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="truncate flex-1">
                        <span className="font-bold text-neutral-800 mr-2">Lote {batch.batchIndex}:</span>
                        <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-mono text-neutral-700">
                          {batch.query.slice(0, 90)}...
                        </code>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyBatchQuery(idx, batch.query)}
                        className="text-xs font-semibold shrink-0"
                      >
                        {copiedBatchIndex === idx ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copiar Busca
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: COMPUTADOR / .ZIP */}
        {photoBankSource === "upload" && (
          <div className="space-y-4">
            <DropzoneUpload
              type="photos"
              accept=".zip, image/*"
              multiple={true}
              title="Arraste as fotos ou o arquivo .ZIP aqui"
              subtitle="O sistema extrai as fotos e cruza automaticamente pelos códigos da coleção."
              isProcessing={processingPhotos}
              summaryText={photoBankSummary}
              onFilesSelected={handlePhotoBankFiles}
            />
          </div>
        )}

        {/* ABA 4: LINK DO GOOGLE DRIVE */}
        {photoBankSource === "drive" && (
          <div className="space-y-4">
            {driveConnectorStatus ? (
              <DriveConnectorCard
                reason={driveConnectorStatus}
                onSwitchToZip={() => setPhotoBankSource("upload")}
              />
            ) : (
              <form onSubmit={handleFetchDrivePhotos} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="col-drive-url" className="text-xs font-bold text-neutral-900">
                    Cole o link da pasta ou arquivo no Google Drive:
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <CloudDownload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        id="col-drive-url"
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        className="pl-9 h-11 text-xs"
                        disabled={loadingDrivePhotos}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loadingDrivePhotos || !driveUrl.trim()}
                      className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-xs shrink-0"
                    >
                      {loadingDrivePhotos ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <CloudDownload className="h-4 w-4 mr-1.5" />
                          Puxar Fotos do Drive
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {driveProgressMessage && (
                  <p className="text-xs text-blue-700 animate-pulse font-medium">{driveProgressMessage}</p>
                )}

                {driveError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{driveError}</span>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
