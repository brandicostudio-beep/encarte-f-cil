import React, { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  DollarSign,
  Calendar,
  Package,
  Square,
  Pipette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  RotateCw,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
  Sliders,
  FileText,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Check,
} from "lucide-react";
import { EncarteProduct, ProductCustomStyle, CampaignGlobalStyle } from "@/types/encarte";
import { SelectedTarget, TargetElementType, ChangeScope } from "@/types/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PropertiesPanelProps {
  selectedTarget: SelectedTarget | null;
  selectedTargets: SelectedTarget[];
  product: EncarteProduct | null;
  customStyle: ProductCustomStyle;
  globalStyle: CampaignGlobalStyle;
  scope: ChangeScope;
  onChangeScope: (scope: ChangeScope) => void;
  onUpdateStyle: (updates: Partial<ProductCustomStyle>) => void;
  onUpdateProductData: (productId: string, updates: Partial<EncarteProduct>) => void;
  onResetStyle: () => void;
  onAlignElements?: (type: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  onDistributeElements?: (type: "horizontal" | "vertical") => void;
}

const TEMPLATE_COLORS = [
  "#E51E2B", // Vermelho forte
  "#FFDE00", // Amarelo vibrante
  "#111827", // Preto/Grafite
  "#FFFFFF", // Branco
  "#10B981", // Verde
  "#2563EB", // Azul
  "#F97316", // Laranja
  "#7C3AED", // Roxo
  "#6B7280", // Cinza médio
  "#F3F4F6", // Cinza claro
];

const FONT_FAMILIES = [
  { value: "Inter, sans-serif", label: "Inter (Moderno)" },
  { value: "Montserrat, sans-serif", label: "Montserrat (Impacto)" },
  { value: "Roboto, sans-serif", label: "Roboto (Neutro)" },
  { value: "Oswald, sans-serif", label: "Oswald (Condensada)" },
  { value: "Bebas Neue, sans-serif", label: "Bebas Neue (Varejo)" },
  { value: "Arial, sans-serif", label: "Arial (Padrão)" },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedTarget,
  selectedTargets,
  product,
  customStyle,
  globalStyle,
  scope,
  onChangeScope,
  onUpdateStyle,
  onUpdateProductData,
  onResetStyle,
  onAlignElements,
  onDistributeElements,
}) => {
  const [activeTab, setActiveTab] = useState<"style" | "data">("style");
  const [lockAspect, setLockAspect] = useState(true);

  const activeElement: TargetElementType = selectedTarget?.element || "box";

  // Eyedropper API handler
  const handlePickColor = async (targetField: "textColor" | "pillBg" | "pillText" | "boxBg" | "borderColor") => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onUpdateStyle({ [targetField]: result.sRGBHex });
        }
      } catch {
        // User canceled or unsupported
      }
    }
  };

  if (!product || !selectedTarget) {
    return (
      <div className="flex flex-col h-full bg-card border-l border-border p-4 select-none text-xs">
        <div className="p-3 bg-muted/40 rounded-lg text-center my-auto space-y-2">
          <Sliders className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="font-semibold text-foreground text-sm">Nenhum elemento selecionado</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Clique em qualquer elemento do encarte (produto, nome, foto, pílula de preço, validade) para inspecionar e editar suas propriedades aqui.
          </p>
        </div>
      </div>
    );
  }

  // Min font size checks
  const currentFontSize = customStyle.nameFontSize || 26;
  const isFontTooSmall = currentFontSize < 16;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none text-xs">
      {/* Top Scope Selector */}
      <div className="p-3 border-b border-border bg-muted/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Escopo da Alteração
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetStyle}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
            title="Restaurar padrão original da campanha"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Restaurar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-md">
          <button
            type="button"
            onClick={() => onChangeScope("product")}
            className={`py-1 text-[11px] rounded font-medium transition-all ${
              scope === "product"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Este produto
          </button>
          <button
            type="button"
            onClick={() => onChangeScope("page")}
            className={`py-1 text-[11px] rounded font-medium transition-all ${
              scope === "page"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Esta página
          </button>
          <button
            type="button"
            onClick={() => onChangeScope("all")}
            className={`py-1 text-[11px] rounded font-medium transition-all ${
              scope === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Campanha
          </button>
        </div>
      </div>

      {/* Alignment Toolbar (Illustrator style) */}
      {onAlignElements && (
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-1 bg-muted/10">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Alinhar à esquerda"
              onClick={() => onAlignElements("left")}
            >
              <AlignStartVertical className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Centralizar horizontalmente"
              onClick={() => onAlignElements("center")}
            >
              <AlignCenterVertical className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Alinhar à direita"
              onClick={() => onAlignElements("right")}
            >
              <AlignEndVertical className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="h-4 w-px bg-border mx-0.5" />
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Alinhar ao topo"
              onClick={() => onAlignElements("top")}
            >
              <AlignStartHorizontal className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Centralizar verticalmente"
              onClick={() => onAlignElements("middle")}
            >
              <AlignCenterHorizontal className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              title="Alinhar à base"
              onClick={() => onAlignElements("bottom")}
            >
              <AlignEndHorizontal className="w-3.5 h-3.5" />
            </Button>
          </div>
          {onDistributeElements && (
            <>
              <div className="h-4 w-px bg-border mx-0.5" />
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  title="Distribuir horizontalmente"
                  onClick={() => onDistributeElements("horizontal")}
                >
                  <AlignHorizontalDistributeCenter className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  title="Distribuir verticalmente"
                  onClick={() => onDistributeElements("vertical")}
                >
                  <AlignVerticalDistributeCenter className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs: Estilo vs Dados do Produto */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 pt-2 border-b border-border">
          <TabsList className="grid w-full grid-cols-2 h-7">
            <TabsTrigger value="style" className="text-xs h-6">
              <Sliders className="w-3 h-3 mr-1" />
              Propriedades
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs h-6">
              <FileText className="w-3 h-3 mr-1" />
              Dados do Produto
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: PROPERTIES / STYLES */}
        <TabsContent value="style" className="flex-1 overflow-y-auto p-3 space-y-4 m-0">
          {/* Active target banner */}
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {activeElement === "box" && <Square className="w-4 h-4 text-primary" />}
              {activeElement === "name" && <Type className="w-4 h-4 text-blue-500" />}
              {activeElement === "image" && <ImageIcon className="w-4 h-4 text-amber-500" />}
              {activeElement === "price" && <DollarSign className="w-4 h-4 text-emerald-500" />}
              {activeElement === "validity" && <Calendar className="w-4 h-4 text-rose-500" />}
              {activeElement === "stock" && <Package className="w-4 h-4 text-purple-500" />}
              <span className="capitalize">
                {activeElement === "box" && "Box do Produto"}
                {activeElement === "name" && "Nome do Produto"}
                {activeElement === "image" && "Foto do Produto"}
                {activeElement === "price" && "Pílula de Preço"}
                {activeElement === "validity" && "Barra de Validade"}
                {activeElement === "stock" && "Barra de Estoque"}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Posição: {product.name?.slice(0, 15)}...
            </Badge>
          </div>

          {/* 1. TEXT PROPERTIES (Nome, Código, Validade, etc.) */}
          {(activeElement === "name" || activeElement === "validity" || activeElement === "stock") && (
            <div className="space-y-3">
              {/* Font Warning */}
              {isFontTooSmall && activeElement === "name" && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Aviso de legibilidade:</span>
                    <p>O texto está abaixo do tamanho mínimo recomendado (16px) e pode ficar difícil de ler.</p>
                  </div>
                </div>
              )}

              {/* Font Family */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Família da Fonte</Label>
                <Select
                  value={customStyle.fontFamily || globalStyle.fontFamily || "Inter, sans-serif"}
                  onValueChange={(val) => onUpdateStyle({ fontFamily: val })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size & Weight */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() =>
                        onUpdateStyle({
                          nameFontSize: Math.max(12, currentFontSize - 1),
                        })
                      }
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      value={currentFontSize}
                      onChange={(e) =>
                        onUpdateStyle({
                          nameFontSize: Number(e.target.value) || 26,
                        })
                      }
                      className="h-7 text-xs text-center px-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() =>
                        onUpdateStyle({
                          nameFontSize: Math.min(60, currentFontSize + 1),
                        })
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Peso</Label>
                  <Select
                    value={String(customStyle.nameFontWeight || 700)}
                    onValueChange={(val) => onUpdateStyle({ nameFontWeight: Number(val) })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Peso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300" className="text-xs">Light (300)</SelectItem>
                      <SelectItem value="400" className="text-xs">Regular (400)</SelectItem>
                      <SelectItem value="500" className="text-xs">Medium (500)</SelectItem>
                      <SelectItem value="600" className="text-xs">SemiBold (600)</SelectItem>
                      <SelectItem value="700" className="text-xs">Bold (700)</SelectItem>
                      <SelectItem value="800" className="text-xs">ExtraBold (800)</SelectItem>
                      <SelectItem value="900" className="text-xs">Black (900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Text Align */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Alinhamento</Label>
                <div className="flex rounded-md border border-input p-0.5 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameTextAlign: "left" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameTextAlign || "center") === "left" ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameTextAlign: "center" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameTextAlign || "center") === "center" ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameTextAlign: "right" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameTextAlign || "center") === "right" ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Cor do Texto</Label>
                  {typeof window !== "undefined" && "EyeDropper" in window && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePickColor("textColor")}
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      title="Conta-gotas da tela"
                    >
                      <Pipette className="w-3 h-3 mr-1" />
                      Conta-gotas
                    </Button>
                  )}
                </div>
                {/* Palette */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {TEMPLATE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStyle({ textColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        customStyle.textColor === c ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.textColor || "#111827"}
                      onChange={(e) => onUpdateStyle({ textColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.textColor || "#111827"}
                      onChange={(e) => onUpdateStyle({ textColor: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Text Transform & Letter Spacing */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Capitalização</Label>
                  <Select
                    value={customStyle.textTransform || "uppercase"}
                    onValueChange={(val: any) => onUpdateStyle({ textTransform: val })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uppercase" className="text-xs">MAIÚSCULAS</SelectItem>
                      <SelectItem value="lowercase" className="text-xs">minúsculas</SelectItem>
                      <SelectItem value="capitalize" className="text-xs">Primeiras Maiúsculas</SelectItem>
                      <SelectItem value="none" className="text-xs">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Espaçamento</Label>
                  <Select
                    value={customStyle.letterSpacing || "normal"}
                    onValueChange={(val: any) => onUpdateStyle({ letterSpacing: val })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tighter" className="text-xs">Mais Justo (-1px)</SelectItem>
                      <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                      <SelectItem value="wide" className="text-xs">Largo (+1px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* 2. PRICE PILL PROPERTIES */}
          {activeElement === "price" && (
            <div className="space-y-3">
              {/* Colors: Background and Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Fundo da Pílula</Label>
                  {typeof window !== "undefined" && "EyeDropper" in window && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePickColor("pillBg")}
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Pipette className="w-3 h-3 mr-1" />
                      Conta-gotas
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {TEMPLATE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStyle({ pillBg: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        customStyle.pillBg === c ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.pillBg || "#FFDE00"}
                      onChange={(e) => onUpdateStyle({ pillBg: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.pillBg || "#FFDE00"}
                      onChange={(e) => onUpdateStyle({ pillBg: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Text color of pill */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Cor do Preço</Label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {TEMPLATE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStyle({ pillText: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        customStyle.pillText === c ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.pillText || "#E51E2B"}
                      onChange={(e) => onUpdateStyle({ pillText: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.pillText || "#E51E2B"}
                      onChange={(e) => onUpdateStyle({ pillText: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Price Sizes: Currency, Main Value, Unit */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-[11px] font-semibold text-foreground">Proporções do Preço</Label>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">"R$" (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.priceCurrencySize || 22}
                      onChange={(e) => onUpdateStyle({ priceCurrencySize: Number(e.target.value) || 22 })}
                      className="h-7 text-xs text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Valor (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.priceValueSize || 46}
                      onChange={(e) => onUpdateStyle({ priceValueSize: Number(e.target.value) || 46 })}
                      className="h-7 text-xs text-center font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Unidade (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.priceUnitSize || 18}
                      onChange={(e) => onUpdateStyle({ priceUnitSize: Number(e.target.value) || 18 })}
                      className="h-7 text-xs text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Peso do Valor</Label>
                  <Select
                    value={String(customStyle.priceValueWeight || 700)}
                    onValueChange={(val) => onUpdateStyle({ priceValueWeight: Number(val) })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Peso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="600" className="text-xs">SemiBold (600)</SelectItem>
                      <SelectItem value="700" className="text-xs">Bold (700 - Recomendado)</SelectItem>
                      <SelectItem value="800" className="text-xs">ExtraBold (800)</SelectItem>
                      <SelectItem value="900" className="text-xs">Black (900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pill Corner Radius & Padding */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] text-muted-foreground">Arredondamento</Label>
                  <span className="text-[10px] font-mono">{customStyle.pillRadius ?? 9999}px</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${customStyle.pillRadius === 4 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 4 })}
                  >
                    Reto (4px)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${customStyle.pillRadius === 12 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 12 })}
                  >
                    Médio (12px)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${(customStyle.pillRadius ?? 9999) >= 999 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 9999 })}
                  >
                    Total (Pílula)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 3. PHOTO / IMAGE PROPERTIES */}
          {activeElement === "image" && (
            <div className="space-y-3">
              {/* Dimensions */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Dimensões da Área</Label>
                  <button
                    type="button"
                    onClick={() => setLockAspect(!lockAspect)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {lockAspect ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3" />}
                    {lockAspect ? "Proporção Travada" : "Livre"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Largura (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.photoWidth || 200}
                      onChange={(e) => {
                        const w = Number(e.target.value) || 200;
                        if (lockAspect) {
                          const currentW = customStyle.photoWidth || 200;
                          const currentH = customStyle.photoHeight || 200;
                          const ratio = currentH / currentW;
                          onUpdateStyle({ photoWidth: w, photoHeight: Math.round(w * ratio) });
                        } else {
                          onUpdateStyle({ photoWidth: w });
                        }
                      }}
                      className="h-7 text-xs text-center"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Altura (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.photoHeight || 200}
                      onChange={(e) => onUpdateStyle({ photoHeight: Number(e.target.value) || 200 })}
                      className="h-7 text-xs text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Fit Mode */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Encaixe da Imagem</Label>
                <Select
                  value={customStyle.photoFit || "contain"}
                  onValueChange={(val: any) => onUpdateStyle({ photoFit: val })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain" className="text-xs">Conter (Sem cortar produto)</SelectItem>
                    <SelectItem value="cover" className="text-xs">Preencher caixa (Cover)</SelectItem>
                    <SelectItem value="center" className="text-xs">Corte Centralizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rotation & Opacity */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground">Rotação</Label>
                    <span className="text-[10px] font-mono">{customStyle.photoRotation || 0}°</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Slider
                      value={[customStyle.photoRotation || 0]}
                      min={-180}
                      max={180}
                      step={5}
                      onValueChange={([val]) => onUpdateStyle({ photoRotation: val })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0"
                      title="Resetar rotação"
                      onClick={() => onUpdateStyle({ photoRotation: 0 })}
                    >
                      <RotateCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-muted-foreground">Opacidade</Label>
                    <span className="text-[10px] font-mono">{Math.round((customStyle.photoOpacity ?? 1) * 100)}%</span>
                  </div>
                  <Slider
                    value={[(customStyle.photoOpacity ?? 1) * 100]}
                    min={20}
                    max={100}
                    step={5}
                    onValueChange={([val]) => onUpdateStyle({ photoOpacity: val / 100 })}
                  />
                </div>
              </div>

              {/* AI Background Removal */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => {
                    // Trigger trim background or mock cutout
                    onUpdateStyle({ photoFit: "contain" });
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Recortar Fundo da Foto (IA)
                </Button>
              </div>
            </div>
          )}

          {/* 4. PRODUCT BOX PROPERTIES */}
          {activeElement === "box" && (
            <div className="space-y-3">
              {/* Box Background */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Fundo do Box</Label>
                  {typeof window !== "undefined" && "EyeDropper" in window && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePickColor("boxBg")}
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Pipette className="w-3 h-3 mr-1" />
                      Conta-gotas
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {TEMPLATE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStyle({ boxBg: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        customStyle.boxBg === c ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.boxBg || "#FFFFFF"}
                      onChange={(e) => onUpdateStyle({ boxBg: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.boxBg || "#FFFFFF"}
                      onChange={(e) => onUpdateStyle({ boxBg: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Border Color & Width */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Borda do Box</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1 items-center flex-1">
                    {TEMPLATE_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdateStyle({ borderColor: c })}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border border-border/80 transition-transform ${
                          customStyle.borderColor === c ? "scale-125 ring-2 ring-primary" : ""
                        }`}
                      />
                    ))}
                  </div>
                  <div className="w-20">
                    <Select
                      value={String(customStyle.borderWidth ?? 1)}
                      onValueChange={(val) => onUpdateStyle({ borderWidth: Number(val) })}
                    >
                      <SelectTrigger className="h-6 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" className="text-xs">Sem Borda</SelectItem>
                        <SelectItem value="1" className="text-xs">1px Fina</SelectItem>
                        <SelectItem value="2" className="text-xs">2px Média</SelectItem>
                        <SelectItem value="4" className="text-xs">4px Grossa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Corner Radius & Shadow */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Arredondamento</Label>
                  <Select
                    value={String(customStyle.boxRadius ?? 8)}
                    onValueChange={(val) => onUpdateStyle({ boxRadius: Number(val) })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-xs">0px (Reto)</SelectItem>
                      <SelectItem value="8" className="text-xs">8px (Padrão)</SelectItem>
                      <SelectItem value="16" className="text-xs">16px (Suave)</SelectItem>
                      <SelectItem value="24" className="text-xs">24px (Amplo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Sombra</Label>
                  <Select
                    value={customStyle.boxShadow || "sm"}
                    onValueChange={(val: any) => onUpdateStyle({ boxShadow: val })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Sem Sombra</SelectItem>
                      <SelectItem value="sm" className="text-xs">Leve (sm)</SelectItem>
                      <SelectItem value="md" className="text-xs">Média (md)</SelectItem>
                      <SelectItem value="lg" className="text-xs">Forte (lg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Separator Line */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Linha Divisória Foto/Texto</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-6 text-[10px] ${customStyle.showSeparator ? "bg-primary/20 border-primary" : ""}`}
                  onClick={() => onUpdateStyle({ showSeparator: !customStyle.showSeparator })}
                >
                  {customStyle.showSeparator ? "Exibindo" : "Oculta"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: PRODUCT DATA (Edit directly without returning to spreadsheet) */}
        <TabsContent value="data" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Nome do Produto</Label>
            <Input
              value={product.name || ""}
              onChange={(e) => onUpdateProductData(product.id, { name: e.target.value })}
              className="h-8 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Código Interno</Label>
              <Input
                value={product.code || ""}
                onChange={(e) => onUpdateProductData(product.id, { code: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Embalagem</Label>
              <Input
                value={product.packageInfo || ""}
                onChange={(e) => onUpdateProductData(product.id, { packageInfo: e.target.value })}
                className="h-8 text-xs"
                placeholder="Ex: 500g, 1L"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={product.price || ""}
                onChange={(e) => onUpdateProductData(product.id, { price: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs font-bold text-primary"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Unidade</Label>
              <Input
                value={product.unit || "UND"}
                onChange={(e) => onUpdateProductData(product.id, { unit: e.target.value.toUpperCase() })}
                className="h-8 text-xs uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Data de Validade</Label>
            <Input
              value={product.expiryDate || ""}
              onChange={(e) => onUpdateProductData(product.id, { expiryDate: e.target.value })}
              className="h-8 text-xs"
              placeholder="DD/MM/AAAA"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Texto do Estoque</Label>
            <Input
              value={product.stockText || ""}
              onChange={(e) => onUpdateProductData(product.id, { stockText: e.target.value })}
              className="h-8 text-xs"
              placeholder="Ex: Últimas 15 unidades"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
