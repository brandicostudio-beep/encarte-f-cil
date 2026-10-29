import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  Save,
  Copy,
  Edit3,
  History,
  RefreshCw,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreVertical,
  PlusCircle,
  Check,
  X,
} from "lucide-react";
import type { ProjectSyncStatus } from "@/types/project";
import { validateProjectName } from "@/lib/project-serializer";

interface ProjectTopBarProps {
  projectName: string;
  projectId?: string | undefined;
  saveStatus: ProjectSyncStatus;
  statusNotice?: string | undefined;
  isSaving?: boolean;
  hasDataSource?: boolean;
  driveConnected?: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: (newName: string) => void;
  onOpenProjects: () => void;
  onOpenVersionHistory: () => void;
  onOpenUpdateCheck: () => void;
  onNewProject: () => void;
}

export const ProjectTopBar: React.FC<ProjectTopBarProps> = ({
  projectName,
  projectId,
  saveStatus,
  statusNotice,
  isSaving = false,
  hasDataSource = false,
  driveConnected = false,
  onSave,
  onSaveAs,
  onRename,
  onOpenProjects,
  onOpenVersionHistory,
  onOpenUpdateCheck,
  onNewProject,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const [nameError, setNameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartRename = () => {
    setNameDraft(projectName);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleSaveRename = () => {
    const val = validateProjectName(nameDraft);
    if (!val.valid) {
      setNameError(val.error || "Nome inválido");
      return;
    }
    setIsEditingName(false);
    setNameError(null);
    if (val.cleanName !== projectName) {
      onRename(val.cleanName);
    }
  };

  const handleCancelRename = () => {
    setNameDraft(projectName);
    setNameError(null);
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRename();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161616] border-b border-neutral-800 px-4 py-2 text-white">
      {/* Esquerda: Meus Projetos + Nome do Projeto (estilo Canva) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenProjects}
          className="min-h-[36px] bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border-neutral-700 font-bold text-xs shadow-xs transition-colors shrink-0"
          title="Abrir gerenciador de projetos (Canva style)"
        >
          <Folder className="h-4 w-4 mr-1.5 text-[#FFD400]" />
          Meus Projetos
        </Button>

        <span className="text-neutral-600 text-sm font-light">|</span>

        {/* Nome do projeto editável */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameError(null);
                }}
                onKeyDown={handleKeyDown}
                className="h-8 max-w-[260px] bg-neutral-950 text-white text-xs font-semibold border-amber-500 focus-visible:ring-amber-500"
                placeholder="Nome do projeto"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="p-1 rounded text-green-400 hover:bg-neutral-800 transition-colors"
                title="Confirmar nome"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCancelRename}
                className="p-1 rounded text-neutral-400 hover:bg-neutral-800 transition-colors"
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartRename}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-800/80 transition-colors text-left group max-w-[280px] sm:max-w-[360px] truncate"
              title="Clique para renomear este projeto"
            >
              <span className="text-xs sm:text-sm font-bold text-neutral-100 truncate group-hover:text-[#FFD400] transition-colors">
                {projectName || "Projeto Sem Título"}
              </span>
              <Edit3 className="h-3 w-3 text-neutral-500 group-hover:text-[#FFD400] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          {nameError && (
            <span className="text-[10px] text-red-400 font-medium ml-1">
              {nameError}
            </span>
          )}
        </div>
      </div>

      {/* Direita: Status de Salvamento + Botões de Ação */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-300 bg-neutral-900/90 border border-neutral-800 px-2.5 py-1 rounded-md">
          {isSaving ? (
            <>
              <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-300 font-semibold">Salvando...</span>
            </>
          ) : saveStatus === "synced" ? (
            <>
              <Cloud className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-neutral-200">
                {statusNotice || "Sincronizado no Google Drive"}
              </span>
            </>
          ) : saveStatus === "local_only" ? (
            <>
              <HardDrive className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-neutral-300">
                {statusNotice || "Salvo localmente"}
              </span>
            </>
          ) : saveStatus === "unsaved" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300">Alterações não salvas</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-300">Erro de sincronização</span>
            </>
          )}
        </div>

        {/* Botão Salvar (Ctrl+S) */}
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="min-h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          title="Salvar projeto agora (Ctrl+S)"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Salvar
        </Button>

        {/* Menu de Ações Extras do Projeto */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[34px] px-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700"
              title="Mais opções do projeto"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-neutral-950 text-neutral-100 border-neutral-800"
          >
            <DropdownMenuItem
              onClick={onSaveAs}
              className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-xs font-medium"
            >
              <Copy className="h-3.5 w-3.5 mr-2 text-neutral-400" />
              Salvar Como...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleStartRename}
              className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-xs font-medium"
            >
              <Edit3 className="h-3.5 w-3.5 mr-2 text-neutral-400" />
              Renomear Projeto
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onOpenVersionHistory}
              className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-xs font-medium"
            >
              <History className="h-3.5 w-3.5 mr-2 text-[#FFD400]" />
              Histórico de Versões
            </DropdownMenuItem>

            {hasDataSource && (
              <DropdownMenuItem
                onClick={onOpenUpdateCheck}
                className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-xs font-medium text-sky-400 focus:text-sky-300"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2 text-sky-400" />
                Verificar Atualizações
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-neutral-800" />

            <DropdownMenuItem
              onClick={onNewProject}
              className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-xs font-medium text-amber-300 focus:text-amber-200"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-2 text-amber-400" />
              Novo Encarte (Limpo)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
