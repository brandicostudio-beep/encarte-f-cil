import React, { useState, useEffect } from "react";
import type { ColecaoProduct } from "@/types/colecoes";
import { resolveCardDisplayData } from "@/lib/colecoes-layout";
import { removeWhiteBackground } from "@/lib/colecoes-image-processor";
import { ImageIcon, Edit2 } from "lucide-react";

interface ColecaoCardProps {
  product: ColecaoProduct;
  width?: number;
  height?: number;
  productScale?: number;       // % ex.: 130
  overlapAmount?: number;      // % ex.: 15
  stackOrder?: "left-in-front" | "right-in-front";
  showDottedLines?: boolean;
  isLastCol?: boolean;
  isLastRow?: boolean;
  zIndex?: number;
  onEdit?: () => void;
}

export const ColecaoCard: React.FC<ColecaoCardProps> = ({
  product,
  width = 255,
  height = 275,
  productScale = 130,
  overlapAmount = 15,
  stackOrder = "right-in-front",
  showDottedLines = true,
  isLastCol = false,
  isLastRow = false,
  zIndex = 1,
  onEdit,
}) => {
  const display = resolveCardDisplayData(product);

  const [processedPhoto1, setProcessedPhoto1] = useState<string>(display.photo1);
  const [processedPhoto2, setProcessedPhoto2] = useState<string>(display.photo2);

  // Recorta fundo branco/cinza e aplica auto-trim em tempo real gerando PNG transparente
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

  const scale = (productScale || 130) / 100;
  const hasTwoDifferentPhotos =
    Boolean(processedPhoto1 && processedPhoto2 && processedPhoto1 !== processedPhoto2);

  const isLeftInFront = stackOrder === "left-in-front";

  return (
    <div
      className={`relative flex flex-col items-center justify-between overflow-visible text-white select-none transition-all ${
        onEdit ? "cursor-pointer group hover:brightness-105" : ""
      }`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: "border-box",
        zIndex,
      }}
      onClick={onEdit}
      data-testid={`colecao-card-${product.code}`}
      data-principal={display.isPrincipal ? "true" : "false"}
    >
      {/* Linhas pontilhadas vermelhas entre células (conforme referência) */}
      {showDottedLines && !isLastCol && (
        <div className="absolute right-0 top-0 bottom-0 border-r border-dashed border-red-500/40 pointer-events-none z-0" />
      )}
      {showDottedLines && !isLastRow && (
        <div className="absolute left-0 right-0 bottom-0 border-b border-dashed border-red-500/40 pointer-events-none z-0" />
      )}

      {/* Botão flutuante de personalização no hover */}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/85 hover:bg-black text-[#FFD400] px-2 py-0.5 rounded-md border border-[#FFD400]/40 shadow-lg text-[10px] font-bold flex items-center gap-1 z-30 cursor-pointer"
          title="Clique para personalizar fotos e descrição deste bloco"
        >
          <Edit2 className="h-3 w-3" />
          <span>Editar</span>
        </button>
      )}

      {/* 1. ÁREA DOS PRODUTOS COM 100% DE OPACIDADE E SOBREPOSIÇÃO (SEM VÉU, SEM MIX-BLEND ESCURO) */}
      <div
        className="relative w-full flex-1 flex items-center justify-center overflow-visible pt-1 pb-1"
        data-testid="colecao-single-block"
      >
        {hasTwoDifferentPhotos ? (
          // Duas fotos sobrepostas no centro (estilo referência KV Esquenta Black)
          <div
            className="relative w-full h-full flex items-center justify-center overflow-visible"
            style={{ transform: `scale(${scale})` }}
          >
            {/* Foto 1 (Esquerda) */}
            <div
              className="absolute flex items-center justify-center overflow-visible"
              style={{
                left: `${Math.max(0, 8 - overlapAmount / 4)}%`,
                width: "58%",
                height: "94%",
                zIndex: isLeftInFront ? 2 : 1,
              }}
            >
              <img
                src={processedPhoto1}
                alt={display.title}
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)] pointer-events-none"
                style={{ opacity: 1 }}
                loading="lazy"
              />
            </div>

            {/* Foto 2 (Direita) */}
            <div
              className="absolute flex items-center justify-center overflow-visible"
              style={{
                right: `${Math.max(0, 8 - overlapAmount / 4)}%`,
                width: "58%",
                height: "94%",
                zIndex: isLeftInFront ? 1 : 2,
              }}
            >
              <img
                src={processedPhoto2}
                alt={display.title}
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.75)] pointer-events-none"
                style={{ opacity: 1 }}
                loading="lazy"
              />
            </div>
          </div>
        ) : processedPhoto1 ? (
          // Foto única solta no centro (sem caixas separadas)
          <div
            className="relative w-full h-full flex items-center justify-center overflow-visible"
            style={{ transform: `scale(${scale})` }}
          >
            <img
              src={processedPhoto1}
              alt={display.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)] pointer-events-none"
              style={{ opacity: 1 }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-red-300/40">
            <ImageIcon className="h-7 w-7 stroke-[1.5]" />
            <span className="text-[9px] mt-0.5 font-bold">Sem foto</span>
          </div>
        )}
      </div>

      {/* 2. LEGENDA: CAIXA BEGE ARREDONDADA (#F6E0A6), TEXTO VERMELHO-ESCURO (#7A0D12) EM NEGRITO E CAIXA ALTA */}
      <div className="w-full px-1.5 pb-1 flex flex-col items-center justify-end z-20">
        {/* Faixa Laranja opcional "LIMITE" */}
        {product.limit && (
          <div
            className="bg-[#E65100] text-white font-black text-[9px] px-2 py-0.5 rounded-t-sm uppercase tracking-wider text-center shadow-xs leading-none mb-[-1px] z-10"
            data-testid="colecao-card-limit"
          >
            LIMITE: {product.limit}
          </div>
        )}

        {/* Caixa Bege com mesma altura fixa (38px) alinhada na base de todas as células */}
        <div
          className={`w-full bg-[#F6E0A6] border border-[#E5CE92] shadow-[0_2px_4px_rgba(0,0,0,0.35)] flex items-stretch h-[38px] max-h-[38px] overflow-hidden ${
            product.limit ? "rounded-b-md rounded-t-xs" : "rounded-md"
          }`}
        >
          {display.code ? (
            <>
              {/* Código à esquerda */}
              <div
                className="font-mono font-black text-[#7A0D12] text-[11px] px-1.5 flex items-center justify-center border-r border-[#7A0D12]/30 shrink-0 leading-tight select-text"
                data-testid="colecao-card-code"
              >
                {display.code}
              </div>
              {/* Nome do produto (máximo 2 linhas) */}
              <div
                className="flex-1 font-black text-[#7A0D12] text-[9.5px] leading-[1.12] px-1.5 flex items-center justify-center text-center uppercase line-clamp-2 select-text"
                data-testid="colecao-card-title"
                title={display.title}
              >
                {display.title}
              </div>
            </>
          ) : (
            // Nome centralizado quando não houver código
            <div
              className="w-full font-black text-[#7A0D12] text-[10.5px] leading-[1.15] px-2 flex items-center justify-center text-center uppercase line-clamp-2 select-text"
              data-testid="colecao-card-title"
              title={display.title}
            >
              {display.title}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
