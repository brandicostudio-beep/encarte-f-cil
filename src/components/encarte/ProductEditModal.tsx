import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EncarteProduct, BadgeType } from "@/types/encarte";
import { BADGE_LABELS } from "@/types/encarte";
import { formatPrice, parsePackaging } from "@/lib/parse-product";
import { Package, Upload, Trash2, Scissors, ZoomIn, ZoomOut, RotateCcw, Layers } from "lucide-react";
import { autoTrimImageWhitespace } from "@/lib/image-normalizer";

interface ProductEditModalProps {
  product: EncarteProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: EncarteProduct) => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product,
  open,
  onOpenChange,
  onSave,
}) => {
  const [form, setForm] = useState<EncarteProduct | null>(() =>
    product ? { ...product } : null
  );
  const [isTrimming, setIsTrimming] = useState(false);
  const [prevProduct, setPrevProduct] = useState<EncarteProduct | null>(product);

  // Sincroniza o formulário de imediato quando o produto selecionado muda,
  // mantendo rigorosamente a mesma contagem e ordem de hooks em todas as renderizações
  if (product !== prevProduct) {
    setPrevProduct(product);
    setForm(product ? { ...product } : null);
  }

  useEffect(() => {
    if (product) {
      setForm({ ...product });
    }
  }, [product]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => (prev ? { ...prev, image: String(reader.result), imageScale: 1.0 } : null));
    };
    reader.readAsDataURL(file);
  };

  const handleTrimWhitespace = async () => {
    if (!form?.image) return;
    setIsTrimming(true);
    try {
      const res = await autoTrimImageWhitespace(form.image);
      if (res.wasTrimmed) {
        setForm((prev) => (prev ? { ...prev, image: res.trimmedSrc, imageScale: 1.0 } : null));
      }
    } finally {
      setIsTrimming(false);
    }
  };

  const handleScaleChange = (delta: number) => {
    setForm((prev) => {
      if (!prev) return null;
      const current = typeof prev.imageScale === "number" ? prev.imageScale : 1.0;
      const next = Math.min(2.0, Math.max(0.5, Number((current + delta).toFixed(2))));
      return { ...prev, imageScale: next };
    });
  };

  const handleResetScale = () => {
    setForm((prev) => (prev ? { ...prev, imageScale: 1.0 } : null));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const parsedPack = parsePackaging(form.packaging || "");
    onSave({
      ...form,
      packaging: (form.packaging || "").trim(),
      packagingType: parsedPack?.tipo,
      packagingQuantity: parsedPack?.quantidade,
      packagingUnit: parsedPack?.unidadeMedida,
      packagingWeight: parsedPack?.gramatura,
      price: formatPrice(form.price || ""),
      imageScale: typeof form.imageScale === "number" ? form.imageScale : 1.0,
    });
    onOpenChange(false);
  };

  // Retorno condicional executado com segurança somente APÓS a declaração de todos os hooks
  if (!open || !form) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Editar Produto no Encarte
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Incluir no Encarte */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">
                Incluir no encarte promocional
              </Label>
              <p className="text-xs text-muted-foreground">
                Desmarque para omitir este produto do encarte impresso.
              </p>
            </div>
            <Switch
              checked={form.included}
              onCheckedChange={(val) => setForm({ ...form, included: val })}
            />
          </div>

          {/* Código e Embalagem */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code">Código / SKU</Label>
              <Input
                id="code"
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex: 24657"
              />
            </div>
            <div>
              <Label htmlFor="packaging">Embalagem</Label>
              <Input
                id="packaging"
                value={form.packaging || ""}
                onChange={(e) => setForm({ ...form, packaging: e.target.value })}
                placeholder="Ex: 1X10 GR ou 500G"
              />
            </div>
          </div>

          {/* Nome do Produto */}
          <div>
            <Label htmlFor="name">Nome do Produto (em caixa-alta)</Label>
            <Input
              id="name"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              placeholder="Ex: BISCOITO RECHEADO CHOCOLATE"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Máximo de 2 linhas no card. Fontes longas são ajustadas automaticamente.
            </p>
          </div>

          {/* Preço e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Preço de Venda (R$)</Label>
              <Input
                id="price"
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="Ex: 4,99"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unidade</Label>
              <Input
                id="unit"
                value={form.unit || ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })}
                placeholder="UND ou KG"
              />
            </div>
          </div>

          {/* Validade e Estoque */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="validity">Data de Validade</Label>
              <Input
                id="validity"
                value={form.validity || ""}
                onChange={(e) => setForm({ ...form, validity: e.target.value })}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div>
              <Label htmlFor="stock">Estoque (Opcional)</Label>
              <Input
                id="stock"
                value={form.stock || ""}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="Ex: 50 UND (vazio para ocultar)"
              />
            </div>
          </div>

          {/* Selo Promocional Opcional */}
          <div>
            <Label className="block mb-2 font-semibold">Selo Promocional</Label>
            <div className="flex flex-wrap gap-2">
              {(["nenhum", "oferta", "leve", "imperdivel"] as BadgeType[]).map(
                (badgeKey) => (
                  <Button
                    key={badgeKey}
                    type="button"
                    size="sm"
                    variant={form.badge === badgeKey ? "default" : "outline"}
                    onClick={() => setForm({ ...form, badge: badgeKey })}
                    className={
                      form.badge === badgeKey
                        ? badgeKey === "oferta"
                          ? "bg-yellow-400 text-black font-bold hover:bg-yellow-500"
                          : badgeKey === "leve"
                          ? "bg-amber-600 text-white font-bold"
                          : badgeKey === "imperdivel"
                          ? "bg-red-600 text-white font-bold"
                          : ""
                        : ""
                    }
                  >
                    {BADGE_LABELS[badgeKey]}
                  </Button>
                ),
              )}
            </div>
          </div>

          {/* Foto do Produto */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="font-semibold">Foto do Produto</Label>
              {form.photoSource && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    form.photoSource === "drive"
                      ? "bg-blue-50 text-blue-700 border-blue-300"
                      : form.photoSource === "zip"
                      ? "bg-purple-50 text-purple-700 border-purple-300"
                      : form.photoSource === "upload"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-neutral-100 text-neutral-600 border-neutral-300"
                  }`}
                >
                  Origem: {form.photoSource === "drive" ? "Google Drive" : form.photoSource === "zip" ? "Arquivo .ZIP" : "Upload Local"}
                </span>
              )}
            </div>
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-xl border bg-white flex items-center justify-center shrink-0">
                {form.image ? (
                  <img
                    src={form.image}
                    alt=""
                    style={{
                      transform: `scale(${form.imageScale || 1.0})`,
                      transformOrigin: "center center",
                    }}
                    className="h-full w-full object-contain p-1 transition-transform"
                  />
                ) : (
                  <Package className="h-8 w-8 text-neutral-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <Input
                  placeholder="URL direta da imagem"
                  value={form.image && form.image.startsWith("data:") ? "" : form.image || ""}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className="text-xs"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" />
                    Enviar foto do computador
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handleFile(e.target.files[0])
                      }
                    />
                  </label>
                  {form.image && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, image: "", imageScale: 1.0 })}
                      className="text-destructive h-8 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover foto
                    </Button>
                  )}
                </div>

                {/* Controles de Proporção e Escala da Foto */}
                {form.image && (
                  <div className="pt-2 border-t mt-2 flex flex-wrap items-center gap-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-1 mr-2">
                      <span className="text-xs font-bold text-neutral-700">
                        Escala / Proporção:
                      </span>
                      <span className="font-mono text-xs font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        {Math.round((form.imageScale || 1.0) * 100)}%
                      </span>
                    </div>

                    <div className="inline-flex items-center rounded-md border bg-white shadow-2xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleScaleChange(-0.1)}
                        className="h-7 px-2 text-xs"
                        title="Diminuir tamanho da foto (-10%)"
                      >
                        <ZoomOut className="h-3.5 w-3.5 mr-1" />
                        -10%
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetScale}
                        className="h-7 px-2 text-xs border-x"
                        title="Resetar para 100%"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        100%
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleScaleChange(0.1)}
                        className="h-7 px-2 text-xs"
                        title="Aumentar tamanho da foto (+10%)"
                      >
                        <ZoomIn className="h-3.5 w-3.5 mr-1" />
                        +10%
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTrimming}
                      onClick={handleTrimWhitespace}
                      className="h-7 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100"
                      title="Remove margens brancas vazias ao redor do produto para que ele preencha a área proporcionalmente"
                    >
                      <Scissors className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                      {isTrimming ? "Recortando..." : "Recortar Bordas Brancas (Auto-Trim)"}
                    </Button>
                  </div>
                )}

                {/* Seleção de Fotos Alternativas do Drive / ZIP para este código */}
                {form.alternativePhotos && form.alternativePhotos.length > 0 && (
                  <div className="pt-2 border-t mt-2 space-y-2 bg-indigo-50/60 p-3 rounded-lg border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        <span>
                          Fotos alternativas encontradas ({form.alternativePhotos.length})
                        </span>
                      </div>
                      <span className="text-[10.5px] text-indigo-700">
                        Clique para trocar a imagem ativa
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {form.alternativePhotos.map((alt, idx) => {
                        const isCurrent = form.image === alt.dataUrl;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (alt.dataUrl) {
                                setForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        image: alt.dataUrl || "",
                                        photoOriginName: alt.filename,
                                        photoSource: alt.source || prev.photoSource || "drive",
                                        imageScale: 1.0,
                                      }
                                    : null
                                );
                              }
                            }}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border bg-white cursor-pointer transition-all ${
                              isCurrent
                                ? "ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/30"
                                : "border-neutral-200 hover:border-indigo-400"
                            }`}
                          >
                            <div className="h-10 w-10 rounded border bg-neutral-50 flex items-center justify-center shrink-0 overflow-hidden">
                              {alt.dataUrl ? (
                                <img
                                  src={alt.dataUrl}
                                  alt=""
                                  className="h-full w-full object-contain p-0.5"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-neutral-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-mono text-[11px] font-bold text-neutral-900 truncate"
                                title={alt.filename}
                              >
                                {alt.filename}
                              </div>
                              <div className="text-[10px] font-semibold text-indigo-700">
                                {isCurrent ? "✓ Imagem em uso" : "Selecionar esta imagem"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
