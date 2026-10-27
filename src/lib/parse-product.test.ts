import { describe, it, expect } from "vitest";
import { parseProductHtml, formatPrice } from "./parse-product";

describe("parseProductHtml", () => {
  it("prefers Open Graph data", () => {
    const html = `<meta property="og:title" content="Arroz 5kg"><meta property="og:description" content="Tipo 1">
      <meta property="product:price:amount" content="24.90"><meta property="og:image" content="/a.jpg"><h1>Outro</h1>`;
    expect(parseProductHtml(html, "https://loja.com/p")).toEqual({
      name: "Arroz 5kg", description: "Tipo 1", price: "24,90", imageUrl: "https://loja.com/a.jpg",
    });
  });
  it("falls back to page content", () => {
    const p = parseProductHtml(`<title>T</title><h1>Feijão</h1><span>R$ 1.299,00</span>`, "https://x.com");
    expect(p.name).toBe("Feijão");
    expect(p.price).toBe("1299,00");
    expect(p.imageUrl).toBe("");
  });
  it("formats prices", () => {
    expect(formatPrice("R$ 7,5")).toBe("7,50");
    expect(formatPrice("")).toBe("");
  });
});
