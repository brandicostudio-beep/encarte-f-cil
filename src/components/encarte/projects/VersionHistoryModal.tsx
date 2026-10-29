import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Calendar, RotateCcw, CheckCircle2, Clock } from "lucide-react";
import type { ProjectData, ProjectVersionSummary } from "@/types/project";
import { loadProjectLocal } from "@/lib/project-indexeddb";
import { restoreVersionUnified } from "@/lib/project-sync-manager";

interface VersionHistoryModalProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVersionRestored: (project: ProjectData) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  projectId,
  open,
  onOpenChange,
  onVersionRestored,
}) => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      loadProjectLocal(projectId).then((res) => {
        if (res.ok && res.project) {
          setProject(res.project);
        }
      });
    }
  }, [open, projectId]);

  if (!open || !projectId) return null;

  const versions = [...(project?.versionHistory || [])].sort(
    (a, b) => b.version - a.version
  );

  const handleRestore = async (versionNum: number) => {
    if (
      !confirm(
        `Restaurar a versão v${versionNum}? Uma nova versão (v${
          (project?.version || 1) + 1
        }) será criada preservando o histórico existente.`
      )
    ) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await restoreVersionUnified(projectId, versionNum);
      if (res.ok && res.restoredProject) {
        onVersionRestored(res.restoredProject);
        onOpenChange(false);
      } else {
        alert(res.error || "Erro ao restaurar versão.");
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()} às ${String(d.getHours()).padStart(
        2,
        "0"
      )}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-red-600" />
            Histórico de Versões: {project?.name || "Projeto"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-neutral-500">
          Todas as alterações salvas ficam registradas. Ao restaurar uma versão antiga, uma nova versão é criada mantendo todo o histórico intacto.
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {versions.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Nenhuma versão anterior registrada neste projeto.
            </div>
          ) : (
            versions.map((v) => {
              const isCurrent = v.version === project?.version;
              return (
                <div
                  key={v.version}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-red-50/50 border-red-300 ring-1 ring-red-500"
                      : "bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? "bg-red-600 text-white"
                          : "bg-neutral-100 text-neutral-700 border"
                      }`}
                    >
                      v{v.version}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">
                          Versão {v.version}
                        </span>
                        {isCurrent && (
                          <Badge className="bg-red-600 text-white text-[9px] px-1.5 py-0 font-bold">
                            Versão Atual
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          {formatDate(v.savedAt)}
                        </span>
                        <span>•</span>
                        <span>{v.itemCount} produtos</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Ativa
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isRestoring}
                        onClick={() => handleRestore(v.version)}
                        className="h-8 text-xs font-bold hover:bg-neutral-100 gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
                        Restaurar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
