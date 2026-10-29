import React from "react";
import type { EncarteProduct, StoreConfig, CampaignConfig } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { EncarteHeader } from "./EncarteHeader";
import { EncarteFooter } from "./EncarteFooter";
import { ProductCardA4 } from "./ProductCardA4";

interface A4PageProps {
  pageNumber: number;
  totalPages: number;
  products: EncarteProduct[];
  store: StoreConfig;
  campaign: CampaignConfig;
  domId?: string;
  totalProductsCount?: number;
}

export const A4Page: React.FC<A4PageProps> = ({
  pageNumber,
  totalPages,
  products,
  store,
  campaign,
  domId,
}) => {
  const isLastPage = pageNumber === totalPages;
  const count = products.length;
  const perPage = campaign.productsPerPage || 12;

  const darkBg = store.darkColor || DESIGN_TOKENS.colors.dark;

  // Determinar se o layout padrão dos cards é vertical (3 colunas para 12 e 9) ou horizontal (2 colunas para 8 e 6)
  const isThreeCols = perPage === 12 || perPage === 9;
  const defaultCardLayout: "vertical" | "horizontal" = isThreeCols ? "vertical" : "horizontal";
  const numCols = isThreeCols ? 3 : 2;
  const numRows = perPage === 12 || perPage === 8 ? 4 : 3;

  const gapTable = {
    12: {
      gapXClass: "gap-2",
      gapYClass: "gap-2",
      cardWidthStyle: "calc((100% - 16px) / 3)",
      rowHeightStyle: "calc((100% - 24px) / 4)",
    },
    10: {
      gapXClass: "gap-2",
      gapYClass: "gap-2",
      cardWidthStyle: "calc((100% - 10px) / 2)",
      rowHeightStyle: "calc((100% - 32px) / 5)",
    },
    9: {
      gapXClass: "gap-2.5",
      gapYClass: "gap-2.5",
      cardWidthStyle: "calc((100% - 20px) / 3)",
      rowHeightStyle: "calc((100% - 20px) / 3)",
    },
    8: {
      gapXClass: "gap-2.5",
      gapYClass: "gap-2.5",
      cardWidthStyle: "calc((100% - 10px) / 2)",
      rowHeightStyle: "calc((100% - 30px) / 4)",
    },
    6: {
      gapXClass: "gap-3.5",
      gapYClass: "gap-3.5",
      cardWidthStyle: "calc((100% - 14px) / 2)",
      rowHeightStyle: "calc((100% - 28px) / 3)",
    },
  };
  const gapConfig = gapTable[perPage as keyof typeof gapTable] || gapTable[12];

  const rows: EncarteProduct[][] = [];
  for (let i = 0; i < count; i += numCols) {
    rows.push(products.slice(i, i + numCols));
  }

  return (
    <div
      id={domId}
      className="flyer-page-print relative flex flex-col justify-between text-white overflow-hidden shadow-2xl select-none"
      style={{
        width: `${DESIGN_TOKENS.geometry.screenPreviewWidthPx}px`,
        height: `${DESIGN_TOKENS.geometry.screenPreviewHeightPx}px`,
        backgroundColor: darkBg,
        boxSizing: "border-box",
        padding: "0",
      }}
    >
      {/* 1. CABEÇALHO UNIFICADO (repetido em todas as páginas, no mesmo tamanho) */}
      <EncarteHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        store={store}
        campaign={campaign}
        isLastPage={isLastPage}
      />

      {/* 2. CORPO DO ENCARTE (adapta-se conforme produtos por página e regras da última página) */}
      <main
        className="flex-1 flex flex-col justify-center px-3 py-2 overflow-hidden"
        style={{
          backgroundColor: darkBg,
          margin: "0",
        }}
      >
        {/* Caso 1: Última página com um único produto: ocupa a página inteira, centralizado (Hero Card) */}
        {isLastPage && count === 1 && products[0] ? (
          <div className="flex-1 flex items-center justify-center p-2 h-full w-full">
            <ProductCardA4
              product={products[0]}
              index={0}
              store={store}
              layoutMode="hero"
            />
          </div>
        ) : (
          /* Caso 2: Linhas completas e linhas incompletas centralizadas na horizontal */
          <div
            data-testid="product-grid-container"
            className={`w-full h-full flex flex-col justify-center ${gapConfig.gapYClass} p-0.5`}
          >
            {rows.map((row, rowIdx) => {
              const isFullRow = row.length === numCols;

              if (isFullRow) {
                return (
                  <div
                    key={`row-${rowIdx}`}
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
                        <ProductCardA4
                          product={prod}
                          index={rowIdx * numCols + colIdx}
                          store={store}
                          layoutMode={defaultCardLayout}
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
                      <ProductCardA4
                        product={prod}
                        index={rowIdx * numCols + colIdx}
                        store={store}
                        layoutMode={defaultCardLayout}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 3. RODAPÉ UNIFICADO (repetido em todas as páginas, no mesmo tamanho) */}
      <EncarteFooter
        store={store}
        pageNumber={pageNumber}
        totalPages={totalPages}
        isLastPage={isLastPage}
      />
    </div>
  );
};
