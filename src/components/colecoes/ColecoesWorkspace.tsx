import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { ColecaoProduct, ColecaoConfig, ColecaoGridSettings, Rect, ColecaoElement } from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import {
  paginateColecaoProducts,
  paginate,
  categorizeAndGroupColecaoProducts,
  calculateGridCellPositions,
  getCellRects,
  zIndexFor,
} from "@/lib/colecoes-layout";
import { parseColecaoSpreadsheet } from "@/lib/colecoes-parser";
import { exportColecaoPageAsPng, exportColecaoAllPagesZip } from "@/lib/colecoes-export";
import { ColecoesPage, type CustomItemLayout } from "./ColecoesPage";
import { PrincipalVariantsModal } from "./PrincipalVariantsModal";
import { ColecaoProductEditModal } from "./ColecaoProductEditModal";
import {
  extractGenericBaseName,
  parseNormalizedWeight,
  parsePackagingType,
} from "@/lib/colecoes-similarity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Star,
  Download,
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  FolderSync,
  AlertTriangle,
  Eye,
  Edit2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lock,
  Unlock,
  EyeOff,
  Undo2,
  Redo2,
  Settings,
  Sliders,
  RotateCcw,
} from "lucide-react";
import { ColecoesSourceSelector } from "./ColecoesSourceSelector";

const STORAGE_KEY_PRODUCTS = "encarte-colecoes-products-v1";
const STORAGE_KEY_CONFIG = "encarte-colecoes-config-v1";
const STORAGE_KEY_LAYOUTS = "encarte-colecoes-layouts-v1";

export const ColecoesWorkspace: React.FC = () => {
  // Estado isolado dos dados de Coleções
  const [products, setProducts] = useState<ColecaoProduct[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return [];
  });

  const [config, setConfig] = useState<ColecaoConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_COLECAO_CONFIG;
  });

  // Layouts livres personalizados estilo Canva
  const [customLayouts, setCustomLayouts] = useState<Record<string, CustomItemLayout>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUTS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {};
  });

  // Histórico para Desfazer (Ctrl+Z) e Refazer (Ctrl+Y)
  const [history, setHistory] = useState<Record<string, CustomItemLayout>[]>([customLayouts]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"tabela" | "preview">("tabela");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(0.38); // 38% para encaixar 1080x1920 confortavelmente na tela
  const [isExporting, setIsExporting] = useState(false);

  // Modais
  const [variantsModalProduct, setVariantsModalProduct] = useState<ColecaoProduct | null>(null);
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [editProductModalItem, setEditProductModalItem] = useState<ColecaoProduct | null>(null);
  const [importSpreadsheetOpen, setImportSpreadsheetOpen] = useState(false);
  const [sourceSelectorModalOpen, setSourceSelectorModalOpen] = useState(false);
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [newProd, setNewProd] = useState({ code: "", description: "", image: "", isPrincipal: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Salvar no localStorage separadamente
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch {
      /* ignore */
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUTS, JSON.stringify(customLayouts));
    } catch {
      /* ignore */
    }
  }, [customLayouts]);

  // Push para histórico
  const pushHistory = useCallback(
    (newLayouts?: Record<string, CustomItemLayout>) => {
      const nextState = newLayouts || customLayouts;
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, nextState];
      });
      setHistoryIndex((idx) => idx + 1);
    },
    [customLayouts, historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setCustomLayouts(history[targetIndex]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setCustomLayouts(history[targetIndex]);
    }
  }, [historyIndex, history]);

  // Agrupamento por nome-base e separação de pendências sem foto
  const { displayProducts, pendingProducts } = useMemo(() => {
    return categorizeAndGroupColecaoProducts(products);
  }, [products]);

  // Paginação dinâmica respeitando itemsPerPage
  const itemsPerPageEffective = useMemo(() => {
    if (config.autoItemsPerPage !== false) {
      const cols = config.columnsCount || 4;
      const rows = config.rowsCount || 5;
      return cols * rows;
    }
    return config.itemsPerPage || 20;
  }, [config.autoItemsPerPage, config.columnsCount, config.rowsCount, config.itemsPerPage]);

  const pages = useMemo(() => {
    return paginateColecaoProducts(displayProducts, itemsPerPageEffective);
  }, [displayProducts, itemsPerPageEffective]);

  const totalPages = Math.max(1, pages.length);

  // Garantir que a página atual seja válida
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Células da grade para a página atual
  const cols = config.columnsCount || 4;
  const rows = config.rowsCount || 5;
  const gapX = config.gapX ?? config.cellSpacing ?? 0;
  const gapY = config.gapY ?? config.cellSpacing ?? 0;
  const frontSide = config.frontSide || (config.stackOrder === "left-in-front" ? "left" : "right");
  const showDividers = config.showDividers ?? (config.showDottedLines !== false);

  const gridSettings: ColecaoGridSettings = useMemo(
    () => ({
      columns: cols,
      rows,
      perPage: itemsPerPageEffective,
      gapX,
      gapY,
      productScale: config.productScale
        ? config.productScale > 10
          ? config.productScale / 100
          : config.productScale
        : 1.3,
      frontSide,
      showDividers,
      footerText: config.footerText || "",
    }),
    [cols, rows, itemsPerPageEffective, gapX, gapY, config.productScale, frontSide, showDividers, config.footerText]
  );

  const gridAreaRect = useMemo(
    () => ({
      x: config.gridArea.xStart,
      y: config.gridArea.yStart,
      width: config.gridArea.xEnd - config.gridArea.xStart,
      height: config.gridArea.yEnd - config.gridArea.yStart,
    }),
    [config.gridArea]
  );

  const gridRects = useMemo(() => {
    return getCellRects(gridSettings, gridAreaRect);
  }, [gridSettings, gridAreaRect]);

  const gridCells = useMemo(() => {
    return calculateGridCellPositions(config.gridArea, cols, rows, config.cellSpacing || 0);
  }, [config.gridArea, cols, rows, config.cellSpacing]);

  // Item selecionado atualmente
  const selectedProductItem = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  const currentSelectedCustom = selectedProductId ? customLayouts[selectedProductId] : null;

  // Toggle do flag "Principal" com busca de similares
  const handleTogglePrincipal = (prod: ColecaoProduct) => {
    if (!prod.isPrincipal) {
      setVariantsModalProduct(prod);
      setVariantsModalOpen(true);
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id
            ? { ...p, isPrincipal: false, variantIds: [], variants: [], genericDescription: undefined }
            : p
        )
      );
    }
  };

  const handleConfirmVariants = (
    targetProduct: ColecaoProduct,
    genericDescription: string,
    selectedVariants: ColecaoProduct[]
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === targetProduct.id) {
          return {
            ...p,
            isPrincipal: true,
            genericDescription,
            variantIds: selectedVariants.map((v) => v.id),
            variants: selectedVariants,
          };
        }
        return p;
      })
    );
  };

  // Reordenação na tabela (▲ mover para cima / ▼ mover para baixo)
  const handleMoveProduct = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    setProducts((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Carregamento e sincronização completa via ColecoesSourceSelector
  const handleProductsLoaded = (loadedProducts: ColecaoProduct[]) => {
    setProducts(loadedProducts);
    setSourceSelectorModalOpen(false);
    setActiveTab("tabela");
  };

  const handleUpdateExistingPhotos = (updatedProducts: ColecaoProduct[]) => {
    setProducts(updatedProducts);
  };

  // Importar planilha Excel/CSV
  const handleSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await parseColecaoSpreadsheet(file);
      if (res.products.length > 0) {
        setProducts(res.products);
        setImportSpreadsheetOpen(false);
      } else {
        alert(res.errors.join("\n") || "Nenhum produto válido encontrado.");
      }
    } catch (err: any) {
      alert("Erro ao ler a planilha: " + (err?.message || String(err)));
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Upload de imagem de fundo personalizada
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setConfig((prev) => ({
          ...prev,
          templateImage: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const handleResetBackground = () => {
    setConfig((prev) => ({
      ...prev,
      templateImage: DEFAULT_COLECAO_CONFIG.templateImage,
    }));
  };

  // Adicionar produto manualmente
  const handleAddManualProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.description.trim()) return;

    const code = newProd.code.trim() || String(products.length + 10001);
    const created: ColecaoProduct = {
      id: `col-prod-${code}-${Date.now()}`,
      code,
      description: newProd.description.trim().toUpperCase(),
      image: newProd.image.trim(),
      isPrincipal: newProd.isPrincipal,
      included: true,
    };

    setProducts((prev) => [created, ...prev]);
    setNewProd({ code: "", description: "", image: "", isPrincipal: false });
    setNewProductModalOpen(false);

    if (created.isPrincipal) {
      setVariantsModalProduct(created);
      setVariantsModalOpen(true);
    }
  };

  // Excluir produto
  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Atualizar descrição (revisão antes de gerar)
  const handleUpdateDescription = (id: string, newDesc: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description: newDesc } : p))
    );
  };

  // Salvar edições completas do bloco (foto 1, foto 2, descrição e nome no card)
  const handleSaveEditedProduct = (updated: ColecaoProduct) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === updated.id || p.code === updated.code) {
          return {
            ...p,
            ...updated,
          };
        }
        return p;
      })
    );
  };

  // Exportar Página Atual
  const handleExportCurrentPage = async () => {
    const pageEl = document.getElementById(`colecao-page-render-${currentPage - 1}`);
    if (!pageEl) {
      alert("Elemento da página não encontrado para exportação.");
      return;
    }

    setIsExporting(true);
    try {
      await exportColecaoPageAsPng(pageEl, config.name, currentPage, config.exportScale || 1);
    } catch (err: any) {
      alert("Erro ao exportar imagem: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar Todas as Páginas em ZIP
  const handleExportAllZip = async () => {
    setIsExporting(true);
    try {
      const items: { element: HTMLElement; pageNumber: number }[] = [];
      for (let i = 0; i < totalPages; i++) {
        const el = document.getElementById(`colecao-page-render-${i}`);
        if (el) items.push({ element: el, pageNumber: i + 1 });
      }

      if (items.length === 0) {
        alert("Nenhuma página disponível para exportar.");
        return;
      }

      await exportColecaoAllPagesZip(items, config.name, config.exportScale || 1);
    } catch (err: any) {
      alert("Erro ao gerar arquivo ZIP: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Arrastar para mover elemento (Canva-style drag)
  const handleStartDrag = (
    productId: string,
    e: React.PointerEvent,
    initialBox: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let hasMoved = false;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const deltaX = (moveEvt.clientX - startClientX) / previewZoom;
      const deltaY = (moveEvt.clientY - startClientY) / previewZoom;

      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        hasMoved = true;
      }

      if (hasMoved) {
        setCustomLayouts((prev) => {
          const prevCustom = prev[productId] || {};
          return {
            ...prev,
            [productId]: {
              ...prevCustom,
              id: prevCustom.id || `elem-${productId}`,
              productId,
              x: Math.round(initialBox.x + deltaX),
              y: Math.round(initialBox.y + deltaY),
              w: initialBox.width,
              h: initialBox.height,
              width: initialBox.width,
              height: initialBox.height,
              rotation: initialBox.rotation || 0,
              z: prevCustom.z ?? prevCustom.zIndex ?? 1,
              zIndex: prevCustom.z ?? prevCustom.zIndex ?? 1,
              manual: true,
              manuallyMoved: true,
            },
          };
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (hasMoved) {
        pushHistory();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Transform Bounding Box resize & rotate
  const handleTransformBox = (
    productId: string,
    newBox: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => {
    setCustomLayouts((prev) => {
      const prevCustom = prev[productId] || {};
      return {
        ...prev,
        [productId]: {
          ...prevCustom,
          id: prevCustom.id || `elem-${productId}`,
          productId,
          x: newBox.x,
          y: newBox.y,
          w: newBox.width,
          h: newBox.height,
          width: newBox.width,
          height: newBox.height,
          rotation: newBox.rotation ?? prevCustom.rotation ?? 0,
          z: prevCustom.z ?? prevCustom.zIndex ?? 1,
          zIndex: prevCustom.z ?? prevCustom.zIndex ?? 1,
          manual: true,
          manuallyMoved: true,
        },
      };
    });
  };

  const handleTransformEnd = () => {
    pushHistory();
  };

  // Alinhamento do elemento selecionado na área da grade
  const handleAlignSelected = (alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (!selectedProductId) return;

    const gridWidth = config.gridArea.xEnd - config.gridArea.xStart;
    const gridHeight = config.gridArea.yEnd - config.gridArea.yStart;

    setCustomLayouts((prev) => {
      const current = prev[selectedProductId];
      const curW = current?.w ?? current?.width ?? 255;
      const curH = current?.h ?? current?.height ?? 275;

      let nextX = current?.x ?? 0;
      let nextY = current?.y ?? 0;

      if (alignment === "left") nextX = 0;
      if (alignment === "center") nextX = Math.round((gridWidth - curW) / 2);
      if (alignment === "right") nextX = gridWidth - curW;
      if (alignment === "top") nextY = 0;
      if (alignment === "middle") nextY = Math.round((gridHeight - curH) / 2);
      if (alignment === "bottom") nextY = gridHeight - curH;

      const nextLayouts = {
        ...prev,
        [selectedProductId]: {
          ...current,
          id: current?.id || `elem-${selectedProductId}`,
          productId: selectedProductId,
          x: nextX,
          y: nextY,
          w: curW,
          h: curH,
          width: curW,
          height: curH,
          z: current?.z ?? current?.zIndex ?? 1,
          zIndex: current?.z ?? current?.zIndex ?? 1,
          manual: true,
          manuallyMoved: true,
        },
      };
      pushHistory(nextLayouts);
      return nextLayouts;
    });
  };

  // Ajuste de camada Z-Index
  const handleZIndexSelected = (direction: "up" | "down") => {
    if (!selectedProductId) return;
    setCustomLayouts((prev) => {
      const current = prev[selectedProductId];
      const currentZ = current?.z ?? current?.zIndex ?? 5;
      const nextZ = direction === "up" ? currentZ + 1 : Math.max(1, currentZ - 1);

      const nextLayouts = {
        ...prev,
        [selectedProductId]: {
          ...current,
          id: current?.id || `elem-${selectedProductId}`,
          productId: selectedProductId,
          x: current?.x ?? 0,
          y: current?.y ?? 0,
          w: current?.w ?? current?.width ?? 255,
          h: current?.h ?? current?.height ?? 275,
          width: current?.w ?? current?.width ?? 255,
          height: current?.h ?? current?.height ?? 275,
          z: nextZ,
          zIndex: nextZ,
          manual: true,
          manuallyMoved: true,
        },
      };
      pushHistory(nextLayouts);
      return nextLayouts;
    });
  };

  // Alternar Bloqueio
  const handleToggleLock = (productId: string) => {
    setCustomLayouts((prev) => {
      const current = prev[productId];
      const currentLocked = current?.locked ?? current?.isLocked ?? false;
      const nextLocked = !currentLocked;
      const nextLayouts = {
        ...prev,
        [productId]: {
          ...current,
          id: current?.id || `elem-${productId}`,
          productId,
          x: current?.x ?? 0,
          y: current?.y ?? 0,
          w: current?.w ?? current?.width ?? 255,
          h: current?.h ?? current?.height ?? 275,
          width: current?.w ?? current?.width ?? 255,
          height: current?.h ?? current?.height ?? 275,
          locked: nextLocked,
          isLocked: nextLocked,
        },
      };
      pushHistory(nextLayouts);
      return nextLayouts;
    });
  };

  // Ocultar / Mostrar
  const handleToggleHide = (productId: string) => {
    setCustomLayouts((prev) => {
      const current = prev[productId];
      const currentHidden = current?.hidden ?? current?.isHidden ?? false;
      const nextHidden = !currentHidden;
      const nextLayouts = {
        ...prev,
        [productId]: {
          ...current,
          id: current?.id || `elem-${productId}`,
          productId,
          x: current?.x ?? 0,
          y: current?.y ?? 0,
          w: current?.w ?? current?.width ?? 255,
          h: current?.h ?? current?.height ?? 275,
          width: current?.w ?? current?.width ?? 255,
          height: current?.h ?? current?.height ?? 275,
          hidden: nextHidden,
          isHidden: nextHidden,
        },
      };
      pushHistory(nextLayouts);
      return nextLayouts;
    });
    if (selectedProductId === productId) {
      setSelectedProductId(null);
    }
  };

  // Redefinir elemento selecionado para a grade
  const handleResetSelectedToGrid = (productId: string) => {
    setCustomLayouts((prev) => {
      const next = { ...prev };
      delete next[productId];
      pushHistory(next);
      return next;
    });
  };

  // Redefinir todos os itens da página atual para a grade
  const handleResetPageToGrid = () => {
    const currentPageProducts = pages[currentPage - 1] || [];
    setCustomLayouts((prev) => {
      const next = { ...prev };
      for (const prod of currentPageProducts) {
        delete next[prod.id];
      }
      pushHistory(next);
      return next;
    });
  };

  // Teclado: Setas (1px ou Shift 10px), Delete, Esc, Ctrl+Z, Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      // Desfazer: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Refazer: Ctrl+Y ou Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ajuste fino com setas do teclado
      if (selectedProductId) {
        const step = e.shiftKey ? 10 : 1;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          setCustomLayouts((prev) => {
            const current = prev[selectedProductId];
            const isLocked = current?.locked ?? current?.isLocked ?? false;
            if (isLocked) return prev;

            const isManual = current?.manual ?? current?.manuallyMoved ?? false;
            let curX = current?.x;
            let curY = current?.y;
            let curW = current?.w ?? current?.width;
            let curH = current?.h ?? current?.height;

            if (!isManual) {
              const currentProdIdx =
                pages[currentPage - 1]?.findIndex((p) => p.id === selectedProductId) ?? -1;
              const rect = currentProdIdx >= 0 ? gridRects[currentProdIdx] : null;
              if (rect) {
                curX = rect.x - config.gridArea.xStart;
                curY = rect.y - config.gridArea.yStart;
                curW = rect.w;
                curH = rect.h;
              }
            }

            if (curX === undefined || curY === undefined) return prev;

            let nextX = curX;
            let nextY = curY;
            if (e.key === "ArrowLeft") nextX -= step;
            if (e.key === "ArrowRight") nextX += step;
            if (e.key === "ArrowUp") nextY -= step;
            if (e.key === "ArrowDown") nextY += step;

            const updated: Record<string, CustomItemLayout> = {
              ...prev,
              [selectedProductId]: {
                ...current,
                id: current?.id || `elem-${selectedProductId}`,
                productId: selectedProductId,
                x: nextX,
                y: nextY,
                w: curW || 255,
                h: curH || 275,
                width: curW || 255,
                height: curH || 275,
                manual: true,
                manuallyMoved: true,
              },
            };
            return updated;
          });
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleToggleHide(selectedProductId);
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setSelectedProductId(null);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProductId, handleUndo, handleRedo, pages, currentPage, gridRects, gridCells, config.gridArea]);

  // Carregar produtos de exemplo para testar
  const handleLoadSample = () => {
    const samples: ColecaoProduct[] = [
      {
        id: "c-1",
        code: "23235",
        description: "SABONETE FLOR DE YPÊ ROSA",
        genericDescription: "SABONETE YPÊ",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: true,
        variantIds: ["c-2", "c-3"],
        included: true,
        variants: [
          {
            id: "c-2",
            code: "23236",
            description: "SABONETE FLOR DE YPÊ VERDE",
            image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
            isPrincipal: false,
            included: false,
          },
        ],
      },
      {
        id: "c-3",
        code: "23237",
        description: "SABONETE ÁGUA DE COCO E ALECRIM VERDE YPÊ",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false,
        included: true,
      },
      {
        id: "c-4",
        code: "16228",
        description: "DETERGENTE CLEAR YPÊ",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: true,
        included: true,
        variants: [
          {
            id: "c-5",
            code: "19227",
            description: "DETERGENTE CAPIM LIMÃO YPÊ",
            image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
            isPrincipal: false,
            included: false,
          },
        ],
      },
      {
        id: "c-6",
        code: "24820",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN 1,3KG",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false,
        included: true,
      },
      {
        id: "c-7",
        code: "20594",
        description: "LAVA ROUPAS PÓ MACIEZ TIXAN 1,3KG",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false,
        included: true,
      },
      {
        id: "c-8",
        code: "20600",
        description: "LAVA ROUPAS PÓ PRIMAVERA",
        image: "", // Sem foto -> cai em pendências de segurança
        isPrincipal: false,
        included: true,
      },
      {
        id: "c-9",
        code: "11793",
        description: "MOLHO POMAROLA AZEITONA SACHÊ 24X300 GR",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false,
        included: true,
      },
    ];

    setProducts(samples);
  };

  return (
    <div className="space-y-4">
      {/* 1. BARRA SUPERIOR DE COLEÇÕES */}
      <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-white font-black text-xl shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="bg-transparent font-bold text-lg text-white border-b border-dashed border-neutral-600 focus:border-[#FFD400] outline-hidden px-1"
                  title="Clique para renomear a coleção"
                />
                <span className="rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/40">
                  ESQUENTA BLACK 1080×1920
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {itemsPerPageEffective} produtos por página ({cols} colunas × {rows} linhas) · Sem preço/validade/estoque
              </p>
            </div>
          </div>

          {/* Estatísticas e Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs bg-black/40 border border-neutral-800 px-3 py-1.5 rounded-lg mr-2">
              <span className="text-neutral-400">
                Cadastrados: <strong className="text-white">{products.length}</strong>
              </span>
              <span className="text-neutral-400">
                No Encarte: <strong className="text-emerald-400">{displayProducts.length}</strong>
              </span>
              {pendingProducts.length > 0 && (
                <span className="text-amber-400 font-bold bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/40">
                  Pendências: {pendingProducts.length} sem foto
                </span>
              )}
              <span className="text-neutral-400">
                Páginas: <strong className="text-blue-400">{totalPages}</strong>
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSourceSelectorModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Importar produtos por Planilha (.xlsx/.csv) ou Link da Categoria"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 text-green-500" />
              Importar Planilha / Link
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSourceSelectorModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Sincronizar banco de fotos com pasta local/rede (ex: Fotos_Palm), ZIP ou Google Drive"
            >
              <FolderSync className="h-4 w-4 mr-1.5 text-amber-400" />
              Banco de Fotos
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewProductModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Produto
            </Button>

            {products.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Deseja realmente limpar todos os produtos da coleção atual?")) {
                    setProducts([]);
                    setCustomLayouts({});
                  }
                }}
                className="bg-neutral-900 border-red-900/60 text-red-400 hover:text-red-300 text-xs h-9"
                title="Zerar produtos da coleção"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLoadSample}
                className="text-xs text-neutral-400 hover:text-white h-9"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-400" />
                Exemplo
              </Button>
            )}
          </div>
        </div>

        {/* Abas: Lista de Produtos vs Visualização */}
        <div className="flex items-center justify-between border-t border-neutral-800 mt-3 pt-3">
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab("tabela")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "tabela"
                  ? "bg-neutral-800 text-[#FFD400] shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Lista de Produtos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-neutral-800 text-[#FFD400] shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar Encarte ({totalPages} {totalPages === 1 ? "Pág" : "Págs"})
            </button>
          </div>

          {/* Botões de Configuração da Grade e Exportação */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGridSettingsOpen(!gridSettingsOpen)}
              className={`text-xs h-9 border-neutral-700 ${
                gridSettingsOpen ? "bg-[#FFD400] text-black font-bold" : "bg-neutral-900 text-neutral-200 hover:text-white"
              }`}
            >
              <Sliders className="h-3.5 w-3.5 mr-1.5" />
              Grade & Layout
            </Button>

            <Button
              size="sm"
              onClick={handleExportCurrentPage}
              disabled={isExporting || products.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 shadow-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar PNG (Pág {currentPage})
            </Button>

            {totalPages > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportAllZip}
                disabled={isExporting}
                className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 font-bold text-xs h-9 shadow-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-[#FFD400]" />
                Exportar Todas (ZIP)
              </Button>
            )}
          </div>
        </div>

        {/* 1.1 PAINEL DE GRADE CONFIGURÁVEL & ELEMENTOS LIVRES */}
        {gridSettingsOpen && (
          <div className="mt-3 pt-3 border-t border-neutral-800 bg-neutral-950/80 p-4 rounded-xl text-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Coluna 1: Dimensões da Grade */}
              <div className="space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs text-[#FFD400]">
                  <Settings className="h-3.5 w-3.5" />
                  Grade & Telas
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-neutral-400">Colunas (1-6)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={config.columnsCount || 4}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          columnsCount: Math.min(6, Math.max(1, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="h-8 bg-neutral-900 border-neutral-700 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-neutral-400">Linhas (1-10)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={config.rowsCount || 5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rowsCount: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="h-8 bg-neutral-900 border-neutral-700 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-neutral-400">Produtos por tela</Label>
                    <label className="flex items-center gap-1.5 text-[10px] text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.autoItemsPerPage !== false}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            autoItemsPerPage: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      Auto ({cols * rows})
                    </label>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    disabled={config.autoItemsPerPage !== false}
                    value={itemsPerPageEffective}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        itemsPerPage: Math.max(1, parseInt(e.target.value) || 20),
                        autoItemsPerPage: false,
                      })
                    }
                    className="h-8 bg-neutral-900 border-neutral-700 text-xs font-mono disabled:opacity-50 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-neutral-400">Espaço Horiz. (gapX px)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={config.gapX ?? config.cellSpacing ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setConfig({
                          ...config,
                          gapX: val,
                          cellSpacing: val,
                        });
                      }}
                      className="h-8 bg-neutral-900 border-neutral-700 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-neutral-400">Espaço Vert. (gapY px)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={config.gapY ?? config.cellSpacing ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setConfig({
                          ...config,
                          gapY: val,
                        });
                      }}
                      className="h-8 bg-neutral-900 border-neutral-700 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Coluna 2: Estilo dos Produtos */}
              <div className="space-y-2">
                <p className="font-bold text-white text-xs text-[#FFD400]">Visual dos Produtos</p>
                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Tamanho do Produto</span>
                    <span className="font-mono text-white">
                      {config.productScale
                        ? (config.productScale > 10 ? `${config.productScale}%` : `${Math.round(config.productScale * 100)}%`)
                        : "130%"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={180}
                    value={
                      config.productScale
                        ? (config.productScale > 10 ? config.productScale : Math.round(config.productScale * 100))
                        : 130
                    }
                    onChange={(e) => setConfig({ ...config, productScale: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Sobreposição de Fotos</span>
                    <span className="font-mono text-white">{config.overlapAmount || 15}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={config.overlapAmount || 15}
                    onChange={(e) => setConfig({ ...config, overlapAmount: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-neutral-400">Lado na Frente (Empilhamento)</Label>
                  <select
                    value={config.frontSide || (config.stackOrder === "left-in-front" ? "left" : "right")}
                    onChange={(e) => {
                      const side = e.target.value as "right" | "left";
                      setConfig({
                        ...config,
                        frontSide: side,
                        stackOrder: side === "left" ? "left-in-front" : "right-in-front",
                      });
                    }}
                    className="w-full h-8 bg-neutral-900 border border-neutral-700 rounded-md px-2 text-xs text-white mt-1"
                  >
                    <option value="right">Direita na frente (Padrão KV)</option>
                    <option value="left">Esquerda na frente</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chkShowDottedLines"
                    checked={config.showDividers ?? (config.showDottedLines !== false)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        showDividers: e.target.checked,
                        showDottedLines: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="chkShowDottedLines" className="text-xs text-neutral-300 cursor-pointer">
                    Divisores / linhas pontilhadas na grade
                  </Label>
                </div>
              </div>

              {/* Coluna 3: Template de Fundo */}
              <div className="space-y-2">
                <p className="font-bold text-white text-xs text-[#FFD400]">Arte de Fundo (1080×1920)</p>
                <div className="flex items-center gap-2">
                  <div className="h-14 w-9 border border-neutral-700 rounded overflow-hidden bg-black shrink-0 relative">
                    <img
                      src={config.templateImage || "/templates/template-esquenta-black-cescom.png"}
                      alt="Fundo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bgFileInputRef.current?.click()}
                      className="w-full h-7 text-[11px] bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Trocar Arte
                    </Button>
                    <input
                      ref={bgFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBackgroundUpload}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleResetBackground}
                      className="w-full h-7 text-[10px] text-neutral-400 hover:text-white"
                    >
                      <RotateCcw className="h-2.5 w-2.5 mr-1" />
                      Redefinir Padrão
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Label className="text-[10px] text-neutral-400">Resolução de Exportação PNG</Label>
                  <select
                    value={config.exportScale || 1}
                    onChange={(e) => setConfig({ ...config, exportScale: parseInt(e.target.value) || 1 })}
                    className="w-full h-8 bg-neutral-900 border border-neutral-700 rounded-md px-2 text-xs text-white mt-1"
                  >
                    <option value={1}>1x - 1080 × 1920 px (Full HD)</option>
                    <option value={2}>2x - 2160 × 3840 px (Ultra HD 4K)</option>
                  </select>
                </div>
              </div>

              {/* Coluna 4: Rodapé de Oferta & Ações */}
              <div className="space-y-2">
                <p className="font-bold text-white text-xs text-[#FFD400]">Rodapé de Oferta (Todas as Páginas)</p>
                <textarea
                  value={config.footerText || ""}
                  onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                  placeholder="Texto do rodapé de validade da oferta..."
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-[11px] text-neutral-200 focus:border-[#FFD400] outline-hidden resize-none font-sans"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetPageToGrid}
                  className="w-full h-8 text-[11px] bg-neutral-900 border-amber-600/50 text-amber-300 hover:bg-neutral-800"
                >
                  <RotateCcw className="h-3 w-3 mr-1 text-amber-400" />
                  Redefinir Pág {currentPage} para a Grade
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ALERTA DE PENDÊNCIAS (PRODUTOS SEM FOTO FORA DO ENCARTE) */}
      {pendingProducts.length > 0 && products.length > 0 && (
        <div
          className="rounded-xl border border-amber-600/50 bg-amber-950/20 p-3.5 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
          data-testid="colecoes-pending-alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">
                Lista de Pendências ({pendingProducts.length} produto(s) sem foto fora do encarte):
              </p>
              <p className="text-[11px] text-amber-200/90 mt-0.5">
                Regra de segurança ativa: produtos sem foto não geram card vazio. Vincule fotos para exibi-los no encarte:{" "}
                <span className="font-mono text-amber-100 font-semibold">
                  {pendingProducts
                    .map((p) => `${p.description} (${p.code})`)
                    .slice(0, 4)
                    .join(", ")}
                  {pendingProducts.length > 4 && ` e mais ${pendingProducts.length - 4}...`}
                </span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSourceSelectorModalOpen(true)}
            className="bg-amber-950/60 border-amber-600 text-amber-200 hover:text-white text-xs h-8 shrink-0 self-start sm:self-auto"
          >
            <FolderSync className="h-3.5 w-3.5 mr-1 text-amber-400" />
            Vincular Fotos
          </Button>
        </div>
      )}

      {/* 3. CONTEÚDO: SELETOR DE ORIGEM (QUANDO VAZIO) OU TABELA/PREVIEW (QUANDO HÁ PRODUTOS) */}
      {products.length === 0 ? (
        <ColecoesSourceSelector
          onProductsLoaded={handleProductsLoaded}
          existingProducts={products}
          hasExistingProducts={false}
        />
      ) : (
        <>
          {activeTab === "tabela" && (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3 border-b bg-neutral-50 flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-800">
                  Produtos da Coleção ({products.length})
                </span>
                <span className="text-neutral-500 text-[11px]">
                  Use as setas <strong>▲ / ▼</strong> para reordenar a posição do produto no encarte.
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 text-neutral-700 font-bold border-b">
                    <tr>
                      <th className="py-2.5 px-2 w-10 text-center">Ordem</th>
                      <th className="py-2.5 px-3 w-16">Foto</th>
                      <th className="py-2.5 px-3 w-28">Código</th>
                      <th className="py-2.5 px-3">Descrição do Produto (Revisável)</th>
                      <th className="py-2.5 px-3 w-40 text-center">Tipo / Principal</th>
                      <th className="py-2.5 px-3 w-48">Variações Vinculadas</th>
                      <th className="py-2.5 px-3 w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {products.map((p, index) => {
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-neutral-50 transition-colors ${
                            !p.image
                              ? "bg-amber-50/70"
                              : p.isPrincipal
                              ? "bg-amber-50/30"
                              : ""
                          }`}
                        >
                          {/* Botões de Mover Ordem (▲ / ▼) */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveProduct(index, "up")}
                                className="h-4 w-5 flex items-center justify-center rounded text-neutral-500 hover:text-black hover:bg-neutral-200 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] font-bold"
                                title="Mover para cima"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === products.length - 1}
                                onClick={() => handleMoveProduct(index, "down")}
                                className="h-4 w-5 flex items-center justify-center rounded text-neutral-500 hover:text-black hover:bg-neutral-200 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] font-bold"
                                title="Mover para baixo"
                              >
                                ▼
                              </button>
                            </div>
                          </td>

                          {/* Foto */}
                          <td className="py-2 px-3">
                            <div
                              className="h-11 w-11 rounded-md border bg-white p-0.5 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500 hover:ring-2 hover:ring-amber-400/40 transition-all group relative"
                              onClick={() => setEditProductModalItem(p)}
                              title="Clique para personalizar ou trocar a foto do produto"
                            >
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.description}
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-amber-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-[8px] font-bold mt-0.5">Sem foto</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Edit2 className="h-3 w-3" />
                              </div>
                            </div>
                          </td>

                          {/* Código */}
                          <td className="py-2 px-3 font-mono font-bold text-neutral-800">
                            {p.code}
                          </td>

                          {/* Descrição */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={p.description}
                                onChange={(e) => handleUpdateDescription(p.id, e.target.value)}
                                className="w-full rounded border border-transparent hover:border-neutral-300 focus:border-neutral-500 bg-transparent px-2 py-1 font-semibold text-neutral-900 outline-hidden"
                                title="Clique para editar a descrição diretamente"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditProductModalItem(p)}
                                className="h-6 w-6 p-0 text-neutral-400 hover:text-amber-700 shrink-0"
                                title="Editar detalhes completos do produto"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {!p.image && (
                              <span className="inline-block mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                Pendência: Sem foto (não gerará card vazio no encarte)
                              </span>
                            )}
                            {(() => {
                              const parsedWeight = parseNormalizedWeight(p.description);
                              const parsedPkg = parsePackagingType(p.description);
                              return (
                                <div className="flex items-center gap-2 mt-0.5 px-2 flex-wrap">
                                  <span className="text-[10px] text-neutral-500 font-medium">
                                    Card:{" "}
                                    <strong className="text-neutral-800">
                                      {p.genericDescription ||
                                        extractGenericBaseName(p.description).toUpperCase()}
                                    </strong>
                                  </span>
                                  {p.secondaryImage && (
                                    <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded font-bold">
                                      Foto 2 personalizada
                                    </span>
                                  )}
                                  {p.limit && (
                                    <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded font-bold">
                                      Limite: {p.limit}
                                    </span>
                                  )}
                                  {parsedWeight ? (
                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 rounded font-semibold">
                                      {parsedWeight.display}
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded font-medium"
                                      title="Gramatura não informada na descrição"
                                    >
                                      Gramatura pendente
                                    </span>
                                  )}
                                  {parsedPkg !== "padrao" && (
                                    <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-200 px-1 rounded font-semibold uppercase">
                                      {parsedPkg}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Botão "Principal" */}
                          <td className="py-2 px-3 text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant={p.isPrincipal ? "default" : "outline"}
                              onClick={() => handleTogglePrincipal(p)}
                              className={`h-7 text-xs font-bold ${
                                p.isPrincipal
                                  ? "bg-amber-500 hover:bg-amber-600 text-neutral-950 border-amber-600"
                                  : "text-neutral-600 hover:text-amber-700 hover:border-amber-400"
                              }`}
                            >
                              <Star
                                className={`h-3.5 w-3.5 mr-1 ${
                                  p.isPrincipal ? "fill-neutral-950" : ""
                                }`}
                              />
                              {p.isPrincipal ? "Principal" : "Tornar Principal"}
                            </Button>
                          </td>

                          {/* Variações */}
                          <td className="py-2 px-3">
                            {p.isPrincipal ? (
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-neutral-700">
                                  {(p.variants || []).length} variação(ões)
                                </span>
                                {(p.variants || []).length > 0 && (
                                  <p className="text-[10px] text-neutral-500 line-clamp-1">
                                    {p.variants?.map((v) => v.description).join(", ")}
                                  </p>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 text-[10px] text-amber-700 p-0 font-bold"
                                  onClick={() => {
                                    setVariantsModalProduct(p);
                                    setVariantsModalOpen(true);
                                  }}
                                >
                                  Editar Variações
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-400 italic">
                                Produto individual (com código)
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
                                onClick={() => setEditProductModalItem(p)}
                                className="h-7 w-7 p-0 text-neutral-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Personalizar bloco (fotos e descrição)"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                title="Excluir produto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. CONTEÚDO DA ABA: VISUALIZAR ENCARTE 1080x1920 COM EDITOR CANVA */}
          {activeTab === "preview" && (
            <div className="rounded-xl border border-neutral-800 bg-[#1A1A1A] p-4 text-white space-y-3 shadow-md">
              {/* Barra de Controles de Visualização */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg text-xs">
                {/* Navegação entre páginas */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      setSelectedProductId(null);
                    }}
                    className="h-8 bg-neutral-800 border-neutral-700 text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-bold text-white px-2">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      setSelectedProductId(null);
                    }}
                    className="h-8 bg-neutral-800 border-neutral-700 text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Desfazer / Refazer no cabeçalho */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    disabled={historyIndex <= 0}
                    onClick={handleUndo}
                    className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Desfazer (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={historyIndex >= history.length - 1}
                    onClick={handleRedo}
                    className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Refazer (Ctrl+Y)"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
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
                  <span className="font-mono text-neutral-400 w-12 text-center">
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
                    Ajustar à Tela
                  </Button>
                </div>
              </div>

              {/* BARRA DE FERRAMENTAS FLUTUANTE DO ELEMENTO SELECIONADO (ESTILO CANVA) */}
              {selectedProductId && selectedProductItem && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900 border border-[#FFD400]/40 p-2.5 px-3 rounded-xl shadow-2xl text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#F6E0A6] text-[#7A0D12] font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                      {selectedProductItem.code || "ITEM"}
                    </span>
                    <span className="font-bold text-white max-w-[200px] truncate text-[11px]">
                      {selectedProductItem.genericDescription || selectedProductItem.description}
                    </span>
                  </div>

                  {/* Alinhamento */}
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("left")}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                      title="Alinhar à Esquerda"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("center")}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                      title="Centralizar Horizontalmente"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("right")}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                      title="Alinhar à Direita"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-[1px] h-3 bg-neutral-700 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("top")}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white text-[10px] font-bold"
                      title="Alinhar ao Topo"
                    >
                      Topo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("middle")}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white text-[10px] font-bold"
                      title="Centralizar Verticalmente"
                    >
                      Meio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignSelected("bottom")}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white text-[10px] font-bold"
                      title="Alinhar à Base"
                    >
                      Base
                    </button>
                  </div>

                  {/* Camada / Z-Index */}
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleZIndexSelected("up")}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white text-[10px] font-bold"
                      title="Trazer para Frente"
                    >
                      + Camada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleZIndexSelected("down")}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white text-[10px] font-bold"
                      title="Enviar para Trás"
                    >
                      - Camada
                    </button>
                  </div>

                  {/* Bloqueio, Ocultar e Redefinir */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleLock(selectedProductId)}
                      className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 ${
                        currentSelectedCustom?.isLocked
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                          : "bg-black/60 text-neutral-300 border-neutral-800 hover:text-white"
                      }`}
                      title={currentSelectedCustom?.isLocked ? "Desbloquear Elemento" : "Bloquear Elemento"}
                    >
                      {currentSelectedCustom?.isLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleHide(selectedProductId)}
                      className="p-1.5 rounded-lg bg-black/60 text-neutral-300 border border-neutral-800 hover:text-red-400 text-xs font-bold"
                      title="Ocultar do Encarte"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResetSelectedToGrid(selectedProductId)}
                      className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[11px] font-bold border border-neutral-700"
                      title="Redefinir para o alinhamento padrão da grade"
                    >
                      Redefinir para a Grade
                    </button>
                  </div>
                </div>
              )}

              {/* Área Central de Renderização da Página Atual */}
              <div
                className="flex justify-center overflow-auto p-4 bg-neutral-950/60 rounded-xl border border-neutral-800 min-h-[600px]"
                onClick={() => setSelectedProductId(null)}
              >
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "top center",
                    marginBottom: `${1920 * (previewZoom - 1)}px`,
                  }}
                  className="shadow-2xl rounded-lg overflow-hidden border border-neutral-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ColecoesPage
                    products={pages[currentPage - 1] || []}
                    pageIndex={currentPage - 1}
                    totalPages={totalPages}
                    config={config}
                    customLayouts={customLayouts}
                    selectedProductId={selectedProductId}
                    onSelectProduct={(id) => setSelectedProductId(id)}
                    interactive={true}
                    previewZoom={previewZoom}
                    onTransformBox={handleTransformBox}
                    onTransformEnd={handleTransformEnd}
                    onStartDrag={handleStartDrag}
                    onEditProduct={(p) => setEditProductModalItem(p)}
                  />
                </div>
              </div>

              {/* Elementos ocultos para captura em alta resolução 1:1 de todas as páginas */}
              <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
                {pages.map((pgProducts, idx) => (
                  <div key={idx} id={`colecao-page-render-${idx}`}>
                    <ColecoesPage
                      products={pgProducts}
                      pageIndex={idx}
                      totalPages={totalPages}
                      config={config}
                      customLayouts={customLayouts}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Origem e Banco de Fotos Completo de Coleções */}
      <Dialog open={sourceSelectorModalOpen} onOpenChange={setSourceSelectorModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <ColecoesSourceSelector
            onProductsLoaded={handleProductsLoaded}
            onUpdateExistingPhotos={handleUpdateExistingPhotos}
            existingProducts={products}
            hasExistingProducts={products.length > 0}
            onClose={() => setSourceSelectorModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* MODAL: Configurar Variações do Produto Principal */}
      <PrincipalVariantsModal
        open={variantsModalOpen}
        onOpenChange={setVariantsModalOpen}
        product={variantsModalProduct}
        allProducts={products}
        onConfirm={handleConfirmVariants}
      />

      {/* MODAL: Importar Planilha de Coleções */}
      <Dialog open={importSpreadsheetOpen} onOpenChange={setImportSpreadsheetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-neutral-900">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Importar Planilha de Coleções
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600">
              Selecione uma planilha Excel (.xlsx) ou CSV com as colunas de <strong>Código</strong>, <strong>Descrição</strong>, foto opcional e flag <strong>Principal</strong> opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div
              className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-green-500 bg-neutral-50 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
              <p className="font-semibold text-neutral-800">Clique para selecionar a planilha</p>
              <p className="text-[11px] text-neutral-500 mt-1">Formatos suportados: .xlsx, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleSpreadsheetFile}
              />
            </div>

            <div className="rounded bg-neutral-100 p-2.5 text-[11px] text-neutral-600 space-y-1">
              <p className="font-bold text-neutral-800">Colunas reconhecidas:</p>
              <p>• <strong>Código</strong>: CODPROD, COD, CODIGO, SKU</p>
              <p>• <strong>Descrição</strong>: DESCRICAO, PRODUTO, NOME</p>
              <p>• <strong>Principal</strong> (opcional): PRINCIPAL, DESTAQUE, SIM/NÃO</p>
              <p className="text-amber-700 font-semibold pt-1">
                Nota: Preço, validade e estoque não são exibidos nesta arte.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportSpreadsheetOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Novo Produto Manual */}
      <Dialog open={newProductModalOpen} onOpenChange={setNewProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-neutral-900">
              Cadastrar Produto na Coleção
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600">
              Preencha código e descrição do produto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddManualProduct} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label htmlFor="colProdCode" className="text-xs font-semibold">
                  Código
                </Label>
                <Input
                  id="colProdCode"
                  placeholder="Ex: 24657"
                  value={newProd.code}
                  onChange={(e) => setNewProd({ ...newProd, code: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="colProdDesc" className="text-xs font-semibold">
                  Descrição do Produto
                </Label>
                <Input
                  id="colProdDesc"
                  placeholder="Ex: BISCOITO OREO 80G CHOCOLATE"
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="colProdImg" className="text-xs font-semibold">
                URL da Foto (Opcional)
              </Label>
              <Input
                id="colProdImg"
                placeholder="https://..."
                value={newProd.image}
                onChange={(e) => setNewProd({ ...newProd, image: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="colProdPrincipal"
                checked={newProd.isPrincipal}
                onChange={(e) => setNewProd({ ...newProd, isPrincipal: e.target.checked })}
                className="rounded border-neutral-300"
              />
              <Label htmlFor="colProdPrincipal" className="text-xs font-semibold cursor-pointer">
                Definir como Produto Principal (agrupa variações de sabor/recheio)
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNewProductModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Personalização de Foto e Descrição do Bloco (Igual ao Encarte de Validade) */}
      <ColecaoProductEditModal
        product={editProductModalItem}
        open={Boolean(editProductModalItem)}
        onOpenChange={(open) => !open && setEditProductModalItem(null)}
        onSave={handleSaveEditedProduct}
      />
    </div>
  );
};
