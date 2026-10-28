import React, { useState, useEffect, useRef } from "react";
import type { BoundingBox, TransformHandle, SmartGuide } from "@/types/editor";
import { RotateCw } from "lucide-react";

interface TransformBoundingBoxProps {
  bounds?: BoundingBox | null;
  box?: BoundingBox | null;
  zoom: number;
  label?: string;
  isLocked?: boolean;
  allowRotation?: boolean;
  onResize?: (handle: TransformHandle, deltaX: number, deltaY: number, isShift: boolean, isAlt: boolean) => void;
  onRotate?: (angleDegrees: number) => void;
  onMove?: (deltaX: number, deltaY: number) => void;
  onTransform?: (newBox: BoundingBox) => void;
  onTransformEnd?: () => void;
  smartGuides?: SmartGuide[];
  snapGuides?: SmartGuide[];
  boxBoundary?: { minX: number; maxX: number; minY: number; maxY: number };
}

export const TransformBoundingBox: React.FC<TransformBoundingBoxProps> = ({
  bounds,
  box,
  zoom = 1,
  label,
  isLocked = false,
  allowRotation = true,
  onResize,
  onRotate,
  onMove,
  onTransform,
  onTransformEnd,
  smartGuides = [],
  snapGuides = [],
  boxBoundary,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<TransformHandle | null>(null);

  const effectiveBounds = bounds || box;
  if (!effectiveBounds) return null;

  const { x, y, width, height, rotation = 0 } = effectiveBounds;
  const effectiveGuides = smartGuides.length > 0 ? smartGuides : snapGuides;

  // Tamanho calibrado das alças em tela (sempre nítidas mesmo em zoom de 400%)
  const handleSize = Math.max(8, 10 / zoom);
  const halfHandle = handleSize / 2;

  const handlePointerDown = (handle: TransformHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    if (isLocked) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = width;
    const initialHeight = height;
    const initialX = x;
    const initialY = y;
    const initialRot = rotation;

    setActiveHandle(handle);
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      const isShift = moveEvent.shiftKey;
      const isAlt = moveEvent.altKey;

      if (handle === "rot") {
        const centerX = initialX + initialWidth / 2;
        const centerY = initialY + initialHeight / 2;
        const mouseCanvasX = moveEvent.clientX / zoom;
        const mouseCanvasY = moveEvent.clientY / zoom;
        const rad = Math.atan2(mouseCanvasY - centerY, mouseCanvasX - centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;

        // Shift trava em passos de 15 graus
        if (isShift) {
          deg = Math.round(deg / 15) * 15;
        }

        onRotate?.(deg);
        onTransform?.({ ...effectiveBounds, rotation: deg });
      } else {
        let newW = initialWidth;
        let newH = initialHeight;
        let newX = initialX;
        let newY = initialY;

        if (handle.includes("e")) newW = initialWidth + deltaX;
        if (handle.includes("s")) newH = initialHeight + deltaY;
        if (handle.includes("w")) {
          newW = initialWidth - deltaX;
          newX = initialX + deltaX;
        }
        if (handle.includes("n")) {
          newH = initialHeight - deltaY;
          newY = initialY + deltaY;
        }

        if (isShift) {
          const ratio = initialHeight / initialWidth;
          newH = Math.round(newW * ratio);
        }

        onResize?.(handle, deltaX, deltaY, isShift, isAlt);
        onTransform?.({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.max(20, Math.round(newW)),
          height: Math.max(16, Math.round(newH)),
          rotation,
        });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      setActiveHandle(null);
      onTransformEnd?.();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Smart guides magnéticas */}
      {effectiveGuides.map((guide, idx) => (
        <div
          key={`smart-guide-${idx}`}
          className={`absolute pointer-events-none z-40 ${
            guide.orientation === "vertical"
              ? "border-l-2 border-pink-500 border-dashed"
              : "border-t-2 border-pink-500 border-dashed"
          }`}
          style={{
            left: guide.orientation === "vertical" ? `${guide.position}px` : "0",
            top: guide.orientation === "horizontal" ? `${guide.position}px` : "0",
            width: guide.orientation === "horizontal" ? "1080px" : "2px",
            height: guide.orientation === "vertical" ? "1920px" : "2px",
          }}
        >
          {guide.label && (
            <span
              className="text-[9px] bg-pink-600 text-white px-1.5 py-0.5 rounded font-mono shadow-xs absolute whitespace-nowrap"
              style={{
                left: guide.orientation === "vertical" ? "4px" : "16px",
                top: guide.orientation === "horizontal" ? "-18px" : "16px",
              }}
            >
              {guide.label}
            </span>
          )}
        </div>
      ))}

      {/* Caixa delimitadora azul com alças */}
      <div
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}
        className="absolute border-2 border-blue-600 pointer-events-none"
      >
        {/* Rótulo superior */}
        {label && (
          <div className="absolute -top-6 left-0 bg-blue-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
            {label}
          </div>
        )}

        {/* Live Metrics HUD */}
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-neutral-900/90 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow-md whitespace-nowrap border border-white/10 flex items-center gap-1.5 z-40">
          <span>{`${Math.round(width)} × ${Math.round(height)} px`}</span>
          {rotation !== 0 && <span className="text-amber-400 font-bold">{`${Math.round(rotation)}°`}</span>}
        </div>

        {/* Alça de Rotação (acima da caixa) */}
        {allowRotation && !isLocked && (
          <div
            className="absolute flex flex-col items-center pointer-events-auto cursor-grab"
            style={{
              left: "50%",
              top: `-${handleSize * 3}px`,
              transform: "translateX(-50%)",
            }}
          >
            <div
              data-handle="rot"
              className="w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow-md flex items-center justify-center hover:bg-blue-100 transition-colors"
              onPointerDown={(e) => handlePointerDown("rot", e)}
              title="Girar elemento (Shift para 15°)"
            >
              <RotateCw className="w-2.5 h-2.5 text-blue-600" />
            </div>
            <div className="w-0.5 h-3 bg-blue-600" />
          </div>
        )}

        {/* 8 Alças de Redimensionamento */}
        {!isLocked && (
          <>
            {/* Canto Superior Esquerdo (NW) */}
            <div
              data-handle="nw"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-nwse-resize hover:bg-blue-100 transition-colors"
              style={{
                left: `-${halfHandle}px`,
                top: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("nw", e)}
            />

            {/* Meio Superior (N) */}
            <div
              data-handle="n"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-ns-resize hover:bg-blue-100 transition-colors"
              style={{
                left: `calc(50% - ${halfHandle}px)`,
                top: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("n", e)}
            />

            {/* Canto Superior Direito (NE) */}
            <div
              data-handle="ne"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-nesw-resize hover:bg-blue-100 transition-colors"
              style={{
                right: `-${halfHandle}px`,
                top: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("ne", e)}
            />

            {/* Meio Direito (E) */}
            <div
              data-handle="e"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-ew-resize hover:bg-blue-100 transition-colors"
              style={{
                right: `-${halfHandle}px`,
                top: `calc(50% - ${halfHandle}px)`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("e", e)}
            />

            {/* Canto Inferior Direito (SE) */}
            <div
              data-handle="se"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-nwse-resize hover:bg-blue-100 transition-colors"
              style={{
                right: `-${halfHandle}px`,
                bottom: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("se", e)}
            />

            {/* Meio Inferior (S) */}
            <div
              data-handle="s"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-ns-resize hover:bg-blue-100 transition-colors"
              style={{
                left: `calc(50% - ${halfHandle}px)`,
                bottom: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("s", e)}
            />

            {/* Canto Inferior Esquerdo (SW) */}
            <div
              data-handle="sw"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-nesw-resize hover:bg-blue-100 transition-colors"
              style={{
                left: `-${halfHandle}px`,
                bottom: `-${halfHandle}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("sw", e)}
            />

            {/* Meio Esquerdo (W) */}
            <div
              data-handle="w"
              className="absolute bg-white border-2 border-blue-600 shadow-xs pointer-events-auto cursor-ew-resize hover:bg-blue-100 transition-colors"
              style={{
                left: `-${halfHandle}px`,
                top: `calc(50% - ${halfHandle}px)`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
              }}
              onPointerDown={(e) => handlePointerDown("w", e)}
            />
          </>
        )}
      </div>
    </div>
  );
};
