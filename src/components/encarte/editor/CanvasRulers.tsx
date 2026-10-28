import React, { useRef } from "react";
import type { GuideLine } from "@/types/editor";

interface CanvasRulersProps {
  zoom: number;
  panX: number;
  panY: number;
  guides: GuideLine[];
  onAddGuide: (guide: GuideLine) => void;
  showRulers: boolean;
}

export const CanvasRulers: React.FC<CanvasRulersProps> = ({
  zoom,
  panX,
  panY,
  guides,
  onAddGuide,
  showRulers,
}) => {
  const isDraggingGuide = useRef<"horizontal" | "vertical" | null>(null);

  if (!showRulers) return null;

  // Gerador de marcações para a régua superior (0 a 1080 px)
  const renderHorizontalTicks = () => {
    const ticks: React.ReactNode[] = [];
    for (let x = 0; x <= 1080; x += 50) {
      const isMajor = x % 100 === 0;
      ticks.push(
        <div
          key={`htick-${x}`}
          className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
          style={{ left: `${x * zoom}px` }}
        >
          <div
            className={`w-[1px] bg-neutral-400 ${isMajor ? "h-3" : "h-1.5"}`}
          />
          {isMajor && (
            <span className="text-[9px] text-neutral-400 font-mono -translate-x-1/2 select-none">
              {x}
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  // Gerador de marcações para a régua esquerda (0 a 1920 px)
  const renderVerticalTicks = () => {
    const ticks: React.ReactNode[] = [];
    for (let y = 0; y <= 1920; y += 50) {
      const isMajor = y % 100 === 0;
      ticks.push(
        <div
          key={`vtick-${y}`}
          className="absolute left-0 right-0 flex items-center justify-end pointer-events-none"
          style={{ top: `${y * zoom}px` }}
        >
          {isMajor && (
            <span className="text-[9px] text-neutral-400 font-mono -translate-y-1/2 pr-1 select-none">
              {y}
            </span>
          )}
          <div
            className={`h-[1px] bg-neutral-400 ${isMajor ? "w-3" : "w-1.5"}`}
          />
        </div>
      );
    }
    return ticks;
  };

  const handleTopRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Arrastando da régua superior cria guia horizontal
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Calcula posição Y no canvas 1080x1920
      const canvasEl = document.getElementById("canvas-viewport");
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const relativeY = Math.round((upEvent.clientY - rect.top) / zoom);
      if (relativeY >= 0 && relativeY <= 1920) {
        onAddGuide({
          id: `guide-h-${Date.now()}`,
          orientation: "horizontal",
          position: relativeY,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleLeftRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mouseup", handleMouseUp);
      const canvasEl = document.getElementById("canvas-viewport");
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const relativeX = Math.round((upEvent.clientX - rect.left) / zoom);
      if (relativeX >= 0 && relativeX <= 1080) {
        onAddGuide({
          id: `guide-v-${Date.now()}`,
          orientation: "vertical",
          position: relativeX,
        });
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <>
      {/* Canto superior esquerdo da régua (Origem 0,0) */}
      <div className="absolute top-0 left-0 w-6 h-6 bg-neutral-800 border-r border-b border-neutral-700 z-30 flex items-center justify-center text-[9px] font-mono text-neutral-400 select-none">
        px
      </div>

      {/* Régua Superior (Horizontal) */}
      <div
        onMouseDown={handleTopRulerMouseDown}
        title="Clique e arraste para criar uma Guia Horizontal"
        className="absolute top-0 left-6 right-0 h-6 bg-neutral-850 border-b border-neutral-700 z-20 overflow-hidden cursor-ns-resize select-none"
      >
        <div
          className="relative h-full"
          style={{ transform: `translateX(${panX}px)` }}
        >
          {renderHorizontalTicks()}
        </div>
      </div>

      {/* Régua Esquerda (Vertical) */}
      <div
        onMouseDown={handleLeftRulerMouseDown}
        title="Clique e arraste para criar uma Guia Vertical"
        className="absolute top-6 left-0 bottom-0 w-6 bg-neutral-850 border-r border-neutral-700 z-20 overflow-hidden cursor-ew-resize select-none"
      >
        <div
          className="relative w-full"
          style={{ transform: `translateY(${panY}px)` }}
        >
          {renderVerticalTicks()}
        </div>
      </div>
    </>
  );
};
