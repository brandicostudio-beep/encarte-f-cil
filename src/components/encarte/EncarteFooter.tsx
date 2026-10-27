import React from "react";
import type { StoreConfig } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { MapPin, Phone, ShieldCheck } from "lucide-react";

interface EncarteFooterProps {
  store: StoreConfig;
  isLastPage?: boolean;
  totalProductsCount?: number;
}

export const EncarteFooter: React.FC<EncarteFooterProps> = ({
  store,
  isLastPage = false,
  totalProductsCount,
}) => {
  const accent = store.accentColor || DESIGN_TOKENS.colors.accent;

  if (isLastPage) {
    // Formato 3: Última Página com Resumo Institucional e Informativo de Impressão
    return (
      <footer className="relative w-full shrink-0 bg-[#0D0D0D] text-white overflow-hidden border-t-2 border-[#FFD400]">
        <div className="h-1.5 w-full retail-stripes" />

        <div className="px-6 py-3 space-y-2">
          {/* Linha 1: Dados da Loja com Contatos em Destaque */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {store.logo && (
                <img
                  src={store.logo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded bg-white object-contain p-0.5 shadow"
                />
              )}
              <div className="truncate">
                <div
                  className="font-display text-base uppercase leading-none tracking-wider truncate"
                  style={{ color: accent }}
                >
                  {store.name}
                </div>
                <div className="flex items-center gap-3 text-[8.5pt] text-neutral-300 mt-1 truncate">
                  {store.address && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 text-[#FFD400] shrink-0" />
                      {store.address}
                    </span>
                  )}
                  {store.phone && (
                    <span className="flex items-center gap-1 shrink-0 font-bold text-white">
                      <Phone className="h-3 w-3 text-[#FFD400] shrink-0" />
                      {store.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {totalProductsCount && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-900 border border-neutral-700 text-[8.5pt] text-neutral-300 font-bold shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                <span>{totalProductsCount} OFERTAS CONFERIDAS</span>
              </div>
            )}
          </div>

          {/* Linha 2: Nota legal de responsabilidade e aviso de cores */}
          <div className="flex items-center justify-between text-[7.5pt] font-medium text-neutral-400 border-t border-neutral-800/80 pt-1.5">
            <p className="max-w-[540px] truncate leading-tight uppercase">
              {store.legalNotice ||
                "Ofertas válidas enquanto durarem os estoques. Imagens meramente ilustrativas."}
            </p>
            <span className="text-[7pt] text-neutral-500 uppercase tracking-wide shrink-0">
              Cores de tela (RGB) podem variar da impressão (CMYK)
            </span>
          </div>
        </div>
      </footer>
    );
  }

  // Formato padrão para as demais páginas
  return (
    <footer className="relative w-full shrink-0 bg-[#0D0D0D] text-white overflow-hidden border-t-2 border-[#FFD400]">
      <div className="h-1.5 w-full retail-stripes" />

      <div className="px-5 py-2 flex items-center justify-between gap-4">
        {/* Logo e Nome da Loja */}
        <div className="flex items-center gap-2.5 min-w-0">
          {store.logo && (
            <img
              src={store.logo}
              alt=""
              className="h-8 w-8 shrink-0 rounded bg-white object-contain p-0.5 shadow"
            />
          )}
          <div className="truncate">
            <div
              className="font-display text-sm uppercase leading-none tracking-wider truncate"
              style={{ color: accent }}
            >
              {store.name}
            </div>
            <div className="flex items-center gap-2 text-[8pt] text-neutral-300 mt-0.5 truncate">
              {store.address && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 text-[#FFD400] shrink-0" />
                  {store.address}
                </span>
              )}
              {store.phone && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Phone className="h-2.5 w-2.5 text-[#FFD400] shrink-0" />
                  {store.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nota legal configurável */}
        <div className="text-right text-[7.5pt] font-medium text-neutral-400 max-w-[280px] leading-tight shrink-0 uppercase">
          {store.legalNotice ||
            "Ofertas válidas enquanto durarem os estoques. Imagens meramente ilustrativas."}
        </div>
      </div>
    </footer>
  );
};
