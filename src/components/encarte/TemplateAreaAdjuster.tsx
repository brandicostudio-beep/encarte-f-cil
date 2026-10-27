import React, { useRef, useState, useEffect } from "react";
import type { TemplateProductArea } from "@/types/encarte";
import { DEFAULT_TEMPLATE_9_16_AREA } from "@/types/encarte";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, RotateCcw, Move, Maximize } from "lucide-react";

interface TemplateAreaAdjusterProps {
  templateImage: string;
  area: TemplateProductArea;
  onChange: (area: TemplateProductArea) => void;
}

/**
 * Ajustador visual interativo da área branca dos produtos sobre o template 9:16.
 * Permite arrastar o retângulo para reposicionar e redimensionar através de alça de canto,
 * além de campos numéricos para ajuste fino em pixels.
 */
export const TemplateAreaAdjuster: React.FC<TemplateAreaAdjusterProps> = ({
  templateImage,
  area,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origX: number; origY: number; origW: number; origH: number }>({
    x: 0,
    y: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  });

  const canvasW = area.canvasWidth || 1080;
  const canvasH = area.canvasHeight || 1920;

  // Dimensões do preview em tela (proporção 9:16)
  const previewWidth = 270;
  const previewHeight = 480;

  // Fator de escala do canvas para o preview
  const scaleX = previewWidth / canvasW;
  const scaleY = previewHeight / canvasH;

  // Coordenadas calculadas no preview
  const rectLeft = area.x * scaleX;
  const rectTop = area.y * scaleY;
  const rectW = area.width * scaleX;
  const rectH = area.height * scaleY;

  // Iniciar Arraste de Posição
  const handlePointerDownMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      origX: area.x,
      origY: area.y,
      origW: area.width,
      origH: area.height,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Iniciar Redimensionamento pelo Canto
  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      origX: area.x,
      origY: area.y,
      origW: area.width,
      origH: area.height,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging && !isResizing) return;

    const dx = (e.clientX - dragStart.x) / scaleX;
    const dy = (e.clientY - dragStart.y) / scaleY;

    if (isDragging) {
      const newX = Math.max(0, Math.min(canvasW - area.width, Math.round(dragStart.origX + dx)));
      const newY = Math.max(0, Math.min(canvasH - area.height, Math.round(dragStart.origY + dy)));
      onChange({
        ...area,
        x: newX,
        y: newY,
      });
    } else if (isResizing) {
      const newW = Math.max(200, Math.min(canvasW - area.x, Math.round(dragStart.origW + dx)));
      const newH = Math.max(200, Math.min(canvasH - area.y, Math.round(dragStart.origH + dy)));
      onChange({
        ...area,
        width: newW,
        height: newH,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setIsResizing(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleResetDefault = () => {
    onChange({
      ...DEFAULT_TEMPLATE_9_16_AREA,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
    });
  };

  return (
    <div className="space-y-4">
      {/* Aviso obrigatório sobre textos não editáveis já impressos no template */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs leading-relaxed">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-amber-900 block mb-0.5">
            Aviso de Textos do Template:
          </strong>
          Os textos já gravados no template (<em>"Produtos com validade curta!"</em>,{" "}
          <em>"Não aceitamos devolução"</em>, <em>"Prazo 07 dias"</em>) não são editáveis. Para mudar esses textos, é preciso enviar outro template.
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-neutral-900 p-4 rounded-xl text-white">
        {/* Palco do Template com Retângulo Arrastável */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative select-none overflow-hidden rounded-lg border-2 border-neutral-700 shadow-xl bg-black"
          style={{
            width: `${previewWidth}px`,
            height: `${previewHeight}px`,
          }}
        >
          {/* Imagem de Fundo do Template */}
          <img
            src={templateImage || "/templates/template-detona-precos-9-16.png"}
            alt="Template"
            className="w-full h-full object-cover pointer-events-none"
            crossOrigin="anonymous"
          />

          {/* Retângulo Interativo da Área dos Produtos */}
          <div
            onPointerDown={handlePointerDownMove}
            className={`absolute border-2 border-yellow-400 bg-yellow-400/20 backdrop-blur-[1px] cursor-move flex flex-col justify-between p-1.5 transition-shadow ${
              isDragging ? "shadow-2xl ring-2 ring-yellow-400 opacity-90" : ""
            }`}
            style={{
              left: `${rectLeft}px`,
              top: `${rectTop}px`,
              width: `${rectW}px`,
              height: `${rectH}px`,
              borderRadius: "8px",
            }}
          >
            <div className="flex items-center justify-between text-[10px] font-black text-black bg-yellow-400 px-1.5 py-0.5 rounded shadow-xs pointer-events-none">
              <span className="flex items-center gap-1">
                <Move className="h-3 w-3" /> ÁREA BRANCA DOS PRODUTOS
              </span>
              <span>
                {area.width} × {area.height}px
              </span>
            </div>

            <div className="text-[9px] text-center text-yellow-300 font-bold bg-black/60 rounded px-1 pointer-events-none">
              X: {area.x} · Y: {area.y}
            </div>

            {/* Alça de redimensionamento no canto inferior direito */}
            <div
              onPointerDown={handlePointerDownResize}
              className="absolute -right-2 -bottom-2 w-6 h-6 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              title="Arrastar para redimensionar"
            >
              <Maximize className="h-3.5 w-3.5 text-black rotate-90" />
            </div>
          </div>
        </div>

        {/* Controles Numéricos de Ajuste Fino */}
        <div className="flex-1 w-full space-y-4">
          <div>
            <h4 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
              <Move className="h-4 w-4" /> Coordenadas da Área Branca (px)
            </h4>
            <p className="text-[11px] text-neutral-400 mt-1">
              Você pode arrastar o retângulo amarelo na prévia à esquerda ou digitar os valores exatos em pixels abaixo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-300">Posição X (px)</Label>
              <Input
                type="number"
                value={area.x}
                onChange={(e) =>
                  onChange({ ...area, x: Number(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-300">Posição Y (px)</Label>
              <Input
                type="number"
                value={area.y}
                onChange={(e) =>
                  onChange({ ...area, y: Number(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-300">Largura (px)</Label>
              <Input
                type="number"
                value={area.width}
                onChange={(e) =>
                  onChange({ ...area, width: Number(e.target.value) || 100 })
                }
                className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-300">Altura (px)</Label>
              <Input
                type="number"
                value={area.height}
                onChange={(e) =>
                  onChange({ ...area, height: Number(e.target.value) || 100 })
                }
                className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              Resolução base: {canvasW} × {canvasH} px
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefault}
              className="text-xs text-yellow-300 border-neutral-700 hover:bg-neutral-800"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restaurar Padrão (46, 661, 1012, 1202)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
