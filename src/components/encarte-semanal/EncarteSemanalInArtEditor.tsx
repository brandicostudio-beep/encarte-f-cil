import React, { useState, useEffect, useRef } from "react";
import type { EncarteSemanalProduct, EncarteSemanalCellPosition } from "@/types/encarte-semanal";
import {
  searchProductSuggestions,
  lookupProductByCode,
  createSemanalProductFromSuggestion,
  cleanPrincipalDescription,
  fetchCescomProductOnline,
  type ProductSuggestion,
} from "@/lib/encarte-semanal-catalog";
import {
  findKnownPhotoForCode,
  findLocalOrCachedPhotoForCode,
  fetchLocalFolderHandlePhotoForCode,
  fetchSingleDrivePhotoForCode,
  resolveBestPhotoForCode,
  copyProductCodeToClipboard,
} from "@/lib/encarte-semanal-photos";
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
  Copy,
  Layers,
  Move,
  FlipHorizontal,
  ArrowLeftRight,
  Tag,
} from "lucide-react";
import { findSemanalVariations, getAllKnownProducts } from "@/lib/encarte-semanal-catalog";

export interface EncarteSemanalInArtEditorProps {
  cell: EncarteSemanalCellPosition;
  product: EncarteSemanalProduct | null;
  cellIndex: number; // 0 a 19
  allProducts?: EncarteSemanalProduct[];
  onSaveProduct: (updated: EncarteSemanalProduct) => void;
  onClearProduct: () => void;
  onClose: () => void;
  onOpenAdvancedModal?: (product: EncarteSemanalProduct) => void;
  onSwapSlots?: (targetSlotIndex: number) => void;
}

export const EncarteSemanalInArtEditor: React.FC<EncarteSemanalInArtEditorProps> = ({
  cell,
  product,
  cellIndex,
  allProducts,
  onSaveProduct,
  onClearProduct,
  onClose,
  onOpenAdvancedModal,
  onSwapSlots,
}) => {
  // Se houver secondaryCode, compõe o texto inicial (ex: "14352 / 17585")
  const initialCode = product?.secondaryCode
    ? `${product.code} / ${product.secondaryCode}`
    : product?.code || "";

  const [codeQuery, setCodeQuery] = useState(initialCode);
  const [description, setDescription] = useState(product?.description || "");
  const [limit, setLimit] = useState(product?.limit || "");
  const [image, setImage] = useState(product?.image || "");
  const [secondaryImage, setSecondaryImage] = useState(product?.secondaryImage || "");
  const [duplicatePhoto, setDuplicatePhoto] = useState<boolean>(
    Boolean(product?.duplicatePhoto)
  );
  const [scale, setScale] = useState(product?.scale ?? 1.15);
  const [scale2, setScale2] = useState(product?.scale2 ?? (product?.scale ?? 1.15));
  const [limitFontSize, setLimitFontSize] = useState<number>(product?.limitFontSize || 9);
  const [limitWidthPercent, setLimitWidthPercent] = useState<number>(product?.limitWidthPercent || 75);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(Boolean(product?.flipHorizontal));
  const [flipHorizontal2, setFlipHorizontal2] = useState<boolean>(Boolean(product?.flipHorizontal2));
  const [badge, setBadge] = useState<string>(product?.badge || "");
  const [badgeColor, setBadgeColor] = useState<"red" | "amber" | "green" | "purple" | "blue">(
    product?.badgeColor || "red"
  );
  const [swapTargetBox, setSwapTargetBox] = useState<number>(
    cellIndex === 0 ? 1 : 0
  );
  const [variations, setVariations] = useState<Array<{ code: string; description: string; image?: string }>>([]);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSearchingCescom, setIsSearchingCescom] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyToastAndPickFile = (
    rawCode: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const cleanCode = rawCode.trim();
    if (cleanCode) {
      void copyProductCodeToClipboard(cleanCode);
      setCopyToast(
        `Código ${cleanCode} copiado! Na janela da pasta, aperte Ctrl+V e Enter para selecionar o PNG direto`
      );
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
      copyToastTimerRef.current = setTimeout(() => setCopyToast(null), 4500);
    }
    inputRef.current?.click();
  };

  const codeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secFileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Foco automático no input de código ao abrir
  useEffect(() => {
    codeInputRef.current?.focus();
    codeInputRef.current?.select();
  }, []);

  // Atualiza sugestões conforme digitação (busca local e consulta online no cescom.com.br)
  useEffect(() => {
    let active = true;
    const cleanTerm = codeQuery.split(/[/,]+/)[0]?.trim() || "";
    if (cleanTerm.length > 0) {
      const results = searchProductSuggestions(cleanTerm, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);

      // Se for código de 3+ dígitos não encontrado na planilha/catálogo local, consulta pasta local / Drive / site Cescom
      if (cleanTerm.length >= 3 && results.length === 0) {
        setIsSearchingCescom(true);
        Promise.all([
          fetchCescomProductOnline(cleanTerm),
          fetchLocalFolderHandlePhotoForCode(cleanTerm).then(
            (p) => p || findLocalOrCachedPhotoForCode(cleanTerm) || fetchSingleDrivePhotoForCode(cleanTerm)
          ),
        ]).then(([online, priorityPhoto]) => {
          if (active && online) {
            setSuggestions([
              {
                ...online,
                image: priorityPhoto || resolveBestPhotoForCode(cleanTerm, online.image),
              },
            ]);
            setShowSuggestions(true);
          }
          if (active) setIsSearchingCescom(false);
        });
      }
    } else {
      const popular = searchProductSuggestions("", 6);
      setSuggestions(popular);
      setShowSuggestions(false);
    }

    return () => {
      active = false;
    };
  }, [codeQuery]);

  // Busca variações inteligentes para sugerir como Foto 2
  useEffect(() => {
    const descToUse = description || product?.description || "";
    if (!descToUse || descToUse.length < 3) {
      setVariations([]);
      return;
    }

    // Combina produtos da arte + catálogo completo (planilha, Winthor, Cescom, encarte principal)
    const knownProducts = getAllKnownProducts();
    const combinedCatalog = [
      ...(allProducts || []),
      ...knownProducts.map((p) => ({ code: p.code, description: p.description, image: p.image })),
    ];

    const vars = findSemanalVariations(descToUse, product?.code, combinedCatalog);
    // Filtra variações que já tenham a mesma foto que a Foto 1
    const filtered = vars.filter((v) => v.image && v.image !== image);
    setVariations(filtered);
  }, [description, product?.description, product?.code, image, allProducts]);

  // Aplica uma sugestão selecionada com predição de texto
  const handleSelectSuggestion = async (suggestion: ProductSuggestion) => {
    setCodeQuery(suggestion.code);
    setDescription(suggestion.description);
    setShowSuggestions(false);

    // Puxa a foto priorizando Pasta Local > Validade/Encartes > Google Drive > Sugestão Cescom
    let photo =
      (await fetchLocalFolderHandlePhotoForCode(suggestion.code)) ||
      findLocalOrCachedPhotoForCode(suggestion.code) ||
      (await fetchSingleDrivePhotoForCode(suggestion.code));

    if (!photo) {
      photo = resolveBestPhotoForCode(suggestion.code, suggestion.image);
    }

    if (photo) {
      setImage(photo);
    }

    const updated = createSemanalProductFromSuggestion(suggestion, product);
    onSaveProduct({
      ...updated,
      image: photo || updated.image,
      limit: limit.trim() || undefined,
      scale,
      duplicatePhoto,
      secondaryImage: secondaryImage || undefined,
    });
  };

  // Quando o usuário termina de digitar o código manualmente (Enter ou blur)
  const handleApplyManualCode = async () => {
    if (!codeQuery.trim()) return;

    const trimmed = codeQuery.trim();
    const parts = trimmed.split(/[/,]+/).map((p) => p.trim()).filter(Boolean);

    let primaryCode = trimmed;
    let secCode: string | undefined = undefined;
    let photo1 = image;
    let photo2 = secondaryImage;
    let newDesc = description.trim();

    if (parts.length >= 2) {
      primaryCode = parts[0];
      secCode = parts[1];

      let lookedUp1 = lookupProductByCode(primaryCode);
      let lookedUp2 = lookupProductByCode(secCode);

      // Se não encontrou no catálogo/planilha, busca no site https://www.cescom.com.br/
      if (!lookedUp1.description || lookedUp1.description.startsWith("PRODUTO ")) {
        setIsSearchingCescom(true);
        const online1 = await fetchCescomProductOnline(primaryCode);
        if (online1) lookedUp1 = online1;
        setIsSearchingCescom(false);
      }
      if (!lookedUp2.description || lookedUp2.description.startsWith("PRODUTO ")) {
        setIsSearchingCescom(true);
        const online2 = await fetchCescomProductOnline(secCode);
        if (online2) lookedUp2 = online2;
        setIsSearchingCescom(false);
      }

      if (!photo1) {
        photo1 =
          (await fetchLocalFolderHandlePhotoForCode(primaryCode)) ||
          findLocalOrCachedPhotoForCode(primaryCode) ||
          (await fetchSingleDrivePhotoForCode(primaryCode)) ||
          resolveBestPhotoForCode(primaryCode, lookedUp1.image);
      }
      if (!photo2) {
        photo2 =
          (await fetchLocalFolderHandlePhotoForCode(secCode)) ||
          findLocalOrCachedPhotoForCode(secCode) ||
          (await fetchSingleDrivePhotoForCode(secCode)) ||
          resolveBestPhotoForCode(secCode, lookedUp2.image);
      }
      if (!newDesc) {
        const d1 = lookedUp1.description;
        const d2 = lookedUp2.description;
        if (d1 && d2 && !d1.startsWith("PRODUTO ") && !d2.startsWith("PRODUTO ")) {
          newDesc = `${d1} E ${d2}`;
        } else {
          newDesc = d1 || d2;
        }
      }
    } else {
      let lookedUp = lookupProductByCode(trimmed);
      // Busca primeiro na Pasta Local conectada, cache local e pasta oficial do Google Drive antes do site Cescom
      if (!photo1) {
        photo1 =
          (await fetchLocalFolderHandlePhotoForCode(trimmed)) ||
          findLocalOrCachedPhotoForCode(trimmed) ||
          (await fetchSingleDrivePhotoForCode(trimmed));
      }
      // Se não estiver na planilha/catálogo local, consulta o site https://www.cescom.com.br/
      if (!newDesc || newDesc.startsWith("PRODUTO ") || !lookedUp.description || lookedUp.description.startsWith("PRODUTO ")) {
        setIsSearchingCescom(true);
        const online = await fetchCescomProductOnline(trimmed);
        if (online) {
          lookedUp = online;
        }
        setIsSearchingCescom(false);
      }
      if (!newDesc || newDesc.startsWith("PRODUTO ")) newDesc = lookedUp.description;
      if (!photo1) photo1 = resolveBestPhotoForCode(trimmed, lookedUp.image);
    }

    setDescription(newDesc);
    if (photo1) setImage(photo1);
    if (photo2) setSecondaryImage(photo2);
    setShowSuggestions(false);

    const updated: EncarteSemanalProduct = {
      id: product?.id || `semanal-prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: primaryCode,
      secondaryCode: secCode,
      description: newDesc,
      image: photo1,
      secondaryImage: photo2 || undefined,
      duplicatePhoto,
      limit: limit.trim() || undefined,
      limitFontSize,
      limitWidthPercent,
      flipHorizontal,
      flipHorizontal2,
      badge: badge.trim() || undefined,
      badgeColor,
      scale,
      scale2,
      offsetX: product?.offsetX ?? 0,
      offsetY: product?.offsetY ?? 0,
      offsetX2: product?.offsetX2 ?? 0,
      offsetY2: product?.offsetY2 ?? 0,
      overlapY: product?.overlapY ?? 2,
      included: true,
      originalCode: product?.originalCode || primaryCode,
      originalDescription: product?.originalDescription || newDesc,
      originalImage: product?.originalImage || photo1,
    };

    onSaveProduct(updated);
  };

  // Upload manual de imagem 1 (preserva 100% o PNG transparente original sem conversão ou recorte destrutivo)
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

  // Upload manual de imagem 2 / variação (preserva 100% o PNG transparente original)
  const handleSecondaryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSecondaryImage(dataUrl);
      setIsLoadingPhoto(false);

      if (product) {
        onSaveProduct({
          ...product,
          secondaryImage: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Ajuste rápido de zoom da foto 1 (+ / -)
  const handleAdjustScale = (delta: number) => {
    const newScale = Math.max(0.4, Math.min(2.5, Number((scale + delta).toFixed(2))));
    setScale(newScale);
    if (product) {
      onSaveProduct({
        ...product,
        scale: newScale,
      });
    }
  };

  // Ajuste rápido de zoom da foto 2 (+ / -)
  const handleAdjustScale2 = (delta: number) => {
    const newScale = Math.max(0.4, Math.min(2.5, Number((scale2 + delta).toFixed(2))));
    setScale2(newScale);
    if (product) {
      onSaveProduct({
        ...product,
        scale2: newScale,
      });
    }
  };

  // Centralizar / resetar posição da foto 1
  const handleResetPhoto1Pos = () => {
    if (product) {
      onSaveProduct({
        ...product,
        offsetX: 0,
        offsetY: 0,
      });
    }
  };

  // Centralizar / resetar posição da foto 2
  const handleResetPhoto2Pos = () => {
    if (product) {
      onSaveProduct({
        ...product,
        offsetX2: 0,
        offsetY2: 0,
      });
    }
  };

  // Alternar espelhamento horizontal Foto 1
  const handleToggleFlip1 = () => {
    const nextVal = !flipHorizontal;
    setFlipHorizontal(nextVal);
    if (product) {
      onSaveProduct({
        ...product,
        flipHorizontal: nextVal,
      });
    }
  };

  // Alternar espelhamento horizontal Foto 2
  const handleToggleFlip2 = () => {
    const nextVal = !flipHorizontal2;
    setFlipHorizontal2(nextVal);
    if (product) {
      onSaveProduct({
        ...product,
        flipHorizontal2: nextVal,
      });
    }
  };

  // Igualar tamanho da Foto 2 com a Foto 1
  const handleMatchScale2With1 = () => {
    setScale2(scale);
    if (product) {
      onSaveProduct({
        ...product,
        scale2: scale,
      });
    }
  };

  // Aplicar uma variação inteligente na Foto 2
  const handleSelectVariation = (variation: { code: string; description: string; image?: string }) => {
    if (!variation.image) return;
    setSecondaryImage(variation.image);
    setDuplicatePhoto(false);
    if (product) {
      onSaveProduct({
        ...product,
        secondaryImage: variation.image,
        secondaryCode: variation.code,
        duplicatePhoto: false,
      });
    }
  };

  // Posicionamento inteligente para não sair da tela (abaixo da célula ou acima se for última linha)
  const isBottomRow = cell.rowIndex >= 3;
  const popoverTop = isBottomRow
    ? `${Math.max(10, cell.y - 340)}px`
    : `${cell.y + cell.height + 10}px`;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-[#161616] text-white rounded-xl border border-amber-500/60 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-3.5 space-y-3 w-[340px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-auto"
      style={{
        left: `${Math.max(10, Math.min(1080 - 350, cell.x - 30))}px`,
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
            (L{cell.rowIndex + 1}, C{cell.colIndex + 1})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
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

      {/* 1. CAMPO CÓDIGO COM PREDIÇÃO DE TEXTO (AUTOCOMPLETE / MULTI-CÓDIGO) */}
      <div className="space-y-1 relative">
        <Label htmlFor="inArtCode" className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
          <span>Código do Produto:</span>
          {isSearchingCescom ? (
            <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando no cescom.com.br...
            </span>
          ) : (
            <span className="text-[10px] text-amber-400/90 font-mono">Puxa do site Cescom</span>
          )}
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
            placeholder="Digite o código (ex: 19396 ou 14352 / 17585)..."
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

      {/* 3. CAMPO LIMITE (OPCIONAL) COM FONTE E BARRA AJUSTÁVEIS */}
      <div className="space-y-1.5">
        <Label htmlFor="inArtLimit" className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
          <span>Faixa de Limite (Opcional):</span>
          <span className="text-[10px] text-orange-400">Ex: 1000CX ou 10 UN</span>
        </Label>
        <Input
          id="inArtLimit"
          value={limit}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setLimit(val);
            if (product) {
              onSaveProduct({
                ...product,
                limit: val.trim() ? val : undefined,
                limitFontSize,
                limitWidthPercent,
              });
            }
          }}
          onBlur={handleApplyManualCode}
          placeholder="Ex: 1000CX"
          className="h-7 bg-neutral-900 border-neutral-700 text-orange-300 font-bold text-[11px] uppercase focus:border-orange-400"
          data-testid="in-art-input-limit"
        />

        {/* Ajustes Visuais de Tamanho da Fonte e Barra de Limite */}
        {limit.trim().length > 0 && (
          <div className="bg-black/50 border border-orange-500/30 p-2 rounded-md space-y-1.5 animate-in fade-in duration-100">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-neutral-300">Tamanho Fonte:</span>
              <div className="flex items-center gap-1">
                {[9, 11, 13, 15].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setLimitFontSize(sz);
                      if (product) {
                        onSaveProduct({
                          ...product,
                          limitFontSize: sz,
                        });
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      limitFontSize === sz
                        ? "bg-orange-500 text-white font-black"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-neutral-300">Largura Barra:</span>
              <div className="flex items-center gap-1">
                {[
                  { label: "75%", val: 75 },
                  { label: "90%", val: 90 },
                  { label: "100%", val: 100 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      setLimitWidthPercent(item.val);
                      if (product) {
                        onSaveProduct({
                          ...product,
                          limitWidthPercent: item.val,
                        });
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      limitWidthPercent === item.val
                        ? "bg-orange-500 text-white font-black"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. CONTROLES DE FOTOS E VARIAÇÕES (2 FOTOS NO BOX / FIGMA-CANVA) */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-semibold">
          <span>Fotos do Box (2 Unidades):</span>
          <span className="font-mono text-amber-300 text-[10px]">Zoom: {Math.round(scale * 100)}%</span>
        </div>

        {copyToast && (
          <div
            role="status"
            data-testid="in-art-copy-toast"
            className="bg-emerald-950/90 border border-emerald-500/70 text-emerald-200 px-2.5 py-1.5 rounded text-[10px] font-semibold leading-snug"
          >
            {copyToast}
          </div>
        )}

        {/* Linha das Duas Fotos (Foto 1 + Foto 2/Variação com ajustes independentes) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Card Foto 1 */}
          <div className="bg-black/40 border border-neutral-800 rounded-md p-1.5 flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase text-neutral-400 mb-1">Foto 1 (Principal)</span>
            <div className="h-12 w-full bg-[#200408] rounded flex items-center justify-center overflow-hidden mb-1 relative border border-neutral-700">
              {image ? (
                <img src={image} alt="Foto 1" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-4 w-4 text-neutral-500" />
              )}
            </div>
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
              data-testid="btn-trocar-foto-1"
              onClick={() => {
                const primary = (codeQuery.split(/[/,]+/)[0] || product?.code || product?.originalCode || "").trim();
                showCopyToastAndPickFile(primary, fileInputRef);
              }}
              disabled={isLoadingPhoto}
              className="h-6 w-full px-1 bg-neutral-800 border-neutral-700 text-amber-300 hover:text-white text-[10px]"
              title="Trocar Foto 1 (PNG transparente)"
            >
              <Upload className="h-2.5 w-2.5 mr-1" />
              Trocar
            </Button>

            {/* Ajustes Rápidos Foto 1 */}
            <div className="w-full flex items-center justify-between mt-1 text-[9px] text-neutral-400 pt-1 border-t border-neutral-800/80">
              <span className="font-mono text-amber-300 font-bold">{Math.round(scale * 100)}%</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleAdjustScale(-0.05)}
                  className="h-4.5 w-4.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-[10px] cursor-pointer"
                  title="Diminuir tamanho Foto 1"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustScale(0.05)}
                  className="h-4.5 w-4.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-[10px] cursor-pointer"
                  title="Aumentar tamanho Foto 1"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleResetPhoto1Pos}
                  className="h-4.5 px-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[9px] cursor-pointer"
                  title="Centralizar posição da Foto 1"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={handleToggleFlip1}
                  className={`h-4.5 px-1 rounded text-[9px] cursor-pointer flex items-center justify-center ${
                    flipHorizontal
                      ? "bg-amber-400 text-neutral-950 font-bold"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                  }`}
                  title="Espelhar Foto 1 horizontalmente"
                >
                  <FlipHorizontal className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card Foto 2 (Variação / 2º Produto ajustável de forma independente) */}
          <div className="bg-black/40 border border-neutral-800 rounded-md p-1.5 flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase text-neutral-400 mb-1">Foto 2 (Variação)</span>
            <div className="h-12 w-full bg-[#200408] rounded flex items-center justify-center overflow-hidden mb-1 relative border border-neutral-700">
              {secondaryImage ? (
                <img src={secondaryImage} alt="Foto 2" className="max-h-full max-w-full object-contain" />
              ) : duplicatePhoto && image ? (
                <div className="flex flex-col items-center justify-center opacity-60">
                  <img src={image} alt="Duplicata" className="max-h-8 max-w-full object-contain" />
                  <span className="text-[8px] text-amber-300 font-bold">Duplicata</span>
                </div>
              ) : (
                <span className="text-[8px] text-neutral-500 text-center px-1">Sem 2ª foto</span>
              )}
            </div>
            <input
              ref={secFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSecondaryImageUpload}
            />
            <div className="w-full flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="btn-subir-foto-2"
                onClick={() => {
                  const parts = codeQuery.split(/[/,]+/).map((s) => s.trim()).filter(Boolean);
                  const secCode = (product?.secondaryCode || parts[1] || parts[0] || product?.code || product?.originalCode || "").trim();
                  showCopyToastAndPickFile(secCode, secFileInputRef);
                }}
                disabled={isLoadingPhoto}
                className="h-6 flex-1 px-1 bg-neutral-800 border-neutral-700 text-amber-300 hover:text-white text-[10px]"
                title="Subir Foto 2 de Variação ou Sabor diferente"
              >
                <Upload className="h-2.5 w-2.5 mr-0.5" />
                Subir
              </Button>
              {secondaryImage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSecondaryImage("");
                    if (product) {
                      onSaveProduct({
                        ...product,
                        secondaryImage: undefined,
                      });
                    }
                  }}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                  title="Remover Foto 2"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Ajustes Rápidos Foto 2 (se houver 2ª foto ou duplicata) */}
            {(secondaryImage || duplicatePhoto) && (
              <div className="w-full flex items-center justify-between mt-1 text-[9px] text-neutral-400 pt-1 border-t border-neutral-800/80">
                <span className="font-mono text-amber-300 font-bold">{Math.round(scale2 * 100)}%</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustScale2(-0.05)}
                    className="h-4.5 w-4.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-[10px] cursor-pointer"
                    title="Diminuir tamanho Foto 2"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustScale2(0.05)}
                    className="h-4.5 w-4.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center justify-center font-bold text-[10px] cursor-pointer"
                    title="Aumentar tamanho Foto 2"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPhoto2Pos}
                    className="h-4.5 px-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[9px] cursor-pointer"
                    title="Centralizar posição da Foto 2"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFlip2}
                    className={`h-4.5 px-1 rounded text-[9px] cursor-pointer flex items-center justify-center ${
                      flipHorizontal2
                        ? "bg-amber-400 text-neutral-950 font-bold"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    }`}
                    title="Espelhar Foto 2 horizontalmente"
                  >
                    <FlipHorizontal className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleMatchScale2With1}
                    className="h-4.5 px-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded text-[9px] font-bold cursor-pointer"
                    title="Igualar zoom com Foto 1"
                  >
                    =
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sugestões de Variações Inteligentes para Foto 2 */}
        {variations.length > 0 && (
          <div className="bg-black/50 border border-amber-500/30 rounded-md p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                Variações da mesma linha para Foto 2:
              </span>
              <span className="text-[9px] text-neutral-400">{variations.length} encontrada(s)</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {variations.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => handleSelectVariation(v)}
                  className="flex flex-col items-center p-1 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 hover:border-amber-400/80 rounded transition-all shrink-0 w-16 group cursor-pointer"
                  title={`Adicionar ${v.description} como Foto 2`}
                >
                  <div className="h-9 w-9 bg-neutral-900 rounded flex items-center justify-center overflow-hidden mb-0.5">
                    <img src={v.image} alt={v.description} className="max-h-full max-w-full object-contain" />
                  </div>
                  <span className="text-[7.5px] font-bold text-neutral-300 group-hover:text-amber-300 line-clamp-1 truncate w-full text-center">
                    {v.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selo Promocional (Badge de Varejo) */}
        <div className="bg-black/40 border border-neutral-800 p-2 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-300 flex items-center gap-1">
              <Tag className="h-3 w-3 text-amber-400" />
              Selo Promocional no Box:
            </span>
            {badge && (
              <button
                type="button"
                onClick={() => {
                  setBadge("");
                  if (product) onSaveProduct({ ...product, badge: undefined });
                }}
                className="text-[9px] text-red-400 hover:underline cursor-pointer"
              >
                Remover Selo
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {["LANÇAMENTO", "OFERTA", "DESTAQUE", "LEVE +", "NOVO"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  const next = badge === b ? "" : b;
                  setBadge(next);
                  if (product) onSaveProduct({ ...product, badge: next || undefined, badgeColor });
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                  badge === b
                    ? "bg-amber-400 text-neutral-950 border border-amber-300 shadow"
                    : "bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {badge && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800">
              <span className="text-[9px] text-neutral-400">Cor do Selo:</span>
              {(["red", "amber", "green", "purple", "blue"] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setBadgeColor(color);
                    if (product) onSaveProduct({ ...product, badgeColor: color });
                  }}
                  className={`h-4.5 w-4.5 rounded-full border transition-all cursor-pointer ${
                    color === "red"
                      ? "bg-red-600"
                      : color === "amber"
                      ? "bg-amber-500"
                      : color === "green"
                      ? "bg-emerald-600"
                      : color === "purple"
                      ? "bg-purple-600"
                      : "bg-blue-600"
                  } ${badgeColor === color ? "ring-2 ring-white scale-110" : "border-neutral-600 opacity-60"}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trocar de Posição com outro Box (Swap) */}
        {onSwapSlots && (
          <div className="bg-black/30 border border-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 text-neutral-400">
              <ArrowLeftRight className="h-3 w-3 text-amber-400" />
              <span>Trocar com:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={swapTargetBox}
                onChange={(e) => setSwapTargetBox(Number(e.target.value))}
                className="bg-neutral-800 border border-neutral-700 text-amber-300 font-bold rounded px-1.5 py-0.5 text-[10px] cursor-pointer"
              >
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i} value={i} disabled={i === cellIndex}>
                    Box {i + 1}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onSwapSlots(swapTargetBox);
                  onClose();
                }}
                className="h-5 px-2 bg-neutral-800 border-neutral-700 text-amber-300 hover:text-white text-[9px] font-bold cursor-pointer"
                title={`Trocar conteúdo do Box ${cellIndex + 1} com o Box ${swapTargetBox + 1}`}
              >
                Trocar
              </Button>
            </div>
          </div>
        )}

        {/* Dica Canva/Figma */}
        <div className="text-[10px] text-amber-200/80 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded flex items-center gap-1.5">
          <Move className="h-3 w-3 text-amber-400 shrink-0" />
          <span>
            <strong>Figma/Canva:</strong> Arraste a foto com o mouse para mover e puxe os 4 cantos amarelos para redimensionar!
          </span>
        </div>

        {/* Alternador de Duplicação */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800 gap-1.5">
          {/* Toggle Duplicar Foto quando só tem 1 */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !duplicatePhoto;
              setDuplicatePhoto(nextVal);
              if (product) {
                onSaveProduct({
                  ...product,
                  duplicatePhoto: nextVal,
                });
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
              duplicatePhoto
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
            }`}
            title="Quando ativo, repete a mesma foto lado a lado se não houver 2ª foto cadastrada"
          >
            <Copy className="h-3 w-3" />
            <span>{duplicatePhoto ? "2 Unidades (Ativo)" : "1 Foto Única"}</span>
          </button>
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
            className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs cursor-pointer"
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
              className="h-8 px-2.5 bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white text-xs cursor-pointer"
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
            className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs cursor-pointer"
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
