import React from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Calendar,
  History,
  ShieldCheck,
  ChevronLeft,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import type { ValidadeSnapshot } from "@/types/painel-validade";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PainelValidadeHeaderProps {
  activeSnapshot: ValidadeSnapshot | null;
  snapshotsList: ValidadeSnapshot[];
  onSelectSnapshot: (id: string) => void;
  onOpenImport?: () => void;
  onOpenImportModal?: () => void;
  onBackToEncarte?: () => void;
}

export const PainelValidadeHeader: React.FC<PainelValidadeHeaderProps> = ({
  activeSnapshot,
  snapshotsList,
  onSelectSnapshot,
  onOpenImport,
  onOpenImportModal,
  onBackToEncarte,
}) => {
  const handleOpenImport = onOpenImportModal || onOpenImport || (() => {});
  const handleBack =
    onBackToEncarte ||
    (() => {
      if (typeof window !== "undefined") window.location.href = "/";
    });
  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const dia = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const hora = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dia} às ${hora}`;
  };

  const updateTimestamp = formatDateTime(activeSnapshot?.criadoEm);
  const formattedUpdateDate = updateTimestamp;

  return (
    <header className="bg-neutral-950 text-white border-b border-neutral-800 shadow-md">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#3D0A14] via-[#C91E2A] to-[#3D0A14]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Título & Identidade Interna Cescom */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="min-h-[44px] px-3 font-bold text-neutral-200 bg-neutral-900 border-neutral-700 hover:bg-[#5B0E1E] hover:text-white transition-colors"
            title="Voltar ao Editor de Encartes"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            <span className="text-sm">Encartes</span>
          </Button>

          <div className="hidden sm:flex h-9 px-2.5 items-center justify-center rounded-xl bg-gradient-to-r from-[#3D0A14] via-[#5B0E1E] to-[#780D21] border border-red-500/30 shadow-xs shrink-0">
            <img
              src="/logo-cescom-trimmed.png"
              alt="Cescom Distribuidor"
              className="h-5 w-auto object-contain"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                Painel de Validade
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Interno
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider">
                Rotina 8230
              </span>

              {/* Segmented Control: Dois Fluxos */}
              <nav className="hidden md:flex items-center bg-neutral-950 border border-neutral-800 p-0.5 rounded-xl ml-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
                  title="Ir para o Gerador de Encartes"
                >
                  🎨 Encartes
                </button>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-[#6B1124] to-[#C91E2A] text-white shadow-2xs cursor-default">
                  📦 Validade (8230)
                </span>
              </nav>
            </div>
            <p className="text-xs text-neutral-300 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>
                Dados sincronizados com a Rotina 8230 •{" "}
                {updateTimestamp ? updateTimestamp : "Aguardando importação"}
              </span>
            </p>
          </div>
        </div>

        {/* Controles: Snapshot ativo & Botão de Importação */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
          {/* Histórico de Snapshots */}
          {snapshotsList.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[48px] text-xs font-semibold bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                >
                  <History className="h-4 w-4 mr-1.5 text-neutral-400" />
                  <div className="text-left">
                    <div className="text-[10px] text-neutral-400 leading-tight">
                      Rotina 8230 (Ativo):
                    </div>
                    <div className="font-bold text-white text-xs truncate max-w-[140px] sm:max-w-[200px]">
                      {activeSnapshot?.nomeArquivo || "Último importado"}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-neutral-900 border-neutral-800 text-neutral-200">
                <DropdownMenuLabel className="text-xs font-bold text-neutral-400">
                  Histórico Rotina 8230 (Últimas {snapshotsList.length})
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-800" />
                {snapshotsList.map((s) => {
                  const isCurrent = s.id === activeSnapshot?.id;
                  const dataFormatada = new Date(s.criadoEm).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => onSelectSnapshot(s.id)}
                      className={`cursor-pointer flex items-center justify-between text-xs py-2 px-3 hover:bg-neutral-800 ${
                        isCurrent ? "bg-neutral-800/80 font-bold text-white" : ""
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="truncate text-white font-medium">{s.nomeArquivo}</div>
                        <div className="text-[10.5px] text-neutral-400">
                          {dataFormatada} • {s.totalLotes} lotes
                        </div>
                      </div>
                      {isCurrent && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Botão de Importação Principal */}
          <Button
            size="lg"
            onClick={handleOpenImport}
            className="min-h-[52px] px-5 text-sm sm:text-base font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-transform active:scale-95"
            title="Importar planilha exportada da Rotina 8230 do Winthor (.csv ou .xlsx)"
          >
            <Upload className="h-5 w-5 mr-2" />
            Importar Planilha de Validade
          </Button>
        </div>
      </div>

      {/* Faixa inferior discreta com data de atualização */}
      {formattedUpdateDate && (
        <div className="bg-neutral-950/70 border-t border-neutral-800/60 px-4 sm:px-6 py-1.5 text-[11px] text-neutral-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-emerald-400" />
            <span>Rotina 8230 sincronizada em {formattedUpdateDate}</span>
            {activeSnapshot && (
              <span className="text-neutral-500">
                • {activeSnapshot.totalLotes} lotes cadastrados ({activeSnapshot.totalProdutosUnicos} produtos)
              </span>
            )}
          </div>
          <span className="text-[10.5px] text-neutral-400">
            🔒 Visualização estritamente interna • Nunca é exposto ao cliente final
          </span>
        </div>
      )}
    </header>
  );
};
