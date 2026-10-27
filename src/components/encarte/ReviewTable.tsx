import React, { useRef } from "react";
import type { EncarteProduct } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { formatPrice } from "@/lib/parse-product";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CalendarX,
  ImageOff,
  Edit3,
  Trash2,
  Package,
} from "lucide-react";

interface ReviewTableProps {
  products: EncarteProduct[];
  onPriceChange: (id: string, price: string) => void;
  onToggleIncluded: (id: string, included: boolean) => void;
  onEditProduct: (product: EncarteProduct) => void;
  onDeleteProduct: (id: string) => void;
}

export const ReviewTable: React.FC<ReviewTableProps> = ({
  products,
  onPriceChange,
  onToggleIncluded,
  onEditProduct,
  onDeleteProduct,
}) => {
  // Referências para os inputs de preço para navegar com Enter para o próximo pendente
  const priceInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Tratar formatação de preço com duas casas decimais
  const handlePriceBlur = (id: string, rawVal: string) => {
    if (!rawVal.trim()) return;
    const formatted = formatPrice(rawVal);
    if (formatted) onPriceChange(id, formatted);
  };

  // Tecla Enter no preço: salva e salta automaticamente para o próximo produto sem preço
  const handlePriceKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Procurar próximo produto sem preço a partir do índice atual
      for (let i = currentIndex + 1; i < products.length; i++) {
        const nextProd = products[i];
        if (!nextProd.price || nextProd.price.trim() === "") {
          const el = priceInputRefs.current.get(nextProd.id);
          if (el) {
            el.focus();
            el.select();
            return;
          }
        }
      }
      // Se não encontrou depois, busca do início
      for (let i = 0; i < currentIndex; i++) {
        const prevProd = products[i];
        if (!prevProd.price || prevProd.price.trim() === "") {
          const el = priceInputRefs.current.get(prevProd.id);
          if (el) {
            el.focus();
            el.select();
            return;
          }
        }
      }
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-xs border-collapse"
          role="grid"
          aria-label="Tabela de revisão e precificação de produtos"
        >
          <thead className="bg-neutral-100/80 text-neutral-700 font-bold uppercase tracking-wider border-b select-none">
            <tr>
              <th scope="col" className="p-3 w-12 text-center">
                <span className="sr-only">Ativo no encarte</span>
                Ativo
              </th>
              <th scope="col" className="p-3 w-16 text-center">
                Foto
              </th>
              <th scope="col" className="p-3">
                Código & Nome
              </th>
              <th scope="col" className="p-3 w-28">
                Embalagem / Estoque
              </th>
              <th scope="col" className="p-3 w-28">
                Validade
              </th>
              <th scope="col" className="p-3 w-36">
                Preço de Venda (R$)
              </th>
              <th scope="col" className="p-3 w-20 text-center">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-200">
            {products.map((p, idx) => {
              const isExpired = isDateExpired(p.validity);
              const hasPrice = Boolean(p.price && p.price.trim() !== "");
              const hasPhoto = Boolean(p.image && p.image.trim() !== "");
              const hasPackaging = Boolean(p.packaging && p.packaging.trim() !== "");

              // Diagnóstico de pendências com cor E texto explícito (Acessibilidade)
              const issues: { type: string; label: string; className: string }[] = [];
              if (!hasPrice) {
                issues.push({
                  type: "price",
                  label: "Sem preço",
                  className: "bg-amber-100 text-amber-900 border-amber-300",
                });
              }
              if (!hasPhoto) {
                issues.push({
                  type: "photo",
                  label: "Sem foto",
                  className: "bg-neutral-100 text-neutral-800 border-neutral-300",
                });
              }
              if (!hasPackaging) {
                issues.push({
                  type: "packaging",
                  label: "Sem embalagem",
                  className: "bg-orange-100 text-orange-900 border-orange-300",
                });
              }
              if (isExpired) {
                issues.push({
                  type: "expired",
                  label: "Vencido",
                  className: "bg-red-100 text-red-900 border-red-300 font-bold",
                });
              }

              return (
                <tr
                  key={p.id}
                  className={`transition-colors hover:bg-neutral-50/90 ${
                    !p.included
                      ? "opacity-60 bg-neutral-100/40"
                      : !hasPrice
                      ? "bg-amber-50/30"
                      : isExpired
                      ? "bg-red-50/20"
                      : ""
                  }`}
                >
                  {/* Checkbox Ativo (Área mínima de toque de 44px) */}
                  <td className="p-2 text-center align-middle">
                    <div className="flex items-center justify-center min-h-[44px] min-w-[44px]">
                      <Checkbox
                        id={`check-${p.id}`}
                        checked={p.included}
                        onCheckedChange={(val) =>
                          onToggleIncluded(p.id, Boolean(val))
                        }
                        aria-label={`Incluir ${p.name} no encarte`}
                        className="h-4 w-4"
                      />
                    </div>
                  </td>

                  {/* Miniatura */}
                  <td className="p-2 text-center align-middle">
                    <div className="h-11 w-11 mx-auto rounded-lg border bg-white flex items-center justify-center overflow-hidden shadow-2xs">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="h-full w-full object-contain p-0.5"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-neutral-400" />
                      )}
                    </div>
                  </td>

                  {/* Código e Nome */}
                  <td className="p-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-mono font-bold text-red-700 bg-red-50 px-1 rounded text-[11px] border border-red-200">
                        {p.code}
                      </span>

                      {/* Selo Opcional */}
                      {p.badge && p.badge !== "nenhum" && (
                        <Badge className="text-[9.5px] px-1.5 py-0 uppercase bg-yellow-400 text-black font-black border border-black/10">
                          {p.badge.toUpperCase()}
                        </Badge>
                      )}

                      {/* Marcadores de Pendência com Ícone e Texto Explicativo (Cor nunca é o único sinal) */}
                      {issues.map((iss, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded border text-[9.5px] ${iss.className}`}
                        >
                          {iss.type === "price" && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {iss.type === "photo" && (
                            <ImageOff className="h-3 w-3" />
                          )}
                          {iss.type === "packaging" && (
                            <Package className="h-3 w-3" />
                          )}
                          {iss.type === "expired" && (
                            <CalendarX className="h-3 w-3" />
                          )}
                          <span>{iss.label}</span>
                        </span>
                      ))}
                    </div>

                    <div className="font-bold text-neutral-900 uppercase text-xs tracking-tight line-clamp-2">
                      {p.name}
                    </div>
                  </td>

                  {/* Embalagem e Estoque */}
                  <td className="p-3 align-middle">
                    <div className="text-neutral-700 font-semibold truncate">
                      {p.packaging || (
                        <span className="text-neutral-400 italic font-normal text-[11px]">
                          Não informada
                        </span>
                      )}
                    </div>
                    {p.stock && (
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        Estoque: {p.stock}
                      </div>
                    )}
                  </td>

                  {/* Validade */}
                  <td className="p-3 align-middle font-mono">
                    <span
                      className={`font-semibold ${
                        isExpired
                          ? "text-red-700 font-bold bg-red-50 px-1 py-0.5 rounded border border-red-200 inline-block"
                          : "text-neutral-700"
                      }`}
                    >
                      {p.validity || "--/--/----"}
                    </span>
                  </td>

                  {/* Entrada de Preço com Rótulo e Navegação Enter */}
                  <td className="p-3 align-middle">
                    <div className="relative">
                      <label htmlFor={`price-${p.id}`} className="sr-only">
                        Preço de venda para {p.name}
                      </label>
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-neutral-500 pointer-events-none">
                        R$
                      </span>
                      <input
                        id={`price-${p.id}`}
                        ref={(el) => {
                          if (el) priceInputRefs.current.set(p.id, el);
                          else priceInputRefs.current.delete(p.id);
                        }}
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={p.price}
                        onChange={(e) => onPriceChange(p.id, e.target.value)}
                        onBlur={(e) => handlePriceBlur(p.id, e.target.value)}
                        onKeyDown={(e) => handlePriceKeyDown(e, idx)}
                        className={`w-full min-h-[44px] pl-8 pr-2 text-xs font-mono font-bold rounded-lg border transition-colors focus:outline-hidden focus:ring-2 ${
                          !hasPrice
                            ? "bg-amber-50/80 border-amber-400 text-amber-950 placeholder:text-amber-500 focus:ring-amber-500"
                            : "bg-white border-neutral-300 text-neutral-900 focus:ring-red-600 focus:border-red-600"
                        }`}
                      />
                    </div>
                  </td>

                  {/* Ações (Toque mínimo 44px) */}
                  <td className="p-2 text-center align-middle">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditProduct(p)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-600"
                        title="Editar produto"
                        aria-label={`Editar ${p.name}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProduct(p.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-700 hover:bg-red-50 transition-colors focus-visible:ring-2 focus-visible:ring-red-600"
                        title="Remover produto"
                        aria-label={`Remover ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
