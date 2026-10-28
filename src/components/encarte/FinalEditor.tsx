import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type {
  EncarteProduct,
  StoreConfig,
  CampaignConfig,
  ProductCustomStyle,
  CampaignGlobalStyle,
} from "@/types/encarte";
import { StoryPage916 } from "./StoryPage916";
import { CanvasRulers } from "./editor/CanvasRulers";
import { TransformBoundingBox } from "./editor/TransformBoundingBox";
import { LayersPanel } from "./editor/LayersPanel";
import { PropertiesPanel } from "./editor/PropertiesPanel";
import { PreflightModal } from "./editor/PreflightModal";
import { ShortcutsHelpModal } from "./editor/ShortcutsHelpModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Move,
  Layers,
  Smartphone,
  Maximize2,
  Grid,
  Ruler,
  Magnet,
  Keyboard,
  MousePointer,
  Hand,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  SelectedTarget,
  TargetElementType,
  BoundingBox,
  GuideLine,
  SmartGuide,
  ChangeScope,
  PreflightIssue,
} from "@/types/editor";

interface FinalEditorProps {
  products: EncarteProduct[];
  store: StoreConfig;
  campaign: CampaignConfig;
  onUpdateProducts: (products: EncarteProduct[]) => void;
  onUpdateCampaign: (campaign: CampaignConfig) => void;
  onProceedToExport: () => void;
  onBackToCampaign: () => void;
}

interface HistoryState {
  products: EncarteProduct[];
  campaign: CampaignConfig;
}

export const FinalEditor: React.FC<FinalEditorProps> = ({
  products,
  store,
  campaign,
  onUpdateProducts,
  onUpdateCampaign,
  onProceedToExport,
  onBackToCampaign,
}) => {
  // Navigation & Page state
  const [activePage, setActivePage] = useState<number>(1);
  const [leftTab, setLeftTab] = useState<"pages" | "layers">("pages");

  // Selection state
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<TargetElementType | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);

  // Editor tools: 'select' (V), 'hand' (H), 'zoom' (Z)
  const [activeTool, setActiveTool] = useState<"select" | "hand" | "zoom">("select");

  // Scope: 'product' | 'page' | 'all'
  const [scope, setScope] = useState<ChangeScope>("product");

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(0.35);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Rulers, Guides & Grid
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSpacing, setGridSpacing] = useState(50);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [guides, setGuides] = useState<GuideLine[]>([
    { id: "g-center-x", orientation: "vertical", position: 540 },
    { id: "g-safe-left", orientation: "vertical", position: 46 },
    { id: "g-safe-right", orientation: "vertical", position: 1034 },
  ]);
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);

  // Modals
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showPreflightModal, setShowPreflightModal] = useState(false);

  // Refs
  const mainRef = useRef<HTMLElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Marquee selection ref
  const [marqueeBox, setMarqueeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const isMarqueeRef = useRef(false);
  const marqueeOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // History stack (up to 100 states)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Record change
  const recordChange = useCallback(
    (newProducts: EncarteProduct[], newCampaign: CampaignConfig) => {
      setHistory((prev) => [...prev.slice(-99), { products, campaign }]);
      setFuture([]);
      onUpdateProducts(newProducts);
      onUpdateCampaign(newCampaign);

      // Auto-save to localStorage
      try {
        localStorage.setItem("encarte-products-v2", JSON.stringify(newProducts));
        localStorage.setItem("encarte-campaign-v2", JSON.stringify(newCampaign));
      } catch {
        // Ignore quota
      }
    },
    [products, campaign, onUpdateProducts, onUpdateCampaign]
  );

  // Undo (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [{ products, campaign }, ...prev]);
    onUpdateProducts(previous.products);
    onUpdateCampaign(previous.campaign);
  }, [history, products, campaign, onUpdateProducts, onUpdateCampaign]);

  // Redo (Ctrl+Y / Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, { products, campaign }]);
    onUpdateProducts(next.products);
    onUpdateCampaign(next.campaign);
  }, [future, products, campaign, onUpdateProducts, onUpdateCampaign]);

  // Flyer products
  const flyerProducts = useMemo(
    () => (products || []).filter((p) => p && p.included),
    [products]
  );

  const perPage = campaign?.productsPerPage || 10;
  const totalPages = Math.max(1, Math.ceil(flyerProducts.length / perPage));

  useEffect(() => {
    if (activePage > totalPages) {
      setActivePage(totalPages);
    }
  }, [activePage, totalPages]);

  // Products on current page
  const pageProducts = useMemo(() => {
    const start = (activePage - 1) * perPage;
    return flyerProducts.slice(start, start + perPage);
  }, [flyerProducts, activePage, perPage]);

  // Selected product
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const currentCustom = selectedProduct?.customStyle || {};
  const currentGlobalStyle = campaign.globalStyle || {};

  // Auto-select first product if none selected
  useEffect(() => {
    if (!selectedProductId && pageProducts.length > 0) {
      setSelectedProductId(pageProducts[0].id);
      setSelectedElement("box");
    }
  }, [pageProducts, selectedProductId]);

  // Auto-fit zoom to available canvas space
  const handleAutoFit = useCallback(() => {
    if (!mainRef.current) return;
    const clientWidth = mainRef.current.clientWidth - (showRulers ? 24 : 0);
    const clientHeight = mainRef.current.clientHeight - (showRulers ? 24 : 0);

    const availableW = Math.max(160, clientWidth - 48);
    const availableH = Math.max(160, clientHeight - 48);

    const fitZoomW = availableW / 1080;
    const fitZoomH = availableH / 1920;

    const bestZoom = Math.min(fitZoomW, fitZoomH);
    const clamped = Math.max(0.18, Math.min(0.9, Number(bestZoom.toFixed(2))));
    setZoom(clamped);
    setPanOffset({ x: 0, y: 0 });
  }, [showRulers]);

  useEffect(() => {
    const timer = setTimeout(handleAutoFit, 60);
    const onResize = () => handleAutoFit();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [handleAutoFit]);

  // Update product custom styles with scope
  const updateCustomStyle = useCallback(
    (updates: Partial<ProductCustomStyle>) => {
      if (scope === "product" && selectedProductId) {
        const updated = products.map((p) => {
          if (p.id === selectedProductId) {
            const nextCustom: ProductCustomStyle = {
              ...(p.customStyle || {}),
              ...updates,
              isCustomized: true,
            };
            return { ...p, customStyle: nextCustom };
          }
          return p;
        });
        recordChange(updated, campaign);
      } else if (scope === "page") {
        const nextPageStyles = {
          ...(campaign.pageStyles || {}),
          [activePage]: {
            ...(campaign.pageStyles?.[activePage] || {}),
            ...updates,
          },
        };
        recordChange(products, { ...campaign, pageStyles: nextPageStyles });
      } else if (scope === "all") {
        const nextGlobalStyle: CampaignGlobalStyle = {
          ...(campaign.globalStyle || {}),
          ...updates,
        };
        recordChange(products, { ...campaign, globalStyle: nextGlobalStyle });
      }
    },
    [scope, selectedProductId, products, campaign, activePage, recordChange]
  );

  // Update direct product data fields
  const handleUpdateProductData = (productId: string, updates: Partial<EncarteProduct>) => {
    const updated = products.map((p) => (p.id === productId ? { ...p, ...updates } : p));
    recordChange(updated, campaign);
  };

  // Reset product styling
  const handleResetProduct = () => {
    if (!selectedProductId) return;
    const updated = products.map((p) => {
      if (p.id === selectedProductId) {
        const { customStyle, ...rest } = p;
        return { ...rest, customStyle: undefined };
      }
      return p;
    });
    recordChange(updated, campaign);
  };

  // Move product between pages
  const handleMoveToPage = (targetPage: number) => {
    if (!selectedProductId || targetPage < 1 || targetPage > totalPages || targetPage === activePage) return;
    const currentIdx = products.findIndex((p) => p.id === selectedProductId);
    if (currentIdx === -1) return;

    const targetStart = (targetPage - 1) * perPage;
    const targetProductAtStart = flyerProducts[targetStart];
    const targetIndexInAll = targetProductAtStart
      ? products.findIndex((p) => p.id === targetProductAtStart.id)
      : products.length - 1;

    const newProducts = [...products];
    const [moved] = newProducts.splice(currentIdx, 1);
    newProducts.splice(targetIndexInAll, 0, moved);

    recordChange(newProducts, campaign);
    setActivePage(targetPage);
  };

  // Reorder product in list
  const handleReorderProduct = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= pageProducts.length || toIndex >= pageProducts.length) return;
    const p1 = pageProducts[fromIndex];
    const p2 = pageProducts[toIndex];
    if (!p1 || !p2) return;

    const idx1 = products.findIndex((p) => p.id === p1.id);
    const idx2 = products.findIndex((p) => p.id === p2.id);
    if (idx1 === -1 || idx2 === -1) return;

    const newProducts = [...products];
    const [moved] = newProducts.splice(idx1, 1);
    newProducts.splice(idx2, 0, moved);
    recordChange(newProducts, campaign);
  };

  // Toggle lock state
  const handleToggleLock = (productId: string, isLocked: boolean) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          customStyle: {
            ...(p.customStyle || {}),
            isLocked,
          },
        };
      }
      return p;
    });
    recordChange(updated, campaign);
  };

  // Toggle element visibility
  const handleToggleVisibility = (
    productId: string,
    element: TargetElementType,
    isVisible: boolean
  ) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        const nextStyle = { ...(p.customStyle || {}) };
        if (element === "name") nextStyle.showName = isVisible;
        if (element === "header") nextStyle.showCode = isVisible;
        if (element === "validity") nextStyle.showValidity = isVisible;
        if (element === "stock") nextStyle.showStock = isVisible;
        return { ...p, customStyle: nextStyle };
      }
      return p;
    });
    recordChange(updated, campaign);
  };

  // Calculate bounding box for active target in 1080x1920 coordinates
  const currentBoundingBox = useMemo<BoundingBox | null>(() => {
    if (!selectedProductId) return null;
    if (typeof document === "undefined") return null;

    // Find card DOM element
    const cardEl = document.getElementById(`product-card-${selectedProductId}`);
    const storyPageEl = document.getElementById(`story-page-editor-${activePage}`);
    if (!cardEl || !storyPageEl) return null;

    let targetEl: HTMLElement | null = cardEl;
    if (selectedElement && selectedElement !== "box") {
      const sub = cardEl.querySelector(`[data-element-type="${selectedElement}"]`) as HTMLElement;
      if (sub) targetEl = sub;
    }

    const pageRect = storyPageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    if (pageRect.width === 0 || pageRect.height === 0) return null;

    const scaleX = 1080 / pageRect.width;
    const scaleY = 1920 / pageRect.height;

    const x = Math.round((targetRect.left - pageRect.left) * scaleX);
    const y = Math.round((targetRect.top - pageRect.top) * scaleY);
    const width = Math.round(targetRect.width * scaleX);
    const height = Math.round(targetRect.height * scaleY);

    return {
      x,
      y,
      width: Math.max(20, width),
      height: Math.max(16, height),
      rotation: currentCustom.photoRotation || 0,
    };
  }, [selectedProductId, selectedElement, activePage, currentCustom, zoom, panOffset]);

  // Handle bounding box transformation
  const handleTransformBox = (newBox: BoundingBox) => {
    if (!selectedProductId) return;

    if (selectedElement === "image") {
      updateCustomStyle({
        photoWidth: Math.round(newBox.width),
        photoHeight: Math.round(newBox.height),
        photoRotation: newBox.rotation,
      });
    } else if (selectedElement === "price") {
      updateCustomStyle({
        pillRadius: Math.min(9999, Math.round(newBox.height / 2)),
      });
    } else if (selectedElement === "name") {
      const scale = newBox.height / (currentBoundingBox?.height || 50);
      const currentSize = currentCustom.nameFontSize || 30;
      updateCustomStyle({
        nameFontSize: Math.max(12, Math.min(60, Math.round(currentSize * scale))),
      });
    } else {
      // Moving the box
      if (currentBoundingBox) {
        const dx = newBox.x - currentBoundingBox.x;
        const dy = newBox.y - currentBoundingBox.y;
        updateCustomStyle({
          boxOffsetX: (currentCustom.boxOffsetX || 0) + dx,
          boxOffsetY: (currentCustom.boxOffsetY || 0) + dy,
        });
      }
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

      // Help modal: ?
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Tools: V, H, Z
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("select");
      } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("hand");
      } else if (e.key.toLowerCase() === "z" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("zoom");
      } else if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
        setShowGrid((v) => !v);
      } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        setShowRulers((v) => !v);
      } else if (e.key.toLowerCase() === "u" && !e.ctrlKey && !e.metaKey) {
        setSnapToGuides((v) => !v);
      }

      // Space key for temporary hand pan
      if (e.code === "Space" && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }

      // Fit to screen: Ctrl+0
      else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleAutoFit();
      }
      // 100% zoom: Ctrl+1
      else if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        setZoom(1.0);
        setPanOffset({ x: 0, y: 0 });
      }
      // Select all: Ctrl+A
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const allTargets: SelectedTarget[] = pageProducts.map((p) => ({
          productId: p.id,
          element: "box",
        }));
        setSelectedTargets(allTargets);
      }
      // Deselect all: Ctrl+D or Esc
      else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") || e.key === "Escape") {
        e.preventDefault();
        setSelectedTargets([]);
        setSelectedElement(null);
      }
      // Arrow keys (1px or 10px with Shift)
      else if (selectedProductId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const currentOffsetX = currentCustom.boxOffsetX || 0;
        const currentOffsetY = currentCustom.boxOffsetY || 0;

        if (e.key === "ArrowLeft") {
          updateCustomStyle({ boxOffsetX: currentOffsetX - step });
        } else if (e.key === "ArrowRight") {
          updateCustomStyle({ boxOffsetX: currentOffsetX + step });
        } else if (e.key === "ArrowUp") {
          updateCustomStyle({ boxOffsetY: currentOffsetY - step });
        } else if (e.key === "ArrowDown") {
          updateCustomStyle({ boxOffsetY: currentOffsetY + step });
        }
      }
      // Tab / Shift+Tab to cycle elements
      else if (e.key === "Tab") {
        e.preventDefault();
        if (pageProducts.length === 0) return;
        const currentIndex = pageProducts.findIndex((p) => p.id === selectedProductId);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + pageProducts.length) % pageProducts.length
          : (currentIndex + 1) % pageProducts.length;
        setSelectedProductId(pageProducts[nextIndex].id);
        setSelectedElement("box");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleUndo,
    handleRedo,
    handleAutoFit,
    isSpacePressed,
    pageProducts,
    selectedProductId,
    currentCustom,
    updateCustomStyle,
  ]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom((prev) => Math.max(0.15, Math.min(2.5, Number((prev + delta).toFixed(2)))));
    } else if (isSpacePressed || activeTool === "hand") {
      // Pan with wheel
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Pan mouse down
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (isSpacePressed || activeTool === "hand" || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
    } else if (activeTool === "select" && e.target === e.currentTarget) {
      // Clicked on empty canvas space -> Marquee selection
      isMarqueeRef.current = true;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      marqueeOriginRef.current = { x: startX, y: startY };
      setMarqueeBox({ x: startX, y: startY, width: 0, height: 0 });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    } else if (isMarqueeRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const x = Math.min(marqueeOriginRef.current.x, currentX);
      const y = Math.min(marqueeOriginRef.current.y, currentY);
      const width = Math.abs(currentX - marqueeOriginRef.current.x);
      const height = Math.abs(currentY - marqueeOriginRef.current.y);

      setMarqueeBox({ x, y, width, height });
    }
  };

  const handleMouseUpCanvas = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isMarqueeRef.current) {
      isMarqueeRef.current = false;
      setMarqueeBox(null);
    }
  };

  // Selection target handler
  const handleSelectTarget = (target: SelectedTarget, multiSelect?: boolean) => {
    setSelectedProductId(target.productId);
    setSelectedElement(target.element);

    if (multiSelect) {
      setSelectedTargets((prev) => {
        const exists = prev.some(
          (t) => t.productId === target.productId && t.element === target.element
        );
        if (exists) {
          return prev.filter(
            (t) => !(t.productId === target.productId && t.element === target.element)
          );
        }
        return [...prev, target];
      });
    } else {
      setSelectedTargets([target]);
    }
  };

  // Pre-flight check generator
  const preflightIssues = useMemo<PreflightIssue[]>(() => {
    const issues: PreflightIssue[] = [];

    products.forEach((p, index) => {
      if (!p.included) return;
      const pageNum = Math.floor(index / perPage) + 1;

      // 1. Missing Photo
      if (!p.image || String(p.image).trim() === "") {
        issues.push({
          id: `missing-photo-${p.id}`,
          type: "missing_photo",
          title: "Produto sem foto",
          description: `"${p.name || p.code || "Item"}" está sem imagem cadastrada.`,
          page: pageNum,
          productId: p.id,
        });
      }

      // 2. Empty or Zero Price
      if (!p.price || String(p.price).trim() === "" || p.price === "0" || p.price === "0,00") {
        issues.push({
          id: `empty-price-${p.id}`,
          type: "empty_price",
          title: "Preço zerado ou vazio",
          description: `"${p.name || p.code || "Item"}" está sem preço definido.`,
          page: pageNum,
          productId: p.id,
        });
      }

      // 3. Font Below Min Legibility
      const cs = p.customStyle || {};
      if (typeof cs.nameFontSize === "number" && cs.nameFontSize < 20) {
        issues.push({
          id: `font-min-${p.id}`,
          type: "font_below_min",
          title: "Fonte abaixo do tamanho mínimo",
          description: `Nome de "${p.name}" está com ${cs.nameFontSize}px (mínimo recomendado: 24px).`,
          page: pageNum,
          productId: p.id,
        });
      }
    });

    return issues;
  }, [products, perPage]);

  // Font warnings for current page
  const fontWarnings = useMemo(() => {
    const warnings: string[] = [];
    pageProducts.forEach((p) => {
      const nameSize = p.customStyle?.nameFontSize;
      if (typeof nameSize === "number" && nameSize < 24) {
        warnings.push(`"${p.name}": fonte do nome em ${nameSize}px (mínimo recomendado: 24px)`);
      }
      const headerSize = p.customStyle?.headerFontSize;
      if (typeof headerSize === "number" && headerSize < 20) {
        warnings.push(`"${p.name}": fonte do cabeçalho em ${headerSize}px (mínimo recomendado: 20px)`);
      }
    });
    return warnings;
  }, [pageProducts]);

  // Proceed button click
  const handleProceedClick = () => {
    if (preflightIssues.length > 0) {
      setShowPreflightModal(true);
    } else {
      onProceedToExport();
    }
  };

  const handleFixIssue = (issue: PreflightIssue) => {
    setActivePage(issue.page);
    if (issue.productId) {
      setSelectedProductId(issue.productId);
      setSelectedElement("box");
    }
  };

  return (
    <div
      data-testid="final-editor-container"
      className="flex flex-col h-[calc(100vh-140px)] min-h-[640px] bg-neutral-900 rounded-xl border border-border overflow-hidden shadow-2xl select-none"
    >
      {/* 1. TOP HEADER & TOOLBAR */}
      <header className="h-13 bg-card border-b border-border px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToCampaign}
            className="text-xs font-semibold"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Edição Visual
            </span>
            <Badge variant="outline" className="text-[11px] font-mono">
              Página {activePage} de {totalPages} · {flyerProducts.length} itens
            </Badge>
          </div>
        </div>

        {/* Center: Tools (V, H, Z, Grid, Rulers, Guides) */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
          <Button
            variant={activeTool === "select" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setActiveTool("select")}
            title="Ferramenta de Seleção (V)"
          >
            <MousePointer className="h-3.5 w-3.5 mr-1" />
            Seleção
          </Button>

          <Button
            variant={activeTool === "hand" || isSpacePressed ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setActiveTool("hand")}
            title="Ferramenta de Mão / Pan (H ou segurar Espaço)"
          >
            <Hand className="h-3.5 w-3.5 mr-1" />
            Mão
          </Button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <Button
            variant={showRulers ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowRulers(!showRulers)}
            title="Mostrar / Ocultar Réguas (R)"
          >
            <Ruler className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant={showGrid ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowGrid(!showGrid)}
            title="Mostrar / Ocultar Grade (G)"
          >
            <Grid className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant={snapToGuides ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setSnapToGuides(!snapToGuides)}
            title="Guias Inteligentes / Snap (U)"
          >
            <Magnet className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowShortcutsModal(true)}
            title="Atalhos de Teclado (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Right: History (Undo/Redo), Zoom, and Export Button */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center border border-border rounded-lg bg-card p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="h-7 px-2 text-xs disabled:opacity-30"
              title="Desfazer (Ctrl+Z)"
              data-testid="undo-button"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Desfazer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={future.length === 0}
              className="h-7 px-2 text-xs disabled:opacity-30"
              title="Refazer (Ctrl+Y)"
              data-testid="redo-button"
            >
              <Redo2 className="h-3.5 w-3.5 mr-1" />
              Refazer
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border border-border rounded-lg bg-card p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(0.15, Number((z - 0.05).toFixed(2))))}
              className="h-7 w-7 p-0"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-semibold px-2 font-mono select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.05).toFixed(2))))}
              className="h-7 w-7 p-0"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoFit}
              className="h-7 px-2 text-[11px] font-medium"
              title="Ajustar à tela (Ctrl+0)"
            >
              Ajustar
            </Button>
          </div>

          {/* Proceed button */}
          <Button
            onClick={handleProceedClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md"
            data-testid="proceed-export-button"
          >
            Avançar para Exportação
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      {/* 2. THREE-COLUMN WORKSPACE */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* ================================================================= */}
        {/* LEFT COLUMN: PAGES MINIATURES & LAYERS PANEL */}
        {/* ================================================================= */}
        <aside
          data-testid="thumbnails-sidebar"
          className="w-56 lg:w-64 bg-card border-r border-border flex flex-col shrink-0 overflow-hidden z-20"
        >
          {/* Left tabs: Páginas vs Camadas */}
          <div className="p-2 border-b border-border bg-muted/30 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setLeftTab("pages")}
              className={`py-1.5 text-xs rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                leftTab === "pages"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Páginas ({totalPages})
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("layers")}
              className={`py-1.5 text-xs rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                leftTab === "layers"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Camadas
            </button>
          </div>

          {leftTab === "pages" ? (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {Array.from({ length: totalPages }).map((_, pIdx) => {
                const pNumber = pIdx + 1;
                const isCurrent = pNumber === activePage;
                const startIdx = pIdx * perPage;
                const itemsThisPage = flyerProducts.slice(startIdx, startIdx + perPage);
                const customCount = itemsThisPage.filter(
                  (p) => p.customStyle && Object.keys(p.customStyle).length > 0
                ).length;

                return (
                  <button
                    key={`thumb-page-${pNumber}`}
                    type="button"
                    data-testid={`thumbnail-page-${pNumber}`}
                    onClick={() => setActivePage(pNumber)}
                    className={`w-full text-left rounded-lg p-2.5 border transition-all flex flex-col gap-1.5 ${
                      isCurrent
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:bg-muted/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isCurrent ? "text-primary" : "text-foreground"
                        }`}
                      >
                        Página {pNumber}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {itemsThisPage.length} {itemsThisPage.length === 1 ? "item" : "itens"}
                      </span>
                    </div>

                    {/* Miniature 9:16 layout representation */}
                    <div className="w-full aspect-[9/16] max-h-36 bg-black rounded border border-border relative overflow-hidden flex items-center justify-center shadow-inner">
                      <img
                        src={
                          campaign.template916Image ||
                          "/templates/template-detona-precos-9-16.png"
                        }
                        alt={`Página ${pNumber}`}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-x-2 bottom-2 top-[35%] bg-neutral-200/90 rounded p-1 grid grid-cols-2 gap-0.5 pointer-events-none">
                        {itemsThisPage.map((p, itemIdx) => (
                          <div
                            key={p.id || itemIdx}
                            className="bg-white rounded border border-neutral-300 flex items-center justify-center p-0.5"
                          >
                            <div className="w-full h-1 bg-red-600 rounded-full" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {customCount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-primary font-semibold mt-0.5">
                        <Sparkles className="h-3 w-3" />
                        <span>{customCount} customizado(s)</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <LayersPanel
                products={pageProducts}
                customStyles={Object.fromEntries(
                  pageProducts.map((p) => [p.id, p.customStyle || {}])
                )}
                selectedTarget={
                  selectedProductId
                    ? { productId: selectedProductId, element: selectedElement || "box" }
                    : null
                }
                selectedTargets={selectedTargets}
                onSelectTarget={handleSelectTarget}
                onToggleLock={handleToggleLock}
                onToggleVisibility={handleToggleVisibility}
                onReorderProduct={handleReorderProduct}
              />
            </div>
          )}
        </aside>

        {/* ================================================================= */}
        {/* CENTER COLUMN: INTERACTIVE CANVAS WITH RULERS & TRANSFORM BOX */}
        {/* ================================================================= */}
        <main
          data-testid="interactive-canvas"
          ref={mainRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          className={`flex-1 min-w-0 bg-[#121212] flex flex-col relative overflow-hidden select-none ${
            isSpacePressed || activeTool === "hand" ? "cursor-grab" : ""
          } ${isPanning ? "cursor-grabbing" : ""}`}
        >
          {/* Top Legibility Warning Banner if font is below 24px */}
          {fontWarnings.length > 0 && (
            <div className="absolute top-8 left-12 right-12 z-30 bg-amber-500 text-black px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-black" />
                <span>Aviso de Legibilidade: {fontWarnings.join(" · ")}</span>
              </div>
            </div>
          )}

          {/* Rulers Overlay */}
          <CanvasRulers
            zoom={zoom}
            panOffset={panOffset}
            visible={showRulers}
            guides={guides}
            onAddGuide={(g) => setGuides((prev) => [...prev, g])}
            onUpdateGuide={(id, pos) =>
              setGuides((prev) => prev.map((g) => (g.id === id ? { ...g, position: pos } : g)))
            }
            onRemoveGuide={(id) => setGuides((prev) => prev.filter((g) => g.id !== id))}
          />

          {/* Canvas Wrapper */}
          <div
            ref={canvasContainerRef}
            className="flex-1 flex items-center justify-center relative overflow-hidden"
            style={{
              paddingLeft: showRulers ? "24px" : "0",
              paddingTop: showRulers ? "24px" : "0",
            }}
          >
            {/* 1080x1920 Page scaled with transform */}
            <div
              className="relative shrink-0 transition-[transform] duration-75"
              style={{
                width: `${Math.round(1080 * zoom)}px`,
                height: `${Math.round(1920 * zoom)}px`,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
              }}
            >
              {/* Actual 1080x1920 canvas container */}
              <div
                style={{
                  width: "1080px",
                  height: "1920px",
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.08)",
                }}
                className="absolute top-0 left-0 bg-black overflow-hidden"
              >
                {/* 1. Underlying StoryPage916 */}
                <StoryPage916
                  pageNumber={activePage}
                  totalPages={totalPages}
                  products={pageProducts}
                  store={store}
                  campaign={campaign}
                  domId={`story-page-editor-${activePage}`}
                  selectedProductId={selectedProductId}
                  selectedElement={selectedElement}
                  onSelectProduct={(id) => {
                    setSelectedProductId(id);
                    setSelectedElement("box");
                  }}
                  onSelectElement={(id, el) => {
                    setSelectedProductId(id);
                    setSelectedElement(el);
                  }}
                  isInteractive={true}
                />

                {/* 2. Grid overlay */}
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(0, 168, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 168, 255, 0.15) 1px, transparent 1px)`,
                      backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
                    }}
                  />
                )}

                {/* 3. Transform Bounding Box with 8 handles & Smart Guides */}
                {currentBoundingBox && selectedProduct && !currentCustom.isLocked && (
                  <TransformBoundingBox
                    box={currentBoundingBox}
                    zoom={1} // Natively in 1080x1920 canvas coordinates
                    allowRotation={selectedElement === "image"}
                    snapGuides={smartGuides}
                    onTransform={handleTransformBox}
                    onTransformEnd={() => {
                      setSmartGuides([]);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Marquee selection rectangle */}
            {marqueeBox && (
              <div
                className="absolute pointer-events-none border border-primary bg-primary/20 z-40"
                style={{
                  left: `${marqueeBox.x}px`,
                  top: `${marqueeBox.y}px`,
                  width: `${marqueeBox.width}px`,
                  height: `${marqueeBox.height}px`,
                }}
              />
            )}
          </div>

          {/* Bottom Status Bar */}
          <footer className="h-7 bg-card border-t border-border px-4 flex items-center justify-between text-[11px] text-muted-foreground shrink-0 z-30">
            <div className="flex items-center gap-3">
              <span>
                Página <b className="text-foreground">{activePage}</b> de {totalPages}
              </span>
              <span>·</span>
              <span>
                Zoom: <b className="text-foreground">{Math.round(zoom * 100)}%</b>
              </span>
              {selectedProduct && (
                <>
                  <span>·</span>
                  <span>
                    Selecionado:{" "}
                    <b className="text-foreground truncate max-w-xs inline-block align-bottom">
                      {selectedProduct.name} ({selectedElement || "box"})
                    </b>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Pressione</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px] font-bold text-foreground">
                ?
              </kbd>
              <span className="hidden sm:inline">para atalhos</span>
            </div>
          </footer>
        </main>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: PROPERTIES PANEL (INSPECTOR) */}
        {/* ================================================================= */}
        <aside
          data-testid="properties-panel"
          className="w-80 lg:w-96 bg-card border-l border-border flex flex-col shrink-0 overflow-hidden z-20"
        >
          <PropertiesPanel
            selectedTarget={
              selectedProductId
                ? { productId: selectedProductId, element: selectedElement || "box" }
                : null
            }
            selectedTargets={selectedTargets}
            product={selectedProduct}
            customStyle={currentCustom}
            globalStyle={currentGlobalStyle}
            scope={scope}
            onChangeScope={setScope}
            onUpdateStyle={updateCustomStyle}
            onUpdateProductData={handleUpdateProductData}
            onResetStyle={handleResetProduct}
            onAlignElements={(type) => {
              if (type === "left") updateCustomStyle({ nameTextAlign: "left" });
              if (type === "center") updateCustomStyle({ nameTextAlign: "center" });
              if (type === "right") updateCustomStyle({ nameTextAlign: "right" });
              if (type === "top") updateCustomStyle({ boxOffsetY: 0 });
              if (type === "middle") updateCustomStyle({ boxOffsetY: 0 });
              if (type === "bottom") updateCustomStyle({ boxOffsetY: 0 });
            }}
          />
        </aside>
      </div>

      {/* 3. PRE-FLIGHT CHECK MODAL BEFORE EXPORT */}
      <PreflightModal
        open={showPreflightModal}
        onOpenChange={setShowPreflightModal}
        issues={preflightIssues}
        onFixIssue={handleFixIssue}
        onProceedToExport={onProceedToExport}
      />

      {/* 4. KEYBOARD SHORTCUTS REFERENCE MODAL */}
      <ShortcutsHelpModal
        open={showShortcutsModal}
        onOpenChange={setShowShortcutsModal}
      />
    </div>
  );
};
