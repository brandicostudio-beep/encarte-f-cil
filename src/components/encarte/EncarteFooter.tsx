import React from "react";
import type { StoreConfig } from "@/types/encarte";
import { MapPin, Phone } from "lucide-react";

interface EncarteFooterProps {
  store: StoreConfig;
}

export const EncarteFooter: React.FC<EncarteFooterProps> = ({ store }) => {
  return (
    <footer className="relative w-full shrink-0 bg-neutral-950 text-white overflow-hidden border-t-2 border-yellow-400">
      {/* Faixa decorativa sutil */}
      <div className="h-1.5 w-full retail-stripes" />

      <div className="px-5 py-2.5 flex items-center justify-between gap-4">
        {/* Logo e Nome da Loja */}
        <div className="flex items-center gap-2.5 min-w-0">
          {store.logo ? (
            <img
              src={store.logo}
              alt=""
              className="h-9 w-9 shrink-0 rounded bg-white object-contain p-0.5 shadow"
            />
          ) : null}
          <div className="truncate">
            <div className="font-display text-sm uppercase leading-none tracking-wider text-yellow-300 truncate">
              {store.name}
            </div>
            <div className="flex items-center gap-2 text-[9px] text-neutral-300 mt-1 truncate">
              {store.address && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 text-yellow-400 shrink-0" />
                  {store.address}
                </span>
              )}
              {store.phone && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Phone className="h-2.5 w-2.5 text-yellow-400 shrink-0" />
                  {store.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nota legal configurável */}
        <div className="text-right text-[8px] font-medium text-neutral-400 max-w-[280px] leading-tight shrink-0 uppercase">
          {store.legalNotice ||
            "Ofertas válidas enquanto durarem os estoques. Imagens meramente ilustrativas."}
        </div>
      </div>
    </footer>
  );
};
