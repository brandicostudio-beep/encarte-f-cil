// Configuração do Encarte de Coleções (independente do encarte de validade).
// O fundo é apenas uma arte trocável; a grade é configurável em pixels do canvas base.

export interface CollectionGridConfig {
  canvasWidth: number;
  canvasHeight: number;
  top: number; // y inicial da caixa da grade
  bottom: number; // y final da caixa da grade
  columnLines: number[]; // linhas verticais (x) que delimitam as colunas
  rows: number;
  gap: number; // espaço interno entre células
}

export interface CollectionTemplateConfig {
  backgroundImage: string;
  grid: CollectionGridConfig;
}

export const DEFAULT_COLLECTION_BACKGROUND = "/templates/template-esquenta-black-cescom-9-16.png";

export const DEFAULT_COLLECTION_GRID: CollectionGridConfig = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  top: 475,
  bottom: 1850,
  columnLines: [29, 286, 541, 794, 1051],
  rows: 5,
  gap: 8,
};

export const DEFAULT_COLLECTION_TEMPLATE: CollectionTemplateConfig = {
  backgroundImage: DEFAULT_COLLECTION_BACKGROUND,
  grid: DEFAULT_COLLECTION_GRID,
};

export const COLLECTION_TEMPLATE_STORAGE_KEY = "encarte-colecoes-template";

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

/** Normaliza config vinda do navegador, caindo no padrão para valores inválidos. */
export function sanitizeGrid(input: Partial<CollectionGridConfig> | undefined): CollectionGridConfig {
  const d = DEFAULT_COLLECTION_GRID;
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const lines = Array.isArray(input?.columnLines)
    ? input!.columnLines.filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b)
    : [];
  const top = num(input?.top, d.top);
  const bottom = num(input?.bottom, d.bottom);
  return {
    canvasWidth: num(input?.canvasWidth, d.canvasWidth) || d.canvasWidth,
    canvasHeight: num(input?.canvasHeight, d.canvasHeight) || d.canvasHeight,
    top: Math.min(top, bottom),
    bottom: Math.max(top, bottom),
    columnLines: lines.length >= 2 ? lines : [...d.columnLines],
    rows: Math.max(1, Math.round(num(input?.rows, d.rows))),
    gap: Math.max(0, num(input?.gap, d.gap)),
  };
}

/** Calcula as células da grade (em pixels do canvas base), linha por linha. */
export function computeGridCells(grid: CollectionGridConfig): GridCell[] {
  const g = sanitizeGrid(grid);
  const rowH = (g.bottom - g.top) / g.rows;
  const half = g.gap / 2;
  const cells: GridCell[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.columnLines.length - 1; c++) {
      const x0 = g.columnLines[c]!;
      const x1 = g.columnLines[c + 1]!;
      const y0 = g.top + r * rowH;
      cells.push({
        x: x0 + half,
        y: y0 + half,
        width: x1 - x0 - g.gap,
        height: rowH - g.gap,
        row: r,
        col: c,
      });
    }
  }
  return cells;
}

export function cellsPerPage(grid: CollectionGridConfig): number {
  const g = sanitizeGrid(grid);
  return g.rows * (g.columnLines.length - 1);
}

export function parseColumnLines(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}
