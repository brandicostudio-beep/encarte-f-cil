import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseProductHtml,
  formatPrice,
  parseCategoryHtml,
  getThumbnailFallbackUrl,
} from "./parse-product";
import { parseSpreadsheetPrices, isDateExpired } from "./encarte-helpers";

describe("parseProductHtml", () => {
  it("prefers Open Graph data", () => {
    const html = `<meta property="og:title" content="Arroz 5kg"><meta property="og:description" content="Tipo 1">
      <meta property="product:price:amount" content="24.90"><meta property="og:image" content="/a.jpg"><h1>Outro</h1>`;
    expect(parseProductHtml(html, "https://loja.com/p")).toEqual({
      name: "Arroz 5kg",
      description: "Tipo 1",
      price: "24,90",
      imageUrl: "https://loja.com/a.jpg",
    });
  });

  it("formats prices", () => {
    expect(formatPrice("R$ 7,5")).toBe("7,50");
    expect(formatPrice("4.99")).toBe("4,99");
    expect(formatPrice("")).toBe("");
  });
});

describe("parseCategoryHtml", () => {
  it("extracts products from schema.org ItemList", () => {
    const html = `<script type="application/ld+json">
    {
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "Product",
          "name": "Biscoito Recheado 130g",
          "sku": "1001",
          "image": "https://loja.com/img1.jpg"
        },
        {
          "@type": "Product",
          "name": "Café Torrado 500g",
          "sku": "1002",
          "image": "https://loja.com/img2.jpg"
        }
      ]
    }
    </script>`;

    const prods = parseCategoryHtml(html, "https://loja.com");
    expect(prods).toHaveLength(2);
    expect(prods[0]?.name).toBe("BISCOITO RECHEADO 130G");
    expect(prods[0]?.code).toBe("1001");
    expect(prods[0]?.price).toBe(""); // Preço vazio inicialmente conforme regra
    expect(prods[1]?.name).toBe("CAFÉ TORRADO 500G");
    expect(prods[1]?.code).toBe("1002");
  });

  it("extracts products from HTML card heuristic", () => {
    const html = `
      <div class="product-item">
        <h3 class="product-title">Molho de Tomate 300g</h3>
        <span class="sku">Cód: 48201</span>
        <span class="validade">Validade: 15/12/2026</span>
        <span class="estoque">Estoque: 150</span>
        <img src="/molho.jpg" />
      </div>
    `;

    const prods = parseCategoryHtml(html, "https://loja.com");
    expect(prods).toHaveLength(1);
    expect(prods[0]?.code).toBe("48201");
    expect(prods[0]?.name).toBe("MOLHO DE TOMATE 300G");
    expect(prods[0]?.validity).toBe("15/12/2026");
    expect(prods[0]?.stock).toBe("150 UND");
  });
});

describe("parseCategoryHtml with Cescom fixture", () => {
  const fixturePath = join(__dirname, "../test/fixtures/cescom-category.html");
  const fixtureHtml = readFileSync(fixturePath, "utf-8");

  it("extracts all products from the fixture matching the page cards count", () => {
    const prods = parseCategoryHtml(fixtureHtml, "https://www.cescom.com.br");
    expect(prods.length).toBe(24);
  });

  it("never extracts badge/banner image ('banners/' or 'VALIDADE PRÓXIMA') as product photo", () => {
    const prods = parseCategoryHtml(fixtureHtml, "https://www.cescom.com.br");
    for (const p of prods) {
      expect(p.image).not.toContain("banners/");
      expect(p.image).not.toContain("agrupar");
      expect(p.image).toMatch(/\.(jpg|jpeg|png|webp)/i);
      expect(p.image).toContain("cescom.agilecdn.com.br");
    }
  });

  it("extracts real product photo and details for 23396 (FRALDA PREMIUM MEGA XXG PERSONAL)", () => {
    const prods = parseCategoryHtml(fixtureHtml, "https://www.cescom.com.br");
    const p = prods.find((item) => item.code === "23396");
    expect(p).toBeDefined();
    expect(p?.name).toBe("FRALDA PREMIUM MEGA XXG PERSONAL");
    expect(p?.validity).toBe("26/11/2026");
    expect(p?.image).toContain("23396_thumb_1.jpg");
    expect(p?.price).toBe(""); // Preço manual e vazio
  });

  it("extracts real product photo and details for 19559 (SEQUILHOS LEITE CONDENSADO BOMBISCOITO)", () => {
    const prods = parseCategoryHtml(fixtureHtml, "https://www.cescom.com.br");
    const p = prods.find((item) => item.code === "19559");
    expect(p).toBeDefined();
    expect(p?.name).toBe("SEQUILHOS LEITE CONDENSADO BOMBISCOITO");
    expect(p?.validity).toBe("25/12/2026");
    expect(p?.image).toContain("19559_thumb_1.jpg");
    expect(p?.price).toBe(""); // Preço manual e vazio
  });

  it("invalidates image if assigned to multiple distinct products (duplicate prevention)", () => {
    const htmlWithDuplicateImages = `
      <div class="product-item">
        <h3 class="product-title">Produto A</h3>
        <span class="sku">Cód: 101</span>
        <img src="https://loja.com/foto-generica.jpg" />
      </div>
      <div class="product-item">
        <h3 class="product-title">Produto B</h3>
        <span class="sku">Cód: 102</span>
        <img src="https://loja.com/foto-generica.jpg" />
      </div>
      <div class="product-item">
        <h3 class="product-title">Produto C</h3>
        <span class="sku">Cód: 103</span>
        <img src="https://loja.com/foto-unica.jpg" />
      </div>
    `;
    const prods = parseCategoryHtml(htmlWithDuplicateImages, "https://loja.com");
    expect(prods).toHaveLength(3);
    // Produto A e B tinham a mesma foto genérica -> deve ter sido invalidada (vazia) para acionar fallback
    expect(prods.find((p) => p.code === "101")?.image).toBe("");
    expect(prods.find((p) => p.code === "102")?.image).toBe("");
    // Produto C tinha foto única -> mantida
    expect(prods.find((p) => p.code === "103")?.image).toBe("https://loja.com/foto-unica.jpg");
  });

  it("generates correct Cescom fallback thumbnail URL by code", () => {
    expect(getThumbnailFallbackUrl("23396", "https://www.cescom.com.br")).toBe(
      "https://cescom.agilecdn.com.br/23396_thumb_1.jpg",
    );
    expect(getThumbnailFallbackUrl("19559")).toBe(
      "https://cescom.agilecdn.com.br/19559_thumb_1.jpg",
    );
    expect(getThumbnailFallbackUrl("", "https://www.cescom.com.br")).toBeNull();
  });
});

describe("encarte-helpers", () => {
  it("parses spreadsheet pasted data", () => {
    const raw = "24657\t4,99\n10982\t14,90\n33104; 3,50";
    const parsed = parseSpreadsheetPrices(raw);
    expect(parsed).toEqual([
      { code: "24657", price: "4,99" },
      { code: "10982", price: "14,90" },
      { code: "33104", price: "3,50" },
    ]);
  });

  it("checks expired dates correctly", () => {
    expect(isDateExpired("01/01/2020")).toBe(true);
    expect(isDateExpired("01/01/2099")).toBe(false);
  });
});
