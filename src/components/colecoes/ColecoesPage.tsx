import React from "react";
import type { ColecaoProduct, ColecaoConfig } from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import { calculateGridCellPositions } from "@/lib/colecoes-layout";
import { ColecaoCard } from "./ColecaoCard";
import { TransformBoundingBox } from "@/components/encarte/editor/TransformBoundingBox";

export interface CustomItemLayout {
  x: number;
  y: number;
  width: number;
  height: number;
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
  const cellSpacing = config.cellSpacing || 0;

  const gridCells = calculateGridCellPositions(
    config.gridArea,
    cols,
    rows,
    cellSpacing
  );

  const stackOrder = config.stackOrder || "right-in-front";

  // Encontra item e bounding box selecionados na página atual
  const selectedIndex = products.findIndex((p) => p.id === selectedProductId);
  const selectedProduct = selectedIndex >= 0 ? products[selectedIndex] : null;
  const selectedCell = selectedIndex >= 0 ? gridCells[selectedIndex] : null;
  const selectedCustom = selectedProduct ? customLayouts[selectedProduct.id] : null;

  let selectedBox = null;
  if (selectedProduct && selectedCell) {
    const defaultX = selectedCell.x - config.gridArea.xStart;
    const defaultY = selectedCell.y - config.gridArea.yStart;
    const defaultW = selectedCell.width;
    const defaultH = selectedCell.height;

    selectedBox = {
      x: selectedCustom?.manuallyMoved ? selectedCustom.x : defaultX,
      y: selectedCustom?.manuallyMoved ? selectedCustom.y : defaultY,
      width: selectedCustom?.manuallyMoved ? selectedCustom.width : defaultW,
      height: selectedCustom?.manuallyMoved ? selectedCustom.height : defaultH,
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
          const cell = gridCells[idx];
          if (!cell) return null;

          const custom = customLayouts[product.id];
          if (custom?.isHidden) return null;

          // Posição padrão da grade ou posição personalizada
          const defaultX = cell.x - config.gridArea.xStart;
          const defaultY = cell.y - config.gridArea.yStart;
          const defaultW = cell.width;
          const defaultH = cell.height;

          const posX = custom?.manuallyMoved ? custom.x : defaultX;
          const posY = custom?.manuallyMoved ? custom.y : defaultY;
          const posW = custom?.manuallyMoved ? custom.width : defaultW;
          const posH = custom?.manuallyMoved ? custom.height : defaultH;
          const rotation = custom?.rotation || 0;

          // Ordem de empilhamento z-index
          const defaultZIndex =
            stackOrder === "left-in-front"
              ? (rows - cell.rowIndex) * 10 + (cols - cell.colIndex)
              : cell.rowIndex * 10 + cell.colIndex + 1;

          const zIndex = custom?.zIndex ?? defaultZIndex;

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
                  if (!custom?.isLocked) {
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
                productScale={config.productScale || 130}
                overlapAmount={config.overlapAmount || 15}
                stackOrder={stackOrder}
                showDottedLines={config.showDottedLines !== false}
                isLastCol={cell.colIndex === cols - 1}
                isLastRow={cell.rowIndex === rows - 1}
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
