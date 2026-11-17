import React, { useState, useEffect } from "react";
import { Package } from "lucide-react";

export interface PainelValidadeProductImageProps {
  src?: string;
  alt: string;
  codprod?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PainelValidadeProductImage: React.FC<PainelValidadeProductImageProps> = ({
  src,
  alt,
  codprod,
  className = "",
  size = "md",
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const sizeContainerClasses = {
    sm: "w-12 h-12 min-w-12 min-h-12",
    md: "w-16 h-16 sm:w-20 sm:h-20 min-w-16 min-h-16 sm:min-w-20 sm:min-h-20",
    lg: "w-20 h-20 sm:w-24 sm:h-24 min-w-20 min-h-20 sm:min-w-24 sm:min-h-24",
  }[size];

  if (!src || hasError) {
    return (
      <div
        className={`relative ${sizeContainerClasses} rounded-xl bg-neutral-100/90 border border-neutral-200 flex flex-col items-center justify-center p-1.5 shrink-0 select-none text-neutral-400 shadow-2xs ${className}`}
        title={codprod ? `Produto ${codprod} (Sem foto)` : alt}
        aria-label={alt}
      >
        <Package className="h-6 w-6 sm:h-7 sm:w-7 text-neutral-400 stroke-[1.5]" />
        {codprod && (
          <span className="text-[9px] font-mono font-bold text-neutral-400 mt-0.5 truncate max-w-full leading-none">
            {codprod}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative ${sizeContainerClasses} rounded-xl bg-white border border-neutral-200/90 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs group-hover:border-neutral-300 transition-all ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        onLoad={() => setIsLoaded(true)}
        className={`max-h-full max-w-full object-contain transition-all duration-200 group-hover:scale-105 ${
          isLoaded ? "opacity-100" : "opacity-80"
        }`}
      />
    </div>
  );
};
