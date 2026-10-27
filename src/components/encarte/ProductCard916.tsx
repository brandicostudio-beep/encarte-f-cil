import React from "react";
import type { EncarteProduct, StoreConfig, ProductsPerPageOption } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { BADGE_LABELS } from "@/types/encarte";
import { AlertCircle, Calendar, Package } from "lucide-react";

interface ProductCard916Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "grid" | "hero";
  perPage?: ProductsPerPageOption;
}

/**
 * Card de produto exclusivo para o formato Story 9:16 (1080 × 1920 px).
 * Diagramação profissional de alto impacto para varejo de supermercado:
 * - Preço protagonista com contraste estrondoso (vermelho + amarelo + branco) e tipografia display;
 * - Foto generosa ocupando ~50% da altura do card com sombra suave;
 * - Título em 2 linhas com altura fixa para alinhamento horizontal milimétrico em grade;
 * - Especificações técnicas (código e embalagem/gramatura) nítidas e separadas;
 * - Validade destacada em etiqueta própria de alta legibilidade para a campanha de validade curta.
 */
export const ProductCard916: React.FC<ProductCard916Props> = ({
  product,
  store,
  layoutMode = "grid",
  perPage = 12,
}) => {
  const isExpired = isDateExpired(product?.validity || "");

  // Formatação do preço com separação precisa de reais e centavos
  const rawPrice = product?.price ? String(product.price).trim() : "";
  let priceReais = "";
  let priceCents = "00";
  if (rawPrice) {
    const clean = rawPrice.replace(".", ",");
    const parts = clean.split(",");
    priceReais = parts[0] ?? "";
    priceCents = parts[1] ? parts[1].padEnd(2, "0").slice(0, 2) : "00";
  }

  // Especificação de Embalagem e Gramatura
  const packagingText = product?.packaging ? String(product.packaging).trim() : "";

  // 1. MODO HERO: Quando há apenas 1 produto na última página (ocupa o centro em destaque gigante)
  if (layoutMode === "hero") {
    return (
      <div className="relative w-full max-w-[840px] h-[950px] mx-auto bg-white rounded-3xl border-4 border-red-600 shadow-2xl flex flex-col items-center justify-between p-8 text-neutral-900 overflow-hidden">
        {/* Selo Promocional de Destaque se houver */}
        {product.badge && product.badge !== "nenhum" && (
          <div className="absolute top-6 left-6 z-20 bg-gradient-to-r from-yellow-400 to-amber-400 text-black font-black text-2xl px-6 py-2 rounded-xl shadow-lg border-2 border-black tracking-wider uppercase transform -rotate-3">
            ★ {BADGE_LABELS[product.badge]} ★
          </div>
        )}

        {/* Foto Gigante do Produto */}
        <div className="relative w-full h-[480px] flex items-center justify-center p-6 bg-neutral-50/60 rounded-2xl border-2 border-neutral-200 overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain filter drop-shadow-2xl"
              crossOrigin="anonymous"
              loading="eager"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <Package className="h-24 w-24 text-neutral-300 mb-3" />
              <span className="text-xl font-bold uppercase tracking-wider text-neutral-600">
                {product.name}
              </span>
            </div>
          )}
        </div>

        {/* Informações Centrais */}
        <div className="w-full text-center space-y-3 mt-4">
          <h2 className="font-sans text-3xl font-black uppercase text-neutral-950 tracking-tight leading-snug line-clamp-2 px-4">
            {product.name}
          </h2>

          <div className="flex items-center justify-center gap-3">
            {product.code && (
              <span className="bg-red-50 text-red-700 border-2 border-red-200 font-mono font-black text-lg px-4 py-1.5 rounded-xl">
                CÓD. {product.code}
              </span>
            )}
            {packagingText && (
              <span className="bg-neutral-900 text-white font-sans font-bold text-lg px-4 py-1.5 rounded-xl uppercase">
                {packagingText}
              </span>
            )}
          </div>
        </div>

        {/* Bloco de Preço & Validade em Explosão Promocional */}
        <div className="w-full flex items-center justify-between gap-6 pt-5 border-t-2 border-neutral-200 mt-2">
          {product.validity ? (
            <div
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-lg font-black ${
                isExpired
                  ? "bg-red-100 text-red-700 border-2 border-red-500 animate-pulse"
                  : "bg-amber-100 text-amber-950 border border-amber-300"
              }`}
            >
              {isExpired ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : (
                <Calendar className="h-6 w-6 text-amber-700" />
              )}
              <span>VALIDADE: {product.validity}</span>
            </div>
          ) : (
            <div />
          )}

          {rawPrice ? (
            <div className="flex-1 flex justify-end">
              <div className="inline-flex items-baseline bg-gradient-to-b from-red-600 to-red-700 text-yellow-300 px-8 py-3 rounded-2xl shadow-2xl border-4 border-[#FFD400]">
                <span className="text-2xl font-black mr-2 text-yellow-300">R$</span>
                <span className="font-display text-7xl font-black leading-none text-white tracking-tight">
                  {priceReais}
                </span>
                <span className="font-display text-4xl font-black leading-none text-yellow-300 ml-1 self-start -translate-y-2">
                  ,{priceCents}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 bg-neutral-200 text-neutral-600 font-bold text-lg rounded-xl">
              Preço a conferir
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. MODO GRADE PADRÃO: Escala tipográfica e de fotos adaptativa conforme a quantidade de produtos por página
  const sizeConfig = {
    6: {
      photoHeight: "h-[195px]",
      titleClass: "text-[18px] sm:text-[19.5px] h-[46px]",
      codeClass: "text-[12px]",
      packClass: "text-[13px]",
      valClass: "text-[13px]",
      valLabelClass: "text-[10px]",
      reaisClass: "text-[46px] sm:text-[50px]",
      centsClass: "text-[23px] sm:text-[25px]",
      rsClass: "text-[16px]",
      badgeClass: "text-[12px] px-3 py-1",
      pricePadding: "px-4 py-1.5",
    },
    8: {
      photoHeight: "h-[145px]",
      titleClass: "text-[15.5px] sm:text-[16.5px] h-[40px]",
      codeClass: "text-[11px]",
      packClass: "text-[12px]",
      valClass: "text-[12px]",
      valLabelClass: "text-[9px]",
      reaisClass: "text-[38px] sm:text-[42px]",
      centsClass: "text-[19px] sm:text-[21px]",
      rsClass: "text-[14px]",
      badgeClass: "text-[11px] px-2.5 py-0.5",
      pricePadding: "px-3.5 py-1",
    },
    9: {
      photoHeight: "h-[180px]",
      titleClass: "text-[16px] sm:text-[17px] h-[42px]",
      codeClass: "text-[11.5px]",
      packClass: "text-[12.5px]",
      valClass: "text-[12px]",
      valLabelClass: "text-[9.5px]",
      reaisClass: "text-[40px] sm:text-[44px]",
      centsClass: "text-[20px] sm:text-[22px]",
      rsClass: "text-[14px]",
      badgeClass: "text-[11px] px-2.5 py-0.5",
      pricePadding: "px-3.5 py-1",
    },
    12: {
      photoHeight: "h-[135px]",
      titleClass: "text-[13.5px] sm:text-[14.5px] h-[34px]",
      codeClass: "text-[10px]",
      packClass: "text-[11px]",
      valClass: "text-[11px]",
      valLabelClass: "text-[8.5px]",
      reaisClass: "text-[32px] sm:text-[36px]",
      centsClass: "text-[16px] sm:text-[18px]",
      rsClass: "text-[12px]",
      badgeClass: "text-[9.5px] px-2 py-0.5",
      pricePadding: "px-2.5 py-0.5",
    },
  }[perPage || 12];

  return (
    <div className="relative w-full h-full bg-white rounded-2xl border-2 border-neutral-200/90 shadow-[0_3px_10px_rgba(0,0,0,0.06)] hover:border-red-500 hover:shadow-lg flex flex-col justify-between p-2.5 text-neutral-900 overflow-hidden transition-all duration-150">
      {/* Selo Promocional Angulado no Canto Superior */}
      {product.badge && product.badge !== "nenhum" && (
        <div
          className={`absolute top-2 left-2 z-10 bg-gradient-to-r from-[#FFD400] to-[#FACC15] text-[#0D0D0D] font-black ${sizeConfig.badgeClass} rounded shadow-sm border border-black/20 uppercase tracking-wider transform -rotate-2`}
        >
          ★ {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* 1. Área da Foto: Generosa, centralizada e com sombra natural */}
      <div
        className={`relative w-full flex-1 ${sizeConfig.photoHeight} flex items-center justify-center p-1 overflow-hidden`}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:scale-105"
            crossOrigin="anonymous"
            loading="eager"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-neutral-50 border border-dashed border-neutral-200 text-neutral-400 w-full h-full">
            <Package className="h-8 w-8 text-neutral-300 mb-1" />
            <span className="text-[10.5px] font-bold uppercase text-neutral-500 line-clamp-1">
              {product.name}
            </span>
          </div>
        )}
      </div>

      {/* 2. Informações Textuais do Produto */}
      <div className="w-full flex flex-col gap-0.5 mt-1 shrink-0">
        {/* Nome do Produto: Fonte encorpada com altura calibrada para alinhamento uniforme */}
        <h3
          className={`font-sans font-black uppercase text-[#0F172A] tracking-tight leading-[1.15] line-clamp-2 ${sizeConfig.titleClass} flex items-center`}
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Linha de Especificação: CÓDIGO + EMBALAGEM / GRAMATURA */}
        <div className="flex items-center gap-1.5 truncate mt-0.5">
          {product.code && (
            <span
              className={`font-mono font-black text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded shrink-0 ${sizeConfig.codeClass}`}
            >
              CÓD. {product.code}
            </span>
          )}
          {packagingText && (
            <span
              className={`truncate uppercase text-neutral-700 font-bold ${sizeConfig.packClass}`}
              title={packagingText}
            >
              {packagingText}
            </span>
          )}
        </div>
      </div>

      {/* 3. Rodapé do Card: Validade em Destaque + Splash de Preço Promocional */}
      <div className="w-full flex items-end justify-between gap-1 pt-1.5 border-t border-neutral-100 mt-1 shrink-0">
        {/* Bloco de Validade (Campanha de Validade Curta) */}
        {product.validity ? (
          <div className="flex flex-col items-start shrink-0 max-w-[46%]">
            <span
              className={`font-black uppercase tracking-wider text-neutral-400 leading-none mb-0.5 ${sizeConfig.valLabelClass}`}
            >
              Validade
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono font-extrabold ${sizeConfig.valClass} px-1.5 py-0.5 rounded border leading-none truncate max-w-full ${
                isExpired
                  ? "bg-red-50 text-red-700 border-red-300 font-black animate-pulse"
                  : "bg-amber-50 text-amber-950 border-amber-300"
              }`}
              title={`Validade: ${product.validity}`}
            >
              {isExpired && <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />}
              <span className="truncate">{product.validity}</span>
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Super Splash de Preço de Varejo */}
        {rawPrice ? (
          <div
            className={`inline-flex items-baseline bg-gradient-to-b from-[#E30613] to-[#B30009] text-white ${sizeConfig.pricePadding} rounded-xl shadow-[0_3px_8px_rgba(227,6,19,0.3)] border-2 border-[#FFD400] shrink-0`}
          >
            <span
              className={`font-black text-[#FFD400] mr-0.5 leading-none self-start mt-1 ${sizeConfig.rsClass}`}
            >
              R$
            </span>
            <span
              className={`font-display font-black leading-none text-white tracking-tight ${sizeConfig.reaisClass}`}
            >
              {priceReais}
            </span>
            <span
              className={`font-display font-black leading-none text-[#FFD400] ml-0.5 self-start mt-0.5 ${sizeConfig.centsClass}`}
            >
              ,{priceCents}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-1 rounded">
            Sem preço
          </span>
        )}
      </div>
    </div>
  );
};
