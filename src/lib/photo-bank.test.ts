import { describe, it, expect } from "vitest";
import {
  extractProductCodeFromFilename,
  matchPhotosWithProducts,
  type LoadedPhoto,
} from "./photo-bank";
import type { EncarteProduct } from "@/types/encarte";

describe("photo-bank", () => {
  it("extracts codes correctly from filenames", () => {
    const knownCodes = ["24657", "00123", "ABC-99"];

    expect(extractProductCodeFromFilename("24657.jpg", knownCodes)).toBe("24657");
    expect(extractProductCodeFromFilename("24657-1.jpg", knownCodes)).toBe("24657");
    expect(extractProductCodeFromFilename("24657_frente.png", knownCodes)).toBe("24657");
    expect(extractProductCodeFromFilename("00123-embalagem.webp", knownCodes)).toBe("00123");
  });

  it("chooses first photo in alphabetical order when multiple photos exist for same code", () => {
    const photos: LoadedPhoto[] = [
      { filename: "24657_verso.jpg", dataUrl: "data:verso", extractedCode: "24657" },
      { filename: "24657_frente.jpg", dataUrl: "data:frente", extractedCode: "24657" },
    ];

    const products: EncarteProduct[] = [
      {
        id: "1",
        code: "24657",
        name: "PRODUTO TESTE",
        packaging: "1 UN",
        validity: "15/12/2026",
        price: "",
        unit: "UND",
        badge: "nenhum",
        image: "original-link-image.jpg",
        included: true,
      },
    ];

    const result = matchPhotosWithProducts(photos, products);
    // "24657_frente.jpg" vem antes de "24657_verso.jpg" alfabeticamente
    expect(result.updatedProducts[0].image).toBe("data:frente");
    expect(result.matchedCount).toBe(1);
    expect(result.unmatchedPhotos).toHaveLength(0);
  });

  it("lists photos without matching product in unmatchedPhotos", () => {
    const photos: LoadedPhoto[] = [
      { filename: "99999.jpg", dataUrl: "data:99999", extractedCode: "99999" },
    ];

    const products: EncarteProduct[] = [
      {
        id: "1",
        code: "24657",
        name: "PRODUTO TESTE",
        packaging: "1 UN",
        validity: "15/12/2026",
        price: "",
        unit: "UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const result = matchPhotosWithProducts(photos, products);
    expect(result.matchedCount).toBe(0);
    expect(result.unmatchedPhotos).toEqual(["99999.jpg"]);
  });
});
