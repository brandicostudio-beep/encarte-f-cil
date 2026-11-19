import React, { useState, useRef, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
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
  MousePointerClick,
  Trash2,
  Edit2,
  Star,
  X,
  Search,
} from "lucide-react";
import { parseEncarteSemanalSpreadsheet } from "@/lib/encarte-semanal-parser";
import { cleanPrincipalDescription } from "@/lib/encarte-semanal-catalog";
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

export interface EncarteSemanalSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: EncarteSemanalProduct[];
  onApply: (products: EncarteSemanalProduct[], mode?: "auto" | "manual") => void;
}

export interface EncarteSemanalSourceModalContentProps {
  onClose: () => void;
  existingProducts: EncarteSemanalProduct[];
  onApply: (products: EncarteSemanalProduct[], mode?: "auto" | "manual") => void;
}

export const EncarteSemanalSourceModalContent: React.FC<EncarteSemanalSourceModalContentProps> = ({
  onClose,
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    code: string;
    description: string;
    isPrincipal: boolean;
  }>({ code: "", description: "", isPrincipal: false });
  const [filterQuery, setFilterQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStagedProducts(existingProducts);
    setEditingId(null);
    setFilterQuery("");
  }, [existingProducts]);

  // Classificar / desmarcar como Principal
  const handleTogglePrincipal = (productId: string) => {
    setStagedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.isPrincipal) {
          // Desmarcar Principal: restaura código e descrição original
          return {
            ...p,
            isPrincipal: false,
            code: p.originalCode || "",
            description: p.originalDescription || p.description,
          };
        }
        // Marcar Principal: fica sem código e com descrição genérica sem fragrância/sabor/variação/embalagem
        return {
          ...p,
          isPrincipal: true,
          originalCode: p.originalCode || p.code,
          code: "",
          originalDescription: p.originalDescription || p.description,
          description: cleanPrincipalDescription(p.description),
        };
      })
    );
  };

  // Excluir / Remover da lista carregada
  const handleDeleteProduct = (productId: string) => {
    setStagedProducts((prev) => prev.filter((p) => p.id !== productId));
    if (editingId === productId) {
      setEditingId(null);
    }
  };

  // Iniciar edição
  const handleStartEdit = (p: EncarteSemanalProduct) => {
    setEditingId(p.id);
    setEditForm({
      code: p.code,
      description: p.description,
      isPrincipal: Boolean(p.isPrincipal),
    });
  };

  // Salvar edição
  const handleSaveEdit = (productId: string) => {
    setStagedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newCode = editForm.isPrincipal ? "" : editForm.code.trim();
        const newDesc = editForm.description.trim().toUpperCase();
        return {
          ...p,
          code: newCode,
          description: newDesc,
          isPrincipal: editForm.isPrincipal,
          image: p.image || (newCode ? findKnownPhotoForCode(newCode) : p.image),
        };
      })
    );
    setEditingId(null);
  };

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
    // Se estiver em iframe ou navegador sem suporte nativo/autorizado a showDirectoryPicker, usa seletor nativo seguro
    if (!isFileSystemAccessSupported()) {
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
      if (err.name !== "AbortError") {
        setPhotoMatchMessage(
          "Não foi possível abrir a pasta pelo seletor do sistema. Por favor, utilize a opção 'Subir ZIP ou Fotos' ao lado para carregar as fotos."
        );
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

  const handleApplyAuto = () => {
    onApply(stagedProducts, "auto");
    onClose();
  };

  const handleApplyManual = () => {
    onApply(stagedProducts, "manual");
    onClose();
  };

  const withPhotoCount = stagedProducts.filter((p) => Boolean(p.image)).length;
  const withoutPhotoCount = stagedProducts.length - withPhotoCount;

  return (
    <div className="space-y-4">
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

            {/* Lista Prévia dos Produtos Importados com Edição, Exclusão e Classificação Principal */}
            {stagedProducts.length > 0 && (() => {
              const q = filterQuery.trim().toLowerCase();
              const filteredList = q
                ? stagedProducts.filter(
                    (p) =>
                      (p.code && p.code.toLowerCase().includes(q)) ||
                      (p.description && p.description.toLowerCase().includes(q))
                  )
                : stagedProducts;
              const principaisCount = stagedProducts.filter((p) => p.isPrincipal).length;

              return (
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-200">
                        Produtos Carregados ({stagedProducts.length})
                      </span>
                      {principaisCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 flex items-center gap-1">
                          <Star className="h-2.5 w-2.5 fill-amber-300" />
                          {principaisCount} Principal(is)
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-400 text-[11px]">
                      {Math.ceil(stagedProducts.length / 20)} tela(s) estimada(s) de 20 produtos
                    </span>
                  </div>

                  {/* Barra de Busca rápida dentro dos produtos carregados */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-neutral-500 absolute left-2.5 top-2.5 pointer-events-none" />
                    <Input
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Filtrar por código ou descrição..."
                      className="h-8 pl-8 bg-neutral-950 border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-amber-400"
                    />
                    {filterQuery && (
                      <button
                        type="button"
                        onClick={() => setFilterQuery("")}
                        className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
                        title="Limpar busca"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Tabela dos Produtos Carregados com Ações */}
                  <div className="max-h-56 overflow-y-auto border border-neutral-800 rounded-lg bg-neutral-950 divide-y divide-neutral-900 text-xs">
                    {/* Cabeçalho */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-neutral-900/90 text-neutral-400 font-bold text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-neutral-800">
                      <div className="col-span-3">Codprod</div>
                      <div className="col-span-5">Produto / Descrição</div>
                      <div className="col-span-2">Foto</div>
                      <div className="col-span-2 text-right">Ações</div>
                    </div>

                    {filteredList.map((p) => {
                      const isEditing = editingId === p.id;

                      if (isEditing) {
                        return (
                          <div
                            key={p.id}
                            className="p-2.5 bg-neutral-900/90 border-l-2 border-amber-400 space-y-2"
                          >
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-4">
                                <label className="text-[10px] text-neutral-400 font-bold block mb-1">
                                  Código:
                                </label>
                                <Input
                                  value={editForm.code}
                                  disabled={editForm.isPrincipal}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, code: e.target.value }))
                                  }
                                  placeholder={editForm.isPrincipal ? "Sem cód (Principal)" : "Código"}
                                  className="h-7 text-xs bg-black border-neutral-700 font-mono text-amber-300 disabled:opacity-50"
                                />
                              </div>
                              <div className="col-span-8">
                                <label className="text-[10px] text-neutral-400 font-bold block mb-1">
                                  Descrição:
                                </label>
                                <Input
                                  value={editForm.description}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                                  }
                                  placeholder="Descrição do produto"
                                  className="h-7 text-xs bg-black border-neutral-700 text-neutral-100 uppercase"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 font-semibold cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={editForm.isPrincipal}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      isPrincipal: checked,
                                      code: checked ? "" : p.originalCode || prev.code,
                                      description: checked
                                        ? cleanPrincipalDescription(prev.description)
                                        : p.originalDescription || prev.description,
                                    }));
                                  }}
                                  className="rounded border-neutral-700 text-amber-500 focus:ring-amber-400 h-3.5 w-3.5"
                                />
                                <span className={editForm.isPrincipal ? "text-amber-300 font-bold" : ""}>
                                  ⭐ Classificar como Principal (sem código / sem variação)
                                </span>
                              </label>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSaveEdit(p.id)}
                                  className="h-6 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Salvar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                  className="h-6 px-2 text-[10px] text-neutral-400 hover:text-white"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={p.id}
                          className={`grid grid-cols-12 gap-2 px-3 py-1.5 items-center transition-colors ${
                            p.isPrincipal
                              ? "bg-amber-500/10 hover:bg-amber-500/15"
                              : "hover:bg-neutral-900/60"
                          }`}
                        >
                          {/* Codprod */}
                          <div className="col-span-3 flex items-center gap-1.5 overflow-hidden">
                            {p.isPrincipal ? (
                              <span
                                className="text-[9px] font-black text-amber-300 bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/40 shrink-0"
                                title="Produto Principal (Sem código na arte)"
                              >
                                ⭐ PRINCIPAL
                              </span>
                            ) : (
                              <span className="font-mono text-amber-400 font-bold text-[11px] truncate">
                                {p.code || "—"}
                              </span>
                            )}
                          </div>

                          {/* Produto / Descrição */}
                          <div className="col-span-5 min-w-0">
                            <span
                              className="truncate block text-neutral-200 text-[11px] uppercase font-medium"
                              title={p.description}
                            >
                              {p.description}
                            </span>
                          </div>

                          {/* Foto status */}
                          <div className="col-span-2 text-[10px] truncate">
                            {p.image ? (
                              <span className="text-emerald-400 font-medium">✓ Com foto</span>
                            ) : (
                              <span className="text-amber-400/90 font-medium">⚠ Sem foto</span>
                            )}
                          </div>

                          {/* Ações Rápidas: Principal / Editar / Excluir */}
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            {/* Botão Classificar como Principal */}
                            <button
                              type="button"
                              onClick={() => handleTogglePrincipal(p.id)}
                              className={`p-1 rounded transition-colors ${
                                p.isPrincipal
                                  ? "text-amber-400 bg-amber-500/20 hover:bg-amber-500/30"
                                  : "text-neutral-500 hover:text-amber-400 hover:bg-neutral-800"
                              }`}
                              title={
                                p.isPrincipal
                                  ? "Desmarcar Principal (restaurar código e variação)"
                                  : "Classificar como Principal (remover código e simplificar descrição)"
                              }
                              data-testid={`btn-toggle-principal-${p.id}`}
                            >
                              <Star className={`h-3.5 w-3.5 ${p.isPrincipal ? "fill-amber-400" : ""}`} />
                            </button>

                            {/* Botão Editar */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                              title="Editar código e descrição"
                              data-testid={`btn-edit-product-${p.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Botão Excluir / Remover */}
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                              title="Remover produto da lista"
                              data-testid={`btn-delete-product-${p.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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

        <DialogFooter className="mt-4 border-t border-neutral-800 pt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
          >
            Cancelar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyManual}
              disabled={stagedProducts.length === 0}
              className="bg-neutral-800 border-neutral-700 text-amber-300 hover:bg-neutral-700 hover:text-white text-xs font-bold"
              title="Guarda a planilha com todas as fotos e descrições na memória, deixando os 20 boxes da arte vazios para preenchimento manual"
            >
              <MousePointerClick className="h-4 w-4 mr-1.5" />
              Guardar e Preencher Manual (Boxes Vazios)
            </Button>

            <Button
              type="button"
              onClick={handleApplyAuto}
              disabled={stagedProducts.length === 0}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs"
              title="Preenche todos os 20 boxes da arte automaticamente em sequência"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Preencher Tudo Automático ({stagedProducts.length} itens)
            </Button>
          </div>
        </DialogFooter>
    </div>
  );
};

export const EncarteSemanalSourceModal: React.FC<EncarteSemanalSourceModalProps> = ({
  open,
  onOpenChange,
  existingProducts,
  onApply,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-neutral-900 border border-neutral-800 text-white p-6 shadow-2xl">
        <EncarteSemanalSourceModalContent
          onClose={() => onOpenChange(false)}
          existingProducts={existingProducts}
          onApply={onApply}
        />
      </DialogContent>
    </Dialog>
  );
};
