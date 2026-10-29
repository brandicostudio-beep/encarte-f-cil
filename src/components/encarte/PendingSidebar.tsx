import React from "react";
import type { EncarteProduct } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { deriveSaleUnit } from "@/lib/parse-product";
import {
  DollarSign,
  ImageOff,
  CalendarX,
  CheckCircle2,
  Filter,
  FileQuestion,
  FileSpreadsheet,
  Package,
  Layers,
  Tag,
} from "lucide-react";

export type IssueFilter =
  | "all"
  | "unpriced"
  | "missing_photo"
  | "ambiguous_photo"
  | "missing_packaging"
  | "missing_unit"
  | "expired"
  | "excluded";

interface PendingSidebarProps {
  products: EncarteProduct[];
  unmatchedPhotos: string[];
  activeFilter: IssueFilter;
  onFilterChange: (filter: IssueFilter) => void;
  onOpenSpreadsheetModal: () => void;
}

export const PendingSidebar: React.FC<PendingSidebarProps> = ({
  products = [],
  unmatchedPhotos = [],
  activeFilter,
  onFilterChange,
  onOpenSpreadsheetModal,
}) => {
  const safeProducts = products || [];
  const total = safeProducts.length;
  const unpriced = safeProducts.filter((p) => !p?.price || String(p.price).trim() === "");
  const missingPhoto = safeProducts.filter((p) => !p?.image || String(p.image).trim() === "");
  const ambiguousPhoto = safeProducts.filter((p) => Boolean(p?.alternativePhotos && p.alternativePhotos.length > 0));
  const missingPackaging = safeProducts.filter((p) => !p?.packaging || String(p.packaging).trim() === "");
  const missingUnit = safeProducts.filter((p) => !p?.unitConfirmed && !deriveSaleUnit(p?.packaging, p?.unit, p?.name).hasUnitWord);
  const expired = safeProducts.filter((p) => isDateExpired(p?.validity || ""));
  const excluded = safeProducts.filter((p) => !p?.included);

  const isReadyToExport =
    total > 0 && unpriced.length === 0 && expired.length === 0;

  return (
    <aside
      aria-label="Painel de Pendências"
      className="rounded-xl border bg-white p-4 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
            Painel de Pendências
          </h2>
          <p className="text-[11px] text-neutral-500">
            Clique no contador para filtrar a tabela.
          </p>
        </div>

        {isReadyToExport ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10.5px] font-bold text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            100% Pronto
          </span>
        ) : (
          <span className="text-[11px] font-mono font-bold text-neutral-500">
            {total} itens
          </span>
        )}
      </div>

      {/* Lista de Contadores Clicáveis (min-h 44px para toque acessível) */}
      <div className="space-y-1.5" role="group" aria-label="Filtros de pendências">
        {/* 1. Todos os Produtos */}
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-red-600 ${
            activeFilter === "all"
              ? "bg-neutral-900 text-white font-bold border-neutral-900 shadow-xs"
              : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Todos os produtos
          </span>
          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/10 text-[11px]">
            {total}
          </span>
        </button>

        {/* 2. Sem Preço (Crítico - Fora do Encarte) */}
        <button
          type="button"
          onClick={() => onFilterChange("unpriced")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-amber-600 ${
            activeFilter === "unpriced"
              ? "bg-amber-600 text-white font-bold border-amber-600 shadow-xs"
              : unpriced.length > 0
              ? "bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300 font-semibold"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            <span>Sem preço</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              unpriced.length > 0
                ? activeFilter === "unpriced"
                  ? "bg-white/20 text-white"
                  : "bg-amber-200 text-amber-900"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {unpriced.length}
          </span>
        </button>

        {/* 3. Sem Foto (Placeholder neutro) */}
        <button
          type="button"
          onClick={() => onFilterChange("missing_photo")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-neutral-600 ${
            activeFilter === "missing_photo"
              ? "bg-neutral-800 text-white font-bold border-neutral-800 shadow-xs"
              : missingPhoto.length > 0
              ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border-neutral-300"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <ImageOff className="h-4 w-4 text-neutral-500" />
            <span>Sem foto</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              activeFilter === "missing_photo"
                ? "bg-white/20 text-white"
                : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {missingPhoto.length}
          </span>
        </button>

        {/* 3.1 Fotos Ambíguas (Múltiplas opções no Drive/ZIP) */}
        <button
          type="button"
          onClick={() => onFilterChange("ambiguous_photo")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-indigo-600 ${
            activeFilter === "ambiguous_photo"
              ? "bg-indigo-700 text-white font-bold border-indigo-700 shadow-xs"
              : ambiguousPhoto.length > 0
              ? "bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-300 font-semibold"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>Fotos ambíguas</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              ambiguousPhoto.length > 0
                ? activeFilter === "ambiguous_photo"
                  ? "bg-white/20 text-white"
                  : "bg-indigo-200 text-indigo-950"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {ambiguousPhoto.length}
          </span>
        </button>

        {/* 4. Embalagem Não Identificada */}
        <button
          type="button"
          onClick={() => onFilterChange("missing_packaging")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-orange-600 ${
            activeFilter === "missing_packaging"
              ? "bg-orange-600 text-white font-bold border-orange-600 shadow-xs"
              : missingPackaging.length > 0
              ? "bg-orange-50 text-orange-900 hover:bg-orange-100 border-orange-300 font-semibold"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            <span>Sem embalagem</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              missingPackaging.length > 0
                ? activeFilter === "missing_packaging"
                  ? "bg-white/20 text-white"
                  : "bg-orange-200 text-orange-900"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {missingPackaging.length}
          </span>
        </button>

        {/* 5. Sem Unidade de Venda Identificada */}
        <button
          type="button"
          onClick={() => onFilterChange("missing_unit")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-blue-600 ${
            activeFilter === "missing_unit"
              ? "bg-blue-600 text-white font-bold border-blue-600 shadow-xs"
              : missingUnit.length > 0
              ? "bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-300 font-semibold"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-500" />
            <span>Sem unidade</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              missingUnit.length > 0
                ? activeFilter === "missing_unit"
                  ? "bg-white/20 text-white"
                  : "bg-blue-200 text-blue-900"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {missingUnit.length}
          </span>
        </button>

        {/* 5. Vencidos */}
        <button
          type="button"
          onClick={() => onFilterChange("expired")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-red-600 ${
            activeFilter === "expired"
              ? "bg-red-600 text-white font-bold border-red-600 shadow-xs"
              : expired.length > 0
              ? "bg-red-50 text-red-900 hover:bg-red-100 border-red-300 font-bold"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <CalendarX className="h-4 w-4 text-red-500" />
            <span>Validade vencida</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              expired.length > 0
                ? activeFilter === "expired"
                  ? "bg-white/20 text-white"
                  : "bg-red-200 text-red-900"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {expired.length}
          </span>
        </button>

        {/* 6. Desmarcados (Fora do encarte) */}
        <button
          type="button"
          onClick={() => onFilterChange("excluded")}
          className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors border text-left focus-visible:ring-2 focus-visible:ring-neutral-600 ${
            activeFilter === "excluded"
              ? "bg-neutral-700 text-white font-bold border-neutral-700 shadow-xs"
              : excluded.length > 0
              ? "bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border-neutral-200"
              : "bg-neutral-50 text-neutral-400 border-neutral-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-neutral-400" />
            <span>Desmarcados</span>
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              excluded.length > 0
                ? activeFilter === "excluded"
                  ? "bg-white/20 text-white"
                  : "bg-neutral-200 text-neutral-700"
                : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {excluded.length}
          </span>
        </button>
      </div>

      {/* Ação Rápida: Colar Preços em Massa */}
      {unpriced.length > 0 && (
        <div className="pt-2 border-t space-y-2">
          <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <strong>Atenção:</strong> Produtos sem preço ficam fora do encarte. Preencha na tabela ou cole em lote.
          </div>
          <button
            type="button"
            onClick={onOpenSpreadsheetModal}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Colar Planilha com Preços
          </button>
        </div>
      )}

      {/* Alerta de Fotos Sem Produto */}
      {unmatchedPhotos.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-[11px] text-neutral-600 bg-neutral-100 p-2.5 rounded-lg border border-neutral-200">
            <strong>Fotos sem produto ({unmatchedPhotos.length}):</strong>
            <p className="mt-1 line-clamp-2 font-mono text-[10px] text-neutral-500">
              {unmatchedPhotos.join(", ")}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
