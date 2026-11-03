import React, { useState, useEffect } from "react";
import type { ColecaoProduct } from "@/types/colecoes";
import { resolveCardDisplayData } from "@/lib/colecoes-layout";
import { removeWhiteBackground } from "@/lib/colecoes-image-processor";
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

  const [processedPhoto1, setProcessedPhoto1] = useState<string>(display.photo1);
  const [processedPhoto2, setProcessedPhoto2] = useState<string>(display.photo2);

  // Recorta fundo branco/cinza em tempo real gerando PNG transparente
  useEffect(() => {
    let isCurrent = true;
    if (display.photo1) {
      removeWhiteBackground(display.photo1).then((url) => {
        if (isCurrent && url) setProcessedPhoto1(url);
      });
    } else {
      setProcessedPhoto1("");
    }

    if (display.photo2) {
      if (display.photo2 === display.photo1) {
        // Mesma foto, reusa
        removeWhiteBackground(display.photo1).then((url) => {
          if (isCurrent && url) setProcessedPhoto2(url);
        });
      } else {
        removeWhiteBackground(display.photo2).then((url) => {
          if (isCurrent && url) setProcessedPhoto2(url);
        });
      }
    } else {
      setProcessedPhoto2("");
    }

    return () => {
      isCurrent = false;
    };
  }, [display.photo1, display.photo2]);

  return (
    <div
      className="relative flex flex-col items-center justify-start overflow-hidden px-1.5 py-1 text-white select-none transition-all"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: "border-box",
      }}
      data-testid={`colecao-card-${product.code}`}
      data-principal={display.isPrincipal ? "true" : "false"}
    >
      {/* 1. BLOCO ÚNICO (UMA ÚNICA CAIXA COM AS FOTOS DENTRO - NUNCA UMA CAIXA SEPARADA POR FOTO) */}
      <div
        className="relative w-full h-[176px] rounded-xl bg-[#240407]/90 border border-[#521017]/80 flex items-center justify-around gap-2 px-2 py-1 shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]"
        data-testid="colecao-single-block"
      >
        {/* Posição 1 (Esquerda) */}
        <div className="relative flex-1 h-full flex items-center justify-center overflow-hidden">
          {processedPhoto1 ? (
            <img
              src={processedPhoto1}
              alt={display.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
              style={{ mixBlendMode: "multiply" }}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-red-300/40">
              <ImageIcon className="h-6 w-6 stroke-[1.5]" />
              <span className="text-[9px] mt-0.5 font-bold">Sem foto</span>
            </div>
          )}
        </div>

        {/* Posição 2 (Direita) */}
        <div className="relative flex-1 h-full flex items-center justify-center overflow-hidden">
          {processedPhoto2 ? (
            <img
              src={processedPhoto2}
              alt={display.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
              style={{ mixBlendMode: "multiply" }}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-red-300/40">
              <ImageIcon className="h-6 w-6 stroke-[1.5]" />
              <span className="text-[9px] mt-0.5 font-bold">Sem foto</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. ABAIXO DO BLOCO: CÓDIGO EM AMARELO E NOME EM BRANCO EM CAIXA ALTA */}
      <div className="w-full flex flex-col items-center justify-center text-center mt-2 px-1">
        {/* Código do produto em amarelo (CÓD: xxxxx) */}
        {display.code && (
          <div
            className="text-[12px] font-mono font-black tracking-wider text-[#FFE600] leading-none mb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] uppercase"
            data-testid="colecao-card-code"
          >
            CÓD: {display.code}
          </div>
        )}

        {/* Nome do Produto em branco, em caixa alta */}
        <div
          className="line-clamp-2 text-[12px] font-black uppercase leading-tight tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] max-w-full text-center"
          title={display.title}
          data-testid="colecao-card-title"
        >
          {display.title}
        </div>
      </div>
    </div>
  );
};
