import React from "react";
import type { EncarteProduct, StoreConfig, CampaignConfig } from "@/types/encarte";
import { DEFAULT_TEMPLATE_9_16_AREA } from "@/types/encarte";
import { ProductCard916 } from "./ProductCard916";

interface StoryPage916Props {
  pageNumber: number;
  totalPages: number;
  products: EncarteProduct[];
  store: StoreConfig;
  campaign: CampaignConfig;
  domId?: string;
}

/**
 * Encarte em formato Story 9:16 (1080 × 1920 px) utilizando o template PNG/JPG como fundo integral.
 * Os produtos são dispostos estritamente dentro da área branca definida pelas coordenadas do template.
 */
export const StoryPage916: React.FC<StoryPage916Props> = ({
  pageNumber,
  totalPages,
  products,
  store,
  campaign,
  domId,
}) => {
  const isLastPage = pageNumber === totalPages;
  const count = (products || []).length;
  const perPage = campaign?.productsPerPage || 12;

  const area = campaign?.template916Area || DEFAULT_TEMPLATE_9_16_AREA;
  const canvasWidth = area?.canvasWidth || 1080;
  const canvasHeight = area?.canvasHeight || 1920;

  const safeX = typeof area?.x === "number" ? area.x : DEFAULT_TEMPLATE_9_16_AREA.x;
  const safeY = typeof area?.y === "number" ? area.y : DEFAULT_TEMPLATE_9_16_AREA.y;
  const safeW = typeof area?.width === "number" ? area.width : DEFAULT_TEMPLATE_9_16_AREA.width;
  const safeH = typeof area?.height === "number" ? area.height : DEFAULT_TEMPLATE_9_16_AREA.height;

  // Coordenadas percentuais para garantir escala perfeita em qualquer resolução
  const leftPct = (safeX / canvasWidth) * 100;
  const topPct = (safeY / canvasHeight) * 100;
  const widthPct = (safeW / canvasWidth) * 100;
  const heightPct = (safeH / canvasHeight) * 100;

  // Determinar número de colunas e linhas padrão da grade
  const isThreeCols = perPage === 12 || perPage === 9;
  const numCols = isThreeCols ? 3 : 2;
  const numRows = perPage === 12 || perPage === 8 ? 4 : 3;

  const gapConfig = {
    12: {
      gapXClass: "gap-2.5",
      gapYClass: "gap-2.5",
      cardWidthStyle: "calc((100% - 20px) / 3)",
      rowHeightStyle: "calc((100% - 30px) / 4)",
    },
    9: {
      gapXClass: "gap-3",
      gapYClass: "gap-3",
      cardWidthStyle: "calc((100% - 24px) / 3)",
      rowHeightStyle: "calc((100% - 24px) / 3)",
    },
    8: {
      gapXClass: "gap-3",
      gapYClass: "gap-3",
      cardWidthStyle: "calc((100% - 12px) / 2)",
      rowHeightStyle: "calc((100% - 36px) / 4)",
    },
    6: {
      gapXClass: "gap-4",
      gapYClass: "gap-4",
      cardWidthStyle: "calc((100% - 16px) / 2)",
      rowHeightStyle: "calc((100% - 32px) / 3)",
    },
  }[perPage || 12];

  // Particiona a lista de produtos em linhas
  const rows: EncarteProduct[][] = [];
  for (let i = 0; i < count; i += numCols) {
    rows.push(products.slice(i, i + numCols));
  }

  return (
    <div
      id={domId}
      data-testid="story-916-page"
      className="relative overflow-hidden select-none shadow-2xl bg-black"
      style={{
        width: "1080px",
        height: "1920px",
        boxSizing: "border-box",
      }}
    >
      {/* 1. FUNDO: Template PNG/JPG completo, usado sem alterações */}
      <img
        src={
          campaign.template916Image ||
          "/templates/template-detona-precos-9-16.png"
        }
        alt="Template Encarte 9:16"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* 2. ÁREA BRANCA DOS PRODUTOS
          Garantia absoluta: overflow-hidden e border-radius evitam qualquer vazamento para fora da área branca */}
      <div
        data-testid="product-white-area"
        className="absolute overflow-hidden rounded-[36px] flex flex-col justify-center p-3 z-10"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          boxSizing: "border-box",
        }}
      >
        {/* Caso A: Última página com 1 único produto (Hero Card centralizado e aumentado preenchendo o espaço) */}
        {isLastPage && count === 1 ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <ProductCard916
              product={products[0]}
              index={0}
              store={store}
              layoutMode="hero"
              perPage={perPage}
            />
          </div>
        ) : (
          /* Caso B: Grade com linhas completas e linhas incompletas rigorosamente centralizadas na horizontal */
          <div
            data-testid="product-grid-container"
            className={`w-full h-full flex flex-col justify-center ${gapConfig.gapYClass} p-1`}
          >
            {rows.map((row, rowIdx) => {
              const isFullRow = row.length === numCols;

              if (isFullRow) {
                return (
                  <div
                    key={`row-${rowIdx}`}
                    data-testid={`grid-row-${rowIdx}`}
                    style={{ height: gapConfig.rowHeightStyle }}
                    className={`w-full grid ${
                      numCols === 3 ? "grid-cols-3" : "grid-cols-2"
                    } ${gapConfig.gapXClass} shrink-0 items-center`}
                  >
                    {row.map((prod, colIdx) => (
                      <div
                        key={prod.id || `${pageNumber}-${rowIdx * numCols + colIdx}`}
                        className="w-full h-full flex items-center justify-center"
                      >
                        <ProductCard916
                          product={prod}
                          index={rowIdx * numCols + colIdx}
                          store={store}
                          perPage={perPage}
                        />
                      </div>
                    ))}
                  </div>
                );
              }

              // Linha incompleta: Centralizada horizontalmente com o mesmo tamanho dos demais cards
              return (
                <div
                  key={`row-${rowIdx}`}
                  data-testid="incomplete-row-centered"
                  style={{ height: gapConfig.rowHeightStyle }}
                  className={`w-full flex justify-center items-center ${gapConfig.gapXClass} shrink-0`}
                >
                  {row.map((prod, colIdx) => (
                    <div
                      key={prod.id || `${pageNumber}-${rowIdx * numCols + colIdx}`}
                      style={{ width: gapConfig.cardWidthStyle }}
                      className="h-full flex items-center justify-center"
                    >
                      <ProductCard916
                        product={prod}
                        index={rowIdx * numCols + colIdx}
                        store={store}
                        perPage={perPage}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
