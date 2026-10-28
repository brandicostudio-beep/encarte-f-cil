import React, { useState } from "react";
import type {
  EncarteProduct,
  StoreConfig,
  ProductsPerPageOption,
  ProductCustomStyle,
  CampaignGlobalStyle,
} from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { BADGE_LABELS } from "@/types/encarte";
import { deriveSaleUnit } from "@/lib/parse-product";
import { Sparkles } from "lucide-react";

interface ProductCard916Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "grid" | "hero";
  perPage?: ProductsPerPageOption;
  customStyle?: ProductCustomStyle;
  pageStyle?: CampaignGlobalStyle;
  globalStyle?: CampaignGlobalStyle;
  isSelected?: boolean;
  onSelect?: () => void;
  isInteractive?: boolean;
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
  customStyle,
  pageStyle,
  globalStyle,
  isSelected = false,
  onSelect,
  isInteractive = false,
  index = 0,
}) => {
  const isExpired = isDateExpired(product?.validity || "");

  // Customizações aplicadas em cascata: Produto > Página > Campanha > Padrão
  const cs = customStyle || product?.customStyle || {};
  const ps = pageStyle || {};
  const gs = globalStyle || {};

  // Cores efetivas
  const effectivePillBg = cs.pillBgColor || ps.pillBgColor || gs.pillBgColor || "#E30613";
  const effectivePillText = cs.pillTextColor || ps.pillTextColor || gs.pillTextColor || "#FFE600";
  const effectiveValidityBg = cs.validityBgColor || ps.validityBgColor || gs.validityBgColor || (isExpired ? "#b91c1c" : "#000000");
  const effectiveValidityText = cs.validityTextColor || ps.validityTextColor || gs.validityTextColor || "#FFFFFF";
  const effectiveStockBg = cs.stockBgColor || ps.stockBgColor || gs.stockBgColor || "#000000";
  const effectiveStockText = cs.stockTextColor || ps.stockTextColor || gs.stockTextColor || "#FFFFFF";
  const effectiveBoxBorder = cs.boxBorderColor || ps.boxBorderColor || gs.boxBorderColor || "#D9D9D9";
  const effectiveBoxBg = cs.boxBgColor || ps.boxBgColor || gs.boxBgColor || "#FFFFFF";
  const effectiveNameColor = cs.nameColor || ps.nameColor || gs.nameColor || "#000000";
  const effectiveHeaderColor = cs.headerColor || ps.headerColor || gs.headerColor || "#000000";

  // Visibilidade
  const showCode = cs.showCode ?? ps.showCode ?? gs.showCode ?? true;
  const showName = cs.showName ?? ps.showName ?? gs.showName ?? true;
  const showValidity = cs.showValidity ?? ps.showValidity ?? gs.showValidity ?? true;
  const showStock = cs.showStock ?? ps.showStock ?? gs.showStock ?? true;
  const showBadge = cs.showBadge ?? ps.showBadge ?? gs.showBadge ?? true;

  // Alinhamento e Pesos
  const nameAlign = cs.nameAlign || ps.nameAlign || gs.nameAlign || "center";
  const nameWeight = cs.nameFontWeight || ps.nameFontWeight || gs.nameFontWeight || "bold";
  const headerAlign = cs.headerAlign || ps.headerAlign || gs.headerAlign || "center";
  const headerWeight = cs.headerFontWeight || ps.headerFontWeight || gs.headerFontWeight || "bold";
  const priceWeight = cs.priceFontWeight || ps.priceFontWeight || gs.priceFontWeight || "bold";

  // Mapeamento de pesos numéricos para garantir bold (700) e não black (900)
  const getWeightNumber = (w: "normal" | "semibold" | "bold") => {
    if (w === "normal") return 400;
    if (w === "semibold") return 600;
    return 700;
  };

  const getAlignClass = (a: "left" | "center" | "right") => {
    if (a === "left") return "text-left justify-start";
    if (a === "right") return "text-right justify-end";
    return "text-center justify-center";
  };

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
  let defaultHeaderFontSize = 28;
  if (headerLine.length > 28) {
    defaultHeaderFontSize = 28;
  } else if (headerLine.length < 18) {
    defaultHeaderFontSize = 30;
  }
  const effectiveHeaderFontSize = cs.headerFontSize || ps.headerFontSize || gs.headerFontSize || defaultHeaderFontSize;

  // 2. Nome do Produto (30 a 34 px, até 2 linhas sem reticências)
  const nameText = (product?.name || "").trim().toUpperCase();
  let defaultNameFontSize = 34;
  if (nameText.length > 50) {
    defaultNameFontSize = 30;
  } else if (nameText.length > 35) {
    defaultNameFontSize = 32;
  }
  const effectiveNameFontSize = cs.nameFontSize || ps.nameFontSize || gs.nameFontSize || defaultNameFontSize;

  // 3. Preço formatado (valor com vírgula e 2 casas decimais, suportando separadores de milhar)
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

  // ITEM 1: Redução de 10% a 15% no tamanho do preço, deixando mais leve, sem ocupar a pílula inteira
  // Peso padrão: bold (700) ao invés de extra-bold/black (900)
  // R$ e UND proporcionais e equilibrados, nunca cortando valores como R$ 1.249,90
  let defaultPriceFontSize = isCompact ? 48 : 55;
  let rsFontSize = isCompact ? 24 : 28;
  let unitFontSize = isCompact ? 18 : 20;

  if (formattedPrice.length >= 8) {
    defaultPriceFontSize = isCompact ? 38 : 43;
    rsFontSize = isCompact ? 20 : 23;
    unitFontSize = isCompact ? 15 : 17;
  } else if (formattedPrice.length >= 6) {
    defaultPriceFontSize = isCompact ? 43 : 50;
    rsFontSize = isCompact ? 22 : 25;
    unitFontSize = isCompact ? 17 : 19;
  }

  const effectivePriceFontSize = cs.priceFontSize || ps.priceFontSize || gs.priceFontSize || defaultPriceFontSize;

  // 4. Unidade de venda derivada da primeira palavra da embalagem (ex: CX, PCT, UND, FD)
  const unitLabel = deriveSaleUnit(product?.packaging, product?.unit).unit;

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
  const customImageScale = cs.imageScale ?? 1.0;
  const safePhotoScale = Math.min(1.3, Math.max(0.4, userScale * customImageScale));

  const photoOffsetX = cs.imageOffsetX || 0;
  const photoOffsetY = cs.imageOffsetY || 0;
  const boxOffsetX = cs.boxOffsetX || 0;
  const boxOffsetY = cs.boxOffsetY || 0;

  const isCustomized = Boolean(cs.isCustomized || Object.keys(cs).length > 0);

  // Dimensões dinâmicas do bloco da foto e altura do nome para acomodar 8 ou 10 por página com padding interno de 12 px
  const photoSizePx = isCompact ? 115 : 160;
  const nameBoxHeight = isCompact ? "h-[48px] min-h-[48px]" : "h-[60px] min-h-[60px]";
  const pricePillHeight = isCompact ? "h-[48px]" : "h-[58px]";

  // =========================================================================
  // MODO HERO: 1 Produto sozinho na última página (centralizado e ampliado)
  // =========================================================================
  if (layoutMode === "hero") {
    return (
      <div
        data-testid={`product-box-${product.id || index}`}
        onClick={() => onSelect?.()}
        className={`relative w-full max-w-[840px] h-[950px] mx-auto rounded-[8px] border border-[#D9D9D9] p-8 flex flex-col justify-between text-neutral-900 select-none shadow-none transition-all ${
          isSelected ? "ring-4 ring-blue-500 shadow-lg ring-offset-2 z-20" : ""
        } ${isInteractive ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : ""}`}
        style={{
          boxSizing: "border-box",
          backgroundColor: effectiveBoxBg,
          borderColor: effectiveBoxBorder,
          borderWidth: "1px",
          borderStyle: "solid",
          transform: boxOffsetX || boxOffsetY ? `translate(${boxOffsetX}px, ${boxOffsetY}px)` : undefined,
        }}
      >
        {/* Indicador de Personalizado */}
        {isCustomized && (
          <div
            className="absolute top-2 right-2 z-30 bg-purple-600 text-white rounded-full p-1 shadow-xs flex items-center justify-center"
            title="Produto com personalização visual aplicada"
          >
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        {/* Selo Promocional se houver */}
        {showBadge && product.badge && product.badge !== "nenhum" && (
          <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-[#FFD400] to-[#FACC15] text-black font-bold text-xl px-5 py-1.5 rounded-lg border-2 border-black tracking-wider uppercase transform -rotate-2">
            ★ {BADGE_LABELS[product.badge]} ★
          </div>
        )}

        {/* Topo: Código e Embalagem + Fio fino separador + Nome */}
        <div className="w-full shrink-0">
          {showCode && headerLine && (
            <div
              style={{
                fontSize: `${effectiveHeaderFontSize * 1.3}px`,
                fontWeight: getWeightNumber(headerWeight),
                color: effectiveHeaderColor,
              }}
              className={`font-sans font-black text-black uppercase tracking-wide leading-tight flex items-center ${getAlignClass(headerAlign)}`}
            >
              {headerLine}
            </div>
          )}

          {/* Fio fino separador do cabeçalho */}
          <div className="w-full my-3 flex items-center justify-center">
            <div className="w-full h-[1.5px]" style={{ backgroundColor: effectiveBoxBorder }} />
          </div>

          {showName && (
            <h2
              style={{
                fontSize: `${effectiveNameFontSize * 1.5}px`,
                fontWeight: getWeightNumber(nameWeight),
                color: effectiveNameColor,
                lineHeight: 1.1,
              }}
              className={`font-sans uppercase tracking-tight max-w-[800px] mx-auto min-h-[110px] flex items-center ${getAlignClass(nameAlign)}`}
            >
              {nameText}
            </h2>
          )}
        </div>

        {/* Corpo: Duas Colunas (Foto à Esquerda e Preço/Validade/Estoque à Direita) */}
        <div className="w-full flex-1 flex items-center justify-between gap-8 pt-2">
          {/* Foto à Esquerda em área quadrada fixa ampliada */}
          <div className="w-[380px] min-w-[380px] h-[380px] bg-white flex items-center justify-center p-0 shrink-0 overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                style={{
                  transform: `scale(${safePhotoScale}) translate(${photoOffsetX}px, ${photoOffsetY}px)`,
                  transformOrigin: "center center",
                }}
                className="w-[85%] h-[85%] max-w-[85%] max-h-[85%] object-contain block"
                crossOrigin="anonymous"
                loading="eager"
              />
            ) : (
              <div className="w-[85%] h-[85%] flex items-center justify-center bg-white text-[#9ca3af] font-bold text-3xl uppercase tracking-widest select-none">
                SEM FOTO
              </div>
            )}
          </div>

          {/* Coluna da Direita: Preço, Validade e Estoque */}
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-5">
            {/* Faixa de Preço */}
            {rawPrice ? (
              <div
                style={{ backgroundColor: effectivePillBg }}
                className="w-full h-[140px] bg-[#E30613] rounded-full px-8 flex items-center justify-between shadow-xs"
              >
                <div className="flex items-baseline">
                  <span
                    style={{ fontSize: "40px", fontWeight: getWeightNumber(priceWeight), color: effectivePillText }}
                    className="mr-2 leading-none font-bold"
                  >
                    R$
                  </span>
                  <span
                    style={{
                      fontSize: "76px",
                      fontWeight: getWeightNumber(priceWeight),
                      color: effectivePillText,
                    }}
                    className="font-display leading-none tracking-tight font-bold text-7xl"
                  >
                    {formattedPrice}
                  </span>
                </div>
                <span
                  style={{ fontSize: "32px", fontWeight: 700 }}
                  className="text-white uppercase leading-none pl-2 font-bold"
                >
                  {unitLabel}
                </span>
              </div>
            ) : (
              <div className="w-full h-[100px] bg-neutral-200 text-neutral-600 font-bold text-2xl rounded-2xl flex items-center justify-center">
                Preço a conferir
              </div>
            )}

            {/* Faixa de Validade */}
            {showValidity && validityText && (
              <div
                style={{ backgroundColor: effectiveValidityBg, color: effectiveValidityText }}
                className={`w-full h-[56px] px-6 rounded-xs flex items-center justify-center font-bold text-[30px] tracking-wider uppercase text-center ${
                  isExpired ? "animate-pulse" : ""
                }`}
              >
                VALIDADE: {validityText}
              </div>
            )}

            {/* Faixa de Estoque */}
            {showStock && stockText && (
              <div
                style={{ backgroundColor: effectiveStockBg, color: effectiveStockText }}
                className="w-full h-[56px] px-6 rounded-xs flex items-center justify-center font-bold text-[30px] tracking-wider uppercase text-center"
              >
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
  // =========================================================================
  return (
    <div
      data-testid={`product-box-${product.id || index}`}
      onClick={() => onSelect?.()}
      className={`relative w-full h-full rounded-[8px] border border-[#D9D9D9] p-[12px] flex flex-col justify-between select-none shadow-none transition-all ${
        isSelected ? "ring-4 ring-blue-500 shadow-lg ring-offset-2 z-20" : ""
      } ${isInteractive ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : ""}`}
      style={{
        boxSizing: "border-box",
        backgroundColor: effectiveBoxBg,
        borderColor: effectiveBoxBorder,
        borderWidth: "1px",
        borderStyle: "solid",
        transform: boxOffsetX || boxOffsetY ? `translate(${boxOffsetX}px, ${boxOffsetY}px)` : undefined,
      }}
    >
      {/* Indicador de Personalizado */}
      {isCustomized && (
        <div
          className="absolute top-1.5 right-1.5 z-30 bg-purple-600 text-white rounded-full p-0.5 shadow-xs flex items-center justify-center"
          title="Produto com personalização visual aplicada"
        >
          <Sparkles className="h-3 w-3" />
        </div>
      )}

      {/* Selo Promocional se houver */}
      {showBadge && product.badge && product.badge !== "nenhum" && (
        <div className="absolute top-1 left-1 z-10 bg-gradient-to-r from-[#FFD400] to-[#FACC15] text-black font-bold text-[11px] px-2 py-0.5 rounded shadow-2xs border border-black/20 uppercase tracking-wider transform -rotate-2">
          ★ {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* 1. CABEÇALHO DO PRODUTO: Código e Embalagem */}
      <div className="w-full shrink-0">
        {showCode && headerLine ? (
          <div
            style={{
              fontSize: `${effectiveHeaderFontSize}px`,
              fontWeight: getWeightNumber(headerWeight),
              color: effectiveHeaderColor,
            }}
            className={`font-sans font-black text-black uppercase tracking-wide leading-tight truncate px-0.5 flex items-center ${getAlignClass(headerAlign)}`}
            title={headerLine}
          >
            {headerLine}
          </div>
        ) : (
          <div className="h-[28px]" />
        )}
      </div>

      {/* Fio fino separador entre código e nome */}
      <div className={`w-full ${isCompact ? "my-1" : "my-1.5"} flex items-center justify-center shrink-0`}>
        <div className="w-full h-[1px]" style={{ backgroundColor: effectiveBoxBorder }} />
      </div>

      {/* 2. NOME DO PRODUTO */}
      <div className={`w-full ${nameBoxHeight} flex items-center px-0.5 shrink-0 ${getAlignClass(nameAlign)}`}>
        {showName && (
          <h3
            style={{
              fontSize: `${effectiveNameFontSize}px`,
              lineHeight: 1.1,
              fontWeight: getWeightNumber(nameWeight),
              color: effectiveNameColor,
            }}
            className={`font-sans uppercase tracking-tight line-clamp-2 overflow-hidden w-full ${
              nameAlign === "left" ? "text-left" : nameAlign === "right" ? "text-right" : "text-center"
            }`}
            title={nameText}
          >
            {nameText}
          </h3>
        )}
      </div>

      {/* 3. CORPO DO CARD: Duas Colunas com Alturas Alinhadas */}
      <div className="w-full flex-1 flex items-center justify-between gap-2.5 min-h-[105px] pt-1">
        {/* Coluna Esquerda: Área quadrada fixa para foto do produto */}
        <div
          style={{ width: `${photoSizePx}px`, minWidth: `${photoSizePx}px`, height: `${photoSizePx}px` }}
          className="bg-white flex items-center justify-center p-0 shrink-0 overflow-hidden"
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              style={{
                transform: `scale(${safePhotoScale}) translate(${photoOffsetX}px, ${photoOffsetY}px)`,
                transformOrigin: "center center",
              }}
              className="w-[85%] h-[85%] max-w-[85%] max-h-[85%] object-contain block"
              crossOrigin="anonymous"
              loading="eager"
            />
          ) : (
            <div className="w-[85%] h-[85%] flex items-center justify-center bg-white text-[#9ca3af] font-bold text-[18px] uppercase tracking-wider select-none">
              SEM FOTO
            </div>
          )}
        </div>

        {/* Coluna Direita: Preço, Validade e Estoque */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
          {/* Faixa de Preço (Pílula) */}
          {rawPrice ? (
            <div
              style={{ backgroundColor: effectivePillBg }}
              className={`w-full ${pricePillHeight} bg-[#E30613] rounded-full px-3.5 flex items-center justify-between shadow-xs`}
            >
              <div className="flex items-baseline min-w-0">
                <span
                  style={{
                    fontSize: `${rsFontSize}px`,
                    fontWeight: getWeightNumber(priceWeight),
                    color: effectivePillText,
                  }}
                  className="mr-1 leading-none shrink-0 font-bold"
                >
                  R$
                </span>
                <span
                  style={{
                    fontSize: `${effectivePriceFontSize}px`,
                    fontWeight: getWeightNumber(priceWeight),
                    color: effectivePillText,
                  }}
                  className="font-display leading-none tracking-tight truncate font-bold"
                >
                  {formattedPrice}
                </span>
              </div>
              <span
                style={{ fontSize: `${unitFontSize}px`, fontWeight: 700 }}
                className="text-white uppercase leading-none pl-1 shrink-0 font-bold"
              >
                {unitLabel}
              </span>
            </div>
          ) : (
            <div className={`w-full ${pricePillHeight} bg-neutral-100 text-neutral-500 font-bold text-sm rounded-full flex items-center justify-center border border-dashed border-neutral-300`}>
              Preço a conferir
            </div>
          )}

          {/* Faixa de Validade */}
          {showValidity && validityText && (
            <div
              style={{ backgroundColor: effectiveValidityBg, color: effectiveValidityText }}
              className={`w-full h-[26px] min-h-[26px] px-2 rounded-xs flex items-center justify-center text-center font-bold text-[20px] leading-tight tracking-wide uppercase ${
                isExpired ? "animate-pulse" : ""
              }`}
              title={`Validade: ${validityText}`}
            >
              VALIDADE: {validityText}
            </div>
          )}

          {/* Faixa de Estoque */}
          {showStock && stockText && (
            <div
              style={{ backgroundColor: effectiveStockBg, color: effectiveStockText }}
              className="w-full h-[26px] min-h-[26px] px-2 rounded-xs flex items-center justify-center text-center font-bold text-[20px] leading-tight tracking-wide uppercase"
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
