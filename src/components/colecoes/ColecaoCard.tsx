import React, { useState, useEffect } from "react";
import type { ColecaoProduct } from "@/types/colecoes";
import { resolveCardDisplayData } from "@/lib/colecoes-layout";
import { removeWhiteBackground } from "@/lib/colecoes-image-processor";
import { Edit2 } from "lucide-react";
import { ProductCell } from "./ProductCell";

interface ColecaoCardProps {
  product: ColecaoProduct;
  width?: number;
  height?: number;
  productScale?: number;       // % ex.: 130 ou 1.3
  overlapAmount?: number;      // % ex.: 15
  stackOrder?: "left-in-front" | "right-in-front";
  showDottedLines?: boolean;
  isLastCol?: boolean;
  isLastRow?: boolean;
  zIndex?: number;
  offsetX?: number;
  offsetY?: number;
  onEdit?: () => void;
}

export const ColecaoCard: React.FC<ColecaoCardProps> = ({
  product,
  width = 255,
  height = 275,
  productScale = 1.3,
  overlapAmount = 15,
  stackOrder = "right-in-front",
  showDottedLines = true,
  isLastCol = false,
  isLastRow = false,
  zIndex = 1,
  offsetX = 0,
  offsetY = 0,
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

  return (
    <div
      className={`relative overflow-visible text-white select-none transition-all ${
        onEdit ? "cursor-pointer group hover:brightness-105" : ""
      }`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: "border-box",
        zIndex,
      }}
      data-testid={`colecao-card-${product.code}`}
      data-principal={display.isPrincipal ? "true" : "false"}
    >
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

      {/* Célula do Produto com sobreposição e legenda (ProductCell) */}
      <ProductCell
        photo={processedPhoto1}
        photo2={processedPhoto2}
        title={display.title}
        code={display.code}
        cellW={width}
        cellH={height}
        productScale={productScale}
        zIndex={zIndex}
        offsetX={offsetX}
        offsetY={offsetY}
        limit={product.limit}
        onEdit={onEdit}
        stackOrder={stackOrder}
        showDottedLines={showDottedLines}
        isLastCol={isLastCol}
        isLastRow={isLastRow}
      />
    </div>
  );
};
