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
import { parseSpreadsheetPrices } from "@/lib/encarte-helpers";
import type { EncarteProduct } from "@/types/encarte";
import { FileSpreadsheet, Check, AlertCircle } from "lucide-react";

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
    notFound: string[];
  } | null>(null);

  const handlePreview = () => {
    const parsed = parseSpreadsheetPrices(text);
    const codeMap = new Map(products.map((p) => [p.code.toLowerCase().trim(), p.name]));

    const matches: { code: string; price: string; productName: string }[] = [];
    const notFound: string[] = [];

    for (const item of parsed) {
      const matchName = codeMap.get(item.code.toLowerCase().trim());
      if (matchName) {
        matches.push({ code: item.code, price: item.price, productName: matchName });
      } else {
        notFound.push(item.code);
      }
    }

    setResult({ matches, notFound });
  };

  const handleApply = () => {
    if (!result) handlePreview();
    const parsed = parseSpreadsheetPrices(text);
    if (parsed.length > 0) {
      onApplyPrices(parsed);
      setText("");
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            Preencher Preços em Massa por Planilha
          </DialogTitle>
          <DialogDescription>
            Copie as colunas de <strong>Código</strong> e <strong>Preço</strong> do Excel ou Google Sheets e cole abaixo. Separadores suportados: Tab, ponto e vírgula ou vírgula.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Textarea
            rows={8}
            placeholder={`Exemplo:\n24657\t4,99\n10982\t14,90\n33104\t3,69`}
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
            >
              Analisar dados colados
            </Button>
            <span className="text-xs text-muted-foreground">
              Total de produtos carregados: {products.length}
            </span>
          </div>

          {result && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-green-700">
                <Check className="h-4 w-4" />
                {result.matches.length} produtos correspondentes encontrados para atualizar!
              </div>

              {result.matches.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 pr-2">
                  {result.matches.slice(0, 10).map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-card px-2 py-1 rounded border text-muted-foreground"
                    >
                      <span className="font-mono font-bold text-foreground">
                        {m.code}
                      </span>
                      <span className="truncate max-w-[280px]">
                        {m.productName}
                      </span>
                      <span className="font-bold text-primary">
                        R$ {m.price}
                      </span>
                    </div>
                  ))}
                  {result.matches.length > 10 && (
                    <div className="text-center text-muted-foreground text-[11px] pt-1">
                      ... e mais {result.matches.length - 10} produtos.
                    </div>
                  )}
                </div>
              )}

              {result.notFound.length > 0 && (
                <div className="flex items-start gap-1.5 text-amber-700 pt-1">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {result.notFound.length} códigos não foram encontrados na lista atual ({result.notFound.slice(0, 5).join(", ")}{result.notFound.length > 5 ? "..." : ""}).
                  </span>
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
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            Aplicar Preços
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
