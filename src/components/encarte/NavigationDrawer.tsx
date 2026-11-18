import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutGrid,
  CalendarClock,
  Sparkles,
  Store,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
  LogOut,
  ChevronRight,
  Folder,
  History,
} from "lucide-react";

export interface NavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHowItWorks: () => void;
  onOpenStoreSettings: () => void;
  onOpenStockTurnover: () => void;
  onOpenResetModal: () => void;
  onOpenWelcomeHub: () => void;
  onNavigateToValidade: () => void;
  onLogout: () => void;
  onOpenProjects?: () => void;
  onOpenVersionHistory?: () => void;
  turnoverAlertCount?: number;
}

export interface NavigationDrawerContentProps {
  onClose?: () => void;
  onOpenHowItWorks: () => void;
  onOpenStoreSettings: () => void;
  onOpenStockTurnover: () => void;
  onOpenResetModal: () => void;
  onOpenWelcomeHub: () => void;
  onNavigateToValidade: () => void;
  onLogout: () => void;
  onOpenProjects?: () => void;
  onOpenVersionHistory?: () => void;
  turnoverAlertCount?: number;
}

export const NavigationDrawerContent: React.FC<NavigationDrawerContentProps> = ({
  onClose = () => {},
  onOpenHowItWorks,
  onOpenStoreSettings,
  onOpenStockTurnover,
  onOpenResetModal,
  onOpenWelcomeHub,
  onNavigateToValidade,
  onLogout,
  onOpenProjects,
  onOpenVersionHistory,
  turnoverAlertCount = 0,
}) => {
  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-y-auto">
      {/* Top Header do Drawer com a Logo da Cescom e estilo Bordô */}
      <div className="p-6 pb-4 border-b border-neutral-800/80 bg-gradient-to-b from-[#2E070F] to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-10 px-3 items-center justify-center rounded-xl bg-gradient-to-r from-[#3D0A14] via-[#5B0E1E] to-[#780D21] border border-red-500/30 shadow-xs">
            <img
              src="/logo-cescom-trimmed.png"
              alt="Cescom Distribuidor"
              className="h-5 w-auto object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Menu do Sistema
            </h2>
            <p className="text-xs text-neutral-400">
              Cescom Distribuidor • Operações &amp; Validade
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Ações e Links */}
      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Seção 1: Fluxos de Trabalho */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-neutral-400 uppercase tracking-wider px-3">
            Fluxos de Trabalho
          </span>

          <div className="space-y-1">
            {/* Gerador de Encartes (Ativo) */}
            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-800/90 text-white border border-neutral-700/80 text-left transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white truncate">
                    Gerador de Encartes
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Diagramação de ofertas para impressão e redes
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                Ativo
              </span>
            </button>

            {/* Painel de Validade */}
            <button
              type="button"
              onClick={() => handleItemClick(onNavigateToValidade)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                    Painel de Validade
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Giro e risco de lotes (Rotina 8230)
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                Rotina 8230
              </span>
            </button>

            {/* Tela de Boas-Vindas */}
            <button
              type="button"
              onClick={() => handleItemClick(onOpenWelcomeHub)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                    Tela de Boas-Vindas
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Central com visão geral dos dois fluxos
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            </button>
          </div>
        </div>

        {/* Seção: Projetos Salvos & Versões */}
        {(onOpenProjects || onOpenVersionHistory) && (
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-bold text-neutral-400 uppercase tracking-wider px-3">
              Projetos &amp; Histórico
            </span>

            <div className="space-y-1">
              {onOpenProjects && (
                <button
                  type="button"
                  onClick={() => handleItemClick(onOpenProjects)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-[#FFD400] flex items-center justify-center shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                        Meus Projetos
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        Gerenciar encartes salvos no Drive e localmente
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
                </button>
              )}

              {onOpenVersionHistory && (
                <button
                  type="button"
                  onClick={() => handleItemClick(onOpenVersionHistory)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                        Histórico de Versões
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        Restaurar alterações e versões anteriores
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Seção 2: Configurações & Gestão */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-neutral-400 uppercase tracking-wider px-3">
            Configurações & Loja
          </span>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleItemClick(onOpenStoreSettings)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-[#FFD400] flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                    Configurar Loja & Cores
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Nome da loja, WhatsApp, cabeçalho e temas
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            </button>

            <button
              type="button"
              data-testid="admin-turnover-top-btn"
              onClick={() => handleItemClick(onOpenStockTurnover)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                    Área Administrativa: Giro & Validade
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Auditoria interna de produtos críticos
                  </div>
                </div>
              </div>
              {turnoverAlertCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shrink-0 animate-pulse">
                  {turnoverAlertCount}
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Seção 3: Ajuda & Orientação */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-neutral-400 uppercase tracking-wider px-3">
            Ajuda & Suporte
          </span>

          <div className="space-y-1">
            <button
              type="button"
              data-testid="how-it-works-button"
              onClick={() => handleItemClick(onOpenHowItWorks)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800/60 text-neutral-200 border border-transparent hover:border-neutral-700/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                    Como funciona
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate">
                    Guia visual em 4 passos para criar seu encarte
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            </button>
          </div>
        </div>

        {/* Seção 4: Ações Rápidas */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-neutral-400 uppercase tracking-wider px-3">
            Ações Rápidas
          </span>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleItemClick(onOpenResetModal)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-950/30 text-red-300 border border-transparent hover:border-red-900/50 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-900/30 text-red-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold text-red-300 group-hover:text-red-200 truncate">
                    Novo Encarte (Zerar Dados)
                  </div>
                  <div className="text-[11px] text-red-400/80 truncate">
                    Limpar produtos atuais e recomeçar
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400/60 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Rodapé do Menu Lateral: Logout seguro */}
      <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/60">
        <button
          type="button"
          data-testid="logout-button"
          onClick={() => handleItemClick(onLogout)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-neutral-400 hover:text-red-400 hover:bg-neutral-800/80 border border-neutral-800 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Encerrar Sessão (Sair)</span>
        </button>
      </div>
    </div>
  );
};

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  open,
  onOpenChange,
  ...contentProps
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-neutral-900 border-l border-neutral-800 text-white p-0 flex flex-col justify-between overflow-y-auto"
      >
        <NavigationDrawerContent
          onClose={() => onOpenChange(false)}
          {...contentProps}
        />
      </SheetContent>
    </Sheet>
  );
};
