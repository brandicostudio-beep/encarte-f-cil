import React, { useState, useEffect, useRef } from "react";
import type { EncarteSemanalProduct } from "@/types/encarte-semanal";
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
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  RotateCcw,
  Sparkles,
  Scissors,
  Check,
  Image as ImageIcon,
  Search,
  Star,
} from "lucide-react";
import { removeWhiteBackground } from "@/lib/colecoes-image-processor";
import { autoTrimImageWhitespace } from "@/lib/image-normalizer";
import { findKnownPhotoForCode } from "@/lib/encarte-semanal-photos";
import { getActiveSnapshot } from "@/lib/painel-validade-storage";
import { cleanPrincipalDescription } from "@/lib/encarte-semanal-catalog";

interface EncarteSemanalProductModalProps {
  product: EncarteSemanalProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: EncarteSemanalProduct) => void;
}

export const EncarteSemanalProductModal: React.FC<EncarteSemanalProductModalProps> = ({
  product,
  open,
  onOpenChange,
  onSave,
}) => {
  const [form, setForm] = useState<EncarteSemanalProduct | null>(null);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [codeChangedWarning, setCodeChangedWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setForm({
        ...product,
        originalCode: product.originalCode ?? product.code,
        originalDescription: product.originalDescription ?? product.description,
        originalImage: product.originalImage ?? product.image,
      });
      setCodeChangedWarning(null);
    } else {
      setForm(null);
      setCodeChangedWarning(null);
    }
  }, [product, open]);

  if (!open || !form) {
    return null;
  }

  const handleCodeChange = (newCode: string) => {
    setForm((prev) => (prev ? { ...prev, code: newCode } : prev));
  };

  const handleSearchCodeMatch = () => {
    if (!form.code.trim()) return;

    const trimmedCode = form.code.trim();
    const foundPhoto = findKnownPhotoForCode(trimmedCode);

    // Buscar descrição do snapshot se disponível
    let foundDesc = "";
    try {
      const snap = getActiveSnapshot();
      if (snap?.lotes) {
        const item = snap.lotes.find(
          (l) => l.codprod && l.codprod.trim().toLowerCase() === trimmedCode.toLowerCase()
        );
        if (item && item.descricao) {
          foundDesc = item.descricao.toUpperCase();
        }
      }
    } catch {
      /* ignore */
    }

    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        image: foundPhoto || prev.image,
        description: foundDesc || prev.description,
      };
    });

    if (foundPhoto || foundDesc) {
      setCodeChangedWarning("Foto e descrição atualizadas com base no novo código.");
    } else {
      setCodeChangedWarning("Nenhuma foto encontrada automaticamente para este código.");
    }
  };

  const handleUndoCodeChange = () => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        code: prev.originalCode ?? prev.code,
        description: prev.originalDescription ?? prev.description,
        image: prev.originalImage ?? prev.image,
      };
    });
    setCodeChangedWarning("Alterações desfeitas para o código original.");
  };

  const handleCustomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImg(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const cleaned = await removeWhiteBackground(dataUrl);
        setForm((prev) => (prev ? { ...prev, image: cleaned || dataUrl } : prev));
        setIsProcessingImg(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingImg(false);
    }
  };

  const handleRemoveBg = async () => {
    if (!form.image) return;
    setIsProcessingImg(true);
    try {
      const cleaned = await removeWhiteBackground(form.image);
      const trimmed = await autoTrimImageWhitespace(cleaned);
      setForm((prev) => (prev ? { ...prev, image: trimmed } : prev));
    } catch (err) {
      console.warn("Erro ao remover fundo:", err);
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleSelectAlternativePhoto = (altUrl: string) => {
    setForm((prev) => (prev ? { ...prev, image: altUrl } : prev));
  };

  const handleResetAdjustments = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            scale: 1.15,
            offsetX: 0,
            offsetY: 0,
            overlapY: 15,
          }
        : prev
    );
  };

  const handleSave = () => {
    if (form) {
      onSave(form);
      onOpenChange(false);
    }
  };

  const hasCodeChanged = form.code !== form.originalCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-neutral-900 border border-neutral-800 text-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Editar Produto do Encarte Semanal
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs">
            Ajuste código, descrição, foto e posicionamento da célula. As alterações ficam salvas no navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2">
          {/* Coluna 1: Foto e Ajustes */}
          <div className="space-y-4">
            <Label className="text-xs font-bold text-neutral-300">Foto do Produto</Label>

            {/* Preview da foto */}
            <div className="h-44 w-full bg-[#330409] border border-amber-900/40 rounded-lg flex items-center justify-center p-3 relative overflow-hidden shadow-inner">
              {form.image ? (
                <img
                  src={form.image}
                  alt={form.description}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-400 text-xs gap-1">
                  <ImageIcon className="h-8 w-8 text-neutral-600" />
                  <span>Nenhuma foto vinculada</span>
                </div>
              )}
            </div>

            {/* Ações da Foto */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCustomPhotoUpload}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImg}
                className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs h-8"
              >
                <Upload className="h-3.5 w-3.5 mr-1 text-amber-300" />
                Trocar Foto
              </Button>

              {form.image && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveBg}
                  disabled={isProcessingImg}
                  className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 text-xs h-8"
                  title="Remove fundo branco da imagem"
                >
                  <Scissors className="h-3.5 w-3.5 mr-1 text-purple-400" />
                  Remover Fundo
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetAdjustments}
                className="text-neutral-400 hover:text-white text-xs h-8 ml-auto"
                title="Restaura escala e posição padrão"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Resetar Ajustes
              </Button>
            </div>

            {/* Fotos Alternativas */}
            {form.alternativePhotos && form.alternativePhotos.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                <Label className="text-[11px] font-semibold text-neutral-400">
                  Fotos Alternativas Encontradas ({form.alternativePhotos.length})
                </Label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {form.alternativePhotos.map((alt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectAlternativePhoto(alt.dataUrl)}
                      className={`h-12 w-12 rounded border p-1 bg-black/40 hover:border-amber-400 transition-all flex items-center justify-center shrink-0 ${
                        form.image === alt.dataUrl
                          ? "border-amber-400 ring-2 ring-amber-400/40"
                          : "border-neutral-700"
                      }`}
                      title={alt.filename}
                    >
                      <img
                        src={alt.dataUrl}
                        alt={alt.filename}
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sliders de Ajuste Fino */}
            <div className="space-y-3 pt-2 bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-neutral-300">
                  <span>Tamanho da Foto (Escala)</span>
                  <span className="font-mono text-amber-300">
                    {Math.round(((form.scale ?? 1.15) > 10 ? (form.scale ?? 1.15) / 100 : (form.scale ?? 1.15)) * 100)}%
                  </span>
                </div>
                <Slider
                  min={80}
                  max={180}
                  step={5}
                  value={[
                    Math.round(
                      ((form.scale ?? 1.15) > 10 ? (form.scale ?? 1.15) / 100 : (form.scale ?? 1.15)) * 100
                    ),
                  ]}
                  onValueChange={([val]) =>
                    setForm((prev) => (prev ? { ...prev, scale: val / 100 } : prev))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Posição X</span>
                    <span className="font-mono text-neutral-300">{form.offsetX ?? 0}px</span>
                  </div>
                  <Slider
                    min={-60}
                    max={60}
                    step={2}
                    value={[form.offsetX ?? 0]}
                    onValueChange={([val]) =>
                      setForm((prev) => (prev ? { ...prev, offsetX: val } : prev))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>Posição Y</span>
                    <span className="font-mono text-neutral-300">{form.offsetY ?? 0}px</span>
                  </div>
                  <Slider
                    min={-60}
                    max={60}
                    step={2}
                    value={[form.offsetY ?? 0]}
                    onValueChange={([val]) =>
                      setForm((prev) => (prev ? { ...prev, offsetY: val } : prev))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Sobreposição na Barra Inferior</span>
                  <span className="font-mono text-neutral-300">{form.overlapY ?? 15}px</span>
                </div>
                <Slider
                  min={-10}
                  max={35}
                  step={1}
                  value={[form.overlapY ?? 15]}
                  onValueChange={([val]) =>
                    setForm((prev) => (prev ? { ...prev, overlapY: val } : prev))
                  }
                />
              </div>
            </div>
          </div>

          {/* Coluna 2: Dados do Produto */}
          <div className="space-y-4">
            {/* Bloco Classificar como Principal */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                form.isPrincipal
                  ? "bg-amber-500/15 border-amber-500/50"
                  : "bg-neutral-950/70 border-neutral-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form.isPrincipal
                        ? "bg-amber-500/30 text-amber-300"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${form.isPrincipal ? "fill-amber-400 text-amber-400" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">
                      {form.isPrincipal ? "⭐ Produto Principal Ativo" : "Classificar como Principal"}
                    </span>
                    <span className="text-[11px] text-neutral-400 block truncate">
                      {form.isPrincipal
                        ? "Fica sem código e com descrição genérica na arte."
                        : "Exibe código e descrição na arte."}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={form.isPrincipal ? "default" : "outline"}
                  onClick={() => {
                    if (form.isPrincipal) {
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              isPrincipal: false,
                              code: prev.originalCode || prev.code,
                              description: prev.originalDescription || prev.description,
                            }
                          : prev
                      );
                    } else {
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              isPrincipal: true,
                              originalCode: prev.originalCode || prev.code,
                              code: "",
                              originalDescription: prev.originalDescription || prev.description,
                              description: cleanPrincipalDescription(prev.description),
                            }
                          : prev
                      );
                    }
                  }}
                  className={`h-8 text-xs font-bold shrink-0 ${
                    form.isPrincipal
                      ? "bg-amber-500 hover:bg-amber-600 text-neutral-950"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white"
                  }`}
                  data-testid="btn-modal-toggle-principal"
                >
                  {form.isPrincipal ? "Desmarcar" : "Tornar Principal"}
                </Button>
              </div>
            </div>

            {/* Campo Código */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="code" className="text-xs font-bold text-neutral-300">
                  Código do Produto
                </Label>
                {hasCodeChanged && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleUndoCodeChange}
                    className="h-6 px-2 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-neutral-800"
                    title="Restaura código original e foto original"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Desfazer código
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Ex: 19396"
                  className="bg-neutral-800 border-neutral-700 text-white font-mono text-sm uppercase"
                  data-testid="modal-input-code"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSearchCodeMatch}
                  className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 h-9 shrink-0"
                  title="Busca foto e descrição cadastradas para este código"
                >
                  <Search className="h-4 w-4 mr-1 text-amber-400" />
                  Buscar
                </Button>
              </div>
              {codeChangedWarning && (
                <p className="text-[11px] text-amber-400/90 italic">{codeChangedWarning}</p>
              )}
            </div>

            {/* Campo Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-bold text-neutral-300">
                Descrição do Produto (Na Barra Inferior)
              </Label>
              <textarea
                id="desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                }
                placeholder="Ex: AMEIXA EM CALDA LATA PREDILECTA"
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-md p-2.5 text-xs uppercase font-semibold leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                data-testid="modal-input-desc"
              />
            </div>

            {/* Campo Limite (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="limit" className="text-xs font-semibold text-neutral-400">
                Limite por Cliente (Opcional)
              </Label>
              <Input
                id="limit"
                value={form.limit ?? ""}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, limit: e.target.value || undefined } : prev))
                }
                placeholder="Ex: 1000CX ou 10 UN (deixe vazio se não houver)"
                className="bg-neutral-800 border-neutral-700 text-white text-xs uppercase"
              />
            </div>

            {/* Prévia da Barra Inferior */}
            <div className="pt-3 border-t border-neutral-800 space-y-1.5">
              <Label className="text-[11px] font-semibold text-neutral-400">
                Prévia da Barra na Arte
              </Label>
              <div className="flex flex-col items-center">
                {form.limit && (
                  <div className="bg-[#E65100] text-white font-black text-[9px] px-2 py-0.5 rounded-t-sm uppercase tracking-wider text-center shadow-xs leading-none mb-[-1px]">
                    LIMITE: {form.limit}
                  </div>
                )}
                <div className="w-full flex items-center gap-1.5 bg-[#F6E0A6] px-2 py-2 text-center font-extrabold uppercase leading-tight text-[#7A0D12] rounded-md shadow-sm">
                  {form.code && (
                    <span className="shrink-0 text-[12px] font-black font-mono border-r border-[#7A0D12]/30 pr-1.5">
                      {form.code}
                    </span>
                  )}
                  <span className="line-clamp-2 flex-1 text-[11px] font-black">
                    {form.description || "NOME DO PRODUTO"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t border-neutral-800 pt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-neutral-400 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
            data-testid="modal-save-button"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
