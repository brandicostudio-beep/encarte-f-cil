import React from "react";
import type { StoreConfig, CampaignConfig } from "@/types/encarte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface EncarteHeaderProps {
  pageNumber?: number;
  totalPages?: number;
  store: StoreConfig;
  campaign: CampaignConfig;
  isLastPage?: boolean;
}

export const EncarteHeader: React.FC<EncarteHeaderProps> = ({
  store,
  campaign,
}) => {
  const accent = store.accentColor || DESIGN_TOKENS.colors.accent;

  // 1. Cabeçalho com Arte Personalizada Enviada pelo Usuário
  if (campaign.customHeaderImage) {
    return (
      <header
        className="relative w-full h-[220px] shrink-0 overflow-hidden shadow-lg border-b-2 border-[#FFD400] bg-black"
        style={{ boxSizing: "border-box" }}
      >
        {/* Arte personalizada ajustada à largura sem distorcer (recorte centralizado com object-cover) */}
        <img
          src={campaign.customHeaderImage}
          alt={campaign.title || "Cabeçalho Promocional"}
          className="w-full h-full object-cover object-center"
        />

        {/* Texto sobre o cabeçalho: SOMENTE se ativado pelo usuário na configuração */}
        {campaign.headerTextOverlay && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-black/40 text-center backdrop-blur-2xs">
            {store.name && (
              <span className="font-sans text-xs font-black uppercase tracking-widest text-neutral-200 drop-shadow-md mb-1">
                {store.name}
              </span>
            )}
            <h1
              className="font-display uppercase tracking-wider leading-none text-4xl title-3d-glow"
              style={{ color: accent }}
            >
              {campaign.title || "DETONA PREÇOS"}
            </h1>
            {campaign.subtitle && (
              <div className="mt-2 inline-block rounded bg-[#FFD400] px-3 py-0.5 shadow-md">
                <span className="font-display text-sm font-black uppercase tracking-wide text-[#0D0D0D]">
                  {campaign.subtitle}
                </span>
              </div>
            )}
          </div>
        )}
      </header>
    );
  }

  // 2. Cabeçalho Padrão Preto de Varejo (repetido em todas as páginas no mesmo tamanho)
  return (
    <header
      className="relative flex flex-col justify-between w-full h-[220px] bg-[#0D0D0D] text-white shrink-0 overflow-hidden shadow-lg border-b-4 border-[#FFD400]"
      style={{ boxSizing: "border-box" }}
    >
      {/* Faixa diagonal superior amarela e preta */}
      <div className="h-2.5 w-full retail-stripes shrink-0" />

      {/* Conteúdo central do cabeçalho */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-2 text-center relative z-10">
        {/* Identificação da Loja (Topo) */}
        <div className="flex items-center gap-2 mb-1">
          {store.logo && (
            <img
              src={store.logo}
              alt=""
              className="h-7 w-7 rounded-full bg-white object-contain p-0.5 shadow"
            />
          )}
          <span className="font-sans text-xs font-black uppercase tracking-widest text-neutral-200">
            {store.name}
          </span>
        </div>

        {/* Título Principal com Efeito de Volume e Sombra de Varejo */}
        <div className="relative my-0.5">
          <h1
            className="font-display uppercase tracking-wider leading-[0.9] text-[46px] title-3d-glow"
            style={{ color: accent }}
          >
            {campaign.title || "DETONA PREÇOS"}
          </h1>
        </div>

        {/* Subtítulo em Amarelo de Alto Contraste */}
        <div className="mt-1 inline-block rounded-md bg-[#FFD400] px-3.5 py-0.5 shadow-md transform -rotate-1">
          <span className="font-display text-base font-black uppercase tracking-wide text-[#0D0D0D]">
            {campaign.subtitle || "PRODUTOS COM VALIDADE CURTA!"}
          </span>
        </div>

        {/* Observação / Prazo */}
        {campaign.observation && (
          <p className="mt-1 font-sans text-[8.5pt] font-bold text-neutral-300 uppercase tracking-tight">
            {campaign.observation}
          </p>
        )}
      </div>

      {/* Faixa diagonal inferior amarela e preta */}
      <div className="h-2 w-full retail-stripes shrink-0" />
    </header>
  );
};
