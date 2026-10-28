import React, { useState } from "react";
import type { EncarteProduct, StoreConfig, ProductsPerPageOption } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { BADGE_LABELS } from "@/types/encarte";
import { calculateOpticalScale } from "@/lib/image-normalizer";

interface ProductCard916Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "grid" | "hero";
  perPage?: ProductsPerPageOption;
}

/**
 * Card de produto do encarte no formato Story 9:16 (1080 × 1920 px).
 * Estrutura fiel à referência de design:
 * 1. Código e embalagem no topo (26 a 30 px, negrito, caixa alta, centralizado)
 * 2. Nome do produto (30 a 34 px, negrito, caixa alta, centralizado, até 2 linhas sem reticências)
 * 3. Corpo em duas colunas:
 *    - Esquerda (~40%): foto do produto em fundo branco puro, sem sombra, sem borda e sem caixa cinza
 *    - Direita (~60%):
 *      - Preço em faixa vermelha arredondada (stadium capsule) com R$ menor, valor grande amarelo e unidade branca
 *      - Validade e estoque em faixas pretas com texto branco (22 a 26 px, negrito)
 */
export const ProductCard916: React.FC<ProductCard916Props> = ({
  product,
  layoutMode = "grid",
  perPage = 10,
}) => {
  const isExpired = isDateExpired(product?.validity || "");

  // 1. Linha de Código e Embalagem ("CÓDIGO - EMBALAGEM")
  const codeText = product?.code ? String(product.code).trim() : "";
  const packagingText = product?.packaging ? String(product.packaging).trim().toUpperCase() : "";

  let headerLine = "";
  if (codeText && packagingText) {
    headerLine = `${codeText} - ${packagingText}`;
  } else if (codeText) {
    headerLine = codeText;
  } else if (packagingText) {
    headerLine = packagingText;
  }

  // Tamanho calibrado do cabeçalho (26 a 30 px)
  let headerFontSize = 28;
  if (headerLine.length > 32) {
    headerFontSize = 26;
  }

  // 2. Nome do Produto (30 a 34 px, até 2 linhas sem reticências)
  const nameText = (product?.name || "").trim().toUpperCase();
  let nameFontSize = 34;
  if (nameText.length > 50) {
    nameFontSize = 30; // Mínimo estrito de 30 px
  } else if (nameText.length > 35) {
    nameFontSize = 32;
  }

  // 3. Preço formatado (valor grande com vírgula e 2 casas decimais, suportando separadores de milhar)
  const rawPrice = product?.price ? String(product.price).trim() : "";
  let formattedPrice = "";
  if (rawPrice) {
    if (rawPrice.includes(",")) {
      const lastCommaIdx = rawPrice.lastIndexOf(",");
      const intPart = rawPrice.slice(0, lastCommaIdx);
      const decPart = rawPrice.slice(lastCommaIdx + 1).padEnd(2, "0").slice(0, 2);
      formattedPrice = `${intPart},${decPart}`;
    } else if (rawPrice.includes(".")) {
      const lastDotIdx = rawPrice.lastIndexOf(".");
      const decPart = rawPrice.slice(lastDotIdx + 1);
      if (decPart.length <= 2) {
        const intPart = rawPrice.slice(0, lastDotIdx);
        formattedPrice = `${intPart},${decPart.padEnd(2, "0")}`;
      } else {
        formattedPrice = `${rawPrice},00`;
      }
    } else {
      formattedPrice = `${rawPrice},00`;
    }
  }

  // Calibragem tipográfica do preço (60 a 68 px para valores normais; 48 a 56 px para preços altos como 1.249,90)
  let priceFontSize = 64;
  let rsFontSize = 36;
  if (formattedPrice.length >= 8) {
    priceFontSize = 50;
    rsFontSize = 30;
  } else if (formattedPrice.length >= 6) {
    priceFontSize = 58;
    rsFontSize = 34;
  }

  const unitLabel = (product?.unit || "UND").trim().toUpperCase();

  // 4. Validade e Estoque: se vazio, a faixa some e o espaço é redistribuído
  const validityText =
    product?.validity &&
    product.validity !== "undefined" &&
    product.validity !== "null" &&
    product.validity.trim() !== ""
      ? product.validity.trim()
      : null;

  let stockText: string | null = null;
  if (
    product?.stock &&
    product.stock !== "undefined" &&
    product.stock !== "null" &&
    product.stock.trim() !== ""
  ) {
    const rawStock = product.stock.trim().toUpperCase();
    stockText = rawStock.startsWith("ESTOQUE") ? rawStock : `ESTOQUE: ${rawStock}`;
  }

  // Normalização óptica da foto do produto
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const autoScale = aspectRatio ? calculateOpticalScale(aspectRatio) : 1.0;
  const userScale =
    typeof product.imageScale === "number" && !isNaN(product.imageScale) && product.imageScale > 0
      ? product.imageScale
      : 1.0;
  const totalScale = Number((autoScale * userScale).toFixed(2));

  // =========================================================================
  // MODO HERO: 1 Produto sozinho na última página (centralizado e ampliado)
  // Mantém a mesma estrutura visual e o mesmo template.
  // =========================================================================
  if (layoutMode === "hero") {
    return (
      <div className="relative w-full max-w-[840px] h-[950px] mx-auto bg-white flex flex-col justify-between p-8 text-neutral-900 select-none">
        {/* Selo Promocional se houver */}
        {product.badge && product.badge !== "nenhum" && (
          <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-[#FFD400] to-[#FACC15] text-black font-black text-xl px-5 py-1.5 rounded-lg border-2 border-black tracking-wider uppercase transform -rotate-2">
            ★ {BADGE_LABELS[product.badge]} ★
          </div>
        )}

        {/* Topo: Código e Embalagem + Nome */}
        <div className="w-full text-center space-y-2 shrink-0">
          {headerLine && (
            <div className="font-sans font-black text-[38px] text-black uppercase tracking-wide leading-tight">
              {headerLine}
            </div>
          )}
          <h2 className="font-sans font-black text-[52px] text-black uppercase tracking-tight leading-[1.1] max-w-[800px] mx-auto">
            {nameText}
          </h2>
        </div>

        {/* Corpo: Duas Colunas (Foto à Esquerda e Preço/Validade/Estoque à Direita) */}
        <div className="w-full flex-1 flex items-center justify-between gap-8 pt-4">
          {/* Foto à Esquerda */}
          <div className="w-[45%] h-[560px] bg-white flex items-center justify-center p-2">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                onLoad={handleImageLoad}
                style={{
                  transform: `scale(${totalScale})`,
                  transformOrigin: "center center",
                }}
                className="max-h-full max-w-full object-contain"
                crossOrigin="anonymous"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white text-[#9ca3af] font-black text-3xl uppercase tracking-widest">
                SEM FOTO
              </div>
            )}
          </div>

          {/* Coluna da Direita: Preço, Validade e Estoque */}
          <div className="w-[53%] flex flex-col justify-center items-center space-y-5">
            {/* Faixa Vermelha de Preço */}
            {rawPrice ? (
              <div className="w-full h-[140px] bg-[#E30613] rounded-full px-8 flex items-center justify-between shadow-md">
                <div className="flex items-baseline">
                  <span className="font-black text-[#FFE600] text-[48px] mr-2 leading-none">
                    R$
                  </span>
                  <span className="font-display font-black text-[#FFE600] text-7xl md:text-8xl leading-none tracking-tight">
                    {formattedPrice}
                  </span>
                </div>
                <span className="text-white font-black text-[36px] uppercase leading-none pl-2">
                  {unitLabel}
                </span>
              </div>
            ) : (
              <div className="w-full h-[100px] bg-neutral-200 text-neutral-600 font-bold text-2xl rounded-2xl flex items-center justify-center">
                Preço a conferir
              </div>
            )}

            {/* Faixa Preta de Validade */}
            {validityText && (
              <div
                className={`w-full h-[56px] px-6 rounded-xs flex items-center justify-center font-black text-[32px] tracking-wider uppercase text-center ${
                  isExpired ? "bg-red-700 text-white animate-pulse" : "bg-black text-white"
                }`}
              >
                VALIDADE: {validityText}
              </div>
            )}

            {/* Faixa Preta de Estoque */}
            {stockText && (
              <div className="w-full h-[56px] bg-black text-white px-6 rounded-xs flex items-center justify-center font-black text-[32px] tracking-wider uppercase text-center">
                {stockText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODO GRADE PADRÃO (2 colunas × 5 linhas = 10 produtos por página)
  // Cada card mede cerca de 500 × 236 px no canvas 1080 × 1920 px.
  // =========================================================================
  return (
    <div
      className="relative w-full h-full bg-white flex flex-col justify-between p-2 select-none overflow-hidden"
      style={{
        boxSizing: "border-box",
      }}
    >
      {/* Selo Promocional se houver */}
      {product.badge && product.badge !== "nenhum" && (
        <div className="absolute top-1 left-1 z-10 bg-gradient-to-r from-[#FFD400] to-[#FACC15] text-black font-black text-[11px] px-2 py-0.5 rounded shadow-2xs border border-black/20 uppercase tracking-wider transform -rotate-2">
          ★ {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* 1. TOPO: Código e Embalagem (26 a 30 px, negrito, centralizado, preto) */}
      <div className="w-full text-center shrink-0">
        {headerLine ? (
          <div
            style={{ fontSize: `${headerFontSize}px` }}
            className="font-sans font-black text-black uppercase tracking-wide leading-tight truncate px-1"
            title={headerLine}
          >
            {headerLine}
          </div>
        ) : (
          <div className="h-[28px]" />
        )}

        {/* 2. NOME DO PRODUTO: Centralizado, caixa alta, negrito, até 2 linhas (30 a 34 px, preto) */}
        <h3
          style={{
            fontSize: `${nameFontSize}px`,
            lineHeight: 1.1,
            maxHeight: "68px",
          }}
          className="font-sans font-black text-black uppercase tracking-tight line-clamp-2 text-center mt-0.5 px-0.5 overflow-hidden"
          title={nameText}
        >
          {nameText}
        </h3>
      </div>

      {/* 3. CORPO: Duas Colunas (Esquerda: Foto ~40%; Direita: Preço + Validade + Estoque ~60%) */}
      <div className="w-full flex-1 flex items-center justify-between gap-2 min-h-[120px] pt-1">
        {/* Coluna Esquerda: Foto do Produto (Fundo branco puro, sem caixa cinza, sem sombra, sem borda) */}
        <div className="w-[40%] min-w-[140px] h-full max-h-[135px] bg-white flex items-center justify-center p-0.5 overflow-hidden shrink-0">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              onLoad={handleImageLoad}
              style={{
                transform: `scale(${totalScale})`,
                transformOrigin: "center center",
              }}
              className="max-h-full max-w-full object-contain"
              crossOrigin="anonymous"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white text-[#9ca3af] font-black text-[18px] uppercase tracking-wider">
              SEM FOTO
            </div>
          )}
        </div>

        {/* Coluna Direita: Preço, Validade e Estoque empilhados */}
        <div className="w-[58%] flex flex-col justify-center items-center space-y-1.5 shrink-0">
          {/* Faixa Vermelha de Preço (Capsule / Stadium Pill) */}
          {rawPrice ? (
            <div className="w-full h-[66px] bg-[#E30613] rounded-full px-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-baseline min-w-0">
                <span
                  style={{ fontSize: `${rsFontSize}px` }}
                  className="font-black text-[#FFE600] mr-1 leading-none shrink-0"
                >
                  R$
                </span>
                <span
                  style={{ fontSize: `${priceFontSize}px` }}
                  className="font-display font-black text-[#FFE600] leading-none tracking-tight truncate"
                >
                  {formattedPrice}
                </span>
              </div>
              <span className="text-white font-black text-[22px] uppercase leading-none pl-1 shrink-0">
                {unitLabel}
              </span>
            </div>
          ) : (
            <div className="w-full h-[60px] bg-neutral-100 text-neutral-500 font-bold text-sm rounded-full flex items-center justify-center border border-dashed border-neutral-300">
              Preço a conferir
            </div>
          )}

          {/* Faixa Preta de Validade: "VALIDADE: dd/mm/aaaa" (22 a 26 px, negrito) */}
          {validityText && (
            <div
              className={`w-full min-h-[26px] py-0.5 px-2 rounded-xs flex items-center justify-center text-center font-black text-[22px] leading-tight tracking-wide uppercase ${
                isExpired ? "bg-red-700 text-white animate-pulse" : "bg-black text-white"
              }`}
              title={`Validade: ${validityText}`}
            >
              VALIDADE: {validityText}
            </div>
          )}

          {/* Faixa Preta de Estoque: "ESTOQUE: X UNID" (22 a 26 px, negrito) */}
          {stockText && (
            <div
              className="w-full min-h-[26px] py-0.5 px-2 bg-black text-white rounded-xs flex items-center justify-center text-center font-black text-[22px] leading-tight tracking-wide uppercase"
              title={stockText}
            >
              {stockText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
