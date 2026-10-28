import React, { useState } from "react";
import type { EncarteProduct, StoreConfig } from "@/types/encarte";
import { BADGE_LABELS } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { Package } from "lucide-react";
import { calculateOpticalScale } from "@/lib/image-normalizer";
import { deriveSaleUnit } from "@/lib/parse-product";

interface ProductCardA4Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "vertical" | "horizontal" | "hero";
}

export const ProductCardA4: React.FC<ProductCardA4Props> = ({
  product,
  index,
  store,
  layoutMode = "vertical",
}) => {
  const isImageLeft = index % 2 === 0;

  // Preço formatado com segurança para qualquer formato (string ou número)
  const [reais, centavos] = String(product?.price || "0,00").replace(".", ",").split(",");

  // Unidade de venda derivada da embalagem
  const saleUnit = deriveSaleUnit(product?.packaging, product?.unit).unit;

  // Cores institucionais
  const primaryColor = store?.primaryColor || DESIGN_TOKENS.colors.primary;
  const accentColor = store?.accentColor || DESIGN_TOKENS.colors.accent;
  const nameColor = DESIGN_TOKENS.colors.nameBurgundy; // #8B0000

  // Linhas opcionais
  const hasValidity = Boolean(product?.validity && String(product.validity).trim() !== "");
  const hasStock = Boolean(product?.stock && String(product.stock).trim() !== "");

  // Código e embalagem em texto único (ex: "23396 · PACOTE 1X24 UNID")
  const codePackagingText = product?.packaging
    ? `${product?.code || "---"} · ${product.packaging}`
    : product?.code || "---";

  // Normalização óptica para que garrafas estreitas e pacotes volumosos fiquem proporcionais
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

  // 1. FORMATO HERO (Última página com 1 único produto ocupando a página inteira)
  if (layoutMode === "hero") {
    return (
      <div
        className="relative flex flex-col items-center justify-between w-full h-full max-h-[720px] max-w-[660px] mx-auto rounded-3xl bg-white p-6 shadow-2xl border-4 border-neutral-200 overflow-hidden"
        style={{ boxSizing: "border-box" }}
      >
        {/* Selo Destaque Gigante */}
        {product.badge && product.badge !== "nenhum" && (
          <div
            className="absolute z-10 top-4 right-4 px-5 py-1.5 rounded-lg font-display text-sm font-black tracking-widest uppercase shadow-lg border border-black/20 -rotate-3"
            style={{
              backgroundColor: product.badge === "oferta" ? accentColor : primaryColor,
              color: product.badge === "oferta" ? "#0D0D0D" : "#FFFFFF",
            }}
          >
            {BADGE_LABELS[product.badge]}
          </div>
        )}

        {/* Nível 3: Código · Embalagem */}
        <div className="w-full text-center font-bold text-base text-red-600 uppercase tracking-wide shrink-0">
          <span className="font-mono bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            {codePackagingText}
          </span>
        </div>

        {/* Nível 2: Nome do Produto em Destaque */}
        <h2
          className="w-full text-center font-black uppercase tracking-tight leading-tight line-clamp-2 px-4 my-2 text-2xl"
          style={{ color: nameColor }}
        >
          {product.name || "NOME DO PRODUTO"}
        </h2>

        {/* Bloco Central da Foto Ampliada */}
        <div className="relative flex flex-1 w-full items-center justify-center p-4 overflow-hidden bg-white max-h-[360px]">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              onLoad={handleImageLoad}
              style={{
                transform: `scale(${totalScale})`,
                transformOrigin: "center center",
              }}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
            />
          ) : (
            <div className="flex flex-col h-full w-full items-center justify-center rounded-2xl bg-neutral-100 p-6 text-center text-neutral-400 border-2 border-dashed border-neutral-300">
              <Package className="h-16 w-16 text-neutral-400 mb-2" />
              <span className="text-sm font-bold uppercase text-neutral-500">
                {product.name || "Foto do Produto"}
              </span>
            </div>
          )}
        </div>

        {/* Nível 1: Super Tag de Preço Gigante Protagonista */}
        <div className="w-full flex items-center justify-center my-2 shrink-0">
          <div
            className="inline-flex items-baseline justify-center gap-2 rounded-full px-8 py-2.5 shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <span
              className="text-lg font-black uppercase"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              R$
            </span>
            <span
              className="font-display font-black leading-none tracking-tight text-[54pt]"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              {reais}
            </span>
            <span
              className="font-display font-black leading-none text-[32pt]"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              ,{centavos || "00"}
            </span>
            <span className="text-base font-black text-white uppercase ml-1 tracking-wider">
              {saleUnit}
            </span>
          </div>
        </div>

        {/* Nível 3: Validade e Estoque */}
        <div className="w-full flex items-center justify-center gap-4 mt-1 shrink-0">
          {hasValidity && (
            <div className="rounded-md bg-[#0D0D0D] px-4 py-1 text-xs font-black tracking-wider text-white uppercase">
              VALIDADE: {product.validity}
            </div>
          )}
          {hasStock && (
            <div className="text-xs font-black uppercase text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-md">
              ESTOQUE: {product.stock}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. FORMATO VERTICAL (Padrão para 12 e 9 produtos por página: 3 colunas)
  // Imagem em cima e texto embaixo: nome, embalagem, preço, validade e estoque
  if (layoutMode === "vertical") {
    return (
      <div
        className="relative flex flex-col justify-between w-full h-full rounded-2xl bg-white p-2 shadow-sm border border-neutral-200 overflow-hidden"
        style={{ boxSizing: "border-box" }}
      >
        {/* Selo Opcional no Canto Superior */}
        {product.badge && product.badge !== "nenhum" && (
          <div
            className="absolute z-10 top-1 right-1 px-1.5 py-0.5 rounded font-display text-[8.5px] font-black tracking-wider uppercase shadow-xs border border-black/20"
            style={{
              backgroundColor: product.badge === "oferta" ? accentColor : primaryColor,
              color: product.badge === "oferta" ? "#0D0D0D" : "#FFFFFF",
            }}
          >
            {BADGE_LABELS[product.badge]}
          </div>
        )}

        {/* Bloco Superior da Imagem (~45% da altura) */}
        <div className="relative flex h-[46%] w-full shrink-0 items-center justify-center p-1 overflow-hidden bg-white">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              onLoad={handleImageLoad}
              style={{
                transform: `scale(${totalScale})`,
                transformOrigin: "center center",
              }}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
            />
          ) : (
            <div className="flex flex-col h-full w-full items-center justify-center rounded-lg bg-neutral-100 p-1 text-center text-neutral-400 border border-dashed border-neutral-300">
              <Package className="h-5 w-5 text-neutral-400 mb-0.5 shrink-0" />
              <span className="text-[8px] font-bold uppercase leading-tight line-clamp-1 text-neutral-500">
                {product.name || "Foto"}
              </span>
            </div>
          )}
        </div>

        {/* Bloco Inferior de Textos (~54% da altura) */}
        <div className="flex flex-1 flex-col justify-between pt-1">
          {/* Código · Embalagem em texto único */}
          <div className="font-bold text-[7.5pt] text-red-600 uppercase tracking-tight truncate leading-tight">
            {codePackagingText}
          </div>

          {/* Nome do produto (1 a 2 linhas) */}
          <h3
            className="font-black uppercase tracking-tight leading-[1.1] line-clamp-2 my-0.5"
            style={{
              fontSize: product.name.length > 35 ? "8pt" : "8.5pt",
              color: nameColor,
            }}
            title={product.name}
          >
            {product.name || "NOME DO PRODUTO"}
          </h3>

          {/* Tag de Preço Protagonista */}
          <div className="flex items-center justify-center my-0.5 shrink-0">
            <div
              className="w-full inline-flex items-baseline justify-center gap-0.5 rounded-full px-1.5 py-0.5 shadow-2xs"
              style={{ backgroundColor: primaryColor }}
            >
              <span
                className="text-[8.5px] font-black uppercase"
                style={{
                  color: accentColor,
                  textShadow: DESIGN_TOKENS.accessibility.priceShadow,
                }}
              >
                R$
              </span>
              <span
                className="font-display font-black leading-none tracking-tight text-[18pt]"
                style={{
                  color: accentColor,
                  textShadow: DESIGN_TOKENS.accessibility.priceShadow,
                }}
              >
                {reais}
              </span>
              <span
                className="font-display font-black leading-none text-[11.5pt]"
                style={{
                  color: accentColor,
                  textShadow: DESIGN_TOKENS.accessibility.priceShadow,
                }}
              >
                ,{centavos || "00"}
              </span>
              <span className="text-[7.5pt] font-black text-white uppercase ml-0.5">
                {saleUnit}
              </span>
            </div>
          </div>

          {/* Validade e Estoque */}
          <div className="flex items-center justify-between gap-1 text-[6.5pt] shrink-0 pt-0.5">
            {hasValidity ? (
              <div className="rounded bg-[#0D0D0D] px-1 py-0.5 text-center font-black tracking-wider text-white uppercase truncate flex-1">
                VAL: {product.validity}
              </div>
            ) : null}
            {hasStock ? (
              <div className="text-center font-bold text-red-600 truncate flex-1">
                EST: {product.stock}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // 3. FORMATO HORIZONTAL (Para 2 colunas: 8 e 6 produtos por página)
  return (
    <div
      className={`relative flex ${
        isImageLeft ? "flex-row" : "flex-row-reverse"
      } w-full h-full items-center rounded-2xl bg-white p-2.5 shadow-md border-2 border-neutral-100 overflow-hidden`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Selo Opcional */}
      {product.badge && product.badge !== "nenhum" && (
        <div
          className={`absolute z-10 top-1.5 ${
            isImageLeft ? "left-1.5 -rotate-6" : "right-1.5 rotate-6"
          } px-2.5 py-0.5 rounded-md font-display text-[10.5px] font-black tracking-wider uppercase shadow-md border border-black/20`}
          style={{
            backgroundColor: product.badge === "oferta" ? accentColor : primaryColor,
            color: product.badge === "oferta" ? "#0D0D0D" : "#FFFFFF",
          }}
        >
          {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* BLOCO DA IMAGEM (~40% da largura) */}
      <div className="relative flex h-full w-[40%] shrink-0 items-center justify-center p-1 overflow-hidden bg-white">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            onLoad={handleImageLoad}
            style={{
              transform: `scale(${totalScale})`,
              transformOrigin: "center center",
            }}
            className="max-h-full max-w-full object-contain transition-transform duration-200"
          />
        ) : (
          <div className="flex flex-col h-full w-full items-center justify-center rounded-xl bg-neutral-100 p-2 text-center text-neutral-400 border border-dashed border-neutral-300">
            <Package className="h-6 w-6 text-neutral-400 mb-1 shrink-0" />
            <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2 text-neutral-500">
              {product.name || "Foto"}
            </span>
          </div>
        )}
      </div>

      {/* BLOCO DE TEXTOS (~60% da largura) */}
      <div
        className={`flex h-full w-[60%] flex-col justify-between ${
          isImageLeft ? "pl-2.5 pr-1" : "pr-2.5 pl-1"
        } py-0.5`}
      >
        {/* NÍVEL 3: Código · Embalagem em texto único */}
        <div className="font-bold text-[9pt] text-red-600 uppercase tracking-tight shrink-0 truncate">
          {codePackagingText}
        </div>

        {/* NÍVEL 2: Nome do produto */}
        <h3
          className="font-black uppercase tracking-tight leading-[1.12] line-clamp-2"
          style={{
            fontSize: product.name.length > 40 ? "10.5pt" : "12pt",
            color: nameColor,
          }}
        >
          {product.name || "NOME DO PRODUTO"}
        </h3>

        {/* NÍVEL 1: Tag de Preço */}
        <div className="flex items-center justify-center my-0.5 shrink-0">
          <div
            className="w-full inline-flex items-baseline justify-center gap-1 rounded-full px-2.5 py-0.5 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <span
              className="text-[11px] font-black uppercase"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              R$
            </span>
            <span
              className="font-display font-black leading-none tracking-tight text-[28pt]"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              {reais}
            </span>
            <span
              className="font-display font-black leading-none text-[17pt]"
              style={{
                color: accentColor,
                textShadow: DESIGN_TOKENS.accessibility.priceShadow,
              }}
            >
              ,{centavos || "00"}
            </span>
            <span className="text-[9.5pt] font-black text-white uppercase ml-0.5 tracking-wider">
              {saleUnit}
            </span>
          </div>
        </div>

        {/* NÍVEL 3: Validade */}
        {hasValidity && (
          <div className="rounded bg-[#0D0D0D] px-1.5 py-0.5 text-center text-[8.5pt] font-black tracking-wider text-white uppercase truncate shrink-0">
            VALIDADE: {product.validity}
          </div>
        )}

        {/* NÍVEL 3: Estoque */}
        {hasStock && (
          <div className="text-center text-[8.5pt] font-black uppercase text-red-600 truncate leading-none pt-0.5 shrink-0">
            ESTOQUE: {product.stock}
          </div>
        )}
      </div>
    </div>
  );
};
