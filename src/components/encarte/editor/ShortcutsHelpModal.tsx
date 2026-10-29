import React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutsHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  {
    category: "Ferramentas",
    items: [
      { key: "V", description: "Ferramenta de Seleção" },
      { key: "H", description: "Ferramenta de Mão (Pan)" },
      { key: "Espaço + Arrastar", description: "Pan temporário com o mouse" },
      { key: "Z", description: "Ferramenta de Zoom" },
      { key: "T", description: "Editar texto direto" },
    ],
  },
  {
    category: "Navegação e Zoom",
    items: [
      { key: "Ctrl + Scroll", description: "Zoom in / Zoom out centrado" },
      { key: "Ctrl + 0", description: "Ajustar à tela (Fit)" },
      { key: "Ctrl + 1", description: "Zoom em 100% real" },
      { key: "Tab / Shift + Tab", description: "Navegar entre elementos em ordem" },
    ],
  },
  {
    category: "Seleção e Edição",
    items: [
      { key: "Clique", description: "Selecionar elemento / alternar box e texto" },
      { key: "Shift + Clique", description: "Adicionar / remover da seleção múltipla" },
      { key: "Ctrl + A", description: "Selecionar todos os elementos da página" },
      { key: "Ctrl + D", description: "Duplicar produto selecionado" },
      { key: "Ctrl + C", description: "Copiar produto selecionado" },
      { key: "Ctrl + V", description: "Colar produto na página ativa" },
      { key: "Del / Backspace", description: "Excluir produto selecionado" },
      { key: "Esc", description: "Desmarcar tudo" },
      { key: "Ctrl + Z", description: "Desfazer última alteração" },
      { key: "Ctrl + Shift + Z / Ctrl + Y", description: "Refazer alteração" },
      { key: "Setas", description: "Mover 1px na direção" },
      { key: "Shift + Setas", description: "Mover 10px na direção" },
      { key: "Alt + Arrastar", description: "Duplicar / copiar estilização" },
    ],
  },
  {
    category: "Guias e Visualização",
    items: [
      { key: "G", description: "Mostrar / ocultar grade milimétrica" },
      { key: "R", description: "Mostrar / ocultar réguas de precisão" },
      { key: "U", description: "Ligar / desligar Guias Inteligentes (Snap)" },
      { key: "?", description: "Abrir este guia de atalhos de teclado" },
    ],
  },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Atalhos de Teclado (Estilo Illustrator)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Controle o editor visual com rapidez usando as combinações de teclas padrão da indústria.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {SHORTCUTS.map((section) => (
            <div
              key={section.category}
              className="rounded-lg border border-border p-3 space-y-2 bg-muted/20"
            >
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {section.category}
              </h4>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">{item.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-[10px] font-semibold text-foreground shrink-0 shadow-2xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
