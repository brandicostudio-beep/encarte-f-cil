import React, { useState, useEffect, useMemo, useRef } from "react";
import type { ColecaoProduct, ColecaoConfig } from "@/types/colecoes";
import { DEFAULT_COLECAO_CONFIG } from "@/types/colecoes";
import { paginateColecaoProducts } from "@/lib/colecoes-layout";
import { parseColecaoSpreadsheet } from "@/lib/colecoes-parser";
import { exportColecaoPageAsPng, exportColecaoAllPagesZip } from "@/lib/colecoes-export";
import { ColecoesPage } from "./ColecoesPage";
import { PrincipalVariantsModal } from "./PrincipalVariantsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Star,
  Download,
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  CheckCircle2,
  FolderOpen,
  ImageIcon,
  Eye,
  Edit2,
  Copy,
} from "lucide-react";

const STORAGE_KEY_PRODUCTS = "encarte-colecoes-products-v1";
const STORAGE_KEY_CONFIG = "encarte-colecoes-config-v1";

export const ColecoesWorkspace: React.FC = () => {
  // Estado isolado dos dados de Coleções
  const [products, setProducts] = useState<ColecaoProduct[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return [];
  });

  const [config, setConfig] = useState<ColecaoConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_COLECAO_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<"tabela" | "preview">("tabela");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(0.38); // 38% para encaixar 1080x1920 confortavelmente na tela
  const [isExporting, setIsExporting] = useState(false);

  // Modais
  const [variantsModalProduct, setVariantsModalProduct] = useState<ColecaoProduct | null>(null);
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [importSpreadsheetOpen, setImportSpreadsheetOpen] = useState(false);
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [newProd, setNewProd] = useState({ code: "", description: "", image: "", isPrincipal: false });

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoFolderInputRef = useRef<HTMLInputElement>(null);

  // Salvar no localStorage separadamente
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch {
      /* ignore */
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config]);

  // Paginação automática (20 produtos por página)
  const pages = useMemo(() => {
    return paginateColecaoProducts(products, config.itemsPerPage);
  }, [products, config.itemsPerPage]);

  const totalPages = Math.max(1, pages.length);

  // Garantir que a página atual seja válida
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Toggle do flag "Principal" com busca de similares
  const handleTogglePrincipal = (prod: ColecaoProduct) => {
    if (!prod.isPrincipal) {
      // Ao ativar "Principal", abre o modal para confirmar ou selecionar similares
      setVariantsModalProduct(prod);
      setVariantsModalOpen(true);
    } else {
      // Ao desativar, remove o flag de principal
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id
            ? { ...p, isPrincipal: false, variantIds: [], variants: [], genericDescription: undefined }
            : p
        )
      );
    }
  };

  const handleConfirmVariants = (
    targetProduct: ColecaoProduct,
    genericDescription: string,
    selectedVariants: ColecaoProduct[]
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === targetProduct.id) {
          return {
            ...p,
            isPrincipal: true,
            genericDescription,
            variantIds: selectedVariants.map((v) => v.id),
            variants: selectedVariants,
          };
        }
        return p;
      })
    );
  };

  // Importar planilha Excel/CSV
  const handleSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await parseColecaoSpreadsheet(file);
      if (res.products.length > 0) {
        setProducts(res.products);
        setImportSpreadsheetOpen(false);
      } else {
        alert(res.errors.join("\n") || "Nenhum produto válido encontrado.");
      }
    } catch (err: any) {
      alert("Erro ao ler a planilha: " + (err?.message || String(err)));
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Carregar fotos de pasta local (faz match por código do produto)
  const handlePhotoFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const codeToDataUrl = new Map<string, string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) continue;

      // Extrai código numérico do nome do arquivo (ex: "23396.jpg", "23396_1.png", "23396-1.jpg")
      const match = file.name.match(/^(\d{3,8})/);
      if (match) {
        const code = match[1];
        // Converte para dataUrl
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        if (!codeToDataUrl.has(code)) {
          codeToDataUrl.set(code, dataUrl);
        }
      }
    }

    if (codeToDataUrl.size > 0) {
      let matchedCount = 0;
      setProducts((prev) =>
        prev.map((p) => {
          const photo = codeToDataUrl.get(p.code);
          if (photo) {
            matchedCount++;
            return { ...p, image: photo };
          }
          return p;
        })
      );
      alert(`${matchedCount} foto(s) vinculada(s) aos produtos pelo código!`);
    } else {
      alert("Nenhuma imagem com código numérico correspondente encontrada.");
    }

    if (e.target) e.target.value = "";
  };

  // Adicionar produto manualmente
  const handleAddManualProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.description.trim()) return;

    const code = newProd.code.trim() || String(products.length + 10001);
    const created: ColecaoProduct = {
      id: `col-prod-${code}-${Date.now()}`,
      code,
      description: newProd.description.trim().toUpperCase(),
      image: newProd.image.trim(),
      isPrincipal: newProd.isPrincipal,
      included: true,
    };

    setProducts((prev) => [created, ...prev]);
    setNewProd({ code: "", description: "", image: "", isPrincipal: false });
    setNewProductModalOpen(false);

    if (created.isPrincipal) {
      setVariantsModalProduct(created);
      setVariantsModalOpen(true);
    }
  };

  // Excluir produto
  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Atualizar descrição (revisão antes de gerar)
  const handleUpdateDescription = (id: string, newDesc: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description: newDesc } : p))
    );
  };

  // Exportar Página Atual
  const handleExportCurrentPage = async () => {
    const pageEl = document.getElementById(`colecao-page-render-${currentPage - 1}`);
    if (!pageEl) {
      alert("Elemento da página não encontrado para exportação.");
      return;
    }

    setIsExporting(true);
    try {
      await exportColecaoPageAsPng(pageEl, config.name, currentPage);
    } catch (err: any) {
      alert("Erro ao exportar imagem: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar Todas as Páginas em ZIP
  const handleExportAllZip = async () => {
    setIsExporting(true);
    try {
      const items: { element: HTMLElement; pageNumber: number }[] = [];
      for (let i = 0; i < totalPages; i++) {
        const el = document.getElementById(`colecao-page-render-${i}`);
        if (el) items.push({ element: el, pageNumber: i + 1 });
      }

      if (items.length === 0) {
        alert("Nenhuma página disponível para exportar.");
        return;
      }

      await exportColecaoAllPagesZip(items, config.name);
    } catch (err: any) {
      alert("Erro ao gerar arquivo ZIP: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Carregar produtos de exemplo para testar
  const handleLoadSample = () => {
    const samples: ColecaoProduct[] = [
      {
        id: "c-1",
        code: "101",
        description: "Biscoito Oreo 80g Chocolate",
        genericDescription: "Biscoito Oreo 80g",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: true,
        variantIds: ["c-2", "c-3"],
        included: true,
        variants: [
          {
            id: "c-2",
            code: "102",
            description: "Biscoito Oreo 80g Baunilha",
            image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
            isPrincipal: false,
            included: false, // Variação vinculada ao principal
          },
        ],
      },
      {
        id: "c-4",
        code: "104",
        description: "Salgadinho Yokitos Conchinha 153g",
        genericDescription: "Salgadinho Yokitos 153g",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: true,
        variantIds: [],
        variants: [], // Principal sem variação
        included: true,
      },
      {
        id: "c-5",
        code: "21620",
        description: "CHOCOLATE GRANULADO DORI SM 30X120 GR",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false, // Não principal
        included: true,
      },
      {
        id: "c-6",
        code: "11793",
        description: "MOLHO POMAROLA AZEITONA SACHE 24X300 GR",
        image: "https://cescom.agilecdn.com.br/banners/agrupar-1-1735835147.png",
        isPrincipal: false, // Não principal
        included: true,
      },
    ];

    setProducts(samples);
  };

  return (
    <div className="space-y-4">
      {/* 1. BARRA SUPERIOR DE COLEÇÕES */}
      <div className="rounded-xl border border-neutral-800 bg-[#141414] p-4 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-white font-black text-xl shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="bg-transparent font-bold text-lg text-white border-b border-dashed border-neutral-600 focus:border-[#FFD400] outline-hidden px-1"
                  title="Clique para renomear a coleção"
                />
                <span className="rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/40">
                  ESQUENTA BLACK 1080×1920
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                20 produtos por página (4 colunas × 5 linhas) · Sem preço/validade/estoque
              </p>
            </div>
          </div>

          {/* Estatísticas e Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs bg-black/40 border border-neutral-800 px-3 py-1.5 rounded-lg mr-2">
              <span className="text-neutral-400">
                Produtos: <strong className="text-white">{products.length}</strong>
              </span>
              <span className="text-neutral-400">
                Principais:{" "}
                <strong className="text-amber-400">
                  {products.filter((p) => p.isPrincipal).length}
                </strong>
              </span>
              <span className="text-neutral-400">
                Páginas: <strong className="text-emerald-400">{totalPages}</strong>
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportSpreadsheetOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 text-green-500" />
              Importar Planilha
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => photoFolderInputRef.current?.click()}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
              title="Carrega fotos de pasta local vinculando automaticamente pelo código"
            >
              <FolderOpen className="h-4 w-4 mr-1.5 text-blue-400" />
              Vincular Fotos
            </Button>
            <input
              ref={photoFolderInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handlePhotoFolderUpload}
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewProductModalOpen(true)}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:text-white text-xs h-9"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Produto
            </Button>

            {products.length === 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLoadSample}
                className="text-xs text-neutral-400 hover:text-white h-9"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-400" />
                Exemplo
              </Button>
            )}
          </div>
        </div>

        {/* Abas: Lista de Produtos vs Visualização */}
        <div className="flex items-center justify-between border-t border-neutral-800 mt-3 pt-3">
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab("tabela")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "tabela"
                  ? "bg-neutral-800 text-[#FFD400] shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Lista de Produtos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-neutral-800 text-[#FFD400] shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar Encarte ({totalPages} {totalPages === 1 ? "Pág" : "Págs"})
            </button>
          </div>

          {/* Botões de Exportação */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleExportCurrentPage}
              disabled={isExporting || products.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 shadow-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar PNG (Pág {currentPage})
            </Button>

            {totalPages > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportAllZip}
                disabled={isExporting}
                className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 font-bold text-xs h-9 shadow-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-[#FFD400]" />
                Exportar Todas (ZIP)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CONTEÚDO DA ABA: LISTA DE PRODUTOS */}
      {activeTab === "tabela" && (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <div className="p-3 border-b bg-neutral-50 flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-800">
              Produtos da Coleção ({products.length})
            </span>
            <span className="text-neutral-500 text-[11px]">
              Clique no botão <strong>★ Principal</strong> para agrupar variações semelhantes (mesmo nome-base sem sabor/recheio).
            </span>
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Layers className="h-10 w-10 mx-auto text-neutral-300" />
              <p className="text-sm font-semibold text-neutral-700">Nenhum produto cadastrado na coleção.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => setImportSpreadsheetOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  Importar Planilha
                </Button>
                <Button size="sm" variant="outline" onClick={handleLoadSample}>
                  <Sparkles className="h-4 w-4 mr-1.5 text-purple-600" />
                  Carregar Exemplo
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 text-neutral-700 font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Foto</th>
                    <th className="py-2.5 px-3 w-28">Código</th>
                    <th className="py-2.5 px-3">Descrição do Produto (Revisável)</th>
                    <th className="py-2.5 px-3 w-40 text-center">Tipo / Principal</th>
                    <th className="py-2.5 px-3 w-48">Variações Vinculadas</th>
                    <th className="py-2.5 px-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {products.map((p) => {
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-neutral-50 transition-colors ${
                          p.isPrincipal ? "bg-amber-50/40" : ""
                        }`}
                      >
                        {/* Foto */}
                        <td className="py-2 px-3">
                          <div className="h-11 w-11 rounded-md border bg-white p-0.5 flex items-center justify-center overflow-hidden">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.description}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-neutral-300" />
                            )}
                          </div>
                        </td>

                        {/* Código */}
                        <td className="py-2 px-3 font-mono font-bold text-neutral-800">
                          {p.code}
                        </td>

                        {/* Descrição */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={p.description}
                            onChange={(e) => handleUpdateDescription(p.id, e.target.value)}
                            className="w-full rounded border border-transparent hover:border-neutral-300 focus:border-neutral-500 bg-transparent px-2 py-1 font-semibold text-neutral-900 outline-hidden"
                          />
                          {p.isPrincipal && p.genericDescription && (
                            <p className="text-[10px] text-amber-700 px-2 font-medium">
                              Nome genérico no card: <strong>{p.genericDescription}</strong>
                            </p>
                          )}
                        </td>

                        {/* Botão "Principal" */}
                        <td className="py-2 px-3 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant={p.isPrincipal ? "default" : "outline"}
                            onClick={() => handleTogglePrincipal(p)}
                            className={`h-7 text-xs font-bold ${
                              p.isPrincipal
                                ? "bg-amber-500 hover:bg-amber-600 text-neutral-950 border-amber-600"
                                : "text-neutral-600 hover:text-amber-700 hover:border-amber-400"
                            }`}
                          >
                            <Star
                              className={`h-3.5 w-3.5 mr-1 ${
                                p.isPrincipal ? "fill-neutral-950" : ""
                              }`}
                            />
                            {p.isPrincipal ? "Principal" : "Tornar Principal"}
                          </Button>
                        </td>

                        {/* Variações */}
                        <td className="py-2 px-3">
                          {p.isPrincipal ? (
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-neutral-700">
                                {(p.variants || []).length} variação(ões)
                              </span>
                              {(p.variants || []).length > 0 && (
                                <p className="text-[10px] text-neutral-500 line-clamp-1">
                                  {p.variants?.map((v) => v.description).join(", ")}
                                </p>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] text-amber-700 p-0 font-bold"
                                onClick={() => {
                                  setVariantsModalProduct(p);
                                  setVariantsModalOpen(true);
                                }}
                              >
                                Editar Variações
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">
                              Produto individual (com código)
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-2 px-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. CONTEÚDO DA ABA: VISUALIZAR ENCARTE 1080x1920 */}
      {activeTab === "preview" && (
        <div className="rounded-xl border border-neutral-800 bg-[#1A1A1A] p-4 text-white space-y-4 shadow-md">
          {/* Barra de Controles de Visualização */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg text-xs">
            {/* Navegação entre páginas */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 bg-neutral-800 border-neutral-700 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-white px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 bg-neutral-800 border-neutral-700 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Controles de Zoom */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.05))}
                className="h-8 text-neutral-300 hover:text-white"
                title="Reduzir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="font-mono text-neutral-400 w-12 text-center">
                {Math.round(previewZoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewZoom((z) => Math.min(1.0, z + 0.05))}
                className="h-8 text-neutral-300 hover:text-white"
                title="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewZoom(0.38)}
                className="h-8 bg-neutral-800 border-neutral-700 text-xs text-neutral-300 hover:text-white"
              >
                Ajustar à Tela
              </Button>
            </div>
          </div>

          {/* Área Central de Renderização da Página Atual */}
          <div className="flex justify-center overflow-auto p-4 bg-neutral-950/60 rounded-xl border border-neutral-800 min-h-[600px]">
            <div
              style={{
                transform: `scale(${previewZoom})`,
                transformOrigin: "top center",
                marginBottom: `${1920 * (previewZoom - 1)}px`,
              }}
              className="shadow-2xl rounded-lg overflow-hidden border border-neutral-800"
            >
              <ColecoesPage
                products={pages[currentPage - 1] || []}
                pageIndex={currentPage - 1}
                totalPages={totalPages}
                config={config}
              />
            </div>
          </div>

          {/* Elementos ocultos para captura em alta resolução 1:1 de todas as páginas */}
          <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
            {pages.map((pgProducts, idx) => (
              <div key={idx} id={`colecao-page-render-${idx}`}>
                <ColecoesPage
                  products={pgProducts}
                  pageIndex={idx}
                  totalPages={totalPages}
                  config={config}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Configurar Variações do Produto Principal */}
      <PrincipalVariantsModal
        open={variantsModalOpen}
        onOpenChange={setVariantsModalOpen}
        product={variantsModalProduct}
        allProducts={products}
        onConfirm={handleConfirmVariants}
      />

      {/* MODAL: Importar Planilha de Coleções */}
      <Dialog open={importSpreadsheetOpen} onOpenChange={setImportSpreadsheetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-neutral-900">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Importar Planilha de Coleções
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600">
              Selecione uma planilha Excel (.xlsx) ou CSV com as colunas de <strong>Código</strong>, <strong>Descrição</strong>, foto opcional e flag <strong>Principal</strong> opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div
              className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-green-500 bg-neutral-50 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
              <p className="font-semibold text-neutral-800">Clique para selecionar a planilha</p>
              <p className="text-[11px] text-neutral-500 mt-1">Formatos suportados: .xlsx, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleSpreadsheetFile}
              />
            </div>

            <div className="rounded bg-neutral-100 p-2.5 text-[11px] text-neutral-600 space-y-1">
              <p className="font-bold text-neutral-800">Colunas reconhecidas:</p>
              <p>• <strong>Código</strong>: CODPROD, COD, CODIGO, SKU</p>
              <p>• <strong>Descrição</strong>: DESCRICAO, PRODUTO, NOME</p>
              <p>• <strong>Principal</strong> (opcional): PRINCIPAL, DESTAQUE, SIM/NÃO</p>
              <p className="text-amber-700 font-semibold pt-1">
                Nota: Preço, validade e estoque não são exibidos nesta arte.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportSpreadsheetOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Novo Produto Manual */}
      <Dialog open={newProductModalOpen} onOpenChange={setNewProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-neutral-900">
              Cadastrar Produto na Coleção
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600">
              Preencha código e descrição do produto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddManualProduct} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label htmlFor="colProdCode" className="text-xs font-semibold">
                  Código
                </Label>
                <Input
                  id="colProdCode"
                  placeholder="Ex: 24657"
                  value={newProd.code}
                  onChange={(e) => setNewProd({ ...newProd, code: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="colProdDesc" className="text-xs font-semibold">
                  Descrição do Produto
                </Label>
                <Input
                  id="colProdDesc"
                  placeholder="Ex: BISCOITO OREO 80G CHOCOLATE"
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="colProdImg" className="text-xs font-semibold">
                URL da Foto (Opcional)
              </Label>
              <Input
                id="colProdImg"
                placeholder="https://..."
                value={newProd.image}
                onChange={(e) => setNewProd({ ...newProd, image: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="colProdPrincipal"
                checked={newProd.isPrincipal}
                onChange={(e) => setNewProd({ ...newProd, isPrincipal: e.target.checked })}
                className="rounded border-neutral-300"
              />
              <Label htmlFor="colProdPrincipal" className="text-xs font-semibold cursor-pointer">
                Definir como Produto Principal (agrupa variações de sabor/recheio)
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNewProductModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
