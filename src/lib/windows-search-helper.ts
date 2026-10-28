/**
 * Utilitário para gerar consultas de pesquisa do Windows Explorer (AQS)
 * a partir dos códigos de produtos da campanha.
 *
 * Formato padrão: NOME:="14512.png" OR NOME:="221.png" OR NOME:="44.png"
 */

export type WindowsSearchExtension = "png" | "jpg" | "ambas";

export interface WindowsSearchBatch {
  batchIndex: number;
  totalBatches: number;
  codesCount: number;
  codes: string[];
  query: string;
  charCount: number;
  isAboveSafeLimit: boolean;
}

export interface WindowsSearchQueryResult {
  totalCodes: number;
  uniqueCodes: string[];
  batches: WindowsSearchBatch[];
  extension: WindowsSearchExtension;
  batchSize: number;
  hasSafeLimitWarning: boolean;
}

/**
 * Limpa e extrai códigos únicos a partir de uma lista ou de produtos,
 * preservando zeros à esquerda (ex.: "0221" continua "0221") e removendo
 * aspas, espaços vazios e duplicatas.
 */
export function extractUniqueProductCodes(rawCodes: (string | number)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawCodes) {
    if (item === undefined || item === null) continue;
    // Converte para string mantendo zeros à esquerda e remove aspas
    const str = String(item).replace(/["']/g, "").trim();
    if (!str) continue;

    if (!seen.has(str)) {
      seen.add(str);
      result.push(str);
    }
  }

  return result;
}

/**
 * Constrói uma query de pesquisa única para uma lista de códigos e extensão especificada.
 * Formato: NOME:="{codigo}.png" OR NOME:="{codigo}.jpg"
 * Sem quebras de linha e sem espaços extras no fim.
 */
export function buildSingleQueryString(
  codes: (string | number)[],
  extension: WindowsSearchExtension
): string {
  const uniqueCodes = extractUniqueProductCodes(codes);
  const terms: string[] = [];

  for (const clean of uniqueCodes) {
    if (!clean) continue;

    if (extension === "png") {
      terms.push(`NOME:="${clean}.png"`);
    } else if (extension === "jpg") {
      terms.push(`NOME:="${clean}.jpg"`);
    } else if (extension === "ambas") {
      terms.push(`NOME:="${clean}.png"`);
      terms.push(`NOME:="${clean}.jpg"`);
    }
  }

  return terms.join(" OR ");
}

/**
 * Gera a consulta de busca para o Windows dividida em lotes ajustáveis.
 * Tamanho padrão: 30 códigos por lote.
 */
export function generateWindowsSearchBatches(
  rawCodes: (string | number)[],
  options: {
    extension?: WindowsSearchExtension;
    batchSize?: number;
  } = {}
): WindowsSearchQueryResult {
  const extension = options.extension || "png";
  const rawBatchSize = options.batchSize ?? 30;
  const batchSize = Math.max(1, Math.min(200, rawBatchSize));

  const uniqueCodes = extractUniqueProductCodes(rawCodes);
  const totalCodes = uniqueCodes.length;

  if (totalCodes === 0) {
    return {
      totalCodes: 0,
      uniqueCodes: [],
      batches: [],
      extension,
      batchSize,
      hasSafeLimitWarning: false,
    };
  }

  const totalBatches = Math.ceil(totalCodes / batchSize);
  const batches: WindowsSearchBatch[] = [];
  let hasSafeLimitWarning = false;

  for (let i = 0; i < totalCodes; i += batchSize) {
    const chunk = uniqueCodes.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const query = buildSingleQueryString(chunk, extension);
    const charCount = query.length;

    // Alerta se passar do limite seguro do Windows Explorer (mais de 50 códigos por lote ou query muito longa)
    const isAboveSafeLimit = chunk.length > 50 || charCount > 2000;
    if (isAboveSafeLimit) {
      hasSafeLimitWarning = true;
    }

    batches.push({
      batchIndex,
      totalBatches,
      codesCount: chunk.length,
      codes: chunk,
      query,
      charCount,
      isAboveSafeLimit,
    });
  }

  return {
    totalCodes,
    uniqueCodes,
    batches,
    extension,
    batchSize,
    hasSafeLimitWarning,
  };
}

/**
 * Copia o texto da consulta para a área de transferência com fallback.
 */
export async function copyQueryToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard falhou, usando fallback:", err);
  }

  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    }
  } catch (fallbackErr) {
    console.error("Falha ao copiar consulta:", fallbackErr);
  }

  return false;
}
