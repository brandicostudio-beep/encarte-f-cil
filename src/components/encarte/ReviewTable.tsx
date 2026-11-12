import React, { useRef } from "react";
import type { EncarteProduct } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import {
  formatPrice,
  deriveSaleUnit,
  SALE_UNITS,
  evaluateStockExpression,
  previewStockCalculation,
} from "@/lib/parse-product";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CalendarX,
  ImageOff,
  Edit3,
  Trash2,
  Package,
  Layers,
  Tag,
  HelpCircle,
} from "lucide-react";

interface ReviewTableProps {
  products: EncarteProduct[];
  onPriceChange: (id: string, price: string) => void;
  onStockChange?: (id: string, stock: string) => void;
  onUnitChange?: (id: string, unit: string) => void;
  onToggleIncluded: (id: string, included: boolean) => void;
  onEditProduct: (product: EncarteProduct) => void;
  onDeleteProduct: (id: string) => void;
}

export const ReviewTable: React.FC<ReviewTableProps> = ({
  products = [],
  onPriceChange,
  onStockChange,
  onUnitChange,
  onToggleIncluded,
  onEditProduct,
  onDeleteProduct,
}) => {
  // Referências para os inputs de preço para navegar com Enter para o próximo pendente
  const priceInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // Referências para os inputs de estoque para navegar com Enter
  const stockInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Tratar formatação de preço com duas casas decimais
  const handlePriceBlur = (id: string, rawVal: string) => {
    const val = String(rawVal || "").trim();
    if (!val) return;
    const formatted = formatPrice(val);
    if (formatted) onPriceChange(id, formatted);
  };

  // Tratar avaliação de estoque (ex: somas como 80+53)
  const handleStockBlur = (id: string, rawVal: string, unit?: string) => {
    const val = String(rawVal || "").trim();
    if (!val) {
      if (onStockChange) onStockChange(id, "");
      return;
    }
    const evaluated = evaluateStockExpression(val, unit);
    if (onStockChange) onStockChange(id, evaluated);
  };

  // Tecla Enter no estoque: salva/avalia e salta automaticamente para o próximo estoque
  const handleStockKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    unit?: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStockBlur(products[currentIndex].id, e.currentTarget.value, unit);

      // Salta para o próximo estoque
      for (let i = currentIndex + 1; i < products.length; i++) {
        const nextProd = products[i];
        const el = stockInputRefs.current.get(nextProd.id);
        if (el) {
          el.focus();
          el.select();
          return;
        }
      }
      // Se não encontrou depois, busca do início
      for (let i = 0; i < currentIndex; i++) {
        const prevProd = products[i];
        const el = stockInputRefs.current.get(prevProd.id);
        if (el) {
          el.focus();
          el.select();
          return;
        }
      }
    }
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
        if (!nextProd?.price || String(nextProd.price).trim() === "") {
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
        if (!prevProd?.price || String(prevProd.price).trim() === "") {
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
                Embalagem
              </th>
              <th scope="col" className="p-3 w-36">
                <div className="flex items-center gap-1">
                  <span>Estoque</span>
                  <span
                    className="text-neutral-400 hover:text-neutral-600 cursor-help"
                    title="Edição rápida de estoque. Você pode digitar valores (ex: 50) ou somas (ex: 80+53) para calcular automaticamente."
                  >
                    <HelpCircle className="h-3 w-3" />
                  </span>
                </div>
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
              const isExpired = isDateExpired(p?.validity || "");
              const hasPrice = Boolean(p?.price && String(p.price).trim() !== "");
              const hasPhoto = Boolean(p?.image && String(p.image).trim() !== "");
              const hasPackaging = Boolean(p?.packaging && String(p.packaging).trim() !== "");
              const unitCheck = deriveSaleUnit(p?.packaging, p?.unit, p?.name, p?.unitConfirmed);

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
              if (!unitCheck.hasUnitWord && !p?.unitConfirmed) {
                issues.push({
                  type: "unit",
                  label: "Sem unidade",
                  className: "bg-blue-100 text-blue-900 border-blue-300 font-semibold",
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

                  {/* Miniatura com Origem */}
                  <td className="p-2 text-center align-middle">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="relative h-11 w-11 rounded-lg border bg-white flex items-center justify-center overflow-hidden group cursor-pointer hover:border-red-400"
                        onClick={() => onEditProduct(p)}
                        title={
                          p.image
                            ? `Clique para editar foto e proporção (${Math.round((p.imageScale || 1.0) * 100)}%)`
                            : "Clique para adicionar foto"
                        }
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            style={{
                              transform: `scale(${p.imageScale || 1.0})`,
                              transformOrigin: "center center",
                            }}
                            className="h-full w-full object-contain p-0.5 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-neutral-400" />
                        )}
                        {p.imageScale && p.imageScale !== 1.0 && (
                          <span className="absolute bottom-0 right-0 bg-neutral-900/80 text-[8px] font-mono font-bold text-white px-0.5 rounded-tl leading-none">
                            {Math.round(p.imageScale * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Selo de Origem da Foto (Drive, ZIP, Upload) */}
                      {p.photoSource && (
                        <span
                          className={`text-[8.5px] font-black px-1 py-0.2 rounded border uppercase tracking-tight leading-none ${
                            p.photoSource === "drive"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : p.photoSource === "zip"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : p.photoSource === "folder"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : p.photoSource === "upload"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                          }`}
                        >
                          {p.photoSource === "drive"
                            ? "Drive"
                            : p.photoSource === "zip"
                            ? "ZIP"
                            : p.photoSource === "folder"
                            ? "Pasta"
                            : p.photoSource === "upload"
                            ? "Upload"
                            : p.photoSource}
                        </span>
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

                      {/* Foto Ambígua (Mais de uma imagem encontrada no Drive ou ZIP) */}
                      {p.alternativePhotos && p.alternativePhotos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onEditProduct(p)}
                          className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
                          title={`${p.alternativePhotos.length} foto(s) alternativa(s) encontrada(s) no Drive/ZIP. Clique para escolher.`}
                        >
                          <Layers className="h-3 w-3 text-indigo-600" />
                          <span>Ambígua (+{p.alternativePhotos.length} fotos)</span>
                        </button>
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
                          {iss.type === "unit" && (
                            <Tag className="h-3 w-3" />
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

                  {/* Embalagem */}
                  <td className="p-3 align-middle">
                    <div className="text-neutral-700 font-semibold truncate text-xs" title={p.packaging || ""}>
                      {p.packaging || (
                        <span className="text-neutral-400 italic font-normal text-[11px]">
                          Não informada
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Edição Rápida de Estoque (como é o de preço) */}
                  <td className="p-3 align-middle">
                    <div className="relative">
                      <label htmlFor={`stock-${p.id}`} className="sr-only">
                        Estoque para {p.name}
                      </label>
                      <input
                        id={`stock-${p.id}`}
                        ref={(el) => {
                          if (el) stockInputRefs.current.set(p.id, el);
                          else stockInputRefs.current.delete(p.id);
                        }}
                        type="text"
                        placeholder="Ex: 50"
                        value={p.stock || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (onStockChange) {
                            onStockChange(p.id, val);
                          } else {
                            onEditProduct({ ...p, stock: val });
                          }
                        }}
                        onBlur={(e) => handleStockBlur(p.id, e.target.value, p.unit)}
                        onKeyDown={(e) => handleStockKeyDown(e, idx, p.unit)}
                        className="w-full min-h-[44px] px-2.5 text-xs font-mono font-bold rounded-lg border border-neutral-300 bg-white text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-colors placeholder:text-neutral-400 placeholder:font-normal"
                        title="Digite a quantidade ou somas (ex: 80+53)"
                      />
                      {previewStockCalculation(p.stock, p.unit) && (
                        <div className="absolute -bottom-2 right-1 z-10 pointer-events-none">
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shadow-2xs">
                            ={previewStockCalculation(p.stock, p.unit)}
                          </span>
                        </div>
                      )}
                    </div>
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
                        value={p.price || ""}
                        onChange={(e) => onPriceChange(p.id, e.target.value)}
                        onBlur={(e) => handlePriceBlur(p.id, e.target.value)}
                        onKeyDown={(e) => handlePriceKeyDown(e, idx)}
                        className={`w-full min-h-[44px] pl-8 pr-16 text-xs font-mono font-bold rounded-lg border transition-colors focus:outline-hidden focus:ring-2 ${
                          !hasPrice
                            ? "bg-amber-50/80 border-amber-400 text-amber-950 placeholder:text-amber-500 focus:ring-amber-500"
                            : "bg-white border-neutral-300 text-neutral-900 focus:ring-red-600 focus:border-red-600"
                        }`}
                      />
                      <select
                        aria-label={`Unidade de venda para ${p.name}`}
                        value={unitCheck.unit}
                        onChange={(e) => {
                          const newU = e.target.value;
                          if (onUnitChange) {
                            onUnitChange(p.id, newU);
                          } else {
                            onEditProduct({ ...p, unit: newU, unitConfirmed: true });
                          }
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[10px] text-neutral-800 uppercase bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded px-1.5 py-1 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-red-600 transition-colors shadow-2xs"
                        title="Alterar unidade de medida (UND, CX, PCT, FD, DISP)"
                      >
                        {SALE_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
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
