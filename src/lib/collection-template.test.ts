import { describe, it, expect } from "vitest";
import {
  DEFAULT_COLLECTION_GRID,
  computeGridCells,
  cellsPerPage,
  sanitizeGrid,
  parseColumnLines,
} from "./collection-template";
import { DEFAULT_CAMPAIGN, DEFAULT_TEMPLATE_9_16_AREA } from "@/types/encarte";

describe("encarte de coleções - grade", () => {
  it("padrão usa caixa y 475–1850, colunas 29/286/541/794/1051 e 5 linhas", () => {
    expect(DEFAULT_COLLECTION_GRID.top).toBe(475);
    expect(DEFAULT_COLLECTION_GRID.bottom).toBe(1850);
    expect(DEFAULT_COLLECTION_GRID.columnLines).toEqual([29, 286, 541, 794, 1051]);
    expect(DEFAULT_COLLECTION_GRID.rows).toBe(5);
  });

  it("gera 4 colunas x 5 linhas = 20 células", () => {
    expect(cellsPerPage(DEFAULT_COLLECTION_GRID)).toBe(20);
    expect(computeGridCells(DEFAULT_COLLECTION_GRID)).toHaveLength(20);
  });

  it("células ficam dentro da caixa configurada", () => {
    const g = { ...DEFAULT_COLLECTION_GRID, gap: 0 };
    const cells = computeGridCells(g);
    expect(cells[0]).toMatchObject({ x: 29, y: 475, width: 257 });
    const last = cells[cells.length - 1]!;
    expect(last.x + last.width).toBe(1051);
    expect(last.y + last.height).toBeCloseTo(1850);
  });

  it("grade é configurável: 3 colunas e 4 linhas", () => {
    expect(cellsPerPage({ ...DEFAULT_COLLECTION_GRID, columnLines: [0, 100, 200, 300], rows: 4 })).toBe(12);
  });

  it("valores inválidos voltam ao padrão", () => {
    const g = sanitizeGrid({ columnLines: [5], rows: 0 } as never);
    expect(g.columnLines).toEqual([29, 286, 541, 794, 1051]);
    expect(g.rows).toBe(1);
  });

  it("lê lista de colunas digitada", () => {
    expect(parseColumnLines("29, 286 541;794,1051")).toEqual([29, 286, 541, 794, 1051]);
  });

  it("encarte de validade continua com o template e área originais", () => {
    expect(DEFAULT_CAMPAIGN.template916Image).toBe("/templates/template-detona-precos-9-16.png");
    expect(DEFAULT_TEMPLATE_9_16_AREA).toEqual({ x: 46, y: 661, width: 1012, height: 1202, canvasWidth: 1080, canvasHeight: 1920 });
  });
});
