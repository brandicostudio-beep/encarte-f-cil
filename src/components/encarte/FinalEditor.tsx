import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type {
  EncarteProduct,
  StoreConfig,
  CampaignConfig,
  ProductCustomStyle,
  CampaignGlobalStyle,
} from "@/types/encarte";
import { StoryPage916 } from "./StoryPage916";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Move,
  Type,
  Palette,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Layers,
  Check,
  Smartphone,
  Maximize2,
  Image as ImageIcon,
} from "lucide-react";

interface FinalEditorProps {
  products: EncarteProduct[];
  store: StoreConfig;
  campaign: CampaignConfig;
  onUpdateProducts: (products: EncarteProduct[]) => void;
  onUpdateCampaign: (campaign: CampaignConfig) => void;
  onProceedToExport: () => void;
  onBackToCampaign: () => void;
}

// Paleta oficial de cores do template
const TEMPLATE_PALETTE = [
  { name: "Vermelho Detona", hex: "#E30613" },
  { name: "Amarelo Ouro", hex: "#FFE600" },
  { name: "Amarelo Suave", hex: "#FFD400" },
  { name: "Preto Absoluto", hex: "#000000" },
  { name: "Branco Puro", hex: "#FFFFFF" },
  { name: "Cinza Claro", hex: "#D9D9D9" },
  { name: "Cinza Painel", hex: "#F2F2F2" },
  { name: "Azul Oferta", hex: "#0284C7" },
  { name: "Verde Preço", hex: "#16A34A" },
  { name: "Laranja", hex: "#EA580C" },
];

type TargetElement =
  | "pill"
  | "name"
  | "header"
  | "validity"
  | "stock"
  | "box"
  | "image";

type ChangeScope = "product" | "page" | "all";

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
  const [activePage, setActivePage] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeElement, setActiveElement] = useState<TargetElement>("pill");
  const [scope, setScope] = useState<ChangeScope>("product");
  const [zoom, setZoom] = useState<number>(0.35);

  const mainRef = useRef<HTMLElement>(null);

  // Auto-ajuste de zoom para caber exatamente na tela sem barras de rolagem
  const handleAutoFit = useCallback(() => {
    if (!mainRef.current) return;
    const clientWidth = mainRef.current.clientWidth;
    const clientHeight = mainRef.current.clientHeight;

    // Espaço disponível com margem de segurança de 32px
    const availableW = Math.max(160, clientWidth - 32);
    const availableH = Math.max(160, clientHeight - 32);

    const fitZoomW = availableW / 1080;
    const fitZoomH = availableH / 1920;

    // Zoom que cabe perfeitamente na largura e altura
    const bestZoom = Math.min(fitZoomW, fitZoomH);
    const clamped = Math.max(0.18, Math.min(0.85, Number(bestZoom.toFixed(2))));
    setZoom(clamped);
  }, []);

  // Executa auto-ajuste ao carregar e ao redimensionar a janela
  useEffect(() => {
    const timer = setTimeout(() => {
      handleAutoFit();
    }, 60);

    const onResize = () => handleAutoFit();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [handleAutoFit]);

  // Histórico de Desfazer/Refazer
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Registra alteração com histórico
  const recordChange = useCallback(
    (newProducts: EncarteProduct[], newCampaign: CampaignConfig) => {
      setHistory((prev) => [...prev.slice(-29), { products, campaign }]);
      setFuture([]);
      onUpdateProducts(newProducts);
      onUpdateCampaign(newCampaign);
    },
    [products, campaign, onUpdateProducts, onUpdateCampaign]
  );

  // Desfazer (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [{ products, campaign }, ...prev]);
    onUpdateProducts(previous.products);
    onUpdateCampaign(previous.campaign);
  }, [history, products, campaign, onUpdateProducts, onUpdateCampaign]);

  // Refazer (Ctrl+Y)
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, { products, campaign }]);
    onUpdateProducts(next.products);
    onUpdateCampaign(next.campaign);
  }, [future, products, campaign, onUpdateProducts, onUpdateCampaign]);

  // Produtos incluídos no encarte
  const flyerProducts = useMemo(
    () => (products || []).filter((p) => p && p.included),
    [products]
  );

  const perPage = campaign?.productsPerPage || 10;
  const totalPages = Math.max(1, Math.ceil(flyerProducts.length / perPage));

  // Garante activePage válida
  useEffect(() => {
    if (activePage > totalPages) {
      setActivePage(totalPages);
    }
  }, [activePage, totalPages]);

  // Produtos da página ativa
  const pageProducts = useMemo(() => {
    const start = (activePage - 1) * perPage;
    return flyerProducts.slice(start, start + perPage);
  }, [flyerProducts, activePage, perPage]);

  // Produto atualmente selecionado
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  // Estilo customizado do produto selecionado
  const currentCustom = selectedProduct?.customStyle || {};
  const currentPageStyle = campaign.pageStyles?.[activePage] || {};
  const currentGlobalStyle = campaign.globalStyle || {};

  // Seletor automático do primeiro produto da página se nada selecionado
  useEffect(() => {
    if (!selectedProductId && pageProducts.length > 0) {
      setSelectedProductId(pageProducts[0].id);
    }
  }, [pageProducts, selectedProductId]);

  // Atualiza campo do produto selecionado (ex: nome, preço, etc.)
  const updateProductData = (field: keyof EncarteProduct, value: any) => {
    if (!selectedProductId) return;
    const updated = products.map((p) =>
      p.id === selectedProductId ? { ...p, [field]: value } : p
    );
    recordChange(updated, campaign);
  };

  // Atualiza estilo customizado conforme o escopo selecionado
  const updateCustomStyle = (updates: Partial<ProductCustomStyle>) => {
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
  };

  // Aplicar estilo do produto atual a todas as páginas
  const handleApplyToAllPages = () => {
    if (!selectedProduct?.customStyle) return;
    const nextGlobalStyle: CampaignGlobalStyle = {
      ...(campaign.globalStyle || {}),
      pillBgColor: selectedProduct.customStyle.pillBgColor,
      pillTextColor: selectedProduct.customStyle.pillTextColor,
      validityBgColor: selectedProduct.customStyle.validityBgColor,
      validityTextColor: selectedProduct.customStyle.validityTextColor,
      stockBgColor: selectedProduct.customStyle.stockBgColor,
      stockTextColor: selectedProduct.customStyle.stockTextColor,
      boxBorderColor: selectedProduct.customStyle.boxBorderColor,
      boxBgColor: selectedProduct.customStyle.boxBgColor,
      nameColor: selectedProduct.customStyle.nameColor,
      nameFontSize: selectedProduct.customStyle.nameFontSize,
      nameFontWeight: selectedProduct.customStyle.nameFontWeight,
      nameAlign: selectedProduct.customStyle.nameAlign,
      headerColor: selectedProduct.customStyle.headerColor,
      headerFontSize: selectedProduct.customStyle.headerFontSize,
      headerFontWeight: selectedProduct.customStyle.headerFontWeight,
      headerAlign: selectedProduct.customStyle.headerAlign,
      priceFontSize: selectedProduct.customStyle.priceFontSize,
      priceFontWeight: selectedProduct.customStyle.priceFontWeight,
    };
    recordChange(products, { ...campaign, globalStyle: nextGlobalStyle });
  };

  // Restaurar padrão do produto selecionado
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

  // Mover produto na ordem (reordenar)
  const handleReorderProduct = (direction: "up" | "down") => {
    if (!selectedProductId) return;
    const currentIndex = products.findIndex((p) => p.id === selectedProductId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const newProducts = [...products];
    const [moved] = newProducts.splice(currentIndex, 1);
    newProducts.splice(targetIndex, 0, moved);
    recordChange(newProducts, campaign);
  };

  // Mover produto entre páginas (ex: pág 1 -> pág 2)
  const handleMoveToPage = (targetPage: number) => {
    if (!selectedProductId || targetPage < 1 || targetPage > totalPages || targetPage === activePage) return;
    const currentIdx = products.findIndex((p) => p.id === selectedProductId);
    if (currentIdx === -1) return;

    // Acha o índice do primeiro produto da página alvo
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

  // Atalhos de teclado: Ctrl+Z, Ctrl+Y e setas para microajuste do box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }

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
      } else if (selectedProductId) {
        // Setas do teclado para mover sutilmente a posição dentro do box
        const currentOffsetX = currentCustom.boxOffsetX || 0;
        const currentOffsetY = currentCustom.boxOffsetY || 0;

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          updateCustomStyle({ boxOffsetX: Math.max(-25, currentOffsetX - 2) });
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          updateCustomStyle({ boxOffsetX: Math.min(25, currentOffsetX + 2) });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          updateCustomStyle({ boxOffsetY: Math.max(-25, currentOffsetY - 2) });
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          updateCustomStyle({ boxOffsetY: Math.min(25, currentOffsetY + 2) });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, selectedProductId, currentCustom, updateCustomStyle]);

  // Alerta de fontes abaixo do mínimo legível
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

  return (
    <div
      data-testid="final-editor-container"
      className="flex flex-col h-[calc(100vh-140px)] min-h-[640px] bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden shadow-xs"
    >
      {/* BARRA SUPERIOR DA EDIÇÃO FINAL */}
      <header className="h-14 bg-white border-b px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToCampaign}
            className="text-xs font-semibold text-neutral-700"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar para Campanha
          </Button>
          <div className="h-4 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Edição Final & Diagramação
            </span>
            <span className="text-xs text-neutral-500">
              (Página {activePage} de {totalPages} · {flyerProducts.length} itens)
            </span>
          </div>
        </div>

        {/* CONTROLES DE HISTÓRICO (DESFAZER / REFAZER) E ZOOM */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg bg-neutral-50 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="h-8 px-2.5 text-xs text-neutral-700 disabled:opacity-40"
              title="Desfazer alteração (Ctrl+Z)"
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
              className="h-8 px-2.5 text-xs text-neutral-700 disabled:opacity-40"
              title="Refazer alteração (Ctrl+Y)"
              data-testid="redo-button"
            >
              <Redo2 className="h-3.5 w-3.5 mr-1" />
              Refazer
            </Button>
          </div>

          <div className="flex items-center border rounded-lg bg-neutral-50 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.05).toFixed(2))))}
              className="h-8 w-8 p-0"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-semibold px-2 text-neutral-700 select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(0.9, Number((z + 0.05).toFixed(2))))}
              className="h-8 w-8 p-0"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoFit}
              className="h-8 px-2 text-[11px] text-neutral-600 font-medium hover:text-neutral-900"
              title="Ajustar zoom automaticamente à tela"
            >
              Ajustar
            </Button>
          </div>

          <Button
            onClick={onProceedToExport}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
            data-testid="proceed-export-button"
          >
            Avançar para Exportação
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL EM 3 COLUNAS */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ================================================================= */}
        {/* COLUNA 1: MINIATURAS DAS PÁGINAS (ESQUERDA) */}
        {/* ================================================================= */}
        <aside
          data-testid="thumbnails-sidebar"
          className="w-44 lg:w-52 bg-white border-r flex flex-col shrink-0 overflow-hidden"
        >
          <div className="p-3 border-b bg-neutral-50/70 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Páginas ({totalPages})
            </span>
            <span className="text-[11px] text-neutral-500 font-medium">
              {flyerProducts.length} itens
            </span>
          </div>

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
                      ? "border-red-600 bg-red-50/60 ring-2 ring-red-500/20"
                      : "border-neutral-200 hover:bg-neutral-50 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isCurrent ? "text-red-700" : "text-neutral-900"
                      }`}
                    >
                      Página {pNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {itemsThisPage.length} {itemsThisPage.length === 1 ? "item" : "itens"}
                    </span>
                  </div>

                  {/* Representação visual simplificada da folha 9:16 */}
                  <div className="w-full aspect-[9/16] max-h-36 bg-neutral-800 rounded border border-neutral-300 relative overflow-hidden flex items-center justify-center shadow-2xs">
                    <img
                      src={
                        campaign.template916Image ||
                        "/templates/template-detona-precos-9-16.png"
                      }
                      alt={`Página ${pNumber}`}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-x-2 bottom-2 top-[35%] bg-[#F2F2F2] rounded-xs p-1 grid grid-cols-2 gap-0.5 pointer-events-none opacity-90">
                      {itemsThisPage.map((p, itemIdx) => (
                        <div
                          key={p.id || itemIdx}
                          className="bg-white rounded-[2px] border border-neutral-300 flex items-center justify-center p-0.5"
                        >
                          <div className="w-full h-1 bg-red-600 rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {customCount > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-purple-700 font-semibold mt-0.5">
                      <Sparkles className="h-3 w-3" />
                      <span>{customCount} customizado(s)</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ================================================================= */}
        {/* COLUNA 2: CANVAS INTERATIVO AMPLIADO (CENTRO) */}
        {/* ================================================================= */}
        <main
          data-testid="interactive-canvas"
          ref={mainRef}
          className="flex-1 min-w-0 bg-neutral-900 flex flex-col items-center justify-center relative overflow-auto p-4 sm:p-6"
        >
          {/* Alerta de Fontes Menores que o Mínimo */}
          {fontWarnings.length > 0 && (
            <div className="absolute top-4 left-6 right-6 z-30 bg-amber-500/95 border border-amber-600 text-black px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-black" />
                <span>Aviso de Legibilidade: {fontWarnings.join(" · ")}</span>
              </div>
            </div>
          )}

          {/* Canvas com StoryPage916 escalada proporcionalmente sem estourar dimensões de layout */}
          <div
            className="relative shrink-0 select-none my-auto transition-[width,height] duration-75"
            style={{
              width: `${Math.round(1080 * zoom)}px`,
              height: `${Math.round(1920 * zoom)}px`,
            }}
          >
            <div
              style={{
                width: "1080px",
                height: "1920px",
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              }}
              className="absolute top-0 left-0"
            >
              <StoryPage916
                pageNumber={activePage}
                totalPages={totalPages}
                products={pageProducts}
                store={store}
                campaign={campaign}
                domId={`story-page-editor-${activePage}`}
                selectedProductId={selectedProductId}
                onSelectProduct={(id) => setSelectedProductId(id)}
                isInteractive={true}
              />
            </div>
          </div>
        </main>

        {/* ================================================================= */}
        {/* COLUNA 3: PAINEL DE PROPRIEDADES (DIREITA) */}
        {/* ================================================================= */}
        <aside
          data-testid="properties-panel"
          className="w-80 lg:w-96 bg-white border-l flex flex-col shrink-0 overflow-hidden"
        >
          {selectedProduct ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* CABEÇALHO DO PRODUTO SELECIONADO */}
              <div className="p-3.5 border-b bg-neutral-50/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-mono font-bold bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-800 shrink-0">
                      {selectedProduct.code || "S/ CÓD"}
                    </span>
                    <h3
                      className="text-xs font-bold text-neutral-900 truncate"
                      title={selectedProduct.name}
                    >
                      {selectedProduct.name}
                    </h3>
                  </div>
                  {selectedProduct.customStyle && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Sparkles className="h-3 w-3" />
                      Editado
                    </span>
                  )}
                </div>

                {/* BOTÕES DE REORDENAÇÃO E MUDANÇA DE PÁGINA */}
                <div className="mt-2.5 flex items-center justify-between gap-1.5 pt-2 border-t border-neutral-200/60">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorderProduct("up")}
                      className="h-7 px-2 text-[11px]"
                      title="Mover card para antes"
                    >
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Antes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorderProduct("down")}
                      className="h-7 px-2 text-[11px]"
                      title="Mover card para depois"
                    >
                      <ArrowDown className="h-3 w-3 mr-1" />
                      Depois
                    </Button>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-neutral-500">Pág:</Label>
                      <select
                        value={activePage}
                        onChange={(e) => handleMoveToPage(Number(e.target.value))}
                        className="h-7 text-xs border rounded px-1.5 bg-white font-medium"
                      >
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <option key={`goto-${i + 1}`} value={i + 1}>
                            Pág. {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetProduct}
                    className="h-7 px-2 text-[11px] text-neutral-500 hover:text-red-600"
                    title="Restaurar padrão do layout deste produto"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Padrão
                  </Button>
                </div>
              </div>

              {/* SEÇÃO 1: EDIÇÃO RÁPIDA DE DADOS DO PRODUTO */}
              <div className="p-3.5 border-b space-y-2.5">
                <div className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-neutral-500" />
                  Valores do Produto
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] text-neutral-600">Nome do Produto</Label>
                    <Input
                      value={selectedProduct.name}
                      onChange={(e) => updateProductData("name", e.target.value)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-neutral-600">Código</Label>
                      <Input
                        value={selectedProduct.code || ""}
                        onChange={(e) => updateProductData("code", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-neutral-600">Embalagem</Label>
                      <Input
                        value={selectedProduct.packaging || ""}
                        onChange={(e) => updateProductData("packaging", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-neutral-600">Preço (R$)</Label>
                      <Input
                        value={selectedProduct.price || ""}
                        onChange={(e) => updateProductData("price", e.target.value)}
                        className="h-8 text-xs font-bold text-red-600"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-neutral-600">Unidade (UND/CX)</Label>
                      <Input
                        value={selectedProduct.unit || ""}
                        onChange={(e) => updateProductData("unit", e.target.value)}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-neutral-600">Validade</Label>
                      <Input
                        value={selectedProduct.validity || ""}
                        onChange={(e) => updateProductData("validity", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-neutral-600">Estoque</Label>
                      <Input
                        value={selectedProduct.stock || ""}
                        onChange={(e) => updateProductData("stock", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="ex: 15 UNID"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: ELEMENTO SELECIONADO & ESTILOS VISUAIS */}
              <div className="p-3.5 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-neutral-500" />
                    Estilo Visual
                  </span>

                  {/* ESCOPO DAS ALTERAÇÕES */}
                  <div className="flex items-center border rounded bg-neutral-100 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setScope("product")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                        scope === "product" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500"
                      }`}
                      title="Aplicar apenas a este produto"
                    >
                      Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("page")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                        scope === "page" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500"
                      }`}
                      title="Aplicar aos cards desta página"
                    >
                      Página
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("all")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                        scope === "all" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500"
                      }`}
                      title="Aplicar a todas as páginas da campanha"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                {/* SELETOR DE ELEMENTO DO BOX */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "pill", label: "Pílula" },
                    { id: "name", label: "Nome" },
                    { id: "header", label: "Código" },
                    { id: "validity", label: "Validade" },
                    { id: "stock", label: "Estoque" },
                    { id: "box", label: "Borda/Box" },
                    { id: "image", label: "Foto" },
                  ].map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => setActiveElement(el.id as TargetElement)}
                      className={`py-1 px-1.5 rounded text-[11px] font-bold border transition-colors ${
                        activeElement === el.id
                          ? "bg-red-600 text-white border-red-600 shadow-2xs"
                          : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      {el.label}
                    </button>
                  ))}
                </div>

                {/* PAINEL DE CORES (PALETA + CAMPO HEX) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-neutral-600 font-semibold">
                      Cor do Elemento ({activeElement})
                    </Label>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {activeElement === "pill"
                        ? currentCustom.pillBgColor || "#E30613"
                        : activeElement === "name"
                        ? currentCustom.nameColor || "#000000"
                        : activeElement === "header"
                        ? currentCustom.headerColor || "#000000"
                        : activeElement === "validity"
                        ? currentCustom.validityBgColor || "#000000"
                        : activeElement === "stock"
                        ? currentCustom.stockBgColor || "#000000"
                        : activeElement === "box"
                        ? currentCustom.boxBorderColor || "#D9D9D9"
                        : ""}
                    </span>
                  </div>

                  {/* Paleta oficial de 10 cores */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {TEMPLATE_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          if (activeElement === "pill") updateCustomStyle({ pillBgColor: c.hex });
                          else if (activeElement === "name") updateCustomStyle({ nameColor: c.hex });
                          else if (activeElement === "header") updateCustomStyle({ headerColor: c.hex });
                          else if (activeElement === "validity") updateCustomStyle({ validityBgColor: c.hex });
                          else if (activeElement === "stock") updateCustomStyle({ stockBgColor: c.hex });
                          else if (activeElement === "box") updateCustomStyle({ boxBorderColor: c.hex });
                        }}
                        style={{ backgroundColor: c.hex }}
                        className="h-6 rounded border border-neutral-300 shadow-2xs hover:scale-105 transition-transform"
                        title={`${c.name} (${c.hex})`}
                      />
                    ))}
                  </div>

                  {/* Campo Hex Manual */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-neutral-400 font-mono">#</span>
                    <Input
                      placeholder="Hex (ex: E30613)"
                      className="h-7 text-xs font-mono uppercase"
                      maxLength={7}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const hex = val.startsWith("#") ? val : `#${val}`;
                        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                          if (activeElement === "pill") updateCustomStyle({ pillBgColor: hex });
                          else if (activeElement === "name") updateCustomStyle({ nameColor: hex });
                          else if (activeElement === "header") updateCustomStyle({ headerColor: hex });
                          else if (activeElement === "validity") updateCustomStyle({ validityBgColor: hex });
                          else if (activeElement === "stock") updateCustomStyle({ stockBgColor: hex });
                          else if (activeElement === "box") updateCustomStyle({ boxBorderColor: hex });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* CONTROLES DE TIPOGRAFIA (SE ELEMENTO FOR TEXTO) */}
                {(activeElement === "name" || activeElement === "header" || activeElement === "pill") && (
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-neutral-600 font-semibold">
                        Tamanho da Fonte (px)
                      </Label>
                      <div className="flex items-center border rounded bg-neutral-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeElement === "name") {
                              const cur = currentCustom.nameFontSize || 32;
                              updateCustomStyle({ nameFontSize: Math.max(20, cur - 1) });
                            } else if (activeElement === "header") {
                              const cur = currentCustom.headerFontSize || 28;
                              updateCustomStyle({ headerFontSize: Math.max(18, cur - 1) });
                            } else if (activeElement === "pill") {
                              const cur = currentCustom.priceFontSize || 48;
                              updateCustomStyle({ priceFontSize: Math.max(28, cur - 2) });
                            }
                          }}
                          className="h-6 w-6 flex items-center justify-center text-xs font-bold hover:bg-neutral-200 rounded"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold px-2 text-neutral-800">
                          {activeElement === "name"
                            ? currentCustom.nameFontSize || 32
                            : activeElement === "header"
                            ? currentCustom.headerFontSize || 28
                            : currentCustom.priceFontSize || 48}
                          px
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeElement === "name") {
                              const cur = currentCustom.nameFontSize || 32;
                              updateCustomStyle({ nameFontSize: Math.min(54, cur + 1) });
                            } else if (activeElement === "header") {
                              const cur = currentCustom.headerFontSize || 28;
                              updateCustomStyle({ headerFontSize: Math.min(42, cur + 1) });
                            } else if (activeElement === "pill") {
                              const cur = currentCustom.priceFontSize || 48;
                              updateCustomStyle({ priceFontSize: Math.min(64, cur + 2) });
                            }
                          }}
                          className="h-6 w-6 flex items-center justify-center text-xs font-bold hover:bg-neutral-200 rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Aviso se tamanho ficar abaixo do mínimo legível */}
                    {activeElement === "name" && (currentCustom.nameFontSize || 32) < 24 && (
                      <p className="text-[10px] text-amber-700 font-bold bg-amber-50 p-1.5 rounded border border-amber-200">
                        ⚠️ Atenção: Tamanho abaixo do mínimo legível recomendado (24px).
                      </p>
                    )}

                    {/* PESO E ALINHAMENTO */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label className="text-[10px] text-neutral-500">Peso</Label>
                        <div className="flex border rounded bg-neutral-50 p-0.5 text-[11px]">
                          {(["normal", "semibold", "bold"] as const).map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => {
                                if (activeElement === "name") updateCustomStyle({ nameFontWeight: w });
                                else if (activeElement === "header") updateCustomStyle({ headerFontWeight: w });
                                else if (activeElement === "pill") updateCustomStyle({ priceFontWeight: w });
                              }}
                              className={`flex-1 py-0.5 rounded font-bold capitalize transition-colors ${
                                (activeElement === "name"
                                  ? currentCustom.nameFontWeight || "bold"
                                  : activeElement === "header"
                                  ? currentCustom.headerFontWeight || "bold"
                                  : currentCustom.priceFontWeight || "bold") === w
                                  ? "bg-white text-neutral-900 shadow-2xs"
                                  : "text-neutral-500"
                              }`}
                            >
                              {w === "normal" ? "Norm" : w === "semibold" ? "Semi" : "Bold"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-[10px] text-neutral-500">Alinhamento</Label>
                        <div className="flex border rounded bg-neutral-50 p-0.5 text-[11px]">
                          {(["left", "center", "right"] as const).map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => {
                                if (activeElement === "name") updateCustomStyle({ nameAlign: a });
                                else if (activeElement === "header") updateCustomStyle({ headerAlign: a });
                              }}
                              className={`flex-1 py-0.5 rounded font-bold capitalize transition-colors ${
                                (activeElement === "name"
                                  ? currentCustom.nameAlign || "center"
                                  : currentCustom.headerAlign || "center") === a
                                  ? "bg-white text-neutral-900 shadow-2xs"
                                  : "text-neutral-500"
                              }`}
                            >
                              {a === "left" ? "Esq" : a === "center" ? "Cent" : "Dir"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTROLES DE TAMANHO DA FOTO */}
                {activeElement === "image" && (
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-neutral-600 font-semibold">
                        Escala da Foto (Zoom Seguro)
                      </Label>
                      <span className="text-xs font-bold text-neutral-800">
                        {Math.round((currentCustom.imageScale ?? 1.0) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateCustomStyle({
                            imageScale: Math.max(0.5, Number(((currentCustom.imageScale ?? 1.0) - 0.05).toFixed(2))),
                          })
                        }
                        className="h-7 w-7 p-0"
                      >
                        −
                      </Button>
                      <input
                        type="range"
                        min="0.5"
                        max="1.3"
                        step="0.05"
                        value={currentCustom.imageScale ?? 1.0}
                        onChange={(e) => updateCustomStyle({ imageScale: parseFloat(e.target.value) })}
                        className="flex-1 accent-red-600"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateCustomStyle({
                            imageScale: Math.min(1.3, Number(((currentCustom.imageScale ?? 1.0) + 0.05).toFixed(2))),
                          })
                        }
                        className="h-7 w-7 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                {/* VISIBILIDADE DE ELEMENTOS */}
                <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                  <Label className="text-[11px] text-neutral-600 font-semibold block">
                    Mostrar ou Ocultar Elementos
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: "showCode", label: "Código", val: currentCustom.showCode !== false },
                      { key: "showName", label: "Nome", val: currentCustom.showName !== false },
                      { key: "showValidity", label: "Validade", val: currentCustom.showValidity !== false },
                      { key: "showStock", label: "Estoque", val: currentCustom.showStock !== false },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => updateCustomStyle({ [item.key]: !item.val })}
                        className={`flex items-center justify-between px-2 py-1 rounded text-[11px] font-semibold border ${
                          item.val ? "bg-neutral-50 text-neutral-800" : "bg-neutral-100 text-neutral-400 line-through"
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.val ? <Eye className="h-3 w-3 text-neutral-600" /> : <EyeOff className="h-3 w-3 text-neutral-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BOTÃO APLICAR A TODAS AS PÁGINAS */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyToAllPages}
                    className="w-full text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100"
                  >
                    <Layers className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                    Aplicar estilo a todas as páginas
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
              <Move className="h-10 w-10 stroke-1" />
              <p className="text-xs font-medium">
                Selecione um produto no encarte para personalizar seu estilo visual ou editar seus dados.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* BARRA DE STATUS / ATALHOS INFERIOR (FORA DO CANVAS, NUNCA SOBREPÕE OS PRODUTOS) */}
      <footer className="h-8 bg-neutral-900 border-t border-neutral-800 px-4 flex items-center justify-between text-[11px] text-neutral-400 shrink-0 z-20 select-none">
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-amber-400">💡</span> Clique em um produto para selecioná-lo. Use as setas do teclado para mover sutilmente dentro do box.
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span>
            Desfazer: <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded text-white font-mono text-[10px] border border-neutral-700">Ctrl+Z</kbd>
          </span>
          <span>
            Refazer: <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded text-white font-mono text-[10px] border border-neutral-700">Ctrl+Y</kbd>
          </span>
        </div>
      </footer>
    </div>
  );
};
