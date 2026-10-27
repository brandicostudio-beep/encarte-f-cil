import React from "react";
import type { EncarteProduct } from "@/types/encarte";
import { isDateExpired } from "@/lib/encarte-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ImageOff,
  DollarSign,
  CalendarX,
  FileQuestion,
  FileSpreadsheet,
  Edit3,
  Layers,
} from "lucide-react";

interface PendingIssuesPanelProps {
  products: EncarteProduct[];
  unmatchedPhotos: string[];
  onOpenSpreadsheetModal: () => void;
  onEditProduct: (product: EncarteProduct) => void;
  onFilterChange: (filter: "all" | "priced" | "unpriced" | "excluded" | "expired" | "ambiguous_photo" | "missing_photo") => void;
}

export const PendingIssuesPanel: React.FC<PendingIssuesPanelProps> = ({
  products = [],
  unmatchedPhotos = [],
  onOpenSpreadsheetModal,
  onEditProduct,
  onFilterChange,
}) => {
  const safeProducts = products || [];

  // 1. Produtos sem preço (deixam o produto fora do encarte até ser resolvido)
  const unpricedProducts = safeProducts.filter((p) => !p?.price || String(p.price).trim() === "");

  // 2. Produtos sem foto (usam placeholder neutro)
  const missingPhotoProducts = safeProducts.filter((p) => !p?.image || String(p.image).trim() === "");

  // 3. Produtos com fotos ambíguas (múltiplas fotos no Drive ou ZIP)
  const ambiguousPhotoProducts = safeProducts.filter(
    (p) => Boolean(p?.alternativePhotos && p.alternativePhotos.length > 0)
  );

  // 4. Produtos com validade vencida
  const expiredProducts = safeProducts.filter((p) => isDateExpired(p?.validity || ""));

  const totalIssues = unpricedProducts.length + expiredProducts.length;

  if (safeProducts.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`h-5 w-5 ${
              totalIssues > 0 ? "text-amber-600" : "text-green-600"
            }`}
          />
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Painel de Pendências
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de preços, fotos e validades dos produtos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {unpricedProducts.length > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
              {unpricedProducts.length} sem preço
            </Badge>
          )}
          {missingPhotoProducts.length > 0 && (
            <Badge variant="outline" className="text-xs bg-neutral-100 text-neutral-700">
              {missingPhotoProducts.length} sem foto
            </Badge>
          )}
          {ambiguousPhotoProducts.length > 0 && (
            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-300">
              {ambiguousPhotoProducts.length} fotos ambíguas
            </Badge>
          )}
          {expiredProducts.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {expiredProducts.length} vencidos
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Sem Preço (Crítico - Fora do Encarte) */}
        <div
          className={`rounded-lg p-3 border text-xs transition-colors ${
            unpricedProducts.length > 0
              ? "bg-amber-50/60 border-amber-200"
              : "bg-green-50/40 border-green-200 text-green-800"
          }`}
        >
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5 text-amber-900">
              <DollarSign className="h-4 w-4 text-amber-600" />
              Preços Pendentes ({unpricedProducts.length})
            </span>
          </div>

          <p className="text-[11px] text-neutral-600 leading-tight mb-2">
            {unpricedProducts.length > 0
              ? "Estes itens ficam fora do encarte até receberem preço de venda."
              : "Todos os produtos estão com preço preenchido!"}
          </p>

          {unpricedProducts.length > 0 && (
            <div className="space-y-1.5">
              <div className="max-h-20 overflow-y-auto space-y-1 pr-1 font-mono text-[10.5px]">
                {unpricedProducts.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onEditProduct(p)}
                    className="cursor-pointer flex items-center justify-between bg-white px-2 py-0.5 rounded border border-amber-200 hover:border-amber-400"
                  >
                    <span className="font-bold text-amber-900 truncate max-w-[140px]">
                      {p.code} - {p.name}
                    </span>
                    <Edit3 className="h-3 w-3 text-muted-foreground" />
                  </div>
                ))}
                {unpricedProducts.length > 3 && (
                  <div className="text-[10px] text-neutral-500 text-center">
                    + {unpricedProducts.length - 3} itens sem preço
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenSpreadsheetModal}
                  className="h-7 text-[11px] bg-white border-amber-300 text-amber-900 hover:bg-amber-100 w-full"
                >
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  Preencher em massa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onFilterChange("unpriced")}
                  className="h-7 text-[11px] px-2"
                >
                  Filtrar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Sem Foto (Usa Placeholder) */}
        <div className="rounded-lg p-3 border bg-neutral-50/60 border-neutral-200 text-xs">
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5 text-neutral-800">
              <ImageOff className="h-4 w-4 text-neutral-500" />
              Fotos Ausentes ({missingPhotoProducts.length})
            </span>
          </div>

          <p className="text-[11px] text-neutral-600 leading-tight mb-2">
            {missingPhotoProducts.length > 0
              ? "Exibindo placeholder neutro com nome no encarte, sem quebrar o layout."
              : "Todos os produtos possuem imagem cadastrada!"}
          </p>

          {missingPhotoProducts.length > 0 && (
            <div className="max-h-20 overflow-y-auto space-y-1 pr-1 font-mono text-[10.5px]">
              {missingPhotoProducts.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onEditProduct(p)}
                  className="cursor-pointer flex items-center justify-between bg-white px-2 py-0.5 rounded border hover:border-neutral-400"
                >
                  <span className="truncate max-w-[150px] text-neutral-700">
                    {p.code} - {p.name}
                  </span>
                  <Edit3 className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
              {missingPhotoProducts.length > 3 && (
                <div className="text-[10px] text-neutral-500 text-center">
                  + {missingPhotoProducts.length - 3} itens sem foto
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 3: Validade Vencida */}
        <div
          className={`rounded-lg p-3 border text-xs transition-colors ${
            expiredProducts.length > 0
              ? "bg-red-50/60 border-red-200"
              : "bg-green-50/40 border-green-200 text-green-800"
          }`}
        >
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5 text-red-900">
              <CalendarX className="h-4 w-4 text-red-600" />
              Validade Vencida ({expiredProducts.length})
            </span>
          </div>

          <p className="text-[11px] text-neutral-600 leading-tight mb-2">
            {expiredProducts.length > 0
              ? "Gera confirmação obrigatória antes de exportar o PDF ou JPG."
              : "Nenhum produto está com a data de validade vencida."}
          </p>

          {expiredProducts.length > 0 && (
            <div className="max-h-20 overflow-y-auto space-y-1 pr-1 font-mono text-[10.5px]">
              {expiredProducts.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onEditProduct(p)}
                  className="cursor-pointer flex items-center justify-between bg-white px-2 py-0.5 rounded border border-red-200 hover:border-red-400"
                >
                  <span className="truncate max-w-[130px] font-bold text-red-900">
                    {p.code} - {p.name}
                  </span>
                  <span className="text-red-600 font-bold">{p.validity}</span>
                </div>
              ))}
              {expiredProducts.length > 3 && (
                <div className="text-[10px] text-neutral-500 text-center">
                  + {expiredProducts.length - 3} itens vencidos
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Fotos Ambíguas (Múltiplas opções no Drive / ZIP) */}
      {ambiguousPhotoProducts.length > 0 && (
        <div className="rounded-lg bg-indigo-50/80 border border-indigo-200 p-3 text-xs text-indigo-950 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900">
              <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                {ambiguousPhotoProducts.length} produto(s) com fotos ambíguas (mais de uma imagem encontrada no Drive ou ZIP):
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFilterChange("ambiguous_photo")}
              className="h-6 text-[10.5px] bg-white border-indigo-200 text-indigo-800 hover:bg-indigo-100"
            >
              Filtrar na tabela
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-0.5">
            {ambiguousPhotoProducts.slice(0, 6).map((p) => (
              <div
                key={p.id}
                onClick={() => onEditProduct(p)}
                className="cursor-pointer flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-400 hover:shadow-2xs transition-all"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-mono font-bold text-[11px] text-indigo-950 truncate">
                    {p.code} - {p.name}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-semibold">
                    +{p.alternativePhotos?.length || 1} alternativa(s)
                  </div>
                </div>
                <Edit3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de Fotos sem Correspondência no Banco de Fotos */}
      {unmatchedPhotos.length > 0 && (
        <div className="rounded-lg bg-amber-50/80 border border-amber-300 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <FileQuestion className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>
              <strong>{unmatchedPhotos.length} fotos do banco de fotos não correspondem a nenhum produto da lista:</strong>
            </div>
            <div className="flex flex-wrap gap-1 font-mono text-[10px] text-neutral-700">
              {unmatchedPhotos.slice(0, 10).map((name, i) => (
                <span
                  key={i}
                  className="bg-white/90 border border-amber-200 px-1.5 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
              {unmatchedPhotos.length > 10 && (
                <span className="text-muted-foreground self-center">
                  e mais {unmatchedPhotos.length - 10}...
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
