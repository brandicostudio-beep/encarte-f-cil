import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  loadStoredCatalog,
  saveStoredCatalog,
  loadFillMode,
  saveFillMode,
} from "@/lib/encarte-semanal-storage";
import {
  calculateEncarteSemanalGridCells,
  paginateEncarteSemanalProducts,
} from "@/lib/encarte-semanal-layout";
import { changeSemanalHistory, undoSemanalHistory, redoSemanalHistory } from "@/lib/encarte-semanal-editing";
import { cleanPrincipalDescription } from "@/lib/encarte-semanal-catalog";
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
import { EncarteSemanalInArtEditor } from "./EncarteSemanalInArtEditor";
import { NavigationDrawer } from "@/components/encarte/NavigationDrawer";
import { useNavigate } from "@tanstack/react-router";
import { clearClientSession } from "@/lib/auth-constants";
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
  Menu,
  LayoutGrid,
  CalendarClock,
  Layers,
  Star,
  MousePointerClick,
  Zap,
  Undo2,
  Redo2,
  CheckCheck,
  ArrowLeftRight,
  Tag,
} from "lucide-react";

export const EncarteSemanalWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [navDrawerOpen, setNavDrawerOpen] = useState<boolean>(false);

  // Configurações persistidas
  const [templateImage, setTemplateImage] = useState<string>(() => loadEncarteSemanalTemplate());
  const [gridConfig, setGridConfig] = useState<EncarteSemanalGridConfig>(() =>
    loadEncarteSemanalGridConfig()
  );
  const [footerText, setFooterText] = useState<string>(() => loadEncarteSemanalFooterText());
  const [products, setProducts] = useState<EncarteSemanalProduct[]>(() =>
    loadEncarteSemanalProducts()
  );
  const [storedCatalog, setStoredCatalog] = useState<EncarteSemanalProduct[]>(() => {
    const loaded = loadStoredCatalog();
    if (loaded.length > 0) return loaded;
    const initialProds = loadEncarteSemanalProducts();
    return initialProds.length > 0 ? initialProds : [];
  });
  const [fillMode, setFillMode] = useState<"auto" | "manual">(() => loadFillMode());

  // Alterna para o modo de preenchimento manual (deixa os 20 boxes da arte vazios, guardando a planilha em memória)
  const handleSwitchToManualMode = () => {
    if (products.length > 0 && storedCatalog.length === 0) {
      setStoredCatalog(products);
      saveStoredCatalog(products);
    }
    setFillMode("manual");
    saveFillMode("manual");
    setProducts([]);
    saveEncarteSemanalProducts([]);
    setSelectedSlotIndex(null);
    setExportMessage("✏️ Modo Manual ativado: tela limpa com boxes vazios. A planilha continua salva na memória! Clique em qualquer box para preencher.");
    setTimeout(() => setExportMessage(null), 5000);
  };

  // Alterna para o modo automático (preenche todos os 20 boxes da arte com os produtos da planilha)
  const handleSwitchToAutoMode = () => {
    setFillMode("auto");
    saveFillMode("auto");
    const catalogToUse = storedCatalog.length > 0 ? storedCatalog : products;
    if (catalogToUse.length > 0) {
      setProducts(catalogToUse);
      saveEncarteSemanalProducts(catalogToUse);
      setExportMessage(`⚡ Modo Automático ativado: todos os boxes foram preenchidos com os ${catalogToUse.length} produtos da planilha!`);
    } else {
      setExportMessage("Nenhuma planilha armazenada ainda. Carregue uma planilha para preencher automaticamente!");
    }
    setTimeout(() => setExportMessage(null), 4000);
  };

  // Estados de navegação e visualização
  const [activeTab, setActiveTab] = useState<"preview" | "tabela" | "pendencias">("preview");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [previewZoom, setPreviewZoom] = useState<number>(0.38); // 38% para caber em telas 1080p
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [isEditingFooter, setIsEditingFooter] = useState<boolean>(false);

  // Modais
  const [sourceModalOpen, setSourceModalOpen] = useState<boolean>(false);
  const [gridModalOpen, setGridModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<EncarteSemanalProduct | null>(null);
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [qualityModalOpen, setQualityModalOpen] = useState<boolean>(false);

  // Histórico de Desfazer / Refazer (Ctrl + Z / Ctrl + Y)
  const [history, setHistory] = useState<EncarteSemanalProduct[][]>(() => [loadEncarteSemanalProducts()]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isUndoRedoActionRef = useRef<boolean>(false);

  const pushHistoryState = (newProducts: EncarteSemanalProduct[]) => {
    if (isUndoRedoActionRef.current) return;
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      const next = [...sliced, newProducts];
      if (next.length > 25) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 24));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoRedoActionRef.current = true;
      const targetState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setProducts(targetState);
      saveEncarteSemanalProducts(targetState);
      setExportMessage("↶ Desfazer aplicado");
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
        setExportMessage(null);
      }, 1500);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoActionRef.current = true;
      const targetState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setProducts(targetState);
      saveEncarteSemanalProducts(targetState);
      setExportMessage("↷ Refazer aplicado");
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
        setExportMessage(null);
      }, 1500);
    }
  };

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

  // Obtém o produto atribuído ao box (slot 0 a 19) na tela atual
  const getProductAtSlot = (slotIdx: number): EncarteSemanalProduct | null => {
    const targetGlobalIndex = (currentPage - 1) * (gridConfig.itemsPerPage || 20) + slotIdx;

    // 1. Primeiro verifica por slotIndex explícito
    const byExplicitSlot = products.find((p) => p.slotIndex === targetGlobalIndex);
    if (byExplicitSlot) return byExplicitSlot;

    // 2. Depois por sequência nos produtos paginados da página
    if (currentProducts[slotIdx]) {
      return currentProducts[slotIdx];
    }

    // 3. Fallback: índice global no array de produtos
    return products[targetGlobalIndex] || null;
  };

  // Salva ou atualiza um produto digitado diretamente dentro da arte (Figma/Canva)
  const handleSaveSlotProduct = (slotIdx: number, updated: EncarteSemanalProduct) => {
    const targetGlobalIndex = (currentPage - 1) * (gridConfig.itemsPerPage || 20) + slotIdx;
    const productWithSlot: EncarteSemanalProduct = {
      ...updated,
      slotIndex: targetGlobalIndex,
      pageIndex: currentPage,
    };

    setProducts((prev) => {
      const copy = [...prev];
      const existingIdx = copy.findIndex(
        (p, i) =>
          (p.slotIndex !== undefined ? p.slotIndex === targetGlobalIndex : i === targetGlobalIndex) ||
          p.id === updated.id
      );

      if (existingIdx >= 0) {
        copy[existingIdx] = productWithSlot;
      } else {
        copy.push(productWithSlot);
      }

      saveEncarteSemanalProducts(copy);
      pushHistoryState(copy);
      return copy;
    });
  };

  // Limpa o produto do box selecionado (volta a ser slot vazio)
  const handleClearSlotProduct = (slotIdx: number) => {
    const targetGlobalIndex = (currentPage - 1) * (gridConfig.itemsPerPage || 20) + slotIdx;
    const currentProd = getProductAtSlot(slotIdx);

    setProducts((prev) => {
      const filtered = prev.filter((p) => {
        if (currentProd && p.id === currentProd.id) return false;
        if (p.slotIndex !== undefined && p.slotIndex === targetGlobalIndex) return false;
        return true;
      });
      saveEncarteSemanalProducts(filtered);
      pushHistoryState(filtered);
      return filtered;
    });

    setSelectedSlotIndex(null);
  };

  // Troca rápida de posição entre dois boxes (Swap)
  const handleSwapSlots = (fromSlotIdx: number, toSlotIdx: number) => {
    if (fromSlotIdx === toSlotIdx) return;
    const itemsPerPage = gridConfig.itemsPerPage || 20;
    const globalFrom = (currentPage - 1) * itemsPerPage + fromSlotIdx;
    const globalTo = (currentPage - 1) * itemsPerPage + toSlotIdx;

    const prodFrom = getProductAtSlot(fromSlotIdx);
    const prodTo = getProductAtSlot(toSlotIdx);

    if (!prodFrom && !prodTo) return;

    setProducts((prev) => {
      const copy = [...prev];
      const idxA = copy.findIndex((p, i) => (p.slotIndex !== undefined ? p.slotIndex === globalFrom : i === globalFrom));
      const idxB = copy.findIndex((p, i) => (p.slotIndex !== undefined ? p.slotIndex === globalTo : i === globalTo));

      if (idxA >= 0 && idxB >= 0) {
        const temp = copy[idxA];
        copy[idxA] = { ...copy[idxB], slotIndex: globalFrom };
        copy[idxB] = { ...temp, slotIndex: globalTo };
      } else if (idxA >= 0 && idxB < 0) {
        copy[idxA] = { ...copy[idxA], slotIndex: globalTo };
      } else if (idxA < 0 && idxB >= 0) {
        copy[idxB] = { ...copy[idxB], slotIndex: globalFrom };
      }

      saveEncarteSemanalProducts(copy);
      pushHistoryState(copy);
      return copy;
    });

    setExportMessage(`↔️ Box ${fromSlotIdx + 1} e Box ${toSlotIdx + 1} invertidos com sucesso!`);
    setTimeout(() => setExportMessage(null), 3000);
  };

  // Atalhos de Teclado Globais (Undo/Redo e Ajuste Fino de Posição com Setas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      // Atalhos de Undo / Redo (Ctrl + Z e Ctrl + Y / Ctrl + Shift + Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
      }

      // Ajuste fino por setas direcionais para o box selecionado
      if (selectedSlotIndex !== null && !isInput) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          const currentProd = getProductAtSlot(selectedSlotIndex);
          if (!currentProd) return;

          let newOffsetX = currentProd.offsetX || 0;
          let newOffsetY = currentProd.offsetY || 0;

          if (e.key === "ArrowLeft") newOffsetX -= step;
          if (e.key === "ArrowRight") newOffsetX += step;
          if (e.key === "ArrowUp") newOffsetY -= step;
          if (e.key === "ArrowDown") newOffsetY += step;

          handleSaveSlotProduct(selectedSlotIndex, {
            ...currentProd,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSlotIndex, historyIndex, history, products]);

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

  const handleTogglePrincipal = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.isPrincipal) {
          return {
            ...p,
            isPrincipal: false,
            code: p.originalCode || "",
            description: p.originalDescription || p.description,
          };
        }
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
    // Coleta produtos visíveis nesta página (mantendo exatamente os slots 0 a 19 e produtos principais)
    const slotProducts = gridCells.map((_, idx) => getProductAtSlot(idx));
    const hasAnyProduct = slotProducts.some((p) =>
      Boolean(p && (p.code?.trim() || p.description?.trim() || p.isPrincipal))
    );

    if (!hasAnyProduct) {
      alert("Nenhum produto cadastrado nesta página para exportar.");
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

      await exportEncarteSemanalPageAsPng(slotProducts, config, currentPage);
      setExportMessage("✓ Imagem PNG baixada com sucesso!");
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err: any) {
      alert(`Erro ao exportar PNG: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllSlots = () => {
    if (products.length === 0) return;
    const confirmClear = window.confirm(
      "Deseja limpar todos os produtos da grade para começar com boxes vazios?"
    );
    if (!confirmClear) return;
    setProducts([]);
    saveEncarteSemanalProducts([]);
    setSelectedSlotIndex(null);
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

  // Handlers de navegação com duplo fallback (TanStack Router + window.location)
  const handleBackToHome = () => {
    if (typeof window !== "undefined") {
      try {
        navigate({ to: "/" as never });
      } catch {
        window.location.href = "/";
      }
    }
  };

  const handleNavigateValidade = () => {
    if (typeof window !== "undefined") {
      try {
        navigate({ to: "/painel-validade" as never });
      } catch {
        window.location.href = "/painel-validade";
      }
    }
  };

  const handleNavigateColecoes = () => {
    if (typeof window !== "undefined") {
      try {
        navigate({ to: "/colecoes" as never });
      } catch {
        window.location.href = "/colecoes";
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d0d] text-white">
      {/* 1. BARRA SUPERIOR FIXA: NAVEGAÇÃO GLOBAL & SAÍDA DO SISTEMA */}
      <header className="border-b border-neutral-800 bg-[#121212] px-4 py-2.5 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Lado Esquerdo: BOTÃO VOLTAR DESTACADO & MENU GAVETA */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleBackToHome}
              className="bg-gradient-to-r from-[#5B0E1E] to-[#8C142B] hover:from-[#751227] hover:to-[#A31833] text-white font-bold text-xs h-9 px-3.5 border border-red-500/50 shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              title="Voltar para a tela inicial / Gerador de Encartes Principal"
              data-testid="btn-back-to-encartes"
            >
              <ChevronLeft className="h-4 w-4 text-red-200" />
              <span>← Voltar ao Menu Principal</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNavDrawerOpen(true)}
              className="h-9 px-3 bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs"
              title="Abrir Menu Completo do Sistema"
              data-testid="btn-semanal-menu-drawer"
            >
              <Menu className="h-4 w-4 mr-1.5" />
              <span>Menu</span>
            </Button>
          </div>

          {/* Centro: SELETOR DE MÓDULOS (Segmented Control Estilo Apple - Sempre Visível) */}
          <nav className="flex items-center bg-black/70 border border-neutral-800 p-0.5 rounded-xl shadow-inner text-xs">
            <button
              type="button"
              onClick={handleBackToHome}
              className="px-3 py-1.5 rounded-lg font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Ir para o Encarte de Validade"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-red-400" />
              <span>Validade</span>
            </button>

            <span
              className="px-3 py-1.5 rounded-lg font-black bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 shadow-md flex items-center gap-1.5 cursor-default"
              title="Você está no Encarte Semanal permanente"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
              <span>Semanal</span>
            </span>

            <button
              type="button"
              onClick={handleNavigateValidade}
              className="px-3 py-1.5 rounded-lg font-semibold text-neutral-400 hover:text-blue-300 hover:bg-neutral-800/60 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Ir para o Painel de Acompanhamento (Rotina 8230)"
            >
              <CalendarClock className="w-3.5 h-3.5 text-blue-400" />
              <span>Acompanhamento</span>
            </button>
          </nav>

          {/* Lado Direito: Logo Cescom Trimmed */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-lg">
              <img
                src="/logo-cescom-trimmed.png"
                alt="Cescom Distribuidor"
                className="h-4 w-auto object-contain"
              />
              <span className="text-[11px] font-bold text-neutral-300">
                Cescom
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. BARRA OPERACIONAL DO ENCARTE: AÇÕES E ARQUIVO */}
      <div className="bg-[#181818] border-b border-neutral-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Identidade do Encarte Semanal & Indicador de Arquivo */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-neutral-950 font-black text-xs shadow-md shrink-0">
              ES
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5 leading-tight">
                Encarte Semanal
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
                  Ofertas da Semana • 20 Boxes
                </span>
              </h2>
              {currentFileName ? (
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <HardDrive className="h-3 w-3" />
                  <span>Arquivo: {currentFileName}</span>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400">
                  Modelo permanente 1080×1920 • Clique em qualquer box para editar
                </p>
              )}
            </div>
          </div>

          {/* Botões Operacionais Agrupados */}
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

            {/* CARREGAR PLANILHA & FOTOS (DESTAQUE) */}
            <Button
              type="button"
              size="sm"
              onClick={() => setSourceModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs h-8 shadow-md"
              data-testid="btn-open-source-modal"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Carregar Planilha & Fotos
            </Button>

            {/* SELETOR DE MODO: AUTOMÁTICO VS MANUAL (BOXES VAZIOS) */}
            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg">
              <Button
                type="button"
                size="sm"
                variant={fillMode === "auto" ? "secondary" : "ghost"}
                onClick={handleSwitchToAutoMode}
                className={`text-xs h-7 px-2.5 font-bold transition-all ${
                  fillMode === "auto"
                    ? "bg-amber-500 text-neutral-950 shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Preenche todos os 20 boxes da arte automaticamente em sequência"
                data-testid="btn-mode-auto"
              >
                <Zap className="h-3 w-3 mr-1" />
                Preencher Automático
              </Button>

              <Button
                type="button"
                size="sm"
                variant={fillMode === "manual" ? "secondary" : "ghost"}
                onClick={handleSwitchToManualMode}
                className={`text-xs h-7 px-2.5 font-bold transition-all ${
                  fillMode === "manual"
                    ? "bg-amber-500 text-neutral-950 shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Deixa os 20 boxes vazios para preenchimento manual, mantendo a planilha e fotos salvas na memória"
                data-testid="btn-mode-manual"
              >
                <MousePointerClick className="h-3 w-3 mr-1" />
                Modo Manual (Box por Box)
              </Button>
            </div>

            {/* GRUPO DE ARQUIVO LOCAL */}
            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleOpenFromComputer}
                className="text-neutral-300 hover:text-white text-xs h-7 px-2.5"
                title="Abrir encarte salvo previamente na pasta do computador"
                data-testid="btn-open-from-pc"
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1 text-blue-400" />
                Abrir do PC
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleSaveToComputer(false)}
                disabled={isSavingFile || products.length === 0}
                className="text-emerald-400 hover:text-emerald-300 text-xs h-7 px-2.5 font-bold"
                title="Salvar alterações no computador"
                data-testid="btn-save-to-pc"
              >
                {isSavingFile ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar no PC
              </Button>
            </div>

            {/* GRUPO DE DESIGN */}
            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => bgFileInputRef.current?.click()}
                className="text-neutral-300 hover:text-white text-xs h-7 px-2.5"
                title="Trocar modelo de arte do fundo (mantém a planilha e os produtos)"
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1 text-purple-400" />
                Trocar Fundo
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setGridModalOpen(true)}
                className="text-neutral-300 hover:text-white text-xs h-7 px-2.5"
                title="Ajustar coordenadas da grade, linhas e colunas"
              >
                <Sliders className="h-3.5 w-3.5 mr-1 text-amber-400" />
                Grade
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetTemplate}
                className="text-neutral-400 hover:text-white text-xs h-7 px-2"
                title="Restaura a arte original padrão"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearAllSlots}
                disabled={products.length === 0}
                className="text-neutral-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 px-2"
                title="Limpar todos os boxes da tela para começar do zero"
                data-testid="btn-clear-all-slots"
              >
                <Trash2 className="h-3 w-3 mr-1 text-red-400/80" />
                Limpar Grade
              </Button>

              {/* Botões Desfazer / Refazer (Ctrl + Z / Ctrl + Y) */}
              <div className="flex items-center gap-0.5 border-l border-neutral-700/60 pl-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="text-neutral-300 hover:text-white disabled:opacity-30 text-xs h-7 px-1.5"
                  title="Desfazer (Ctrl + Z)"
                >
                  <Undo2 className="h-3 w-3 mr-0.5" />
                  <span className="hidden xl:inline text-[10px]">Desfazer</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="text-neutral-300 hover:text-white disabled:opacity-30 text-xs h-7 px-1.5"
                  title="Refazer (Ctrl + Y)"
                >
                  <Redo2 className="h-3 w-3 mr-0.5" />
                  <span className="hidden xl:inline text-[10px]">Refazer</span>
                </Button>
              </div>
            </div>

            {/* GRUPO DE EXPORTAÇÃO */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setQualityModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-amber-300 hover:text-white text-xs h-8 px-2.5"
              title="Abrir checklist de qualidade pré-impressão"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              Checklist
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleExportCurrentPng}
              disabled={isExporting || (currentProducts.length === 0 && products.length === 0)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shadow-md"
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
                className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 text-xs h-8"
              >
                ZIP ({totalPages} Telas)
              </Button>
            )}
          </div>
        </div>

        {/* Notificação de Exportação */}
        {exportMessage && (
          <div className="max-w-7xl mx-auto mt-2 p-2 bg-neutral-900/90 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{exportMessage}</span>
          </div>
        )}
      </div>

      {/* 3. BARRA DE ABAS & RODAPÉ EDITÁVEL DA OFERTA */}
      <div className="bg-[#121212] border-b border-neutral-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
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

          {/* Campo Editável do Rodapé (Data da Oferta) */}
          <div className="flex items-center gap-2 flex-1 max-w-lg min-w-[280px]">
            <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <Label htmlFor="footerOffer" className="text-xs font-bold text-neutral-300 shrink-0">
              Datas no Rodapé:
            </Label>
            <Input
              id="footerOffer"
              value={footerText}
              onChange={(e) => handleFooterTextChange(e.target.value)}
              placeholder="Ex: OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES."
              className="h-8 bg-neutral-900 border-neutral-700 text-amber-300 font-semibold text-xs uppercase"
              data-testid="input-semanal-footer"
            />
          </div>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* 3.1 ABA DE PRÉ-VISUALIZAÇÃO DO ENCARTE */}
        {activeTab === "preview" && (
          <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-md">
            {/* Banner Orientador caso não haja produtos carregados */}
            {products.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      Edição Direta na Arte (Estilo Canva/Figma) Habilitada
                      <span className="bg-amber-400 text-neutral-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                        Clique em qualquer box
                      </span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Clique em qualquer um dos 20 boxes abaixo na arte para digitar o código com predição de texto e puxar a foto automaticamente. Você também pode carregar uma planilha ou testar com o exemplo.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSourceModalOpen(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs h-8"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                    Carregar Planilha & Fotos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleLoadSample}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-xs h-8"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-400" />
                    Exemplo (20 Itens)
                  </Button>
                </div>
              </div>
            )}

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

              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" disabled={historyIndex <= 0} onClick={handleUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" disabled={historyIndex >= history.length - 1} onClick={handleRedo} title="Refazer (Ctrl+Y)" aria-label="Refazer"><Redo2 className="h-4 w-4" /></Button>
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

                {/* Células dos Produtos da Grade (20 boxes interativos estilo Canva/Figma) */}
                {gridCells.map((cell, idx) => {
                  const product = getProductAtSlot(idx);
                  const isSelected = selectedSlotIndex === idx;

                  return (
                    <div
                      key={product?.id || `slot-${currentPage}-${idx}`}
                      style={{ zIndex: isSelected ? 40 : 10 }}
                    >
                      <EncarteSemanalCell
                        product={product}
                        cell={cell}
                        interactive={true}
                        onTransform={updated => handleSaveSlotProduct(idx, updated)}
                        isSelected={isSelected}
                        previewZoom={previewZoom}
                        onUpdateProduct={(updated) => handleSaveSlotProduct(idx, updated)}
                        onClickSlot={() => {
                          setSelectedSlotIndex(selectedSlotIndex === idx ? null : idx);
                        }}
                        onEdit={() => {
                          setSelectedSlotIndex(idx);
                        }}
                      />

                      {/* Editor Flutuante Dentro da Arte (Estilo Canva/Figma com Predição de Texto) */}
                      {isSelected && (
                        <EncarteSemanalInArtEditor
                          cell={cell}
                          product={product}
                          cellIndex={idx}
                          allProducts={products}
                          onSwapSlots={(targetSlotIdx) => handleSwapSlots(idx, targetSlotIdx)}
                          onSaveProduct={(updated) => handleSaveSlotProduct(idx, updated)}
                          onClearProduct={() => handleClearSlotProduct(idx)}
                          onClose={() => setSelectedSlotIndex(null)}
                          onOpenAdvancedModal={(p) => {
                            setEditingProduct(p);
                            setProductModalOpen(true);
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* RODAPÉ EDITÁVEL NA ARTE: Cobre as guias ("TEXTO EDITÁVEL") e permite edição direta estilo Canva/Figma */}
                <div
                  className={`absolute bottom-0 left-0 right-0 flex items-center justify-center px-6 transition-all group ${
                    isEditingFooter
                      ? "ring-2 ring-amber-400 bg-black/95 z-40"
                      : "hover:ring-1 hover:ring-amber-400/80 cursor-pointer bg-[#0a0204] z-20"
                  }`}
                  style={{
                    height: "65px",
                  }}
                  onClick={() => setIsEditingFooter(true)}
                  title="Clique para editar as datas da oferta no rodapé"
                >
                  {isEditingFooter ? (
                    <div
                      className="w-full flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={footerText}
                        onChange={(e) => handleFooterTextChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            setIsEditingFooter(false);
                          }
                        }}
                        onBlur={() => setIsEditingFooter(false)}
                        placeholder="Ex: OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES."
                        className="w-full bg-neutral-900 border border-amber-400 rounded px-3 py-1.5 text-center text-white font-black text-[12px] uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-amber-300"
                        data-testid="input-semanal-footer-canvas"
                      />
                      <button
                        type="button"
                        onClick={() => setIsEditingFooter(false)}
                        className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-[10px] px-2.5 py-1 rounded shadow-sm shrink-0 uppercase cursor-pointer"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <div className="relative w-full flex items-center justify-center">
                      <div
                        className="text-center text-white font-black text-[12px] leading-tight tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] whitespace-pre-line uppercase select-none group-hover:text-amber-200 transition-colors"
                        data-testid="semanal-rendered-footer"
                      >
                        {footerText ||
                          "OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS."}
                      </div>
                      {/* Badge flutuante de edição em hover */}
                      <span className="absolute -top-7 bg-neutral-900 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1">
                        <Edit2 className="h-3 w-3" />
                        Clique para editar o rodapé
                      </span>
                    </div>
                  )}
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSourceModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs h-7"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  Importar Planilha
                </Button>
                <span className="text-xs text-neutral-400 hidden sm:inline">
                  Clique em editar para ajustar fotos, códigos e descrições.
                </span>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center bg-neutral-950/60 rounded-xl border border-neutral-800 space-y-3">
                <FileSpreadsheet className="h-10 w-10 text-neutral-500 mx-auto" />
                <p className="text-sm font-bold text-white">Nenhum produto cadastrado na lista</p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Carregue uma planilha semanal (.xlsx ou .csv) contendo as colunas de código e descrição para preencher a lista.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSourceModalOpen(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs"
                  >
                    Carregar Planilha & Fotos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleLoadSample}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-xs"
                  >
                    Carregar Exemplo (20 Itens)
                  </Button>
                </div>
              </div>
            ) : (
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
                        <td className="py-2 px-3">
                          {p.isPrincipal ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                ⭐ PRINCIPAL
                              </span>
                              <span className="block text-[9px] text-neutral-500">
                                (Sem código na arte)
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-amber-400">
                              {p.code || "—"}
                            </span>
                          )}
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
                              onClick={() => handleTogglePrincipal(p.id)}
                              className={`h-7 w-7 p-0 ${
                                p.isPrincipal
                                  ? "text-amber-400 hover:text-amber-300 bg-amber-500/20"
                                  : "text-neutral-400 hover:text-amber-400"
                              }`}
                              title={
                                p.isPrincipal
                                  ? "Desmarcar Principal (restaurar código e variação)"
                                  : "Classificar como Principal (remover código e simplificar descrição)"
                              }
                              data-testid={`btn-workspace-toggle-principal-${p.id}`}
                            >
                              <Star className={`h-3.5 w-3.5 ${p.isPrincipal ? "fill-amber-400" : ""}`} />
                            </Button>
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
            )}
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
                  Todos os produtos da planilha possuem foto ou a lista está vazia.
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
      </main>

      {/* 4. MODAIS */}
      <NavigationDrawer
        open={navDrawerOpen}
        onOpenChange={setNavDrawerOpen}
        onOpenHowItWorks={() => {}}
        onOpenStoreSettings={() => {}}
        onOpenStockTurnover={() => {}}
        onOpenResetModal={() => {}}
        onOpenWelcomeHub={() => navigate({ to: "/" as never })}
        onNavigateToValidade={() => navigate({ to: "/painel-validade" as never })}
        onNavigateToEncarteSemanal={() => setNavDrawerOpen(false)}
        onNavigateToColecoes={() => navigate({ to: "/colecoes" as never })}
        onLogout={() => {
          clearClientSession();
          navigate({ to: "/acesso" as never });
        }}
      />
      <EncarteSemanalSourceModal
        open={sourceModalOpen}
        onOpenChange={setSourceModalOpen}
        existingProducts={storedCatalog.length > 0 ? storedCatalog : products}
        onApply={(newProducts, mode = "auto") => {
          setStoredCatalog(newProducts);
          saveStoredCatalog(newProducts);
          saveFillMode(mode);
          setFillMode(mode);

          if (mode === "auto") {
            setProducts(newProducts);
            saveEncarteSemanalProducts(newProducts);
            setExportMessage(`⚡ ${newProducts.length} produto(s) aplicados automaticamente aos boxes do encarte!`);
          } else {
            setProducts([]);
            saveEncarteSemanalProducts([]);
            setExportMessage(`✏️ Planilha com ${newProducts.length} produto(s) e fotos armazenada com sucesso! Os 20 boxes da arte estão vazios para você preencher um por um.`);
          }
          setCurrentPage(1);
          setActiveTab("preview");
          setTimeout(() => setExportMessage(null), 5000);
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

      {/* Modal de Checagem de Qualidade Pré-Exportação */}
      {qualityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#181818] border border-neutral-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Checklist de Qualidade Pré-Impressão</h3>
                  <p className="text-[11px] text-neutral-400">Verificação automática da Página {currentPage} (Ofertas da Semana)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQualityModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Métricas da Página Atual */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 border border-neutral-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Preenchimento da Tela</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-amber-300">
                    {currentProducts.filter(Boolean).length}/20
                  </span>
                  <span className="text-[10px] text-neutral-400">boxes ocupados</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{
                      width: `${(currentProducts.filter(Boolean).length / 20) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-black/40 border border-neutral-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Fotos no Padrão</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-emerald-400">
                    {currentProducts.filter((p) => p && p.image).length}
                  </span>
                  <span className="text-[10px] text-neutral-400">com foto PNG ativa</span>
                </div>
                <div className="text-[10px] text-neutral-400">
                  {currentProducts.filter((p) => p && (p.secondaryImage || p.duplicatePhoto)).length} com 2 fotos/variação
                </div>
              </div>

              <div className="bg-black/40 border border-neutral-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Selos & Limites</span>
                <div className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
                  <span>Faixa de Limite:</span>
                  <span className="text-amber-400">{currentProducts.filter((p) => p?.limit).length} produtos</span>
                </div>
                <div className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
                  <span>Selos Promocionais:</span>
                  <span className="text-purple-400">{currentProducts.filter((p) => p?.badge).length} produtos</span>
                </div>
              </div>

              <div className="bg-black/40 border border-neutral-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Resolução de Saída</span>
                <div className="text-sm font-bold text-white">1080 × 1920 px</div>
                <div className="text-[10px] text-neutral-400">Padrão Instagram / WhatsApp 9:16</div>
              </div>
            </div>

            {/* Alertas e Recomendações */}
            <div className="space-y-1.5 text-xs">
              {currentProducts.filter(Boolean).length < 20 && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Atenção: Há {20 - currentProducts.filter(Boolean).length} box(es) vazio(s) na Tela {currentPage}. As guias vazias do modelo não serão cobertas.
                  </span>
                </div>
              )}
              {currentProducts.filter((p) => p && !p.image).length > 0 && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>
                    Aviso: {currentProducts.filter((p) => p && !p.image).length} produto(s) estão sem foto cadastrada.
                  </span>
                </div>
              )}
              {currentProducts.filter(Boolean).length === 20 && currentProducts.every((p) => p && p.image) && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Tudo pronto! Todos os 20 boxes estão preenchidos com foto e descrições perfeitamente alinhadas.
                  </span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQualityModalOpen(false)}
                className="bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white text-xs"
              >
                Voltar à Edição
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setQualityModalOpen(false);
                  handleExportCurrentPng();
                }}
                disabled={isExporting || (currentProducts.length === 0 && products.length === 0)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar PNG (Tela {currentPage})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
