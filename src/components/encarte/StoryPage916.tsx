import React from "react";
import type { EncarteProduct, StoreConfig, CampaignConfig, ProductsPerPageOption } from "@/types/encarte";
import { DEFAULT_TEMPLATE_9_16_AREA } from "@/types/encarte";
import { ProductCard916 } from "./ProductCard916";
import { AlertCircle } from "lucide-react";

interface StoryPage916Props {
  pageNumber: number;
  totalPages: number;
  products: EncarteProduct[];
  store: StoreConfig;
  campaign: CampaignConfig;
  domId?: string;
}

/**
 * Verifica se os produtos da página cabem na grade de 10 produtos (2×5)
 * respeitando os tamanhos mínimos estritos:
 * - Nome: mínimo 30 px, máximo 2 linhas
 * - Código/Embalagem: mínimo 26 px
 * - Preço: mínimo 60 px
 * - Validade/Estoque: mínimo 22 px
 *
 * Se algum produto tiver texto muito longo para 2 linhas no tamanho mínimo,
 * recomenda a redução para 8 produtos (2×4).
 */
export function checkPageTextFit(products: EncarteProduct[]): { fitsTen: boolean; reason?: string } {
  for (const p of products) {
    const name = (p.name || "").trim();
    // Em 480 px de largura de texto a 30 px font, 2 linhas comportam ~60 a 65 caracteres.
    // Acima disso, demandaria 3 linhas ou fonte menor que 30 px.
    if (name.length > 65) {
      return {
        fitsTen: false,
        reason: `Produto "${name.slice(0, 24)}..." possui nome longo que requer mais espaço para manter a fonte mínima de 30 px.`,
      };
    }
  }
  return { fitsTen: true };
}

/**
 * Encarte em formato Story 9:16 (1080 × 1920 px) utilizando o template PNG como fundo integral.
 * Área branca dos produtos: x 46 a 1057 e y 661 a 1862 (1012 × 1202 px).
 * Grade fixa padrão: 2 colunas × 5 linhas = 10 produtos por página (cards de ~500 × 236 px).
 */
export const StoryPage916: React.FC<StoryPage916Props> = ({
  pageNumber,
  totalPages,
  products = [],
  store,
  campaign,
  domId,
}) => {
  const isLastPage = pageNumber === totalPages;
  const count = products.length;

  const area = campaign?.template916Area || DEFAULT_TEMPLATE_9_16_AREA;
  const canvasWidth = area?.canvasWidth || 1080;
  const canvasHeight = area?.canvasHeight || 1920;

  const safeX = typeof area?.x === "number" ? area.x : DEFAULT_TEMPLATE_9_16_AREA.x;
  const safeY = typeof area?.y === "number" ? area.y : DEFAULT_TEMPLATE_9_16_AREA.y;
  const safeW = typeof area?.width === "number" ? area.width : DEFAULT_TEMPLATE_9_16_AREA.width;
  const safeH = typeof area?.height === "number" ? area.height : DEFAULT_TEMPLATE_9_16_AREA.height;

  // Coordenadas percentuais exatas para o canvas
  const leftPct = (safeX / canvasWidth) * 100;
  const topPct = (safeY / canvasHeight) * 100;
  const widthPct = (safeW / canvasWidth) * 100;
  const heightPct = (safeH / canvasHeight) * 100;

  // Configuração de produtos por página
  const configuredPerPage = campaign?.productsPerPage || 10;

  // Verificação de cabimento: se 10 não couberem com tamanhos mínimos, reduz para 8
  const fitCheck = checkPageTextFit(products);
  const autoAdjustedToEight = configuredPerPage === 10 && !fitCheck.fitsTen;
  const effectivePerPage: ProductsPerPageOption = autoAdjustedToEight ? 8 : configuredPerPage;

  // Grade e espaçamentos matematicamente calculados para a área de 1012 × 1202 px
  const isThreeCols = effectivePerPage === 12 || effectivePerPage === 9;
  const numCols = isThreeCols ? 3 : 2;

  const gridStyles = {
    10: {
      gapX: "12px",
      gapY: "5px",
      cardWidthStyle: "calc((100% - 12px) / 2)", // exatamente ~500 px
      rowHeightStyle: "calc((100% - 20px) / 5)", // exatamente ~236 px
    },
    8: {
      gapX: "12px",
      gapY: "8px",
      cardWidthStyle: "calc((100% - 12px) / 2)", // exatamente ~500 px
      rowHeightStyle: "calc((100% - 24px) / 4)", // exatamente ~294 px
    },
    6: {
      gapX: "12px",
      gapY: "10px",
      cardWidthStyle: "calc((100% - 12px) / 2)", // exatamente ~500 px
      rowHeightStyle: "calc((100% - 20px) / 3)", // exatamente ~394 px
    },
    9: {
      gapX: "12px",
      gapY: "8px",
      cardWidthStyle: "calc((100% - 24px) / 3)",
      rowHeightStyle: "calc((100% - 16px) / 3)",
    },
    12: {
      gapX: "10px",
      gapY: "10px",
      cardWidthStyle: "calc((100% - 20px) / 3)",
      rowHeightStyle: "calc((100% - 30px) / 4)",
    },
  }[effectivePerPage] || {
    gapX: "12px",
    gapY: "5px",
    cardWidthStyle: "calc((100% - 12px) / 2)",
    rowHeightStyle: "calc((100% - 20px) / 5)",
  };

  // Particiona a lista de produtos em linhas
  const rows: EncarteProduct[][] = [];
  for (let i = 0; i < count; i += numCols) {
    rows.push(products.slice(i, i + numCols));
  }

  return (
    <div
      id={domId}
      data-testid="story-916-page"
      className="relative overflow-hidden select-none bg-black"
      style={{
        width: "1080px",
        height: "1920px",
        boxSizing: "border-box",
      }}
    >
      {/* 1. FUNDO: Template PNG/JPG completo, mantido integralmente */}
      <img
        src={
          campaign.template916Image ||
          "/templates/template-detona-precos-9-16.png"
        }
        alt="Template Encarte 9:16"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* 2. ÁREA BRANCA DOS PRODUTOS (x 46 a 1057 e y 661 a 1862) */}
      <div
        data-testid="product-white-area"
        className="absolute rounded-[36px] overflow-hidden flex flex-col justify-center z-10 bg-white"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          boxSizing: "border-box",
        }}
      >
        {/* Aviso discreto caso tenha sido ajustado automaticamente para 8 produtos para manter tamanhos mínimos */}
        {autoAdjustedToEight && (
          <div className="absolute top-2 left-4 right-4 z-20 bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Layout ajustado para 8 produtos (2×4) para manter os textos grandes e legíveis sem cortes.</span>
          </div>
        )}

        {/* CASO A: Sobra de 1 único produto na última página (Centralizado e ampliado) */}
        {isLastPage && count === 1 ? (
          <div className="w-full h-full flex items-center justify-center p-6">
            <ProductCard916
              product={products[0]}
              index={0}
              store={store}
              layoutMode="hero"
              perPage={effectivePerPage}
            />
          </div>
        ) : isLastPage && count === 2 ? (
          /* CASO B: Sobra de 2 produtos na última página (Centralizados lado a lado no meio da página) */
          <div className="w-full h-full flex items-center justify-center">
            <div
              data-testid="incomplete-row-centered"
              style={{
                width: "100%",
                height: effectivePerPage === 10 ? "280px" : gridStyles.rowHeightStyle,
                display: "flex",
                justifyContent: "center",
                gap: gridStyles.gapX,
              }}
            >
              {products.map((prod, colIdx) => (
                <div
                  key={prod.id || `${pageNumber}-${colIdx}`}
                  style={{ width: gridStyles.cardWidthStyle }}
                  className="h-full flex items-center justify-center"
                >
                  <ProductCard916
                    product={prod}
                    index={colIdx}
                    store={store}
                    perPage={effectivePerPage}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CASO C: Grade completa ou com linhas finais centralizadas */
          <div
            data-testid="product-grid-container"
            className="w-full h-full flex flex-col justify-center"
            style={{ rowGap: gridStyles.gapY }}
          >
            {rows.map((row, rowIdx) => {
              const isFullRow = row.length === numCols;

              if (isFullRow) {
                return (
                  <div
                    key={`row-${rowIdx}`}
                    data-testid={`grid-row-${rowIdx}`}
                    style={{
                      height: gridStyles.rowHeightStyle,
                      display: "grid",
                      gridTemplateColumns: numCols === 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
                      columnGap: gridStyles.gapX,
                    }}
                    className="w-full shrink-0 items-center"
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
                          perPage={effectivePerPage}
                        />
                      </div>
                    ))}
                  </div>
                );
              }

              // Linha incompleta: Rigorosamente centralizada na horizontal com a mesma largura e altura dos cards
              return (
                <div
                  key={`row-${rowIdx}`}
                  data-testid="incomplete-row-centered"
                  style={{
                    height: gridStyles.rowHeightStyle,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: gridStyles.gapX,
                  }}
                  className="w-full shrink-0"
                >
                  {row.map((prod, colIdx) => (
                    <div
                      key={prod.id || `${pageNumber}-${rowIdx * numCols + colIdx}`}
                      style={{ width: gridStyles.cardWidthStyle }}
                      className="h-full flex items-center justify-center"
                    >
                      <ProductCard916
                        product={prod}
                        index={rowIdx * numCols + colIdx}
                        store={store}
                        perPage={effectivePerPage}
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
