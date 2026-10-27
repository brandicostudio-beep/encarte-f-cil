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
  totalProductsCount,
}) => {
  const isFirstPage = pageNumber === 1;
  const isLastPage = pageNumber === totalPages && totalPages > 1;

  // Grade modular: sempre até 8 produtos por página (2 colunas x 4 linhas)
  const displayProducts = products.slice(0, 8);
  const darkBg = store.darkColor || DESIGN_TOKENS.colors.dark;

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
      {/* 1. Cabeçalho (Primeira Página ~25% ou Compacto nas seguintes) */}
      <EncarteHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        store={store}
        campaign={campaign}
        isLastPage={isLastPage}
      />

      {/* 2. Corpo do Encarte: Margem de segurança de 5mm, grade modular de 2x4 = 8 produtos */}
      <main
        className="flex-1 grid grid-cols-2 grid-rows-4 gap-2.5 px-3 py-2 overflow-hidden"
        style={{
          backgroundColor: darkBg,
          margin: "0",
        }}
      >
        {displayProducts.map((prod, idx) => (
          <ProductCardA4
            key={prod.id || `${pageNumber}-${idx}`}
            product={prod}
            index={idx}
            store={store}
            isCompactPage={!isFirstPage}
          />
        ))}

        {/* Preenchimento de slots vazios mantendo a grade equilibrada */}
        {displayProducts.length < 8 &&
          Array.from({ length: 8 - displayProducts.length }).map((_, emptyIdx) => (
            <div
              key={`empty-${emptyIdx}`}
              className="flex items-center justify-center rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-900/50 p-4 text-center text-xs text-neutral-600"
            >
              Espaço reservado
            </div>
          ))}
      </main>

      {/* 3. Rodapé (Padrão ou Última Página Expandida com Resumo Institucional) */}
      <EncarteFooter
        store={store}
        isLastPage={isLastPage}
        totalProductsCount={totalProductsCount}
      />
    </div>
  );
};
