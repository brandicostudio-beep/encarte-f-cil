import { describe, it, expect } from "vitest";
import { parseSpreadsheetPrices } from "./encarte-helpers";
import type { EncarteProduct } from "@/types/encarte";

describe("Aba 'Colar tabela de preço' com texto do site da Cescom", () => {
  const sampleCescomText = `
FRALDA PREMIUM MEGA XXG PERSONAL
VALIDADE: 26/11/2026
Código: 23396
EAN: 7896110012223
(PACOTE 1) 1X24 UNID - R$ 23,26
(FARDO 9) 9X24 UNID - R$ 209,34
R$ 23,26
Unidade: R$ 0,97

SEQUILHOS LEITE CONDENSADO BOMBISCOITO
VALIDADE: 25/12/2026
Código: 19559
EAN: 7898249283260
(UNIDADE 1) 1X320 GR - R$ 6,75
(CAIXA 18) 18X320 GR - R$ 115,00
R$ 6,75
Unidade: R$ 6,75

SALGADINHO YOKITOS CONCHINHA PRESUNTO
VALIDADE: 06/12/2026
Código: 20609
1X153 GR - R$ 5,99
R$ 5,99
Unidade: R$ 5,99

SALGADINHO GULAO PURURUCA BACON
VALIDADE: 22/11/2026
Código: 25154
1X100 GR
R$ 1,85

CHOCOLATE GRANULADO DORI SM
VALIDADE: 05/12/2026
Código: 21620
30X120 GR
R$ 89,90

MOLHO POMAROLA AZEITONA SACHE
VALIDADE: 06/12/2026
Código: 11793
24X300 GR
R$ 69,90

PRODUTO FORA DO ENCARTE
Código: 99999
1X500 GR
R$ 12,50
`;

  // 1 e 2: Produtos carregados no encarte
  const loadedProducts: EncarteProduct[] = [
    {
      id: "p-23396",
      code: "23396",
      name: "FRALDA PREMIUM MEGA XXG PERSONAL",
      packaging: "1X24 UNID",
      validity: "26/11/2026",
      price: "",
      unit: "UND",
      stock: "50",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-19559",
      code: "19559",
      name: "SEQUILHOS LEITE CONDENSADO BOMBISCOITO",
      packaging: "1X320 GR",
      validity: "25/12/2026",
      price: "",
      unit: "UND",
      stock: "20",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-20609",
      code: "20609",
      name: "SALGADINHO YOKITOS CONCHINHA PRESUNTO",
      packaging: "1X153 GR",
      validity: "06/12/2026",
      price: "",
      unit: "UND",
      stock: "15",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-25154",
      code: "25154",
      name: "SALGADINHO GULAO PURURUCA BACON",
      packaging: "1X100 GR",
      validity: "22/11/2026",
      price: "",
      unit: "UND",
      stock: "30",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-21620",
      code: "21620",
      name: "CHOCOLATE GRANULADO DORI SM",
      packaging: "30X120 GR",
      validity: "05/12/2026",
      price: "",
      unit: "CX",
      stock: "10",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-11793",
      code: "11793",
      name: "MOLHO POMAROLA AZEITONA SACHE",
      packaging: "24X300 GR",
      validity: "06/12/2026",
      price: "",
      unit: "CX",
      stock: "18",
      badge: "nenhum",
      image: "",
      included: true,
    },
    {
      id: "p-manual",
      code: "88888",
      name: "PRODUTO COM PREÇO MANUAL",
      packaging: "1X1 KG",
      validity: "30/12/2026",
      price: "15,99", // Preço digitado manualmente
      unit: "UND",
      stock: "5",
      badge: "nenhum",
      image: "",
      included: true,
    },
  ];

  it("Passo 3: Analisa texto da Cescom e extrai cada produto com código, nome e preço", () => {
    const parsed = parseSpreadsheetPrices(sampleCescomText);
    expect(parsed.length).toBe(7);

    // Cada produto do texto aparece com código, nome e preço
    const p23396 = parsed.find((p) => p.code === "23396");
    expect(p23396).toBeDefined();
    expect(p23396?.productName).toContain("FRALDA PREMIUM MEGA XXG PERSONAL");

    // O preço é o R$ grande ao lado da primeira embalagem (23396 = R$ 23,26; 19559 = R$ 6,75)
    expect(p23396?.price).toBe("23,26");

    const p19559 = parsed.find((p) => p.code === "19559");
    expect(p19559).toBeDefined();
    expect(p19559?.price).toBe("6,75");

    // As linhas 'Unidade: R$ X' soltas NÃO são usadas como preço
    // (no texto temos 'Unidade: R$ 0,97' para 23396, mas o preço capturado deve ser 23,26)
    expect(p23396?.price).not.toBe("0,97");

    // 20609 e 25154
    const p20609 = parsed.find((p) => p.code === "20609");
    expect(p20609?.price).toBe("5,99");

    const p25154 = parsed.find((p) => p.code === "25154");
    expect(p25154?.price).toBe("1,85");

    // Produtos com uma única embalagem (21620, 11793) são lidos corretamente
    const p21620 = parsed.find((p) => p.code === "21620");
    expect(p21620?.price).toBe("89,90");

    const p11793 = parsed.find((p) => p.code === "11793");
    expect(p11793?.price).toBe("69,90");
  });

  it("Passo 3b: Separação de códigos com e sem correspondência no encarte", () => {
    const parsed = parseSpreadsheetPrices(sampleCescomText);
    const codeMap = new Map(loadedProducts.map((p) => [p.code.toLowerCase(), p.name]));

    const matches = parsed.filter((p) => codeMap.has(p.code.toLowerCase()));
    const notFound = parsed.filter((p) => !codeMap.has(p.code.toLowerCase()));

    // 6 correspondentes no encarte
    expect(matches.map((m) => m.code)).toEqual(["23396", "19559", "20609", "25154", "21620", "11793"]);

    // 1 código sem correspondência separado (99999)
    expect(notFound.length).toBe(1);
    expect(notFound[0].code).toBe("99999");
    expect(notFound[0].price).toBe("12,50");
  });

  it("Passo 4 & 6: Aplica preços apenas aos produtos correspondentes e NÃO apaga preço manual", () => {
    const parsed = parseSpreadsheetPrices(sampleCescomText);
    const codeMap = new Map(loadedProducts.map((p) => [p.code.toLowerCase(), true]));
    const matchingUpdates = parsed.filter((item) => codeMap.has(item.code.toLowerCase()));

    const priceMap = new Map(matchingUpdates.map((u) => [u.code.toLowerCase(), u.price]));

    const updated = loadedProducts.map((p) => {
      const newPrice = priceMap.get(p.code.toLowerCase());
      if (newPrice) return { ...p, price: newPrice };
      return p;
    });

    // Produtos correspondentes receberam os preços da Cescom
    expect(updated.find((p) => p.code === "23396")?.price).toBe("23,26");
    expect(updated.find((p) => p.code === "19559")?.price).toBe("6,75");
    expect(updated.find((p) => p.code === "20609")?.price).toBe("5,99");
    expect(updated.find((p) => p.code === "25154")?.price).toBe("1,85");
    expect(updated.find((p) => p.code === "21620")?.price).toBe("89,90");
    expect(updated.find((p) => p.code === "11793")?.price).toBe("69,90");

    // Produto cujo código não estava no texto colado NÃO teve o preço apagado
    const prodManual = updated.find((p) => p.code === "88888");
    expect(prodManual?.price).toBe("15,99");

    // Descrição, unidade e validade NÃO foram alteradas
    expect(updated.find((p) => p.code === "23396")?.packaging).toBe("1X24 UNID");
    expect(updated.find((p) => p.code === "23396")?.validity).toBe("26/11/2026");
    expect(updated.find((p) => p.code === "23396")?.unit).toBe("UND");
    expect(updated.find((p) => p.code === "21620")?.unit).toBe("CX");
  });

  it("Passo 5: Teste de casos de erro", () => {
    // 1. Texto vazio
    expect(parseSpreadsheetPrices("")).toEqual([]);
    expect(parseSpreadsheetPrices("   \n\t  \n  ")).toEqual([]);

    // 2. Texto de outro site (sem códigos de produto nem preços estruturados)
    const randomBlog = `
      Confira as 10 melhores receitas para o jantar de hoje.
      1. Arroz com legumes
      2. Frango assado com batatas
      Para mais informações clique aqui.
    `;
    expect(parseSpreadsheetPrices(randomBlog)).toEqual([]);

    // 3. Código repetido (deduplica, mantendo uma única entrada por código)
    const duplicateText = `
      FRALDA PERSONAL
      Código: 23396
      1X24 UNID - R$ 23,26
      
      OUTRA FRALDA PERSONAL
      Código: 23396
      1X24 UNID - R$ 25,00
    `;
    const dupRes = parseSpreadsheetPrices(duplicateText);
    expect(dupRes.length).toBe(1);
    expect(dupRes[0].code).toBe("23396");
    expect(dupRes[0].price).toBe("23,26");

    // 4. Colagem parcial (só o nome e código, sem preço)
    const partialText = `
      MOLHO DE TOMATE
      Código: 55555
      24X300 GR
    `;
    const partialRes = parseSpreadsheetPrices(partialText);
    expect(partialRes.length).toBe(0);
  });

  it("Passo 7: Encarte com produtos atualizados está pronto para exportação", () => {
    const parsed = parseSpreadsheetPrices(sampleCescomText);
    const priceMap = new Map(parsed.map((u) => [u.code.toLowerCase(), u.price]));

    const updated = loadedProducts.map((p) => {
      const newPrice = priceMap.get(p.code.toLowerCase());
      if (newPrice) return { ...p, price: newPrice };
      return p;
    });

    // Todos os produtos do encarte agora têm preço válido
    const readyForExport = updated.filter((p) => Boolean(p.price && p.included));
    expect(readyForExport.length).toBe(7);

    // Não há preços vazios entre os incluídos
    const unpriced = readyForExport.filter((p) => !p.price);
    expect(unpriced.length).toBe(0);
  });
});
