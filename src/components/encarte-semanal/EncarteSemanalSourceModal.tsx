import React, { useState, useRef } from "react";
import type { EncarteSemanalProduct } from "@/types/encarte-semanal";
import type { EncarteProduct } from "@/types/encarte";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileSpreadsheet,
  FolderOpen,
  Upload,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { parseEncarteSemanalSpreadsheet } from "@/lib/encarte-semanal-parser";
import {
  matchPhotosWithSemanalProducts,
  findKnownPhotoForCode,
  autoResolvePhotosForSemanalProducts,
} from "@/lib/encarte-semanal-photos";
import { processPhotoBankUpload } from "@/lib/photo-bank";
import {
  isFileSystemAccessSupported,
  saveFolderHandle,
  indexLocalFolder,
  crossLocalFolderWithCampaign,
  loadCampaignPhotosFromFolder,
} from "@/lib/local-folder-service";

interface EncarteSemanalSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: EncarteSemanalProduct[];
  onApply: (products: EncarteSemanalProduct[]) => void;
}

export const EncarteSemanalSourceModal: React.FC<EncarteSemanalSourceModalProps> = ({
  open,
  onOpenChange,
  existingProducts,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<"planilha" | "fotos">("planilha");
  const [stagedProducts, setStagedProducts] = useState<EncarteSemanalProduct[]>(existingProducts);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [spreadsheetFileName, setSpreadsheetFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isMatchingPhotos, setIsMatchingPhotos] = useState(false);
  const [photoMatchMessage, setPhotoMatchMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Subir e processar planilha
  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setSpreadsheetFileName(file.name);
    try {
      const result = await parseEncarteSemanalSpreadsheet(file);
      setWarnings(result.warnings);

      // Puxa fotos automaticamente usando o mesmo sistema do acompanhamento de validade interno
      const { updatedProducts, resolvedCount } = autoResolvePhotosForSemanalProducts(result.products);
      setStagedProducts(updatedProducts);

      if (resolvedCount > 0) {
        setPhotoMatchMessage(
          `✓ ${resolvedCount} foto(s) puxadas automaticamente do Acompanhamento de Validade / Cescom CDN.`
        );
      } else {
        setPhotoMatchMessage(null);
      }

      // Avança para a aba de fotos se houver produtos
      if (updatedProducts.length > 0) {
        setActiveTab("fotos");
      }
    } catch (err: any) {
      setWarnings([`Erro ao ler arquivo: ${err?.message || "Formato inválido"}`]);
    } finally {
      setIsParsing(false);
    }
  };

  // Puxar fotos automaticamente do Acompanhamento de Validade / CDN / Drive
  const handleAutoPullPhotos = () => {
    setIsMatchingPhotos(true);
    try {
      const { updatedProducts, resolvedCount } = autoResolvePhotosForSemanalProducts(stagedProducts);
      setStagedProducts(updatedProducts);
      setPhotoMatchMessage(
        resolvedCount > 0
          ? `✓ ${resolvedCount} foto(s) puxadas com sucesso usando o sistema do Acompanhamento de Validade / Cescom CDN.`
          : "Nenhuma foto nova encontrada no acompanhamento para os produtos pendentes."
      );
    } catch (err: any) {
      setPhotoMatchMessage(`Erro ao puxar fotos: ${err?.message || err}`);
    } finally {
      setIsMatchingPhotos(false);
    }
  };

  // Carregar fotos de pasta local com fallback seguro para iframes / Lovable preview
  const handleSelectLocalFolder = async () => {
    const isIframe = typeof window !== "undefined" && window.self !== window.top;

    // Se estiver em iframe ou navegador sem suporte nativo a showDirectoryPicker, usa input nativo seguro
    if (isIframe || !isFileSystemAccessSupported()) {
      folderInputRef.current?.click();
      return;
    }

    try {
      setIsMatchingPhotos(true);
      const dirHandle = await (window as any).showDirectoryPicker();
      if (!dirHandle) return;

      await saveFolderHandle(dirHandle);
      const knownCodes = stagedProducts.map((p) => p.code);
      const indexResult = await indexLocalFolder(dirHandle, { knownCodes });

      if (indexResult.files.length === 0) {
        setPhotoMatchMessage("Nenhuma imagem (.png, .jpg) encontrada na pasta selecionada.");
        setIsMatchingPhotos(false);
        return;
      }

      const tempEncarteProducts: EncarteProduct[] = stagedProducts.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        image: p.image || "",
        currentPrice: 0,
        unit: "UN",
        included: true,
      }));

      const crossing = crossLocalFolderWithCampaign(indexResult, tempEncarteProducts);
      const { loadedPhotos } = await loadCampaignPhotosFromFolder(crossing, tempEncarteProducts);

      const matchResult = matchPhotosWithSemanalProducts(loadedPhotos, stagedProducts, "folder");
      setStagedProducts(matchResult.updatedProducts);
      setPhotoMatchMessage(
        `✓ ${matchResult.matchedCount} foto(s) associada(s) aos produtos a partir da pasta local.`
      );
    } catch (err: any) {
      // Se for bloqueio de cross-origin sub frame, usa imediatamente o seletor nativo sem erro
      if (
        err.name === "SecurityError" ||
        String(err).includes("sub frame") ||
        String(err).includes("Cross origin")
      ) {
        folderInputRef.current?.click();
      } else if (err.name !== "AbortError") {
        setPhotoMatchMessage(`Aviso ao acessar pasta: ${err?.message || err}`);
      }
    } finally {
      setIsMatchingPhotos(false);
    }
  };

  // Processa pasta selecionada via input webkitdirectory
  const handleFolderInputFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsMatchingPhotos(true);
    try {
      const loadedPhotos = await processPhotoBankUpload(files);
      if (loadedPhotos.length === 0) {
        setPhotoMatchMessage("Nenhuma foto válida (.png, .jpg, .webp) encontrada na pasta.");
        setIsMatchingPhotos(false);
        return;
      }

      const matchResult = matchPhotosWithSemanalProducts(loadedPhotos, stagedProducts, "folder");
      setStagedProducts(matchResult.updatedProducts);
      setPhotoMatchMessage(
        `✓ ${matchResult.matchedCount} foto(s) associada(s) aos produtos a partir da pasta selecionada.`
      );
    } catch (err: any) {
      setPhotoMatchMessage(`Erro ao processar pasta: ${err?.message || err}`);
    } finally {
      setIsMatchingPhotos(false);
      e.target.value = "";
    }
  };

  // Carregar fotos via upload de ZIP ou arquivos soltos
  const handlePhotoFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsMatchingPhotos(true);
    try {
      const loadedPhotos = await processPhotoBankUpload(files);
      if (loadedPhotos.length === 0) {
        setPhotoMatchMessage("Nenhuma foto válida encontrada no envio.");
        setIsMatchingPhotos(false);
        return;
      }

      const matchResult = matchPhotosWithSemanalProducts(loadedPhotos, stagedProducts, "upload");
      setStagedProducts(matchResult.updatedProducts);
      setPhotoMatchMessage(
        `✓ ${matchResult.matchedCount} foto(s) associada(s) aos produtos a partir do envio.`
      );
    } catch (err: any) {
      setPhotoMatchMessage(`Erro ao processar fotos: ${err?.message || err}`);
    } finally {
      setIsMatchingPhotos(false);
      e.target.value = "";
    }
  };

  // Sincronizar com cache de fotos conhecidas
  const handleSyncDriveCache = () => {
    setIsMatchingPhotos(true);
    try {
      let matchedCount = 0;
      const updated = stagedProducts.map((p) => {
        const photo = findKnownPhotoForCode(p.code);
        if (photo && !p.image) {
          matchedCount++;
          return { ...p, image: photo };
        }
        return p;
      });

      setStagedProducts(updated);
      setPhotoMatchMessage(
        matchedCount > 0
          ? `✓ ${matchedCount} nova(s) foto(s) associada(s) a partir do cache/Drive.`
          : "Nenhuma foto nova encontrada no cache."
      );
    } catch (err: any) {
      setPhotoMatchMessage(`Erro ao sincronizar: ${err?.message || err}`);
    } finally {
      setIsMatchingPhotos(false);
    }
  };

  const handleApply = () => {
    onApply(stagedProducts);
    onOpenChange(false);
  };

  const withPhotoCount = stagedProducts.filter((p) => Boolean(p.image)).length;
  const withoutPhotoCount = stagedProducts.length - withPhotoCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-neutral-900 border border-neutral-800 text-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-amber-400" />
            Carregar Planilha & Fotos do Encarte Semanal
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs">
            Suba uma planilha (.xlsx ou .csv) contendo os códigos e descrições dos produtos. As fotos são puxadas automaticamente com a mesma tecnologia do acompanhamento de validade.
          </DialogDescription>
        </DialogHeader>

        {/* Inputs ocultos para arquivos e pastas */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleSpreadsheetUpload}
        />
        <input
          ref={zipInputRef}
          type="file"
          multiple
          accept=".zip,image/*"
          className="hidden"
          onChange={handlePhotoFilesUpload}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFolderInputFiles}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="my-2">
          <TabsList className="bg-neutral-950 border border-neutral-800">
            <TabsTrigger
              value="planilha"
              className="text-xs data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-300"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              1. Planilha de Produtos ({stagedProducts.length})
            </TabsTrigger>
            <TabsTrigger
              value="fotos"
              className="text-xs data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-300"
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              2. Fotos ({withPhotoCount}/{stagedProducts.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: PLANILHA */}
          <TabsContent value="planilha" className="space-y-4 pt-3">
            <div className="border-2 border-dashed border-neutral-700 hover:border-amber-400/70 rounded-xl p-6 text-center bg-neutral-950/50 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-white mb-1">
                {spreadsheetFileName || "Clique para selecionar a planilha (.xlsx ou .csv)"}
              </p>
              <p className="text-xs text-neutral-400 max-w-md mx-auto mb-3">
                Identificamos automaticamente as colunas de <strong>código</strong> e <strong>descrição</strong>. As fotos são vinculadas automaticamente pelo sistema do acompanhamento de validade.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Processando Planilha & Puxando Fotos...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5 text-amber-300" />
                    Escolher Arquivo (.xlsx / .csv)
                  </>
                )}
              </Button>
            </div>

            {/* Avisos e Validações da Planilha */}
            {warnings.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-600/40 p-3 rounded-lg text-xs space-y-1">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Avisos identificados na planilha:
                </p>
                <ul className="list-disc list-inside text-amber-200/90 text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lista Prévia dos Produtos Importados */}
            {stagedProducts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-300">
                    Produtos Carregados ({stagedProducts.length})
                  </span>
                  <span className="text-neutral-500 text-[11px]">
                    {Math.ceil(stagedProducts.length / 20)} tela(s) estimada(s) de 20 produtos
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-neutral-800 rounded-lg bg-neutral-950 divide-y divide-neutral-900 text-xs">
                  {stagedProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-1.5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-mono text-amber-400 font-bold text-[11px] shrink-0">
                          {p.code}
                        </span>
                        <span className="truncate text-neutral-300 text-[11px]">
                          {p.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 shrink-0">
                        {p.image ? "✓ Com foto" : "⚠ Sem foto"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: FOTOS */}
          <TabsContent value="fotos" className="space-y-4 pt-3">
            {/* CARD PRINCIPAL: PUXAR FOTOS COMO NO ACOMPANHAMENTO DE VALIDADE */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 via-neutral-950 to-neutral-950 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400" />
                    Automático • Mesmo do Acompanhamento
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Puxar Fotos Automaticamente
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Busca instantaneamente as fotos no <strong>Acompanhamento de Validade</strong>, no histórico de encartes, no Google Drive e no catálogo CDN da Cescom.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAutoPullPhotos}
                disabled={isMatchingPhotos}
                className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs h-9 shrink-0 shadow-md"
              >
                {isMatchingPhotos ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Buscando Fotos...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Puxar Fotos do Acompanhamento
                  </>
                )}
              </Button>
            </div>

            {/* FONTES ADICIONAIS: PASTA LOCAL, ZIP E DRIVE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opção 1: Pasta do Computador (com fallback seguro contra erro de iframe) */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <FolderOpen className="h-6 w-6 text-amber-400" />
                  <p className="font-bold text-white text-xs">Pasta do Computador</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Selecione a pasta onde estão as fotos dos produtos (PNG transparente ou JPG).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSelectLocalFolder}
                  disabled={isMatchingPhotos}
                  className="mt-3 bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs w-full"
                >
                  <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-300" />
                  Selecionar Pasta
                </Button>
              </div>

              {/* Opção 2: Subir ZIP ou Fotos */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <Upload className="h-6 w-6 text-purple-400" />
                  <p className="font-bold text-white text-xs">Subir ZIP ou Fotos</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Envie um arquivo .zip com todas as imagens ou selecione várias fotos juntas.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => zipInputRef.current?.click()}
                  disabled={isMatchingPhotos}
                  className="mt-3 bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs w-full"
                >
                  <Upload className="h-3.5 w-3.5 mr-1 text-purple-300" />
                  Enviar ZIP / Fotos
                </Button>
              </div>

              {/* Opção 3: Google Drive */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <Cloud className="h-6 w-6 text-blue-400" />
                  <p className="font-bold text-white text-xs">Google Drive</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Utiliza o cache sincronizado das fotos salvas no navegador e Drive.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSyncDriveCache}
                  disabled={isMatchingPhotos}
                  className="mt-3 bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs w-full"
                >
                  <Cloud className="h-3.5 w-3.5 mr-1 text-blue-300" />
                  Sincronizar Cache
                </Button>
              </div>
            </div>

            {/* Mensagem de Feedback de Fotos */}
            {photoMatchMessage && (
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{photoMatchMessage}</span>
              </div>
            )}

            {/* Estatísticas de Casamento */}
            <div className="bg-neutral-950/70 border border-neutral-800 p-3 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Com Foto Vinculada</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {withPhotoCount} produtos
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Sem Foto (Pendências)</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">
                    {withoutPhotoCount} produtos
                  </span>
                </div>
              </div>

              <div className="text-right text-[11px] text-neutral-400 max-w-xs">
                Produtos sem foto não criam card vazio no encarte final e ficam na aba de pendências.
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 border-t border-neutral-800 pt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-neutral-400 hover:text-white"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleApply}
            disabled={stagedProducts.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Aplicar ao Encarte Semanal ({stagedProducts.length} itens)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
