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
import {
  cleanPrincipalDescription,
  lookupProductByCode,
  fetchCescomProductOnline,
} from "./encarte-semanal-catalog";

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

  // 4. Identificar coluna de Principal opcional (ex: "Principal", "Destaque", "Flag")
  const principalKey = headerKeys.find((k) => {
    const n = normalizeHeader(k);
    return (
      n.includes("principal") ||
      n.includes("destaque") ||
      n.includes("master") ||
      n === "flag"
    );
  });

  const warnings: string[] = [];
  const errors: string[] = [];
  const products: EncarteSemanalProduct[] = [];
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // Linha humana considerando cabeçalho na linha 1
    const rawCode = row[codeKey];
    let code = normalizeProductCode(rawCode);
    let description = String(row[descKey] || "").trim();
    const isPrincipalFlag = principalKey ? parseBooleanFlag(row[principalKey]) : false;
    const limit = limitKey && row[limitKey] ? String(row[limitKey]).trim() : undefined;

    // Se ambos estão vazios, ignora
    if (!code && !description) {
      warnings.push(`Linha ${rowNumber} ignorada: Código de produto e descrição vazios.`);
      return;
    }

    // Validação 1.1: Ignorar linha de cabeçalho duplicada (ex: linha onde código é "Codprod", "Código", etc.)
    const lowerCode = code.toLowerCase().trim();
    const isHeaderRow =
      lowerCode === "codprod" ||
      lowerCode === "codigo" ||
      lowerCode === "código" ||
      lowerCode === "cod" ||
      lowerCode === "cód" ||
      lowerCode === "sku" ||
      lowerCode === "id" ||
      lowerCode === "referencia" ||
      lowerCode === "ref";

    if (isHeaderRow) {
      // Ignora silenciosamente a linha de cabeçalho
      return;
    }

    // Se for linha explicitamente marcada como Principal pelo cabeçalho
    if (isPrincipalFlag) {
      const originalCode = code;
      const originalDescription = description;
      const cleanDesc = description ? cleanPrincipalDescription(description) : "";

      products.push({
        id: `semanal_${originalCode || "principal"}_${index}`,
        code: "",
        description: cleanDesc,
        isPrincipal: true,
        limit,
        scale: 1.15,
        offsetX: 0,
        offsetY: 0,
        overlapY: 8,
        included: true,
        originalCode,
        originalDescription,
      });
      return;
    }

    // Validação 1: Código vazio para linhas normais
    if (!code) {
      warnings.push(`Linha ${rowNumber} ignorada: Código de produto vazio ou não informado.`);
      return;
    }

    // Validação 2: Código duplicado (apenas para itens normais com código preenchido)
    if (seenCodes.has(code.toLowerCase())) {
      warnings.push(
        `Código duplicado "${code}" detectado na linha ${rowNumber}. Apenas a primeira ocorrência foi incluída.`
      );
      return;
    }
    seenCodes.add(code.toLowerCase());

    const originalCode = code;
    const originalDescription = description;

    if (!description) {
      const fallbackDesc = findKnownDescriptionFromAcompanhamento(code);
      if (fallbackDesc) {
        description = fallbackDesc;
      } else {
        const lookedUp = lookupProductByCode(code);
        if (lookedUp && lookedUp.description && !lookedUp.description.startsWith("PRODUTO ")) {
          description = lookedUp.description;
        } else {
          description = `PRODUTO ${code}`;
          warnings.push(
            `Código ${code} na linha ${rowNumber} está sem descrição. Usando "${description}".`
          );
        }
      }
    }

    products.push({
      id: `semanal_${originalCode}_${index}`,
      code,
      description,
      isPrincipal: false,
      limit,
      scale: 1.15,
      offsetX: 0,
      offsetY: 0,
      overlapY: 8,
      included: true,
      originalCode,
      originalDescription,
    });
  });

  // Se houver produtos sem descrição preenchida na planilha, tenta buscar automaticamente do site https://www.cescom.com.br/
  const missingDescProds = products.filter(
    (p) => !p.description || p.description.startsWith("PRODUTO ")
  );
  if (missingDescProds.length > 0) {
    try {
      await Promise.all(
        missingDescProds.slice(0, 20).map(async (p) => {
          const online = await fetchCescomProductOnline(p.originalCode || p.code);
          if (online && online.description && !online.description.startsWith("PRODUTO ")) {
            p.description = online.description;
            if (!p.image && online.image) {
              p.image = online.image;
            }
          }
        })
      );
    } catch {}
  }

  return {
    success: products.length > 0,
    products,
    warnings,
    errors,
    totalRows: rows.length,
    validRows: products.length,
  };
}
