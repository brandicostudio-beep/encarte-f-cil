import { describe, it, expect } from "vitest";
import { parseSemanalCodes, semanalCodes, semanalPhotos, semanalPhotoBounds, changeSemanalHistory, undoSemanalHistory, redoSemanalHistory } from "./encarte-semanal-editing";

describe("Edição isolada do Semanal", () => {
  it("aceita um código", () => expect(parseSemanalCodes("14352")).toEqual(["14352"]));
  it("aceita mais de dois códigos e suas fotos", () => {
    const product = { id: "1", code: "14352", secondaryCode: "17585", description: "BISCOITO\n80G", image: "foto1", secondaryImage: "foto2", additionalProducts: [{ code: "19396", image: "foto3" }] };
    expect(semanalCodes(product)).toEqual(["14352", "17585", "19396"]);
    expect(semanalPhotos(product)).toEqual(["foto1", "foto2", "foto3"]);
  });
  it("move e sobrepõe fotos sem alterar o box", () => {
    const product = { id: "1", code: "1", description: "", photoTransforms: [{ x: 100, y: -20, scale: 2 }] };
    const bounds = semanalPhotoBounds(product, 0, 2, 250, 220, 1);
    const original = semanalPhotoBounds({ ...product, photoTransforms: [] }, 0, 2, 250, 220, 1);
    expect(bounds.width).toBe(original.width * 2);
    expect(bounds.x + bounds.width / 2).toBe(original.x + original.width / 2 + 100);
    expect(bounds.y + bounds.height).toBe(original.y + original.height - 20);
  });
  it("desfaz e refaz com a descrição multiline preservada", () => {
    const state = changeSemanalHistory({ past: [], present: [{ description: "ANTES" }], future: [] }, [{ description: "BISCOITO\n80G" }]);
    const undone = undoSemanalHistory(state);
    expect(undone.present[0]?.description).toBe("ANTES");
    expect(redoSemanalHistory(undone).present[0]?.description).toBe("BISCOITO\n80G");
  });
});