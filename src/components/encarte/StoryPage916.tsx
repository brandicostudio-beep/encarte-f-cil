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
  const count = products.length;
  const perPage = campaign.productsPerPage || 12;

  const area = campaign.template916Area || DEFAULT_TEMPLATE_9_16_AREA;
  const canvasWidth = area.canvasWidth || 1080;
  const canvasHeight = area.canvasHeight || 1920;

  // Coordenadas percentuais para garantir escala perfeita em qualquer resolução
  const leftPct = (area.x / canvasWidth) * 100;
  const topPct = (area.y / canvasHeight) * 100;
  const widthPct = (area.width / canvasWidth) * 100;
  const heightPct = (area.height / canvasHeight) * 100;

  // Determinar número de colunas padrão da grade
  const isThreeCols = perPage === 12 || perPage === 9;

  // Grade CSS baseada no número de produtos por página
  const getGridClasses = () => {
    switch (perPage) {
      case 6:
        return "grid-cols-2 grid-rows-3 gap-4";
      case 8:
        return "grid-cols-2 grid-rows-4 gap-3";
      case 9:
        return "grid-cols-3 grid-rows-3 gap-3";
      case 12:
      default:
        return "grid-cols-3 grid-rows-4 gap-2.5";
    }
  };

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
            />
          </div>
        ) : isLastPage && count > 1 && count < perPage ? (
          /* Caso B: Última página com sobra de 2 até (perPage - 1) produtos
             Centraliza e aumenta os cards para preencher o espaço harmoniosamente */
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
            } ${isThreeCols ? "gap-3" : "gap-4"} items-center justify-center p-2`}
          >
            {products.map((prod, idx) => (
              <div
                key={prod.id || `${pageNumber}-${idx}`}
                className="w-full h-full flex items-center justify-center"
              >
                <ProductCard916 product={prod} index={idx} store={store} />
              </div>
            ))}
          </div>
        ) : (
          /* Caso C: Página regular cheia (12, 9, 8 ou 6 produtos na grade) */
          <div className={`w-full h-full grid ${getGridClasses()} p-1`}>
            {products.map((prod, idx) => (
              <ProductCard916
                key={prod.id || `${pageNumber}-${idx}`}
                product={prod}
                index={idx}
                store={store}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
