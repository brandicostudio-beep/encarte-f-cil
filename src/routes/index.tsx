import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getClientSession, clearClientSession } from "@/lib/auth-constants";
import { useEffect, useState, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractCategoryProducts, extractProduct } from "@/lib/product.functions";
import type {
  EncarteProduct,
  StoreConfig,
  CampaignConfig,
  BadgeType,
  ProductsPerPageOption,
  EncarteFormat,
  TemplateProductArea,
} from "@/types/encarte";
import {
  DEFAULT_STORE,
  DEFAULT_CAMPAIGN,
  DEFAULT_TEMPLATE_9_16_AREA,
  BADGE_LABELS,
} from "@/types/encarte";
import {
  isDateExpired,
  getSampleProducts,
  getValidityTimestamp,
  sortProductsByValidityAsc,
} from "@/lib/encarte-helpers";
import { formatPrice, deriveSaleUnit, evaluateStockExpression } from "@/lib/parse-product";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { autoTrimImageWhitespace } from "@/lib/image-normalizer";

// Componentes da Interface de Alta Experiência (UX/UI)
import { EditorStepper, type EditorStep } from "@/components/encarte/EditorStepper";
import { PendingSidebar, type IssueFilter } from "@/components/encarte/PendingSidebar";
import { ReviewTable } from "@/components/encarte/ReviewTable";
import { SourceSelector } from "@/components/encarte/SourceSelector";
import { EmptyState } from "@/components/encarte/EmptyState";
import { A4Page } from "@/components/encarte/A4Page";
import { StoryPage916 } from "@/components/encarte/StoryPage916";
import { TemplateAreaAdjuster } from "@/components/encarte/TemplateAreaAdjuster";
import { SpreadsheetModal } from "@/components/encarte/SpreadsheetModal";
import { ProductEditModal } from "@/components/encarte/ProductEditModal";
import { StoreSettingsModal } from "@/components/encarte/StoreSettingsModal";
import { FinalEditor } from "@/components/encarte/FinalEditor";
import { ProjectTopBar } from "@/components/encarte/projects/ProjectTopBar";
import { ProjectManagerModal } from "@/components/encarte/projects/ProjectManagerModal";
import { VersionHistoryModal } from "@/components/encarte/projects/VersionHistoryModal";
import { ProjectUpdateCheckModal } from "@/components/encarte/projects/ProjectUpdateCheckModal";
import type { ProjectData, ProjectSyncStatus } from "@/types/project";
import {
  saveProjectUnified,
  saveProjectAsUnified,
  renameProjectUnified,
} from "@/lib/project-sync-manager";
import { loadProjectLocal } from "@/lib/project-indexeddb";
import { checkDriveStatusFn } from "@/lib/project.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Smartphone,
  Archive,
  Upload,
  Scale,
  Trash2,
  AlertCircle,
  LogOut,
  Link2,
  Loader2,
  Globe,
  Copy,
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

type SortOption = "validity-asc" | "validity-desc" | "code-asc" | "code-desc" | "name-asc" | "name-desc";

function EncarteApp() {
  const navigate = useNavigate();
  const extractCategory = useServerFn(extractCategoryProducts);

  // Verificação de Acesso Restrito Interno
  const [isAuthVerified, setIsAuthVerified] = useState<boolean>(false);

  useEffect(() => {
    const session = getClientSession();
    if (!session) {
      setIsAuthVerified(false);
      navigate({
        to: "/acesso",
        search: { redirect: window.location.pathname + window.location.search },
      });
      return;
    }
    setIsAuthVerified(true);

    // Verificação periódica de expiração de sessão (ex: 12 horas)
    const checkTimer = setInterval(() => {
      const active = getClientSession();
      if (!active) {
        setIsAuthVerified(false);
        navigate({
          to: "/acesso",
          search: { redirect: window.location.pathname + window.location.search },
        });
      }
    }, 15 * 1000);

    return () => clearInterval(checkTimer);
  }, [navigate]);

  const handleLogout = () => {
    // Encerra a sessão sem apagar os produtos e configurações salvas do encarte
    clearClientSession();
    navigate({ to: "/acesso" });
  };

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
  const [sortBy, setSortBy] = useState<SortOption>("validity-asc");

  // Modais
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);
  const [storeSettingsOpen, setStoreSettingsOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<EncarteProduct | null>(null);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const [expiredWarningOpen, setExpiredWarningOpen] = useState(false);
  const [unpricedModalOpen, setUnpricedModalOpen] = useState(false);
  const [missingPhotoModalOpen, setMissingPhotoModalOpen] = useState(false);
  const [preExportModalOpen, setPreExportModalOpen] = useState(false);
  const [preExportIssues, setPreExportIssues] = useState<
    {
      type: "missing_photo" | "unpriced" | "font_too_small" | "text_overflow";
      title: string;
      description: string;
    }[]
  >([]);
  const [pendingExportAction, setPendingExportAction] = useState<
    (() => void) | null
  >(null);

  // Estado e Gerenciamento de Projetos (IndexedDB + Google Drive)
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(() => {
    const now = new Date().toISOString();
    return {
      id: `proj-initial-${Date.now()}`,
      name: "Encarte Ofertas da Semana",
      createdAt: now,
      updatedAt: now,
      version: 1,
      source: { type: "manual" },
      products: [],
      campaign: DEFAULT_CAMPAIGN,
      store: DEFAULT_STORE,
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          itemCount: 0,
          notes: "Projeto inicial",
        },
      ],
    };
  });
  const [projectSaveStatus, setProjectSaveStatus] = useState<ProjectSyncStatus>("synced");
  const [projectStatusNotice, setProjectStatusNotice] = useState<string>("Sincronizado");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  // Modais de Projeto (Canva-style)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [historyTargetProjectId, setHistoryTargetProjectId] = useState<string | null>(null);
  const [updateCheckOpen, setUpdateCheckOpen] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const [missingPhotosNotice, setMissingPhotosNotice] = useState<string | null>(null);

  const isDirtyRef = useRef(false);
  const lastAutoSaveRef = useRef<number>(Date.now());

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
    productUrl: "",
  });
  const [productUrlInput, setProductUrlInput] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchUrlError, setFetchUrlError] = useState<string | null>(null);
  const [fetchUrlSuccess, setFetchUrlSuccess] = useState<string | null>(null);

  // Carregar dados salvos no localStorage com sanitização defensiva e retrocompatibilidade
  useEffect(() => {
    try {
      const savedStore =
        localStorage.getItem("encarte-store-v2") ||
        localStorage.getItem("encarte-store");
      if (savedStore) {
        const parsed = JSON.parse(savedStore);
        if (parsed && typeof parsed === "object") {
          setStore((prev) => ({
            ...DEFAULT_STORE,
            ...prev,
            ...parsed,
            name:
              parsed.name === "SUPERMERCADO BOM PREÇO"
                ? ""
                : parsed.name || parsed.nome || "",
            logo: parsed.logo || parsed.logotipo || "",
            address:
              parsed.address === "Av. Principal, 1200 - Centro"
                ? ""
                : parsed.address || parsed.endereco || "",
            phone:
              parsed.phone === "(11) 99999-8888"
                ? ""
                : parsed.phone || parsed.telefone || "",
            legalNotice:
              parsed.legalNotice?.includes("Ofertas válidas enquanto durarem os estoques")
                ? ""
                : parsed.legalNotice || parsed.notaLegal || "",
            primaryColor:
              parsed.primaryColor || parsed.corPrimaria || DEFAULT_STORE.primaryColor,
            accentColor:
              parsed.accentColor || parsed.corSecundaria || DEFAULT_STORE.accentColor,
            darkColor: parsed.darkColor || DEFAULT_STORE.darkColor,
          }));
        }
      }

      const savedCampaign =
        localStorage.getItem("encarte-campaign-v2") ||
        localStorage.getItem("encarte-campaign");
      if (savedCampaign) {
        const parsed = JSON.parse(savedCampaign);
        if (parsed && typeof parsed === "object") {
          setCampaign({
            ...DEFAULT_CAMPAIGN,
            ...parsed,
            title: parsed.title || parsed.titulo || DEFAULT_CAMPAIGN.title,
            subtitle:
              parsed.subtitle || parsed.subtitulo || DEFAULT_CAMPAIGN.subtitle,
            observation:
              parsed.observation || parsed.observacao || DEFAULT_CAMPAIGN.observation,
            format: parsed.format === "a4" ? "a4" : "story_9_16",
            productsPerPage: [6, 8, 9, 10, 12].includes(Number(parsed.productsPerPage))
              ? (Number(parsed.productsPerPage) as ProductsPerPageOption)
              : DEFAULT_CAMPAIGN.productsPerPage,
            template916Image:
              parsed.template916Image || DEFAULT_CAMPAIGN.template916Image,
            template916Area: {
              ...DEFAULT_TEMPLATE_9_16_AREA,
              ...(parsed.template916Area || {}),
            },
            exportResolution916:
              parsed.exportResolution916 === "2160x3840"
                ? "2160x3840"
                : "1080x1920",
          });
        }
      }

      const savedProds =
        localStorage.getItem("encarte-products-v2") ||
        localStorage.getItem("encarte-products");
      if (savedProds) {
        const parsed = JSON.parse(savedProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized: EncarteProduct[] = parsed.map((p, idx) => ({
            id: p?.id || `p-${Date.now()}-${idx}`,
            code: String(p?.code ?? p?.codigo ?? idx + 1),
            name: String(p?.name ?? p?.nome ?? p?.descricao ?? "PRODUTO SEM NOME"),
            packaging: String(p?.packaging ?? p?.embalagem ?? ""),
            packagingType: p?.packagingType || "",
            packagingQuantity: p?.packagingQuantity || "",
            packagingUnit: p?.packagingUnit || "",
            packagingWeight: p?.packagingWeight || "",
            validity: String(p?.validity ?? p?.validade ?? ""),
            price:
              p?.price !== undefined && p?.price !== null
                ? String(p.price)
                : p?.preco !== undefined && p?.preco !== null
                ? String(p.preco)
                : "",
            unit: deriveSaleUnit(
              String(p?.packaging ?? p?.embalagem ?? ""),
              p?.unit || p?.unidade,
              String(p?.name ?? p?.nome ?? p?.descricao ?? ""),
              p?.unitConfirmed
            ).unit,
            unitConfirmed: Boolean(p?.unitConfirmed),
            stock: String(p?.stock ?? p?.estoque ?? ""),
            badge: p?.badge || p?.selo || "nenhum",
            image: String(p?.image ?? p?.foto ?? p?.imageUrl ?? ""),
            included: p?.included !== undefined ? Boolean(p.included) : true,
            productUrl: p?.productUrl || "",
          }));

          setProducts(sanitized);

          // Restaura a etapa apenas em caso de recarregamento (F5) na mesma aba via sessionStorage.
          // Ao abrir o link em uma nova janela ou aba, inicia sempre na etapa "origem", sem forçar ida para preços.
          let stepToSet: EditorStep = "origem";
          try {
            const sessionStep = sessionStorage.getItem("encarte-active-step") as EditorStep | null;
            if (sessionStep && ["origem", "dados", "precos", "campanha", "edicao_final", "exportar"].includes(sessionStep)) {
              stepToSet = sessionStep;
            }
          } catch {}

          setCurrentStep(stepToSet);
          setCompletedSteps(new Set(["origem", "dados"]));
        }
      }
    } catch (err) {
      console.error("Aviso ao carregar localStorage:", err);
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

  // Atualizar estado com histórico de Desfazer e Auto-Save resiliente
  const updateProductsState = (
    updated: EncarteProduct[],
    saveToUndo: boolean = true
  ) => {
    if (saveToUndo && products.length > 0) {
      setUndoStack((prev) => [...prev.slice(-10), products]);
    }
    setProducts(updated);

    // Salvar no localStorage de forma resiliente contra QuotaExceededError
    try {
      localStorage.setItem("encarte-products-v2", JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn(
        "Aviso: Quota do localStorage excedida ao salvar fotos completas. Salvando versão compacta...",
        quotaErr
      );
      try {
        // Remove data URLs pesadas (>50KB) do localStorage de contingência para garantir que todos os dados,
        // códigos, descrições, preços e configurações continuem salvos sem travar a interface.
        const safeForStorage = updated.map((p) => {
          const isHeavyDataUrl = p.image && p.image.startsWith("data:") && p.image.length > 50000;
          return {
            ...p,
            image: isHeavyDataUrl ? "" : p.image,
            alternativePhotos: (p.alternativePhotos || []).map((alt) => ({
              ...alt,
              dataUrl: "",
            })),
          };
        });
        localStorage.setItem("encarte-products-v2", JSON.stringify(safeForStorage));
      } catch (innerErr) {
        console.warn("Aviso: Falha ao gravar no localStorage:", innerErr);
      }
    }

    // Feedback discreto de salvamento
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    setSavedNotice(`Salvo às ${timeStr}`);
    isDirtyRef.current = true;
    setProjectSaveStatus("unsaved");
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    if (previous) {
      updateProductsState(previous, false);
      setSavedNotice("Alteração desfeita");
    }
  };

  // Salvar configurações
  const saveStoreConfig = (updated: StoreConfig) => {
    setStore(updated);
    localStorage.setItem("encarte-store-v2", JSON.stringify(updated));
    setSavedNotice("Configurações da loja salvas");
    isDirtyRef.current = true;
    setProjectSaveStatus("unsaved");
  };

  const saveCampaignConfig = (updated: CampaignConfig) => {
    setCampaign(updated);
    localStorage.setItem("encarte-campaign-v2", JSON.stringify(updated));
    setSavedNotice("Campanha salva");
    isDirtyRef.current = true;
    setProjectSaveStatus("unsaved");
  };

  // Checagem de status da conexão do Google Drive
  useEffect(() => {
    checkDriveStatusFn()
      .then((res) => {
        setDriveConnected(Boolean(res.connected));
      })
      .catch(() => {
        setDriveConnected(false);
      });
  }, []);

  // Salvar Projeto Unificado (Local + Drive)
  const handleSaveProject = async (isNewVersion = false) => {
    if (!currentProject) return;
    setIsSavingProject(true);
    try {
      const projectToSave: ProjectData = {
        ...currentProject,
        products,
        campaign,
        store,
      };
      const res = await saveProjectUnified(projectToSave, isNewVersion, {
        onStatusChange: (status, notice) => {
          setProjectSaveStatus(status);
          if (notice) setProjectStatusNotice(notice);
        },
        onProjectSaved: (savedProj, notice) => {
          setCurrentProject(savedProj);
          setSavedNotice(notice);
        },
      });
      if (res.ok) {
        isDirtyRef.current = false;
        lastAutoSaveRef.current = Date.now();
      }
    } catch (err) {
      console.warn("Erro ao salvar projeto:", err);
      setProjectSaveStatus("sync_error");
      setProjectStatusNotice("Falha ao salvar");
    } finally {
      setIsSavingProject(false);
    }
  };

  // Salvamento Automático com intervalo mínimo de 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (isDirtyRef.current && now - lastAutoSaveRef.current >= 30000 && !isSavingProject) {
        handleSaveProject(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentProject, products, campaign, store, isSavingProject]);

  // Atalho de Teclado Ctrl+S / Cmd+S para salvar imediatamente
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveProject(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [currentProject, products, campaign, store]);

  // Abrir Projeto Selecionado no Gerenciador
  const handleOpenProject = async (projectId: string) => {
    const res = await loadProjectLocal(projectId);
    if (res.ok && res.project) {
      const proj = res.project;
      setCurrentProject(proj);
      setProducts(proj.products || []);
      if (proj.campaign) setCampaign(proj.campaign);
      if (proj.store) setStore(proj.store);

      try {
        localStorage.setItem("encarte-active-project-id", proj.id);
        localStorage.setItem("encarte-products-v2", JSON.stringify(proj.products || []));
        if (proj.store) localStorage.setItem("encarte-store-v2", JSON.stringify(proj.store));
        if (proj.campaign) localStorage.setItem("encarte-campaign-v2", JSON.stringify(proj.campaign));
      } catch {}

      // Diagnóstico de fotos faltantes sem quebrar a tela
      const missing = (proj.products || []).filter((p) => !p.image || String(p.image).trim() === "");
      if (missing.length > 0) {
        setMissingPhotosNotice(`${missing.length} produto(s) deste encarte estão sem foto vinculada.`);
      } else {
        setMissingPhotosNotice(null);
      }

      setCompletedSteps(new Set(["origem", "dados", "precos"]));
      navigateToStep("precos");
      setProjectSaveStatus("synced");
      setProjectStatusNotice(`Projeto "${proj.name}" carregado`);
      isDirtyRef.current = false;
      setProjectManagerOpen(false);
    } else {
      alert(res.error || "Não foi possível abrir o projeto.");
    }
  };

  // Criar Novo Projeto Limpo
  const handleNewProject = () => {
    if (
      isDirtyRef.current &&
      !confirm("Existem alterações não salvas no projeto atual. Deseja criar um novo projeto mesmo assim?")
    ) {
      return;
    }
    const newProjId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const freshProject: ProjectData = {
      id: newProjId,
      name: "Novo Encarte",
      createdAt: now,
      updatedAt: now,
      version: 1,
      source: { type: "manual" },
      products: [],
      campaign: DEFAULT_CAMPAIGN,
      store: store || DEFAULT_STORE,
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          itemCount: 0,
          notes: "Projeto criado em branco",
        },
      ],
    };
    setCurrentProject(freshProject);
    setProducts([]);
    setUndoStack([]);
    setUnmatchedPhotos([]);
    setCampaign(DEFAULT_CAMPAIGN);
    try {
      localStorage.setItem("encarte-active-project-id", newProjId);
      localStorage.removeItem("encarte-products-v2");
    } catch {}
    navigateToStep("origem");
    setProjectSaveStatus("synced");
    setProjectStatusNotice("Novo projeto pronto");
    isDirtyRef.current = false;
    setProjectManagerOpen(false);
  };

  // Salvar Como Novo Projeto
  const handleExecuteSaveAs = async () => {
    if (!currentProject) return;
    const nameToUse = saveAsName.trim();
    if (!nameToUse) {
      setSaveAsError("Digite um nome para o novo projeto.");
      return;
    }

    setIsSavingProject(true);
    const res = await saveProjectAsUnified(
      {
        ...currentProject,
        products,
        campaign,
        store,
      },
      nameToUse,
      {
        onStatusChange: (status, notice) => {
          setProjectSaveStatus(status);
          if (notice) setProjectStatusNotice(notice);
        },
        onProjectSaved: (saved) => {
          setCurrentProject(saved);
          try {
            localStorage.setItem("encarte-active-project-id", saved.id);
          } catch {}
        },
      }
    );
    setIsSavingProject(false);

    if (res.ok && res.newProject) {
      setCurrentProject(res.newProject);
      setSaveAsModalOpen(false);
      setSaveAsName("");
      setSaveAsError(null);
      isDirtyRef.current = false;
    } else {
      setSaveAsError(res.error || "Erro ao salvar novo projeto.");
    }
  };

  // Renomear Projeto
  const handleRenameProject = async (newName: string) => {
    if (!currentProject) return;
    const res = await renameProjectUnified(currentProject.id, newName);
    if (res.ok) {
      setCurrentProject((prev) => (prev ? { ...prev, name: newName } : null));
      setProjectStatusNotice(`Renomeado para "${newName}"`);
    } else {
      alert(res.error || "Erro ao renomear projeto.");
    }
  };

  const [isBalancingImages, setIsBalancingImages] = useState(false);

  // Normalização e recorte de bordas brancas para manter todos os produtos na mesma proporção
  const handleAutoBalanceImages = async () => {
    setIsBalancingImages(true);
    try {
      const updated = await Promise.all(
        products.map(async (prod) => {
          if (!prod.image || prod.image.trim() === "") return prod;
          try {
            const res = await autoTrimImageWhitespace(prod.image);
            if (res.wasTrimmed) {
              return {
                ...prod,
                image: res.trimmedSrc,
                imageScale: 1.0,
              };
            }
          } catch {
            // fallback silencioso
          }
          return prod;
        })
      );
      updateProductsState(updated);
      setSavedNotice("Proporções de todas as fotos equilibradas e bordas recortadas!");
    } finally {
      setIsBalancingImages(false);
    }
  };

  // Carregar produtos de qualquer origem (Planilha ou Link)
  const handleDataLoaded = (
    loaded: EncarteProduct[],
    sourceType: "spreadsheet" | "link" | "sample",
    unmatched: string[]
  ) => {
    // 1. Atualizar navegação e etapas concluídas imediatamente
    setUnmatchedPhotos(unmatched);
    setCompletedSteps((prev) => new Set([...prev, "origem", "dados"]));
    navigateToStep("precos");

    // 2. Persistir lista de produtos no estado de forma resiliente (ordenados por validade)
    const sorted = sortProductsByValidityAsc(loaded);
    try {
      updateProductsState(sorted);
    } catch (err) {
      console.warn("Aviso ao atualizar produtos:", err);
      setProducts(sorted);
    }
  };

  // Atualizar fotos dos produtos da campanha via Pasta do Computador ou Banco de Fotos
  const handleUpdateProductsPhotos = (
    updated: EncarteProduct[],
    unmatched: string[]
  ) => {
    setUnmatchedPhotos(unmatched);
    updateProductsState(updated);
    setSavedNotice("Fotos da pasta do computador atualizadas com sucesso!");
  };

  // Navegação segura entre etapas persistindo na sessão ativa
  const navigateToStep = (step: EditorStep) => {
    setCurrentStep(step);
    try {
      sessionStorage.setItem("encarte-active-step", step);
    } catch {}
  };

  // Carregar dados de demonstração (16 produtos com codes, fotos e validade)
  const handleLoadSample = () => {
    const samples = getSampleProducts();
    updateProductsState(samples);
    setUnmatchedPhotos([]);
    setCompletedSteps((prev) => new Set([...prev, "origem", "dados"]));
    navigateToStep("precos");
  };

  // Abrir modal de confirmação para zerar dados e iniciar novo encarte
  const handleResetEncarte = () => {
    setResetModalOpen(true);
  };

  // Executa o reset completo: limpa localStorage, estado da memória e sessão
  const handleExecuteReset = () => {
    try {
      localStorage.removeItem("encarte-products-v2");
      localStorage.removeItem("encarte-products");
      localStorage.removeItem("encarte-campaign-v2");
      localStorage.removeItem("encarte-campaign");
      localStorage.removeItem("encarte-drive-cache");
      sessionStorage.removeItem("encarte-active-step");
    } catch (err) {
      console.warn("Aviso ao limpar dados do localStorage:", err);
    }

    setProducts([]);
    setUndoStack([]);
    setUnmatchedPhotos([]);
    setCurrentStep("origem");
    setCompletedSteps(new Set());
    setCampaign(DEFAULT_CAMPAIGN);
    setCurrentPage(1);
    setSearchQuery("");
    setActiveIssueFilter("all");
    setSavedNotice("Encarte zerado com sucesso. Pronto para iniciar.");
    setResetModalOpen(false);
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

  const handleUnitChange = (id: string, newUnit: string) => {
    const updated = products.map((p) =>
      p.id === id ? { ...p, unit: newUnit, unitConfirmed: true } : p
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

  const handleFetchProductFromUrl = async () => {
    const urlToFetch = productUrlInput.trim();
    if (!urlToFetch) {
      setFetchUrlError("Insira um link válido do produto.");
      return;
    }
    if (!/^https?:\/\//i.test(urlToFetch)) {
      setFetchUrlError("O link precisa começar com http:// ou https://");
      return;
    }

    setIsFetchingUrl(true);
    setFetchUrlError(null);
    setFetchUrlSuccess(null);

    try {
      const res = await extractProduct({ data: { url: urlToFetch } });
      if (!res.ok) {
        setFetchUrlError(res.error || "Não foi possível puxar os dados deste link.");
        return;
      }

      const { product, warning } = res;
      if (!product || (!product.name && !product.price && !product.image)) {
        setFetchUrlError("Não encontramos dados suficientes no link. Preencha manualmente.");
        return;
      }

      // Tentar extrair código da URL se o campo código estiver vazio
      let inferredCode = newProd.code.trim();
      if (!inferredCode) {
        const codeMatch =
          urlToFetch.match(/\b(?:p|produto|item|sku|cod|codigo|id)[/-_]?(\d+)\b/i) ||
          urlToFetch.match(/-(\d+)(?:\.html|\/|\?|$)/) ||
          urlToFetch.match(/\/(\d{3,8})(?:[/?#]|$)/);
        if (codeMatch && codeMatch[1]) {
          inferredCode = codeMatch[1];
        }
      }

      const name = product.name ? product.name.trim().toUpperCase() : newProd.name;
      const packaging = product.packaging || newProd.packaging || "1 UN";
      const derivedUnit = deriveSaleUnit(packaging, newProd.unit, name);
      const price = product.price ? formatPrice(product.price) : newProd.price;
      const image = product.image || newProd.image;

      setNewProd((prev) => ({
        ...prev,
        code: inferredCode || prev.code,
        name,
        packaging,
        unit: derivedUnit.unit,
        price,
        image,
        productUrl: urlToFetch,
      }));

      setFetchUrlSuccess("Dados e foto puxados com sucesso do link!");
      if (warning) {
        console.warn("Aviso ao puxar produto:", warning);
      }
    } catch (err) {
      console.error("Erro ao puxar produto do link:", err);
      setFetchUrlError("Erro de conexão ao acessar o link informado.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleAddManualProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;

    const derivedUnit = deriveSaleUnit(newProd.packaging, newProd.unit, newProd.name);
    const created: EncarteProduct = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: newProd.code.trim() || String(products.length + 10001),
      name: newProd.name.trim().toUpperCase(),
      packaging: newProd.packaging.trim().toUpperCase() || "1 UN",
      validity: newProd.validity.trim(),
      price: formatPrice(newProd.price),
      unit: derivedUnit.unit,
      unitConfirmed: true,
      stock: newProd.stock.trim() ? evaluateStockExpression(newProd.stock.trim(), derivedUnit.unit) : "",
      badge: newProd.badge,
      image: newProd.image.trim(),
      productUrl: newProd.productUrl || "",
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
      productUrl: "",
    });
    setProductUrlInput("");
    setFetchUrlError(null);
    setFetchUrlSuccess(null);
    setAddManualOpen(false);
  };

  // Estatísticas
  const totalProducts = (products || []).length;
  const pricedProducts = useMemo(
    () => (products || []).filter((p) => Boolean(p?.price && String(p.price).trim() !== "")),
    [products]
  );
  const unpricedCount = totalProducts - pricedProducts.length;

  // Produtos que realmente entrarão no encarte (com preço e incluídos)
  const flyerProducts = useMemo(() => {
    const eligible = products.filter(
      (p) => p && p.included && p.price && String(p.price).trim() !== ""
    );

    return eligible.sort((a, b) => {
      const codeA = String(a?.code ?? "");
      const codeB = String(b?.code ?? "");
      const nameA = String(a?.name ?? "");
      const nameB = String(b?.name ?? "");

      if (sortBy === "validity-asc") {
        const tA = getValidityTimestamp(a?.validity);
        const tB = getValidityTimestamp(b?.validity);
        if (tA !== tB) return tA - tB;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (sortBy === "validity-desc") {
        const tA = getValidityTimestamp(a?.validity);
        const tB = getValidityTimestamp(b?.validity);
        if (tA !== tB) return tB - tA;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (sortBy === "code-asc") return codeA.localeCompare(codeB, undefined, { numeric: true });
      if (sortBy === "code-desc") return codeB.localeCompare(codeA, undefined, { numeric: true });
      if (sortBy === "name-asc") return nameA.localeCompare(nameB);
      if (sortBy === "name-desc") return nameB.localeCompare(nameA);
      return 0;
    });
  }, [products, sortBy]);

  // Produtos vencidos no encarte
  const expiredInFlyer = useMemo(
    () => flyerProducts.filter((p) => isDateExpired(p?.validity || "")),
    [flyerProducts]
  );

  // Produtos incluídos sem preço cadastrado (bloqueiam a exportação)
  const unpricedIncluded = useMemo(
    () => (products || []).filter((p) => p && p.included && (!p.price || String(p.price).trim() === "")),
    [products]
  );

  // Produtos incluídos sem foto (bloqueiam a exportação se campaign.blockExportWithoutPhoto estiver ativo)
  const missingPhotoIncluded = useMemo(
    () => (products || []).filter((p) => p && p.included && (!p.image || String(p.image).trim() === "")),
    [products]
  );

  // Paginação: produtos por página (padrão 10 para Story 9:16, ajustável para 6, 8, 10, 12)
  const perPage = campaign?.productsPerPage || 10;
  const totalPages = Math.max(1, Math.ceil((flyerProducts || []).length / perPage));

  const pageProducts = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return (flyerProducts || []).slice(start, start + perPage);
  }, [flyerProducts, currentPage, perPage]);

  // Lista filtrada da tabela com base no painel de pendências e busca
  const filteredProducts = useMemo(() => {
    let result = products || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          String(p?.name ?? "").toLowerCase().includes(q) ||
          String(p?.code ?? "").toLowerCase().includes(q)
      );
    }

    if (activeIssueFilter === "unpriced") {
      result = result.filter((p) => !p?.price || String(p.price).trim() === "");
    } else if (activeIssueFilter === "missing_photo") {
      result = result.filter((p) => !p?.image || String(p.image).trim() === "");
    } else if (activeIssueFilter === "ambiguous_photo") {
      result = result.filter((p) => Boolean(p?.alternativePhotos && p.alternativePhotos.length > 0));
    } else if (activeIssueFilter === "missing_packaging") {
      result = result.filter((p) => !p?.packaging || String(p.packaging).trim() === "");
    } else if (activeIssueFilter === "missing_unit") {
      result = result.filter((p) => !p?.unitConfirmed && !deriveSaleUnit(p?.packaging, p?.unit, p?.name).hasUnitWord);
    } else if (activeIssueFilter === "expired") {
      result = result.filter((p) => isDateExpired(p?.validity || ""));
    } else if (activeIssueFilter === "excluded") {
      result = result.filter((p) => !p?.included);
    }

    return result.sort((a, b) => {
      const codeA = String(a?.code ?? "");
      const codeB = String(b?.code ?? "");
      const nameA = String(a?.name ?? "");
      const nameB = String(b?.name ?? "");

      if (sortBy === "validity-asc") {
        const tA = getValidityTimestamp(a?.validity);
        const tB = getValidityTimestamp(b?.validity);
        if (tA !== tB) return tA - tB;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (sortBy === "validity-desc") {
        const tA = getValidityTimestamp(a?.validity);
        const tB = getValidityTimestamp(b?.validity);
        if (tA !== tB) return tB - tA;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (sortBy === "code-asc") return codeA.localeCompare(codeB, undefined, { numeric: true });
      if (sortBy === "code-desc") return codeB.localeCompare(codeA, undefined, { numeric: true });
      if (sortBy === "name-asc") return nameA.localeCompare(nameB);
      if (sortBy === "name-desc") return nameB.localeCompare(nameA);
      return 0;
    });
  }, [products, searchQuery, activeIssueFilter, sortBy]);

  // Slug da campanha para nomenclatura de arquivos (ex: "encarte-validade-curta-01.png")
  const campaignSlug = useMemo(() => {
    return (
      String(campaign?.title || "encarte")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "detona-precos"
    );
  }, [campaign?.title]);

  // Upload de Template 9:16 direto na etapa de campanha
  const handleTemplate916UploadInPage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const w = img.width || 1080;
        const h = img.height || 1920;

        const scaleX = w / 1080;
        const scaleY = h / 1920;

        const newArea: TemplateProductArea = {
          x: Math.round(46 * scaleX),
          y: Math.round(661 * scaleY),
          width: Math.round(1012 * scaleX),
          height: Math.round(1202 * scaleY),
          canvasWidth: w,
          canvasHeight: h,
        };

        saveCampaignConfig({
          ...campaign,
          template916Image: dataUrl,
          template916Area: newArea,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Exportar PDF 300 DPI (Modo A4)
  const executeExportPdf = async () => {
    setExporting(true);
    try {
      const [{ jsPDF }, { toJpeg }] = await Promise.all([
        import("jspdf"),
        import("html-to-image"),
      ]);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        const pageEl =
          document.getElementById(`batch-a4-page-${pIdx}`) ||
          document.getElementById(`encarte-page-${pIdx}`);
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

      const filename = `encarte-${campaignSlug}.pdf`;
      pdf.save(filename);
      setCompletedSteps((prev) => new Set([...prev, "exportar"]));
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF. Você pode imprimir diretamente ou exportar PNG.");
    } finally {
      setExporting(false);
    }
  };

  // Validação obrigatória: bloqueia exportação se houver produto sem preço marcado no encarte
  const checkUnpricedBeforeExport = (): boolean => {
    if (unpricedIncluded.length > 0) {
      setUnpricedModalOpen(true);
      return false;
    }
    return true;
  };

  // Validação opcional: bloqueia exportação se houver produto sem foto e a opção estiver ativada
  const checkMissingPhotoBeforeExport = (): boolean => {
    if (campaign?.blockExportWithoutPhoto && missingPhotoIncluded.length > 0) {
      setMissingPhotoModalOpen(true);
      return false;
    }
    return true;
  };

  // Checagem Preventiva de Qualidade antes de Exportar:
  // Valida produtos sem foto, textos cortados, textos abaixo do tamanho mínimo e preços vazios.
  const runPreExportDiagnostics = () => {
    const issues: {
      type: "missing_photo" | "unpriced" | "font_too_small" | "text_overflow";
      title: string;
      description: string;
    }[] = [];

    // 1. Preços vazios
    flyerProducts.forEach((p) => {
      if (!p.price || String(p.price).trim() === "") {
        issues.push({
          type: "unpriced",
          title: "Preço não informado",
          description: `Produto "${p.name || p.code}" está sem preço preenchido.`,
        });
      }
    });

    // 2. Produtos sem foto
    flyerProducts.forEach((p) => {
      if (!p.image || String(p.image).trim() === "") {
        issues.push({
          type: "missing_photo",
          title: "Produto sem foto",
          description: `Produto "${p.name || p.code}" está sem foto (será gerado com "SEM FOTO").`,
        });
      }
    });

    // 3. Textos abaixo do tamanho mínimo
    flyerProducts.forEach((p) => {
      const nameSize = p.customStyle?.nameFontSize;
      if (typeof nameSize === "number" && nameSize < 24) {
        issues.push({
          type: "font_too_small",
          title: "Fonte do nome muito pequena",
          description: `Produto "${p.name}": tamanho ${nameSize}px abaixo do mínimo legível (24px).`,
        });
      }
      const headerSize = p.customStyle?.headerFontSize;
      if (typeof headerSize === "number" && headerSize < 20) {
        issues.push({
          type: "font_too_small",
          title: "Fonte do código muito pequena",
          description: `Produto "${p.name}": cabeçalho em ${headerSize}px abaixo do mínimo (20px).`,
        });
      }
    });

    // 4. Textos muito longos com risco de corte (overflow)
    flyerProducts.forEach((p) => {
      if (p.name && p.name.length > 55 && !p.customStyle?.nameFontSize) {
        issues.push({
          type: "text_overflow",
          title: "Nome muito longo com risco de corte",
          description: `Produto "${p.name}" tem ${p.name.length} caracteres.`,
        });
      }
    });

    return issues;
  };

  const confirmOrExecuteExport = (exportAction: () => void) => {
    if (!checkUnpricedBeforeExport()) return;
    if (!checkMissingPhotoBeforeExport()) return;
    if (flyerProducts.length === 0) {
      alert("Nenhum produto com preço está marcado para entrar no encarte.");
      return;
    }

    const issues = runPreExportDiagnostics();
    if (issues.length > 0) {
      setPreExportIssues(issues);
      setPendingExportAction(() => exportAction);
      setPreExportModalOpen(true);
      return;
    }

    if (expiredInFlyer.length > 0) {
      setPendingExportAction(() => exportAction);
      setExpiredWarningOpen(true);
      return;
    }

    exportAction();
  };

  const handleExportPdf = () => confirmOrExecuteExport(executeExportPdf);

  // Exportar PNG em Resolução 1080 × 1920 ou 2160 × 3840 (ou A4)
  const executeExportPngCurrentPage = async () => {
    const is916 = campaign.format === "story_9_16";
    const pageEl =
      document.getElementById(`batch-story-page-${currentPage}`) ||
      document.getElementById(`story-page-${currentPage}`) ||
      document.getElementById(`batch-a4-page-${currentPage}`) ||
      document.getElementById(`encarte-page-${currentPage}`);

    if (!pageEl) return;

    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const isHighRes = campaign.exportResolution916 === "2160x3840";
      const pixelRatio = is916 ? (isHighRes ? 2 : 1) : 3.125;

      const dataUrl = await toPng(pageEl, {
        pixelRatio,
        cacheBust: true,
        style: { transform: "none" },
      });

      const pageStr = String(currentPage).padStart(2, "0");
      const filename = `encarte-${campaignSlug}-${pageStr}.png`;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      setCompletedSteps((prev) => new Set([...prev, "exportar"]));
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar imagem PNG.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPng = () => confirmOrExecuteExport(executeExportPngCurrentPage);

  // Exportar Todas as Páginas em Arquivo ZIP
  const executeExportZipAllPages = async () => {
    setExporting(true);
    try {
      const [{ default: JSZip }, { toPng }] = await Promise.all([
        import("jszip"),
        import("html-to-image"),
      ]);
      const zip = new JSZip();
      const is916 = campaign.format === "story_9_16";
      const isHighRes = campaign.exportResolution916 === "2160x3840";
      const pixelRatio = is916 ? (isHighRes ? 2 : 1) : 3.125;

      for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        const pageEl =
          document.getElementById(`batch-story-page-${pIdx}`) ||
          document.getElementById(`story-page-${pIdx}`) ||
          document.getElementById(`batch-a4-page-${pIdx}`) ||
          document.getElementById(`encarte-page-${pIdx}`);

        if (!pageEl) continue;

        const dataUrl = await toPng(pageEl, {
          pixelRatio,
          cacheBust: true,
          style: { transform: "none" },
        });

        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const pageStr = String(pIdx).padStart(2, "0");
        const filename = `encarte-${campaignSlug}-${pageStr}.png`;
        zip.file(filename, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `encarte-${campaignSlug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setCompletedSteps((prev) => new Set([...prev, "exportar"]));
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar arquivo ZIP com as páginas do encarte.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportZip = () => confirmOrExecuteExport(executeExportZipAllPages);

  // Proteção rígida: quem não entrar não vê nenhuma tela do sistema
  if (!isAuthVerified) {
    return (
      <div
        data-testid="auth-loading-screen"
        className="min-h-screen bg-[#0D0D0D] flex items-center justify-center select-none"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#FFD400] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-400 font-semibold tracking-wide">
            Verificando acesso restrito...
          </span>
        </div>
      </div>
    );
  }

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
              onClick={() => setResetModalOpen(true)}
              className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white border-red-500 text-xs font-bold shadow-xs transition-colors"
              title="Zerar todos os dados e começar um novo encarte limpo"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Novo Encarte (Zerar Dados)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setStoreSettingsOpen(true)}
              className="min-h-[44px] bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800 hover:text-[#FFD400] text-xs font-semibold"
            >
              <Store className="h-4 w-4 mr-1.5 text-[#FFD400]" />
              Configurar Loja & Cores
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px] bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800 hover:text-red-400 text-xs font-semibold"
              title="Encerrar sessão de acesso"
              data-testid="logout-button"
            >
              <LogOut className="h-4 w-4 mr-1.5 text-neutral-400" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* BARRA DE GERENCIAMENTO DE PROJETOS (Estilo Canva / Figma) */}
      <ProjectTopBar
        projectName={currentProject?.name || "Encarte Ofertas da Semana"}
        projectId={currentProject?.id}
        saveStatus={projectSaveStatus}
        statusNotice={projectStatusNotice}
        isSaving={isSavingProject}
        hasDataSource={Boolean(currentProject?.source?.filename || currentProject?.source?.url)}
        driveConnected={driveConnected}
        onSave={() => handleSaveProject(false)}
        onSaveAs={() => {
          setSaveAsName(currentProject ? `${currentProject.name} (Cópia)` : "");
          setSaveAsError(null);
          setSaveAsModalOpen(true);
        }}
        onRename={handleRenameProject}
        onOpenProjects={() => setProjectManagerOpen(true)}
        onOpenVersionHistory={() => {
          if (currentProject) {
            setHistoryTargetProjectId(currentProject.id);
            setVersionHistoryOpen(true);
          }
        }}
        onOpenUpdateCheck={() => setUpdateCheckOpen(true)}
        onNewProject={handleNewProject}
      />

      {/* 2. ETAPAS VISÍVEIS NO TOPO (Origem, Dados, Preços, Campanha, Exportar) */}
      <EditorStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={navigateToStep}
        savedNotice={savedNotice}
        hasUndo={undoStack.length > 0}
        onUndo={handleUndo}
        onReset={() => setResetModalOpen(true)}
      />

      {/* 3. CONTEÚDO PRINCIPAL DO EDITOR */}
      <div
        className={
          currentStep === "edicao_final"
            ? "w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-2"
            : "mx-auto max-w-7xl px-4 py-6 space-y-6"
        }
      >
        {/* Aviso preventivo de fotos faltantes do projeto restaurado */}
        {missingPhotosNotice && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{missingPhotosNotice}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-bold"
              onClick={() => navigateToStep("origem")}
            >
              Vincular Fotos
            </Button>
          </div>
        )}
        {/* ETAPA 1: ESCOLHA DA ORIGEM (Quando na etapa de origem ou sem produtos) */}
        {currentStep === "origem" && (
          <SourceSelector
            onDataLoaded={handleDataLoaded}
            onExtractCategoryUrl={handleExtractCategoryUrl}
            onLoadSample={handleLoadSample}
            hasExistingProducts={products.length > 0}
            existingProducts={products}
            onReset={handleResetEncarte}
            onUpdateExistingProductsPhotos={handleUpdateProductsPhotos}
          />
        )}

        {/* ETAPA 2, 3, 4 E 5: QUANDO HÁ PRODUTOS OU NA ETAPA CORRESPONDENTE */}
        {currentStep !== "origem" && products.length === 0 && (
          <EmptyState
            type="no_products"
            primaryAction={{
              label: "Escolher Origem dos Dados",
              onClick: () => navigateToStep("origem"),
              icon: <Sparkles className="h-4 w-4" />,
            }}
            secondaryAction={{
              label: "Carregar Dados de Demonstração",
              onClick: handleLoadSample,
            }}
          />
        )}

        {/* ETAPA 4: EDIÇÃO FINAL (STUDIO WYSIWYG EM 3 COLUNAS) */}
        {products.length > 0 && currentStep === "edicao_final" && (
          <FinalEditor
            products={products}
            store={store}
            campaign={campaign}
            onUpdateProducts={(updated) => updateProductsState(updated)}
            onUpdateCampaign={(updatedCamp) => saveCampaignConfig(updatedCamp)}
            onProceedToExport={() => {
              setCompletedSteps((prev) => new Set([...prev, "edicao_final"]));
              navigateToStep("exportar");
              if (campaign.format === "story_9_16") {
                setPreviewZoom(0.38);
              } else {
                setPreviewZoom(0.68);
              }
            }}
            onBackToCampaign={() => navigateToStep("campanha")}
          />
        )}

        {products.length > 0 && currentStep !== "origem" && currentStep !== "edicao_final" && (
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
                    navigateToStep("campanha");
                  }}
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                >
                  Configurar Campanha & Layout
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}

              {currentStep === "campanha" && (
                <Button
                  onClick={() => {
                    setCompletedSteps((prev) => new Set([...prev, "campanha"]));
                    navigateToStep("edicao_final");
                  }}
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                >
                  Avançar para Edição Final
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
                    <span>Por página:</span>
                    <span className="font-bold">{perPage} itens</span>
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
              {/* SE ETAPA FOR PREÇOS */}
              {currentStep === "precos" && (
                <div className="space-y-4">
                  {/* Barra de Ferramentas da Tabela */}
                  <div className="rounded-xl border bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
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

                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <span className="font-semibold text-neutral-700 whitespace-nowrap text-[11px]">Ordem:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortOption)}
                          className="h-[44px] px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-300 bg-white text-neutral-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label="Ordenar produtos"
                        >
                          <option value="validity-asc">📅 Validade (Mais Próxima → Mais Longa)</option>
                          <option value="validity-desc">📅 Validade (Mais Longa → Mais Próxima)</option>
                          <option value="code-asc">🔢 Código (Crescente)</option>
                          <option value="code-desc">🔢 Código (Decrescente)</option>
                          <option value="name-asc">🔤 Nome (A → Z)</option>
                          <option value="name-desc">🔤 Nome (Z → A)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBalancingImages}
                        onClick={handleAutoBalanceImages}
                        className="min-h-[44px] text-xs font-bold text-indigo-900 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        title="Normaliza o tamanho visual e recorta sobras brancas de todas as fotos para ficarem na mesma proporção"
                      >
                        <Scale className="h-4 w-4 mr-1.5 text-indigo-600" />
                        {isBalancingImages ? "Equilibrando..." : "Equilibrar Proporções"}
                      </Button>

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
                    onUnitChange={handleUnitChange}
                    onToggleIncluded={handleToggleIncluded}
                    onEditProduct={(p) => setEditProduct(p)}
                    onDeleteProduct={handleDeleteProduct}
                  />
                </div>
              )}

              {/* SE ETAPA FOR CAMPANHA */}
              {currentStep === "campanha" && (
                <div className="space-y-6 rounded-xl border bg-white p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">
                        Configuração da Campanha & Layout
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Escolha o formato do encarte (Story 9:16 ou A4 Impresso), template de fundo, quantidade de produtos por página e dados da loja.
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        setCompletedSteps((prev) => new Set([...prev, "campanha"]));
                        navigateToStep("edicao_final");
                      }}
                      className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                    >
                      Avançar para Edição Final
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>

                  {/* 1. Escolha do Formato do Encarte */}
                  <div className="space-y-3 rounded-lg border p-4 bg-neutral-50/50">
                    <label className="text-sm font-bold text-neutral-800 block">
                      1. Formato do Encarte
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          saveCampaignConfig({ ...campaign, format: "story_9_16" });
                          setPreviewZoom(0.38);
                        }}
                        className={`min-h-[56px] p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          campaign.format === "story_9_16"
                            ? "bg-red-600 text-white font-bold border-red-600 shadow-xs"
                            : "bg-white text-neutral-800 hover:bg-neutral-100 border-neutral-300 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-6 w-6 shrink-0" />
                          <div>
                            <div className="text-sm font-bold">Story 9:16 (Digital & Redes)</div>
                            <div className="text-[11px] opacity-85">
                              1080 × 1920 px · Template PNG completo · WhatsApp & Instagram
                            </div>
                          </div>
                        </div>
                        {campaign.format === "story_9_16" && (
                          <CheckCircle2 className="h-5 w-5 text-yellow-300 shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          saveCampaignConfig({ ...campaign, format: "a4" });
                          setPreviewZoom(0.68);
                        }}
                        className={`min-h-[56px] p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          campaign.format === "a4"
                            ? "bg-red-600 text-white font-bold border-red-600 shadow-xs"
                            : "bg-white text-neutral-800 hover:bg-neutral-100 border-neutral-300 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-6 w-6 shrink-0" />
                          <div>
                            <div className="text-sm font-bold">A4 Impresso (Gráfica / Folheto)</div>
                            <div className="text-[11px] opacity-85">
                              210 × 297 mm · PDF pronto para impressão a 300 DPI
                            </div>
                          </div>
                        </div>
                        {campaign.format === "a4" && (
                          <CheckCircle2 className="h-5 w-5 text-yellow-300 shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 2. Grade de Produtos por Página */}
                  <div className="space-y-3 rounded-lg border p-4 bg-neutral-50/50">
                    <label className="text-sm font-bold text-neutral-800 block">
                      2. Produtos por página (Padrão: 12)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {([12, 9, 8, 6] as ProductsPerPageOption[]).map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => saveCampaignConfig({ ...campaign, productsPerPage: num })}
                          className={`min-h-[44px] p-3 rounded-lg border text-center transition-all ${
                            (campaign.productsPerPage || 12) === num
                              ? "bg-red-600 text-white font-bold border-red-600 shadow-xs"
                              : "bg-white text-neutral-800 hover:bg-neutral-100 border-neutral-300 font-medium"
                          }`}
                        >
                          <div className="text-sm font-bold">{num} produtos</div>
                          <div className="text-[10px] opacity-80">
                            {num === 12
                              ? "3 colunas x 4 linhas"
                              : num === 9
                              ? "3 colunas x 3 linhas"
                              : num === 8
                              ? "2 colunas x 4 linhas"
                              : "2 colunas x 3 linhas"}
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Se a última página tiver sobra de produtos, os cards serão centralizados e aumentados para preencher todo o espaço da página.
                    </p>
                  </div>

                  {/* 3. Configuração Específica do Formato (Template 9:16 ou Cabeçalho A4) */}
                  {campaign.format === "story_9_16" ? (
                    <div className="space-y-4 rounded-lg border p-4 bg-neutral-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-sm font-bold text-neutral-800 block">
                            Template do encarte (PNG ou JPG em 1080 × 1920 px)
                          </label>
                          <p className="text-[11px] text-neutral-500">
                            A imagem é usada como fundo de todas as páginas, sem alterações.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border bg-white text-xs font-bold hover:bg-neutral-100 shadow-2xs">
                            <Upload className="h-4 w-4 text-red-600" />
                            Enviar Novo Template (PNG / JPG)
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg"
                              className="hidden"
                              onChange={(e) =>
                                e.target.files?.[0] &&
                                handleTemplate916UploadInPage(e.target.files[0])
                              }
                            />
                          </label>

                          {campaign.template916Image &&
                            campaign.template916Image !==
                              "/templates/template-detona-precos-9-16.png" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  saveCampaignConfig({
                                    ...campaign,
                                    template916Image:
                                      "/templates/template-detona-precos-9-16.png",
                                    template916Area: { ...DEFAULT_TEMPLATE_9_16_AREA },
                                  });
                                }}
                                className="text-xs text-neutral-600"
                              >
                                Restaurar "Detona Preços"
                              </Button>
                            )}
                        </div>
                      </div>

                      {/* Ajustador visual da área branca interativo */}
                      <TemplateAreaAdjuster
                        templateImage={
                          campaign.template916Image ||
                          "/templates/template-detona-precos-9-16.png"
                        }
                        area={
                          campaign.template916Area || DEFAULT_TEMPLATE_9_16_AREA
                        }
                        onChange={(newArea) =>
                          saveCampaignConfig({
                            ...campaign,
                            template916Area: newArea,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border p-4 bg-neutral-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-sm font-bold text-neutral-800 block">
                            3. Cabeçalho da Peça A4
                          </label>
                          <p className="text-[11px] text-neutral-500">
                            Especificação: <strong>2480 × 875 px</strong> a 300 DPI (largura de A4 com cerca de 74 mm).
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStoreSettingsOpen(true)}
                          className="text-xs font-semibold"
                        >
                          <Store className="h-4 w-4 mr-1.5 text-primary" />
                          Configurar Loja & Cabeçalho Completo
                        </Button>
                      </div>

                      {campaign.customHeaderImage ? (
                        <div className="rounded-lg border overflow-hidden bg-black max-h-32 flex items-center justify-center relative">
                          <img
                            src={campaign.customHeaderImage}
                            alt="Arte de Cabeçalho"
                            className="w-full h-32 object-cover object-center"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-600 bg-white p-3 rounded border border-dashed">
                          Utilizando o <strong>cabeçalho padrão de varejo</strong> preto com título "{campaign.title}" e subtítulo "{campaign.subtitle}".
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opção de Bloqueio de Exportação por Foto Pendente */}
                  <div className="rounded-lg border p-4 bg-white shadow-2xs space-y-2">
                    <div className="text-xs font-bold text-neutral-900">
                      Regras de Exportação e Validação:
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="block-export-photo-toggle"
                        checked={campaign.blockExportWithoutPhoto || false}
                        onCheckedChange={(checked) =>
                          saveCampaignConfig({
                            ...campaign,
                            blockExportWithoutPhoto: Boolean(checked),
                          })
                        }
                      />
                      <Label
                        htmlFor="block-export-photo-toggle"
                        className="text-xs cursor-pointer text-neutral-800 font-medium"
                      >
                        Bloquear exportação se houver produto sem foto (por padrão desmarcado: itens sem foto exibem o quadro "SEM FOTO")
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* SE ETAPA FOR EXPORTAR OU PRÉ-VISUALIZAÇÃO */}
              {currentStep === "exportar" && (
                <div className="space-y-4">
                  {/* Barra de Controles de Formato, Resolução, Impressão e Escala */}
                  <div className="rounded-xl border bg-white p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-neutral-900">
                          Conferência do Encarte ({flyerProducts.length} itens inclusos)
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">
                          {campaign.format === "story_9_16" ? "Story 9:16" : "A4 Impresso"}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {totalPages} {totalPages === 1 ? "página" : "páginas"} · {campaign.format === "story_9_16" ? "1080 × 1920 px (ou 2160 × 3840 4K)" : "Padrão gráfica 300 DPI"}
                      </p>
                    </div>

                    {/* Controles de Formato, Resolução, Zoom e Produtos por Página */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Seletor Rápido de Formato */}
                      <div className="flex items-center border rounded-lg bg-neutral-50 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            saveCampaignConfig({ ...campaign, format: "story_9_16" });
                            setPreviewZoom(0.38);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                            campaign.format === "story_9_16"
                              ? "bg-red-600 text-white shadow-2xs"
                              : "text-neutral-700 hover:bg-neutral-200"
                          }`}
                          title="Alternar para Formato Story 9:16"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          Story 9:16
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            saveCampaignConfig({ ...campaign, format: "a4" });
                            setPreviewZoom(0.68);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                            campaign.format === "a4"
                              ? "bg-red-600 text-white shadow-2xs"
                              : "text-neutral-700 hover:bg-neutral-200"
                          }`}
                          title="Alternar para Formato A4 Impresso"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          A4 Impresso
                        </button>
                      </div>

                      {/* Seletor Rápido de Resolução para 9:16 */}
                      {campaign.format === "story_9_16" && (
                        <div className="flex items-center border rounded-lg bg-neutral-50 p-1">
                          <button
                            type="button"
                            onClick={() =>
                              saveCampaignConfig({
                                ...campaign,
                                exportResolution916: "1080x1920",
                              })
                            }
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              (campaign.exportResolution916 || "1080x1920") === "1080x1920"
                                ? "bg-black text-yellow-300"
                                : "text-neutral-600 hover:bg-neutral-200"
                            }`}
                            title="Resolução 1080 × 1920 px (padrão)"
                          >
                            1080p
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              saveCampaignConfig({
                                ...campaign,
                                exportResolution916: "2160x3840",
                              })
                            }
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              campaign.exportResolution916 === "2160x3840"
                                ? "bg-black text-yellow-300"
                                : "text-neutral-600 hover:bg-neutral-200"
                            }`}
                            title="Resolução 2160 × 3840 px (Ultra Nitidez 4K)"
                          >
                            4K (Ultra)
                          </button>
                        </div>
                      )}

                      {/* Seletor Rápido de Produtos por Página */}
                      <div className="flex items-center border rounded-lg bg-neutral-50 px-2 py-1">
                        <span className="text-[11px] font-bold text-neutral-600 mr-1.5">
                          Itens:
                        </span>
                        {([12, 9, 8, 6] as ProductsPerPageOption[]).map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              saveCampaignConfig({ ...campaign, productsPerPage: num });
                              setCurrentPage(1);
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                              (campaign.productsPerPage || 12) === num
                                ? "bg-red-600 text-white shadow-2xs"
                                : "text-neutral-700 hover:bg-neutral-200"
                            }`}
                            title={`${num} produtos por página`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>

                      {/* Zoom e Escala Real */}
                      <Button
                        size="sm"
                        variant={isRealScale ? "default" : "outline"}
                        onClick={() => {
                          setIsRealScale(!isRealScale);
                          setPreviewZoom(
                            isRealScale
                              ? campaign.format === "story_9_16"
                                ? 0.38
                                : 0.68
                              : 1.0
                          );
                        }}
                        className={`min-h-[40px] text-xs font-bold ${
                          isRealScale ? "bg-black text-[#FFD400]" : ""
                        }`}
                        title="Alternar entre Escala Real 100% e Ajuste de Tela"
                      >
                        <Maximize2 className="h-3.5 w-3.5 mr-1" />
                        {isRealScale ? "100%" : "Ajustar"}
                      </Button>

                      <div className="flex items-center border rounded-lg bg-neutral-50 p-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsRealScale(false);
                            setPreviewZoom((z) => Math.max(0.2, z - 0.05));
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
                            setPreviewZoom((z) => Math.min(1.5, z + 0.05));
                          }}
                          className="h-8 w-8 p-0"
                          title="Aumentar Zoom"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Botões de Ação de Impressão & Exportação */}
                    <div className="flex items-center gap-2">
                      {campaign.format === "story_9_16" ? (
                        <>
                          <Button
                            onClick={handleExportPng}
                            disabled={exporting || flyerProducts.length === 0}
                            className="min-h-[44px] px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            {exporting
                              ? "Gerando..."
                              : `Baixar PNG (Pág. ${currentPage})`}
                          </Button>

                          <Button
                            onClick={handleExportZip}
                            disabled={exporting || flyerProducts.length === 0}
                            className="min-h-[44px] px-4 bg-neutral-900 hover:bg-neutral-800 text-yellow-300 font-bold text-xs shadow-xs"
                          >
                            <Archive className="h-4 w-4 mr-1.5 text-yellow-400" />
                            {exporting ? "Gerando ZIP..." : "Baixar Todas (.ZIP)"}
                          </Button>
                        </>
                      ) : (
                        <>
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
                            onClick={handleExportPng}
                            disabled={exporting || flyerProducts.length === 0}
                            className="min-h-[44px] text-xs font-semibold"
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Baixar PNG
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Navegação de Páginas */}
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

                  {/* PALCO DE RENDERIZAÇÃO INTERATIVO */}
                  <div className="rounded-2xl border bg-neutral-900/95 p-6 shadow-inner flex flex-col items-center justify-center overflow-auto min-h-[640px]">
                    {campaign.format === "story_9_16" ? (
                      <div
                        className="origin-top transition-transform shadow-2xl rounded-2xl overflow-hidden"
                        style={{
                          transform: `scale(${previewZoom})`,
                          width: "1080px",
                          height: "1920px",
                          marginBottom: `-${1920 * (1 - previewZoom)}px`,
                          marginRight: `-${1080 * (1 - previewZoom)}px`,
                        }}
                      >
                        <StoryPage916
                          domId={`story-page-${currentPage}`}
                          pageNumber={currentPage}
                          totalPages={totalPages}
                          products={pageProducts}
                          store={store}
                          campaign={campaign}
                        />
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Container off-screen para renderizar todas as páginas e exportar em lote sem cortes */}
                  <div
                    className="fixed -left-[99999px] top-0 pointer-events-none opacity-0"
                    style={{ width: "1080px", overflow: "hidden" }}
                  >
                    {Array.from({ length: totalPages }).map((_, pIdx) => {
                      const start = pIdx * perPage;
                      const prodsForPage = flyerProducts.slice(start, start + perPage);
                      return campaign.format === "story_9_16" ? (
                        <StoryPage916
                          key={`batch-story-page-${pIdx + 1}`}
                          domId={`batch-story-page-${pIdx + 1}`}
                          pageNumber={pIdx + 1}
                          totalPages={totalPages}
                          products={prodsForPage}
                          store={store}
                          campaign={campaign}
                        />
                      ) : (
                        <A4Page
                          key={`batch-a4-page-${pIdx + 1}`}
                          domId={`batch-a4-page-${pIdx + 1}`}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Cadastrar Produto Manualmente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha código, descrição e dados, ou cole o link do produto para puxar as informações automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Opção de Puxar Dados por Link / URL */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="productLinkInput" className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-blue-600" />
                Puxar dados por link da loja / produto
              </label>
              <span className="text-[10px] text-blue-700 font-medium">Opcional</span>
            </div>

            <div className="flex gap-2">
              <Input
                id="productLinkInput"
                type="url"
                placeholder="Cole o link do produto (ex: https://loja.com/produto/...)"
                value={productUrlInput}
                onChange={(e) => {
                  setProductUrlInput(e.target.value);
                  setFetchUrlError(null);
                  setFetchUrlSuccess(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFetchProductFromUrl();
                  }
                }}
                disabled={isFetchingUrl}
                className="text-xs h-9 bg-white border-blue-300 focus-visible:ring-blue-500"
              />
              <Button
                type="button"
                size="sm"
                disabled={isFetchingUrl || !productUrlInput.trim()}
                onClick={handleFetchProductFromUrl}
                className="min-h-[36px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 shadow-2xs"
              >
                {isFetchingUrl ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Puxando...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Puxar Dados
                  </>
                )}
              </Button>
            </div>

            {fetchUrlSuccess && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-300 rounded px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>{fetchUrlSuccess}</span>
              </div>
            )}

            {fetchUrlError && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-800 font-medium bg-red-50 border border-red-300 rounded px-2.5 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span>{fetchUrlError}</span>
              </div>
            )}
          </div>

          {/* Miniatura da foto se tiver sido puxada ou inserida */}
          {newProd.image && (
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <img
                  src={newProd.image}
                  alt="Foto do produto"
                  className="h-11 w-11 object-contain rounded-md border bg-white p-0.5 shadow-2xs"
                />
                <div>
                  <p className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Foto vinculada com sucesso
                  </p>
                  <p className="text-[10px] text-neutral-500">Pronta para o encarte</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8 font-medium"
                onClick={() => setNewProd((prev) => ({ ...prev, image: "" }))}
              >
                Remover Foto
              </Button>
            </div>
          )}

          <form onSubmit={handleAddManualProduct} className="space-y-3 pt-1">
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

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-semibold">Preço de Venda (R$)</label>
                <Input
                  placeholder="Ex: 14,90"
                  value={newProd.price}
                  onChange={(e) =>
                    setNewProd({ ...newProd, price: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Medida</label>
                <select
                  value={newProd.unit}
                  onChange={(e) =>
                    setNewProd({ ...newProd, unit: e.target.value })
                  }
                  className="w-full rounded-md border bg-white px-2 py-2 text-xs font-semibold"
                >
                  <option value="UND">UND</option>
                  <option value="CX">CX</option>
                  <option value="PCT">PCT</option>
                  <option value="FD">FD</option>
                  <option value="DISP">DISP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
              <div>
                <label className="text-xs font-semibold">Estoque (Opcional)</label>
                <Input
                  placeholder="Ex: 80+53 ou 80 UND"
                  value={newProd.stock}
                  onChange={(e) =>
                    setNewProd({ ...newProd, stock: e.target.value })
                  }
                  onBlur={() => {
                    if (newProd.stock) {
                      setNewProd({
                        ...newProd,
                        stock: evaluateStockExpression(newProd.stock, newProd.unit),
                      });
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Selo Promocional</label>
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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddManualOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Cadastrar
              </Button>
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

      {/* 6. Bloqueio de Exportação por Preço Vazio */}
      <Dialog open={unpricedModalOpen} onOpenChange={setUnpricedModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              Exportação Bloqueada: Preços Pendentes
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1">
              Existem <strong>{unpricedIncluded.length} produto(s)</strong> no encarte sem preço preenchido. Para garantir a qualidade das artes, todos os preços devem ser informados antes de exportar.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg border bg-neutral-50 text-xs">
            {unpricedIncluded.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-1.5 bg-white rounded border border-neutral-200"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-1 rounded text-[11px] mr-1.5">
                    {p.code}
                  </span>
                  <span className="font-bold text-neutral-900 uppercase truncate">
                    {p.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                  Sem preço
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUnpricedModalOpen(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={() => {
                setUnpricedModalOpen(false);
                navigateToStep("precos");
                setActiveIssueFilter("unpriced");
              }}
            >
              Preencher Preços Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Bloqueio de Exportação por Foto Vazia (Opcional, ativo via checkbox) */}
      <Dialog open={missingPhotoModalOpen} onOpenChange={setMissingPhotoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-700 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              Exportação Bloqueada: Fotos Pendentes
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1">
              Existem <strong>{missingPhotoIncluded.length} produto(s)</strong> no encarte sem foto. Como a opção de bloquear exportação sem foto está ativada, adicione fotos aos produtos ou desmarque essa opção para exportar com o quadro padrão "SEM FOTO".
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg border bg-neutral-50 text-xs">
            {missingPhotoIncluded.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-1.5 bg-white rounded border border-neutral-200"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded text-[11px] mr-1.5">
                    {p.code}
                  </span>
                  <span className="font-bold text-neutral-900 uppercase truncate">
                    {p.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded shrink-0">
                  Sem foto
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMissingPhotoModalOpen(false);
                navigateToStep("precos");
                setActiveIssueFilter("missing_photo");
              }}
            >
              Revisar Fotos
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => {
                setMissingPhotoModalOpen(false);
                saveCampaignConfig({ ...campaign, blockExportWithoutPhoto: false });
                if (pendingExportAction) {
                  pendingExportAction();
                  setPendingExportAction(null);
                }
              }}
            >
              Desmarcar Bloqueio e Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Checagem Preventiva de Qualidade Antes da Exportação */}
      <Dialog open={preExportModalOpen} onOpenChange={setPreExportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-800 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              Checagem Preventiva de Qualidade
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1">
              Foram detectados pontos de atenção antes da exportação. Revise os itens abaixo:
            </DialogDescription>
          </DialogHeader>

          <div
            data-testid="pre-export-issues-list"
            className="max-h-60 overflow-y-auto space-y-2 p-2.5 rounded-lg border bg-neutral-50 text-xs"
          >
            {preExportIssues.map((issue, idx) => (
              <div
                key={`issue-${idx}`}
                className="p-2 bg-white rounded border border-neutral-200 flex items-start gap-2 shadow-2xs"
              >
                <AlertCircle
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    issue.type === "unpriced" ? "text-red-600" : "text-amber-600"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-900 flex items-center justify-between">
                    <span>{issue.title}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        issue.type === "unpriced"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {issue.type === "unpriced"
                        ? "Bloqueante"
                        : issue.type === "missing_photo"
                        ? "Sem Foto"
                        : "Ajuste Visual"}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    {issue.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPreExportModalOpen(false);
                setPendingExportAction(null);
                navigateToStep("edicao_final");
              }}
            >
              Revisar na Edição Final
            </Button>
            {preExportIssues.some((i) => i.type === "unpriced") ? (
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={() => {
                  setPreExportModalOpen(false);
                  setPendingExportAction(null);
                  navigateToStep("precos");
                  setActiveIssueFilter("unpriced");
                }}
              >
                Corrigir Preços Pendentes
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                data-testid="confirm-export-anyway-button"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={() => {
                  setPreExportModalOpen(false);
                  if (pendingExportAction) {
                    const action = pendingExportAction;
                    setPendingExportAction(null);
                    action();
                  }
                }}
              >
                Confirmar e Exportar Mesmo Assim
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO: NOVO ENCARTE / ZERAR DADOS */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Iniciar Novo Encarte e Zerar Dados?
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1 leading-relaxed">
              Tem certeza que deseja começar um novo encarte? Esta ação irá{" "}
              <strong>apagar todos os produtos, fotos e dados da campanha atual</strong> salvos no navegador, permitindo iniciar um encarte 100% limpo a partir de uma nova planilha ou origem.
            </DialogDescription>
          </DialogHeader>

          {products.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                Dados atuais que serão removidos:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-800 pl-1">
                <li>{products.length} produtos carregados na lista</li>
                <li>Fotos associadas do computador, Drive ou ZIP</li>
                <li>Preços, estoques e validades editadas</li>
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
              className="text-xs font-semibold min-h-[38px]"
            >
              Cancelar e Manter Dados
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleExecuteReset}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs min-h-[38px]"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Sim, Zerar Dados e Começar Novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CANVA-STYLE DE ARQUIVOS E PROJETOS RECENTES */}
      <ProjectManagerModal
        open={projectManagerOpen}
        onOpenChange={setProjectManagerOpen}
        currentProjectId={currentProject?.id}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onViewVersionHistory={(id) => {
          setHistoryTargetProjectId(id);
          setVersionHistoryOpen(true);
        }}
        onCheckUpdates={() => setUpdateCheckOpen(true)}
      />

      {/* MODAL DE HISTÓRICO DE VERSÕES COM RESTAURAÇÃO SEGURA */}
      <VersionHistoryModal
        projectId={historyTargetProjectId || currentProject?.id || null}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        onVersionRestored={(restored) => {
          setCurrentProject(restored);
          setProducts(restored.products || []);
          if (restored.campaign) setCampaign(restored.campaign);
          if (restored.store) setStore(restored.store);
          setSavedNotice(`Versão v${restored.version} restaurada`);
          setProjectStatusNotice(`Versão v${restored.version} ativa`);
          setVersionHistoryOpen(false);
          isDirtyRef.current = false;
        }}
      />

      {/* MODAL DE VERIFICAÇÃO DE ATUALIZAÇÕES DA PLANILHA / ORIGEM */}
      <ProjectUpdateCheckModal
        project={currentProject}
        open={updateCheckOpen}
        onOpenChange={setUpdateCheckOpen}
        onApplyUpdates={(updated) => {
          updateProductsState(updated);
          setUpdateCheckOpen(false);
          setSavedNotice("Alterações da planilha aplicadas ao encarte!");
        }}
      />

      {/* MODAL SALVAR COMO */}
      <Dialog open={saveAsModalOpen} onOpenChange={setSaveAsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-900 font-bold">
              <Copy className="h-5 w-5 text-emerald-600" />
              Salvar Como Novo Projeto
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 pt-1">
              Crie uma cópia independente deste encarte com um novo nome no seu Google Drive e histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <Label htmlFor="saveAsInput" className="text-xs font-bold text-neutral-800">
              Nome do Novo Projeto
            </Label>
            <Input
              id="saveAsInput"
              value={saveAsName}
              onChange={(e) => {
                setSaveAsName(e.target.value);
                setSaveAsError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleExecuteSaveAs();
                }
              }}
              placeholder="Ex: Encarte Ofertas de Novembro"
              className="text-xs"
            />
            {saveAsError && (
              <p className="text-xs text-red-600 font-semibold">{saveAsError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveAsModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingProject}
              onClick={handleExecuteSaveAs}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              {isSavingProject ? "Salvando..." : "Salvar Como"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
