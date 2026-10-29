import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Folder,
  RefreshCw,
  FolderSync,
  ChevronDown,
  ChevronUp,
  XCircle,
  Search,
  Copy,
  Check,
  Terminal,
  FileArchive,
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
  existingProducts?: EncarteProduct[];
  onReset: () => void;
  onUpdateExistingProductsPhotos?: (updated: EncarteProduct[], unmatched: string[]) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  onDataLoaded,
  onExtractCategoryUrl,
  onLoadSample,
  hasExistingProducts,
  existingProducts = [],
  onReset,
  onUpdateExistingProductsPhotos,
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
  const [photoBankSource, setPhotoBankSource] = useState<"folder" | "upload" | "windows_search" | "drive">("folder");

  // Estados do Gerador de Busca para o Windows Explorer (AQS)
  const [searchExtension, setSearchExtension] = useState<WindowsSearchExtension>("png");
  const [searchBatchSize, setSearchBatchSize] = useState<number>(30);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);
  const [batchExpectedCounts, setBatchExpectedCounts] = useState<{ [batchIndex: number]: number }>({});
  const [zipDiscrepancyWarning, setZipDiscrepancyWarning] = useState<string | null>(null);
  const [zipCrossingSummary, setZipCrossingSummary] = useState<{
    matchedCount: number;
    missingProducts: { code: string; name: string }[];
    unmatchedFiles: string[];
  } | null>(null);
  const [missingZipPhotosExpanded, setMissingZipPhotosExpanded] = useState<boolean>(true);

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

  // Inicializa suporte e tenta reconectar pasta anterior salva no IndexedDB
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
          // Se já tem permissão concedida, indexa em segundo plano
          scanAndCrossFolder(saved.handle, false);
        }
      }
    });
  }, []);

  // Sincroniza produtos existentes se informados ou limpa se zerado
  useEffect(() => {
    if (existingProducts.length === 0) {
      setPendingProducts([]);
      setSpreadsheetSuccessInfo(null);
      setLoadedPhotos([]);
      setPhotoBankSummary(null);
      setUnmatchedPhotoNames([]);
      setLocalCrossingResult(null);
    } else if (pendingProducts.length === 0 && existingProducts.length > 0) {
      setPendingProducts(existingProducts);
    }
  }, [existingProducts]);

  // Lista atual de produtos e códigos únicos da campanha para geração de busca do Windows
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

      const crossing = crossLocalFolderWithCampaign(indexResult.files, prodsToCross);
      setLocalCrossingResult(crossing);

      if (autoLoadPhotos && prodsToCross.length > 0 && crossing.matchedProductsCount > 0) {
        await loadLocalCampaignPhotos(crossing, prodsToCross);
      } else {
        setPhotoBankSummary(
          `Pasta '${indexResult.folderName}': ${indexResult.totalImagesRead} imagens encontradas · ${crossing.matchedProductsCount} casam com a campanha`
        );
        setUnmatchedPhotoNames(crossing.unmatchedFileNames);
      }
    } catch (err: any) {
      console.error("Erro ao escanear pasta do computador:", err);
      setFolderAccessError(
        "Erro ao ler a pasta de fotos. Verifique as permissões de acesso da pasta."
      );
    } finally {
      setIsScanningFolder(false);
      setScanProgress(null);
    }
  };

  // Carrega apenas as fotos dos produtos da campanha
  const loadLocalCampaignPhotos = async (
    crossing: LocalFolderCrossingResult,
    targetProds: EncarteProduct[]
  ) => {
    setIsLoadingLocalPhotos(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const alreadyLoaded = new Set<string>();
      for (const p of targetProds) {
        if (p.image && p.photoSource === "folder") {
          alreadyLoaded.add(p.code.toLowerCase().trim());
        }
      }

      const res = await loadCampaignPhotosFromFolder(crossing, targetProds, {
        onProgress: (p) => setLoadProgress(p),
        signal: controller.signal,
        alreadyLoadedCodes: alreadyLoaded,
      });

      setLoadedPhotos((prev) => [...prev, ...res.loadedPhotos]);
      setPendingProducts(res.updatedProducts);

      if (onUpdateExistingProductsPhotos && res.updatedProducts.length > 0) {
        onUpdateExistingProductsPhotos(res.updatedProducts, crossing.unmatchedFileNames);
      }

      setPhotoBankSummary(
        `Pasta '${localFolderName || "Computador"}': ${crossing.totalImagesRead} imagens lidas · ${res.updatedProducts.filter((p) => p.image).length} fotos associadas à campanha`
      );
      setUnmatchedPhotoNames(crossing.unmatchedFileNames);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Carregamento de fotos cancelado pelo usuário.");
      } else {
        console.error("Erro ao carregar fotos da pasta:", err);
      }
    } finally {
      setIsLoadingLocalPhotos(false);
      setLoadProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Selecionar nova pasta via showDirectoryPicker
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
      if (err.name === "AbortError") {
        return; // Usuário cancelou o seletor do sistema
      }
      console.error("Erro ao escolher pasta:", err);
      setFolderAccessError(
        "Não foi possível acessar a pasta selecionada. Se ela estiver em um servidor da rede local (ex.: \\\\10.248.22.8\\Fotos_Palm), mapeie o compartilhamento para uma letra de unidade (ex.: Z:) no Windows Explorer e selecione essa unidade."
      );
    }
  };

  // Reconectar pasta salva quando a permissão precisar ser confirmada
  const handleReconnectFolder = async () => {
    if (!folderHandle) return;
    setFolderAccessError(null);
    try {
      const perm = await verifyFolderPermission(folderHandle, true);
      setFolderPermissionStatus(perm);
      if (perm === "granted") {
        await scanAndCrossFolder(folderHandle, true);
      } else {
        setFolderAccessError(
          "Permissão de leitura não concedida. Clique em 'Escolher pasta de fotos' para autorizar novamente."
        );
      }
    } catch (err) {
      console.error("Erro ao reconectar pasta:", err);
      setFolderAccessError(
        "A pasta não está mais acessível (unidade desconectada ou caminho inexistente). As fotos já carregadas foram mantidas."
      );
    }
  };

  // Atualizar leitura sem refazer a campanha
  const handleRefreshFolder = async () => {
    if (folderHandle) {
      await scanAndCrossFolder(folderHandle, true);
    }
  };

  // Cancelar carregamento de fotos
  const handleCancelLoad = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
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

        // Se já tiver fotos indexadas da Pasta do Computador, sincroniza e carrega para os produtos da planilha
        if (indexedFiles.length > 0) {
          const crossing = crossLocalFolderWithCampaign(indexedFiles, prods);
          setLocalCrossingResult(crossing);
          const loadRes = await loadCampaignPhotosFromFolder(crossing, prods);
          prods = loadRes.updatedProducts;
          setLoadedPhotos((prev) => [...prev, ...loadRes.loadedPhotos]);
          setUnmatchedPhotoNames(crossing.unmatchedFileNames);
          setPhotoBankSummary(
            `Pasta '${localFolderName || "Computador"}': ${crossing.totalImagesRead} imagens indexadas · ${crossing.matchedProductsCount} fotos associadas à planilha`
          );
        } else if (driveIndexedPhotos.length > 0) {
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
        const cols = result.identifiedColumns;
        let colInfo = "";
        if (cols) {
          const colParts: string[] = [];
          if (cols.code) colParts.push(`Cód: ${cols.code}`);
          if (cols.name) colParts.push(`Nome: ${cols.name}`);
          if (cols.packaging) colParts.push(`Embalagem: ${cols.packaging}`);
          if (cols.stock) colParts.push(`Estoque: ${cols.stock}`);
          if (cols.price) colParts.push(`Preço: ${cols.price}`);
          if (cols.validity) colParts.push(`Validade: ${cols.validity}`);
          if (colParts.length > 0) {
            colInfo = ` (${colParts.join(" · ")})`;
          }
        }
        setSpreadsheetSuccessInfo(
          `${result.validProducts.length} produtos válidos identificados na planilha.${colInfo}`
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
    setZipDiscrepancyWarning(null);
    try {
      const prodsToCross = pendingProducts.length > 0 ? pendingProducts : existingProducts;
      const knownCodes = prodsToCross.map((p) => p.code);
      const photos = await processPhotoBankUpload(files, knownCodes);
      setLoadedPhotos(photos);

      if (prodsToCross.length > 0) {
        const matchResult = matchPhotosWithProducts(photos, prodsToCross, "upload");
        setPendingProducts(matchResult.updatedProducts);
        setUnmatchedPhotoNames(matchResult.unmatchedPhotos);

        const matchedCodesSet = new Set(
          matchResult.updatedProducts.filter((p) => p.image).map((p) => p.code.toLowerCase().trim())
        );
        const missingProducts = prodsToCross
          .filter((p) => !matchedCodesSet.has(p.code.toLowerCase().trim()))
          .map((p) => ({ code: p.code, name: p.name }));

        setZipCrossingSummary({
          matchedCount: matchResult.matchedCount,
          missingProducts,
          unmatchedFiles: matchResult.unmatchedPhotos,
        });

        // Conferência com o campo "Quantos arquivos apareceram?" anotado nos lotes da busca
        const enteredValues = Object.values(batchExpectedCounts).filter(
          (c) => typeof c === "number" && !isNaN(c) && c > 0
        );
        if (enteredValues.length > 0) {
          const totalEntered = enteredValues.reduce((acc, curr) => acc + curr, 0);
          if (totalEntered !== photos.length) {
            setZipDiscrepancyWarning(
              `Atenção na conferência: Você anotou ${totalEntered} arquivo(s) na pesquisa do Windows, mas o ZIP enviado contém ${photos.length} foto(s). Verifique se todos os resultados encontrados foram selecionados com Ctrl+A ao compactar.`
            );
          }
        }

        setPhotoBankSummary(
          `Upload / ZIP: ${photos.length} fotos recebidas · ${matchResult.matchedCount} associadas · ${matchResult.unmatchedPhotos.length} sem produto`
        );

        if (onUpdateExistingProductsPhotos && matchResult.updatedProducts.length > 0) {
          onUpdateExistingProductsPhotos(matchResult.updatedProducts, matchResult.unmatchedPhotos);
        }
      } else {
        setPhotoBankSummary(`${photos.length} fotos recebidas no banco de fotos`);
        setUnmatchedPhotoNames(photos.map((p) => p.filename));
        setZipCrossingSummary({
          matchedCount: 0,
          missingProducts: [],
          unmatchedFiles: photos.map((p) => p.filename),
        });
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

        if (indexedFiles.length > 0) {
          const crossing = crossLocalFolderWithCampaign(indexedFiles, prods);
          setLocalCrossingResult(crossing);
          const loadRes = await loadCampaignPhotosFromFolder(crossing, prods);
          prods = loadRes.updatedProducts;
          unmatched = crossing.unmatchedFileNames;
        } else if (loadedPhotos.length > 0) {
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
              className="min-h-[44px] text-xs text-red-700 border-red-300 hover:bg-red-50 hover:text-red-800 font-bold"
              title="Zerar todos os dados e começar um novo encarte limpo"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 text-red-600" />
              Novo Encarte (Zerar Dados)
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

          {/* Abas de Escolha da Origem das Fotos (Pasta do computador, Gerar busca para o Windows, Computador / .ZIP, Link do Google Drive) */}
          <div className="inline-flex rounded-lg border bg-neutral-200/60 p-1 self-start sm:self-auto flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPhotoBankSource("folder")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all min-h-[36px] ${
                photoBankSource === "folder"
                  ? "bg-white text-amber-950 shadow-xs ring-1 ring-amber-400"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Folder className="h-3.5 w-3.5 text-amber-600" />
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

        {/* MODO 1: PASTA DO COMPUTADOR (showDirectoryPicker) */}
        {photoBankSource === "folder" && (
          <div className="space-y-4 bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
            {!isFsSupported ? (
              // Aviso para navegadores sem suporte ao showDirectoryPicker (ex: Firefox)
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  Recurso exclusivo do Chrome e Edge
                </div>
                <p className="leading-relaxed">
                  Use o Chrome ou o Edge para escolher a pasta do computador, ou use o ZIP ou o Google Drive.
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPhotoBankSource("upload")}
                    className="text-xs font-bold"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1 text-red-600" />
                    Ir para Computador / .ZIP
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPhotoBankSource("drive")}
                    className="text-xs font-bold"
                  >
                    <CloudDownload className="h-3.5 w-3.5 mr-1 text-blue-600" />
                    Ir para Link do Google Drive
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Se nenhuma pasta foi selecionada ainda */}
                {!localFolderName && (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-amber-200 bg-amber-50/40 rounded-xl text-center space-y-3">
                    <div className="p-3 bg-amber-100 rounded-full text-amber-800">
                      <Folder className="h-8 w-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <div className="font-bold text-sm text-neutral-900">
                        Selecione a Pasta de Fotos no seu Computador
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        O navegador lê apenas os nomes dos arquivos, cruza com os códigos dos produtos da campanha e carrega somente as fotos necessárias. Não precisa copiar arquivos, criar ZIP nem subir a pasta inteira.
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

                {/* Se a pasta já foi escolhida */}
                {localFolderName && (
                  <div className="space-y-3">
                    {/* Linha de status da pasta com ações */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200">
                      <div className="flex items-center gap-2.5">
                        <FolderCheck className="h-5 w-5 text-amber-700 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
                            <span>Pasta: <strong>{localFolderName}</strong></span>
                            {typeof totalLocalImages === "number" && (
                              <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono text-[11px] font-bold text-amber-900">
                                {totalLocalImages} imagens lidas
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-600">
                            {indexedFiles.length} fotos indexadas disponíveis para cruzar com a campanha.
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
                          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isScanningFolder ? "animate-spin" : ""}`} />
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

                    {/* Progresso de escaneamento inicial (rápido, apenas nomes) */}
                    {isScanningFolder && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2 animate-pulse">
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                        <span>
                          Lendo pasta e subpastas... ({scanProgress?.scannedFiles || 0} arquivos verificados, {scanProgress?.imagesFound || 0} fotos encontradas)
                        </span>
                      </div>
                    )}

                    {/* Barra de progresso de carregamento de fotos da campanha com opção de cancelar */}
                    {isLoadingLocalPhotos && loadProgress && (
                      <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2.5">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Carregando fotos da campanha: {loadProgress.loaded} de {loadProgress.total} ({Math.round((loadProgress.loaded / Math.max(1, loadProgress.total)) * 100)}%)
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCancelLoad}
                            className="h-7 text-[11px] text-red-700 border-red-300 hover:bg-red-50 font-bold"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>

                        <div className="w-full bg-amber-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-amber-600 h-2.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.round(
                                (loadProgress.loaded / Math.max(1, loadProgress.total)) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        {loadProgress.currentFile && (
                          <div className="text-[11px] text-amber-800 font-mono truncate">
                            Arquivo atual: {loadProgress.currentFile}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resumo do cruzamento com a campanha */}
                    {localCrossingResult && !isScanningFolder && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="p-3 rounded-lg border border-green-200 bg-green-50/70 text-green-900">
                            <div className="text-lg font-black font-mono">
                              {localCrossingResult.matchedProductsCount}
                            </div>
                            <div className="text-xs font-semibold">
                              produtos com foto encontrada
                            </div>
                          </div>

                          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900">
                            <div className="text-lg font-black font-mono">
                              {localCrossingResult.missingProducts.length}
                            </div>
                            <div className="text-xs font-semibold">
                              produtos sem foto
                            </div>
                          </div>

                          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800">
                            <div className="text-lg font-black font-mono">
                              {localCrossingResult.unmatchedFilesCount}
                            </div>
                            <div className="text-xs font-semibold">
                              arquivos não usados na campanha
                            </div>
                          </div>
                        </div>

                        {/* Lista de produtos sem foto para revisão */}
                        {localCrossingResult.missingProducts.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setMissingPhotosExpanded(!missingPhotosExpanded)}
                              className="w-full flex items-center justify-between font-bold text-amber-950 text-left cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                                Produtos sem foto na campanha ({localCrossingResult.missingProducts.length}):
                              </span>
                              {missingPhotosExpanded ? (
                                <ChevronUp className="h-4 w-4 text-amber-800" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-amber-800" />
                              )}
                            </button>

                            {missingPhotosExpanded && (
                              <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
                                {localCrossingResult.missingProducts.map((p, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between p-1.5 bg-white rounded border border-amber-200 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono font-bold px-1 rounded bg-amber-100 text-amber-900 shrink-0">
                                        {p.code}
                                      </span>
                                      <span className="truncate uppercase font-medium text-neutral-800">
                                        {p.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-amber-800 font-semibold shrink-0">
                                      sem foto
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensagem de Erro de Acesso / Permissão */}
                    {folderAccessError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-red-800">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                          Falha ao acessar a pasta do computador
                        </div>
                        <p className="leading-relaxed">{folderAccessError}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Dica para caminhos de rede UNC */}
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

        {/* MODO 2: GERAR BUSCA PARA O WINDOWS EXPLORER (AQS) */}
        {photoBankSource === "windows_search" && (
          <div className="space-y-5 bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
            {/* Cabeçalho do Recurso */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm text-neutral-900">
                  <Terminal className="h-4 w-4 text-purple-600" />
                  Gerador de Busca para o Windows Explorer (AQS)
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                  Gere consultas de busca com os códigos dos produtos da campanha para colar na pesquisa do Windows Explorer. Você seleciona apenas as fotos encontradas, compacta em um ZIP leve e sobe no sistema, sem precisar ler nem subir a pasta inteira de 6.000 fotos.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPhotoBankSource("upload")}
                  className="text-xs font-bold border-neutral-300 text-neutral-700 min-h-[36px]"
                >
                  <Upload className="h-3.5 w-3.5 mr-1 text-red-600" />
                  Ir para Envio do ZIP
                </Button>
              </div>
            </div>

            {/* Verificação: Se não houver produtos carregados ainda */}
            {currentProductCodes.length === 0 ? (
              <div className="p-6 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-center space-y-3">
                <div className="p-3 bg-neutral-200 rounded-full w-12 h-12 mx-auto flex items-center justify-center text-neutral-600">
                  <Search className="h-6 w-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <div className="font-bold text-sm text-neutral-900">
                    Nenhum produto carregado na campanha ainda
                  </div>
                  <p className="text-xs text-neutral-500">
                    Faça o upload da planilha (.xlsx ou .csv) na etapa de origem acima para gerar automaticamente a consulta de busca com os códigos dos produtos.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onLoadSample}
                  className="text-xs font-bold text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
                  Carregar demonstração para testar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Painel de Controles: Extensão e Tamanho do Lote */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  {/* Seletor de Extensão */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-neutral-900">
                      Extensão das Fotos:
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSearchExtension("png")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] border ${
                          searchExtension === "png"
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                        }`}
                      >
                        .png
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchExtension("jpg")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] border ${
                          searchExtension === "jpg"
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                        }`}
                      >
                        .jpg
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchExtension("ambas")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] border ${
                          searchExtension === "ambas"
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                        }`}
                      >
                        ambas (.png e .jpg)
                      </button>
                    </div>
                  </div>

                  {/* Ajuste do Tamanho do Lote */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="batch-size" className="text-xs font-bold text-neutral-900">
                        Códigos por Lote (padrão 30):
                      </Label>
                      <span className="text-[11px] font-mono font-semibold text-neutral-500">
                        Total: {windowsSearchResult.totalCodes} códigos únicos · {windowsSearchResult.batches.length} lote(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="batch-size"
                        type="number"
                        min={5}
                        max={100}
                        value={searchBatchSize}
                        onChange={(e) => setSearchBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-xs min-h-[36px] w-28 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchBatchSize(20)}
                          className="h-8 text-xs font-semibold px-2"
                        >
                          20
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchBatchSize(30)}
                          className="h-8 text-xs font-semibold px-2"
                        >
                          30
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchBatchSize(50)}
                          className="h-8 text-xs font-semibold px-2"
                        >
                          50
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exemplo de Formato e Instruções */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Formato conferido */}
                  <div className="p-3.5 rounded-lg bg-neutral-900 text-neutral-200 space-y-1.5 font-mono text-[11px]">
                    <div className="text-neutral-400 font-sans text-xs font-bold flex items-center justify-between">
                      <span>Exemplo do formato gerado:</span>
                      <span className="text-purple-400 text-[10px] font-mono uppercase">AQS Windows</span>
                    </div>
                    <div className="text-emerald-400 break-all select-all py-1">
                      NOME:="14512.png" OR NOME:="221.png" OR NOME:="44.png"
                    </div>
                    <div className="text-neutral-400 text-[10.5px] font-sans">
                      Zeros à esquerda mantidos · Aspas internas removidas · Sem quebras de linha
                    </div>
                  </div>

                  {/* Instruções passo a passo em português */}
                  <div className="p-3.5 rounded-lg bg-purple-50/70 border border-purple-200 text-purple-950 space-y-1.5">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <span>Passo a passo no Windows Explorer:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11.5px] leading-relaxed text-neutral-800 pl-0.5">
                      <li>Abra a pasta de fotos no <strong>Explorador de Arquivos</strong>.</li>
                      <li>Cole a consulta na <strong>caixa de pesquisa</strong> e pressione <strong>Enter</strong>.</li>
                      <li>Selecione todos os resultados com <strong>Ctrl+A</strong>.</li>
                      <li>Clique com o botão direito e escolha <strong>Enviar para &gt; Pasta compactada</strong>.</li>
                      <li>Envie o ZIP na aba <strong>Computador / .ZIP</strong>.</li>
                    </ol>
                  </div>
                </div>

                {/* Alerta de Limite Seguro (>50 códigos ou >2000 chars) */}
                {windowsSearchResult.hasSafeLimitWarning && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      Aviso de tamanho da consulta
                    </div>
                    <p className="leading-relaxed text-[11.5px]">
                      Um ou mais lotes excedem o tamanho seguro recomendado (mais de 50 códigos ou mais de 2.000 caracteres). O Windows Explorer pode truncar consultas muito extensas. Recomendamos manter o lote em 30 códigos.
                    </p>
                  </div>
                )}

                {/* Lista de Lotes para Cópia */}
                <div className="space-y-3 pt-1">
                  <div className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                    <span>Lotes de Consulta para Pesquisa ({windowsSearchResult.batches.length}):</span>
                    <span className="text-[11px] font-normal text-neutral-500">
                      Copie cada lote e pesquise na pasta do computador
                    </span>
                  </div>

                  {windowsSearchResult.batches.map((batch) => {
                    const isCopied = copiedBatchIndex === batch.batchIndex;
                    return (
                      <div
                        key={batch.batchIndex}
                        className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-neutral-900">
                              Lote {batch.batchIndex} de {batch.totalBatches} · {batch.codesCount} códigos
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500">
                              ({batch.charCount} caracteres)
                            </span>
                            {batch.isAboveSafeLimit && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Lote grande
                              </span>
                            )}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleCopyBatchQuery(batch.batchIndex, batch.query)}
                            className={`min-h-[36px] text-xs font-bold transition-all shadow-xs ${
                              isCopied
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copiar consulta
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Texto da Consulta em Caixa de Leitura */}
                        <div className="relative">
                          <textarea
                            readOnly
                            rows={3}
                            value={batch.query}
                            className="w-full font-mono text-xs p-3 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 select-all leading-relaxed"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          />
                        </div>

                        {/* Campo de anotação de contagem de arquivos encontrados */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-neutral-100 text-xs">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`batch-count-${batch.batchIndex}`}
                              className="text-xs font-semibold text-neutral-700 shrink-0"
                            >
                              Quantos arquivos apareceram?
                            </Label>
                            <Input
                              id={`batch-count-${batch.batchIndex}`}
                              type="number"
                              min={0}
                              placeholder="Ex: 30"
                              value={batchExpectedCounts[batch.batchIndex] ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setBatchExpectedCounts((prev) => ({
                                  ...prev,
                                  [batch.batchIndex]: isNaN(val) ? 0 : val,
                                }));
                              }}
                              className="w-24 h-8 text-xs font-mono"
                            />
                          </div>
                          <span className="text-[11px] text-neutral-500">
                            Preencha para conferir se todos os arquivos foram incluídos no ZIP.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botão de Finalização / Redirecionamento para o ZIP */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50/70">
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5 text-purple-700 shrink-0" />
                    <div className="text-xs">
                      <div className="font-bold text-neutral-900">
                        Após pesquisar e criar a pasta compactada (.zip):
                      </div>
                      <div className="text-neutral-600">
                        Avance para a aba de upload para enviar o ZIP e associar as fotos aos produtos.
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setPhotoBankSource("upload")}
                    className="min-h-[40px] px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0 shadow-xs"
                  >
                    Enviar ZIP na aba Computador / .ZIP
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO 3: UPLOAD LOCAL / DRAG & DROP / ZIP */}
        {photoBankSource === "upload" && (
          <div className="space-y-4">
            {/* Banner de atalho para gerar consulta de busca para o Windows */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 text-xs">
              <div className="flex items-center gap-2.5">
                <Search className="h-5 w-5 text-purple-600 shrink-0" />
                <div>
                  <div className="font-bold text-neutral-900">
                    Sua pasta no Windows tem muitas fotos (ex: 6.000 arquivos)?
                  </div>
                  <p className="text-neutral-600 text-[11.5px]">
                    Gere uma consulta de pesquisa automática pelos códigos da campanha, copie e filtre no Windows Explorer para criar um .ZIP leve apenas com as fotos necessárias.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPhotoBankSource("windows_search")}
                className="text-xs font-bold border-purple-300 text-purple-900 hover:bg-purple-100 shrink-0 min-h-[36px]"
              >
                <Search className="h-3.5 w-3.5 mr-1 text-purple-600" />
                Gerar busca para o Windows
              </Button>
            </div>

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

            {/* Aviso de Discrepância entre os lotes anotados e o total do ZIP */}
            {zipDiscrepancyWarning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  Aviso de Discrepância no ZIP
                </div>
                <p className="leading-relaxed">{zipDiscrepancyWarning}</p>
              </div>
            )}

            {/* Resumo da Conferência do ZIP / Upload */}
            {zipCrossingSummary && (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
                <div className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                  <span>Conferência dos arquivos recebidos:</span>
                  {loadedPhotos.length > 0 && (
                    <span className="font-mono text-[11px] text-neutral-500">
                      Total no ZIP/Upload: {loadedPhotos.length} fotos
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50/70 text-green-900">
                    <div className="text-lg font-black font-mono">
                      {zipCrossingSummary.matchedCount}
                    </div>
                    <div className="text-xs font-semibold">
                      produtos com foto encontrada
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900">
                    <div className="text-lg font-black font-mono">
                      {zipCrossingSummary.missingProducts.length}
                    </div>
                    <div className="text-xs font-semibold">
                      produtos sem foto
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800">
                    <div className="text-lg font-black font-mono">
                      {zipCrossingSummary.unmatchedFiles.length}
                    </div>
                    <div className="text-xs font-semibold">
                      arquivos não usados na campanha
                    </div>
                  </div>
                </div>

                {/* Lista de produtos sem foto para revisão */}
                {zipCrossingSummary.missingProducts.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMissingZipPhotosExpanded(!missingZipPhotosExpanded)}
                      className="w-full flex items-center justify-between font-bold text-amber-950 text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        Produtos da campanha sem foto ({zipCrossingSummary.missingProducts.length}):
                      </span>
                      {missingZipPhotosExpanded ? (
                        <ChevronUp className="h-4 w-4 text-amber-800" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-amber-800" />
                      )}
                    </button>

                    {missingZipPhotosExpanded && (
                      <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
                        {zipCrossingSummary.missingProducts.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-1.5 bg-white rounded border border-amber-200 text-[11px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold px-1 rounded bg-amber-100 text-amber-900 shrink-0">
                                {p.code}
                              </span>
                              <span className="truncate uppercase font-medium text-neutral-800">
                                {p.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-800 font-semibold shrink-0">
                              sem foto
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
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
