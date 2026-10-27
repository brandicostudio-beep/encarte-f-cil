import { describe, it, expect } from "vitest";
import {
  calculateOpticalScale,
  getOpticalMetrics,
  autoTrimImageWhitespace,
} from "./image-normalizer";

describe("Normalizador Óptico de Fotos de Produtos (image-normalizer)", () => {
  it("Aplica ganho de escala vertical (zoom óptico) para produtos muito esguios/garrafas altas", () => {
    // Garrafa esguia típica (aspect ratio 1:3 = 0.33)
    const scaleSlender = calculateOpticalScale(0.33);
    expect(scaleSlender).toBeGreaterThanOrEqual(1.25);

    // Garrafa padrão (aspect ratio 1:2 = 0.5)
    const scaleStandardBottle = calculateOpticalScale(0.5);
    expect(scaleStandardBottle).toBeGreaterThanOrEqual(1.15);
  });

  it("Aplica recuo óptico para produtos quadrados e volumosos para equilibrar área visual", () => {
    // Pacote quadrado de salgadinho ou sabão em pó (aspect ratio 1:1 = 1.0)
    const scaleSquare = calculateOpticalScale(1.0);
    expect(scaleSquare).toBeLessThan(1.0);
    expect(scaleSquare).toBeGreaterThanOrEqual(0.85);

    // Produto ligeiramente retangular (0.95)
    const scaleNearSquare = calculateOpticalScale(0.95);
    expect(scaleNearSquare).toBeLessThan(1.0);
  });

  it("Aplica escala neutra ou ligeiramente ampliada para formatos médios e largos", () => {
    // Produto de proporção média (ex: 4:3 = 1.33)
    const scaleMedium = calculateOpticalScale(0.75);
    expect(scaleMedium).toBe(1.0);

    // Produto horizontal largo (ex: barra ou bandeja, ratio 1.5)
    const scaleWide = calculateOpticalScale(1.5);
    expect(scaleWide).toBeGreaterThan(1.0);
  });

  it("getOpticalMetrics diagnostica corretamente a geometria do produto", () => {
    // 60x180 px (Bebida Láctea ou desodorante)
    const bottleMetrics = getOpticalMetrics(60, 180);
    expect(bottleMetrics.isSlender).toBe(true);
    expect(bottleMetrics.isSquareBulky).toBe(false);
    expect(bottleMetrics.opticalScale).toBeGreaterThanOrEqual(1.2);

    // 200x200 px (Yokitos ou Bom Biscoito)
    const bulkyMetrics = getOpticalMetrics(200, 200);
    expect(bulkyMetrics.isSlender).toBe(false);
    expect(bulkyMetrics.isSquareBulky).toBe(true);
    expect(bulkyMetrics.opticalScale).toBeLessThan(1.0);
  });

  it("Fallback seguro para dimensões zero ou inválidas", () => {
    expect(calculateOpticalScale(0)).toBe(1.0);
    expect(calculateOpticalScale(NaN)).toBe(1.0);
    expect(calculateOpticalScale(-1)).toBe(1.0);
  });

  it("autoTrimImageWhitespace retorna o src original se executado fora do DOM", async () => {
    const res = await autoTrimImageWhitespace("");
    expect(res.trimmedSrc).toBe("");
    expect(res.wasTrimmed).toBe(false);
  });
});
