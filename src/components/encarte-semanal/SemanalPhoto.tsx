import { useRef, useState } from "react";
import type { EncarteSemanalProduct } from "@/types/encarte-semanal";
import { semanalPhotoBounds } from "@/lib/encarte-semanal-editing";
import { Button } from "@/components/ui/button";

export function SemanalPhoto({ product, src, index, count, width, height, interactive, selected, onChange }: {
  product: EncarteSemanalProduct; src: string; index: number; count: number; width: number; height: number;
  interactive: boolean; selected: boolean; onChange?: (product: EncarteSemanalProduct) => void;
}) {
  const [aspect, setAspect] = useState(1);
  const [draft, setDraft] = useState<EncarteSemanalProduct | null>(null);
  const gesture = useRef<{ x: number; y: number; zoom: number; width: number; resize: boolean; original: EncarteSemanalProduct; current: EncarteSemanalProduct } | null>(null);
  const bounds = semanalPhotoBounds(draft || product, index, count, width, height, aspect);
  const start = (event: React.PointerEvent<HTMLElement>, resize: boolean) => {
    if (!interactive || !onChange) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.closest('[data-testid="semanal-cell"]')?.getBoundingClientRect();
    gesture.current = { x: event.clientX, y: event.clientY, zoom: rect ? rect.width / width : 1, width: bounds.width, resize, original: product, current: product };
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = (event.clientX - g.x) / g.zoom;
    const dy = (event.clientY - g.y) / g.zoom;
    const transforms = Array.from({ length: count }, (_, i) => g.original.photoTransforms?.[i] || { x: 0, y: 0, scale: 1 });
    const original = transforms[index];
    if (!original) return;
    transforms[index] = g.resize
      ? { ...original, scale: Math.max(0.2, Math.min(5, original.scale * (1 + dx / Math.max(g.width, 1)))) }
      : { ...original, x: original.x + dx, y: original.y + dy };
    g.current = { ...g.original, photoTransforms: transforms };
    setDraft(g.current);
  };
  const finish = (cancel = false) => {
    const g = gesture.current;
    gesture.current = null; setDraft(null);
    if (g && !cancel && g.current !== g.original) onChange?.(g.current);
  };
  return <><div className={`absolute ${interactive ? "pointer-events-auto touch-none cursor-move" : "pointer-events-none"} ${selected ? "outline outline-ring" : ""}`}
    style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex: 11 + index }}
    onPointerDown={e => start(e, false)} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)}
    onClick={e => { if (selected) e.stopPropagation(); }} data-testid={`semanal-photo-${index}`}>
    <img src={src} alt={`${product.description} — foto ${index + 1}`} draggable={false} className="w-full h-full object-contain pointer-events-none"
      onLoad={e => { const img = e.currentTarget; if (img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight); }} />
  </div>
    {selected && interactive && <Button variant="outline" size="icon" aria-label={`Redimensionar foto ${index + 1}`} title={`Redimensionar foto ${index + 1}`} className="absolute h-5 w-5 rounded-sm border-ring bg-background pointer-events-auto touch-none cursor-nwse-resize"
      style={{ left: bounds.x - 8, top: bounds.y - 8, zIndex: 100 + index }}
      onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onClick={e => e.stopPropagation()} />}
  </>;
}