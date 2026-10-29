import type { EncarteProduct } from "@/types/encarte";
import { formatPrice } from "./parse-product";

export interface SpreadsheetValidationResult {
  success: boolean;
  validProducts: EncarteProduct[];
  errors: { line: number; message: string; raw?: any }[];
  totalRows: number;
}

/**
 * Normaliza os nomes de cabeçalhos para identificar as colunas esperadas:
 * código, descrição/nome, embalagem, estoque e validade.
 */
function normalizeHeader(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Converte data de planilha (número serial do Excel ou texto) para dd/mm/aaaa.
 */
function formatSpreadsheetDate(raw: any, SSF?: any): string {
  if (raw === undefined || raw === null || raw === "") return "";

  // Se for número serial de data do Excel
  if (typeof raw === "number" && SSF) {
    try {
      const parsed = SSF.parse_date_code(raw);
      if (parsed) {
        const d = String(parsed.d).padStart(2, "0");
        const m = String(parsed.m).padStart(2, "0");
        const y = parsed.y;
        return `${d}/${m}/${y}`;
      }
    } catch {
      /* ignore */
    }
  }

  const str = String(raw).trim();
  // Se já for formato dd/mm/aaaa ou dd-mm-aaaa
  const brMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    const d = (brMatch[1] ?? "").padStart(2, "0");
    const m = (brMatch[2] ?? "").padStart(2, "0");
    let y = brMatch[3] ?? "";
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }

  // Se for formato aaaa-mm-dd (ISO)
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1] ?? "";
    const m = (isoMatch[2] ?? "").padStart(2, "0");
    const d = (isoMatch[3] ?? "").padStart(2, "0");
    return `${d}/${m}/${y}`;
  }

  return str;
}

/**
 * Lê arquivo .xlsx ou .csv como ArrayBuffer ou string e retorna os produtos validados.
 * Trata código como texto (preservando zeros à esquerda e removendo espaços nas bordas).
 */
export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetValidationResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  // read com { raw: false } para manter formato de texto quando possível
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      success: false,
      validProducts: [],
      errors: [{ line: 1, message: "A planilha está vazia ou não possui abas válidas." }],
      totalRows: 0,
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return {
      success: false,
      validProducts: [],
      errors: [{ line: 1, message: "A planilha está vazia ou não possui abas válidas." }],
      totalRows: 0,
    };
  }
  // Converter para linhas com cabeçalho
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: "",
  });

  if (rows.length === 0) {
    return {
      success: false,
      validProducts: [],
      errors: [{ line: 1, message: "Nenhum registro encontrado na planilha." }],
      totalRows: 0,
    };
  }

  // Identificar mapeamento de colunas
  const sampleRow = rows[0] || {};
  const headerKeys = Object.keys(sampleRow);

  let codeKey: string | undefined;
  let nameKey: string | undefined;
  let packagingKey: string | undefined;
  let stockKey: string | undefined;
  let validityKey: string | undefined;
  let priceKey: string | undefined;

  headerKeys.forEach((key) => {
    const norm = normalizeHeader(key);
    if (!codeKey && (norm.includes("codigo") || norm.includes("cod") || norm === "id" || norm === "sku")) {
      codeKey = key;
    } else if (!nameKey && (norm.includes("descricao") || norm.includes("nome") || norm.includes("produto") || norm.includes("item"))) {
      nameKey = key;
    } else if (!packagingKey && (norm.includes("embalagem") || norm.includes("emb") || norm.includes("unidade") || norm.includes("apresentacao") || norm.includes("pacote"))) {
      packagingKey = key;
    } else if (!stockKey && (norm.includes("estoque") || norm.includes("qtd") || norm.includes("quantidade") || norm.includes("saldo"))) {
      stockKey = key;
    } else if (!validityKey && (norm.includes("validade") || norm.includes("vencimento") || norm.includes("val") || norm.includes("data"))) {
      validityKey = key;
    } else if (!priceKey && (norm.includes("preco") || norm.includes("valor") || norm.includes("unitario"))) {
      priceKey = key;
    }
  });

  // Se não encontrou código por aproximação semântica, usa a 1ª coluna como código
  if (!codeKey && headerKeys.length > 0) codeKey = headerKeys[0];
  // Se não encontrou nome, usa a 2ª coluna
  if (!nameKey && headerKeys.length > 1) nameKey = headerKeys[1];

  const validProducts: EncarteProduct[] = [];
  const errors: { line: number; message: string; raw?: any }[] = [];
  const seenCodes = new Map<string, number>(); // código -> número da linha anterior

  rows.forEach((row, index) => {
    const lineNumber = index + 2; // +1 cabeçalho, +1 index base-1

    // Tratar código como TEXTO preservando zeros à esquerda e removendo espaços
    const rawCodeVal = codeKey ? row[codeKey] : "";
    const code = rawCodeVal !== undefined && rawCodeVal !== null ? String(rawCodeVal).trim() : "";

    // 1. Linha sem código -> Erro bloqueante dessa linha
    if (!code) {
      errors.push({
        line: lineNumber,
        message: `Linha ${lineNumber}: Código do produto ausente ou em branco.`,
        raw: row,
      });
      return;
    }

    // 2. Código duplicado -> Erro
    if (seenCodes.has(code)) {
      const prevLine = seenCodes.get(code);
      errors.push({
        line: lineNumber,
        message: `Linha ${lineNumber}: Código duplicado '${code}' (já cadastrado na linha ${prevLine}).`,
        raw: row,
      });
      return;
    }
    seenCodes.set(code, lineNumber);

    // Nome / Descrição
    const rawName = nameKey ? String(row[nameKey] ?? "").trim() : "";
    const name = (rawName || `PRODUTO ${code}`).toUpperCase().slice(0, 120);

    // Embalagem (opcional, ex: "1X10 GR")
    let packaging = packagingKey ? String(row[packagingKey] ?? "").trim().toUpperCase() : "";
    if (!packaging) {
      const packMatch =
        name.match(/(\d+\s*X\s*\d+\s*(?:GR|G|KG|ML|L|UN))\b/i) ||
        name.match(/(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i);
      if (packMatch) packaging = (packMatch[1] ?? "").replace(/\s+/g, " ");
      else packaging = "";
    }

    // Estoque (opcional)
    const rawStock = stockKey ? String(row[stockKey] ?? "").trim() : "";
    let stock = "";
    if (rawStock) {
      const stockDigits = rawStock.replace(/[^\d]/g, "");
      if (stockDigits) stock = `${stockDigits} UND`;
    }

    // Validade (opcional, dd/mm/aaaa)
    const rawVal = validityKey ? row[validityKey] : "";
    const validity = formatSpreadsheetDate(rawVal, XLSX.SSF);

    // Preço (inicia em branco conforme regra de negócio)
    const rawPrice = priceKey ? formatPrice(row[priceKey]) : "";

    validProducts.push({
      id: `prod-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      packaging: packaging || "1 UN",
      validity,
      price: rawPrice || "", // Preço vazio inicialmente
      unit: packaging.toLowerCase().includes("kg") ? "KG" : "UND",
      stock,
      badge: "nenhum",
      image: "",
      included: true,
    });
  });

  return {
    success: errors.length === 0,
    validProducts,
    errors,
    totalRows: rows.length,
  };
}
