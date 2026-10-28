import React, { useState } from "react";
import type { EncarteProduct, StoreConfig, ProductsPerPageOption } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { BADGE_LABELS } from "@/types/encarte";

interface ProductCard916Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "grid" | "hero";
  perPage?: ProductsPerPageOption;
}

/**
 * Card de produto do encarte no formato Story 9:16 (1080 × 1920 px).
 * Estrutura e diagramação:
 * 1. Código e embalagem no topo (mínimo de 28 px, negrito, caixa alta, centralizado)
 * 2. Espaço de 12 a 16 px até o nome do produto
 * 3. Nome do produto (30 a 34 px, negrito, caixa alta, centralizado, max 2 linhas, altura padronizada)
 * 4. Fio fino separador (1.5 px, cinza médio)
 * 5. Corpo do card em duas colunas com alturas alinhadas:
 *    - Esquerda: Foto do produto em área fixa quadrada (~165×165 px), sem corte (object-fit: contain, 85%),
 *      fundo branco puro, sem sombras, filtros, bordas ou caixa cinza.
 *    - Direita: Pílula de preço no topo + barras pretas de validade e estoque (todas alinhadas pela mesma borda esquerda).
 */
export const ProductCard916: React.FC<ProductCard916Props> = ({
  product,
  layoutMode = "grid",
  perPage = 8,
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

  // Tamanho calibrado do cabeçalho (mínimo rigoroso de 28 px)
  let headerFontSize = 28;
  if (headerLine.length > 28) {
    headerFontSize = 28; // Mínimo estrito de 28 px
  } else if (headerLine.length < 18) {
    headerFontSize = 30;
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

  // Calibragem tipográfica e dimensional com base no número de produtos por página
  const isCompact = perPage === 10 || perPage === 12;

  // Calibragem tipográfica do preço (60 a 68 px para valores normais; 48 a 56 px para preços altos como 1.249,90)
  let priceFontSize = isCompact ? 56 : 64;
  let rsFontSize = isCompact ? 32 : 36;
  if (formattedPrice.length >= 8) {
    priceFontSize = isCompact ? 44 : 50;
    rsFontSize = isCompact ? 26 : 30;
  } else if (formattedPrice.length >= 6) {
    priceFontSize = isCompact ? 50 : 58;
    rsFontSize = isCompact ? 30 : 34;
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

  // Controle de escala da foto do produto (sempre contido para nunca cortar)
  const userScale =
    typeof product.imageScale === "number" && !isNaN(product.imageScale) && product.imageScale > 0
      ? product.imageScale
      : 1.0;
  const safePhotoScale = Math.min(1.0, userScale);

  // Dimensões dinâmicas do bloco da foto e altura do nome para acomodar 8 ou 10 por página
  const photoSizePx = isCompact ? 135 : 165;
  const nameBoxHeight = isCompact ? "h-[50px] min-h-[50px]" : "h-[62px] min-h-[62px]";
  const headerSpacePx = isCompact ? 8 : 12;
  const pricePillHeight = isCompact ? "h-[54px]" : "h-[62px]";

  // =========================================================================
  // MODO HERO: 1 Produto sozinho na última página (centralizado e ampliado)
  // Mantém a mesma estrutura visual, proporções e alinhamentos.
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

        {/* Topo: Código e Embalagem + Espaço + Nome + Fio fino separador */}
        <div className="w-full text-center shrink-0">
          {headerLine && (
            <div className="font-sans font-black text-[38px] text-black uppercase tracking-wide leading-tight">
              {headerLine}
            </div>
          )}
          <div className="h-[14px]" />
          <h2 className="font-sans font-black text-[52px] text-black uppercase tracking-tight leading-[1.1] max-w-[800px] mx-auto min-h-[110px] flex items-center justify-center">
            {nameText}
          </h2>
          {/* Fio fino separador do cabeçalho */}
          <div className="w-full my-4 flex items-center justify-center">
            <div className="w-full h-[2px] bg-neutral-300" />
          </div>
        </div>

        {/* Corpo: Duas Colunas (Foto à Esquerda e Preço/Validade/Estoque à Direita) */}
        <div className="w-full flex-1 flex items-center justify-between gap-8 pt-2">
          {/* Foto à Esquerda em área quadrada fixa ampliada, ocupando 85% sem corte nem sombra */}
          <div className="w-[380px] min-w-[380px] h-[380px] bg-white flex items-center justify-center p-0 shrink-0">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                style={{
                  transform: `scale(${safePhotoScale})`,
                  transformOrigin: "center center",
                }}
                className="w-[85%] h-[85%] max-w-[85%] max-h-[85%] object-contain block"
                crossOrigin="anonymous"
                loading="eager"
              />
            ) : (
              <div className="w-[85%] h-[85%] flex items-center justify-center bg-white text-[#9ca3af] font-black text-3xl uppercase tracking-widest select-none">
                SEM FOTO
              </div>
            )}
          </div>

          {/* Coluna da Direita: Preço, Validade e Estoque alinhados pela mesma borda */}
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-5">
            {/* Faixa Vermelha de Preço */}
            {rawPrice ? (
              <div className="w-full h-[140px] bg-[#E30613] rounded-full px-8 flex items-center justify-between shadow-xs">
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
  // MODO GRADE PADRÃO (8 produtos 2×4 ou 10 produtos 2×5)
  // Cada card possui área fixa sem corte e proporções ideais.
  // =========================================================================
  return (
    <div
      className="relative w-full h-full bg-white flex flex-col justify-between p-2 select-none"
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

      {/* 1. CABEÇALHO DO PRODUTO: Código e Embalagem (mínimo de 28 px, negrito, centralizado, preto) */}
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
      </div>

      {/* Espaço de 12 a 16 px entre o cabeçalho e o nome */}
      <div style={{ height: `${headerSpacePx}px` }} className="shrink-0" />

      {/* 2. NOME DO PRODUTO: Centralizado, caixa alta, negrito, até 2 linhas, altura padronizada em todos os cards */}
      <div className={`w-full ${nameBoxHeight} flex items-center justify-center shrink-0 px-1`}>
        <h3
          style={{
            fontSize: `${nameFontSize}px`,
            lineHeight: 1.1,
          }}
          className="font-sans font-black text-black uppercase tracking-tight line-clamp-2 text-center overflow-hidden"
          title={nameText}
        >
          {nameText}
        </h3>
      </div>

      {/* Espaço de 12 a 16 px entre o nome e o corpo + Fio fino separador (1.5 px, cinza médio) */}
      <div className={`w-full ${isCompact ? "my-1" : "my-2"} flex items-center justify-center shrink-0`}>
        <div className="w-full h-[1.5px] bg-neutral-300" />
      </div>

      {/* 3. CORPO DO CARD: Duas Colunas com Alturas Alinhadas */}
      <div className="w-full flex-1 flex items-center justify-between gap-3 min-h-[120px]">
        {/* Coluna Esquerda: Área quadrada fixa para foto do produto (~165×165 px, sem corte, fundo branco puro) */}
        <div
          style={{ width: `${photoSizePx}px`, minWidth: `${photoSizePx}px`, height: `${photoSizePx}px` }}
          className="bg-white flex items-center justify-center p-0 shrink-0"
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              style={{
                transform: `scale(${safePhotoScale})`,
                transformOrigin: "center center",
              }}
              className="w-[85%] h-[85%] max-w-[85%] max-h-[85%] object-contain block"
              crossOrigin="anonymous"
              loading="eager"
            />
          ) : (
            <div className="w-[85%] h-[85%] flex items-center justify-center bg-white text-[#9ca3af] font-black text-[18px] uppercase tracking-wider select-none">
              SEM FOTO
            </div>
          )}
        </div>

        {/* Coluna Direita: Preço, Validade e Estoque alinhados pela mesma borda esquerda e com a mesma largura */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
          {/* Faixa Vermelha de Preço (Capsule / Stadium Pill) */}
          {rawPrice ? (
            <div className={`w-full ${pricePillHeight} bg-[#E30613] rounded-full px-3.5 flex items-center justify-between shadow-xs`}>
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
            <div className={`w-full ${pricePillHeight} bg-neutral-100 text-neutral-500 font-bold text-sm rounded-full flex items-center justify-center border border-dashed border-neutral-300`}>
              Preço a conferir
            </div>
          )}

          {/* Faixa Preta de Validade: "VALIDADE: dd/mm/aaaa" (cerca de 26 px, negrito, caixa alta, texto branco) */}
          {validityText && (
            <div
              className={`w-full h-[26px] min-h-[26px] px-2 rounded-xs flex items-center justify-center text-center font-black text-[22px] leading-tight tracking-wide uppercase ${
                isExpired ? "bg-red-700 text-white animate-pulse" : "bg-black text-white"
              }`}
              title={`Validade: ${validityText}`}
            >
              VALIDADE: {validityText}
            </div>
          )}

          {/* Faixa Preta de Estoque: "ESTOQUE: X UNID" (cerca de 26 px, negrito, caixa alta, texto branco) */}
          {stockText && (
            <div
              className="w-full h-[26px] min-h-[26px] px-2 bg-black text-white rounded-xs flex items-center justify-center text-center font-black text-[22px] leading-tight tracking-wide uppercase"
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
