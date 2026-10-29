import type { EncarteProduct } from "@/types/encarte";
import { formatPrice, deriveSaleUnit } from "./parse-product";
import { sortProductsByValidityAsc } from "./encarte-helpers";

export interface SpreadsheetValidationResult {
  success: boolean;
  validProducts: EncarteProduct[];
  errors: { line: number; message: string; raw?: any }[];
  totalRows: number;
  identifiedColumns?: {
    code?: string;
    name?: string;
    packaging?: string;
    stock?: string;
    price?: string;
    validity?: string;
  };
}

/**
 * Normaliza os nomes de cabeçalhos para identificar as colunas esperadas:
 * código, descrição/nome, embalagem, estoque e validade.
 */
export function normalizeHeader(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve as colunas da planilha por prioridade semântica estrita,
 * evitando ambiguidades (ex.: confundir CODPROD com CODCOMPRADOR,
 * DESCRICAO com NOME do comprador, ou PRECO_VENDA com PRECO_TOTAL).
 */
export function resolveSpreadsheetHeaders(headerKeys: string[]): {
  codeKey?: string;
  nameKey?: string;
  packagingKey?: string;
  stockKey?: string;
  priceKey?: string;
  validityKey?: string;
} {
  // 1. Código do produto (prioriza CODPROD, CODIGO_PRODUTO; exclui compradores/clientes/fornecedores)
  const codeKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      if (n.includes("comprador") || n.includes("cliente") || n.includes("fornecedor") || n.includes("vend")) return false;
      return n === "codprod" || n === "codproduto" || n === "codigoproduto" || n === "codprodut" || n === "cod" || n === "codigo" || n === "sku" || n === "id";
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return !n.includes("comprador") && !n.includes("cliente") && (n.includes("codigo") || n.includes("cod"));
    }) ||
    headerKeys[0];

  // 2. Descrição / Nome do produto (prioriza DESCRICAO, DESC_PROD; exclui NOME de comprador/vendedor)
  const nameKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      if (n.includes("comprador") || n.includes("cliente") || n.includes("fornecedor") || n.includes("vendedor")) return false;
      return n === "descricao" || n === "descricaoproduto" || n === "descprod" || n === "descproduto" || n === "produto" || n === "nomeproduto";
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return (
        !n.includes("comprador") &&
        !n.includes("cliente") &&
        !n.includes("vendedor") &&
        (n.includes("descricao") || n.includes("produto") || n === "item" || n === "nome")
      );
    }) ||
    headerKeys[1];

  // 3. Embalagem
  const packagingKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    return n.includes("embalagem") || n.includes("emb") || n.includes("unidade") || n.includes("apresentacao") || n.includes("pacote");
  });

  // 4. Estoque (prioriza QTDISP_WMS, depois QTEST_WINTHOR; exclui QTRESERV e vendas do mês)
  const stockKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n === "qtdispwms" || n === "qtdisp" || n.includes("dispwms") || n.includes("qtdisp") || n.includes("estoquedisp");
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n === "qtestwinthor" || n === "qtest" || n.includes("estwinthor") || n.includes("estoquewinthor");
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      if (n.includes("reserv") || n.includes("vend")) return false;
      return n.includes("estoque") || n.includes("saldo") || n.includes("quantidade") || n.includes("qtd");
    });

  // 5. Preço de Venda (prioriza PRECO_VENDA, PREO_VENDA; exclui PRECO_TOTAL, CUSTO e vendas)
  const priceKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      if (n.includes("total") || n.includes("custo") || n.includes("mes") || n.includes("comprador")) return false;
      return n.includes("venda") || n.includes("vnd") || n.includes("unitario");
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      if (n.includes("total") || n.includes("custo") || n.includes("mes") || n.includes("comprador")) return false;
      return n.includes("preco") || n.includes("preo") || n.includes("prec") || n.includes("valor") || n.includes("prc");
    });

  // 6. Validade (prioriza DTVAL, VALIDADE; exclui :DATAINICIAL e :DATAFINAL)
  const validityKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    if (n.includes("inicial") || n.includes("final")) return false;
    return n === "dtval" || n.includes("validade") || n.includes("vencimento") || n === "val" || n.includes("dtvenc");
  });

  return { codeKey, nameKey, packagingKey, stockKey, priceKey, validityKey };
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

  // read com raw: true para evitar distorção de datas brasileiras dd/mm/aaaa para mm/dd/aaaa
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
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
    raw: true,
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

  // Identificar mapeamento de colunas com regras semânticas estritas
  const sampleRow = rows[0] || {};
  const headerKeys = Object.keys(sampleRow);
  const { codeKey, nameKey, packagingKey, stockKey, priceKey, validityKey } = resolveSpreadsheetHeaders(headerKeys);

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

    // Nome / Descrição do produto
    const rawName = nameKey ? String(row[nameKey] ?? "").trim() : "";
    const name = (rawName || `PRODUTO ${code}`).toUpperCase().slice(0, 120);

    // Embalagem (opcional, ex: "1X234 ML", "10X100 GR")
    let packaging = packagingKey ? String(row[packagingKey] ?? "").trim().toUpperCase() : "";
    if (!packaging) {
      const packMatch =
        name.match(/(\d+\s*X\s*\d+\s*(?:GR|G|KG|ML|L|UN))\b/i) ||
        name.match(/(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i);
      if (packMatch) packaging = (packMatch[1] ?? "").replace(/\s+/g, " ");
      else packaging = "";
    }

    // Estoque (opcional, formatado como "43 UND")
    const rawStock = stockKey ? String(row[stockKey] ?? "").trim() : "";
    let stock = "";
    if (rawStock) {
      const stockDigits = rawStock.replace(/[^\d.,]/g, "").trim();
      if (stockDigits) {
        stock = rawStock.toUpperCase().includes("UND") || rawStock.toUpperCase().includes("CX") || rawStock.toUpperCase().includes("PCT")
          ? rawStock.toUpperCase()
          : `${stockDigits} UND`;
      }
    }

    // Validade (opcional, dd/mm/aaaa)
    const rawVal = validityKey ? row[validityKey] : "";
    const validity = formatSpreadsheetDate(rawVal, XLSX.SSF);

    // Preço de venda formatado em moeda (ex: "3" -> "3,00", "24,9" -> "24,90", "4,27" -> "4,27")
    const rawPrice = priceKey ? formatPrice(row[priceKey]) : "";

    validProducts.push({
      id: `prod-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      packaging: packaging || "",
      validity: validity || "",
      price: rawPrice || "",
      unit: deriveSaleUnit(packaging).unit,
      stock,
      badge: "nenhum",
      image: "",
      included: true,
    });
  });

  // Ordena produtos da data de validade mais próxima para a mais longa (vencimento crescente)
  const sortedValidProducts = sortProductsByValidityAsc(validProducts);

  return {
    success: errors.length === 0,
    validProducts: sortedValidProducts,
    errors,
    totalRows: rows.length,
    identifiedColumns: {
      code: codeKey,
      name: nameKey,
      packaging: packagingKey,
      stock: stockKey,
      price: priceKey,
      validity: validityKey,
    },
  };
}
