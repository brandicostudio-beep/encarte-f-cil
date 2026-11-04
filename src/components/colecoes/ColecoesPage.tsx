import React from "react";
import type {
  ColecaoProduct,
  ColecaoConfig,
  ColecaoGridSettings,
  Rect,
  ColecaoElement,
} from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import { calculateGridCellPositions, getCellRects, zIndexFor } from "@/lib/colecoes-layout";
import { ColecaoCard } from "./ColecaoCard";
import { TransformBoundingBox } from "@/components/encarte/editor/TransformBoundingBox";

export type { ColecaoElement };

export interface CustomItemLayout extends Partial<ColecaoElement> {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  isLocked?: boolean;
  isHidden?: boolean;
  manuallyMoved?: boolean;
}

interface ColecoesPageProps {
  products: ColecaoProduct[];
  pageIndex: number;
  totalPages: number;
  config?: ColecaoConfig;
  className?: string;
  style?: React.CSSProperties;
  customLayouts?: Record<string, CustomItemLayout>;
  selectedProductId?: string | null;
  onSelectProduct?: (productId: string | null) => void;
  onEditProduct?: (product: ColecaoProduct) => void;
  interactive?: boolean;
  previewZoom?: number;
  onTransformBox?: (productId: string, newBox: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onTransformEnd?: () => void;
  onStartDrag?: (
    productId: string,
    e: React.PointerEvent,
    initialBox: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => void;
}

export const ColecoesPage: React.FC<ColecoesPageProps> = ({
  products,
  pageIndex,
  totalPages,
  config = DEFAULT_COLECAO_CONFIG,
  className = "",
  style = {},
  customLayouts = {},
  selectedProductId = null,
  onSelectProduct,
  onEditProduct,
  interactive = false,
  previewZoom = 1,
  onTransformBox,
  onTransformEnd,
  onStartDrag,
}) => {
  const cols = config.columnsCount || 4;
  const rows = config.rowsCount || 5;
  const gapX = config.gapX ?? config.cellSpacing ?? 0;
  const gapY = config.gapY ?? config.cellSpacing ?? 0;
  const frontSide = config.frontSide || (config.stackOrder === "left-in-front" ? "left" : "right");
  const showDividers = config.showDividers ?? (config.showDottedLines !== false);

  const gridSettings: ColecaoGridSettings = {
    columns: cols,
    rows: rows,
    perPage: config.itemsPerPage || cols * rows,
    gapX,
    gapY,
    productScale: config.productScale
      ? (config.productScale > 10 ? config.productScale / 100 : config.productScale)
      : 1.3,
    frontSide,
    showDividers,
    footerText: config.footerText || "",
  };

  const area = {
    x: config.gridArea.xStart,
    y: config.gridArea.yStart,
    width: config.gridArea.xEnd - config.gridArea.xStart,
    height: config.gridArea.yEnd - config.gridArea.yStart,
  };

  const gridRects = getCellRects(gridSettings, area);

  // Encontra item e bounding box selecionados na página atual
  const selectedIndex = products.findIndex((p) => p.id === selectedProductId);
  const selectedProduct = selectedIndex >= 0 ? products[selectedIndex] : null;
  const selectedRect = selectedIndex >= 0 ? gridRects[selectedIndex] : null;
  const selectedCustom = selectedProduct ? customLayouts[selectedProduct.id] : null;

  let selectedBox = null;
  if (selectedProduct && selectedRect) {
    const defaultX = selectedRect.x - config.gridArea.xStart;
    const defaultY = selectedRect.y - config.gridArea.yStart;
    const defaultW = selectedRect.w;
    const defaultH = selectedRect.h;

    const isManual = selectedCustom?.manual ?? selectedCustom?.manuallyMoved ?? false;

    selectedBox = {
      x: isManual ? selectedCustom!.x : defaultX,
      y: isManual ? selectedCustom!.y : defaultY,
      width: isManual ? (selectedCustom!.w ?? selectedCustom!.width ?? defaultW) : defaultW,
      height: isManual ? (selectedCustom!.h ?? selectedCustom!.height ?? defaultH) : defaultH,
      rotation: selectedCustom?.rotation || 0,
    };
  }

  return (
    <div
      className={`relative overflow-hidden bg-black select-none ${className}`}
      style={{
        width: "1080px",
        height: "1920px",
        minWidth: "1080px",
        minHeight: "1920px",
        ...style,
      }}
      data-page-index={pageIndex}
      data-testid={`colecoes-page-${pageIndex + 1}`}
      onClick={(e) => {
        if (interactive && onSelectProduct && e.target === e.currentTarget) {
          onSelectProduct(null);
        }
      }}
    >
      {/* 1. IMAGEM DE FUNDO DO TEMPLATE (Esquenta Black Cescom) */}
      <img
        src={config.templateImage || "/templates/template-esquenta-black-cescom.png"}
        alt="Template Esquenta Black Cescom"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* 2. ÁREA DA GRADE DENTRO DA CAIXA VERMELHA (y=475 a y=1850) */}
      <div
        className="absolute overflow-visible"
        style={{
          left: `${config.gridArea.xStart}px`,
          top: `${config.gridArea.yStart}px`,
          width: `${config.gridArea.xEnd - config.gridArea.xStart}px`,
          height: `${config.gridArea.yEnd - config.gridArea.yStart}px`,
        }}
        onClick={(e) => {
          if (interactive && onSelectProduct && e.target === e.currentTarget) {
            onSelectProduct(null);
          }
        }}
      >
        {products.map((product, idx) => {
          const rect = gridRects[idx];
          if (!rect) return null;

          const custom = customLayouts[product.id];
          const isHidden = custom?.hidden ?? custom?.isHidden ?? false;
          if (isHidden) return null;

          // Posição padrão da grade ou posição personalizada
          const defaultX = rect.x - config.gridArea.xStart;
          const defaultY = rect.y - config.gridArea.yStart;
          const defaultW = rect.w;
          const defaultH = rect.h;

          const isManual = custom?.manual ?? custom?.manuallyMoved ?? false;
          const posX = isManual ? custom!.x : defaultX;
          const posY = isManual ? custom!.y : defaultY;
          const posW = isManual ? (custom!.w ?? custom!.width ?? defaultW) : defaultW;
          const posH = isManual ? (custom!.h ?? custom!.height ?? defaultH) : defaultH;
          const rotation = custom?.rotation || 0;

          // Ordem de empilhamento z-index
          const defaultZIndex = zIndexFor(rect.col, gridSettings);
          const zIndex = custom?.z ?? custom?.zIndex ?? defaultZIndex;
          const isLocked = custom?.locked ?? custom?.isLocked ?? false;

          const isSelected = selectedProductId === product.id;

          return (
            <div
              key={product.id || `${product.code}-${idx}`}
              className={`absolute overflow-visible transition-shadow ${
                isSelected ? "ring-2 ring-amber-400 ring-offset-2 rounded-lg" : ""
              } ${interactive ? "cursor-pointer" : ""}`}
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
                width: `${posW}px`,
                height: `${posH}px`,
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                zIndex,
              }}
              onPointerDown={(e) => {
                if (interactive && onStartDrag) {
                  onSelectProduct?.(product.id);
                  if (!isLocked) {
                    onStartDrag(product.id, e, {
                      x: posX,
                      y: posY,
                      width: posW,
                      height: posH,
                      rotation,
                    });
                  }
                }
              }}
              onClick={(e) => {
                if (interactive && onSelectProduct) {
                  e.stopPropagation();
                  onSelectProduct(product.id);
                }
              }}
            >
              <ColecaoCard
                product={product}
                width={posW}
                height={posH}
                productScale={gridSettings.productScale}
                overlapAmount={config.overlapAmount || 15}
                stackOrder={gridSettings.frontSide === "left" ? "left-in-front" : "right-in-front"}
                showDottedLines={gridSettings.showDividers}
                isLastCol={rect.col === cols - 1}
                isLastRow={rect.row === rows - 1}
                zIndex={zIndex}
                onEdit={onEditProduct ? () => onEditProduct(product) : undefined}
              />
            </div>
          );
        })}

        {/* 2.1 Bounding Box estilo Canva com 8 alças e rotação */}
        {interactive && selectedProduct && selectedBox && (
          <TransformBoundingBox
            box={{
              x: selectedBox.x,
              y: selectedBox.y,
              width: selectedBox.width,
              height: selectedBox.height,
              rotation: selectedBox.rotation,
            }}
            zoom={previewZoom}
            allowRotation={true}
            isLocked={selectedCustom?.isLocked}
            onTransform={(newBox) => {
              onTransformBox?.(selectedProduct.id, newBox);
            }}
            onTransformEnd={() => {
              onTransformEnd?.();
            }}
          />
        )}
      </div>

      {/* 3. RODAPÉ DE OFERTA REPETIDO EM TODAS AS PÁGINAS (EDITÁVEL) */}
      <div
        className="absolute bottom-4 left-0 right-0 text-center text-white font-black text-[12px] leading-tight tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] whitespace-pre-line pointer-events-none px-6"
        data-testid="colecoes-footer-text"
      >
        {config.footerText ||
          "OFERTA VÁLIDA DO DIA 02/11 AO DIA 07/11\nOU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS."}
      </div>

      {/* 4. INDICADOR DISCRETO DE PÁGINA */}
      {totalPages > 1 && (
        <div className="absolute bottom-2 right-5 z-20 text-[11px] font-bold text-white/70 tracking-wider">
          PÁGINA {pageIndex + 1} DE {totalPages}
        </div>
      )}
    </div>
  );
};
