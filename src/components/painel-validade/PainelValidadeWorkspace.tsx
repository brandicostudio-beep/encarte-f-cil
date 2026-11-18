import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  Sparkles,
  Inbox,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  Zap,
} from "lucide-react";
import type {
  ValidadeFilterParams,
  ValidadeLoteCalculado,
  ValidadeSnapshot,
  FaixaVencimento,
} from "@/types/painel-validade";
import {
  getActiveSnapshot,
  loadSnapshotsList,
  setActiveSnapshotId,
  createSnapshotFromRaw,
  refreshEncartePinsOnActiveSnapshot,
  syncLastEncarteData,
  addLoteToEncarte,
  removeLoteFromEncarte,
} from "@/lib/painel-validade-storage";
import {
  filtrarLotes,
  calcularContadoresAlertas,
  calcularContadoresKpi,
  normalizeProductCode,
} from "@/lib/painel-validade-analytics";
import { PainelValidadeHeader } from "./PainelValidadeHeader";
import { PainelValidadeFilters } from "./PainelValidadeFilters";
import { PainelValidadeCard } from "./PainelValidadeCard";
import { PainelValidadeItemDetailModal } from "./PainelValidadeItemDetailModal";
import { PainelValidadeImportModal } from "./PainelValidadeImportModal";

interface PainelValidadeWorkspaceProps {
  initialFilters?: Partial<ValidadeFilterParams>;
  onFiltersChange?: (filters: ValidadeFilterParams) => void;
}

const DEFAULT_FILTERS: ValidadeFilterParams = {
  busca: "",
  filtroRapido: "todos",
  faixaVencimento: "todas",
  faixaEscoaTempo: "todas",
  faixaGiroMes: "todas",
  faixaCobertura: "todas",
  ritmoMes: "todas",
  noEncarte: "todos",
  comprador: "todos",
  ordenacao: "critico_primeiro",
};

export function PainelValidadeWorkspace({
  initialFilters,
  onFiltersChange,
}: PainelValidadeWorkspaceProps) {
  const [snapshot, setSnapshot] = useState<ValidadeSnapshot | null>(null);
  const [snapshotsList, setSnapshotsList] = useState<ValidadeSnapshot[]>([]);
  const [filters, setFilters] = useState<ValidadeFilterParams>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedLote, setSelectedLote] = useState<ValidadeLoteCalculado | null>(null);
  const [toastNotice, setToastNotice] = useState<{
    show: boolean;
    message: string;
    action: "added" | "removed";
    encarteName?: string;
  } | null>(null);

  // Auto-dismiss do toast após 6 segundos
  useEffect(() => {
    if (!toastNotice?.show) return;
    const timer = setTimeout(() => {
      setToastNotice(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  // Ação de 1 clique: Enviar ou remover lote do encarte
  const handleToggleEncarte = useCallback((loteToToggle: ValidadeLoteCalculado) => {
    const isCurrentlyInEncarte = Boolean(loteToToggle.noEncarte);
    const newNoEncarteState = !isCurrentlyInEncarte;

    // 1. Atualização OTIMISTA e SÍNCRONA do estado do React imediatamente (sem esperar I/O)
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lotes: prev.lotes.map((l) => {
          if (
            l.codprod === loteToToggle.codprod ||
            normalizeProductCode(l.codprod) === normalizeProductCode(loteToToggle.codprod)
          ) {
            return { ...l, noEncarte: newNoEncarteState };
          }
          return l;
        }),
      };
    });

    setSelectedLote((prev) => {
      if (!prev) return prev;
      if (
        prev.codprod === loteToToggle.codprod ||
        normalizeProductCode(prev.codprod) === normalizeProductCode(loteToToggle.codprod)
      ) {
        return { ...prev, noEncarte: newNoEncarteState };
      }
      return prev;
    });

    // 2. Persistência e sincronização de storage e segundo plano
    if (isCurrentlyInEncarte) {
      removeLoteFromEncarte(loteToToggle.codprod);
      setToastNotice({
        show: true,
        message: `Produto ${loteToToggle.codprod} removido do encarte.`,
        action: "removed",
      });
    } else {
      const res = addLoteToEncarte(loteToToggle);
      setToastNotice({
        show: true,
        message: `⚡ ${loteToToggle.descricao} adicionado ao encarte com sucesso!`,
        action: "added",
        encarteName: res.encarteName,
      });
    }
  }, []);

  // Carrega snapshot inicial e lista
  const reloadData = useCallback(() => {
    // Sincroniza pinos e fotos de forma síncrona imediatamente
    refreshEncartePinsOnActiveSnapshot();
    const active = getActiveSnapshot();
    const list = loadSnapshotsList();
    setSnapshot(active);
    setSnapshotsList(list);

    // E sincroniza com o IndexedDB de forma assíncrona para buscar o último encarte salvo
    if (typeof window !== "undefined") {
      syncLastEncarteData()
        .then(() => {
          const refreshed = getActiveSnapshot();
          if (refreshed) {
            setSnapshot(refreshed);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Sincronização ao focar a janela ou detectar alteração no localStorage (ex: salvou encarte em outra aba)
  useEffect(() => {
    const handleSync = () => {
      reloadData();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleSync);
      window.addEventListener("storage", handleSync);
      return () => {
        window.removeEventListener("focus", handleSync);
        window.removeEventListener("storage", handleSync);
      };
    }
  }, [reloadData]);

  // Atualização periódica a cada 4 minutos para checar alterações de encarte
  useEffect(() => {
    const interval = setInterval(() => {
      reloadData();
    }, 240000);
    return () => clearInterval(interval);
  }, [reloadData]);

  // Atualiza filtros informando o container pai quando houver callback
  const handleUpdateFilters = useCallback(
    (newFilters: ValidadeFilterParams) => {
      setFilters(newFilters);
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      }
    },
    [onFiltersChange]
  );

  const handleSelectSnapshot = (snapId: string) => {
    setActiveSnapshotId(snapId);
    reloadData();
  };

  const handleImportSuccess = (newSnap: ValidadeSnapshot) => {
    reloadData();
    setFilters({ ...DEFAULT_FILTERS });
  };

  // Carregar dados de demonstração para teste imediato
  const handleLoadDemoData = () => {
    const hoje = new Date();
    const addDays = (d: number) => {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() + d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const demoRaw = [
      {
        codprod: "22292",
        descricao: "BATATA PALHA BELLA PALHA 80G",
        embalagem: "UNIDADE 1X80 GR",
        dtval: addDays(20),
        qtdisp_wms: 36,
        preco_venda: 4.9,
        qtvendmes: 5,
        qtvendmes1: 12,
        qtvendmes2: 14,
        qtvendmes3: 10,
        codcomprador: "10",
        nomeComprador: "JOAO SILVA",
      },
      {
        codprod: "10452",
        descricao: "SABONETE YPE SUAVE 85G",
        embalagem: "CX C/ 12 UND",
        dtval: addDays(5),
        qtdisp_wms: 500,
        preco_venda: 2.19,
        qtvendmes: 2,
        qtvendmes1: 30,
        qtvendmes2: 25,
        qtvendmes3: 35,
        codcomprador: "12",
        nomeComprador: "MARIA OLIVEIRA",
      },
      {
        codprod: "10884",
        descricao: "DETERGENTE YPE MACA 500ML",
        embalagem: "FD C/ 24",
        dtval: addDays(15),
        qtdisp_wms: 50,
        preco_venda: 2.79,
        qtvendmes: 80,
        qtvendmes1: 150,
        qtvendmes2: 140,
        qtvendmes3: 160,
        codcomprador: "12",
        nomeComprador: "MARIA OLIVEIRA",
      },
      {
        codprod: "30112",
        descricao: "ARROZ TIO JOAO TIPO 1 5KG",
        embalagem: "FD C/ 6",
        dtval: addDays(45),
        qtdisp_wms: 200,
        preco_venda: 32.9,
        qtvendmes: 0,
        qtvendmes1: 0,
        qtvendmes2: 0,
        qtvendmes3: 0,
        codcomprador: "15",
        nomeComprador: "CARLOS SOUZA",
      },
      {
        codprod: "44510",
        descricao: "BISCOITO RECHEADO OREO 90G",
        embalagem: "CX C/ 36",
        dtval: addDays(-2),
        qtdisp_wms: 120,
        preco_venda: 3.99,
        qtvendmes: 10,
        qtvendmes1: 50,
        qtvendmes2: 40,
        qtvendmes3: 45,
        codcomprador: "10",
        nomeComprador: "JOAO SILVA",
      },
    ];

    createSnapshotFromRaw(demoRaw, "demonstracao-winthor.csv", "Demonstração Sistema");
    reloadData();
  };

  const lotes = snapshot ? snapshot.lotes : [];

  // Cálculos de métricas e filtros
  const lotesFiltrados = useMemo(() => {
    return filtrarLotes(lotes, filters);
  }, [lotes, filters]);

  const alertCounts = useMemo(() => {
    return calcularContadoresAlertas(lotes);
  }, [lotes]);

  const kpiCounts = useMemo(() => {
    return calcularContadoresKpi(lotes);
  }, [lotes]);

  // Lista única de compradores para o dropdown
  const compradoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach((l) => {
      if (l.nomeComprador && l.nomeComprador.trim()) {
        set.add(l.nomeComprador.trim());
      }
    });
    return Array.from(set).sort();
  }, [lotes]);

  // Contagens dinâmicas para os 5 botões principais (mantendo os demais filtros ativos)
  const mainFilterCounts = useMemo(() => {
    const baseWithoutQuick = { ...filters, filtroRapido: "todos" as const };
    const allFiltered = filtrarLotes(lotes, baseWithoutQuick);

    const semVendasCount = allFiltered.filter(
      (l) => !l.isSemEstoque && l.estoque > 0 && l.isSemVenda && l.diasParaVencer >= 0 && l.diasParaVencer <= 90
    ).length;

    return {
      todos: allFiltered.length,
      critico: allFiltered.filter(
        (l) => !l.isSemEstoque && l.estoque > 0 && l.diasParaVencer >= 0 && l.diasParaVencer <= 30 && l.escoaTempoPercent < 60
      ).length,
      vence7d: allFiltered.filter(
        (l) => !l.isSemEstoque && l.estoque > 0 && l.diasParaVencer >= 0 && l.diasParaVencer <= 7
      ).length,
      vaiSobrar: allFiltered.filter(
        (l) => !l.isSemEstoque && l.estoque > 0 && l.diasParaVencer >= 0 && l.escoaTempoPercent < 60 && l.sobraPrevistaUnidades > 0
      ).length,
      semVendas3M: semVendasCount,
      parado: semVendasCount,
    };
  }, [lotes, filters]);

  // Handler para cliques nos cards de KPI superiores
  const handleKpiCardClick = (faixa: FaixaVencimento) => {
    handleUpdateFilters({
      ...filters,
      filtroRapido: "todos",
      faixaVencimento: filters.faixaVencimento === faixa ? "todas" : faixa,
    });
  };

  // Handler para cliques nos cards de alerta de topo
  const handleAlertCardClick = (tipo: keyof typeof alertCounts) => {
    if (tipo === "critico") {
      handleUpdateFilters({ ...filters, filtroRapido: "critico" });
    } else if (tipo === "urgente") {
      handleUpdateFilters({ ...filters, filtroRapido: "vence_7d" });
    } else if (tipo === "parado") {
      handleUpdateFilters({ ...filters, filtroRapido: "parado" });
    } else if (tipo === "ritmoCaiu") {
      handleUpdateFilters({
        ...filters,
        filtroRapido: "todos",
        ritmoMes: "abaixo_normal",
        faixaEscoaTempo: "vai_sobrar",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <PainelValidadeHeader
        activeSnapshot={snapshot}
        snapshotsList={snapshotsList}
        onSelectSnapshot={handleSelectSnapshot}
        onOpenImport={() => setImportModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Empty State when no snapshot is loaded */}
        {!snapshot || lotes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-14 shadow-lg border border-slate-200 dark:border-slate-800 text-center space-y-6 max-w-2xl mx-auto my-12">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
              <Inbox className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Nenhuma planilha de validade carregada
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Importe a planilha exportada da Rotina 8230 do Winthor (.csv delimitado por ponto e vírgula ou .xlsx) para visualizar o giro e validade por lote.
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Sincronizado com Rotina 8230
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="w-full sm:w-auto min-h-[56px] px-8 text-lg font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-6 h-6" />
                Importar Planilha Winthor
              </button>

              <button
                type="button"
                onClick={handleLoadDemoData}
                className="w-full sm:w-auto min-h-[56px] px-6 text-base font-semibold rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
                Carregar Exemplo de Teste
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Faixa única e simplificada de filtros, busca e faixas de validade */}
            <PainelValidadeFilters
              filters={filters}
              onFiltersChange={handleUpdateFilters}
              counts={mainFilterCounts}
              validityCounts={kpiCounts}
              totalLotes={lotes.length}
              totalFiltrados={lotesFiltrados.length}
              compradores={compradoresDisponiveis}
            />

            {/* Products / Lots Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300">
                  Mostrando {lotesFiltrados.length} {lotesFiltrados.length === 1 ? "lote" : "lotes"}
                  {lotesFiltrados.length < lotes.length && (
                    <span className="text-sm font-normal text-slate-500 ml-1">
                      (de um total de {lotes.length})
                    </span>
                  )}
                </span>

                {lotesFiltrados.length > 0 && (
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Toque em um lote para abrir análise detalhada
                  </span>
                )}
              </div>

              {lotesFiltrados.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Nenhum lote com esses filtros
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Tente relaxar os filtros ou clique no botão abaixo para restaurar todos os lotes do snapshot.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUpdateFilters({ ...DEFAULT_FILTERS })}
                    className="min-h-[50px] px-6 text-base font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Limpar tudo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {lotesFiltrados.map((lote) => (
                    <PainelValidadeCard
                      key={lote.id}
                      lote={lote}
                      onClick={() => setSelectedLote(lote)}
                      onToggleEncarte={handleToggleEncarte}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Rodapé Informativo: Sincronização com Rotina 8230 */}
      <footer className="mt-12 border-t border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="font-bold text-neutral-800 dark:text-neutral-200">
              Dados sincronizados com a Rotina 8230 (Winthor)
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span>
              {snapshot ? (
                <>
                  Última atualização:{" "}
                  <strong className="text-neutral-700 dark:text-neutral-200">
                    {new Date(snapshot.criadoEm).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}{" "}
                    às{" "}
                    {new Date(snapshot.criadoEm).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  {snapshot.nomeArquivo && (
                    <span className="text-neutral-400 ml-1">({snapshot.nomeArquivo})</span>
                  )}
                </>
              ) : (
                "Aguardando importação da planilha da Rotina 8230"
              )}
            </span>
          </div>

          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center md:text-right">
            Gestão Interna de Distribuição & Compras • Escoamento e Risco de Lotes • Confidencial
          </div>
        </div>
      </footer>

      {/* Item Detail Modal */}
      <PainelValidadeItemDetailModal
        lote={selectedLote}
        open={Boolean(selectedLote)}
        onClose={() => setSelectedLote(null)}
        onToggleEncarte={handleToggleEncarte}
        onOpenEncarteEditor={() => {
          if (typeof window !== "undefined") window.location.href = "/";
        }}
      />

      {/* Import Spreadsheet Modal */}
      <PainelValidadeImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Notificação Flutuante de 1-Clique */}
      {toastNotice?.show && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92vw] sm:w-auto bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-neutral-700 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toastNotice.action === "added" ? (
              <Sparkles className="h-5 w-5 text-yellow-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold truncate">
              {toastNotice.message}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toastNotice.action === "added" && (
              <a
                href="/"
                className="px-3 py-1.5 rounded-lg text-xs font-black bg-yellow-400 hover:bg-yellow-500 text-yellow-950 transition-colors shadow-2xs"
                title="Abrir editor de encartes com este produto incluído"
              >
                Ver no Encarte
              </a>
            )}
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
