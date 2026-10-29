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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Layers,
  Copy,
  Trash2,
  Edit2,
  History,
  RefreshCw,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Globe,
  Grid,
  List,
  RotateCcw,
} from "lucide-react";
import type { ProjectIndexItem } from "@/types/project";
import {
  listAllProjectsUnified,
  renameProjectUnified,
  duplicateProjectUnified,
  deleteProjectUnified,
  restoreProjectUnified,
} from "@/lib/project-sync-manager";
import { validateProjectName } from "@/lib/project-serializer";

interface ProjectManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId?: string | undefined;
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
  onViewVersionHistory?: ((projectId: string) => void) | undefined;
  onCheckUpdates?: ((projectId: string) => void) | undefined;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  open,
  onOpenChange,
  currentProjectId,
  onOpenProject,
  onNewProject,
  onViewVersionHistory,
  onCheckUpdates,
}) => {
  const [tab, setTab] = useState<"recent" | "trash">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "name">("recent");
  const [projects, setProjects] = useState<ProjectIndexItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  // Estados para modal de renomear
  const [renameTarget, setRenameTarget] = useState<ProjectIndexItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  // Estado para exclusão definitiva
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<ProjectIndexItem | null>(null);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const res = await listAllProjectsUnified(tab === "trash");
      setProjects(res.items);
      setDriveConnected(res.driveConnected);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, tab]);

  // Filtragem e ordenação
  const filteredProjects = projects
    .filter((p) => {
      if (!search.trim()) return true;
      return p.name.toLowerCase().includes(search.toLowerCase().trim());
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return a.name.localeCompare(b.name);
    });

  const handleStartRename = (p: ProjectIndexItem) => {
    setRenameTarget(p);
    setRenameValue(p.name);
    setRenameError("");
  };

  const handleSaveRename = async () => {
    if (!renameTarget) return;
    const val = validateProjectName(renameValue);
    if (!val.valid) {
      setRenameError(val.error || "Nome inválido");
      return;
    }

    const res = await renameProjectUnified(renameTarget.id, val.cleanName);
    if (res.ok) {
      setRenameTarget(null);
      await loadProjects();
    } else {
      setRenameError(res.error || "Erro ao renomear.");
    }
  };

  const handleDuplicate = async (p: ProjectIndexItem) => {
    const res = await duplicateProjectUnified(p.id);
    if (res.ok) {
      await loadProjects();
    }
  };

  const handleTrash = async (p: ProjectIndexItem) => {
    if (confirm(`Mover "${p.name}" para a lixeira?`)) {
      await deleteProjectUnified(p.id, false);
      await loadProjects();
    }
  };

  const handleRestore = async (p: ProjectIndexItem) => {
    await restoreProjectUnified(p.id);
    await loadProjects();
  };

  const handleDeletePermanent = async (p: ProjectIndexItem) => {
    await deleteProjectUnified(p.id, true);
    setDeleteConfirmTarget(null);
    await loadProjects();
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const today = new Date();
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (isToday) return `Hoje às ${time}`;

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();
      if (isYesterday) return `Ontem às ${time}`;

      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${time}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Header Superior Estilo Canva */}
          <div className="p-6 border-b bg-neutral-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-black text-neutral-900 flex items-center gap-2">
                  <Folder className="w-6 h-6 text-red-600" />
                  Meus Projetos de Encarte
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {driveConnected ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] gap-1">
                      <Cloud className="w-3 h-3 text-emerald-600" />
                      Google Drive Conectado (Pasta: Encartes Fácil)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1">
                      <HardDrive className="w-3 h-3 text-amber-600" />
                      Salvo Localmente (IndexedDB)
                    </Badge>
                  )}
                  <span className="text-xs text-neutral-500">
                    {projects.length} {projects.length === 1 ? "projeto" : "projetos"}
                  </span>
                </div>
              </div>

              {/* Botão Novo Encarte */}
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onNewProject();
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Criar Novo Encarte
              </Button>
            </div>

            {/* Abas e Controles de Busca */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-5">
              {/* Abas */}
              <div className="flex items-center bg-neutral-200/80 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTab("recent")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    tab === "recent"
                      ? "bg-white text-neutral-900 shadow-xs font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Arquivos Recentes
                </button>
                <button
                  type="button"
                  onClick={() => setTab("trash")}
                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                    tab === "trash"
                      ? "bg-white text-neutral-900 shadow-xs font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Lixeira
                </button>
              </div>

              {/* Busca e Visualização */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    placeholder="Buscar projeto por nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white"
                  />
                </div>

                {/* Alternar Grid / Tabela */}
                <div className="flex items-center border rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 ${viewMode === "grid" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-600"}`}
                    title="Exibição em Cards"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`p-1.5 ${viewMode === "table" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-600"}`}
                    title="Exibição em Tabela"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Ordenação */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-8 text-xs border rounded-lg px-2 bg-white text-neutral-700 font-medium"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="name">Nome (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Área Central: Cards Recentes ou Tabela */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[380px] bg-neutral-100/40">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-red-600" />
                <span className="text-xs">Carregando projetos...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500">
                <Folder className="w-12 h-12 text-neutral-300 mb-2" />
                <h3 className="text-sm font-bold text-neutral-800">
                  {tab === "trash" ? "A lixeira está vazia" : "Nenhum projeto encontrado"}
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mt-1">
                  {tab === "trash"
                    ? "Projetos movidos para a lixeira aparecerão aqui antes de serem excluídos definitivamente."
                    : search
                    ? "Nenhum projeto coincide com o filtro digitado."
                    : "Crie seu primeiro encarte para começar a salvar versões automaticamente."}
                </p>
                {tab === "recent" && !search && (
                  <Button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onNewProject();
                    }}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Novo Encarte
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* GRID DE CARDS ESTILO CANVA */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((p) => {
                  const isCurrent = p.id === currentProjectId;
                  return (
                    <div
                      key={p.id}
                      className={`group relative flex flex-col rounded-xl border bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all ${
                        isCurrent ? "ring-2 ring-red-600 border-red-300" : "hover:border-neutral-300"
                      }`}
                    >
                      {/* Miniatura / Capa */}
                      <div
                        onClick={() => {
                          if (tab === "recent") {
                            onOpenChange(false);
                            onOpenProject(p.id);
                          }
                        }}
                        className="h-32 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black p-4 flex flex-col justify-between text-white cursor-pointer select-none relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between z-10">
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded text-white">
                            v{p.currentVersion} • {p.itemCount} itens
                          </span>
                          {p.syncStatus === "synced" ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded">
                              <Cloud className="w-3 h-3" /> Drive
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded">
                              <HardDrive className="w-3 h-3" /> Local
                            </span>
                          )}
                        </div>

                        {/* Título visual grande */}
                        <div className="z-10 truncate font-display uppercase tracking-wide text-base font-black text-amber-300">
                          {p.name}
                        </div>

                        {isCurrent && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                            Em edição
                          </div>
                        )}
                      </div>

                      {/* Informações e Ações */}
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div
                            onClick={() => {
                              if (tab === "recent") {
                                onOpenChange(false);
                                onOpenProject(p.id);
                              }
                            }}
                            className="font-bold text-xs text-neutral-900 truncate cursor-pointer hover:text-red-600"
                            title={p.name}
                          >
                            {p.name}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <span>{formatDate(p.updatedAt)}</span>
                          </div>
                        </div>

                        {/* Menu de Ações (3 Pontinhos) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-neutral-500 hover:text-neutral-900 rounded-lg"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                            {tab === "recent" ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    onOpenChange(false);
                                    onOpenProject(p.id);
                                  }}
                                  className="font-bold text-neutral-900 cursor-pointer"
                                >
                                  <Folder className="w-3.5 h-3.5 mr-2 text-red-600" />
                                  Abrir Projeto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleStartRename(p)}
                                  className="cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                  Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(p)}
                                  className="cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                  Duplicar
                                </DropdownMenuItem>
                                {onViewVersionHistory && (
                                  <DropdownMenuItem
                                    onClick={() => onViewVersionHistory(p.id)}
                                    className="cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                    Histórico de Versões
                                  </DropdownMenuItem>
                                )}
                                {onCheckUpdates && (
                                  <DropdownMenuItem
                                    onClick={() => onCheckUpdates(p.id)}
                                    className="cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                                    Verificar Atualizações
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleTrash(p)}
                                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Mover para Lixeira
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleRestore(p)}
                                  className="font-bold text-emerald-700 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                  Restaurar Projeto
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteConfirmTarget(p)}
                                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Excluir Definitivamente
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABELA DETALHADA */
              <div className="bg-white rounded-xl border overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b text-neutral-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Nome do Projeto</th>
                      <th className="p-3">Última Alteração</th>
                      <th className="p-3">Versão</th>
                      <th className="p-3">Itens</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProjects.map((p) => {
                      const isCurrent = p.id === currentProjectId;
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-neutral-50/80 transition-colors ${
                            isCurrent ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="p-3 font-bold text-neutral-900">
                            <div className="flex items-center gap-2">
                              <Folder className="w-4 h-4 text-red-600 shrink-0" />
                              <span
                                onClick={() => {
                                  if (tab === "recent") {
                                    onOpenChange(false);
                                    onOpenProject(p.id);
                                  }
                                }}
                                className="cursor-pointer hover:underline truncate max-w-xs"
                              >
                                {p.name}
                              </span>
                              {isCurrent && (
                                <Badge className="bg-red-600 text-white text-[9px] px-1.5 py-0 font-bold">
                                  Atual
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-neutral-500 font-mono">
                            {formatDate(p.updatedAt)}
                          </td>
                          <td className="p-3 font-semibold text-neutral-700">
                            v{p.currentVersion} ({p.versionCount} {p.versionCount === 1 ? "versão" : "versões"})
                          </td>
                          <td className="p-3 font-semibold text-neutral-700">
                            {p.itemCount} produtos
                          </td>
                          <td className="p-3 text-neutral-500">
                            <span className="flex items-center gap-1">
                              {p.sourceType === "spreadsheet" ? (
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              ) : p.sourceType === "url" ? (
                                <Globe className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                              )}
                              <span className="truncate max-w-[120px]">
                                {p.sourceName || "Manual"}
                              </span>
                            </span>
                          </td>
                          <td className="p-3">
                            {p.syncStatus === "synced" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Salvo no Drive
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <HardDrive className="w-3 h-3 text-amber-600" /> Local (Offline)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {tab === "recent" ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      onOpenChange(false);
                                      onOpenProject(p.id);
                                    }}
                                    className="h-7 text-xs bg-neutral-900 hover:bg-neutral-800 text-white font-bold"
                                  >
                                    Abrir
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500">
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                                      <DropdownMenuItem onClick={() => handleStartRename(p)}>
                                        <Edit2 className="w-3.5 h-3.5 mr-2" /> Renomear
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                                        <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
                                      </DropdownMenuItem>
                                      {onViewVersionHistory && (
                                        <DropdownMenuItem onClick={() => onViewVersionHistory(p.id)}>
                                          <History className="w-3.5 h-3.5 mr-2" /> Versões
                                        </DropdownMenuItem>
                                      )}
                                      {onCheckUpdates && (
                                        <DropdownMenuItem onClick={() => onCheckUpdates(p.id)}>
                                          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Atualizações
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleTrash(p)} className="text-red-600">
                                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Mover para Lixeira
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestore(p)}
                                    className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300 font-bold"
                                  >
                                    Restaurar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setDeleteConfirmTarget(p)}
                                    className="h-7 text-xs font-bold"
                                  >
                                    Excluir
                                  </Button>
                                </>
                              )}
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

          {/* Rodapé informativo */}
          <div className="p-4 border-t bg-white flex items-center justify-between text-xs text-neutral-500">
            <span>
              Armazenamento principal: <strong>Google Drive / Encartes Fácil</strong> com backup local contínuo.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RENOMEAR */}
      {renameTarget && (
        <Dialog open={Boolean(renameTarget)} onOpenChange={() => setRenameTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Renomear Projeto</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <label className="text-xs font-semibold text-neutral-700">
                Novo nome do encarte:
              </label>
              <Input
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  setRenameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                }}
                placeholder="Ex: Encarte Ofertas de Natal"
                autoFocus
              />
              {renameError && (
                <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {renameError}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveRename} className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Salvar Nome
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA */}
      {deleteConfirmTarget && (
        <Dialog open={Boolean(deleteConfirmTarget)} onOpenChange={() => setDeleteConfirmTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Excluir Definitivamente?
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-neutral-600">
              Tem certeza que deseja apagar <strong>"{deleteConfirmTarget.name}"</strong>? Esta ação não pode ser desfeita e todas as versões salvas serão apagadas.
            </p>
            <DialogFooter className="gap-2 mt-3">
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeletePermanent(deleteConfirmTarget)}
                className="font-bold"
              >
                Sim, Excluir Definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
