import React from "react";
import type { EncarteProduct, StoreConfig } from "@/types/encarte";
import { BADGE_LABELS } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { Package } from "lucide-react";

interface ProductCardA4Props {
  product: EncarteProduct;
  index: number;
  store: StoreConfig;
  isCompactPage?: boolean;
}

export const ProductCardA4: React.FC<ProductCardA4Props> = ({
  product,
  index,
  store,
  isCompactPage = false,
}) => {
  // Regra do layout: a imagem ocupa cerca de 40% da largura e alterna de lado a cada item
  const isImageLeft = index % 2 === 0;

  // Preço formatado
  const [reais, centavos] = (product.price || "0,00").split(",");

  // Cores institucionais dos tokens (com override configurável da loja)
  const primaryColor = store.primaryColor || DESIGN_TOKENS.colors.primary;
  const accentColor = store.accentColor || DESIGN_TOKENS.colors.accent;
  const nameColor = DESIGN_TOKENS.colors.nameBurgundy; // #8B0000

  // Linhas opcionais (somem do card quando o dado estiver vazio)
  const hasValidity = Boolean(product.validity && product.validity.trim() !== "");
  const hasStock = Boolean(product.stock && product.stock.trim() !== "");

  return (
    <div
      className={`relative flex ${
        isImageLeft ? "flex-row" : "flex-row-reverse"
      } w-full items-center rounded-2xl bg-white p-2.5 shadow-md border-2 border-neutral-100 overflow-hidden ${
        isCompactPage ? "h-[202px]" : "h-[170px]"
      }`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Selo Opcional (OFERTA, LEVE JÁ, IMPERDÍVEL) - Decorativo, não compete com o preço */}
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

      {/* BLOCO DA IMAGEM (~40% da largura, fundo branco limpo, centralizada, sem distorção) */}
      <div className="relative flex h-full w-[40%] shrink-0 items-center justify-center p-1 overflow-hidden bg-white">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain filter drop-shadow-xs transition-transform"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = parent.querySelector(".fallback-placeholder");
                if (fallback) fallback.classList.remove("hidden");
              }
            }}
          />
        ) : null}

        {/* Placeholder cinza neutro com o nome do produto sem quebrar o card */}
        <div
          className={`fallback-placeholder ${
            product.image ? "hidden" : "flex"
          } flex-col h-full w-full items-center justify-center rounded-xl bg-neutral-100 p-2 text-center text-neutral-400 border border-dashed border-neutral-300`}
        >
          <Package className="h-6 w-6 text-neutral-400 mb-1 shrink-0" />
          <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2 text-neutral-500">
            {product.name || "Foto"}
          </span>
        </div>
      </div>

      {/* BLOCO DE TEXTOS (~60% da largura) */}
      <div
        className={`flex h-full w-[60%] flex-col justify-between ${
          isImageLeft ? "pl-2.5 pr-1" : "pr-2.5 pl-1"
        } py-0.5`}
      >
        {/* NÍVEL 3: Código e embalagem em vermelho pequeno (nunca cortado, escala 8.5pt) */}
        <div className="flex items-center gap-1 font-bold text-[9pt] text-red-600 uppercase tracking-tight shrink-0 truncate">
          <span className="font-mono font-bold shrink-0">{product.code || "---"}</span>
          {product.packaging && (
            <>
              <span className="shrink-0 text-neutral-300">·</span>
              <span className="truncate">{product.packaging}</span>
            </>
          )}
        </div>

        {/* NÍVEL 2: Nome do produto em caixa-alta, negrito, vermelho escuro #8B0000 (11 a 13pt, máx 2 linhas) */}
        <h3
          className="font-black uppercase tracking-tight leading-[1.12] line-clamp-2"
          style={{
            fontSize: product.name.length > 40 ? "10.5pt" : product.name.length > 25 ? "11.5pt" : "12.5pt",
            color: nameColor,
          }}
        >
          {product.name || "NOME DO PRODUTO"}
        </h3>

        {/* NÍVEL 1: PROTAGONISTA - Tag de Preço (28pt+, alto contraste com contorno preto sutil no amarelo sobre vermelho) */}
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
              {product.unit || "UND"}
            </span>
          </div>
        </div>

        {/* NÍVEL 3: Faixa preta com VALIDADE: dd/mm/aaaa (SOMENTE se a validade existir, escala 8.5pt) */}
        {hasValidity ? (
          <div className="rounded bg-[#0D0D0D] px-1.5 py-0.5 text-center text-[8.5pt] font-black tracking-wider text-white uppercase truncate shrink-0">
            VALIDADE: {product.validity}
          </div>
        ) : null}

        {/* NÍVEL 3: ESTOQUE: X UND em vermelho (SOMENTE se o estoque existir, escala 8.5pt) */}
        {hasStock ? (
          <div className="text-center text-[8.5pt] font-black uppercase text-red-600 truncate leading-none pt-0.5 shrink-0">
            ESTOQUE: {product.stock}
          </div>
        ) : null}
      </div>
    </div>
  );
};
