import React, { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { ColecaoProduct } from "@/types/colecoes";
import {
  extractGenericBaseName,
  extractGenericGroupTitle,
  findSimilarCandidateGroups,
  parseNormalizedWeight,
  parsePackagingType,
  extractBrand,
} from "@/lib/colecoes-similarity";
import {
  Star,
  Sparkles,
  Plus,
  CheckCircle2,
  ImageIcon,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PrincipalVariantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ColecaoProduct | null;
  allProducts: ColecaoProduct[];
  onConfirm: (
    targetProduct: ColecaoProduct,
    genericDescription: string,
    selectedVariants: ColecaoProduct[]
  ) => void;
}

export const PrincipalVariantsModal: React.FC<PrincipalVariantsModalProps> = ({
  open,
  onOpenChange,
  product,
  allProducts,
  onConfirm,
}) => {
  const [genericDescription, setGenericDescription] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState("");
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [showIncompatibleList, setShowIncompatibleList] = useState(true);

  // Candidatos compatíveis e não agrupados (com motivos)
  const { compatible: autoCandidates, incompatible: incompatibleCandidates } = useMemo(() => {
    if (!product) return { compatible: [], incompatible: [] };
    return findSimilarCandidateGroups(product, allProducts);
  }, [product, allProducts]);

  // Inicializa quando abre o modal para um produto
  useEffect(() => {
    if (product && open) {
      // Sugestão automática: nome-base limpo sem fragrância, sem gramatura e sem código
      const defaultGeneric =
        product.genericDescription && product.genericDescription !== product.description
          ? product.genericDescription
          : extractGenericGroupTitle(product.description) ||
            extractGenericBaseName(product.description);
      setGenericDescription(defaultGeneric);

      // Se o produto já possuía variações salvas, usa-as; caso contrário, seleciona os compatíveis automáticos
      const initialIds =
        product.variantIds && product.variantIds.length > 0
          ? new Set(product.variantIds)
          : new Set(autoCandidates.map((c) => c.id));

      setSelectedVariantIds(initialIds);
      setShowManualPicker(false);
      setManualSearch("");
    }
  }, [product, open, allProducts, autoCandidates]);

  // Lista de produtos candidatos manuais (excluindo o principal)
  const manualCandidates = useMemo(() => {
    if (!product || !manualSearch.trim()) return [];
    const query = manualSearch.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.id !== product.id &&
        (p.code.toLowerCase().includes(query) || p.description.toLowerCase().includes(query))
    );
  }, [allProducts, product, manualSearch]);

  // Lista consolidada de variações selecionadas
  const selectedVariants = useMemo(() => {
    return allProducts.filter((p) => selectedVariantIds.has(p.id));
  }, [allProducts, selectedVariantIds]);

  if (!product) return null;

  const toggleVariant = (id: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const finalGeneric =
      genericDescription.trim() ||
      extractGenericGroupTitle(product.description) ||
      extractGenericBaseName(product.description);
    onConfirm(product, finalGeneric, selectedVariants);
    onOpenChange(false);
  };

  const targetWeight = parseNormalizedWeight(product.description);
  const targetPkg = parsePackagingType(product.description);
  const targetBrand = extractBrand(product.description);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
            Configurar Produto Principal e Variações
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-600">
            Ao ativar &quot;Principal&quot;, o encarte agrupa as fotos das variações lado a lado e exibe a descrição genérica sem código.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card do Produto Principal */}
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 shadow-2xs">
            <div className="h-16 w-16 shrink-0 rounded-md border bg-white p-1 flex items-center justify-center">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.description}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-neutral-400" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  PRINCIPAL
                </span>
                <span className="font-mono text-neutral-500">Cód: {product.code}</span>
                {targetBrand && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                    {targetBrand}
                  </span>
                )}
                {targetWeight && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {targetWeight.display}
                  </span>
                )}
                {targetPkg !== "padrao" && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 uppercase">
                    {targetPkg}
                  </span>
                )}
              </div>
              <p className="font-semibold text-neutral-800 line-clamp-1">{product.description}</p>
            </div>
          </div>

          {/* Campo de Descrição Genérica */}
          <div className="space-y-1.5">
            <Label
              htmlFor="genericDescInput"
              className="text-xs font-bold text-neutral-900 flex items-center gap-1.5"
            >
              <span>Descrição Genérica do Grupo (Exibida no Card)</span>
              <span className="text-[10px] text-neutral-500 font-normal">
                (sem sabor, fragrância ou gramatura)
              </span>
            </Label>
            <Input
              id="genericDescInput"
              value={genericDescription}
              onChange={(e) => setGenericDescription(e.target.value)}
              placeholder="Ex: LAVA ROUPAS PÓ TIXAN ou AMACIANTE YPÊ"
              className="text-xs font-semibold"
            />
          </div>

          {/* Candidatos Compatíveis Encontrados Automaticamente */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Variações Compatíveis Detectadas ({autoCandidates.length})
              </span>
              <span className="text-[11px] text-neutral-500">
                {selectedVariants.length} variação(ões) selecionada(s)
              </span>
            </div>

            {autoCandidates.length === 0 ? (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-center text-neutral-500">
                <p>Nenhum produto similar com mesmo nome-base encontrado automaticamente.</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Este produto entrará no encarte com a mesma foto repetida nas duas posições, ou você pode adicionar variações manualmente abaixo.
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-md p-2 bg-neutral-50/50">
                {autoCandidates.map((candidate) => {
                  const isChecked = selectedVariantIds.has(candidate.id);
                  const candWeight = parseNormalizedWeight(candidate.description);
                  const candPkg = parsePackagingType(candidate.description);

                  return (
                    <label
                      key={candidate.id}
                      className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                        isChecked
                          ? "border-purple-300 bg-purple-50/60"
                          : "border-neutral-200 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleVariant(candidate.id)}
                        />
                        <div className="h-10 w-10 shrink-0 rounded bg-white border p-0.5 flex items-center justify-center">
                          {candidate.image ? (
                            <img
                              src={candidate.image}
                              alt={candidate.description}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-800 line-clamp-1">
                            {candidate.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-neutral-500 font-mono">
                              Cód: {candidate.code}
                            </span>
                            {candWeight && (
                              <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-semibold text-emerald-700 border border-emerald-200">
                                {candWeight.display}
                              </span>
                            )}
                            {candPkg !== "padrao" && (
                              <span className="rounded bg-sky-50 px-1 py-0.2 text-[9px] font-semibold text-sky-700 border border-sky-200 uppercase">
                                {candPkg}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção "Não Agrupadas" (produtos com divergência de gramatura, embalagem ou marca) */}
          {incompatibleCandidates.length > 0 && (
            <div className="border-t pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setShowIncompatibleList((prev) => !prev)}
                className="flex items-center justify-between w-full text-left font-bold text-neutral-700 hover:text-neutral-900"
              >
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Não Agrupadas ({incompatibleCandidates.length})</span>
                  <span className="text-[10px] font-normal text-neutral-500">
                    (gramatura, embalagem ou marca divergentes)
                  </span>
                </span>
                {showIncompatibleList ? (
                  <ChevronUp className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              {showIncompatibleList && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-md p-2 bg-amber-50/30">
                  {incompatibleCandidates.map(({ product: cand, reasons }) => {
                    const isChecked = selectedVariantIds.has(cand.id);
                    return (
                      <div
                        key={cand.id}
                        className={`flex items-center justify-between rounded-md border p-2 transition-colors ${
                          isChecked
                            ? "border-amber-400 bg-amber-50"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="h-9 w-9 shrink-0 rounded bg-white border p-0.5 flex items-center justify-center">
                            {cand.image ? (
                              <img
                                src={cand.image}
                                alt={cand.description}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-neutral-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-neutral-800 line-clamp-1">
                              {cand.description}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Cód: {cand.code}
                              </span>
                              {reasons.map((r, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-semibold text-amber-800 border border-amber-200"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isChecked ? "default" : "outline"}
                          className={`h-6 text-[10px] ml-2 shrink-0 ${
                            isChecked
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "border-amber-300 text-amber-800 hover:bg-amber-100"
                          }`}
                          onClick={() => toggleVariant(cand.id)}
                        >
                          {isChecked ? "Remover" : "+ Adicionar mesmo assim"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Adicionar Variações Manualmente */}
          <div className="border-t pt-3 space-y-2">
            {!showManualPicker ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowManualPicker(true)}
                className="text-xs font-semibold text-neutral-700"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar Variação Manualmente
              </Button>
            ) : (
              <div className="rounded-md border p-2.5 bg-neutral-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-800">Buscar outro produto da coleção</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => setShowManualPicker(false)}
                  >
                    Fechar
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <Input
                    placeholder="Digite código ou nome do produto..."
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                {manualCandidates.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {manualCandidates.slice(0, 10).map((cand) => (
                      <div
                        key={cand.id}
                        className="flex items-center justify-between bg-white p-1.5 rounded border text-neutral-700"
                      >
                        <span className="truncate max-w-[320px] font-medium">{cand.description}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => {
                            setSelectedVariantIds((prev) => new Set([...prev, cand.id]));
                            setManualSearch("");
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pré-visualização do Modo de Renderização do Card */}
          <div className="rounded-lg border bg-neutral-100 p-2.5 text-neutral-700">
            <p className="font-bold text-[11px] text-neutral-900 mb-0.5">
              Como este item será renderizado no Encarte:
            </p>
            {selectedVariants.length > 0 ? (
              <p className="text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Regra 1: Principal com variações</strong> — Fotos lado a lado (principal + 1ª variação) com descrição genérica &quot;{genericDescription || extractGenericBaseName(product.description)}&quot;, sem código.
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Regra 2: Principal sem variações</strong> — Foto principal repetida nas duas posições com descrição genérica &quot;{genericDescription || extractGenericBaseName(product.description)}&quot;, sem código.
                </span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            Confirmar Variações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};