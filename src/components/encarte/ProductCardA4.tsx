import React from "react";
import type { EncarteProduct, StoreConfig } from "@/types/encarte";
import { BADGE_LABELS } from "@/types/encarte";
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
  // Regra do layout: a imagem ocupa ~40% da largura e alterna de lado a cada item (esquerda, direita, esquerda...)
  const isImageLeft = index % 2 === 0;

  // Preço formatado
  const [reais, centavos] = (product.price || "0,00").split(",");

  // Cores personalizadas da loja ou padrão
  const primaryBg = store.primaryColor || "#dc2626";
  const accentColor = store.accentColor || "#facc15";

  // Verificar se validade e estoque existem para exibir ou ocultar
  const hasValidity = Boolean(product.validity && product.validity.trim() !== "");
  const hasStock = Boolean(product.stock && product.stock.trim() !== "");

  return (
    <div
      className={`relative flex ${
        isImageLeft ? "flex-row" : "flex-row-reverse"
      } w-full items-center rounded-2xl bg-white p-2.5 shadow-md border-2 border-neutral-100 overflow-hidden ${
        isCompactPage ? "h-[200px]" : "h-[168px]"
      }`}
    >
      {/* Selo Promocional (OFERTA, LEVE JÁ, IMPERDÍVEL) */}
      {product.badge && product.badge !== "nenhum" && (
        <div
          className={`absolute z-10 top-1.5 ${
            isImageLeft ? "left-1.5 -rotate-6" : "right-1.5 rotate-6"
          } px-2.5 py-0.5 rounded-md font-display text-[11px] font-black tracking-wider uppercase shadow-md border border-black/20`}
          style={{
            backgroundColor: product.badge === "oferta" ? accentColor : primaryBg,
            color: product.badge === "oferta" ? "#000000" : "#ffffff",
          }}
        >
          {BADGE_LABELS[product.badge]}
        </div>
      )}

      {/* Bloco de Imagem (~40% da largura) */}
      <div className="relative flex h-full w-[40%] shrink-0 items-center justify-center p-1 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain filter drop-shadow-sm transition-transform"
            onError={(e) => {
              // Se a imagem falhar ao carregar, exibe placeholder neutro sem quebrar o layout
              (e.currentTarget as HTMLElement).style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = parent.querySelector(".fallback-placeholder");
                if (fallback) fallback.classList.remove("hidden");
              }
            }}
          />
        ) : null}

        {/* Placeholder neutro com nome do produto se ausente ou com erro */}
        <div
          className={`fallback-placeholder ${
            product.image ? "hidden" : "flex"
          } flex-col h-full w-full items-center justify-center rounded-xl bg-neutral-100 p-2 text-center text-neutral-400 border border-dashed border-neutral-300`}
        >
          <Package className="h-6 w-6 text-neutral-400 mb-1 shrink-0" />
          <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2 text-neutral-500">
            {product.name || "Produto"}
          </span>
        </div>
      </div>

      {/* Bloco de Textos (~60% da largura) */}
      <div
        className={`flex h-full w-[60%] flex-col justify-between ${
          isImageLeft ? "pl-2.5 pr-1" : "pr-2.5 pl-1"
        } py-0.5`}
      >
        {/* 1. Código e embalagem em vermelho pequeno (nunca cortado) */}
        <div className="flex items-center gap-1 font-bold text-[10.5px] text-red-600 uppercase tracking-tight shrink-0">
          <span className="font-mono font-bold shrink-0">{product.code || "---"}</span>
          {product.packaging && product.packaging.trim() && (
            <>
              <span className="shrink-0">·</span>
              <span className="truncate">{product.packaging}</span>
            </>
          )}
        </div>

        {/* 2. Nome em caixa-alta, negrito, vermelho escuro, no máximo 2 linhas */}
        <h3
          className="font-black uppercase tracking-tight text-neutral-900 leading-[1.12] line-clamp-2"
          style={{
            fontSize: product.name.length > 40 ? "11px" : product.name.length > 25 ? "12px" : "13px",
            color: "#8a0e0e",
          }}
        >
          {product.name || "NOME DO PRODUTO"}
        </h3>

        {/* 3. Tag de preço: pílula vermelha com "R$" e o valor em amarelo condensado */}
        <div className="flex items-center justify-center my-0.5 shrink-0">
          <div
            className="w-full inline-flex items-baseline justify-center gap-1 rounded-full px-2.5 py-0.5 shadow-sm"
            style={{ backgroundColor: primaryBg }}
          >
            <span
              className="text-[11px] font-black uppercase"
              style={{ color: accentColor }}
            >
              R$
            </span>
            <span
              className="font-display text-[26px] font-black leading-none tracking-tight"
              style={{ color: accentColor }}
            >
              {reais}
            </span>
            <span
              className="font-display text-[16px] font-black leading-none"
              style={{ color: accentColor }}
            >
              ,{centavos || "00"}
            </span>
            <span className="text-[9.5px] font-bold text-white uppercase ml-0.5">
              {product.unit || "UND"}
            </span>
          </div>
        </div>

        {/* 4. Faixa preta com "VALIDADE: dd/mm/aaaa" em branco, SOMENTE se a validade existir */}
        {hasValidity ? (
          <div className="rounded bg-black px-1.5 py-0.5 text-center text-[9.5px] font-black tracking-wider text-white uppercase truncate shrink-0">
            VALIDADE: {product.validity}
          </div>
        ) : null}

        {/* 5. "ESTOQUE: X UND" em vermelho, SOMENTE se o campo de estoque estiver preenchido */}
        {hasStock ? (
          <div className="text-center text-[9px] font-black uppercase text-red-600 truncate leading-none pt-0.5 shrink-0">
            ESTOQUE: {product.stock}
          </div>
        ) : null}
      </div>
    </div>
  );
};
