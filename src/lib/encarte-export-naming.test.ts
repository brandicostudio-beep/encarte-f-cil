import { describe, it, expect } from "bun:test";
import {
  formatExportDate,
  getEncarteFileBaseSlug,
  buildEncartePageFilename,
  buildEncarteZipFilename,
} from "./encarte-export-naming";

describe("Nomenclatura de exportação de Encartes (PNG e ZIP)", () => {
  it("formatExportDate: formata a data no padrão DD_MM_YYYY", () => {
    // 17 de novembro de 2026 (mês 10 no JS Date)
    const fixedDate = new Date(2026, 10, 17, 14, 30, 0);
    expect(formatExportDate(fixedDate)).toBe("17_11_2026");

    // 05 de janeiro de 2027 com padding de zeros
    const janDate = new Date(2027, 0, 5);
    expect(formatExportDate(janDate)).toBe("05_01_2027");
  });

  it("getEncarteFileBaseSlug: padroniza títulos padrão/genéricos para 'validade_curta'", () => {
    expect(getEncarteFileBaseSlug()).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("DETONA PREÇOS")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("Encarte")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("Encarte Ofertas da Semana")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("Ofertas da Semana")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("Produtos com Validade Curta")).toBe("validade_curta");
    expect(getEncarteFileBaseSlug("Validade")).toBe("validade_curta");
  });

  it("getEncarteFileBaseSlug: suporta título personalizado em snake_case", () => {
    expect(getEncarteFileBaseSlug("Queima de Estoque")).toBe("queima_de_estoque");
    expect(getEncarteFileBaseSlug("Carnes & Congelados")).toBe("carnes_congelados");
  });

  it("buildEncartePageFilename: monta o nome exato solicitado 'validade_curta_17_11_2026_pag_1.png'", () => {
    const filenamePage1 = buildEncartePageFilename("validade_curta", "17_11_2026", 1);
    expect(filenamePage1).toBe("validade_curta_17_11_2026_pag_1.png");

    const filenamePage2 = buildEncartePageFilename("validade_curta", "17_11_2026", 2);
    expect(filenamePage2).toBe("validade_curta_17_11_2026_pag_2.png");
  });

  it("buildEncarteZipFilename: monta o nome do arquivo ZIP como 'validade_curta_17_11_2026.zip'", () => {
    const zipName = buildEncarteZipFilename("validade_curta", "17_11_2026");
    expect(zipName).toBe("validade_curta_17_11_2026.zip");
  });
});
