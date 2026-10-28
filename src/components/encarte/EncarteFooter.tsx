import React from "react";
import type { StoreConfig } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { Phone } from "lucide-react";

interface EncarteFooterProps {
  store: StoreConfig;
  pageNumber?: number;
  totalPages?: number;
  isLastPage?: boolean;
  totalProductsCount?: number;
}

export const EncarteFooter: React.FC<EncarteFooterProps> = ({
  store,
  pageNumber = 1,
  totalPages = 1,
}) => {
  const primary = store.primaryColor || DESIGN_TOKENS.colors.primary;
  const accent = store.accentColor || DESIGN_TOKENS.colors.accent;

  return (
    <footer className="relative w-full shrink-0 bg-[#0D0D0D] text-white overflow-hidden border-t-2 border-[#FFD400]">
      {/* Faixa decorativa no topo do rodapé */}
      <div className="h-1.5 w-full retail-stripes" />

      <div className="px-5 py-2 flex items-center justify-between gap-4">
        {/* Identificação e Contato da Loja */}
        <div className="flex items-center gap-3 min-w-0">
          {store.logo && (
            <img
              src={store.logo}
              alt=""
              className="h-7 w-7 shrink-0 rounded bg-white object-contain p-0.5 shadow"
            />
          )}
          <div className="truncate">
            <span
              className="font-display text-sm uppercase leading-none tracking-wider truncate mr-2"
              style={{ color: accent }}
            >
              {store.name}
            </span>
            {store.phone && (
              <span className="inline-flex items-center gap-1 text-[8pt] text-neutral-300 font-bold">
                <Phone className="h-2.5 w-2.5 text-[#FFD400] shrink-0" />
                {store.phone}
              </span>
            )}
          </div>
        </div>

        {/* Nota Legal Central (opcional) */}
        {store.legalNotice ? (
          <p className="hidden md:block max-w-[420px] text-[7pt] text-neutral-400 truncate uppercase leading-tight">
            {store.legalNotice}
          </p>
        ) : null}

        {/* Pílula: Página X de Y */}
        <div
          className="rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0"
          style={{ backgroundColor: primary, color: accent }}
        >
          Página {pageNumber} de {totalPages}
        </div>
      </div>
    </footer>
  );
};
