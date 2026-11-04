import React, { useState, useEffect, useRef } from "react";
import type { ColecaoProduct } from "@/types/colecoes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  ImageIcon,
  Trash2,
  Sparkles,
  Scissors,
  Copy,
  Layers,
  Edit2,
  Check,
  RefreshCw,
} from "lucide-react";
import { removeWhiteBackground } from "@/lib/colecoes-image-processor";
import { autoTrimImageWhitespace } from "@/lib/image-normalizer";
import { extractGenericBaseName } from "@/lib/colecoes-similarity";
import { ProductCell } from "./ProductCell";

interface ColecaoProductEditModalProps {
  product: ColecaoProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: ColecaoProduct) => void;
}

export const ColecaoProductEditModal: React.FC<ColecaoProductEditModalProps> = ({
  product,
  open,
  onOpenChange,
  onSave,
}) => {
  const [form, setForm] = useState<ColecaoProduct | null>(product);
  const [isProcessingImg1, setIsProcessingImg1] = useState(false);
  const [isProcessingImg2, setIsProcessingImg2] = useState(false);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Sincroniza formulário sempre que o produto mudar
  useEffect(() => {
    if (product) {
      setForm({
        ...product,
        genericDescription:
          product.genericDescription ||
          extractGenericBaseName(product.description).toUpperCase(),
        secondaryImage:
          product.secondaryImage ||
          (product.variants && product.variants[0]?.image) ||
          "",
      });
    } else {
      setForm(null);
    }
  }, [product]);

  if (!open || !form) {
    return null;
  }

  // Upload de arquivo local para Foto 1
  const handleFilePhoto1 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImg1(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawUrl = String(reader.result);
        const transparentUrl = await removeWhiteBackground(rawUrl);
        setForm((prev) => (prev ? { ...prev, image: transparentUrl } : null));
        setIsProcessingImg1(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingImg1(false);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Upload de arquivo local para Foto 2
  const handleFilePhoto2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImg2(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawUrl = String(reader.result);
        const transparentUrl = await removeWhiteBackground(rawUrl);
        setForm((prev) =>
          prev ? { ...prev, secondaryImage: transparentUrl } : null
        );
        setIsProcessingImg2(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingImg2(false);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Recortar fundo da Foto 1
  const handleCutoutBg1 = async () => {
    if (!form.image) return;
    setIsProcessingImg1(true);
    try {
      const transparentUrl = await removeWhiteBackground(form.image);
      setForm((prev) => (prev ? { ...prev, image: transparentUrl } : null));
    } finally {
      setIsProcessingImg1(false);
    }
  };

  // Recortar fundo da Foto 2
  const handleCutoutBg2 = async () => {
    if (!form.secondaryImage) return;
    setIsProcessingImg2(true);
    try {
      const transparentUrl = await removeWhiteBackground(form.secondaryImage);
      setForm((prev) =>
        prev ? { ...prev, secondaryImage: transparentUrl } : null
      );
    } finally {
      setIsProcessingImg2(false);
    }
  };

  // Sugerir Nome Genérico automaticamente
  const handleAutoSuggestGenericName = () => {
    if (!form.description) return;
    const clean = extractGenericBaseName(form.description).trim().toUpperCase();
    setForm((prev) => (prev ? { ...prev, genericDescription: clean } : null));
  };

  // Salvar alterações
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const updated: ColecaoProduct = {
      ...form,
      description: form.description.trim().toUpperCase(),
      genericDescription: form.genericDescription?.trim().toUpperCase(),
      code: form.code.trim(),
      image: form.image.trim(),
      secondaryImage: form.secondaryImage?.trim() || undefined,
    };

    onSave(updated);
    onOpenChange(false);
  };

  const currentDisplayTitle = form.isPrincipal
    ? form.genericDescription || extractGenericBaseName(form.description).toUpperCase()
    : form.description.toUpperCase();

  const currentPhoto2 = form.secondaryImage || form.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-neutral-900 border-neutral-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
            <Edit2 className="h-4 w-4 text-[#FFD400]" />
            Personalizar Bloco do Produto ({form.code})
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400">
            Adicione ou troque fotos, edite a descrição completa e altere o nome exibido no card do encarte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* PRÉVIA VISUAL DO CARD EM TEMPO REAL */}
          <div className="rounded-xl border border-neutral-800 bg-[#160608] p-3 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Prévia do Bloco no Encarte
            </span>

            {/* Container do Bloco Único com ProductCell */}
            <div className="relative w-[245px] h-[220px] rounded-xl bg-black/40 border border-neutral-800 overflow-visible p-1">
              <ProductCell
                photo={form.image}
                photo2={currentPhoto2}
                title={currentDisplayTitle || "NOME DO PRODUTO"}
                code={!form.isPrincipal ? form.code : undefined}
                cellW={237}
                cellH={212}
                productScale={1.3}
                zIndex={1}
                limit={form.limit}
              />
            </div>
          </div>

          {/* CAMPOS DE DESCRIÇÃO E CÓDIGO (EDITÁVEIS IGUAL NO ENCARTE DE VALIDADE) */}
          <div className="space-y-3 bg-neutral-950/60 border border-neutral-800 p-3.5 rounded-xl">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-1">
                <Label htmlFor="modalEditCode" className="text-xs font-semibold text-neutral-300">
                  Código (Texto)
                </Label>
                <Input
                  id="modalEditCode"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="bg-neutral-900 border-neutral-700 text-white font-mono text-xs mt-1"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="modalEditDesc" className="text-xs font-semibold text-neutral-300">
                  Descrição Completa do Produto
                </Label>
                <Input
                  id="modalEditDesc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-neutral-900 border-neutral-700 text-white font-bold text-xs mt-1"
                  placeholder="Ex: SABONETE FLOR DE YPÊ ROSA 85G"
                  required
                />
              </div>
            </div>

            {/* Nome de Exibição no Card (Genérico sem sabor/fragrância) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="modalEditGeneric" className="text-xs font-semibold text-neutral-300">
                  Nome de Exibição no Card (Sem fragrância/sabor)
                </Label>
                <button
                  type="button"
                  onClick={handleAutoSuggestGenericName}
                  className="text-[11px] text-[#FFD400] hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="h-3 w-3" />
                  Sugerir automaticamente
                </button>
              </div>
              <Input
                id="modalEditGeneric"
                value={form.genericDescription || ""}
                onChange={(e) => setForm({ ...form, genericDescription: e.target.value })}
                className="bg-neutral-900 border-neutral-700 text-white font-bold text-xs"
                placeholder="Ex: SABONETE YPÊ"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                Este é o título que aparece centralizado em branco logo abaixo do bloco de fotos.
              </p>
            </div>

            {/* Faixa Opcional de Limite de Compra */}
            <div className="pt-2 border-t border-neutral-800">
              <Label htmlFor="modalEditLimit" className="text-xs font-semibold text-neutral-300">
                Faixa de Limite de Compra (Opcional)
              </Label>
              <Input
                id="modalEditLimit"
                value={form.limit || ""}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
                className="bg-neutral-900 border-neutral-700 text-amber-400 font-bold text-xs mt-1"
                placeholder="Ex: 1500CX ou 10 UN"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                Exibe a tarja laranja "LIMITE: ..." sobre a legenda bege do produto (igual na referência).
              </p>
            </div>

            {/* Alternância de Tipo Principal */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
              <div>
                <Label htmlFor="modalEditPrincipal" className="text-xs font-semibold text-neutral-200">
                  Produto Principal (Agrupa variações)
                </Label>
                <p className="text-[10px] text-neutral-400">
                  Produtos principais mostram as variações lado a lado e ocultam o código individual.
                </p>
              </div>
              <Switch
                id="modalEditPrincipal"
                checked={form.isPrincipal}
                onCheckedChange={(checked) => setForm({ ...form, isPrincipal: checked })}
              />
            </div>
          </div>

          {/* PERSONALIZAÇÃO DAS DUAS POSIÇÕES DE FOTO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* SLOT FOTO 1 (ESQUERDA) */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-[#FFD400]" />
                  Foto 1 (Principal)
                </span>
                {form.image && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ ...form, image: "" })}
                    className="h-6 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                )}
              </div>

              {/* URL ou Input Manual */}
              <div>
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://... ou suba um arquivo"
                  className="bg-neutral-900 border-neutral-700 text-neutral-300 font-mono text-[11px] h-8"
                />
              </div>

              {/* Botões de Ação para Foto 1 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef1.current?.click()}
                  disabled={isProcessingImg1}
                  className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 text-[11px] h-7 flex-1"
                >
                  <Upload className="h-3 w-3 mr-1 text-green-400" />
                  Trocar Foto 1
                </Button>
                <input
                  ref={fileInputRef1}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFilePhoto1}
                />

                {form.image && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCutoutBg1}
                    disabled={isProcessingImg1}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-[11px] h-7"
                    title="Remover fundo branco da Foto 1 e gerar PNG transparente"
                  >
                    <Scissors className="h-3 w-3 mr-1 text-amber-400" />
                    Fundo Transparente
                  </Button>
                )}
              </div>
            </div>

            {/* SLOT FOTO 2 (DIREITA) */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  Foto 2 (Variação / Secundária)
                </span>
                {form.secondaryImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm({ ...form, secondaryImage: "" })}
                    className="h-6 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                )}
              </div>

              {/* URL ou Input Manual */}
              <div>
                <Input
                  value={form.secondaryImage || ""}
                  onChange={(e) => setForm({ ...form, secondaryImage: e.target.value })}
                  placeholder="Deixe vazio para repetir a foto 1"
                  className="bg-neutral-900 border-neutral-700 text-neutral-300 font-mono text-[11px] h-8"
                />
              </div>

              {/* Botões de Ação para Foto 2 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef2.current?.click()}
                  disabled={isProcessingImg2}
                  className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 text-[11px] h-7 flex-1"
                >
                  <Upload className="h-3 w-3 mr-1 text-blue-400" />
                  Trocar Foto 2
                </Button>
                <input
                  ref={fileInputRef2}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFilePhoto2}
                />

                {form.image && !form.secondaryImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ ...form, secondaryImage: form.image })}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-[11px] h-7"
                    title="Usar a mesma foto da Foto 1 no Slot 2"
                  >
                    <Copy className="h-3 w-3 mr-1 text-purple-400" />
                    Repetir Foto 1
                  </Button>
                )}

                {form.secondaryImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCutoutBg2}
                    disabled={isProcessingImg2}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-[11px] h-7"
                    title="Remover fundo branco da Foto 2 e gerar PNG transparente"
                  >
                    <Scissors className="h-3 w-3 mr-1 text-amber-400" />
                    Fundo Transparente
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 shadow-md"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
