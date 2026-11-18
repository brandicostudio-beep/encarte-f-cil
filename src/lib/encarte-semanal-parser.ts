/**
 * Parser de Planilha para o Encarte Semanal (.xlsx e .csv)
 * Identifica colunas pelo cabeçalho sem depender da ordem.
 * Ignora colunas desnecessárias (preço, validade, estoque, etc.).
 * Gera avisos para códigos vazios e duplicados sem criar produtos em branco.
 * Se a descrição estiver vazia, busca a descrição no acompanhamento quando houver.
 */

import type {
  EncarteSemanalProduct,
  EncarteSemanalImportResult,
} from "@/types/encarte-semanal";
import { normalizeHeader } from "./spreadsheet-parser";
import { getActiveSnapshot } from "./painel-validade-storage";

/**
 * Normaliza código de produto (remove espaços, pontos e zeros à esquerda desnecessários)
 */
export function normalizeProductCode(rawCode: any): string {
  if (rawCode === null || rawCode === undefined) return "";
  const str = String(rawCode).trim();
  // Se for notação científica (ex: 2.4657e4), converte para número
  if (/^[0-9]+(\.[0-9]+)?e[+-]?[0-9]+$/i.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) return String(Math.round(num));
  }
  return str;
}

/**
 * Busca descrição já existente no acompanhamento / snapshot da Rotina 8230 para o mesmo código.
 */
export function findKnownDescriptionFromAcompanhamento(code: string): string | undefined {
  if (!code) return undefined;
  try {
    const snapshot = getActiveSnapshot();
    if (snapshot && snapshot.lotes) {
      const cleanTarget = code.trim().toLowerCase();
      const found = snapshot.lotes.find(
        (l) => l.codprod && l.codprod.trim().toLowerCase() === cleanTarget
      );
      if (found && found.descricao && found.descricao.trim()) {
        return found.descricao.trim();
      }
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Lê o arquivo (.xlsx ou .csv) e converte em EncarteSemanalProduct[]
 */
export async function parseEncarteSemanalSpreadsheet(
  file: File | ArrayBuffer,
  fileName = "planilha.xlsx"
): Promise<EncarteSemanalImportResult> {
  const XLSX = await import("xlsx");
  let buffer: ArrayBuffer;

  if (file instanceof ArrayBuffer) {
    buffer = file;
  } else if (typeof (file as any)?.arrayBuffer === "function") {
    buffer = await (file as File).arrayBuffer();
    fileName = (file as File).name;
  } else {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file as File);
    });
    if ((file as File).name) {
      fileName = (file as File).name;
    }
  }

  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
    ...(isCsv ? { codepage: 65001 } : {}),
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
    return {
      success: false,
      products: [],
      warnings: ["A planilha está vazia ou sem abas válidas."],
      errors: ["Planilha sem dados."],
      totalRows: 0,
      validRows: 0,
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
      warnings: ["Nenhum registro encontrado na planilha."],
      errors: ["Planilha sem linhas de produtos."],
      totalRows: 0,
      validRows: 0,
    };
  }

  const sampleRow = rows[0] || {};
  const headerKeys = Object.keys(sampleRow);

  // 1. Identificar coluna do Código
  const codeKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return (
        n === "codprod" ||
        n === "cod" ||
        n === "codigo" ||
        n === "cód" ||
        n === "código" ||
        n === "cod_prod" ||
        n === "cod_produto" ||
        n === "id" ||
        n === "sku" ||
        n === "referencia" ||
        n === "ref"
      );
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n.includes("cod") || n.includes("cód");
    }) ||
    headerKeys[0];

  // 2. Identificar coluna da Descrição
  const descKey =
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return (
        n === "descricao" ||
        n === "descrição" ||
        n === "desc" ||
        n === "descprod" ||
        n === "produto" ||
        n === "nome" ||
        n === "nome_produto" ||
        n === "titulo"
      );
    }) ||
    headerKeys.find((k) => {
      const n = normalizeHeader(k);
      return n.includes("desc") || n.includes("prod");
    }) ||
    headerKeys[1];

  // 3. Identificar coluna de Limite opcional (ex: "LIMITE: 1000CX")
  const limitKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    return n.includes("limit") || n.includes("faixa");
  });

  const warnings: string[] = [];
  const errors: string[] = [];
  const products: EncarteSemanalProduct[] = [];
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // Linha humana considerando cabeçalho na linha 1
    const rawCode = row[codeKey];
    const code = normalizeProductCode(rawCode);

    // Validação 1: Código vazio
    if (!code) {
      warnings.push(`Linha ${rowNumber} ignorada: Código de produto vazio ou não informado.`);
      return;
    }

    // Validação 2: Código duplicado
    if (seenCodes.has(code.toLowerCase())) {
      warnings.push(
        `Código duplicado "${code}" detectado na linha ${rowNumber}. Apenas a primeira ocorrência foi incluída.`
      );
      return;
    }
    seenCodes.add(code.toLowerCase());

    // Obter ou resolver descrição
    let description = String(row[descKey] || "").trim();
    if (!description) {
      const fallbackDesc = findKnownDescriptionFromAcompanhamento(code);
      if (fallbackDesc) {
        description = fallbackDesc;
      } else {
        description = `PRODUTO ${code}`;
        warnings.push(
          `Código ${code} na linha ${rowNumber} está sem descrição. Usando "${description}".`
        );
      }
    }

    const limit = limitKey && row[limitKey] ? String(row[limitKey]).trim() : undefined;

    products.push({
      id: `semanal_${code}_${index}`,
      code,
      description,
      limit,
      scale: 1.15,
      offsetX: 0,
      offsetY: 0,
      overlapY: 8,
      included: true,
      originalCode: code,
      originalDescription: description,
    });
  });

  return {
    success: products.length > 0,
    products,
    warnings,
    errors,
    totalRows: rows.length,
    validRows: products.length,
  };
}
