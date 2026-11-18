import React, { useState, useEffect } from "react";
import type { EncarteSemanalGridConfig } from "@/types/encarte-semanal";
import { DEFAULT_ENCARTE_SEMANAL_GRID } from "@/types/encarte-semanal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, RotateCcw, Check } from "lucide-react";
import { saveEncarteSemanalGridConfig } from "@/lib/encarte-semanal-storage";

interface EncarteSemanalGridConfigModalProps {
  gridConfig: EncarteSemanalGridConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: EncarteSemanalGridConfig) => void;
}

export const EncarteSemanalGridConfigModal: React.FC<EncarteSemanalGridConfigModalProps> = ({
  gridConfig,
  open,
  onOpenChange,
  onSave,
}) => {
  const [form, setForm] = useState<EncarteSemanalGridConfig>(gridConfig);

  useEffect(() => {
    setForm(gridConfig);
  }, [gridConfig, open]);

  const handleResetToDefault = () => {
    setForm(DEFAULT_ENCARTE_SEMANAL_GRID);
  };

  const handleSave = () => {
    // Se colunasCount for 4 e xStart/xEnd forem os padrões, mantém divisores exatos
    const updated = { ...form };
    if (updated.columnsCount === 4 && updated.xStart === 29 && updated.xEnd === 1051) {
      updated.columns = [29, 286, 541, 794, 1051];
    } else {
      // Recalcula divisórias proporcionais
      const step = (updated.xEnd - updated.xStart) / updated.columnsCount;
      updated.columns = Array.from(
        { length: updated.columnsCount + 1 },
        (_, i) => Math.round(updated.xStart + i * step)
      );
    }

    saveEncarteSemanalGridConfig(updated);
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-neutral-900 border border-neutral-800 text-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-amber-400" />
            Configuração da Grade do Encarte
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs">
            Ajuste os limites de topo, base, número de produtos e altura da barra para casar perfeitamente com a arte de fundo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          {/* Número de Linhas e Colunas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Colunas (Padrão: 4)</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={form.columnsCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    columnsCount: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Linhas (Padrão: 5)</Label>
              <Input
                type="number"
                min={1}
                max={8}
                value={form.rowsCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rowsCount: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
          </div>

          {/* Topo e Base (Y) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Topo da Grade (Y Inicial px)</Label>
              <Input
                type="number"
                value={form.yStart}
                onChange={(e) =>
                  setForm({ ...form, yStart: parseInt(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
              <span className="text-[10px] text-neutral-400">Padrão da arte: 475px</span>
            </div>
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Base da Grade (Y Final px)</Label>
              <Input
                type="number"
                value={form.yEnd}
                onChange={(e) =>
                  setForm({ ...form, yEnd: parseInt(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
              <span className="text-[10px] text-neutral-400">Padrão da arte: 1850px</span>
            </div>
          </div>

          {/* Laterais (X) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Margem Esquerda (X Inicial px)</Label>
              <Input
                type="number"
                value={form.xStart}
                onChange={(e) =>
                  setForm({ ...form, xStart: parseInt(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
              <span className="text-[10px] text-neutral-400">Padrão: 29px</span>
            </div>
            <div className="space-y-1">
              <Label className="text-neutral-300 font-semibold">Margem Direita (X Final px)</Label>
              <Input
                type="number"
                value={form.xEnd}
                onChange={(e) =>
                  setForm({ ...form, xEnd: parseInt(e.target.value) || 0 })
                }
                className="bg-neutral-800 border-neutral-700 text-white"
              />
              <span className="text-[10px] text-neutral-400">Padrão: 1051px</span>
            </div>
          </div>

          {/* Altura da Barra Inferior */}
          <div className="space-y-1">
            <Label className="text-neutral-300 font-semibold">
              Altura da Barra Amarela/Bege (px)
            </Label>
            <Input
              type="number"
              value={form.barHeight}
              onChange={(e) =>
                setForm({ ...form, barHeight: parseInt(e.target.value) || 54 })
              }
              className="bg-neutral-800 border-neutral-700 text-white"
            />
            <span className="text-[10px] text-neutral-400">
              Padrão: 54px (área para Código à esquerda e Descrição centralizada)
            </span>
          </div>

          <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 text-[11px] text-neutral-400">
            <strong>Resumo:</strong> {form.columnsCount} colunas × {form.rowsCount} linhas ={" "}
            <span className="text-amber-300 font-bold">
              {form.columnsCount * form.rowsCount} produtos por tela
            </span>
            . Altura total útil da grade: {form.yEnd - form.yStart}px (
            {Math.round((form.yEnd - form.yStart) / form.rowsCount)}px por linha).
          </div>
        </div>

        <DialogFooter className="mt-4 border-t border-neutral-800 pt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleResetToDefault}
            className="text-neutral-400 hover:text-white text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Restaurar Padrão
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-neutral-800 border-neutral-700 text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Salvar Grade
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
