import React from "react";
import type { EncarteProduct, StoreConfig } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { BADGE_LABELS } from "@/types/encarte";
import { AlertCircle, Calendar } from "lucide-react";

interface ProductCard916Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  layoutMode?: "grid" | "hero";
}

/**
 * Card de produto exclusivo para o formato Story 9:16 (1080 × 1920 px).
 * Desenhado para ficar estritamente contido dentro da área branca do template,
 * com contraste forte de varejo promocional, foto nítida e hierarquia clara de preço.
 */
export const ProductCard916: React.FC<ProductCard916Props> = ({
  product,
  store,
  layoutMode = "grid",
}) => {
  const isExpired = isDateExpired(product?.validity || "");

  // Formatação do preço em reais e centavos destacados
  const rawPrice = product?.price ? String(product.price).trim() : "";
  let priceReais = "";
  let priceCents = "";
  if (rawPrice) {
    const parts = rawPrice.split(",");
    priceReais = parts[0] ?? "";
    priceCents = parts[1] ? parts[1].padEnd(2, "0") : "00";
  }

  // Linha unificada: "CÓDIGO · EMBALAGEM · GRAMATURA"
  const detailsParts: string[] = [];
  if (product?.code) detailsParts.push(String(product.code));
  if (product?.packaging) {
    detailsParts.push(String(product.packaging));
  }
  if (
    product?.packagingWeight &&
    !String(product?.packaging || "")
      .toUpperCase()
      .includes(String(product.packagingWeight).toUpperCase())
  ) {
    detailsParts.push(String(product.packagingWeight));
  }
  const codeAndPackaging = detailsParts.join(" · ");

  // 1. MODO HERO: Quando há apenas 1 produto na última página (ocupa o centro em destaque gigante)
  if (layoutMode === "hero") {
    return (
      <div className="relative w-full max-w-[840px] h-[950px] mx-auto bg-white rounded-3xl border-4 border-red-600 shadow-2xl flex flex-col items-center justify-between p-8 text-neutral-900 overflow-hidden">
        {/* Selo Promocional de Destaque se houver */}
        {product.badge && product.badge !== "nenhum" && (
          <div className="absolute top-5 left-5 z-20 bg-yellow-400 text-black font-black text-2xl px-6 py-2 rounded-xl shadow-lg border-2 border-black tracking-wider uppercase transform -rotate-3 animate-pulse">
            ★ {BADGE_LABELS[product.badge]} ★
          </div>
        )}

        {/* Foto Gigante do Produto */}
        <div className="relative w-full h-[460px] flex items-center justify-center p-4 bg-neutral-50/80 rounded-2xl border-2 border-neutral-200 overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain filter drop-shadow-xl"
              crossOrigin="anonymous"
              loading="eager"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <span className="text-6xl mb-3">📦</span>
              <span className="text-xl font-bold uppercase tracking-wider text-neutral-600">
                {product.name}
              </span>
              <span className="text-sm text-neutral-400 mt-1">
                Foto não disponível
              </span>
            </div>
          )}
        </div>

        {/* Informações Centrais */}
        <div className="w-full text-center space-y-3 mt-4">
          <h2 className="font-display text-3xl font-black uppercase text-neutral-950 tracking-tight leading-snug line-clamp-2">
            {product.name}
          </h2>

          {codeAndPackaging && (
            <div className="inline-block bg-neutral-900 text-white font-mono font-bold text-lg px-4 py-1.5 rounded-lg">
              {codeAndPackaging}
            </div>
          )}
        </div>

        {/* Bloco de Preço & Validade em Explosão */}
        <div className="w-full flex items-center justify-between gap-6 pt-4 border-t-2 border-neutral-200">
          {product.validity && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold ${
                isExpired
                  ? "bg-red-100 text-red-700 border-2 border-red-500"
                  : "bg-amber-100 text-amber-950 border border-amber-300"
              }`}
            >
              {isExpired ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : (
                <Calendar className="h-6 w-6 text-amber-700" />
              )}
              <span>VAL: {product.validity}</span>
            </div>
          )}

          {rawPrice ? (
            <div className="flex-1 flex justify-end">
              <div className="inline-flex items-baseline bg-red-600 text-yellow-300 px-8 py-3 rounded-2xl shadow-xl border-4 border-yellow-400">
                <span className="text-2xl font-black mr-2 text-white">R$</span>
                <span className="font-display text-7xl font-black leading-none tracking-tight">
                  {priceReais}
                </span>
                <span className="font-display text-4xl font-black leading-none ml-1 -translate-y-4">
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

  // 2. MODO GRADE PADRÃO (Cards contidos dentro da grade 3x4, 3x3, 2x4, etc.)
  return (
    <div className="relative w-full h-full bg-white rounded-2xl border-2 border-neutral-200/90 shadow-sm flex flex-col justify-between p-2.5 text-neutral-900 overflow-hidden hover:border-red-500 transition-colors">
      {/* Selo Promocional no canto */}
      {product.badge && product.badge !== "nenhum" && (
        <div className="absolute top-1.5 left-1.5 z-10 bg-yellow-400 text-black font-black text-[9px] px-2 py-0.5 rounded shadow-xs border border-black uppercase tracking-wider">
          {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* Área da Foto: Contida e proporcional, sem vazamentos */}
      <div className="relative w-full flex-1 min-h-[90px] flex items-center justify-center p-1 bg-white rounded-xl overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain filter drop-shadow-xs"
            crossOrigin="anonymous"
            loading="eager"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2 text-neutral-300">
            <span className="text-2xl mb-1">📦</span>
            <span className="text-[10px] font-bold uppercase text-neutral-400 line-clamp-1">
              {product.name}
            </span>
          </div>
        )}
      </div>

      {/* Informações Textuais */}
      <div className="w-full flex flex-col gap-0.5 my-1">
        {/* Nome do Produto */}
        <h3
          className="font-bold text-[11px] sm:text-[12px] uppercase text-neutral-900 tracking-tight leading-tight line-clamp-2 h-[28px]"
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Linha única: CÓDIGO · EMBALAGEM */}
        <div className="text-[10px] font-mono font-bold text-neutral-600 truncate">
          {codeAndPackaging || "Cód. -"}
        </div>
      </div>

      {/* Rodapé do Card: Preço com grande energia varejista e Validade */}
      <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-neutral-100">
        {/* Validade */}
        {product.validity ? (
          <div
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${
              isExpired
                ? "bg-red-100 text-red-700 font-black"
                : "bg-amber-100/80 text-amber-900"
            }`}
          >
            {isExpired && <AlertCircle className="h-2.5 w-2.5 text-red-600" />}
            <span>VAL: {product.validity}</span>
          </div>
        ) : (
          <div />
        )}

        {/* Bloco de Preço */}
        {rawPrice ? (
          <div className="inline-flex items-baseline bg-red-600 text-yellow-300 px-2.5 py-0.5 rounded-lg shadow-xs border border-yellow-400 shrink-0">
            <span className="text-[10px] font-bold mr-0.5 text-white">R$</span>
            <span className="font-display text-lg font-black leading-none tracking-tight">
              {priceReais}
            </span>
            <span className="font-display text-xs font-black leading-none ml-0.5 -translate-y-1">
              ,{priceCents}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-semibold text-neutral-400">
            Sem preço
          </span>
        )}
      </div>
    </div>
  );
};
