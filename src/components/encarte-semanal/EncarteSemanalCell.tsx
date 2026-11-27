import React, { useState, useEffect, useRef } from "react";
import type { EncarteSemanalProduct, EncarteSemanalCellPosition } from "@/types/encarte-semanal";
import { Edit2, ImageOff, Plus, Move, Maximize2 } from "lucide-react";
import { resolveSemanalCellPhotos } from "@/lib/encarte-semanal-layout";
import { computeSemanalTwoPhotoLayout } from "@/lib/encarte-semanal-editing";

export interface EncarteSemanalCellProps {
  product?: EncarteSemanalProduct | null;
  cell: EncarteSemanalCellPosition;
  interactive?: boolean;
  isSelected?: boolean;
  previewZoom?: number;
  onUpdateProduct?: (updated: EncarteSemanalProduct) => void;
  onEdit?: (product: EncarteSemanalProduct) => void;
  onClickSlot?: () => void;
  onDoubleClickSlot?: () => void;
}

export const EncarteSemanalCell: React.FC<EncarteSemanalCellProps> = ({
  product,
  cell,
  interactive = true,
  isSelected = false,
  previewZoom = 0.38,
  onUpdateProduct,
  onEdit,
  onClickSlot,
  onDoubleClickSlot,
}) => {
  const { width, height, photoAreaHeight, barHeight } = cell;
  const cellRef = useRef<HTMLDivElement>(null);

  const [cleanPhoto1, setCleanPhoto1] = useState<string>("");
  const [cleanPhoto2, setCleanPhoto2] = useState<string>("");

  // Foto atualmente selecionada para ajuste (Foto 1 ou Foto 2)
  const [activeTarget, setActiveTarget] = useState<"photo1" | "photo2">("photo1");
  const [aspect1, setAspect1] = useState<number>(1);
  const [aspect2, setAspect2] = useState<number>(1);

  // Estados de arrastar para mover (Drag to Move)
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<"photo1" | "photo2" | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    clientX: number;
    clientY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [liveOffsetX, setLiveOffsetX] = useState<number | null>(null);
  const [liveOffsetY, setLiveOffsetY] = useState<number | null>(null);
  const [liveOffsetX2, setLiveOffsetX2] = useState<number | null>(null);
  const [liveOffsetY2, setLiveOffsetY2] = useState<number | null>(null);

  // Estados de redimensionar pelos cantos (Resize Handles estilo Canva/Figma)
  const [isResizingCorner, setIsResizingCorner] = useState<"nw" | "ne" | "se" | "sw" | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{
    clientX: number;
    clientY: number;
    centerX: number;
    centerY: number;
    initialDist: number;
    initialScale: number;
    target: "photo1" | "photo2";
  } | null>(null);
  const [liveScale, setLiveScale] = useState<number | null>(null);
  const [liveScale2, setLiveScale2] = useState<number | null>(null);

  useEffect(() => {
    if (!product) {
      setCleanPhoto1("");
      setCleanPhoto2("");
      return;
    }

    const { photo1, photo2 } = resolveSemanalCellPhotos(product);
    setCleanPhoto1(photo1 || "");
    setCleanPhoto2(photo2 || "");
  }, [
    product?.image,
    product?.secondaryImage,
    product?.duplicatePhoto,
    product?.isPrincipal,
    product?.alternativePhotos,
  ]);

  // Limpa estados temporários ao desmarcar seleção
  useEffect(() => {
    if (!isSelected) {
      setIsDraggingPhoto(null);
      setDragStartPos(null);
      setLiveOffsetX(null);
      setLiveOffsetY(null);
      setLiveOffsetX2(null);
      setLiveOffsetY2(null);
      setIsResizingCorner(null);
      setResizeStartData(null);
      setLiveScale(null);
      setLiveScale2(null);
      setActiveTarget("photo1");
    }
  }, [isSelected]);

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    if (isDraggingPhoto || isResizingCorner) return;
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
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClickSlot?.();
        }}
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
          className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end px-2"
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

  // --- CÁLCULOS DE ESCALA E OFFSETS ATUAIS / LIVE ---
  const currentScale1 = liveScale ?? (product.scale ?? 1.15);
  const scale1 = currentScale1 > 10 ? currentScale1 / 100 : currentScale1;

  const currentScale2 = liveScale2 ?? (product.scale2 ?? (product.scale ?? 1.15));
  const scale2 = currentScale2 > 10 ? currentScale2 / 100 : currentScale2;

  const curOffsetX1 = liveOffsetX ?? (product.offsetX ?? 0);
  const curOffsetY1 = liveOffsetY ?? (product.offsetY ?? 0);

  const curOffsetX2 = liveOffsetX2 ?? (product.offsetX2 ?? 0);
  const curOffsetY2 = liveOffsetY2 ?? (product.offsetY2 ?? 0);

  const overlapY = product.overlapY ?? 2;
  const hasTwoPhotos = Boolean(cleanPhoto1 && cleanPhoto2);
  const displayCode = product.secondaryCode
    ? `${product.code} / ${product.secondaryCode}`
    : product.code;

  // --- ARRASTAR FOTO PARA MOVER (DRAG TO MOVE) ---
  const handlePhotoPointerDown = (photoKey: "photo1" | "photo2", e: React.PointerEvent) => {
    if (!interactive || !onUpdateProduct) return;
    e.stopPropagation();
    if (!isSelected && onClickSlot) {
      onClickSlot();
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setActiveTarget(photoKey);
    setIsDraggingPhoto(photoKey);
    setDragStartPos({
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: photoKey === "photo2" ? curOffsetX2 : curOffsetX1,
      initialY: photoKey === "photo2" ? curOffsetY2 : curOffsetY1,
    });
  };

  const handlePhotoPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPhoto || !dragStartPos) return;
    const zoom = previewZoom || 1;
    const dx = (e.clientX - dragStartPos.clientX) / zoom;
    const dy = (e.clientY - dragStartPos.clientY) / zoom;
    const nextX = Math.round(dragStartPos.initialX + dx);
    const nextY = Math.round(dragStartPos.initialY + dy);

    if (isDraggingPhoto === "photo2") {
      setLiveOffsetX2(nextX);
      setLiveOffsetY2(nextY);
    } else {
      setLiveOffsetX(nextX);
      setLiveOffsetY(nextY);
    }
  };

  const handlePhotoPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingPhoto || !dragStartPos || !onUpdateProduct) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const zoom = previewZoom || 1;
    const dx = (e.clientX - dragStartPos.clientX) / zoom;
    const dy = (e.clientY - dragStartPos.clientY) / zoom;
    const nextX = Math.round(dragStartPos.initialX + dx);
    const nextY = Math.round(dragStartPos.initialY + dy);

    if (isDraggingPhoto === "photo2") {
      onUpdateProduct({
        ...product,
        offsetX2: nextX,
        offsetY2: nextY,
      });
      setLiveOffsetX2(null);
      setLiveOffsetY2(null);
    } else {
      onUpdateProduct({
        ...product,
        offsetX: nextX,
        offsetY: nextY,
      });
      setLiveOffsetX(null);
      setLiveOffsetY(null);
    }
    setIsDraggingPhoto(null);
    setDragStartPos(null);
  };

  // --- REDIMENSIONAR PELOS CANTOS (CORNER RESIZE HANDLES ESTILO FIGMA/CANVA) ---
  const handleCornerPointerDown = (
    corner: "nw" | "ne" | "se" | "sw",
    targetPhoto: "photo1" | "photo2",
    e: React.PointerEvent
  ) => {
    if (!isSelected || !onUpdateProduct) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setActiveTarget(targetPhoto);
    setIsResizingCorner(corner);
    const parentRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
    const boxRect = parentRect || cellRef.current?.getBoundingClientRect();
    const centerX = boxRect ? boxRect.left + boxRect.width / 2 : e.clientX;
    const centerY = boxRect ? boxRect.top + boxRect.height / 2 : e.clientY;
    const initialDist = Math.hypot(e.clientX - centerX, e.clientY - centerY) || 1;
    const initialScale = targetPhoto === "photo2" ? scale2 : scale1;

    setResizeStartData({
      clientX: e.clientX,
      clientY: e.clientY,
      centerX,
      centerY,
      initialDist,
      initialScale,
      target: targetPhoto,
    });
  };

  const handleCornerPointerMove = (e: React.PointerEvent) => {
    if (!isResizingCorner || !resizeStartData) return;
    const currentDist = Math.hypot(
      e.clientX - resizeStartData.centerX,
      e.clientY - resizeStartData.centerY
    );
    const ratio = currentDist / resizeStartData.initialDist;
    const nextScale = Math.max(
      0.4,
      Math.min(4.0, Number((resizeStartData.initialScale * ratio).toFixed(2)))
    );

    if (resizeStartData.target === "photo2") {
      setLiveScale2(nextScale);
    } else {
      setLiveScale(nextScale);
    }
  };

  const handleCornerPointerUp = (e: React.PointerEvent) => {
    if (!isResizingCorner || !resizeStartData || !onUpdateProduct) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const currentDist = Math.hypot(
      e.clientX - resizeStartData.centerX,
      e.clientY - resizeStartData.centerY
    );
    const ratio = currentDist / resizeStartData.initialDist;
    const nextScale = Math.max(
      0.4,
      Math.min(4.0, Number((resizeStartData.initialScale * ratio).toFixed(2)))
    );

    if (resizeStartData.target === "photo2") {
      onUpdateProduct({
        ...product,
        scale2: nextScale,
      });
      setLiveScale2(null);
    } else {
      onUpdateProduct({
        ...product,
        scale: nextScale,
      });
      setLiveScale(null);
    }
    setIsResizingCorner(null);
    setResizeStartData(null);
  };

  const renderCornerHandles = (targetPhoto: "photo1" | "photo2") => (
    <>
      <div
        className="absolute -top-2 -left-2 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-xs z-50 cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
        onPointerDown={(e) => handleCornerPointerDown("nw", targetPhoto, e)}
        onPointerMove={handleCornerPointerMove}
        onPointerUp={handleCornerPointerUp}
        title="Arraste para redimensionar"
      />
      <div
        className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-xs z-50 cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
        onPointerDown={(e) => handleCornerPointerDown("ne", targetPhoto, e)}
        onPointerMove={handleCornerPointerMove}
        onPointerUp={handleCornerPointerUp}
        title="Arraste para redimensionar"
      />
      <div
        className="absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-xs z-50 cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
        onPointerDown={(e) => handleCornerPointerDown("sw", targetPhoto, e)}
        onPointerMove={handleCornerPointerMove}
        onPointerUp={handleCornerPointerUp}
        title="Arraste para redimensionar"
      />
      <div
        className="absolute -bottom-2 -right-2 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-xs z-50 cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
        onPointerDown={(e) => handleCornerPointerDown("se", targetPhoto, e)}
        onPointerMove={handleCornerPointerMove}
        onPointerUp={handleCornerPointerUp}
        title="Arraste para redimensionar"
      />
    </>
  );

  return (
    <div
      ref={cellRef}
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onDoubleClickSlot) {
          onDoubleClickSlot();
        } else if (onEdit && product) {
          onEdit(product);
        }
      }}
    >
      {/* Handles para foto única (quando não há 2 fotos) e Badge Flutuante em Tempo Real */}
      {isSelected && (
        <>
          {!hasTwoPhotos && renderCornerHandles("photo1")}

          {/* Badge Flutuante em Tempo Real: Tamanho ou Posição */}
          {(isResizingCorner || isDraggingPhoto) && (
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-amber-400 text-neutral-950 font-black text-[11px] px-2.5 py-1 rounded-full shadow-xl z-50 flex items-center gap-1.5 whitespace-nowrap pointer-events-none">
              {isResizingCorner ? (
                <>
                  <Maximize2 className="h-3 w-3" />
                  <span>
                    Zoom {activeTarget === "photo2" ? "Foto 2" : "Foto 1"}:{" "}
                    {Math.round((activeTarget === "photo2" ? scale2 : scale1) * 100)}%
                  </span>
                </>
              ) : (
                <>
                  <Move className="h-3 w-3" />
                  <span>
                    Posição {isDraggingPhoto === "photo2" ? "Foto 2" : "Foto 1"}:{" "}
                    X: {isDraggingPhoto === "photo2" ? curOffsetX2 : curOffsetX1}px, Y:{" "}
                    {isDraggingPhoto === "photo2" ? curOffsetY2 : curOffsetY1}px
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Selo Promocional (Badge de Varejo) */}
      {product?.badge && (
        <div
          className={`absolute top-1.5 left-1.5 z-25 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider shadow-md pointer-events-none flex items-center gap-1 border ${
            product.badgeColor === "green"
              ? "bg-emerald-600 text-white border-emerald-400"
              : product.badgeColor === "purple"
              ? "bg-purple-600 text-white border-purple-400"
              : product.badgeColor === "blue"
              ? "bg-blue-600 text-white border-blue-400"
              : product.badgeColor === "amber"
              ? "bg-amber-400 text-neutral-950 border-amber-300 font-extrabold"
              : "bg-red-600 text-white border-red-400"
          }`}
        >
          <span className="text-[7px]">★</span>
          <span>{product.badge}</span>
        </div>
      )}

      {/* Botão de edição rápida em hover */}
      {interactive && !isSelected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onEdit) {
              onEdit(product);
            } else if (onDoubleClickSlot) {
              onDoubleClickSlot();
            } else if (onClickSlot) {
              onClickSlot();
            }
          }}
          className="absolute top-1 right-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 p-1.5 rounded-md shadow-lg border border-amber-500/40 cursor-pointer"
          title="Editar produto (foto, código, descrição)"
          aria-label={`Editar produto ${product.code}`}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Área da foto (zIndex: 10, com contenção, proporção perfeita sem cortar e com respiro no topo) */}
      <div
        className="absolute left-0 right-0 top-0 flex items-end justify-center px-2 pt-2"
        style={{ height: `${photoAreaHeight}px`, zIndex: 10 }}
      >
        {hasTwoPhotos ? (
          (() => {
            const twoLayout = computeSemanalTwoPhotoLayout({
              boxX: 0,
              boxWidth: width,
              photoAreaHeight,
              barY: photoAreaHeight,
              aspect1,
              aspect2: cleanPhoto2 === cleanPhoto1 ? aspect1 : aspect2,
              scale1,
              scale2,
              overlapY,
              offsetX1: curOffsetX1,
              offsetY1: curOffsetY1,
              offsetX2: curOffsetX2,
              offsetY2: curOffsetY2,
            });
            return (
              <div className="relative w-full h-full">
                {/* Foto 1 (Esquerda / Trás) — clique direto seleciona, arrasta e exibe os 4 cantos */}
                <div
                  className={`absolute select-none ${
                    interactive
                      ? "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-amber-300/70 rounded"
                      : "pointer-events-none"
                  } ${activeTarget === "photo1" && isSelected ? "ring-2 ring-amber-400 rounded" : ""}`}
                  style={{
                    left: `${twoLayout.photo1.x}px`,
                    top: `${twoLayout.photo1.y}px`,
                    width: `${twoLayout.photo1.width}px`,
                    height: `${twoLayout.photo1.height}px`,
                    zIndex: isSelected && activeTarget === "photo1" ? 13 : 11,
                  }}
                  onPointerDown={(e) => handlePhotoPointerDown("photo1", e)}
                  onPointerMove={handlePhotoPointerMove}
                  onPointerUp={handlePhotoPointerUp}
                  title={interactive ? "Clique para selecionar/mover esta foto" : undefined}
                >
                  {isSelected && activeTarget === "photo1" && renderCornerHandles("photo1")}
                  {isSelected && isDraggingPhoto === "photo1" && (
                    <span className="absolute -top-4 left-0 bg-amber-400 text-neutral-950 text-[8px] font-black px-1 rounded shadow-xs pointer-events-none">
                      Foto 1
                    </span>
                  )}
                  <img
                    src={cleanPhoto1}
                    alt={product.description}
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalHeight > 0) setAspect1(img.naturalWidth / img.naturalHeight);
                    }}
                    style={{
                      transform: product.flipHorizontal ? "scaleX(-1)" : undefined,
                    }}
                    className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.50)] pointer-events-none"
                  />
                </div>

                {/* Foto 2 (Direita / Frente, sobreposta) — clique direto seleciona, arrasta e exibe os 4 cantos */}
                <div
                  className={`absolute select-none ${
                    interactive
                      ? "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-amber-300/70 rounded"
                      : "pointer-events-none"
                  } ${activeTarget === "photo2" && isSelected ? "ring-2 ring-amber-400 rounded" : ""}`}
                  style={{
                    left: `${twoLayout.photo2.x}px`,
                    top: `${twoLayout.photo2.y}px`,
                    width: `${twoLayout.photo2.width}px`,
                    height: `${twoLayout.photo2.height}px`,
                    zIndex: isSelected && activeTarget === "photo2" ? 13 : 12,
                  }}
                  onPointerDown={(e) => handlePhotoPointerDown("photo2", e)}
                  onPointerMove={handlePhotoPointerMove}
                  onPointerUp={handlePhotoPointerUp}
                  title={interactive ? "Clique para selecionar/mover esta foto" : undefined}
                >
                  {isSelected && activeTarget === "photo2" && renderCornerHandles("photo2")}
                  {isSelected && isDraggingPhoto === "photo2" && (
                    <span className="absolute -top-4 right-0 bg-amber-400 text-neutral-950 text-[8px] font-black px-1 rounded shadow-xs pointer-events-none">
                      Foto 2
                    </span>
                  )}
                  <img
                    src={cleanPhoto2}
                    alt={product.description}
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalHeight > 0) setAspect2(img.naturalWidth / img.naturalHeight);
                    }}
                    style={{
                      transform: product.flipHorizontal2 ? "scaleX(-1)" : undefined,
                    }}
                    className="w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.55)] pointer-events-none"
                  />
                </div>
              </div>
            );
          })()
        ) : cleanPhoto1 ? (
          /* Foto Única e Centralizada: ampla, espaçosa e arrastável estilo Canva/Figma */
          <div
            className={`relative w-full h-full flex items-center justify-center ${
              isSelected ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
            }`}
            onPointerDown={(e) => handlePhotoPointerDown("photo1", e)}
            onPointerMove={handlePhotoPointerMove}
            onPointerUp={handlePhotoPointerUp}
            title={isSelected ? "Clique e arraste com o mouse para reposicionar a foto" : undefined}
          >
            <img
              src={cleanPhoto1}
              alt={product.description}
              draggable={false}
              className="object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.50)] pointer-events-none"
              style={{
                maxWidth: `${(width - 24) * 0.88 * scale1}px`,
                maxHeight: `${(photoAreaHeight - 16) * scale1}px`,
                transform: `translate(${curOffsetX1}px, ${curOffsetY1}px) ${
                  product.flipHorizontal ? "scaleX(-1)" : ""
                }`,
                zIndex: 11,
              }}
            />
          </div>
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

      {/* Barra Inferior Bege (#F6E0A6) com COD e DESCRIÇÃO: zIndex: 20 com respiro horizontal */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end px-2"
        style={{ zIndex: 20 }}
      >
        {/* Faixa de Limite com tamanho de fonte e largura ajustáveis */}
        {product.limit && (() => {
          const fontSize = product.limitFontSize || 9;
          const widthPct = product.limitWidthPercent || 75;
          return (
            <div
              className="bg-[#E65100] text-white font-black px-2 py-0.5 rounded-t-sm uppercase tracking-wider text-center shadow-xs leading-none mb-[-1px] z-10 transition-all"
              style={{
                fontSize: `${fontSize}px`,
                width: `${widthPct}%`,
              }}
              data-testid="semanal-cell-limit"
            >
              LIMITE: {product.limit}
            </div>
          );
        })()}

        <div
          className={`w-full flex items-center gap-1.5 bg-[#F6E0A6] px-2 text-center font-extrabold uppercase leading-tight text-[#7A0D12] shadow-sm overflow-hidden ${
            product.limit ? "rounded-b-md rounded-t-xs" : "rounded-md"
          }`}
          style={{ height: `${barHeight}px` }}
        >
          {!product.isPrincipal && displayCode && (
            <span
              className="shrink-0 font-black font-mono border-r border-[#7A0D12]/30 pr-1.5 leading-tight"
              style={{
                fontSize: displayCode.length > 7 ? "10px" : "13px",
              }}
              data-testid="semanal-cell-code"
            >
              {displayCode}
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
