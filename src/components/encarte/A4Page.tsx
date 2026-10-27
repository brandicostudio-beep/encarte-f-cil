import React from "react";
import type { EncarteProduct, StoreConfig, CampaignConfig } from "@/types/encarte";
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
}

export const A4Page: React.FC<A4PageProps> = ({
  pageNumber,
  totalPages,
  products,
  store,
  campaign,
  domId,
}) => {
  const isFirstPage = pageNumber === 1;

  // Grade sempre com até 8 produtos por página (2 colunas x 4 linhas)
  const displayProducts = products.slice(0, 8);

  return (
    <div
      id={domId}
      className="flyer-page-print relative flex flex-col justify-between bg-black text-white overflow-hidden shadow-2xl select-none"
      style={{
        width: "794px",
        height: "1123px",
        backgroundColor: store.darkColor || "#0a0a0a",
      }}
    >
      {/* Cabeçalho */}
      <EncarteHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        store={store}
        campaign={campaign}
      />

      {/* Corpo com fundo preto: Grade 2 colunas x 4 linhas (8 produtos) */}
      <main
        className={`flex-1 grid grid-cols-2 grid-rows-4 gap-2.5 px-3 py-2 bg-black overflow-hidden`}
        style={{ backgroundColor: store.darkColor || "#0a0a0a" }}
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

        {/* Se a página tiver menos de 8 produtos, preenche slots vazios mantendo o layout limpo */}
        {displayProducts.length < 8 &&
          Array.from({ length: 8 - displayProducts.length }).map((_, emptyIdx) => (
            <div
              key={`empty-${emptyIdx}`}
              className="flex items-center justify-center rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-center text-xs text-neutral-600"
            >
              Espaço reservado
            </div>
          ))}
      </main>

      {/* Rodapé com logo, endereço, telefone e nota legal */}
      <EncarteFooter store={store} />
    </div>
  );
};
