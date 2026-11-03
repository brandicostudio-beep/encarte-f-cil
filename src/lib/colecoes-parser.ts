import type { ColecaoProduct } from "@/types/colecoes";
import { normalizeHeader } from "./spreadsheet-parser";

export interface ColecaoImportResult {
  success: boolean;
  products: ColecaoProduct[];
  errors: string[];
  totalRows: number;
}

/**
 * Normaliza valores booleanos da planilha (ex: "SIM", "S", "1", "TRUE", "X", "PRINCIPAL")
 */
export function parseBooleanFlag(val: any): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === "sim" ||
    s === "s" ||
    s === "true" ||
    s === "1" ||
    s === "x" ||
    s === "principal" ||
    s === "yes" ||
    s === "y"
  );
}

/**
 * Lê arquivo Excel ou CSV para o Encarte de Coleções.
 * Reconhece: código, descrição, foto (opcional) e flag "Principal".
 */
export async function parseColecaoSpreadsheet(file: File): Promise<ColecaoImportResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
    return {
      success: false,
      products: [],
      errors: ["A planilha está vazia ou sem abas válidas."],
      totalRows: 0,
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: true,
    defval: "",
  });

  if (rows.length === 0) {
    return {
      success: false,
      products: [],
      errors: ["Nenhum registro encontrado na planilha."],
      totalRows: 0,
    };
  }

  const sampleRow = rows[0] || {};
  const headerKeys = Object.keys(sampleRow);

  // Mapeamento de colunas
  const codeKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n === "codprod" || n === "cod" || n === "codigo" || n === "sku" || n === "id";
    }) ||
    headerKeys.find((k) => normalizeHeader(k).includes("cod")) ||
    headerKeys[0];

  const descKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n === "descricao" || n === "desc" || n === "descprod" || n === "produto" || n === "nome";
    }) ||
    headerKeys.find((k) => normalizeHeader(k).includes("desc") || normalizeHeader(k).includes("prod")) ||
    headerKeys[1];

  const imageKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    return n.includes("foto") || n.includes("imagem") || n.includes("img") || n.includes("image");
  });

  const principalKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    return n.includes("principal") || n.includes("destaque") || n.includes("master") || n === "flag";
  });

  const products: ColecaoProduct[] = [];
  const errors: string[] = [];
  const seenCodes = new Map<string, number>();

  rows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const rawCode = codeKey ? row[codeKey] : "";
    const code = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : "";

    if (!code) {
      errors.push(`Linha ${lineNum}: Código do produto ausente.`);
      return;
    }

    const lowerCode = code.toLowerCase();
    if (seenCodes.has(lowerCode)) {
      const prevLine = seenCodes.get(lowerCode);
      errors.push(`Linha ${lineNum}: Código duplicado '${code}' (já cadastrado na linha ${prevLine}).`);
      return;
    }
    seenCodes.set(lowerCode, lineNum);

    const rawDesc = descKey ? String(row[descKey] ?? "").trim() : "";
    const description = rawDesc || `PRODUTO ${code}`;

    const rawImage = imageKey ? String(row[imageKey] ?? "").trim() : "";
    const isPrincipal = principalKey ? parseBooleanFlag(row[principalKey]) : false;

    products.push({
      id: `col-prod-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      description, // A descrição vem da planilha sem edição automática
      image: rawImage,
      isPrincipal,
      included: true,
    });
  });

  return {
    success: errors.length === 0,
    products,
    errors,
    totalRows: rows.length,
  };
}
