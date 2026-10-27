import React from "react";
import { Button } from "@/components/ui/button";
import { Cloud, ExternalLink, HelpCircle, AlertCircle } from "lucide-react";

interface DriveConnectorCardProps {
  onSwitchToZip?: () => void;
  reason?: "not_connected" | "token_expired";
}

export const DriveConnectorCard: React.FC<DriveConnectorCardProps> = ({
  onSwitchToZip,
  reason = "not_connected",
}) => {
  const isExpired = reason === "token_expired";

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-indigo-50/70 p-4 text-xs text-blue-950 space-y-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <span>Conector Google Drive do Lovable</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isExpired
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}
              >
                {isExpired ? "Conexão Expirada" : "Conexão Necessária"}
              </span>
            </div>
            <p className="text-neutral-600 text-[11.5px] mt-0.5">
              {isExpired
                ? "Sua sessão com o Google Drive expirou. Reconecte o conector para continuar lendo as pastas."
                : "Para listar pastas e baixar fotos originais diretamente do Drive via API v3, conecte sua conta no Lovable."}
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-blue-700 font-semibold bg-white/80 px-2 py-1 rounded-md border border-blue-200">
          <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
          Sem senha no código
        </span>
      </div>

      <div className="bg-white/80 rounded-lg p-3 border border-blue-100 space-y-2 text-[11.5px] leading-relaxed text-neutral-700">
        <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
          <span>Passo a passo no painel do Lovable:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1 pl-1">
          <li>No painel do projeto Lovable, acesse <strong>Configurações &gt; Conectores</strong>.</li>
          <li>Ative o conector <strong>Google Drive</strong> e autorize a leitura de arquivos e pastas.</li>
          <li>Compartilhe sua pasta de fotos do Drive com a conta conectada ou como "Qualquer pessoa com o link".</li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-blue-200/60">
        <div className="text-[11px] text-neutral-500">
          🔒 Conexão segura gerenciada diretamente pelo Lovable via OAuth.
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToZip && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSwitchToZip}
              className="text-xs bg-white text-neutral-700 hover:bg-neutral-100 min-h-[36px]"
            >
              Usar arquivo .ZIP do computador
            </Button>
          )}

          <a
            href="https://lovable.dev/dashboard?connectors"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs min-h-[36px] shadow-xs transition-colors"
          >
            <span>{isExpired ? "Reconectar no Lovable" : "Configurar Conector no Lovable"}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
