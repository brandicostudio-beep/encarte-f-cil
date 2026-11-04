import React from "react";

export const CAPTION_H = 54;

export interface ProductCellProps {
  photo?: string;        // PNG com fundo transparente
  photo2?: string;       // Foto secundária para variações (opcional)
  title: string;
  code?: string;
  cellW: number;
  cellH: number;
  productScale: number;  // ex.: 1.3 = foto 30% maior que a célula (ou 130)
  zIndex: number;
  offsetX?: number;      // ajuste manual em px
  offsetY?: number;
  limit?: string;        // Faixa opcional de limite (ex.: "1500CX")
  onEdit?: () => void;
  stackOrder?: "left-in-front" | "right-in-front";
  showDottedLines?: boolean;
  isLastCol?: boolean;
  isLastRow?: boolean;
}

export const ProductCell: React.FC<ProductCellProps> = ({
  photo,
  photo2,
  title,
  code,
  cellW,
  cellH,
  productScale,
  zIndex,
  offsetX = 0,
  offsetY = 0,
  limit,
  onEdit,
  stackOrder = "right-in-front",
  showDottedLines = false,
  isLastCol = false,
  isLastRow = false,
}) => {
  // Suporta tanto 1.3 quanto 130
  const scale = productScale > 10 ? productScale / 100 : productScale;
  const photoBoxH = cellH - CAPTION_H;
  const imgW = cellW * scale;
  const imgH = photoBoxH * scale;

  const hasTwoPhotos = Boolean(photo && photo2 && photo !== photo2);
  const isLeftInFront = stackOrder === "left-in-front";

  return (
    <div
      className="absolute inset-0 overflow-visible select-none"
      style={{ zIndex }}
      data-testid="colecao-cell"
      onClick={onEdit}
    >
      {/* Linhas pontilhadas opcionais */}
      {showDottedLines && !isLastCol && (
        <div className="absolute right-0 top-0 bottom-0 border-r border-dashed border-red-500/40 pointer-events-none z-0" />
      )}
      {showDottedLines && !isLastRow && (
        <div className="absolute left-0 right-0 bottom-0 border-b border-dashed border-red-500/40 pointer-events-none z-0" />
      )}

      {/* Área da foto (com overflow visível para sobreposição além da célula) */}
      <div className="absolute left-0 right-0 top-0 overflow-visible" style={{ height: photoBoxH }}>
        {hasTwoPhotos ? (
          // Duas fotos sobrepostas no centro quando há variação
          <div
            className="pointer-events-none absolute overflow-visible"
            style={{
              width: imgW,
              height: imgH,
              left: (cellW - imgW) / 2 + offsetX,
              top: (photoBoxH - imgH) / 2 + offsetY,
            }}
          >
            {/* Foto 1 (Esquerda) */}
            <div
              className="absolute flex items-center justify-center overflow-visible"
              style={{
                left: "4%",
                width: "56%",
                height: "96%",
                zIndex: isLeftInFront ? 2 : 1,
              }}
            >
              <img
                src={photo}
                alt={title}
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]"
                style={{ opacity: 1 }}
              />
            </div>

            {/* Foto 2 (Direita) */}
            <div
              className="absolute flex items-center justify-center overflow-visible"
              style={{
                right: "4%",
                width: "56%",
                height: "96%",
                zIndex: isLeftInFront ? 1 : 2,
              }}
            >
              <img
                src={photo2}
                alt={title}
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.75)]"
                style={{ opacity: 1 }}
              />
            </div>
          </div>
        ) : photo ? (
          // Foto única
          <img
            src={photo}
            alt={title}
            draggable={false}
            className="pointer-events-none absolute object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]"
            // Sem opacity, sem mixBlendMode
            style={{
              width: imgW,
              height: imgH,
              left: (cellW - imgW) / 2 + offsetX,
              top: (photoBoxH - imgH) / 2 + offsetY,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/70">
            Sem foto
          </div>
        )}
      </div>

      {/* Legenda Bege (#F6E0A6) com altura 54px alinhada na base */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end z-20">
        {limit && (
          <div
            className="bg-[#E65100] text-white font-black text-[9px] px-2 py-0.5 rounded-t-sm uppercase tracking-wider text-center shadow-xs leading-none mb-[-1px] z-10"
            data-testid="colecao-card-limit"
          >
            LIMITE: {limit}
          </div>
        )}

        <div
          className={`w-full flex items-center gap-1.5 bg-[#F6E0A6] px-2 text-center font-extrabold uppercase leading-tight text-[#7A0D12] shadow-sm overflow-hidden ${
            limit ? "rounded-b-md rounded-t-xs" : "rounded-md"
          }`}
          style={{ height: CAPTION_H }}
        >
          {code && (
            <span
              className="shrink-0 text-[13px] font-black font-mono border-r border-[#7A0D12]/30 pr-1.5"
              data-testid="colecao-card-code"
            >
              {code}
            </span>
          )}
          <span
            className="line-clamp-2 flex-1 text-[12px] font-black"
            data-testid="colecao-card-title"
            title={title}
          >
            {title}
          </span>
        </div>
      </div>
    </div>
  );
};
