import React from "react";
import type { EncarteSemanalProduct, EncarteSemanalCellPosition } from "@/types/encarte-semanal";
import { Edit2, ImageOff, Plus, Sparkles } from "lucide-react";

export interface EncarteSemanalCellProps {
  product?: EncarteSemanalProduct | null;
  cell: EncarteSemanalCellPosition;
  interactive?: boolean;
  isSelected?: boolean;
  onEdit?: (product: EncarteSemanalProduct) => void;
  onClickSlot?: () => void;
}

export const EncarteSemanalCell: React.FC<EncarteSemanalCellProps> = ({
  product,
  cell,
  interactive = true,
  isSelected = false,
  onEdit,
  onClickSlot,
}) => {
  const { width, height, photoAreaHeight, barHeight } = cell;

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    if (onClickSlot) {
      onClickSlot();
    } else if (product && onEdit) {
      onEdit(product);
    }
  };

  // Se for um slot vazio pronto para digitação na arte
  if (!product) {
    return (
      <div
        className={`absolute select-none group transition-all ${
          interactive ? "cursor-pointer" : ""
        } ${
          isSelected
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-black rounded-lg z-30"
            : "hover:ring-1 hover:ring-amber-400/70"
        }`}
        style={{
          left: `${cell.x}px`,
          top: `${cell.y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        data-testid="semanal-cell-empty"
        data-cell-index={cell.index}
        onClick={handleClick}
      >
        {/* Figma Handles quando selecionado */}
        {isSelected && (
          <>
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
          </>
        )}

        {/* Área de Foto Vazia com convite de clique */}
        <div
          className="absolute left-0 right-0 top-0 flex flex-col items-center justify-center p-2 rounded-t-md border border-dashed border-amber-500/30 group-hover:border-amber-400/80 bg-black/20 group-hover:bg-amber-500/10 transition-all"
          style={{ height: `${photoAreaHeight}px`, zIndex: 10 }}
        >
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-1.5 group-hover:scale-110 group-hover:bg-amber-500/30 transition-transform">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 drop-shadow-md">
            Box {cell.index + 1}
          </span>
          <span className="text-[9px] font-bold text-amber-200/90 tracking-wide mt-0.5">
            Clique p/ Digitar Código
          </span>
        </div>

        {/* Barra Inferior Bege vazia com guia interativo */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end"
          style={{ zIndex: 5 }}
        >
          <div
            className="w-full flex items-center justify-center gap-1.5 bg-[#F6E0A6] px-2 text-center font-extrabold uppercase leading-tight text-[#7A0D12] shadow-sm rounded-md group-hover:bg-[#FFF3CC] transition-colors"
            style={{ height: `${barHeight}px` }}
          >
            <span className="text-[11px] font-black font-mono tracking-wider text-[#7A0D12]">
              + DIGITAR CÓDIGO
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Escala: padrão 1.0 (se for > 10 trata como porcentagem, ex: 100 => 1.0)
  const rawScale = product.scale ?? 1.0;
  const scale = rawScale > 10 ? rawScale / 100 : rawScale;
  const offsetX = product.offsetX ?? 0;
  const offsetY = product.offsetY ?? 0;
  const overlapY = product.overlapY ?? 0;

  // Dimensões proporcionais da foto contidas confortavelmente na área de foto
  const baseW = width * 0.92;
  const baseH = photoAreaHeight * 0.94;
  const imgW = baseW * scale;
  const imgH = baseH * scale;

  return (
    <div
      className={`absolute select-none group transition-all ${
        interactive ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-black rounded-lg z-30"
          : "hover:ring-1 hover:ring-amber-400/60"
      }`}
      style={{
        left: `${cell.x}px`,
        top: `${cell.y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      data-testid="semanal-cell"
      data-product-code={product.code}
      onClick={handleClick}
    >
      {/* Figma Handles quando selecionado */}
      {isSelected && (
        <>
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 border border-black rounded-xs z-40" />
        </>
      )}

      {/* Botão de edição rápida em hover */}
      {interactive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClickSlot) {
              onClickSlot();
            } else if (onEdit) {
              onEdit(product);
            }
          }}
          className="absolute top-1 right-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 p-1.5 rounded-md shadow-lg border border-amber-500/40"
          title="Editar produto (foto, código, descrição)"
          aria-label={`Editar produto ${product.code}`}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Área da foto (zIndex: 10, com contenção para não vazar nas linhas acima/abaixo) */}
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden flex items-center justify-center"
        style={{ height: `${photoAreaHeight}px`, zIndex: 10 }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.description}
            draggable={false}
            className="pointer-events-none absolute object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.65)]"
            style={{
              width: `${imgW}px`,
              height: `${imgH}px`,
              left: `${(width - imgW) / 2 + offsetX}px`,
              top: `${(photoAreaHeight - imgH) / 2 + offsetY + overlapY}px`,
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

      {/* Barra Inferior Bege (#F6E0A6) com COD e DESCRIÇÃO: zIndex: 20 (SEMPRE EM FRENTE, SEM SOBREPOSIÇÃO) */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end"
        style={{ zIndex: 20 }}
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
          {!product.isPrincipal && product.code && (
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
