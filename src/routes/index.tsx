import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { extractCategoryProducts } from "@/lib/product.functions";
import type {
  EncarteProduct,
  StoreConfig,
  CampaignConfig,
  BadgeType,
} from "@/types/encarte";
import {
  DEFAULT_STORE,
  DEFAULT_CAMPAIGN,
  BADGE_LABELS,
} from "@/types/encarte";
import {
  isDateExpired,
  getSampleProducts,
} from "@/lib/encarte-helpers";
import { formatPrice } from "@/lib/parse-product";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

// Componentes da Interface de Alta Experiência (UX/UI)
import { EditorStepper, type EditorStep } from "@/components/encarte/EditorStepper";
import { PendingSidebar, type IssueFilter } from "@/components/encarte/PendingSidebar";
import { ReviewTable } from "@/components/encarte/ReviewTable";
import { SourceSelector } from "@/components/encarte/SourceSelector";
import { EmptyState } from "@/components/encarte/EmptyState";
import { A4Page } from "@/components/encarte/A4Page";
import { SpreadsheetModal } from "@/components/encarte/SpreadsheetModal";
import { ProductEditModal } from "@/components/encarte/ProductEditModal";
import { StoreSettingsModal } from "@/components/encarte/StoreSettingsModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  FileSpreadsheet,
  Store,
  Plus,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  FileText,
  RotateCcw,
  Sparkles,
  Maximize2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Encartes de Varejo - A4 Impresso & Digital" },
      {
        name: "description",
        content:
          "Do zero ao encarte A4 de supermercado pronto para gráfica em 300 DPI ou JPG digital, com validação de preços, códigos e validades.",
      },
    ],
  }),
  component: EncarteApp,
});

type SortOption = "code-asc" | "code-desc" | "name-asc" | "name-desc";

function EncarteApp() {
  const extractCategory = useServerFn(extractCategoryProducts);

  // FLUXO DE ETAPAS (Origem, Dados, Preços, Campanha, Exportar)
  const [currentStep, setCurrentStep] = useState<EditorStep>("origem");
  const [completedSteps, setCompletedSteps] = useState<Set<EditorStep>>(
    new Set()
  );

  // Lista de Produtos e Pilha de Desfazer (Undo)
  const [products, setProducts] = useState<EncarteProduct[]>([]);
  const [undoStack, setUndoStack] = useState<EncarteProduct[][]>([]);
  const [unmatchedPhotos, setUnmatchedPhotos] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState<string>("Salvo agora há pouco");

  // Configurações da Loja e da Campanha
  const [store, setStore] = useState<StoreConfig>(DEFAULT_STORE);
  const [campaign, setCampaign] = useState<CampaignConfig>(DEFAULT_CAMPAIGN);

  // Controles de Visualização A4
  const [currentPage, setCurrentPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(0.68);
  const [isRealScale, setIsRealScale] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filtros e Ordenação da Tabela
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIssueFilter, setActiveIssueFilter] = useState<IssueFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("code-asc");

  // Modais
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [storeSettingsOpen, setStoreSettingsOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<EncarteProduct | null>(null);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const [expiredWarningOpen, setExpiredWarningOpen] = useState(false);
  const [pendingExportAction, setPendingExportAction] = useState<
    (() => void) | null
  >(null);

  // Formulário Manual de Produto
  const [newProd, setNewProd] = useState({
    code: "",
    name: "",
    packaging: "1 UN",
    validity: "",
    price: "",
    unit: "UND",
    stock: "",
    badge: "nenhum" as BadgeType,
    image: "",
  });

  // Carregar dados salvos no localStorage
  useEffect(() => {
    try {
      const savedStore = localStorage.getItem("encarte-store-v2");
      if (savedStore) setStore(JSON.parse(savedStore));

      const savedCampaign = localStorage.getItem("encarte-campaign-v2");
      if (savedCampaign) setCampaign(JSON.parse(savedCampaign));

      const savedProds = localStorage.getItem("encarte-products-v2");
      if (savedProds) {
        const parsed = JSON.parse(savedProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setCurrentStep("precos");
          setCompletedSteps(new Set(["origem", "dados"]));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Atalho de Teclado Global: Ctrl+Z para Desfazer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack]);

  // Atualizar estado com histórico de Desfazer e Auto-Save
  const updateProductsState = (
    updated: EncarteProduct[],
    saveToUndo: boolean = true
  ) => {
    if (saveToUndo && products.length > 0) {
      setUndoStack((prev) => [...prev.slice(-10), products]);
    }
    setProducts(updated);
    localStorage.setItem("encarte-products-v2", JSON.stringify(updated));

    // Feedback discreto de salvamento
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    setSavedNotice(`Salvo às ${timeStr}`);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    updateProductsState(previous, false);
    setSavedNotice("Alteração desfeita");
  };

  // Salvar configurações
  const saveStoreConfig = (updated: StoreConfig) => {
    setStore(updated);
    localStorage.setItem("encarte-store-v2", JSON.stringify(updated));
    setSavedNotice("Configurações da loja salvas");
  };

  const saveCampaignConfig = (updated: CampaignConfig) => {
    setCampaign(updated);
    localStorage.setItem("encarte-campaign-v2", JSON.stringify(updated));
    setSavedNotice("Campanha salva");
  };

  // Carregar produtos de qualquer origem (Planilha ou Link)
  const handleDataLoaded = (
    loaded: EncarteProduct[],
    sourceType: "spreadsheet" | "link" | "sample",
    unmatched: string[]
  ) => {
    updateProductsState(loaded);
    setUnmatchedPhotos(unmatched);
    setCompletedSteps((prev) => new Set([...prev, "origem", "dados"]));
    setCurrentStep("precos");
  };

  // Carregar dados de demonstração (16 produtos com codes, fotos e validade)
  const handleLoadSample = () => {
    const samples = getSampleProducts();
    updateProductsState(samples);
    setUnmatchedPhotos([]);
    setCompletedSteps((prev) => new Set([...prev, "origem", "dados"]));
    setCurrentStep("precos");
  };

  const handleResetEncarte = () => {
    if (confirm("Deseja reiniciar o encarte para escolher uma nova origem?")) {
      updateProductsState([]);
      setUnmatchedPhotos([]);
      setCurrentStep("origem");
      setCompletedSteps(new Set());
    }
  };

  // Conexão com a Server Function de categoria
  const handleExtractCategoryUrl = async (url: string) => {
    const res = await extractCategory({ data: { url } });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true, products: res.products };
  };

  // Preenchimento em massa de preços pela planilha
  const handleApplySpreadsheetPrices = (
    updates: { code: string; price: string }[]
  ) => {
    const priceMap = new Map(
      updates.map((u) => [u.code.toLowerCase().trim(), u.price])
    );

    const updated = products.map((p) => {
      const newPrice = priceMap.get(p.code.toLowerCase().trim());
      if (newPrice) return { ...p, price: newPrice };
      return p;
    });

    updateProductsState(updated);
    setSavedNotice(`${updates.length} preços atualizados pela planilha`);
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, price: newPrice } : p
    );
    updateProductsState(updated);
  };

  const handleToggleIncluded = (id: string, included: boolean) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, included } : p
    );
    updateProductsState(updated);
  };

  const handleDeleteProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    updateProductsState(updated);
  };

  const handleAddManualProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;

    const created: EncarteProduct = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: newProd.code.trim() || String(products.length + 10001),
      name: newProd.name.trim().toUpperCase(),
      packaging: newProd.packaging.trim().toUpperCase() || "1 UN",
      validity: newProd.validity.trim(),
      price: formatPrice(newProd.price),
      unit: newProd.unit.trim().toUpperCase() || "UND",
      stock: newProd.stock.trim() ? `${newProd.stock.trim()} UND` : "",
      badge: newProd.badge,
      image: newProd.image.trim(),
      included: true,
    };

    updateProductsState([created, ...products]);
    setNewProd({
      code: "",
      name: "",
      packaging: "1 UN",
      validity: "",
      price: "",
      unit: "UND",
      stock: "",
      badge: "nenhum",
      image: "",
    });
    setAddManualOpen(false);
  };

  // Estatísticas
  const totalProducts = products.length;
  const pricedProducts = useMemo(
    () => products.filter((p) => p.price && p.price.trim() !== ""),
    [products]
  );
  const unpricedCount = totalProducts - pricedProducts.length;

  // Produtos que realmente entrarão no encarte (com preço e incluídos)
  const flyerProducts = useMemo(() => {
    const eligible = products.filter(
      (p) => p.included && p.price && p.price.trim() !== ""
    );

    return eligible.sort((a, b) => {
      if (sortBy === "code-asc") return a.code.localeCompare(b.code, undefined, { numeric: true });
      if (sortBy === "code-desc") return b.code.localeCompare(a.code, undefined, { numeric: true });
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [products, sortBy]);

  // Produtos vencidos no encarte
  const expiredInFlyer = useMemo(
    () => flyerProducts.filter((p) => isDateExpired(p.validity)),
    [flyerProducts]
  );

  // Paginação: exatamente 8 produtos por página A4 (2 colunas x 4 linhas)
  const totalPages = Math.max(1, Math.ceil(flyerProducts.length / 8));

  const pageProducts = useMemo(() => {
    const start = (currentPage - 1) * 8;
    return flyerProducts.slice(start, start + 8);
  }, [flyerProducts, currentPage]);

  // Lista filtrada da tabela com base no painel de pendências e busca
  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
    }

    if (activeIssueFilter === "unpriced") {
      result = result.filter((p) => !p.price || p.price.trim() === "");
    } else if (activeIssueFilter === "missing_photo") {
      result = result.filter((p) => !p.image || p.image.trim() === "");
    } else if (activeIssueFilter === "expired") {
      result = result.filter((p) => isDateExpired(p.validity));
    } else if (activeIssueFilter === "excluded") {
      result = result.filter((p) => !p.included);
    }

    return result.sort((a, b) => {
      if (sortBy === "code-asc") return a.code.localeCompare(b.code, undefined, { numeric: true });
      if (sortBy === "code-desc") return b.code.localeCompare(a.code, undefined, { numeric: true });
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [products, searchQuery, activeIssueFilter, sortBy]);

  // Exportar PDF 300 DPI
  const executeExportPdf = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        const pageEl = document.getElementById(`encarte-page-${pIdx}`);
        if (!pageEl) continue;

        // Renderiza em 300 DPI equivalente (pixelRatio: 3.125 para atingir ~2480x3508px)
        const dataUrl = await toJpeg(pageEl, {
          quality: 0.98,
          pixelRatio: 3.125,
          style: { transform: "none" },
        });

        if (pIdx > 1) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      const filename = `encarte-${campaign.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.pdf`;
      pdf.save(filename);
      setCompletedSteps((prev) => new Set([...prev, "exportar"]));
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF. Você pode imprimir diretamente ou exportar JPG.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    if (flyerProducts.length === 0) {
      alert("Nenhum produto com preço está marcado para entrar no encarte.");
      return;
    }
    if (expiredInFlyer.length > 0) {
      setPendingExportAction(() => executeExportPdf);
      setExpiredWarningOpen(true);
      return;
    }
    executeExportPdf();
  };

  // Exportar JPG em Alta Resolução
  const executeExportJpgCurrentPage = async () => {
    const pageEl = document.getElementById(`encarte-page-${currentPage}`);
    if (!pageEl) return;

    setExporting(true);
    try {
      const dataUrl = await toJpeg(pageEl, {
        quality: 0.98,
        pixelRatio: 3.125,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `encarte-pagina-${currentPage}.jpg`;
      a.click();
    } catch {
      alert("Erro ao exportar imagem JPG.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportJpg = () => {
    if (flyerProducts.length === 0) {
      alert("Nenhum produto com preço está marcado para entrar no encarte.");
      return;
    }
    if (expiredInFlyer.length > 0) {
      setPendingExportAction(() => executeExportJpgCurrentPage);
      setExpiredWarningOpen(true);
      return;
    }
    executeExportJpgCurrentPage();
  };

  return (
    <div className="min-h-screen bg-neutral-100/90 font-sans text-neutral-900 pb-20">
      {/* 1. TOPO: Barra da Aplicação */}
      <header className="bg-[#0D0D0D] text-white shadow-md sticky top-0 z-40 border-b-2 border-[#FFD400]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-[#FFD400] font-display text-2xl font-black shadow-xs">
              %
            </div>
            <div>
              <h1 className="font-display text-lg uppercase tracking-wider text-[#FFD400] leading-none">
                GERADOR DE ENCARTES
              </h1>
              <p className="text-[11px] text-neutral-400 font-medium">
                Varejo Promocional A4 · Impressão Gráfica & Digital
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStoreSettingsOpen(true)}
              className="min-h-[44px] bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800 hover:text-[#FFD400] text-xs font-semibold"
            >
              <Store className="h-4 w-4 mr-1.5 text-[#FFD400]" />
              Configurar Loja & Cores
            </Button>
          </div>
        </div>
      </header>

      {/* 2. ETAPAS VISÍVEIS NO TOPO (Origem, Dados, Preços, Campanha, Exportar) */}
      <EditorStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(s) => setCurrentStep(s)}
        savedNotice={savedNotice}
        hasUndo={undoStack.length > 0}
        onUndo={handleUndo}
      />

      {/* 3. CONTEÚDO PRINCIPAL DO EDITOR */}
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* ETAPA 1: ESCOLHA DA ORIGEM (Quando na etapa de origem ou sem produtos) */}
        {currentStep === "origem" && (
          <SourceSelector
            onDataLoaded={handleDataLoaded}
            onExtractCategoryUrl={handleExtractCategoryUrl}
            onLoadSample={handleLoadSample}
            hasExistingProducts={products.length > 0}
            onReset={handleResetEncarte}
          />
        )}

        {/* ETAPA 2, 3, 4 E 5: QUANDO HÁ PRODUTOS OU NA ETAPA CORRESPONDENTE */}
        {currentStep !== "origem" && products.length === 0 && (
          <EmptyState
            type="no_products"
            primaryAction={{
              label: "Escolher Origem dos Dados",
              onClick: () => setCurrentStep("origem"),
              icon: <Sparkles className="h-4 w-4" />,
            }}
            secondaryAction={{
              label: "Carregar Dados de Demonstração",
              onClick: handleLoadSample,
            }}
          />
        )}

        {products.length > 0 && currentStep !== "origem" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* PAINEL LATERAL DE PENDÊNCIAS (SEMPRE VISÍVEL NO DESKTOP, 3 COLUNAS) */}
            <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-[128px]">
              <PendingSidebar
                products={products}
                unmatchedPhotos={unmatchedPhotos}
                activeFilter={activeIssueFilter}
                onFilterChange={(f) => setActiveIssueFilter(f)}
                onOpenSpreadsheetModal={() => setSpreadsheetOpen(true)}
              />

              {/* Ação Primária da Etapa: Avançar */}
              {currentStep === "precos" && (
                <Button
                  onClick={() => {
                    setCompletedSteps((prev) => new Set([...prev, "precos"]));
                    setCurrentStep("exportar");
                  }}
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                >
                  Conferir Pré-visualização A4
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}

              {currentStep === "exportar" && (
                <div className="rounded-xl border bg-white p-3 shadow-xs space-y-2 text-xs">
                  <div className="font-bold text-neutral-900">
                    Resumo do Encarte:
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Páginas A4:</span>
                    <span className="font-bold">{totalPages}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Itens no Encarte:</span>
                    <span className="font-bold text-green-700">{flyerProducts.length}</span>
                  </div>
                  {unpricedCount > 0 && (
                    <div className="flex justify-between text-amber-700 font-semibold border-t pt-1">
                      <span>Omitidos (sem preço):</span>
                      <span>{unpricedCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ÁREA CENTRAL: TABELA DE REVISÃO OU PRÉ-VISUALIZAÇÃO A4 (9 COLUNAS) */}
            <div className="lg:col-span-9 space-y-6">
              {/* SE ETAPA FOR PREÇOS OU CAMPANHA */}
              {currentStep === "precos" && (
                <div className="space-y-4">
                  {/* Barra de Ferramentas da Tabela */}
                  <div className="rounded-xl border bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        placeholder="Buscar por código ou descrição..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 text-xs min-h-[44px]"
                        aria-label="Buscar produtos na tabela"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSpreadsheetOpen(true)}
                        className="min-h-[44px] text-xs font-bold text-green-800 bg-green-50 border-green-300 hover:bg-green-100"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1.5 text-green-600" />
                        Colar Planilha de Preços
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddManualOpen(true)}
                        className="min-h-[44px] text-xs font-semibold"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Novo Produto
                      </Button>
                    </div>
                  </div>

                  {/* Tabela de Revisão com Acessibilidade e Tecla Enter */}
                  <ReviewTable
                    products={filteredProducts}
                    onPriceChange={handlePriceChange}
                    onToggleIncluded={handleToggleIncluded}
                    onEditProduct={(p) => setEditProduct(p)}
                    onDeleteProduct={handleDeleteProduct}
                  />
                </div>
              )}

              {/* SE ETAPA FOR EXPORTAR OU PRÉ-VISUALIZAÇÃO */}
              {currentStep === "exportar" && (
                <div className="space-y-4">
                  {/* Barra de Controles de Impressão e Escala */}
                  <div className="rounded-xl border bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900">
                        Conferência da Peça A4 ({flyerProducts.length} itens inclusos)
                      </h2>
                      <p className="text-[11px] text-neutral-500">
                        {totalPages} {totalPages === 1 ? "página A4" : "páginas A4"} · Padrão gráfica 300 DPI
                      </p>
                    </div>

                    {/* Controles de Escala Real 100% e Zoom */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isRealScale ? "default" : "outline"}
                        onClick={() => {
                          setIsRealScale(!isRealScale);
                          setPreviewZoom(isRealScale ? 0.68 : 1.0);
                        }}
                        className={`min-h-[44px] text-xs font-bold ${
                          isRealScale ? "bg-black text-[#FFD400]" : ""
                        }`}
                        title="Alternar entre Escala Real 100% e Ajuste de Tela"
                      >
                        <Maximize2 className="h-3.5 w-3.5 mr-1" />
                        {isRealScale ? "Escala 100% Ativa" : "Escala Real 100%"}
                      </Button>

                      <div className="flex items-center border rounded-lg bg-neutral-50 p-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsRealScale(false);
                            setPreviewZoom((z) => Math.max(0.4, z - 0.1));
                          }}
                          className="h-8 w-8 p-0"
                          title="Diminuir Zoom"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-[10px] font-mono px-2 font-bold">
                          {Math.round(previewZoom * 100)}%
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsRealScale(false);
                            setPreviewZoom((z) => Math.min(1.2, z + 0.1));
                          }}
                          className="h-8 w-8 p-0"
                          title="Aumentar Zoom"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Botões de Ação de Impressão & Exportação (Mínimo 44px de toque) */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleExportPdf}
                        disabled={exporting || flyerProducts.length === 0}
                        className="min-h-[44px] px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                      >
                        <FileText className="h-4 w-4 mr-1.5" />
                        {exporting ? "Gerando 300 DPI..." : "Baixar PDF (300 DPI)"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleExportJpg}
                        disabled={exporting || flyerProducts.length === 0}
                        className="min-h-[44px] text-xs font-semibold"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Baixar JPG
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => window.print()}
                        disabled={flyerProducts.length === 0}
                        className="min-h-[44px] text-xs font-semibold"
                      >
                        <Printer className="h-4 w-4 mr-1.5" />
                        Imprimir
                      </Button>
                    </div>
                  </div>

                  {/* Navegação de Páginas A4 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border text-xs">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="min-h-[36px] text-xs"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Página Anterior
                      </Button>

                      <span className="font-bold text-neutral-800">
                        Visualizando Página {currentPage} de {totalPages}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="min-h-[36px] text-xs"
                      >
                        Próxima Página
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}

                  {/* PALCO DE RENDERIZAÇÃO A4 (210 x 297 mm) */}
                  <div className="rounded-2xl border bg-neutral-900/95 p-6 shadow-inner flex flex-col items-center justify-center overflow-auto min-h-[640px]">
                    <div
                      className="origin-top transition-transform shadow-2xl"
                      style={{
                        transform: `scale(${previewZoom})`,
                        width: `${DESIGN_TOKENS.geometry.screenPreviewWidthPx}px`,
                        height: `${DESIGN_TOKENS.geometry.screenPreviewHeightPx}px`,
                        marginBottom: `-${
                          DESIGN_TOKENS.geometry.screenPreviewHeightPx *
                          (1 - previewZoom)
                        }px`,
                        marginRight: `-${
                          DESIGN_TOKENS.geometry.screenPreviewWidthPx *
                          (1 - previewZoom)
                        }px`,
                      }}
                    >
                      <A4Page
                        domId={`encarte-page-${currentPage}`}
                        pageNumber={currentPage}
                        totalPages={totalPages}
                        products={pageProducts}
                        store={store}
                        campaign={campaign}
                        totalProductsCount={flyerProducts.length}
                      />
                    </div>
                  </div>

                  {/* Container oculto para renderizar todas as páginas para PDF ou Impressão direta */}
                  <div className="flyer-print-container hidden">
                    {Array.from({ length: totalPages }).map((_, pIdx) => {
                      const start = pIdx * 8;
                      const prodsForPage = flyerProducts.slice(start, start + 8);
                      return (
                        <A4Page
                          key={`export-page-${pIdx + 1}`}
                          domId={`encarte-page-${pIdx + 1}`}
                          pageNumber={pIdx + 1}
                          totalPages={totalPages}
                          products={prodsForPage}
                          store={store}
                          campaign={campaign}
                          totalProductsCount={flyerProducts.length}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAIS DO SISTEMA */}
      {/* 1. Preenchimento em Massa por Planilha */}
      <SpreadsheetModal
        open={spreadsheetOpen}
        onOpenChange={setSpreadsheetOpen}
        products={products}
        onApplyPrices={handleApplySpreadsheetPrices}
      />

      {/* 2. Edição Detalhada por Item */}
      <ProductEditModal
        product={editProduct}
        open={Boolean(editProduct)}
        onOpenChange={(open) => !open && setEditProduct(null)}
        onSave={(updated) => {
          const list = products.map((p) =>
            p.id === updated.id ? updated : p
          );
          updateProductsState(list);
        }}
      />

      {/* 3. Configurações da Loja e Campanha */}
      <StoreSettingsModal
        open={storeSettingsOpen}
        onOpenChange={setStoreSettingsOpen}
        store={store}
        campaign={campaign}
        onSaveStore={saveStoreConfig}
        onSaveCampaign={saveCampaignConfig}
      />

      {/* 4. Cadastro Manual de Produto */}
      <Dialog open={addManualOpen} onOpenChange={setAddManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Cadastrar Produto Manualmente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha código, descrição e dados para adicionar à lista.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddManualProduct} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold">Código (Texto)</label>
                <Input
                  placeholder="Ex: 00123"
                  value={newProd.code}
                  onChange={(e) =>
                    setNewProd({ ...newProd, code: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Embalagem</label>
                <Input
                  placeholder="Ex: 1X10 GR"
                  value={newProd.packaging}
                  onChange={(e) =>
                    setNewProd({ ...newProd, packaging: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Nome do Produto</label>
              <Input
                placeholder="Ex: CAFÉ TRADICIONAL A VÁCUO 500G"
                value={newProd.name}
                onChange={(e) =>
                  setNewProd({ ...newProd, name: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold">Preço (R$)</label>
                <Input
                  placeholder="Ex: 14,90"
                  value={newProd.price}
                  onChange={(e) =>
                    setNewProd({ ...newProd, price: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Validade</label>
                <Input
                  placeholder="dd/mm/aaaa"
                  value={newProd.validity}
                  onChange={(e) =>
                    setNewProd({ ...newProd, validity: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold">Estoque (Opcional)</label>
                <Input
                  placeholder="Ex: 80 UND"
                  value={newProd.stock}
                  onChange={(e) =>
                    setNewProd({ ...newProd, stock: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Selo</label>
                <select
                  value={newProd.badge}
                  onChange={(e) =>
                    setNewProd({ ...newProd, badge: e.target.value as BadgeType })
                  }
                  className="w-full rounded-md border bg-white px-2 py-2 text-xs"
                >
                  <option value="nenhum">Sem selo</option>
                  <option value="oferta">OFERTA</option>
                  <option value="leve">LEVE JÁ</option>
                  <option value="imperdivel">IMPERDÍVEL</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddManualOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Cadastrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Alerta de Validade Vencida Antes da Exportação */}
      <Dialog open={expiredWarningOpen} onOpenChange={setExpiredWarningOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Produtos com Validade Vencida
            </DialogTitle>
            <DialogDescription className="text-xs">
              {expiredInFlyer.length} produto(s) no encarte possuem data de validade já vencida em relação a hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-40 overflow-y-auto rounded-md border bg-red-50/50 p-2 space-y-1 text-xs">
            {expiredInFlyer.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center justify-between py-1 border-b border-red-200 last:border-none"
              >
                <span className="font-semibold truncate max-w-[200px]">
                  {ep.name}
                </span>
                <span className="text-red-700 font-mono font-bold">
                  {ep.validity}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExpiredWarningOpen(false);
                setPendingExportAction(null);
              }}
            >
              Revisar Produtos
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setExpiredWarningOpen(false);
                if (pendingExportAction) {
                  pendingExportAction();
                  setPendingExportAction(null);
                }
              }}
            >
              Exportar Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
