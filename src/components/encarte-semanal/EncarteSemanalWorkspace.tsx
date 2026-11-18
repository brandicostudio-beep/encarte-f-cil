import React, { useState, useEffect, useRef, useMemo } from "react";
import type {
  EncarteSemanalProduct,
  EncarteSemanalGridConfig,
  EncarteSemanalConfig,
} from "@/types/encarte-semanal";
import {
  DEFAULT_ENCARTE_SEMANAL_CONFIG,
  DEFAULT_ENCARTE_SEMANAL_GRID,
} from "@/types/encarte-semanal";
import {
  loadEncarteSemanalTemplate,
  saveEncarteSemanalTemplate,
  loadEncarteSemanalGridConfig,
  saveEncarteSemanalGridConfig,
  loadEncarteSemanalFooterText,
  saveEncarteSemanalFooterText,
  loadEncarteSemanalProducts,
  saveEncarteSemanalProducts,
} from "@/lib/encarte-semanal-storage";
import {
  calculateEncarteSemanalGridCells,
  paginateEncarteSemanalProducts,
} from "@/lib/encarte-semanal-layout";
import {
  exportEncarteSemanalPageAsPng,
  exportAllEncarteSemanalPagesAsZip,
} from "@/lib/encarte-semanal-export";
import {
  saveEncarteSemanalToComputer,
  openEncarteSemanalFromComputer,
  readEncarteSemanalFromFile,
  type EncarteSemanalProjectFile,
} from "@/lib/encarte-semanal-file-manager";
import { EncarteSemanalCell } from "./EncarteSemanalCell";
import { EncarteSemanalProductModal } from "./EncarteSemanalProductModal";
import { EncarteSemanalGridConfigModal } from "./EncarteSemanalGridConfigModal";
import { EncarteSemanalSourceModal } from "./EncarteSemanalSourceModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileSpreadsheet,
  Download,
  Sliders,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  HelpCircle,
  Calendar,
  Save,
  FolderOpen,
  HardDrive,
} from "lucide-react";

export const EncarteSemanalWorkspace: React.FC = () => {
  // Configurações persistidas
  const [templateImage, setTemplateImage] = useState<string>(() => loadEncarteSemanalTemplate());
  const [gridConfig, setGridConfig] = useState<EncarteSemanalGridConfig>(() =>
    loadEncarteSemanalGridConfig()
  );
  const [footerText, setFooterText] = useState<string>(() => loadEncarteSemanalFooterText());
  const [products, setProducts] = useState<EncarteSemanalProduct[]>(() =>
    loadEncarteSemanalProducts()
  );

  // Estados de navegação e visualização
  const [activeTab, setActiveTab] = useState<"preview" | "tabela" | "pendencias">("preview");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [previewZoom, setPreviewZoom] = useState<number>(0.38); // 38% para caber em telas 1080p
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Modais
  const [sourceModalOpen, setSourceModalOpen] = useState<boolean>(false);
  const [gridModalOpen, setGridModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<EncarteSemanalProduct | null>(null);
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);

  // Estados de Salvamento na Pasta do Computador (File System Access)
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const openProjectFileInputRef = useRef<HTMLInputElement>(null);

  // Aplica os dados de um projeto carregado do computador
  const applyLoadedProject = (project: EncarteSemanalProjectFile, handle?: any) => {
    if (project.products && Array.isArray(project.products)) {
      setProducts(project.products);
      saveEncarteSemanalProducts(project.products);
    }
    if (project.templateImage) {
      setTemplateImage(project.templateImage);
      saveEncarteSemanalTemplate(project.templateImage);
    }
    if (project.gridConfig) {
      setGridConfig(project.gridConfig);
      saveEncarteSemanalGridConfig(project.gridConfig);
    }
    if (typeof project.footerText === "string") {
      setFooterText(project.footerText);
      saveEncarteSemanalFooterText(project.footerText);
    }
    if (handle) {
      setFileHandle(handle);
      setCurrentFileName(handle.name || project.name);
    } else {
      setCurrentFileName(project.name);
    }
    setCurrentPage(1);
    setActiveTab("preview");
    setExportMessage(`✓ Encarte aberto da pasta do computador: ${handle?.name || project.name}`);
    setTimeout(() => setExportMessage(null), 4000);
  };

  // Salvar na pasta do computador (grava diretamente no mesmo arquivo se já tiver handle)
  const handleSaveToComputer = async (forceSaveAs = false) => {
    if (products.length === 0) {
      alert("Nenhum produto para salvar. Carregue produtos ou adicione dados antes de salvar.");
      return;
    }

    setIsSavingFile(true);
    try {
      const result = await saveEncarteSemanalToComputer(products, {
        name: currentFileName || "Encarte Semanal - Ofertas da Semana",
        templateImage,
        footerText,
        gridConfig,
        existingFileHandle: forceSaveAs ? null : fileHandle,
        suggestedFilename: currentFileName || undefined,
      });

      if (result.ok) {
        if (result.fileHandle) {
          setFileHandle(result.fileHandle);
        }
        if (result.filename) {
          setCurrentFileName(result.filename);
        }
        setExportMessage(`✓ Encarte salvo com sucesso na pasta do computador (${result.filename})`);
        setTimeout(() => setExportMessage(null), 4000);
      } else if (result.error && !result.error.includes("cancelado")) {
        alert(result.error);
      }
    } catch (err: any) {
      alert(`Erro ao salvar no computador: ${err?.message || err}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  // Abrir encarte salvo previamente na pasta do computador
  const handleOpenFromComputer = async () => {
    const isIframe = typeof window !== "undefined" && window.self !== window.top;
    if (isIframe) {
      openProjectFileInputRef.current?.click();
      return;
    }

    try {
      const result = await openEncarteSemanalFromComputer();
      if (result.ok && result.project) {
        applyLoadedProject(result.project, result.fileHandle);
      } else if (!result.ok) {
        if (
          result.error &&
          (result.error.includes("não suporta") ||
            result.error.includes("sub frame") ||
            result.error.includes("Cross origin"))
        ) {
          openProjectFileInputRef.current?.click();
        } else if (result.error && !result.error.includes("cancelad")) {
          alert(result.error);
        }
      }
    } catch {
      openProjectFileInputRef.current?.click();
    }
  };

  // Fallback de abertura via input tradicional
  const handleFallbackFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await readEncarteSemanalFromFile(file);
    if (result.ok && result.project) {
      applyLoadedProject(result.project);
    } else {
      alert(result.error || "Não foi possível carregar o arquivo.");
    }
    // Limpa valor para permitir reabertura do mesmo arquivo
    e.target.value = "";
  };

  // Salvar alterações de produtos no localStorage
  useEffect(() => {
    saveEncarteSemanalProducts(products);
  }, [products]);

  // Salvar alterações do texto do rodapé
  const handleFooterTextChange = (text: string) => {
    setFooterText(text);
    saveEncarteSemanalFooterText(text);
  };

  // Trocar modelo de fundo (NÃO apaga a planilha/produtos carregados!)
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setTemplateImage(dataUrl);
      saveEncarteSemanalTemplate(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleResetTemplate = () => {
    const defaultTemplate = DEFAULT_ENCARTE_SEMANAL_CONFIG.templateImage;
    setTemplateImage(defaultTemplate);
    saveEncarteSemanalTemplate(defaultTemplate);
  };

  // Layout e paginação:
  // Separa produtos válidos (com foto) das pendências (sem foto)
  const pagination = useMemo(() => {
    return paginateEncarteSemanalProducts(products, gridConfig.itemsPerPage || 20);
  }, [products, gridConfig.itemsPerPage]);

  const { pages, pendingProducts, totalPages } = pagination;
  const currentProducts = pages[currentPage - 1] || [];

  // Coordenadas calculadas das células da grade
  const gridCells = useMemo(() => {
    return calculateEncarteSemanalGridCells(gridConfig);
  }, [gridConfig]);

  // Edição de um produto
  const handleEditProduct = (product: EncarteSemanalProduct) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  const handleSaveProduct = (updated: EncarteSemanalProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleMoveProduct = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= products.length) return;

    setProducts((prev) => {
      const copy = [...prev];
      const item = copy[fromIndex];
      copy[fromIndex] = copy[toIndex];
      copy[toIndex] = item;
      return copy;
    });
  };

  // Carregar dados de exemplo caso esteja vazio
  const handleLoadSample = () => {
    const sampleProducts: EncarteSemanalProduct[] = [
      { id: "1", code: "19396", description: "AMEIXA EM CALDA LATA PREDILECTA" },
      { id: "2", code: "5522", description: "GOIABADA BLOCO PREDILECTA" },
      { id: "3", code: "25573", description: "MOLHO MADEIRA STAND UP PREDILECTA" },
      { id: "4", code: "10314", description: "AZEITONA 100G C/ CAROÇO VALE FÉRTIL" },
      { id: "5", code: "24657", description: "BEBIDA DE AMENDOAS ALMOND BREEZE" },
      { id: "6", code: "2664", description: "COCO RALADO ADOÇADO MENINA 50G", limit: "1000CX" },
      { id: "7", code: "3182", description: "REFRESCO TORNADO" },
      { id: "8", code: "25710", description: "MAIONESE CASEIRA PET LIZA" },
      { id: "9", code: "3246", description: "PÊSSEGO EM CALDA GB" },
      { id: "10", code: "19124", description: "BATATA PALHA EXTRA FINA YOKI" },
      { id: "11", code: "21061", description: "MOLHO TOMATE TRAD. SACHÊ POMAROLA" },
      { id: "12", code: "400", description: "FERMENTO EM PÓ LEVE 12 E PAGUE 11 ROYAL" },
      { id: "13", code: "5279", description: "AÇÚCAR CONFEITEIRO GLAÇÚCAR" },
      { id: "14", code: "2201", description: "BEBIDA LÁCTEA 15GR PROFORCE ZERO LACTOSE" },
      { id: "15", code: "1165", description: "CUSCUZ, AMIDO DE MILHO E ÓLEO SINHÁ" },
      { id: "16", code: "13678", description: "LEITE DE COCO TP DUCOCO 1L" },
      { id: "17", code: "4201", description: "BEBIDA LÁCTEA IBITURUNA" },
      { id: "18", code: "5794", description: "LASANHA DIRETO AO FORNO PETYBON" },
      { id: "19", code: "14352", description: "LASANHA DIRETO AO FORNO E FERMENTO DONA BENTA" },
      { id: "20", code: "8501", description: "SUCO TP NECTAR 200ML E REFRESCO MARATÁ" },
    ];
    setProducts(sampleProducts);
  };

  // Exportação PNG da página atual
  const handleExportCurrentPng = async () => {
    if (currentProducts.length === 0) {
      alert("Nenhum produto com foto nesta página para exportar.");
      return;
    }

    setIsExporting(true);
    setExportMessage("Gerando PNG em alta resolução (1080x1920)...");
    try {
      const config: EncarteSemanalConfig = {
        name: "Encarte Semanal - Ofertas da Semana",
        templateImage,
        footerText,
        gridConfig,
        exportScale: 1,
      };

      await exportEncarteSemanalPageAsPng(currentProducts, config, currentPage);
      setExportMessage("✓ Imagem PNG baixada com sucesso!");
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err: any) {
      alert(`Erro ao exportar PNG: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportação ZIP de todas as páginas
  const handleExportAllZip = async () => {
    if (pages.length === 0) {
      alert("Nenhum produto válido para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const config: EncarteSemanalConfig = {
        name: "Encarte Semanal - Ofertas da Semana",
        templateImage,
        footerText,
        gridConfig,
        exportScale: 1,
      };

      await exportAllEncarteSemanalPagesAsZip(
        pages,
        config,
        (current, total) => {
          setExportMessage(`Renderizando página ${current} de ${total}...`);
        }
      );
      setExportMessage("✓ Arquivo ZIP baixado com sucesso!");
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err: any) {
      alert(`Erro ao gerar ZIP: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d0d] text-white">
      {/* 1. CABEÇALHO DO WORKSPACE */}
      <header className="border-b border-neutral-800 bg-[#141414] px-4 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Título e Subtítulo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-neutral-950 font-black text-xl shadow-md">
              ES
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white uppercase flex items-center gap-2">
                Encarte Semanal
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Ofertas da Semana
                </span>
              </h1>
              <p className="text-[11px] text-neutral-400">
                Modelo permanente (1080×1920) • 4 colunas × 5 linhas = 20 produtos por tela
              </p>
            </div>
          </div>

          {/* Botões de Ação Principais */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Input oculto para subir novo modelo de arte */}
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTemplateUpload}
            />

            {/* Input oculto para abrir projeto do computador */}
            <input
              ref={openProjectFileInputRef}
              type="file"
              accept=".json,.encarte"
              className="hidden"
              onChange={handleFallbackFileInputChange}
            />

            {/* ABRIR DO COMPUTADOR */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenFromComputer}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Abrir encarte salvo previamente na pasta do computador"
              data-testid="btn-open-from-pc"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              Abrir do PC
            </Button>

            {/* SALVAR NA PASTA DO COMPUTADOR */}
            <Button
              type="button"
              size="sm"
              onClick={() => handleSaveToComputer(false)}
              disabled={isSavingFile || products.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-md"
              title={
                currentFileName
                  ? `Salvar alterações diretamente no arquivo ${currentFileName}`
                  : "Salvar este encarte diretamente na pasta do computador"
              }
              data-testid="btn-save-to-pc"
            >
              {isSavingFile ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {currentFileName ? "Salvar no PC" : "Salvar no PC"}
            </Button>

            {/* SALVAR COMO (SE JÁ TIVER ARQUIVO ABERTO) */}
            {currentFileName && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSaveToComputer(true)}
                disabled={isSavingFile || products.length === 0}
                className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-xs h-9"
                title="Salvar com outro nome ou em outra pasta do computador"
              >
                Salvar Como...
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => setSourceModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs h-9 shadow-md"
              data-testid="btn-open-source-modal"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Carregar Planilha & Fotos
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setGridModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Ajustar coordenadas da grade, linhas e colunas"
            >
              <Sliders className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              Configurar Grade
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => bgFileInputRef.current?.click()}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Trocar modelo de arte do fundo (mantém a planilha e os produtos)"
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-purple-400" />
              Trocar Modelo
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResetTemplate}
              className="text-neutral-400 hover:text-white text-xs h-9"
              title="Restaura a arte original padrão"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Modelo Padrão
            </Button>

            {/* Exportar */}
            <div className="flex items-center gap-1 pl-1 border-l border-neutral-800">
              <Button
                type="button"
                size="sm"
                onClick={handleExportCurrentPng}
                disabled={isExporting || currentProducts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-md"
                data-testid="btn-export-png"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Exportar PNG (Tela {currentPage})
              </Button>

              {totalPages > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleExportAllZip}
                  disabled={isExporting}
                  className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 text-xs h-9"
                >
                  Exportar Todas (ZIP)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Notificação de Exportação */}
        {exportMessage && (
          <div className="max-w-7xl mx-auto mt-2 p-2 bg-neutral-900/90 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{exportMessage}</span>
          </div>
        )}
      </header>

      {/* 2. BARRA DE CAMPO EDITÁVEL DO RODAPÉ (DATA DA OFERTA) */}
      <div className="bg-[#181818] border-b border-neutral-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[320px]">
            <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
            <Label htmlFor="footerOffer" className="text-xs font-bold text-neutral-300 shrink-0">
              Datas da Oferta no Rodapé:
            </Label>
            <Input
              id="footerOffer"
              value={footerText}
              onChange={(e) => handleFooterTextChange(e.target.value)}
              placeholder="Ex: OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS."
              className="h-8 bg-neutral-900 border-neutral-700 text-amber-300 font-semibold text-xs uppercase"
              data-testid="input-semanal-footer"
            />
          </div>

          {/* Indicador de Arquivo Local Salvo no Computador */}
          {currentFileName && (
            <div
              className="flex items-center gap-1.5 bg-neutral-900/90 border border-emerald-500/40 px-3 py-1 rounded-lg text-xs shadow-xs"
              title="Este encarte está salvo na pasta do computador. Use 'Salvar no PC' para atualizar o arquivo existente."
              data-testid="local-file-indicator"
            >
              <HardDrive className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-neutral-400 text-[11px] shrink-0">Arquivo Local:</span>
              <span className="font-mono font-bold text-emerald-300 text-[11px] truncate max-w-[240px]">
                {currentFileName}
              </span>
            </div>
          )}

          {/* Abas: Visualizar Encarte / Lista de Produtos / Pendências */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-neutral-800 text-amber-300 shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Visualizar Encarte ({totalPages} tela{totalPages !== 1 ? "s" : ""})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tabela")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "tabela"
                  ? "bg-neutral-800 text-amber-300 shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Lista de Produtos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pendencias")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "pendencias"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Pendências / Sem Foto ({pendingProducts.length})
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {products.length === 0 ? (
          /* Estado Vazio */
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-12 text-center max-w-2xl mx-auto my-12 space-y-4 shadow-xl">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Nenhum produto carregado ainda</h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Carregue a planilha semanal com os códigos e descrições dos produtos em oferta. O modelo visual e a grade já estão configurados e prontos para uso.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setSourceModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Carregar Planilha & Fotos
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadSample}
                className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white"
              >
                <Sparkles className="h-4 w-4 mr-1.5 text-purple-400" />
                Carregar Exemplo (20 Itens)
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 3.1 ABA DE PRÉ-VISUALIZAÇÃO DO ENCARTE */}
            {activeTab === "preview" && (
              <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-md">
                {/* Controles de Navegação e Zoom */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl text-xs">
                  {/* Navegação entre páginas */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-8 bg-neutral-800 border-neutral-700 text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-bold text-white px-2">
                      Tela {currentPage} de {Math.max(1, totalPages)} (
                      {currentProducts.length} produtos)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 bg-neutral-800 border-neutral-700 text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Informação do Modelo Atual */}
                  <div className="text-[11px] text-neutral-400 hidden sm:block">
                    Grade: 4 colunas × 5 linhas • Barra: {gridConfig.barHeight}px • Resolução: 1080×1920
                  </div>

                  {/* Controles de Zoom */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.05))}
                      className="h-8 text-neutral-300 hover:text-white"
                      title="Reduzir zoom"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="font-mono text-neutral-400 w-12 text-center text-xs">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewZoom((z) => Math.min(1.0, z + 0.05))}
                      className="h-8 text-neutral-300 hover:text-white"
                      title="Aumentar zoom"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewZoom(0.38)}
                      className="h-8 bg-neutral-800 border-neutral-700 text-xs text-neutral-300 hover:text-white"
                    >
                      <Maximize2 className="h-3.5 w-3.5 mr-1" />
                      Encaixar na Tela
                    </Button>
                  </div>
                </div>

                {/* Área do Canvas 1080x1920 com Zoom */}
                <div className="flex justify-center overflow-auto p-4 bg-neutral-950/70 rounded-xl border border-neutral-800 min-h-[640px]">
                  <div
                    style={{
                      transform: `scale(${previewZoom})`,
                      transformOrigin: "top center",
                      marginBottom: `${1920 * (previewZoom - 1)}px`,
                      width: "1080px",
                      height: "1920px",
                    }}
                    className="relative shadow-2xl rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-[#0a0204]"
                  >
                    {/* Imagem de Fundo (Modelo da Arte) */}
                    <img
                      src={templateImage}
                      alt="Modelo Encarte Semanal"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    />

                    {/* MÁSCARA DE COBERTURA: Célula 1 (0, 0)
                        Cobre o texto "FOTO" da arte original para não vazar */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${gridCells[0]?.x || 29}px`,
                        top: `${gridCells[0]?.y || 475}px`,
                        width: `${gridCells[0]?.width || 257}px`,
                        height: `${gridCells[0]?.photoAreaHeight || 221}px`,
                        backgroundColor: "#330409",
                        zIndex: 1,
                      }}
                    />

                    {/* Células dos Produtos da Grade */}
                    {currentProducts.map((product, idx) => {
                      const cell = gridCells[idx];
                      if (!cell) return null;

                      return (
                        <div key={product.id || `${product.code}-${idx}`} style={{ zIndex: 10 }}>
                          <EncarteSemanalCell
                            product={product}
                            cell={cell}
                            interactive={true}
                            onEdit={handleEditProduct}
                          />
                        </div>
                      );
                    })}

                    {/* MÁSCARA DO RODAPÉ: Cobre o texto de guia ("TEXTO EDITÁVEL" e seta vermelha)
                        e renderiza as datas da oferta de forma limpa e nítida */}
                    <div
                      className="absolute bottom-0 left-0 right-0 pointer-events-none flex items-center justify-center px-8"
                      style={{
                        height: "65px",
                        backgroundColor: "#0a0204",
                        zIndex: 20,
                      }}
                    >
                      <div
                        className="text-center text-white font-black text-[12px] leading-tight tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] whitespace-pre-line uppercase"
                        data-testid="semanal-rendered-footer"
                      >
                        {footerText ||
                          "OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3.2 ABA DE TABELA DE PRODUTOS */}
            {activeTab === "tabela" && (
              <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Produtos Cadastrados ({products.length})
                  </h3>
                  <span className="text-xs text-neutral-400">
                    Clique em editar para ajustar fotos, códigos e descrições.
                  </span>
                </div>

                <div className="overflow-x-auto border border-neutral-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 text-neutral-300 font-bold border-b border-neutral-800">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">Ordem</th>
                        <th className="py-2.5 px-3 w-16">Foto</th>
                        <th className="py-2.5 px-3 w-28">Código</th>
                        <th className="py-2.5 px-3">Descrição do Produto</th>
                        <th className="py-2.5 px-3 w-32">Status da Foto</th>
                        <th className="py-2.5 px-3 w-24 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 bg-neutral-950/60">
                      {products.map((p, index) => (
                        <tr key={p.id} className="hover:bg-neutral-900/60 transition-colors">
                          {/* Botões de Ordem */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveProduct(index, "up")}
                                className="h-4 w-5 flex items-center justify-center rounded text-neutral-400 hover:text-white disabled:opacity-20"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === products.length - 1}
                                onClick={() => handleMoveProduct(index, "down")}
                                className="h-4 w-5 flex items-center justify-center rounded text-neutral-400 hover:text-white disabled:opacity-20"
                              >
                                ▼
                              </button>
                            </div>
                          </td>

                          {/* Foto */}
                          <td className="py-2 px-3">
                            <div className="h-10 w-10 rounded bg-[#330409] border border-neutral-800 flex items-center justify-center overflow-hidden">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.description}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <span className="text-[9px] text-amber-400 font-bold">Sem</span>
                              )}
                            </div>
                          </td>

                          {/* Código */}
                          <td className="py-2 px-3 font-mono font-bold text-amber-400">
                            {p.code}
                          </td>

                          {/* Descrição */}
                          <td className="py-2 px-3 font-semibold text-neutral-200 uppercase">
                            {p.description}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3">
                            {p.image ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Vinculada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Pendente
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditProduct(p)}
                                className="h-7 w-7 p-0 text-neutral-300 hover:text-amber-400"
                                title="Editar produto"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.3 ABA DE PENDÊNCIAS / SEM FOTO */}
            {activeTab === "pendencias" && (
              <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Produtos Sem Foto ({pendingProducts.length})
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Estes produtos não geram cards vazios no encarte exportado até que uma foto seja vinculada.
                    </p>
                  </div>
                </div>

                {pendingProducts.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-white">Nenhuma pendência encontrada!</p>
                    <p className="text-xs text-neutral-400">
                      Todos os produtos da planilha possuem foto e estão posicionados nas telas do encarte.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-neutral-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900 text-neutral-300 font-bold border-b border-neutral-800">
                        <tr>
                          <th className="py-2.5 px-3 w-28">Código</th>
                          <th className="py-2.5 px-3">Descrição</th>
                          <th className="py-2.5 px-3 w-36 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 bg-neutral-950/60">
                        {pendingProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-900/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                              {p.code}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-neutral-200 uppercase">
                              {p.description}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProduct(p)}
                                className="bg-neutral-800 border-neutral-700 text-amber-300 hover:bg-neutral-700 text-xs h-7"
                              >
                                <ImageIcon className="h-3.5 w-3.5 mr-1" />
                                Vincular Foto
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 4. MODAIS */}
      <EncarteSemanalSourceModal
        open={sourceModalOpen}
        onOpenChange={setSourceModalOpen}
        existingProducts={products}
        onApply={(newProducts) => {
          setProducts(newProducts);
          setCurrentPage(1);
          setActiveTab("preview");
        }}
      />

      <EncarteSemanalGridConfigModal
        open={gridModalOpen}
        onOpenChange={setGridModalOpen}
        gridConfig={gridConfig}
        onSave={(updated) => setGridConfig(updated)}
      />

      <EncarteSemanalProductModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
};
