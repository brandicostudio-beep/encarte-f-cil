import React from "react";
import type { ColecaoProduct } from "@/types/colecoes";
import { resolveCardDisplayData } from "@/lib/colecoes-layout";
import { ImageIcon } from "lucide-react";

interface ColecaoCardProps {
  product: ColecaoProduct;
  width?: number;
  height?: number;
}

export const ColecaoCard: React.FC<ColecaoCardProps> = ({
  product,
  width = 255,
  height = 275,
}) => {
  const display = resolveCardDisplayData(product);

  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden p-2 text-white select-none transition-all"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: "border-box",
      }}
      data-testid={`colecao-card-${product.code}`}
      data-principal={display.isPrincipal ? "true" : "false"}
    >
      {/* 1. DUAS POSIÇÕES DE FOTO LADO A LADO */}
      <div className="flex h-[165px] w-full items-center justify-center gap-1.5 pt-1">
        {/* Posição 1 (Esquerda) */}
        <div className="relative flex h-full flex-1 items-center justify-center rounded-md bg-white/10 p-1 backdrop-blur-2xs shadow-inner">
          {display.photo1 ? (
            <img
              src={display.photo1}
              alt={display.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/40">
              <ImageIcon className="h-6 w-6 stroke-[1.5]" />
              <span className="text-[9px] mt-0.5">Sem foto</span>
            </div>
          )}
        </div>

        {/* Posição 2 (Direita) */}
        <div className="relative flex h-full flex-1 items-center justify-center rounded-md bg-white/10 p-1 backdrop-blur-2xs shadow-inner">
          {display.photo2 ? (
            <img
              src={display.photo2}
              alt={display.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/40">
              <ImageIcon className="h-6 w-6 stroke-[1.5]" />
              <span className="text-[9px] mt-0.5">Sem foto</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. ÁREA DE TEXTO E CÓDIGO */}
      <div className="flex flex-col justify-end text-center pb-1 pt-1.5">
        {/* Código do produto (Presente APENAS na Regra 3 - Não Principal) */}
        {display.code && (
          <div className="text-[11px] font-mono font-bold tracking-wider text-[#FFD400]/95 leading-none mb-1">
            CÓD: {display.code}
          </div>
        )}

        {/* Descrição do Produto (Genérica se Principal, Completa se Não-Principal) */}
        <div
          className="line-clamp-2 text-[12px] font-black uppercase leading-tight tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          title={display.title}
        >
          {display.title}
        </div>
      </div>
    </div>
  );
};
