import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  MoveUp,
  MoveDown,
  Package,
  Type,
  Image as ImageIcon,
  DollarSign,
  Calendar,
  Layers,
  Square,
  ShieldAlert,
} from "lucide-react";
import { EncarteProduct, ProductCustomStyle } from "@/types/encarte";
import { SelectedTarget, TargetElementType } from "@/types/editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LayersPanelProps {
  products: EncarteProduct[];
  customStyles: Record<string, ProductCustomStyle>;
  selectedTarget: SelectedTarget | null;
  selectedTargets: SelectedTarget[];
  onSelectTarget: (target: SelectedTarget, multiSelect?: boolean) => void;
  onToggleLock: (productId: string, isLocked: boolean) => void;
  onToggleVisibility: (productId: string, element: TargetElementType, isVisible: boolean) => void;
  onReorderProduct: (fromIndex: number, toIndex: number) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  products,
  customStyles,
  selectedTarget,
  selectedTargets,
  onSelectTarget,
  onToggleLock,
  onToggleVisibility,
  onReorderProduct,
}) => {
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>(() => {
    // Expand the first product or currently selected product by default
    const initial: Record<string, boolean> = {};
    if (products.length > 0) {
      initial[products[0].id] = true;
    }
    return initial;
  });

  const toggleExpand = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const isTargetSelected = (productId: string, element: TargetElementType) => {
    return selectedTargets.some(
      (t) => t.productId === productId && t.element === element
    ) || (selectedTarget?.productId === productId && selectedTarget?.element === element);
  };

  const getElementIcon = (element: TargetElementType) => {
    switch (element) {
      case "box":
        return <Square className="w-3.5 h-3.5 text-muted-foreground" />;
      case "name":
        return <Type className="w-3.5 h-3.5 text-blue-500" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-amber-500" />;
      case "price":
        return <DollarSign className="w-3.5 h-3.5 text-emerald-500" />;
      case "validity":
        return <Calendar className="w-3.5 h-3.5 text-rose-500" />;
      case "stock":
        return <Package className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const subElements: { element: TargetElementType; label: string }[] = [
    { element: "image", label: "Foto do Produto" },
    { element: "name", label: "Nome & Descrição" },
    { element: "price", label: "Pílula de Preço" },
    { element: "validity", label: "Barra de Validade" },
    { element: "stock", label: "Barra de Estoque" },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none text-xs">
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Camadas</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {products.length} {products.length === 1 ? "Produto" : "Produtos"}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {products.map((prod, index) => {
          const style = customStyles[prod.id] || {};
          const isLocked = !!style.isLocked;
          const isExpanded = !!expandedProducts[prod.id];
          const isBoxSelected = isTargetSelected(prod.id, "box");

          return (
            <div
              key={prod.id}
              className={`rounded-md border transition-colors ${
                isBoxSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/60 hover:border-border hover:bg-muted/30"
              }`}
            >
              {/* Product header row */}
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group"
                onClick={(e) => {
                  if (isLocked) return;
                  onSelectTarget({ productId: prod.id, element: "box" }, e.shiftKey);
                }}
              >
                <button
                  type="button"
                  onClick={(e) => toggleExpand(prod.id, e)}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground shrink-0">
                  {index + 1}
                </div>

                <span className="font-medium text-foreground truncate flex-1" title={prod.name}>
                  {prod.name || "Produto sem nome"}
                </span>

                {/* Quick actions for product: Lock, Reorder Up/Down */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title={isLocked ? "Desbloquear produto" : "Bloquear produto"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(prod.id, !isLocked);
                    }}
                  >
                    {isLocked ? (
                      <Lock className="w-3 h-3 text-amber-500" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    title="Mover para cima"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderProduct(index, index - 1);
                    }}
                  >
                    <MoveUp className="w-3 h-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === products.length - 1}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    title="Mover para baixo"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderProduct(index, index + 1);
                    }}
                  >
                    <MoveDown className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Child sub-elements */}
              {isExpanded && (
                <div className="pl-6 pr-2 pb-1.5 pt-0.5 space-y-0.5 border-t border-border/40 bg-background/50">
                  {subElements.map((sub) => {
                    const isSelected = isTargetSelected(prod.id, sub.element);
                    let isVisible = true;
                    if (sub.element === "validity") isVisible = style.showValidity ?? true;
                    if (sub.element === "stock") isVisible = style.showStock ?? true;
                    if (sub.element === "name") isVisible = style.showName ?? true;

                    return (
                      <div
                        key={sub.element}
                        onClick={(e) => {
                          if (isLocked) return;
                          e.stopPropagation();
                          onSelectTarget(
                            { productId: prod.id, element: sub.element },
                            e.shiftKey
                          );
                        }}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-medium shadow-xs"
                            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getElementIcon(sub.element)}
                          <span className="truncate">{sub.label}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-foreground rounded"
                            title={isVisible ? "Ocultar elemento" : "Mostrar elemento"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleVisibility(prod.id, sub.element, !isVisible);
                            }}
                          >
                            {isVisible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-destructive" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
