import React from "react";
import type { StoreConfig, CampaignConfig } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface EncarteHeaderProps {
  pageNumber: number;
  totalPages: number;
  store: StoreConfig;
  campaign: CampaignConfig;
  isLastPage?: boolean;
}

export const EncarteHeader: React.FC<EncarteHeaderProps> = ({
  pageNumber,
  totalPages,
  store,
  campaign,
}) => {
  const isFirstPage = pageNumber === 1;
  const primary = store.primaryColor || DESIGN_TOKENS.colors.primary;
  const accent = store.accentColor || DESIGN_TOKENS.colors.accent;

  if (!isFirstPage) {
    // Cabeçalho compacto para páginas seguintes
    return (
      <header className="relative w-full bg-[#0D0D0D] text-white shrink-0 overflow-hidden shadow-md">
        {/* Faixa decorativa no topo (não compete com o conteúdo) */}
        <div className="h-2 w-full retail-stripes" />

        <div className="flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-3">
            {store.logo && (
              <img
                src={store.logo}
                alt=""
                className="h-8 w-8 rounded-md bg-white object-contain p-0.5"
              />
            )}
            <div>
              <span className="font-display text-xl uppercase tracking-wider text-[#FFD400]">
                {campaign.title || "DETONA PREÇOS"}
              </span>
              <span className="mx-2 text-xs text-neutral-400">·</span>
              <span className="text-xs font-bold uppercase text-neutral-200">
                {store.name}
              </span>
            </div>
          </div>

          <div
            className="rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: primary, color: accent }}
          >
            Página {pageNumber} de {totalPages}
          </div>
        </div>

        {/* Faixa decorativa na base */}
        <div className="h-1.5 w-full retail-stripes" />
      </header>
    );
  }

  // Cabeçalho da Primeira Página (ocupa cerca de 25% da página A4)
  return (
    <header className="relative flex flex-col justify-between w-full h-[270px] bg-[#0D0D0D] text-white shrink-0 overflow-hidden shadow-lg border-b-4 border-[#FFD400]">
      {/* Faixa diagonal superior amarela e preta */}
      <div className="h-3 w-full retail-stripes shrink-0" />

      {/* Conteúdo central do cabeçalho */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-2 text-center relative z-10">
        {/* Identificação da Loja (Topo) */}
        <div className="flex items-center gap-2 mb-1">
          {store.logo && (
            <img
              src={store.logo}
              alt=""
              className="h-8 w-8 rounded-full bg-white object-contain p-0.5 shadow"
            />
          )}
          <span className="font-sans text-xs font-black uppercase tracking-widest text-neutral-200">
            {store.name}
          </span>
        </div>

        {/* Título Principal com Efeito de Volume e Sombra de Varejo */}
        <div className="relative my-0.5">
          <h1
            className="font-display uppercase tracking-wider leading-[0.9] text-[58px] title-3d-glow"
            style={{ color: accent }}
          >
            {campaign.title || "DETONA PREÇOS"}
          </h1>
        </div>

        {/* Subtítulo em Amarelo de Alto Contraste */}
        <div className="mt-1 inline-block rounded-md bg-[#FFD400] px-4 py-1 shadow-md transform -rotate-1">
          <span className="font-display text-lg font-black uppercase tracking-wide text-[#0D0D0D]">
            {campaign.subtitle || "PRODUTOS COM VALIDADE CURTA!"}
          </span>
        </div>

        {/* Observação / Prazo em texto menor */}
        {campaign.observation && (
          <p className="mt-2 text-[8.5pt] font-semibold text-neutral-300 max-w-lg leading-tight uppercase tracking-wider">
            {campaign.observation}
          </p>
        )}
      </div>

      {/* Faixa diagonal inferior amarela e preta */}
      <div className="h-3 w-full retail-stripes shrink-0" />
    </header>
  );
};
