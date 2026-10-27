import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { StoreConfig, CampaignConfig, ProductsPerPageOption } from "@/types/encarte";
import { Store, Upload, Trash2, Palette, Megaphone, LayoutGrid, Image as ImageIcon, AlertTriangle } from "lucide-react";

interface StoreSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: StoreConfig;
  campaign: CampaignConfig;
  onSaveStore: (store: StoreConfig) => void;
  onSaveCampaign: (campaign: CampaignConfig) => void;
}

export const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({
  open,
  onOpenChange,
  store,
  campaign,
  onSaveStore,
  onSaveCampaign,
}) => {
  const [storeForm, setStoreForm] = useState<StoreConfig>({ ...store });
  const [campForm, setCampForm] = useState<CampaignConfig>({ ...campaign });
  const [ratioWarning, setRatioWarning] = useState<string | null>(null);

  useEffect(() => {
    setStoreForm({ ...store });
  }, [store]);

  useEffect(() => {
    setCampForm({ ...campaign });
    setRatioWarning(null);
  }, [campaign]);

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setStoreForm((prev) => ({ ...prev, logo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleHeaderUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const idealRatio = 2480 / 875; // ~2.834
        const imgRatio = w / h;

        // Avisar se a proporção divergir em mais de 15%
        if (Math.abs(imgRatio - idealRatio) / idealRatio > 0.15) {
          setRatioWarning(
            `A imagem enviada (${w} × ${h} px, proporção ${(imgRatio).toFixed(2)}) difere da especificação recomendada (2480 × 875 px, proporção 2.83). Ela será centralizada e ajustada à largura com recorte mínimo.`
          );
        } else {
          setRatioWarning(null);
        }

        setCampForm((prev) => ({
          ...prev,
          customHeaderImage: dataUrl,
        }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveStore(storeForm);
    onSaveCampaign(campForm);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Store className="h-6 w-6 text-primary" />
            Configurações da Loja e da Campanha
          </DialogTitle>
          <DialogDescription>
            Personalize a grade de produtos por página, arte de cabeçalho, cores, contatos e dados do encarte. Suas configurações ficam salvas no navegador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 py-2">
          {/* Seção 1: Formato do Encarte e Produtos por Página */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <LayoutGrid className="h-4 w-4" />
              1. Formato do Encarte & Produtos por Página
            </h3>

            <div>
              <Label className="block mb-2 font-semibold">
                Produtos por página (Padrão: 12)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([12, 9, 8, 6] as ProductsPerPageOption[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      setCampForm((prev) => ({ ...prev, productsPerPage: opt }))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-center transition-all ${
                      campForm.productsPerPage === opt
                        ? "bg-red-600 text-white font-bold border-red-600 shadow-xs"
                        : "bg-white text-neutral-800 hover:bg-neutral-50 border-neutral-300 font-medium"
                    }`}
                  >
                    <div className="text-sm font-bold">{opt} produtos</div>
                    <div className="text-[10px] opacity-80">
                      {opt === 12
                        ? "3x4 (vertical)"
                        : opt === 9
                        ? "3x3 (vertical)"
                        : opt === 8
                        ? "2x4 (horizontal)"
                        : "2x3 (horizontal)"}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                O total de páginas é calculado automaticamente. Se a última página tiver apenas 1 produto, ele ocupará a página inteira em destaque.
              </p>
            </div>
          </div>

          {/* Seção 2: Cabeçalho Personalizado e Campanha */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <ImageIcon className="h-4 w-4" />
              2. Cabeçalho Personalizado da Peça A4
            </h3>

            <div className="space-y-2">
              <Label className="block font-semibold">Arte de Cabeçalho (PNG ou JPG)</Label>
              <p className="text-[11px] text-muted-foreground">
                Especificação recomendada: <strong>2480 × 875 px</strong> a 300 DPI (largura A4 com cerca de 74 mm de altura).
                Para gráfica com sangria de 3 mm em cada lado: <strong>2551 × 910 px</strong>.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-xs font-bold hover:bg-neutral-50 shadow-2xs">
                  <Upload className="h-4 w-4 text-primary" />
                  Enviar Cabeçalho (PNG / JPG)
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && handleHeaderUpload(e.target.files[0])
                    }
                  />
                </label>

                {campForm.customHeaderImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCampForm((prev) => ({ ...prev, customHeaderImage: "" }));
                      setRatioWarning(null);
                    }}
                    className="text-destructive h-9"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover Cabeçalho Personalizado
                  </Button>
                )}
              </div>

              {ratioWarning && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{ratioWarning}</span>
                </div>
              )}

              {/* Pré-visualização do cabeçalho customizado */}
              {campForm.customHeaderImage ? (
                <div className="mt-2 rounded-lg border overflow-hidden bg-black max-h-24 flex items-center justify-center">
                  <img
                    src={campForm.customHeaderImage}
                    alt="Cabeçalho Enviado"
                    className="w-full h-24 object-cover object-center"
                  />
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500 bg-white p-2.5 rounded border border-dashed">
                  Nenhuma arte enviada. Será utilizado o <strong>cabeçalho padrão preto</strong> com título e subtítulo editáveis.
                </div>
              )}

              {/* Opção: Texto por cima da arte */}
              {campForm.customHeaderImage && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="header-overlay"
                    checked={campForm.headerTextOverlay || false}
                    onCheckedChange={(checked) =>
                      setCampForm((prev) => ({
                        ...prev,
                        headerTextOverlay: Boolean(checked),
                      }))
                    }
                  />
                  <Label htmlFor="header-overlay" className="text-xs cursor-pointer font-medium">
                    Exibir texto de título e subtítulo por cima da arte
                  </Label>
                </div>
              )}
            </div>

            {/* Dados de Texto da Campanha (usados no cabeçalho padrão ou sobreposto) */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700">
                <Megaphone className="h-3.5 w-3.5" />
                Textos Promocionais
              </h4>

              <div>
                <Label htmlFor="camp-title">Título Principal (Padrão: DETONA PREÇOS)</Label>
                <Input
                  id="camp-title"
                  value={campForm.title}
                  onChange={(e) =>
                    setCampForm({ ...campForm, title: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: DETONA PREÇOS, SHOW DE OFERTAS"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="camp-subtitle">Subtítulo em Destaque</Label>
                  <Input
                    id="camp-subtitle"
                    value={campForm.subtitle}
                    onChange={(e) =>
                      setCampForm({ ...campForm, subtitle: e.target.value })
                    }
                    placeholder="Ex: Produtos com validade curta!"
                  />
                </div>

                <div>
                  <Label htmlFor="camp-obs">Observação / Prazo</Label>
                  <Input
                    id="camp-obs"
                    value={campForm.observation}
                    onChange={(e) =>
                      setCampForm({ ...campForm, observation: e.target.value })
                    }
                    placeholder="Ex: Não aceitamos devolução. Prazo 07 dias."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Dados da Loja */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
              <Store className="h-4 w-4" />
              3. Sua Loja & Identidade Visual
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="store-name">Nome da Loja</Label>
                <Input
                  id="store-name"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  placeholder="Ex: Supermercado Popular"
                  required
                />
              </div>

              <div>
                <Label htmlFor="store-phone">Telefone / WhatsApp</Label>
                <Input
                  id="store-phone"
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                  placeholder="Ex: (11) 99999-8888"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="store-address">Endereço Completo</Label>
              <Input
                id="store-address"
                value={storeForm.address}
                onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                placeholder="Ex: Av. Brasil, 1500 - Centro"
              />
            </div>

            {/* Logo da Loja */}
            <div>
              <Label className="block mb-1.5 font-semibold">Logotipo da Loja</Label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-1">
                  {storeForm.logo ? (
                    <img
                      src={storeForm.logo}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-neutral-300" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-white text-xs font-medium hover:bg-neutral-50">
                    <Upload className="h-3.5 w-3.5" />
                    Enviar Logotipo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handleLogoUpload(e.target.files[0])
                      }
                    />
                  </label>
                  {storeForm.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStoreForm({ ...storeForm, logo: "" })}
                      className="text-destructive h-8 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Cores da Loja */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2 font-semibold">
                <Palette className="h-4 w-4" />
                Cores do Encarte
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 border rounded-md p-2 bg-card">
                  <input
                    type="color"
                    id="col-primary"
                    value={storeForm.primaryColor}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, primaryColor: e.target.value })
                    }
                    className="h-8 w-8 cursor-pointer rounded border p-0"
                  />
                  <div>
                    <div className="text-xs font-semibold">Cor Primária</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {storeForm.primaryColor}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border rounded-md p-2 bg-card">
                  <input
                    type="color"
                    id="col-accent"
                    value={storeForm.accentColor}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, accentColor: e.target.value })
                    }
                    className="h-8 w-8 cursor-pointer rounded border p-0"
                  />
                  <div>
                    <div className="text-xs font-semibold">Cor Destaque</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {storeForm.accentColor}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border rounded-md p-2 bg-card">
                  <input
                    type="color"
                    id="col-dark"
                    value={storeForm.darkColor}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, darkColor: e.target.value })
                    }
                    className="h-8 w-8 cursor-pointer rounded border p-0"
                  />
                  <div>
                    <div className="text-xs font-semibold">Fundo Principal</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {storeForm.darkColor}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nota Legal */}
            <div>
              <Label htmlFor="legal-notice">Nota Legal do Rodapé</Label>
              <Textarea
                id="legal-notice"
                rows={2}
                value={storeForm.legalNotice}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, legalNotice: e.target.value })
                }
                placeholder="Ex: Ofertas válidas enquanto durarem os estoques..."
                className="text-xs"
              />
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
            <Button type="submit">Salvar Configurações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
