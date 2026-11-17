/**
 * Parser de Planilha Winthor / WMS para o Painel de Validade
 *
 * Suporta:
 * - CSV com delimitador ';' e quebra CRLF/LF
 * - Codificação ISO-8859-1 (Windows-1252) e UTF-8
 * - Arquivos Excel (.xlsx / .xls)
 * - Números decimais com vírgula (ex: 2,9)
 * - Datas no formato dd/mm/aaaa
 * - Normalização de colunas sem acento, sem dois-pontos e sem espaços
 */

import type { ValidadeLoteRaw, ValidadePreviewImport } from "@/types/painel-validade";

// Colunas mínimas estritamente obrigatórias para o cálculo de validade e risco
export const OBRIGATORIAS = [
  "codprod",
  "descricao",
  "dtval",
  "qtdisp_wms",
  "preco_venda",
] as const;

/**
 * Normaliza o cabeçalho de uma coluna para chave padronizada em minúsculas
 */
export function normalizeHeaderKey(header: string): string {
  if (!header) return "";
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/^:+/, "")              // Remove ':' inicial (ex: :DATAINICIAL)
    .replace(/[^a-z0-9_]/g, "");     // Mantém apenas alfanumérico e sublinhado
}

/**
 * Mapeia as variantes de cabeçalhos das exportações Winthor / WMS
 */
export function mapHeaderToField(headerKey: string): keyof ValidadeLoteRaw | null {
  const k = normalizeHeaderKey(headerKey);

  if (k === "codprod" || k === "codigo" || k === "cod_prod" || k === "cod") return "codprod";
  if (k === "descricao" || k === "produto" || k === "desc" || k === "ds_prod") return "descricao";
  if (k === "embalagem" || k === "emb") return "embalagem";
  if (k === "dtval" || k === "datavalidade" || k === "validade" || k === "dt_val") return "dtval";
  if (k === "diasavencer" || k === "dias_a_vencer" || k === "diasvencer") return "diasavencer";
  if (k === "prazoval" || k === "prazo_val") return "prazoval";
  if (k === "tolerancia" || k === "percenttolerancia" || k === "pcttolerancia") return "percentTolerancia";
  if (k === "qtreserv" || k === "qt_reserv") return "qtreserv";
  if (k === "qtdisp_wms" || k === "qtdispwms" || k === "qt_disp_wms" || k === "estoque") return "qtdisp_wms";
  if (k === "qtest_winthor" || k === "qtestwinthor") return "qtest_winthor";
  if (k === "qtvendmes" || k === "vendmes" || k === "venda_mes") return "qtvendmes";
  if (k === "qtvendmes1" || k === "vendmes1" || k === "venda_m1") return "qtvendmes1";
  if (k === "qtvendmes2" || k === "vendmes2" || k === "venda_m2") return "qtvendmes2";
  if (k === "qtvendmes3" || k === "vendmes3" || k === "venda_m3") return "qtvendmes3";
  if (
    k === "preco_venda" ||
    k === "precovenda" ||
    k === "pvenda" ||
    k === "preco" ||
    k === "preo_venda" ||
    k === "preovenda"
  ) return "preco_venda";
  if (
    k === "preco_total" ||
    k === "precototal" ||
    k === "ptotal" ||
    k === "preo_total" ||
    k === "preototal"
  ) return "preco_total";
  if (k === "status") return "status";
  if (k === "datainicial" || k === "dtinicial") return "datainicial";
  if (k === "datafinal" || k === "dtfinal") return "datafinal";
  if (k === "codcomprador" || k === "cod_comprador") return "codcomprador";
  if (k === "nome" || k === "comprador" || k === "nomecomprador" || k === "comprador_nome") return "nomeComprador";
  if (k === "lote" || k === "numlote" || k === "nu_lote") return "loteNumero";

  return null;
}

/**
 * Converte string brasileira com vírgula ou ponto em número
 */
export function parseBrazilianNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;

  // Trata formato brasileiro: "1.250,50" -> "1250.50" ou "2,9" -> "2.9"
  let clean = str.replace(/[^\d.,-]/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza data para dd/mm/aaaa
 */
export function normalizeDateString(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const dd = String(val.getDate()).padStart(2, "0");
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    const yyyy = val.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const str = String(val).trim();
  // Se for ISO yyyy-mm-dd
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // Se já for dd/mm/aaaa ou dd/mm/aa
  const brMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brMatch) {
    const dd = brMatch[1].padStart(2, "0");
    const mm = brMatch[2].padStart(2, "0");
    let yyyy = brMatch[3];
    if (yyyy.length === 2) {
      yyyy = "20" + yyyy;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

/**
 * Detecta e decodifica texto para UTF-8 lidando com ISO-8859-1 / Windows-1252
 */
export function decodeBufferToString(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Tenta primeiro UTF-8 estrito
  try {
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch {
    // Se falhar com erro de byte inválido, decodifica como Windows-1252 / ISO-8859-1
    try {
      const winDecoder = new TextDecoder("windows-1252");
      return winDecoder.decode(bytes);
    } catch {
      // Fallback padrão
      const fallbackDecoder = new TextDecoder("iso-8859-1");
      return fallbackDecoder.decode(bytes);
    }
  }
}

/**
 * Separa linhas de CSV respeitando aspas
 */
export function splitCsvLines(csvText: string): string[] {
  return csvText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Separa campos de uma linha CSV por ';' ou ','
 */
export function splitCsvRow(rowText: string, delimiter: string = ";"): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (insideQuotes && rowText[i + 1] === '"') {
        current += '"';
        i++; // pula aspa duplicada
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Analisa o texto CSV do Winthor/WMS e retorna a lista de lotes brutos e relatório de prévia
 */
export function parseWinthorCsv(
  csvContent: string | ArrayBuffer | Uint8Array,
  nomeArquivo: string = "planilha-validade.csv",
  lotesExistentes: ValidadeLoteRaw[] = []
): ValidadePreviewImport {
  const text =
    typeof csvContent === "string" ? csvContent : decodeBufferToString(csvContent);

  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return {
      nomeArquivo,
      totalLinhasLidas: 0,
      lotesValidos: [],
      linhasComErro: [{ linha: 0, erro: "Arquivo vazio", conteudo: "" }],
      totalProdutosNovos: 0,
      totalProdutosSairam: 0,
      totalLotesAlterados: 0,
      colunasDetectadas: [],
      colunasFaltantes: [...OBRIGATORIAS],
    };
  }

  // Detecta delimitador na primeira linha (; ou ,)
  const headerLine = lines[0];
  const countSemicolon = (headerLine.match(/;/g) || []).length;
  const countComma = (headerLine.match(/,/g) || []).length;
  const delimiter = countSemicolon >= countComma ? ";" : ",";

  const rawHeaders = splitCsvRow(headerLine, delimiter);
  const headerMap: Array<{ index: number; field: keyof ValidadeLoteRaw }> = [];
  const colunasDetectadas: string[] = [];

  rawHeaders.forEach((h, idx) => {
    const field = mapHeaderToField(h);
    if (field) {
      headerMap.push({ index: idx, field });
      colunasDetectadas.push(field);
    }
  });

  // Verifica colunas obrigatórias
  const colunasFaltantes = OBRIGATORIAS.filter(
    (obrig) => !colunasDetectadas.includes(obrig)
  );

  if (colunasFaltantes.length > 0) {
    return {
      nomeArquivo,
      totalLinhasLidas: lines.length,
      lotesValidos: [],
      linhasComErro: [
        {
          linha: 1,
          erro: `Colunas obrigatórias ausentes: ${colunasFaltantes.join(", ")}`,
          conteudo: headerLine,
        },
      ],
      totalProdutosNovos: 0,
      totalProdutosSairam: 0,
      totalLotesAlterados: 0,
      colunasDetectadas,
      colunasFaltantes,
    };
  }

  const lotesValidos: ValidadeLoteRaw[] = [];
  const linhasComErro: ValidadePreviewImport["linhasComErro"] = [];

  // Cria mapas de lotes e produtos existentes para calcular novidades
  const existingProductCodes = new Set(lotesExistentes.map((l) => l.codprod));
  const existingBatchMap = new Map<string, ValidadeLoteRaw>();
  lotesExistentes.forEach((l) => {
    const key = `${l.codprod}_${l.dtval}_${l.loteNumero || ""}`;
    existingBatchMap.set(key, l);
  });

  let totalLotesAlterados = 0;

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    if (!line || line.startsWith("---") || line.toLowerCase().includes("total")) {
      continue;
    }

    const row = splitCsvRow(line, delimiter);
    const item: Partial<ValidadeLoteRaw> = {};

    headerMap.forEach(({ index, field }) => {
      const val = row[index];
      if (val !== undefined) {
        if (
          field === "qtdisp_wms" ||
          field === "qtreserv" ||
          field === "qtest_winthor" ||
          field === "qtvendmes" ||
          field === "qtvendmes1" ||
          field === "qtvendmes2" ||
          field === "qtvendmes3" ||
          field === "preco_venda" ||
          field === "preco_total" ||
          field === "diasavencer" ||
          field === "prazoval" ||
          field === "percentTolerancia"
        ) {
          (item as Record<string, unknown>)[field] = parseBrazilianNumber(val);
        } else if (field === "dtval" || field === "datainicial" || field === "datafinal") {
          (item as Record<string, unknown>)[field] = normalizeDateString(val);
        } else {
          (item as Record<string, unknown>)[field] = String(val).trim();
        }
      }
    });

    // Validações mínimas da linha
    const codprod = String(item.codprod || "").trim();
    const descricao = String(item.descricao || "").trim();
    const dtval = String(item.dtval || "").trim();

    if (!codprod) {
      linhasComErro.push({
        linha: lineNum,
        erro: "Código do produto vazio",
        conteudo: line,
      });
      continue;
    }

    if (!dtval) {
      linhasComErro.push({
        linha: lineNum,
        erro: "Data de validade vazia ou inválida",
        conteudo: line,
      });
      continue;
    }

    const loteRaw: ValidadeLoteRaw = {
      codprod,
      descricao: descricao || `PRODUTO ${codprod}`,
      embalagem: item.embalagem || "UND",
      dtval,
      diasavencer: item.diasavencer,
      prazoval: item.prazoval,
      percentTolerancia: item.percentTolerancia,
      qtreserv: item.qtreserv || 0,
      qtdisp_wms: item.qtdisp_wms || 0,
      qtest_winthor: item.qtest_winthor,
      qtvendmes: item.qtvendmes || 0,
      qtvendmes1: item.qtvendmes1 || 0,
      qtvendmes2: item.qtvendmes2 || 0,
      qtvendmes3: item.qtvendmes3 || 0,
      preco_venda: item.preco_venda || 0,
      preco_total: item.preco_total,
      status: item.status,
      datainicial: item.datainicial,
      datafinal: item.datafinal,
      codcomprador: item.codcomprador || "",
      nomeComprador: item.nomeComprador || "",
      loteNumero: item.loteNumero || "",
    };

    // Verifica alterações em lote existente
    const batchKey = `${loteRaw.codprod}_${loteRaw.dtval}_${loteRaw.loteNumero || ""}`;
    const previous = existingBatchMap.get(batchKey);
    if (previous) {
      if (
        previous.qtdisp_wms !== loteRaw.qtdisp_wms ||
        previous.preco_venda !== loteRaw.preco_venda
      ) {
        totalLotesAlterados++;
      }
    }

    lotesValidos.push(loteRaw);
  }

  // Contagem de novidades
  const newProductCodes = new Set(lotesValidos.map((l) => l.codprod));
  let totalProdutosNovos = 0;
  newProductCodes.forEach((code) => {
    if (!existingProductCodes.has(code)) totalProdutosNovos++;
  });

  let totalProdutosSairam = 0;
  existingProductCodes.forEach((code) => {
    if (!newProductCodes.has(code)) totalProdutosSairam++;
  });

  return {
    nomeArquivo,
    totalLinhasLidas: lines.length - 1,
    lotesValidos,
    linhasComErro,
    totalProdutosNovos,
    totalProdutosSairam,
    totalLotesAlterados,
    colunasDetectadas,
    colunasFaltantes,
  };
}

/**
 * Lê arquivo Excel (.xlsx ou .xls) convertendo a primeira aba para lotes brutos
 */
export async function parseWinthorXlsx(
  buffer: ArrayBuffer | Uint8Array,
  nomeArquivo: string = "planilha-validade.xlsx",
  lotesExistentes: ValidadeLoteRaw[] = []
): Promise<ValidadePreviewImport> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      nomeArquivo,
      totalLinhasLidas: 0,
      lotesValidos: [],
      linhasComErro: [{ linha: 0, erro: "Planilha sem abas", conteudo: "" }],
      totalProdutosNovos: 0,
      totalProdutosSairam: 0,
      totalLotesAlterados: 0,
      colunasDetectadas: [],
      colunasFaltantes: [...OBRIGATORIAS],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
  return parseWinthorCsv(csv, nomeArquivo, lotesExistentes);
}
