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
import { formatPrice } from "@/lib/parse-product";
import { Package, Upload, Trash2 } from "lucide-react";

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
  const [form, setForm] = useState<EncarteProduct | null>(null);

  useEffect(() => {
    if (product) {
      setForm({ ...product });
    }
  }, [product]);

  if (!form) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => (prev ? { ...prev, image: String(reader.result) } : null));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    onSave({
      ...form,
      price: formatPrice(form.price),
    });
    onOpenChange(false);
  };

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
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex: 24657"
              />
            </div>
            <div>
              <Label htmlFor="packaging">Embalagem</Label>
              <Input
                id="packaging"
                value={form.packaging}
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
              value={form.name}
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
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="Ex: 4,99"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unidade</Label>
              <Input
                id="unit"
                value={form.unit}
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
                value={form.validity}
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
            <Label className="block mb-1.5 font-semibold">Foto do Produto</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                {form.image ? (
                  <img
                    src={form.image}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Package className="h-7 w-7 text-neutral-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <Input
                  placeholder="URL direta da imagem"
                  value={form.image.startsWith("data:") ? "" : form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className="text-xs"
                />
                <div className="flex items-center gap-2">
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
                      onClick={() => setForm({ ...form, image: "" })}
                      className="text-destructive h-8 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover foto
                    </Button>
                  )}
                </div>
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
