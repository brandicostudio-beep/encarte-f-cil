import React from "react";
import type { EncarteSemanalProduct, EncarteSemanalCellPosition } from "@/types/encarte-semanal";
import { Edit2, ImageOff } from "lucide-react";

export interface EncarteSemanalCellProps {
  product: EncarteSemanalProduct;
  cell: EncarteSemanalCellPosition;
  interactive?: boolean;
  onEdit?: (product: EncarteSemanalProduct) => void;
}

export const EncarteSemanalCell: React.FC<EncarteSemanalCellProps> = ({
  product,
  cell,
  interactive = true,
  onEdit,
}) => {
  const { width, height, photoAreaHeight, barHeight } = cell;

  // Escala: se for > 10 trata como porcentagem (ex: 115 => 1.15)
  const rawScale = product.scale ?? 1.15;
  const scale = rawScale > 10 ? rawScale / 100 : rawScale;
  const offsetX = product.offsetX ?? 0;
  const offsetY = product.offsetY ?? 0;
  const overlapY = product.overlapY ?? 15;

  const imgW = width * scale;
  const imgH = (photoAreaHeight + overlapY) * scale;

  return (
    <div
      className={`absolute select-none group ${
        interactive ? "cursor-pointer" : ""
      }`}
      style={{
        left: `${cell.x}px`,
        top: `${cell.y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      data-testid="semanal-cell"
      data-product-code={product.code}
      onClick={() => interactive && onEdit?.(product)}
    >
      {/* Botão de edição em hover */}
      {interactive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(product);
          }}
          className="absolute top-1 right-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 p-1.5 rounded-md shadow-lg border border-amber-500/30"
          title="Editar produto (foto, código, descrição)"
          aria-label={`Editar produto ${product.code}`}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Área da foto (com overflow visível para sobreposição avançada) */}
      <div
        className="absolute left-0 right-0 top-0 overflow-visible"
        style={{ height: `${photoAreaHeight}px`, zIndex: 10 }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.description}
            draggable={false}
            className="pointer-events-none absolute object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]"
            style={{
              width: `${imgW}px`,
              height: `${imgH}px`,
              left: `${(width - imgW) / 2 + offsetX}px`,
              top: `${(photoAreaHeight - imgH) / 2 + offsetY + overlapY / 2}px`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="inline-flex items-center gap-1 bg-black/60 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
              data-testid="semanal-cell-no-photo"
            >
              <ImageOff className="h-3 w-3" />
              Sem foto
            </span>
          </div>
        )}
      </div>

      {/* Barra Inferior Bege (#F6E0A6) com COD e DESCRIÇÃO */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end"
        style={{ zIndex: 5 }}
      >
        {product.limit && (
          <div
            className="bg-[#E65100] text-white font-black text-[9px] px-2 py-0.5 rounded-t-sm uppercase tracking-wider text-center shadow-xs leading-none mb-[-1px] z-10"
            data-testid="semanal-cell-limit"
          >
            LIMITE: {product.limit}
          </div>
        )}

        <div
          className={`w-full flex items-center gap-1.5 bg-[#F6E0A6] px-2 text-center font-extrabold uppercase leading-tight text-[#7A0D12] shadow-sm overflow-hidden ${
            product.limit ? "rounded-b-md rounded-t-xs" : "rounded-md"
          }`}
          style={{ height: `${barHeight}px` }}
        >
          {product.code && (
            <span
              className="shrink-0 text-[13px] font-black font-mono border-r border-[#7A0D12]/30 pr-1.5"
              data-testid="semanal-cell-code"
            >
              {product.code}
            </span>
          )}
          <span
            className="line-clamp-2 flex-1 text-[12px] font-black"
            data-testid="semanal-cell-desc"
            title={product.description}
          >
            {product.description}
          </span>
        </div>
      </div>
    </div>
  );
};
