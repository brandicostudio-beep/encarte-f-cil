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

  // Classes de grade conforme produtos por página
  const getGridClasses = () => {
    switch (perPage) {
      case 6:
        return "grid-cols-2 grid-rows-3 gap-3.5";
      case 8:
        return "grid-cols-2 grid-rows-4 gap-2.5";
      case 9:
        return "grid-cols-3 grid-rows-3 gap-2.5";
      case 12:
      default:
        return "grid-cols-3 grid-rows-4 gap-2";
    }
  };

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
        {isLastPage && count === 1 ? (
          <div className="flex-1 flex items-center justify-center p-2 h-full w-full">
            <ProductCardA4
              product={products[0]}
              index={0}
              store={store}
              layoutMode="hero"
            />
          </div>
        ) : isLastPage && count > 1 && count < perPage ? (
          /* Caso 2: Última página com de 2 até (por página - 1) produtos:
             manter a grade, centralizar os cards no corpo da página e aumentá-los até preencher a área disponível */
          <div
            className={`w-full h-full grid ${
              isThreeCols
                ? count <= 3
                  ? "grid-cols-3 grid-rows-1"
                  : count <= 6
                  ? "grid-cols-3 grid-rows-2"
                  : count <= 9
                  ? "grid-cols-3 grid-rows-3"
                  : "grid-cols-3 grid-rows-4"
                : count <= 2
                ? "grid-cols-2 grid-rows-1"
                : count <= 4
                ? "grid-cols-2 grid-rows-2"
                : count <= 6
                ? "grid-cols-2 grid-rows-3"
                : "grid-cols-2 grid-rows-4"
            } ${isThreeCols ? "gap-2.5" : "gap-3"} items-center justify-center p-1`}
          >
            {products.map((prod, idx) => (
              <div key={prod.id || `${pageNumber}-${idx}`} className="w-full h-full flex items-center justify-center">
                <ProductCardA4
                  product={prod}
                  index={idx}
                  store={store}
                  layoutMode={defaultCardLayout}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Caso 3: Página regular cheia */
          <div className={`w-full h-full grid ${getGridClasses()} p-0.5`}>
            {products.map((prod, idx) => (
              <ProductCardA4
                key={prod.id || `${pageNumber}-${idx}`}
                product={prod}
                index={idx}
                store={store}
                layoutMode={defaultCardLayout}
              />
            ))}
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
