import React, { useState, useEffect } from "react";
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
  Copy,
  Trash2,
  BookmarkPlus,
  Bookmark,
  Plus,
  Minus,
  Crosshair,
} from "lucide-react";
import { EncarteProduct, ProductCustomStyle, CampaignGlobalStyle } from "@/types/encarte";
import { SALE_UNITS, evaluateStockExpression, previewStockCalculation } from "@/lib/parse-product";
import { SelectedTarget, TargetElementType, ChangeScope, StylePreset } from "@/types/editor";
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
  onDuplicateProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  onCopyProduct?: (productId: string) => void;
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

// Presets padrão de fábrica por tipo de elemento
const DEFAULT_PRESETS: StylePreset[] = [
  {
    id: "def-name-bold",
    name: "Nome Impacto (34px Bold)",
    elementType: "name",
    style: { nameFontSize: 34, nameFontWeight: "700", nameAlign: "center", textTransform: "uppercase" },
    createdAt: "default",
  },
  {
    id: "def-name-compact",
    name: "Nome Compacto (28px Medium)",
    elementType: "name",
    style: { nameFontSize: 28, nameFontWeight: "500", nameAlign: "center" },
    createdAt: "default",
  },
  {
    id: "def-price-yellow-red",
    name: "Pílula Amarela / Preço Vermelho",
    elementType: "price",
    style: { pillBg: "#FFDE00", pillText: "#E51E2B", pillRadius: 9999, priceValueWeight: 700 },
    createdAt: "default",
  },
  {
    id: "def-price-red-white",
    name: "Pílula Vermelha / Preço Branco",
    elementType: "price",
    style: { pillBg: "#E51E2B", pillText: "#FFFFFF", pillRadius: 9999, priceValueWeight: 700 },
    createdAt: "default",
  },
  {
    id: "def-price-green",
    name: "Pílula Verde Oferta",
    elementType: "price",
    style: { pillBg: "#10B981", pillText: "#FFFFFF", pillRadius: 12, priceValueWeight: 800 },
    createdAt: "default",
  },
  {
    id: "def-photo-zoom100",
    name: "Foto Padrão (100% Contida)",
    elementType: "image",
    style: { imageScale: 1.0, photoScale: 1.0, photoFit: "contain", imageOffsetX: 0, imageOffsetY: 0, photoRotation: 0 },
    createdAt: "default",
  },
  {
    id: "def-photo-zoom120",
    name: "Foto Destaque (120% Zoom)",
    elementType: "image",
    style: { imageScale: 1.2, photoScale: 1.2, photoFit: "contain", photoRotation: 0 },
    createdAt: "default",
  },
  {
    id: "def-box-clean",
    name: "Box Branco Padrão (Borda 1px)",
    elementType: "box",
    style: { boxBg: "#FFFFFF", borderColor: "#D9D9D9", borderWidth: 1, boxRadius: 8, showSeparator: true },
    createdAt: "default",
  },
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
  onDuplicateProduct,
  onDeleteProduct,
  onCopyProduct,
  onAlignElements,
  onDistributeElements,
}) => {
  const [activeTab, setActiveTab] = useState<"style" | "data">("style");
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [userPresets, setUserPresets] = useState<StylePreset[]>(() => {
    try {
      const saved = localStorage.getItem("encarte_style_presets_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeElement: TargetElementType = selectedTarget?.element || "box";

  // Salva presets do usuário no localStorage
  const savePresetToStorage = (updated: StylePreset[]) => {
    setUserPresets(updated);
    try {
      localStorage.setItem("encarte_style_presets_v1", JSON.stringify(updated));
    } catch {}
  };

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: StylePreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      elementType: activeElement,
      style: { ...customStyle },
      createdAt: new Date().toISOString(),
    };
    savePresetToStorage([...userPresets, newPreset]);
    setNewPresetName("");
    setShowSavePreset(false);
  };

  const handleDeletePreset = (id: string) => {
    savePresetToStorage(userPresets.filter((p) => p.id !== id));
  };

  const availablePresets = [
    ...DEFAULT_PRESETS.filter((p) => p.elementType === activeElement),
    ...userPresets.filter((p) => p.elementType === activeElement),
  ];

  // Eyedropper API
  const handlePickColor = async (targetField: "textColor" | "pillBg" | "pillText" | "boxBg" | "borderColor") => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onUpdateStyle({ [targetField]: result.sRGBHex });
        }
      } catch {}
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

  // Escala atual da foto (garante compatibilidade entre imageScale e photoScale)
  const currentPhotoScale = customStyle.photoScale ?? customStyle.imageScale ?? 1.0;
  const currentPhotoScalePct = Math.round(currentPhotoScale * 100);
  const currentPhotoOffsetX = customStyle.photoOffsetX ?? customStyle.imageOffsetX ?? 0;
  const currentPhotoOffsetY = customStyle.photoOffsetY ?? customStyle.imageOffsetY ?? 0;

  // Fonte atual
  const currentFontSize = customStyle.nameFontSize || 26;
  const isFontTooSmall = currentFontSize < 16;

  const isTextElement = ["name", "header", "price", "validity", "stock"].includes(activeElement);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none text-xs">
      {/* 1. SELETOR DE ESCOPO COM 4 OPÇÕES CLARAS */}
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

        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
          <button
            type="button"
            onClick={() => onChangeScope("product")}
            className={`py-1 px-1.5 text-[11px] rounded font-medium transition-all text-center ${
              scope === "product"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Somente este item
          </button>
          <button
            type="button"
            onClick={() => onChangeScope("page")}
            className={`py-1 px-1.5 text-[11px] rounded font-medium transition-all text-center ${
              scope === "page"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Desta página
          </button>
          <button
            type="button"
            onClick={() => onChangeScope("all")}
            className={`py-1 px-1.5 text-[11px] rounded font-medium transition-all text-center ${
              scope === "all"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todo o encarte
          </button>
          <button
            type="button"
            disabled={!isTextElement}
            onClick={() => onChangeScope("text_type")}
            className={`py-1 px-1.5 text-[11px] rounded font-medium transition-all text-center disabled:opacity-40 ${
              scope === "text_type"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Aplica estilo a todos os textos do mesmo tipo em todo o encarte"
          >
            Textos deste tipo
          </button>
        </div>
      </div>

      {/* 2. BARRA DE ALINHAMENTO E DISTRIBUIÇÃO */}
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

      {/* 3. AÇÕES RÁPIDAS NO PRODUTO (Duplicar, Copiar, Excluir) */}
      <div className="px-3 py-1.5 border-b border-border flex items-center justify-between gap-1 bg-muted/20">
        <div className="flex items-center gap-1">
          {onDuplicateProduct && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicateProduct(product.id)}
              className="h-6 px-2 text-[10px]"
              title="Duplicar este produto na página atual (Ctrl+D)"
            >
              <Copy className="w-3 h-3 mr-1" />
              Duplicar
            </Button>
          )}
          {onCopyProduct && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyProduct(product.id)}
              className="h-6 px-2 text-[10px]"
              title="Copiar produto (Ctrl+C)"
            >
              Copiar
            </Button>
          )}
        </div>

        {onDeleteProduct && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteProduct(product.id)}
            className="h-6 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
            title="Excluir este produto (Delete)"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Excluir
          </Button>
        )}
      </div>

      {/* 4. PREDEFINIÇÕES DE ESTILO (PRESETS) */}
      <div className="p-2.5 border-b border-border bg-card space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-primary" />
            Predefinições ({availablePresets.length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSavePreset(!showSavePreset)}
            className="h-5 px-1 text-[10px] text-primary"
          >
            <BookmarkPlus className="w-3 h-3 mr-1" />
            Salvar Estilo
          </Button>
        </div>

        {showSavePreset && (
          <div className="flex items-center gap-1 pt-1 pb-1">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Nome da predefinição..."
              className="h-6 text-[10px]"
            />
            <Button
              size="sm"
              onClick={handleCreatePreset}
              className="h-6 px-2 text-[10px]"
            >
              Salvar
            </Button>
          </div>
        )}

        {availablePresets.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {availablePresets.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="flex items-center bg-muted/60 border border-border rounded px-1.5 py-0.5 group"
              >
                <button
                  type="button"
                  onClick={() => onUpdateStyle(p.style)}
                  className="text-[10px] font-medium text-foreground hover:text-primary transition-colors truncate max-w-[120px]"
                  title={`Aplicar: ${p.name}`}
                >
                  {p.name}
                </button>
                {p.createdAt !== "default" && (
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(p.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. TABS: PROPRIEDADES vs DADOS DO PRODUTO */}
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

        {/* TAB 1: PROPRIEDADES VISUAIS */}
        <TabsContent value="style" className="flex-1 overflow-y-auto p-3 space-y-4 m-0">
          {/* Banner do elemento ativo */}
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

          {/* ============================================================== */}
          {/* 1. PROPRIEDADES DA FOTO (RESTAURA SLIDER + NÃO ALTERA O BOX) */}
          {/* ============================================================== */}
          {activeElement === "image" && (
            <div className="space-y-3.5">
              {/* Slider de Escala / Tamanho da Foto */}
              <div className="space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-foreground">
                    Tamanho da Foto (Zoom / Escala)
                  </Label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {currentPhotoScalePct}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs shrink-0"
                    onClick={() => {
                      const newScale = Math.max(0.4, Number((currentPhotoScale - 0.05).toFixed(2)));
                      onUpdateStyle({ imageScale: newScale, photoScale: newScale });
                    }}
                    title="Diminuir tamanho da foto"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>

                  <Slider
                    value={[currentPhotoScalePct]}
                    min={40}
                    max={250}
                    step={5}
                    onValueChange={([val]) => {
                      const newScale = val / 100;
                      onUpdateStyle({ imageScale: newScale, photoScale: newScale });
                    }}
                    className="flex-1"
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs shrink-0"
                    onClick={() => {
                      const newScale = Math.min(2.5, Number((currentPhotoScale + 0.05).toFixed(2)));
                      onUpdateStyle({ imageScale: newScale, photoScale: newScale });
                    }}
                    title="Aumentar tamanho da foto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>

                  <div className="flex items-center shrink-0 w-16">
                    <Input
                      type="number"
                      min={40}
                      max={250}
                      value={currentPhotoScalePct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          const clamped = Math.max(0.4, Math.min(2.5, val / 100));
                          onUpdateStyle({ imageScale: clamped, photoScale: clamped });
                        }
                      }}
                      className="h-7 text-xs text-center px-1 font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground ml-1">%</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                  O tamanho do box do card permanece estritamente fixo. A foto é recortada com segurança dentro da área reservada.
                </p>
              </div>

              {/* Ajuste de Posição / Centralização da Foto (Pan X / Pan Y) */}
              <div className="space-y-2 bg-muted/20 p-2.5 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-foreground">
                    Posição da Foto no Box
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      onUpdateStyle({
                        photoOffsetX: 0,
                        imageOffsetX: 0,
                        photoOffsetY: 0,
                        imageOffsetY: 0,
                      })
                    }
                    title="Centralizar foto perfeitamente"
                  >
                    <Crosshair className="w-3 h-3 mr-1" />
                    Centralizar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Horizontal (X)</span>
                      <span className="font-mono">{currentPhotoOffsetX}px</span>
                    </div>
                    <Slider
                      value={[currentPhotoOffsetX]}
                      min={-80}
                      max={80}
                      step={2}
                      onValueChange={([val]) =>
                        onUpdateStyle({ photoOffsetX: val, imageOffsetX: val })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Vertical (Y)</span>
                      <span className="font-mono">{currentPhotoOffsetY}px</span>
                    </div>
                    <Slider
                      value={[currentPhotoOffsetY]}
                      min={-80}
                      max={80}
                      step={2}
                      onValueChange={([val]) =>
                        onUpdateStyle({ photoOffsetY: val, imageOffsetY: val })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Enquadramento (Fit Mode) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Enquadramento da Imagem</Label>
                <Select
                  value={customStyle.photoFit || customStyle.imageFit || "contain"}
                  onValueChange={(val: any) =>
                    onUpdateStyle({ photoFit: val, imageFit: val })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain" className="text-xs">
                      Conter (Proporcional, sem cortar o produto)
                    </SelectItem>
                    <SelectItem value="cover" className="text-xs">
                      Preencher (Cover / Corte controlado)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rotação & Opacidade */}
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
                    <span className="text-[10px] font-mono">
                      {Math.round((customStyle.photoOpacity ?? 1) * 100)}%
                    </span>
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

              {/* Botão Remover Fundo com IA */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => {
                    onUpdateStyle({ photoFit: "contain", imageFit: "contain" });
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Recortar Fundo da Foto (IA)
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. PROPRIEDADES DE TEXTO (NOME, CÓDIGO, CABEÇALHO) */}
          {/* ============================================================== */}
          {(activeElement === "name" || activeElement === "validity" || activeElement === "stock") && (
            <div className="space-y-3">
              {/* Aviso de Fonte */}
              {isFontTooSmall && activeElement === "name" && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Aviso de legibilidade:</span>
                    <p>O texto está abaixo do tamanho mínimo recomendado (16px) e pode ficar difícil de ler.</p>
                  </div>
                </div>
              )}

              {/* Família da Fonte */}
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

              {/* Tamanho e Peso */}
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
                    onValueChange={(val) => onUpdateStyle({ nameFontWeight: val })}
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

              {/* Alinhamento */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Alinhamento</Label>
                <div className="flex rounded-md border border-input p-0.5 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameAlign: "left" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameAlign || "center") === "left"
                        ? "bg-background shadow-xs text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameAlign: "center" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameAlign || "center") === "center"
                        ? "bg-background shadow-xs text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStyle({ nameAlign: "right" })}
                    className={`flex-1 py-1 flex justify-center rounded ${
                      (customStyle.nameAlign || "center") === "right"
                        ? "bg-background shadow-xs text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cor do Texto */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Cor do Texto</Label>
                  {typeof window !== "undefined" && "EyeDropper" in window && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePickColor("textColor")}
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
                      onClick={() => onUpdateStyle({ textColor: c, nameColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        (customStyle.textColor || customStyle.nameColor) === c
                          ? "scale-125 ring-2 ring-primary ring-offset-1"
                          : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.textColor || customStyle.nameColor || "#111827"}
                      onChange={(e) => onUpdateStyle({ textColor: e.target.value, nameColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.textColor || customStyle.nameColor || "#111827"}
                      onChange={(e) => onUpdateStyle({ textColor: e.target.value, nameColor: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Capitalização e Espaçamento */}
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

          {/* ============================================================== */}
          {/* 3. PROPRIEDADES DA PÍLULA DE PREÇO */}
          {/* ============================================================== */}
          {activeElement === "price" && (
            <div className="space-y-3">
              {/* Fundo da Pílula */}
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
                      onClick={() => onUpdateStyle({ pillBg: c, pillBgColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        (customStyle.pillBg || customStyle.pillBgColor) === c
                          ? "scale-125 ring-2 ring-primary ring-offset-1"
                          : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.pillBg || customStyle.pillBgColor || "#E30613"}
                      onChange={(e) => onUpdateStyle({ pillBg: e.target.value, pillBgColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.pillBg || customStyle.pillBgColor || "#E30613"}
                      onChange={(e) => onUpdateStyle({ pillBg: e.target.value, pillBgColor: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Cor do Preço */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Cor do Preço</Label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {TEMPLATE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateStyle({ pillText: c, pillTextColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        (customStyle.pillText || customStyle.pillTextColor) === c
                          ? "scale-125 ring-2 ring-primary ring-offset-1"
                          : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.pillText || customStyle.pillTextColor || "#FFE600"}
                      onChange={(e) => onUpdateStyle({ pillText: e.target.value, pillTextColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.pillText || customStyle.pillTextColor || "#FFE600"}
                      onChange={(e) => onUpdateStyle({ pillText: e.target.value, pillTextColor: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Proporções do Preço */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-[11px] font-semibold text-foreground">Proporções do Preço</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">"R$" (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.priceCurrencySize || 23}
                      onChange={(e) => onUpdateStyle({ priceCurrencySize: Number(e.target.value) || 23 })}
                      className="h-7 text-xs text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Valor (px)</Label>
                    <Input
                      type="number"
                      value={customStyle.priceFontSize || customStyle.priceValueSize || 43}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 43;
                        onUpdateStyle({ priceFontSize: val, priceValueSize: val });
                      }}
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
                    value={String(customStyle.priceFontWeight || customStyle.priceValueWeight || 700)}
                    onValueChange={(val) =>
                      onUpdateStyle({ priceFontWeight: val, priceValueWeight: val })
                    }
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

              {/* Arredondamento da Pílula */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-[11px] text-muted-foreground">Arredondamento</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${customStyle.pillRadius === 4 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 4, pillBorderRadius: 4 })}
                  >
                    Reto (4px)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${customStyle.pillRadius === 12 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 12, pillBorderRadius: 12 })}
                  >
                    Médio (12px)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[10px] ${(customStyle.pillRadius ?? 9999) >= 999 ? "bg-primary/20 border-primary" : ""}`}
                    onClick={() => onUpdateStyle({ pillRadius: 9999, pillBorderRadius: 9999 })}
                  >
                    Total (Pílula)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. PROPRIEDADES DO BOX DO PRODUTO */}
          {/* ============================================================== */}
          {activeElement === "box" && (
            <div className="space-y-3">
              {/* Fundo do Box */}
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
                      onClick={() => onUpdateStyle({ boxBg: c, boxBgColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-border/80 transition-transform ${
                        (customStyle.boxBg || customStyle.boxBgColor) === c
                          ? "scale-125 ring-2 ring-primary ring-offset-1"
                          : "hover:scale-110"
                      }`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={customStyle.boxBg || customStyle.boxBgColor || "#FFFFFF"}
                      onChange={(e) => onUpdateStyle({ boxBg: e.target.value, boxBgColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-border p-0"
                    />
                    <Input
                      type="text"
                      value={customStyle.boxBg || customStyle.boxBgColor || "#FFFFFF"}
                      onChange={(e) => onUpdateStyle({ boxBg: e.target.value, boxBgColor: e.target.value })}
                      className="h-6 w-16 text-[10px] uppercase font-mono px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Borda do Box */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Borda do Box</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1 items-center flex-1">
                    {TEMPLATE_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdateStyle({ borderColor: c, boxBorderColor: c })}
                        style={{ backgroundColor: c }}
                        className={`w-4 h-4 rounded-full border border-border/80 transition-transform ${
                          (customStyle.borderColor || customStyle.boxBorderColor) === c
                            ? "scale-125 ring-2 ring-primary"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                  <div className="w-20">
                    <Select
                      value={String(customStyle.borderWidth ?? customStyle.boxBorderWidth ?? 1)}
                      onValueChange={(val) => {
                        const num = Number(val);
                        onUpdateStyle({ borderWidth: num, boxBorderWidth: num });
                      }}
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

              {/* Cantos Arredondados */}
              <div className="space-y-1 pt-1">
                <Label className="text-[11px] text-muted-foreground">Arredondamento</Label>
                <Select
                  value={String(customStyle.boxRadius ?? customStyle.boxBorderRadius ?? 8)}
                  onValueChange={(val) => {
                    const num = Number(val);
                    onUpdateStyle({ boxRadius: num, boxBorderRadius: num });
                  }}
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

              {/* Linha Divisória */}
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

        {/* TAB 2: DADOS DO PRODUTO (Edição direta de valores) */}
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
                value={product.packaging || ""}
                onChange={(e) => onUpdateProductData(product.id, { packaging: e.target.value })}
                className="h-8 text-xs"
                placeholder="Ex: 500g, 1L"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Preço (R$)</Label>
              <Input
                type="text"
                value={product.price || ""}
                onChange={(e) => onUpdateProductData(product.id, { price: e.target.value })}
                className="h-8 text-xs font-bold text-primary"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Unidade de Medida</Label>
              <div className="flex items-center gap-1 flex-wrap mb-1">
                {SALE_UNITS.map((u) => {
                  const isSelected = (product.unit || "UND") === u.value;
                  return (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => onUpdateProductData(product.id, { unit: u.value, unitConfirmed: true })}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                        isSelected
                          ? "bg-red-600 text-white shadow-2xs"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300"
                      }`}
                      title={u.fullLabel}
                    >
                      {u.label}
                    </button>
                  );
                })}
              </div>
              <Input
                value={product.unit || "UND"}
                onChange={(e) => onUpdateProductData(product.id, { unit: e.target.value.toUpperCase(), unitConfirmed: true })}
                className="h-7 text-xs uppercase font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Data de Validade</Label>
            <Input
              value={product.validity || ""}
              onChange={(e) => onUpdateProductData(product.id, { validity: e.target.value })}
              className="h-8 text-xs"
              placeholder="DD/MM/AAAA"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Texto do Estoque</Label>
              {previewStockCalculation(product.stock, product.unit) && (
                <button
                  type="button"
                  onClick={() => {
                    const evaluated = evaluateStockExpression(product.stock, product.unit);
                    onUpdateProductData(product.id, { stock: evaluated });
                  }}
                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5 cursor-pointer"
                  title="Clique para aplicar a soma calculada"
                >
                  = {previewStockCalculation(product.stock, product.unit)} (Aplicar)
                </button>
              )}
            </div>
            <Input
              value={product.stock || ""}
              onChange={(e) => onUpdateProductData(product.id, { stock: e.target.value })}
              onBlur={() => {
                if (product.stock) {
                  const evaluated = evaluateStockExpression(product.stock, product.unit);
                  if (evaluated !== product.stock) {
                    onUpdateProductData(product.id, { stock: evaluated });
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (product.stock) {
                    const evaluated = evaluateStockExpression(product.stock, product.unit);
                    onUpdateProductData(product.id, { stock: evaluated });
                  }
                }
              }}
              className="h-8 text-xs font-mono"
              placeholder="Ex: 80+53 ou 133 UND"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
