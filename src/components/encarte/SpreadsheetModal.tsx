import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseSpreadsheetPrices, type ParsedSpreadsheetItem } from "@/lib/encarte-helpers";
import type { EncarteProduct } from "@/types/encarte";
import { FileSpreadsheet, Check, AlertCircle, Info, ShieldCheck } from "lucide-react";

interface SpreadsheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: EncarteProduct[];
  onApplyPrices: (updates: { code: string; price: string }[]) => void;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  open,
  onOpenChange,
  products,
  onApplyPrices,
}) => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    matches: { code: string; price: string; productName: string }[];
    notFound: { code: string; price: string; productName?: string }[];
    totalParsed: number;
  } | null>(null);

  const handlePreview = () => {
    const parsed = parseSpreadsheetPrices(text);
    const codeMap = new Map((products || []).map((p) => [String(p?.code || "").toLowerCase().trim(), p?.name || ""]));

    const matches: { code: string; price: string; productName: string }[] = [];
    const notFound: { code: string; price: string; productName?: string }[] = [];

    for (const item of parsed) {
      const matchName = codeMap.get(String(item?.code || "").toLowerCase().trim());
      if (matchName) {
        matches.push({ code: item.code, price: item.price, productName: matchName });
      } else {
        notFound.push({ code: item.code, price: item.price, productName: item.productName });
      }
    }

    setResult({ matches, notFound, totalParsed: parsed.length });
  };

  const handleApply = () => {
    const parsed = parseSpreadsheetPrices(text);
    const codeMap = new Map((products || []).map((p) => [String(p?.code || "").toLowerCase().trim(), true]));
    const matchingUpdates = parsed.filter((item) => codeMap.has(String(item.code || "").toLowerCase().trim()));

    if (matchingUpdates.length > 0) {
      onApplyPrices(matchingUpdates);
      setText("");
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            Colar Tabela de Preços / Texto Cescom
          </DialogTitle>
          <DialogDescription>
            Cole colunas de <strong>Código</strong> e <strong>Preço</strong> do Excel ou copie e cole diretamente os blocos de produtos do site da <strong>Cescom</strong>. Os preços da primeira embalagem são lidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            rows={8}
            placeholder={`Exemplos aceitos:\n1) Copiado do site da Cescom:\nFRALDA PERSONAL MEGA\nCódigo: 23396\n(PACOTE 1) 1X24 UNID - R$ 23,26\n\n2) Planilha (Tab ou ponto-e-vírgula):\n23396\t23,26\n19559\t6,75\n20609\t5,99`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            className="font-mono text-xs"
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={!text.trim()}
              className="font-semibold"
            >
              Analisar dados colados
            </Button>
            <span className="text-xs text-muted-foreground">
              Total de produtos carregados no encarte: {products.length}
            </span>
          </div>

          {result && result.totalParsed === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Nenhum código e preço identificado no texto colado.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Verifique se o texto copiado inclui códigos numéricos de produto e seus respectivos preços (ex: formato do site Cescom ou colunas de planilha).
                </p>
              </div>
            </div>
          )}

          {result && result.totalParsed > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3 text-xs">
              {/* Produtos correspondentes para atualizar */}
              <div>
                <div className="flex items-center justify-between font-semibold text-green-700 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4" />
                    {result.matches.length} produtos correspondentes encontrados no encarte
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Preços prontos para aplicar
                  </span>
                </div>

                {result.matches.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border rounded-md p-1.5 bg-background">
                    {result.matches.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-card px-2 py-1 rounded border border-neutral-100 text-muted-foreground hover:bg-neutral-50"
                      >
                        <span className="font-mono font-bold text-foreground">
                          {m.code}
                        </span>
                        <span className="truncate max-w-[280px] font-medium text-neutral-800">
                          {m.productName}
                        </span>
                        <span className="font-bold text-emerald-600 font-mono">
                          R$ {m.price}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Nenhum dos códigos colados coincide com os produtos carregados nesta campanha.
                  </p>
                )}
              </div>

              {/* Produtos e códigos sem correspondência no encarte (separados) */}
              {result.notFound.length > 0 && (
                <div className="border-t pt-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 text-xs">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      {result.notFound.length} códigos do texto não pertencem a este encarte (separados):
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border rounded-md p-1.5 bg-amber-50/40 border-amber-200">
                    {result.notFound.map((nf, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded bg-white border border-amber-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-900">{nf.code}</span>
                          {nf.productName && (
                            <span className="text-neutral-500 truncate max-w-[200px]">{nf.productName}</span>
                          )}
                        </div>
                        <span className="text-neutral-600 font-mono">R$ {nf.price}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-700 italic">
                    Estes itens não serão adicionados nem afetarão o encarte atual.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!text.trim() || (result ? result.matches.length === 0 : false)}
            className="bg-green-700 hover:bg-green-800 text-white font-bold"
          >
            Aplicar Preços
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
