import React from "react";
import type { ColecaoProduct, ColecaoConfig } from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import { calculateGridCellPositions } from "@/lib/colecoes-layout";
import { ColecaoCard } from "./ColecaoCard";

interface ColecoesPageProps {
  products: ColecaoProduct[];
  pageIndex: number;
  totalPages: number;
  config?: ColecaoConfig;
  className?: string;
  style?: React.CSSProperties;
  onEditProduct?: (product: ColecaoProduct) => void;
}

export const ColecoesPage: React.FC<ColecoesPageProps> = ({
  products,
  pageIndex,
  totalPages,
  config = DEFAULT_COLECAO_CONFIG,
  className = "",
  style = {},
  onEditProduct,
}) => {
  const gridCells = calculateGridCellPositions(config.gridArea);

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
        className="absolute"
        style={{
          left: `${config.gridArea.xStart}px`,
          top: `${config.gridArea.yStart}px`,
          width: `${config.gridArea.xEnd - config.gridArea.xStart}px`,
          height: `${config.gridArea.yEnd - config.gridArea.yStart}px`,
        }}
      >
        {products.map((product, idx) => {
          const cell = gridCells[idx];
          if (!cell) return null;

          // Posição relativa dentro da área da grade
          const relativeX = cell.x - config.gridArea.xStart;
          const relativeY = cell.y - config.gridArea.yStart;

          return (
            <div
              key={product.id || `${product.code}-${idx}`}
              className="absolute"
              style={{
                left: `${relativeX}px`,
                top: `${relativeY}px`,
                width: `${cell.width}px`,
                height: `${cell.height}px`,
              }}
            >
              <ColecaoCard
                product={product}
                width={cell.width}
                height={cell.height}
                onEdit={onEditProduct ? () => onEditProduct(product) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* 3. INDICADOR DISCRETO DE PÁGINA (Rodapé se houver múltiplas páginas) */}
      {totalPages > 1 && (
        <div className="absolute bottom-3 right-6 z-10 text-[13px] font-bold text-white/60 tracking-wider">
          PÁGINA {pageIndex + 1} DE {totalPages}
        </div>
      )}
    </div>
  );
};
