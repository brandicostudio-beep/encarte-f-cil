import React from "react";
import type { StoreConfig, CampaignConfig } from "@/types/encarte";

interface EncarteHeaderProps {
  pageNumber: number;
  totalPages: number;
  store: StoreConfig;
  campaign: CampaignConfig;
}

export const EncarteHeader: React.FC<EncarteHeaderProps> = ({
  pageNumber,
  totalPages,
  store,
  campaign,
}) => {
  const isFirstPage = pageNumber === 1;
  const primary = store.primaryColor || "#dc2626";
  const accent = store.accentColor || "#facc15";

  if (!isFirstPage) {
    // Cabeçalho compacto para páginas 2, 3, etc.
    return (
      <header className="relative w-full bg-black text-white shrink-0 overflow-hidden shadow-md">
        {/* Faixa decorativa no topo */}
        <div className="h-2 w-full retail-stripes" />

        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {store.logo && (
              <img
                src={store.logo}
                alt=""
                className="h-9 w-9 rounded-md bg-white object-contain p-0.5"
              />
            )}
            <div>
              <span className="font-display text-xl uppercase tracking-wider text-yellow-300">
                {campaign.title || "DETONA PREÇOS"}
              </span>
              <span className="mx-2 text-xs text-neutral-400">·</span>
              <span className="text-xs font-bold uppercase text-neutral-300">
                {store.name}
              </span>
            </div>
          </div>

          <div className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-yellow-300 shadow">
            Página {pageNumber} de {totalPages}
          </div>
        </div>

        {/* Faixa decorativa na base */}
        <div className="h-1.5 w-full retail-stripes" />
      </header>
    );
  }

  // Cabeçalho da Página 1 (ocupa cerca de 25% da página A4)
  return (
    <header className="relative flex flex-col justify-between w-full h-[270px] bg-black text-white shrink-0 overflow-hidden shadow-lg border-b-4 border-yellow-400">
      {/* Faixa diagonal superior amarela e preta */}
      <div className="h-3 w-full retail-stripes shrink-0" />

      {/* Conteúdo central do cabeçalho */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-2 text-center relative z-10">
        {/* Identificação da Loja (Topo) */}
        <div className="flex items-center gap-2 mb-1.5">
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

        {/* Título Principal com Efeito de Volume / 3D Varejo */}
        <div className="relative my-0.5">
          <h1
            className="font-display uppercase tracking-wider leading-[0.9] text-[58px] title-3d-glow"
            style={{ color: accent }}
          >
            {campaign.title || "DETONA PREÇOS"}
          </h1>
        </div>

        {/* Faixa de Subtítulo em Amarelo */}
        <div className="mt-1 inline-block rounded-md bg-yellow-400 px-4 py-1 shadow-md transform -rotate-1">
          <span className="font-display text-lg font-black uppercase tracking-wide text-black">
            {campaign.subtitle || "PRODUTOS COM VALIDADE CURTA!"}
          </span>
        </div>

        {/* Observação em texto menor */}
        {campaign.observation && (
          <p className="mt-2 text-[10px] font-semibold text-neutral-300 max-w-lg leading-tight uppercase tracking-wider">
            {campaign.observation}
          </p>
        )}
      </div>

      {/* Faixa diagonal inferior amarela e preta */}
      <div className="h-3 w-full retail-stripes shrink-0" />
    </header>
  );
};
