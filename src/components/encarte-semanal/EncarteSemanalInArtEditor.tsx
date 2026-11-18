import React, { useState, useEffect, useRef } from "react";
import type { EncarteSemanalProduct, EncarteSemanalCellPosition } from "@/types/encarte-semanal";
import {
  searchProductSuggestions,
  lookupProductByCode,
  createSemanalProductFromSuggestion,
  cleanPrincipalDescription,
  type ProductSuggestion,
} from "@/lib/encarte-semanal-catalog";
import { findKnownPhotoForCode } from "@/lib/encarte-semanal-photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Check,
  X,
  Trash2,
  ZoomIn,
  ZoomOut,
  Upload,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Star,
} from "lucide-react";

export interface EncarteSemanalInArtEditorProps {
  cell: EncarteSemanalCellPosition;
  product: EncarteSemanalProduct | null;
  cellIndex: number; // 0 a 19
  onSaveProduct: (updated: EncarteSemanalProduct) => void;
  onClearProduct: () => void;
  onClose: () => void;
  onOpenAdvancedModal?: (product: EncarteSemanalProduct) => void;
}

export const EncarteSemanalInArtEditor: React.FC<EncarteSemanalInArtEditorProps> = ({
  cell,
  product,
  cellIndex,
  onSaveProduct,
  onClearProduct,
  onClose,
  onOpenAdvancedModal,
}) => {
  const [codeQuery, setCodeQuery] = useState(product?.code || "");
  const [description, setDescription] = useState(product?.description || "");
  const [limit, setLimit] = useState(product?.limit || "");
  const [image, setImage] = useState(product?.image || "");
  const [scale, setScale] = useState(product?.scale ?? 1.15);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Foco automático no input de código ao abrir
  useEffect(() => {
    codeInputRef.current?.focus();
    codeInputRef.current?.select();
  }, []);

  // Atualiza sugestões conforme digitação
  useEffect(() => {
    if (codeQuery.trim().length > 0) {
      const results = searchProductSuggestions(codeQuery, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      const popular = searchProductSuggestions("", 6);
      setSuggestions(popular);
      setShowSuggestions(false);
    }
  }, [codeQuery]);

  // Aplica uma sugestão selecionada com predição de texto
  const handleSelectSuggestion = (suggestion: ProductSuggestion) => {
    setCodeQuery(suggestion.code);
    setDescription(suggestion.description);
    setShowSuggestions(false);

    // Puxa a foto automaticamente
    const photo = suggestion.image || findKnownPhotoForCode(suggestion.code);
    if (photo) {
      setImage(photo);
    }

    const updated = createSemanalProductFromSuggestion(suggestion, product);
    onSaveProduct({
      ...updated,
      limit: limit.trim() || undefined,
      scale,
    });
  };

  // Quando o usuário termina de digitar o código manualmente (Enter ou blur)
  const handleApplyManualCode = () => {
    if (!codeQuery.trim()) return;

    const trimmed = codeQuery.trim();
    const lookedUp = lookupProductByCode(trimmed);

    const newDesc = description.trim() || lookedUp.description;
    const newImage = image || lookedUp.image || findKnownPhotoForCode(trimmed);

    setDescription(newDesc);
    if (newImage) setImage(newImage);
    setShowSuggestions(false);

    const updated: EncarteSemanalProduct = {
      id: product?.id || `semanal-prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: trimmed,
      description: newDesc,
      image: newImage,
      limit: limit.trim() || undefined,
      scale,
      offsetX: product?.offsetX ?? 0,
      offsetY: product?.offsetY ?? 0,
      overlapY: product?.overlapY ?? 15,
      included: true,
      originalCode: product?.originalCode || trimmed,
      originalDescription: product?.originalDescription || newDesc,
      originalImage: product?.originalImage || newImage,
    };

    onSaveProduct(updated);
  };

  // Upload manual de imagem direto para o box
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImage(dataUrl);
      setIsLoadingPhoto(false);

      if (product) {
        onSaveProduct({
          ...product,
          image: dataUrl,
        });
      } else if (codeQuery.trim()) {
        handleApplyManualCode();
      }
    };
    reader.readAsDataURL(file);
  };

  // Ajuste rápido de zoom da foto (+ / -)
  const handleAdjustScale = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2.5, Number((scale + delta).toFixed(2))));
    setScale(newScale);
    if (product) {
      onSaveProduct({
        ...product,
        scale: newScale,
      });
    }
  };

  // Posicionamento inteligente para não sair da tela (abaixo da célula ou acima se for última linha)
  const isBottomRow = cell.rowIndex >= 3;
  const popoverTop = isBottomRow
    ? `${Math.max(10, cell.y - 320)}px`
    : `${cell.y + cell.height + 10}px`;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-[#161616] text-white rounded-xl border border-amber-500/60 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-3.5 space-y-3 w-[330px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-auto"
      style={{
        left: `${Math.max(10, Math.min(1080 - 340, cell.x - 30))}px`,
        top: popoverTop,
      }}
      onClick={(e) => e.stopPropagation()}
      data-testid="in-art-editor-popover"
    >
      {/* Cabeçalho do Editor Figma/Canva */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-black tracking-wider text-amber-300 uppercase">
            Editar Box {cellIndex + 1}
          </span>
          <span className="text-[10px] text-neutral-400">
            (Linha {cell.rowIndex + 1}, Coluna {cell.colIndex + 1})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
          title="Fechar editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Botão de Classificação como Principal */}
      <div
        className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
          product?.isPrincipal
            ? "bg-amber-500/15 border-amber-500/50"
            : "bg-neutral-900 border-neutral-800"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Star
            className={`h-3.5 w-3.5 shrink-0 ${
              product?.isPrincipal ? "fill-amber-400 text-amber-400" : "text-neutral-400"
            }`}
          />
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-white block">
              {product?.isPrincipal ? "⭐ Item Principal Ativo" : "Classificar como Principal"}
            </span>
            <span className="text-[9px] text-neutral-400 block truncate">
              {product?.isPrincipal
                ? "Sem código e descrição genérica na arte"
                : "Exibe código e descrição na barra"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (product?.isPrincipal) {
              const restoredCode = product.originalCode || "";
              const restoredDesc = product.originalDescription || description;
              setCodeQuery(restoredCode);
              setDescription(restoredDesc);
              onSaveProduct({
                ...product,
                isPrincipal: false,
                code: restoredCode,
                description: restoredDesc,
              });
            } else {
              const origCode = product?.originalCode || codeQuery;
              const origDesc = product?.originalDescription || description;
              const cleanDesc = cleanPrincipalDescription(description);
              setCodeQuery("");
              setDescription(cleanDesc);
              onSaveProduct({
                ...(product || {
                  id: `semanal-prod-${Date.now()}`,
                  image,
                  limit,
                  scale,
                  included: true,
                }),
                isPrincipal: true,
                originalCode: origCode,
                code: "",
                originalDescription: origDesc,
                description: cleanDesc,
              });
            }
          }}
          className={`px-2 py-1 rounded text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer ${
            product?.isPrincipal
              ? "bg-amber-400 hover:bg-amber-500 text-neutral-950 shadow-xs"
              : "bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700"
          }`}
          data-testid="in-art-toggle-principal"
        >
          {product?.isPrincipal ? "Desmarcar" : "Tornar Principal"}
        </button>
      </div>

      {/* 1. CAMPO CÓDIGO COM PREDIÇÃO DE TEXTO (AUTOCOMPLETE) */}
      <div className="space-y-1 relative">
        <Label htmlFor="inArtCode" className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
          <span>Código do Produto:</span>
          <span className="text-[10px] text-amber-400/90 font-mono">Digitação Rápida</span>
        </Label>
        <div className="relative">
          <Input
            id="inArtCode"
            ref={codeInputRef}
            value={codeQuery}
            onChange={(e) => {
              setCodeQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyManualCode();
              } else if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Digite o código (ex: 19396)..."
            className="h-8 bg-neutral-900 border-neutral-700 text-amber-300 font-mono font-bold text-xs pr-8 focus:border-amber-400"
            data-testid="in-art-input-code"
          />
          <Search className="h-3.5 w-3.5 text-neutral-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>

        {/* Dropdown de Predição de Texto */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-amber-500/40 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-neutral-800"
            data-testid="in-art-suggestions-list"
          >
            <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/70 bg-black/40">
              Sugestões / Catálogo Cescom ({suggestions.length})
            </div>
            {suggestions.map((item) => (
              <button
                key={`${item.code}-${item.description}`}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full flex items-center gap-2 p-2 hover:bg-amber-500/15 text-left transition-colors cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="h-8 w-8 rounded bg-[#330409] border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.description} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-neutral-600" />
                  )}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-amber-300 text-xs">{item.code}</span>
                    <span className="text-[9px] font-semibold px-1 rounded bg-neutral-800 text-neutral-400 uppercase">
                      {item.source === "winthor" ? "Winthor" : "Cescom"}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-200 truncate uppercase font-semibold group-hover:text-amber-200">
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. CAMPO DESCRIÇÃO */}
      <div className="space-y-1">
        <Label htmlFor="inArtDesc" className="text-[11px] font-bold text-neutral-300">
          Descrição no Box:
        </Label>
        <Input
          id="inArtDesc"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (product) {
              onSaveProduct({
                ...product,
                description: e.target.value.toUpperCase(),
              });
            }
          }}
          onBlur={handleApplyManualCode}
          onKeyDown={(e) => e.key === "Enter" && handleApplyManualCode()}
          placeholder="Descrição do produto..."
          className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100 text-xs uppercase font-medium focus:border-amber-400"
          data-testid="in-art-input-desc"
        />
      </div>

      {/* 3. CAMPO LIMITE (OPCIONAL) */}
      <div className="space-y-1">
        <Label htmlFor="inArtLimit" className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
          <span>Faixa de Limite (Opcional):</span>
          <span className="text-[10px] text-orange-400">Ex: 1000CX ou 10 UN</span>
        </Label>
        <Input
          id="inArtLimit"
          value={limit}
          onChange={(e) => {
            setLimit(e.target.value.toUpperCase());
            if (product) {
              onSaveProduct({
                ...product,
                limit: e.target.value.trim() ? e.target.value.toUpperCase() : undefined,
              });
            }
          }}
          onBlur={handleApplyManualCode}
          placeholder="Ex: 1000CX"
          className="h-7 bg-neutral-900 border-neutral-700 text-orange-300 font-bold text-[11px] uppercase focus:border-orange-400"
          data-testid="in-art-input-limit"
        />
      </div>

      {/* 4. CONTROLES RÁPIDOS DE FOTO ESTILO CANVA/FIGMA */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-2 rounded-lg space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-semibold">
          <span>Ajuste da Foto:</span>
          <span className="font-mono text-amber-300 text-[10px]">{Math.round(scale * 100)}%</span>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          {/* Zoom - */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleAdjustScale(-0.05)}
            className="h-7 px-2 bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white text-xs"
            title="Reduzir tamanho da foto"
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            -
          </Button>

          {/* Zoom 100% */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setScale(1.15);
              if (product) onSaveProduct({ ...product, scale: 1.15 });
            }}
            className="h-7 px-2 text-[10px] text-neutral-400 hover:text-white"
            title="Restaurar tamanho padrão (115%)"
          >
            115%
          </Button>

          {/* Zoom + */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleAdjustScale(0.05)}
            className="h-7 px-2 bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white text-xs"
            title="Aumentar tamanho da foto"
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            +
          </Button>

          {/* Upload de Imagem */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingPhoto}
            className="h-7 px-2 bg-neutral-800 border-neutral-700 text-amber-300 hover:text-white text-xs"
            title="Subir nova foto para este produto"
          >
            {isLoadingPhoto ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Foto
          </Button>
        </div>
      </div>

      {/* 5. BARRA DE AÇÕES (CONCLUIR, MODAL AVANÇADO, LIMPAR) */}
      <div className="flex items-center justify-between pt-1 gap-2 border-t border-neutral-800">
        {product ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onClearProduct();
              onClose();
            }}
            className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
            title="Limpar este box (remove produto)"
            data-testid="in-art-btn-clear"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5">
          {product && onOpenAdvancedModal && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenAdvancedModal(product);
              }}
              className="h-8 px-2.5 bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white text-xs"
              title="Ajustes avançados (recortar fundo, sobreposição)"
            >
              <Sliders className="h-3.5 w-3.5 mr-1 text-purple-400" />
              Avançado
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => {
              handleApplyManualCode();
              onClose();
            }}
            className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs"
            data-testid="in-art-btn-done"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
};
