import type { EncarteProduct } from "@/types/encarte";
import { formatPrice } from "./parse-product";

/**
 * Verifica se uma data no formato dd/mm/aaaa ou aaaa-mm-dd está vencida em relação ao dia de hoje.
 */
export function isDateExpired(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const clean = dateStr.trim();
  let day: number, month: number, year: number;

  const brMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    day = parseInt(brMatch[1] ?? "0", 10);
    month = parseInt(brMatch[2] ?? "0", 10) - 1;
    year = parseInt(brMatch[3] ?? "0", 10);
    if (year < 100) year += 2000;
  } else {
    const isoMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1] ?? "0", 10);
      month = parseInt(isoMatch[2] ?? "0", 10) - 1;
      day = parseInt(isoMatch[3] ?? "0", 10);
    } else {
      return false;
    }
  }

  const targetDate = new Date(year, month, day, 23, 59, 59, 999);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  return targetDate.getTime() < today.getTime();
}

/**
 * Converte string de data no formato dd/mm/aaaa ou aaaa-mm-dd para timestamp em ms.
 * Retorna Infinity se a data for inválida ou vazia, garantindo que itens sem data fiquem no final na ordenação crescente.
 */
export function getValidityTimestamp(dateStr?: string | null): number {
  if (!dateStr || typeof dateStr !== "string") return Infinity;
  const clean = dateStr.trim();
  if (!clean) return Infinity;

  let day: number, month: number, year: number;

  const brMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    day = parseInt(brMatch[1] ?? "0", 10);
    month = parseInt(brMatch[2] ?? "0", 10) - 1;
    year = parseInt(brMatch[3] ?? "0", 10);
    if (year < 100) year += 2000;
  } else {
    const isoMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1] ?? "0", 10);
      month = parseInt(isoMatch[2] ?? "0", 10) - 1;
      day = parseInt(isoMatch[3] ?? "0", 10);
    } else {
      return Infinity;
    }
  }

  const d = new Date(year, month, day);
  const t = d.getTime();
  return isNaN(t) ? Infinity : t;
}

/**
 * Ordena produtos da validade mais próxima para a mais longa (ordem crescente de vencimento).
 * Itens sem validade ficam ao final. Mantém ordenação secundária por código numérico.
 */
export function sortProductsByValidityAsc<T extends { validity?: string; code?: string }>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const tA = getValidityTimestamp(a?.validity);
    const tB = getValidityTimestamp(b?.validity);
    if (tA !== tB) return tA - tB;
    const codeA = String(a?.code ?? "");
    const codeB = String(b?.code ?? "");
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });
}

export interface ParsedSpreadsheetItem {
  code: string;
  price: string;
  productName?: string;
}

/**
 * Processa texto colado de planilha (Excel / Google Sheets) ou copiado
 * diretamente do site da Cescom (blocos com código, embalagem e preço).
 */
export function parseSpreadsheetPrices(rawText: string): ParsedSpreadsheetItem[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim());
  const nonEmptyLines = rawLines.filter(Boolean);
  if (nonEmptyLines.length === 0) return [];

  // 1. Verificar se é texto copiado do site da Cescom (possui "Código:", "Cód:", ou blocos verticais)
  const hasCescomPatterns = nonEmptyLines.some(
    (l) =>
      /(?:código|cód|cod)[:.\s]+\d{3,8}\b/i.test(l) ||
      /\b(?:pacote|fardo|caixa|display|unidade)\s*\d*\)\s*.*[-–—]\s*R\$/i.test(l) ||
      (/^validade[:\s]/i.test(l) && nonEmptyLines.some((l2) => /^r\$\s*[\d.,]+/i.test(l2)))
  );

  if (hasCescomPatterns) {
    return parseCescomTextBlocks(rawLines);
  }

  // 2. Formato tabular (Excel, Sheets, CSV, linhas separadas por tab, ponto-e-vírgula ou pipe)
  const isTabular = nonEmptyLines.some(
    (l) => l.includes("\t") || l.includes(";") || (l.includes("|") && !l.includes("R$"))
  );

  if (isTabular) {
    const results: ParsedSpreadsheetItem[] = [];
    const seenCodes = new Set<string>();

    for (const line of nonEmptyLines) {
      let parts: string[] = [];
      if (line.includes("\t")) parts = line.split("\t");
      else if (line.includes(";")) parts = line.split(";");
      else if (line.includes("|")) parts = line.split("|");

      parts = parts.map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        let code = "";
        let price = "";
        let name = "";

        // Tentar identificar código, preço e nome em qualquer coluna
        for (let i = 0; i < parts.length; i++) {
          const col = parts[i];
          const cleanCol = col.replace(/^['"#]+/, "").trim();

          // Código
          if (!code && /^\d{3,8}$/.test(cleanCol)) {
            code = cleanCol;
          } else if (!code && /^(?:cod|cód|item|sku)[:.\s]*(\d+)/i.test(col)) {
            code = col.match(/^(?:cod|cód|item|sku)[:.\s]*(\d+)/i)![1];
          }
          // Preço (contém R$, formato monetário ou número decimal)
          else if (
            !price &&
            (col.includes("R$") || /^\d+[.,]\d{2}$/.test(col) || (/^\d+$/.test(col) && i > 0 && i === parts.length - 1))
          ) {
            const formatted = formatPrice(col);
            if (formatted) price = formatted;
          }
          // Nome do produto (texto sem cifrão, maior que 3 caracteres)
          else if (!name && col.length > 3 && !col.includes("R$") && !/^\d+$/.test(col)) {
            name = col;
          }
        }

        // Fallbacks posicionais caso não tenha identificado por padrão
        if (!code && parts[0]) {
          const fallbackCode = parts[0].replace(/^['"#]+/, "").trim();
          if (/^\d+$/.test(fallbackCode)) code = fallbackCode;
        }
        if (!price && parts[parts.length - 1]) {
          const formatted = formatPrice(parts[parts.length - 1]);
          if (formatted) price = formatted;
        }

        // Ignorar linha de cabeçalho
        if (code && price && code.toLowerCase() !== "codigo" && code.toLowerCase() !== "cod") {
          const key = code.toLowerCase();
          if (!seenCodes.has(key)) {
            seenCodes.add(key);
            const item: ParsedSpreadsheetItem = { code, price };
            if (name) item.productName = name;
            results.push(item);
          }
        }
      }
    }

    if (results.length > 0) return results;
  }

  // 3. Fallback linha a linha simples: código espaço preço ou hífen
  const simpleResults: ParsedSpreadsheetItem[] = [];
  const seen = new Set<string>();

  for (const line of nonEmptyLines) {
    const match = line.match(/^([A-Za-z0-9_-]+)[\s,–—-]+(?:R\$\s*)?([\d.,]+)$/);
    if (match && match[1] && match[2]) {
      const code = match[1].replace(/^['"#]+/, "").trim();
      const formatted = formatPrice(match[2]);
      if (code && formatted && /^\d{3,8}$/.test(code)) {
        const key = code.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          simpleResults.push({ code, price: formatted });
        }
      }
    }
  }

  if (simpleResults.length > 0) return simpleResults;

  // 4. Se ainda não retornou, tentar análise estruturada de blocos Cescom
  return parseCescomTextBlocks(rawLines);
}

/**
 * Analisa blocos de texto multilinha copiados do site da Cescom.
 * Regras estritas:
 * - O preço é o R$ grande ao lado da primeira embalagem (ex: 23396 = R$ 23,26, 19559 = R$ 6,75).
 * - Linhas "Unidade: R$ X" soltas NÃO são usadas como preço.
 * - Produtos com uma única embalagem (ex: 21620, 11793) são lidos corretamente.
 * - Códigos repetidos são deduplicados.
 */
function parseCescomTextBlocks(lines: string[]): ParsedSpreadsheetItem[] {
  const results: ParsedSpreadsheetItem[] = [];
  const seenCodes = new Set<string>();

  // Encontrar onde cada produto é marcado pelo código
  const codeIndices: { index: number; code: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const codeMatch = line.match(/(?:código|cód|cod|item|sku)[:.\s]+(\d{3,8})\b/i);
    if (codeMatch && codeMatch[1]) {
      codeIndices.push({ index: i, code: codeMatch[1] });
    }
  }

  // Se não achou "Código: XXX", procurar linhas de código isolado
  if (codeIndices.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d{4,8}$/.test(line)) {
        codeIndices.push({ index: i, code: line });
      }
    }
  }

  if (codeIndices.length === 0) return [];

  for (let c = 0; c < codeIndices.length; c++) {
    const current = codeIndices[c];
    const nextIndex = c + 1 < codeIndices.length ? codeIndices[c + 1].index : lines.length;
    const prevIndex = c > 0 ? codeIndices[c - 1].index : 0;

    // Linhas antes do código para extrair o Nome do Produto
    const linesBefore = lines
      .slice(prevIndex === 0 && c === 0 ? 0 : Math.max(0, current.index - 5), current.index)
      .filter(Boolean);

    let productName = "";
    for (let j = linesBefore.length - 1; j >= 0; j--) {
      const lb = linesBefore[j];
      if (/^validade/i.test(lb) || /^ean/i.test(lb) || /^c[oó]d/i.test(lb) || lb.includes("R$")) continue;
      if (lb.length >= 3 && !lb.startsWith("http")) {
        productName = lb;
        break;
      }
    }

    // Linhas a partir do código até o próximo produto
    const blockLines = lines.slice(current.index, nextIndex);

    let price = "";

    // Passo 1: Verificar se há opção de embalagem com " - R$ " (ex.: "(PACOTE 1) 1X24 UNID - R$ 23,26")
    for (const bl of blockLines) {
      // REGRA: Linhas "Unidade: R$ X" soltas NÃO são usadas como preço
      if (/^unidade:\s*r\$/i.test(bl) || /^preço\s+por\s+unidade/i.test(bl) || /^por\s+unidade/i.test(bl)) {
        continue;
      }

      const embalagemMatch =
        bl.match(/[-–—]\s*R\$\s*([\d.,]+)/i) ||
        bl.match(/\b(?:\d+X\d+\s*(?:GR|G|KG|ML|L|UNID|UN))\s*[-–—]\s*R\$\s*([\d.,]+)/i);

      if (embalagemMatch && embalagemMatch[1]) {
        const formatted = formatPrice(embalagemMatch[1]);
        if (formatted) {
          price = formatted;
          break; // O preço é da PRIMEIRA embalagem!
        }
      }
    }

    // Passo 2: Se não encontrou na linha de embalagem, procurar linha com R$ grande
    if (!price) {
      for (const bl of blockLines) {
        // REGRA: Ignorar linhas "Unidade: R$ X"
        if (/^unidade:\s*r\$/i.test(bl) || /^preço\s+por\s+unidade/i.test(bl) || /por\s+unidade/i.test(bl)) {
          continue;
        }

        const bigPriceMatch = bl.match(/^R\$\s*([\d.,]+)$/i) || bl.match(/\bR\$\s*([\d.,]+)\b/i);
        if (bigPriceMatch && bigPriceMatch[1]) {
          const formatted = formatPrice(bigPriceMatch[1]);
          if (formatted) {
            price = formatted;
            break;
          }
        }
      }
    }

    // Passo 3: Produto com única embalagem ou valor numérico decimal isolado
    if (!price) {
      for (const bl of blockLines) {
        if (/^unidade/i.test(bl) || /^ean/i.test(bl) || /^validade/i.test(bl) || /^c[oó]d/i.test(bl)) continue;
        if (/^\d{1,4}[.,]\d{2}$/.test(bl)) {
          const formatted = formatPrice(bl);
          if (formatted) {
            price = formatted;
            break;
          }
        }
      }
    }

    // Salvar produto se tiver código e preço válidos
    if (current.code && price) {
      const codeKey = current.code.toLowerCase();
      if (!seenCodes.has(codeKey)) {
        seenCodes.add(codeKey);
        const item: ParsedSpreadsheetItem = { code: current.code, price };
        if (productName) item.productName = productName;
        results.push(item);
      }
    }
  }

  return results;
}

/**
 * Cria placeholder SVG limpo com o nome do produto para quando a imagem estiver ausente.
 */
export function createProductPlaceholderSvg(name: string): string {
  const shortName = (name || "PRODUTO").slice(0, 24).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="none">
    <rect width="300" height="300" fill="#f8fafc" rx="16"/>
    <rect x="8" y="8" width="284" height="284" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 6" rx="12"/>
    <path d="M110 120L150 95L190 120V170L150 195L110 170V120Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 95V195M110 120L150 145L190 120" stroke="#94a3b8" stroke-width="3"/>
    <text x="150" y="235" font-family="sans-serif" font-weight="700" font-size="14" fill="#64748b" text-anchor="middle">${shortName}</text>
    <text x="150" y="255" font-family="sans-serif" font-weight="500" font-size="11" fill="#94a3b8" text-anchor="middle">FOTO NÃO DISPONÍVEL</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Gera lista de produtos de demonstração para testar rapidamente o encarte.
 */
export function getSampleProducts(): EncarteProduct[] {
  const today = new Date();
  const formatFutureDate = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return [
    {
      id: "prod-1",
      code: "24657",
      name: "BISCOITO RECHEADO CHOCOLATE",
      packaging: "1X130 GR",
      validity: formatFutureDate(12),
      price: "2,49",
      unit: "UND",
      stock: "140 UND",
      badge: "oferta",
      image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-2",
      code: "10982",
      name: "CAFÉ TORRADO E MOÍDO TRADICIONAL",
      packaging: "1X500 GR",
      validity: formatFutureDate(18),
      price: "14,90",
      unit: "UND",
      stock: "85 UND",
      badge: "imperdivel",
      image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-3",
      code: "33104",
      name: "LEITE UHT INTEGRAL",
      packaging: "1X1 L",
      validity: formatFutureDate(8),
      price: "4,69",
      unit: "UND",
      stock: "220 UND",
      badge: "leve",
      image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-4",
      code: "48201",
      name: "MOLHO DE TOMATE TRADICIONAL SACHÊ",
      packaging: "1X300 GR",
      validity: formatFutureDate(15),
      price: "1,99",
      unit: "UND",
      stock: "310 UND",
      badge: "oferta",
      image: "https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-5",
      code: "59144",
      name: "MACARRÃO ESPAGUETE SÊMOLA",
      packaging: "1X500 GR",
      validity: formatFutureDate(22),
      price: "3,79",
      unit: "UND",
      stock: "180 UND",
      badge: "nenhum",
      image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-6",
      code: "62389",
      name: "MAIONESE TRADICIONAL POTE",
      packaging: "1X500 GR",
      validity: formatFutureDate(10),
      price: "5,89",
      unit: "UND",
      stock: "95 UND",
      badge: "leve",
      image: "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-7",
      code: "71045",
      name: "AZEITE DE OLIVA EXTRA VIRGEM",
      packaging: "1X500 ML",
      validity: formatFutureDate(30),
      price: "29,90",
      unit: "UND",
      stock: "42 UND",
      badge: "imperdivel",
      image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-8",
      code: "84920",
      name: "SUCO INTEGRAL DE UVA GARRAFA",
      packaging: "1X1,5 L",
      validity: formatFutureDate(14),
      price: "11,99",
      unit: "UND",
      stock: "60 UND",
      badge: "oferta",
      image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-9",
      code: "92831",
      name: "ARROZ TIPO 1 BENEFICIADO",
      packaging: "1X5 KG",
      validity: formatFutureDate(25),
      price: "22,90",
      unit: "UND",
      stock: "",
      badge: "oferta",
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-10",
      code: "93120",
      name: "FEIJÃO CARIOCA ESPECIAL",
      packaging: "1X1 KG",
      validity: formatFutureDate(20),
      price: "6,99",
      unit: "UND",
      stock: "110 UND",
      badge: "leve",
      image: "", // Imagem ausente proposital para testar fallback de placeholder neutro
      included: true,
    },
    {
      id: "prod-11",
      code: "94511",
      name: "ACHOCOLATADO EM PÓ INSTANTÂNEO",
      packaging: "1X400 GR",
      validity: formatFutureDate(16),
      price: "5,49",
      unit: "UND",
      stock: "75 UND",
      badge: "nenhum",
      image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&auto=format&fit=crop&q=80",
      included: true,
    },
    {
      id: "prod-12",
      code: "95632",
      name: "SABÃO EM PÓ CONCENTRADO",
      packaging: "1X800 GR",
      validity: formatFutureDate(45),
      price: "10,90",
      unit: "UND",
      stock: "130 UND",
      badge: "imperdivel",
      image: "",
      included: true,
    },
    {
      id: "prod-13",
      code: "96700",
      name: "DESINFETANTE PERFUMADO LAVANDA",
      packaging: "1X2 L",
      validity: formatFutureDate(60),
      price: "7,49",
      unit: "UND",
      stock: "90 UND",
      badge: "oferta",
      image: "",
      included: true,
    },
    {
      id: "prod-14",
      code: "97811",
      name: "CREME DENTAL TRIPLA AÇÃO",
      packaging: "1X90 GR",
      validity: formatFutureDate(35),
      price: "3,29",
      unit: "UND",
      stock: "250 UND",
      badge: "leve",
      image: "",
      included: true,
    },
    {
      id: "prod-15",
      code: "98922",
      name: "DETERGENTE LÍQUIDO NEUTRO",
      packaging: "1X500 ML",
      validity: formatFutureDate(50),
      price: "2,19",
      unit: "UND",
      stock: "320 UND",
      badge: "oferta",
      image: "",
      included: true,
    },
    {
      id: "prod-16",
      code: "99033",
      name: "PAPEL HIGIÊNICO FOLHA DUPLA 12 ROLOS",
      packaging: "1X30 M",
      validity: formatFutureDate(90),
      price: "16,90",
      unit: "PCT",
      stock: "80 UND",
      badge: "imperdivel",
      image: "",
      included: true,
    },
  ];
}
