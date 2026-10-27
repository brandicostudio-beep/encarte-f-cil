import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  extractCategoryProducts,
  extractProduct,
} from "@/lib/product.functions";
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
import { A4Page } from "@/components/encarte/A4Page";
import { SpreadsheetModal } from "@/components/encarte/SpreadsheetModal";
import { ProductEditModal } from "@/components/encarte/ProductEditModal";
import { StoreSettingsModal } from "@/components/encarte/StoreSettingsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  Edit3,
  Search,
  ArrowUpDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  ZoomIn,
  ZoomOut,
  FileText,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Encartes Promocionais de Supermercado" },
      {
        name: "description",
        content:
          "Transforme categorias de fornecedores em encartes A4 de alta conversão, com visual de varejo e exportação em alta resolução.",
      },
      { property: "og:title", content: "Gerador de Encartes de Supermercado" },
    ],
  }),
  component: EncarteApp,
});

type SortOption = "code-asc" | "code-desc" | "name-asc" | "name-desc";
type FilterOption = "all" | "priced" | "unpriced" | "excluded" | "expired";

function EncarteApp() {
  const extractCategory = useServerFn(extractCategoryProducts);
  const extractSingle = useServerFn(extractProduct);

  // Estados principais
  const [categoryUrl, setCategoryUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "error" | "ok" | "warning";
    text: string;
  } | null>(null);

  // Lista de produtos
  const [products, setProducts] = useState<EncarteProduct[]>([]);

  // Configurações da loja e da campanha
  const [store, setStore] = useState<StoreConfig>(DEFAULT_STORE);
  const [campaign, setCampaign] = useState<CampaignConfig>(DEFAULT_CAMPAIGN);

  // Controles de visualização e paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(0.65);
  const [viewAllPages, setViewAllPages] = useState(false);

  // Filtro e Ordenação
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterOption>("all");
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

  // Manual Add Form State
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
        if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Salvar no localStorage quando alterado
  const saveStoreConfig = (updated: StoreConfig) => {
    setStore(updated);
    localStorage.setItem("encarte-store-v2", JSON.stringify(updated));
  };

  const saveCampaignConfig = (updated: CampaignConfig) => {
    setCampaign(updated);
    localStorage.setItem("encarte-campaign-v2", JSON.stringify(updated));
  };

  const updateProductsState = (updated: EncarteProduct[]) => {
    setProducts(updated);
    localStorage.setItem("encarte-products-v2", JSON.stringify(updated));
  };

  // FLUXO 1: Importar Categoria
  async function handleImportCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryUrl.trim()) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await extractCategory({ data: { url: categoryUrl } });
      if (!res.ok) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        updateProductsState(res.products);
        setStatusMsg({
          type: "ok",
          text: `Sucesso! ${res.totalFound} produtos foram importados. Preencha os preços abaixo para gerar o encarte.`,
        });
      }
    } catch {
      setStatusMsg({
        type: "error",
        text: "Não foi possível acessar a página do fornecedor. Verifique o link ou utilize as opções manuais.",
      });
    } finally {
      setLoading(false);
    }
  }

  // Carregar dados de demonstração (16 produtos de supermercado realistas)
  const handleLoadSample = () => {
    const samples = getSampleProducts();
    updateProductsState(samples);
    setStatusMsg({
      type: "ok",
      text: "16 produtos de demonstração carregados com sucesso! Confira o encarte ao lado.",
    });
  };

  // Limpar lista de produtos
  const handleClearProducts = () => {
    if (confirm("Deseja remover todos os produtos da lista?")) {
      updateProductsState([]);
      setStatusMsg(null);
    }
  };

  // FLUXO 3: Preenchimento em Massa por Planilha
  const handleApplySpreadsheetPrices = (
    updates: { code: string; price: string }[],
  ) => {
    const priceMap = new Map(
      updates.map((u) => [u.code.toLowerCase().trim(), u.price]),
    );

    let count = 0;
    const updated = products.map((p) => {
      const newPrice = priceMap.get(p.code.toLowerCase().trim());
      if (newPrice) {
        count++;
        return { ...p, price: newPrice };
      }
      return p;
    });

    updateProductsState(updated);
    setStatusMsg({
      type: "ok",
      text: `${count} preços foram atualizados em massa pela planilha!`,
    });
  };

  // Atualização inline de preço
  const handlePriceChange = (id: string, newPrice: string) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, price: newPrice } : p,
    );
    updateProductsState(updated);
  };

  // Toggle de inclusão no encarte
  const handleToggleIncluded = (id: string, included: boolean) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, included } : p,
    );
    updateProductsState(updated);
  };

  // Adicionar produto manual
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
    setStatusMsg({
      type: "ok",
      text: `Produto "${created.name}" adicionado com sucesso!`,
    });
  };

  // Deletar item
  const handleDeleteProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    updateProductsState(updated);
  };

  // Contadores e estatísticas
  const totalProducts = products.length;
  const pricedProducts = useMemo(
    () => products.filter((p) => p.price && p.price.trim() !== ""),
    [products],
  );
  const unpricedCount = totalProducts - pricedProducts.length;

  // Produtos que realmente entrarão no encarte (com preço e marcados como included)
  const flyerProducts = useMemo(() => {
    const eligible = products.filter(
      (p) => p.included && p.price && p.price.trim() !== "",
    );

    // Ordenação
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
    [flyerProducts],
  );

  // Paginação do Encarte (8 produtos por página A4)
  const totalPages = Math.max(1, Math.ceil(flyerProducts.length / 8));

  // Produtos da página selecionada
  const pageProducts = useMemo(() => {
    const start = (currentPage - 1) * 8;
    return flyerProducts.slice(start, start + 8);
  }, [flyerProducts, currentPage]);

  // Lista filtrada para a tabela de edição
  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      );
    }

    if (filterType === "priced") {
      result = result.filter((p) => p.price && p.price.trim() !== "");
    } else if (filterType === "unpriced") {
      result = result.filter((p) => !p.price || p.price.trim() === "");
    } else if (filterType === "excluded") {
      result = result.filter((p) => !p.included);
    } else if (filterType === "expired") {
      result = result.filter((p) => isDateExpired(p.validity));
    }

    return result.sort((a, b) => {
      if (sortBy === "code-asc") return a.code.localeCompare(b.code, undefined, { numeric: true });
      if (sortBy === "code-desc") return b.code.localeCompare(a.code, undefined, { numeric: true });
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [products, searchQuery, filterType, sortBy]);

  // FLUXO 7: Exportação de JPG e PDF
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

        const dataUrl = await toJpeg(pageEl, {
          quality: 0.95,
          pixelRatio: 2.5,
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
      setStatusMsg({
        type: "ok",
        text: "PDF único gerado com sucesso com todas as páginas!",
      });
    } catch (err) {
      console.error(err);
      setStatusMsg({
        type: "error",
        text: "Erro ao gerar PDF. Tente imprimir diretamente ou baixar JPG.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    if (flyerProducts.length === 0) {
      alert("Nenhum produto com preço está marcado para entrar no encarte.");
      return;
    }
    // Regra: Validade já vencida gera aviso antes da exportação
    if (expiredInFlyer.length > 0) {
      setPendingExportAction(() => executeExportPdf);
      setExpiredWarningOpen(true);
      return;
    }
    executeExportPdf();
  };

  const executeExportJpgCurrentPage = async () => {
    const pageEl = document.getElementById(`encarte-page-${currentPage}`);
    if (!pageEl) return;

    setExporting(true);
    try {
      const dataUrl = await toJpeg(pageEl, {
        quality: 0.96,
        pixelRatio: 3,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `encarte-pagina-${currentPage}.jpg`;
      a.click();
      setStatusMsg({
        type: "ok",
        text: `Página ${currentPage} baixada em alta resolução (JPG)!`,
      });
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao exportar imagem JPG." });
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
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900 pb-16">
      {/* Topo / Barra de Navegação */}
      <header className="bg-black text-white shadow-md sticky top-0 z-40 border-b-2 border-yellow-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-yellow-300 font-display text-2xl font-black shadow">
              %
            </div>
            <div>
              <h1 className="font-display text-xl uppercase tracking-wider text-yellow-300 leading-none">
                GERADOR DE ENCARTES
              </h1>
              <p className="text-[11px] text-neutral-400 font-medium">
                Encartes de Supermercado em A4 de Alta Resolução
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStoreSettingsOpen(true)}
              className="bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800 hover:text-yellow-300"
            >
              <Store className="h-4 w-4 mr-1.5 text-yellow-400" />
              Sua Loja & Campanha
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal em 2 Colunas */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA: Fluxo de Importação, Lista de Produtos e Preços (7 Colunas) */}
        <section className="lg:col-span-7 space-y-6">
          {/* FLUXO 1: Importar Categoria */}
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-red-600" />
                  1. Importar Produtos da Categoria
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cole o link da página do fornecedor (ex.: "validade próxima" ou lista de produtos).
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                className="text-xs bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
                Exemplo de Teste
              </Button>
            </div>

            <form onSubmit={handleImportCategory} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://fornecedor.com.br/categoria/validade-proxima..."
                  value={categoryUrl}
                  onChange={(e) => setCategoryUrl(e.target.value)}
                  className="text-sm"
                  required
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0"
                >
                  {loading ? "Importando..." : "Importar produtos"}
                </Button>
              </div>
            </form>

            {statusMsg && (
              <div
                className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                  statusMsg.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : statusMsg.type === "warning"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-green-50 text-green-800 border border-green-200"
                }`}
              >
                {statusMsg.type === "error" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : null}
                <span>{statusMsg.text}</span>
              </div>
            )}
          </div>

          {/* FLUXO 2, 3 e 4: Lista de Produtos e Preços */}
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
            {/* Cabeçalho da Lista com Estatísticas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  2. Produtos Importados ({totalProducts})
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs bg-neutral-50">
                    Total: {totalProducts}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Com preço: {pricedProducts.length}
                  </Badge>
                  {unpricedCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                      Sem preço: {unpricedCount}
                    </Badge>
                  )}
                  {expiredInFlyer.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {expiredInFlyer.length} vencidos
                    </Badge>
                  )}
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSpreadsheetOpen(true)}
                  disabled={products.length === 0}
                  className="bg-green-50 text-green-800 border-green-300 hover:bg-green-100 text-xs font-semibold"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-green-600" />
                  Preencher em massa
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddManualOpen(true)}
                  className="text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo Item
                </Button>

                {products.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearProducts}
                    className="text-xs text-muted-foreground hover:text-destructive px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Aviso Visível de Produtos sem Preço */}
            {unpricedCount > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Aviso:</strong> {unpricedCount} produtos estão sem preço preenchido. Eles ficam marcados e{" "}
                  <strong>não entram no encarte A4</strong> até que tenham um preço definido.
                </div>
              </div>
            )}

            {/* Barra de Busca, Filtros e Ordenação */}
            {products.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                {/* Campo de Busca */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar código ou nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>

                {/* Filtro e Ordenação */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as FilterOption)}
                    className="rounded-md border bg-white px-2.5 py-1.5 text-xs text-neutral-700 shadow-sm focus:outline-none"
                  >
                    <option value="all">Todos ({totalProducts})</option>
                    <option value="priced">Com preço ({pricedProducts.length})</option>
                    <option value="unpriced">Sem preço ({unpricedCount})</option>
                    <option value="excluded">Desmarcados</option>
                    <option value="expired">Validade vencida</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded-md border bg-white px-2.5 py-1.5 text-xs text-neutral-700 shadow-sm focus:outline-none"
                  >
                    <option value="code-asc">Código (1-9)</option>
                    <option value="code-desc">Código (9-1)</option>
                    <option value="name-asc">Nome (A-Z)</option>
                    <option value="name-desc">Nome (Z-A)</option>
                  </select>
                </div>
              </div>
            ) : null}

            {/* Tabela de Produtos */}
            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-neutral-50/50">
                <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300 mb-2" />
                <h3 className="text-sm font-semibold text-neutral-700">
                  Nenhum produto para exibir
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Importe uma categoria pelo link acima, cole uma planilha ou carregue os produtos de demonstração.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button size="sm" onClick={handleLoadSample} variant="outline">
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />
                    Carregar Exemplo
                  </Button>
                  <Button size="sm" onClick={() => setAddManualOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar Manualmente
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden max-h-[560px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider border-b sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Ativo</th>
                      <th className="p-2.5 w-12 text-center">Foto</th>
                      <th className="p-2.5">Código & Nome</th>
                      <th className="p-2.5 w-24">Validade</th>
                      <th className="p-2.5 w-28">Preço (R$)</th>
                      <th className="p-2.5 w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredProducts.map((p) => {
                      const isExpired = isDateExpired(p.validity);
                      const hasPrice = Boolean(p.price && p.price.trim() !== "");

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-neutral-50/80 transition-colors ${
                            !hasPrice ? "bg-amber-50/30" : ""
                          }`}
                        >
                          {/* Checkbox Ativo */}
                          <td className="p-2.5 text-center">
                            <Checkbox
                              checked={p.included}
                              onCheckedChange={(checked) =>
                                handleToggleIncluded(p.id, Boolean(checked))
                              }
                            />
                          </td>

                          {/* Miniatura */}
                          <td className="p-2.5 text-center">
                            <div className="h-10 w-10 mx-auto rounded border bg-white flex items-center justify-center overflow-hidden">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt=""
                                  className="h-full w-full object-contain p-0.5"
                                />
                              ) : (
                                <span className="text-[9px] text-neutral-400 font-bold">
                                  SEM FOTO
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Código e Nome */}
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-red-600 text-[11px]">
                                {p.code}
                              </span>
                              <span className="text-neutral-300">·</span>
                              <span className="text-[10px] text-neutral-500 font-semibold">
                                {p.packaging}
                              </span>
                              {p.badge && p.badge !== "nenhum" && (
                                <Badge className="text-[9px] px-1.5 py-0 uppercase bg-yellow-400 text-black font-bold">
                                  {BADGE_LABELS[p.badge]}
                                </Badge>
                              )}
                            </div>
                            <div className="font-bold text-neutral-900 uppercase truncate max-w-[260px]">
                              {p.name}
                            </div>
                          </td>

                          {/* Validade */}
                          <td className="p-2.5">
                            <span
                              className={`font-semibold ${
                                isExpired
                                  ? "text-red-600 font-bold flex items-center gap-0.5"
                                  : "text-neutral-700"
                              }`}
                            >
                              {p.validity || "--/--/----"}
                              {isExpired && (
                                <AlertTriangle className="h-3 w-3 text-red-600 inline" />
                              )}
                            </span>
                          </td>

                          {/* Campo de Preço Inline */}
                          <td className="p-2.5">
                            <div className="relative">
                              <Input
                                placeholder="0,00"
                                value={p.price}
                                onChange={(e) =>
                                  handlePriceChange(p.id, e.target.value)
                                }
                                className={`h-8 text-xs font-bold ${
                                  !hasPrice
                                    ? "border-amber-400 bg-amber-50 placeholder:text-amber-500"
                                    : "border-green-300 bg-green-50/30 text-green-800"
                                }`}
                              />
                            </div>
                          </td>

                          {/* Ações */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditProduct(p)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Editar produto"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Remover"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* COLUNA DIREITA: Pré-visualização A4 e Exportação (5 Colunas) */}
        <section className="lg:col-span-5 space-y-4">
          {/* Barra de Ações de Exportação */}
          <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Pré-visualização A4 ({flyerProducts.length} itens no encarte)
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {totalPages} {totalPages === 1 ? "página" : "páginas"} (8 produtos por página)
                </p>
              </div>

              {/* Controles de Zoom */}
              <div className="flex items-center gap-1 border rounded-md p-0.5 bg-neutral-50">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewZoom((z) => Math.max(0.4, z - 0.1))}
                  className="h-7 w-7 p-0"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] font-mono px-1">
                  {Math.round(previewZoom * 100)}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewZoom((z) => Math.min(1.0, z + 0.1))}
                  className="h-7 w-7 p-0"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Botões de Exportação */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                onClick={handleExportPdf}
                disabled={exporting || flyerProducts.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                {exporting ? "Gerando..." : "Baixar PDF"}
              </Button>

              <Button
                variant="outline"
                onClick={handleExportJpg}
                disabled={exporting || flyerProducts.length === 0}
                className="text-xs font-semibold"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Baixar JPG
              </Button>

              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={flyerProducts.length === 0}
                className="text-xs font-semibold"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir
              </Button>
            </div>

            {/* Navegação de Páginas */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>

                <span className="font-semibold text-neutral-700">
                  Página {currentPage} de {totalPages}
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Área Visual do Encarte A4 */}
          <div className="rounded-xl border bg-neutral-900/90 p-4 shadow-inner flex flex-col items-center justify-center overflow-auto min-h-[600px]">
            {flyerProducts.length === 0 ? (
              <div className="text-center text-neutral-400 p-8 space-y-2">
                <ShoppingBag className="mx-auto h-12 w-12 text-neutral-600" />
                <h3 className="font-semibold text-neutral-200">
                  Nenhum produto no encarte
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Preencha o preço dos produtos na lista à esquerda para que eles apareçam aqui no encarte A4.
                </p>
              </div>
            ) : (
              <div
                className="origin-top transition-transform shadow-2xl"
                style={{
                  transform: `scale(${previewZoom})`,
                  width: "794px",
                  height: "1123px",
                  marginBottom: `-${1123 * (1 - previewZoom)}px`,
                  marginRight: `-${794 * (1 - previewZoom)}px`,
                }}
              >
                <A4Page
                  domId={`encarte-page-${currentPage}`}
                  pageNumber={currentPage}
                  totalPages={totalPages}
                  products={pageProducts}
                  store={store}
                  campaign={campaign}
                />
              </div>
            )}
          </div>

          {/* Container oculto para renderizar todas as páginas durante exportação de PDF / Impressão */}
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
                />
              );
            })}
          </div>
        </section>
      </div>

      {/* MODAIS */}
      {/* 1. Modal Preenchimento em Massa por Planilha */}
      <SpreadsheetModal
        open={spreadsheetOpen}
        onOpenChange={setSpreadsheetOpen}
        products={products}
        onApplyPrices={handleApplySpreadsheetPrices}
      />

      {/* 2. Modal Edição de Produto */}
      <ProductEditModal
        product={editProduct}
        open={Boolean(editProduct)}
        onOpenChange={(open) => !open && setEditProduct(null)}
        onSave={(updated) => {
          const list = products.map((p) => (p.id === updated.id ? updated : p));
          updateProductsState(list);
          setStatusMsg({
            type: "ok",
            text: `Produto "${updated.name}" atualizado com sucesso!`,
          });
        }}
      />

      {/* 3. Modal Configurações da Loja e Campanha */}
      <StoreSettingsModal
        open={storeSettingsOpen}
        onOpenChange={setStoreSettingsOpen}
        store={store}
        campaign={campaign}
        onSaveStore={saveStoreConfig}
        onSaveCampaign={saveCampaignConfig}
      />

      {/* 4. Modal Adicionar Produto Manualmente */}
      <Dialog open={addManualOpen} onOpenChange={setAddManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Adicionar Produto Manualmente
            </DialogTitle>
            <DialogDescription>
              Cadastre um produto com código, nome e validade para entrar no encarte.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddManualProduct} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold">Código</label>
                <Input
                  placeholder="Ex: 24657"
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
                placeholder="Ex: LEITE UHT INTEGRAL 1L"
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
                  placeholder="Ex: 4,99"
                  value={newProd.price}
                  onChange={(e) =>
                    setNewProd({ ...newProd, price: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Data de Validade</label>
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
                  placeholder="Ex: 50 UND"
                  value={newProd.stock}
                  onChange={(e) =>
                    setNewProd({ ...newProd, stock: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Selo Promocional</label>
                <select
                  value={newProd.badge}
                  onChange={(e) =>
                    setNewProd({
                      ...newProd,
                      badge: e.target.value as BadgeType,
                    })
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

            <div>
              <label className="text-xs font-semibold">URL da Foto (Opcional)</label>
              <Input
                placeholder="https://.../foto.jpg"
                value={newProd.image}
                onChange={(e) =>
                  setNewProd({ ...newProd, image: e.target.value })
                }
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddManualOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Cadastrar Produto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Modal de Alerta: Validade Vencida Antes da Exportação */}
      <Dialog
        open={expiredWarningOpen}
        onOpenChange={setExpiredWarningOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Aviso: Produtos com Validade Vencida
            </DialogTitle>
            <DialogDescription>
              {expiredInFlyer.length} produto(s) no encarte possuem data de validade que já venceu em relação a hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1 text-xs">
            {expiredInFlyer.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center justify-between py-0.5 border-b border-border/50 last:border-none"
              >
                <span className="font-semibold truncate max-w-[200px]">
                  {ep.name}
                </span>
                <span className="text-destructive font-mono font-bold">
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
