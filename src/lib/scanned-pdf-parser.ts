import type { EncarteProduct } from "@/types/encarte";
import { normalizeSaleUnit, deriveSaleUnit, formatPrice } from "./parse-product";

export interface ScannedPdfRow {
  code: string;
  description: string;
  validity: string;           // dd/mm/aaaa
  quantity: number;           // quantidade numérica do status NORMAL
  precoManuscrito?: string;   // primeiro número caso haja dois (preço manuscrito)
  status: "NORMAL" | "AVARIA" | string;
  obs?: string;               // anotação (ex: "AVARIA: 5 UND")
  rawText: string;            // trecho original visível para conferência
  needsReview: boolean;       // true se leitura duvidosa, quantidade não numérica ou status desconhecido
  reviewReason?: string;
  pageNumber: number;
}

export interface ScannedPdfReportMetadata {
  reportDate?: string;
  periodStart?: string;
  periodEnd?: string;
  headerColumnsFound: string[];
  headerWarning?: string;
  totalPages: number;
  totalRows: number;
  validRows: number;
  reviewRows: number;
  fileHash?: string;
}

export interface AggregatedScannedProduct {
  code: string;
  description: string;
  validity: string;
  validityEntries: {
    validity: string;
    quantity: number;
    status: string;
    precoManuscrito?: string;
    obs?: string;
  }[];
  totalStock: number;
  precoManuscrito?: string;
  price?: string;
  unit: string;
  unitSource: "manual" | "site" | "padrao";
  packaging: string;
  productUrl?: string;
  image?: string;
  obs?: string;
  needsReview: boolean;
  reviewReasons: string[];
  statusRelatorio?: "novo" | "atualizado" | "fora_do_ultimo_relatorio" | "revisao";
  reportDate?: string;
  originalSnippets: string[];
  included: boolean;
}

export interface ScannedPdfParseResult {
  ok: boolean;
  metadata: ScannedPdfReportMetadata;
  rows: ScannedPdfRow[];
  aggregated: AggregatedScannedProduct[];
  errors: string[];
  warnings: string[];
}

/**
 * Normaliza textos removendo acentos e espaços extras.
 */
export function normalizeReportText(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai metadados do cabeçalho do relatório (Período de Validade e checagem de colunas).
 */
export function extractReportMetadata(
  textLines: string[],
  totalPages = 1
): ScannedPdfReportMetadata {
  const fullText = textLines.join(" ");

  // Busca: "Período de Validade: DD/MM/AAAA a DD/MM/AAAA" ou "Período: DD/MM/AAAA a DD/MM/AAAA"
  let periodStart: string | undefined;
  let periodEnd: string | undefined;
  let reportDate: string | undefined;

  const periodMatch = fullText.match(
    /(?:per[ií]odo(?:\s+de\s+validade)?|validade\s+de)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})(?:\s*(?:a|at[eé]|-)\s*(\d{2}\/\d{2}\/\d{4}))?/i
  );

  if (periodMatch) {
    periodStart = periodMatch[1];
    periodEnd = periodMatch[2];
    reportDate = periodEnd ? `${periodStart} a ${periodEnd}` : periodStart;
  } else {
    // Procura qualquer data solta dd/mm/aaaa no cabeçalho inicial
    const firstDates = fullText.slice(0, 500).match(/\b(\d{2}\/\d{2}\/\d{4})\b/g);
    if (firstDates && firstDates.length >= 1) {
      reportDate = firstDates.length >= 2 ? `${firstDates[0]} a ${firstDates[1]}` : firstDates[0];
      periodStart = firstDates[0];
      periodEnd = firstDates[1];
    }
  }

  // Checagem das colunas padrão: Código, Descrição, Validade, % Tolerância, QtDisp, Status
  const headerColumnsFound: string[] = [];
  const normFull = normalizeReportText(fullText.slice(0, 2000).toUpperCase());

  if (/\b(CODPROD|CODIGO|COD|SKU)\b/.test(normFull)) headerColumnsFound.push("Código");
  if (/\b(DESCRICAO|DESC|PRODUTO|NOME)\b/.test(normFull)) headerColumnsFound.push("Descrição");
  if (/\b(VALIDADE|DTVAL|DT\.VAL|VENCIMENTO)\b/.test(normFull)) headerColumnsFound.push("Validade");
  if (/%?\s*(TOLERANCIA|TOLER)\b/.test(normFull)) headerColumnsFound.push("% Tolerância");
  if (/\b(QTDISP|QT\.DISP|QTDISP_WMS|QUANTIDADE|ESTOQUE|QTEST)\b/.test(normFull)) headerColumnsFound.push("QtDisp");
  if (/\b(STATUS|SITUACAO)\b/.test(normFull)) headerColumnsFound.push("Status");

  let headerWarning: string | undefined;
  // Layout padrão: avisa se o cabeçalho mudar ou faltar colunas essenciais
  const requiredCols = ["Código", "Validade", "QtDisp", "Status"];
  const missing = requiredCols.filter((c) => !headerColumnsFound.includes(c));
  if (missing.length > 0) {
    headerWarning = `Atenção: O layout do relatório pode ter mudado. Colunas esperadas não identificadas: ${missing.join(", ")}.`;
  }

  return {
    reportDate,
    periodStart,
    periodEnd,
    headerColumnsFound,
    headerWarning,
    totalPages,
    totalRows: 0,
    validRows: 0,
    reviewRows: 0,
  };
}

/**
 * Locais conhecidos a serem descartados caso precedam a quantidade (ex.: "Estoque 43", "Cozinha 12")
 */
const LOCATION_NAMES = [
  "ESTOQUE",
  "COZINHA",
  "RESTAURANTE",
  "DEPOSITO",
  "DEP.",
  "LOJA",
  "FRENTE",
  "GONDOLA",
  "CAMARA",
  "SALDAO",
];

/**
 * Analisa a célula ou trecho de quantidade e status seguindo as regras de negócio:
 * 1. Dois números: o primeiro é preço manuscrito (-> preco_manuscrito, nunca estoque). O último é quantidade.
 * 2. Nome de local (Estoque, Cozinha etc.) é descartado.
 * 3. Quantidade não numérica vai para revisão.
 * 4. NORMAL conta no estoque.
 * 5. AVARIA não conta no total; vai para obs.
 * 6. Outro status vai para revisão.
 */
export function parseQuantityAndStatusCell(rawCell: string): {
  quantity: number;
  precoManuscrito?: string;
  status: string;
  obs?: string;
  needsReview: boolean;
  reviewReason?: string;
} {
  let text = (rawCell || "").trim();
  if (!text) {
    return {
      quantity: 0,
      status: "DESCONHECIDO",
      needsReview: true,
      reviewReason: "Célula de quantidade e status vazia",
    };
  }

  // 1. Detectar e extrair o status (NORMAL, AVARIA ou outro)
  let status = "NORMAL";
  const statusMatch = text.match(/\b(NORMAL|AVARIA|BLOQUEADO|VENCIDO|DEVOLUCAO|PENDENTE)\b/i);
  if (statusMatch) {
    status = statusMatch[1].toUpperCase();
    // remove o status do texto da quantidade
    text = text.replace(new RegExp(`\\b${statusMatch[1]}\\b`, "i"), " ").trim();
  } else {
    // Se não encontrou status padrão, tenta pegar a última palavra textual
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord && !/^\d+([.,]\d+)?$/.test(lastWord)) {
      status = lastWord.toUpperCase();
      text = words.slice(0, -1).join(" ").trim();
    }
  }

  // 2. Descartar nomes de locais antes do número (Estoque, Cozinha, Restaurante, etc.)
  for (const loc of LOCATION_NAMES) {
    const locRegex = new RegExp(`^${loc}\\s+`, "i");
    text = text.replace(locRegex, "").trim();
  }

  // 3. Remover caracteres de tolerância (%xx ou xx%) caso tenham vazado para esta célula (Ignore e não salve a % Tolerância)
  text = text.replace(/\b\d+\s*%/g, "").replace(/%\s*\d+\b/g, "").trim();

  // 4. Analisar os números presentes
  // Procura valores monetários ou numéricos (ex: "3,50", "3.50", "43", "12")
  const numberMatches = text.match(/\b\d+(?:[.,]\d+)?\b/g) || [];

  let precoManuscrito: string | undefined;
  let quantity = 0;
  let needsReview = false;
  let reviewReason: string | undefined;
  let obs: string | undefined;

  if (numberMatches.length === 0) {
    // Nenhuma quantidade numérica encontrada
    needsReview = true;
    reviewReason = `Quantidade não numérica (${rawCell})`;
  } else if (numberMatches.length >= 2) {
    // Regra: "Se a célula de quantidade tiver dois números, o primeiro é preço manuscrito
    // e vai para preco_manuscrito, nunca para estoque. O último número, junto ao status, é a quantidade."
    const rawPrice = numberMatches[0];
    const rawQty = numberMatches[numberMatches.length - 1];

    precoManuscrito = formatPrice(rawPrice);
    const parsedQty = parseInt(rawQty.replace(/[^\d]/g, ""), 10);
    if (isNaN(parsedQty)) {
      needsReview = true;
      reviewReason = `Quantidade não numérica (${rawQty})`;
    } else {
      quantity = parsedQty;
    }
  } else {
    // Um único número: é a quantidade
    const rawQty = numberMatches[0];
    const parsedQty = parseInt(rawQty.replace(/[^\d]/g, ""), 10);
    if (isNaN(parsedQty)) {
      needsReview = true;
      reviewReason = `Quantidade não numérica (${rawQty})`;
    } else {
      quantity = parsedQty;
    }
  }

  // 5. Aplicar regras de status:
  // - NORMAL conta no estoque
  // - AVARIA é defeito: não conta no total. Vai para campo obs
  // - Qualquer outro status vai para revisão
  if (status === "AVARIA") {
    const avariaQty = quantity;
    quantity = 0; // não conta no total
    obs = `AVARIA: ${avariaQty} UND`;
  } else if (status === "NORMAL") {
    // conta normalmente no estoque
  } else {
    needsReview = true;
    reviewReason = `Status '${status}' requer revisão manual`;
  }

  return {
    quantity,
    precoManuscrito,
    status,
    obs,
    needsReview,
    reviewReason,
  };
}

/**
 * Valida e converte uma linha do relatório para ScannedPdfRow.
 */
export function parseScannedPdfLine(
  rawLine: string,
  lineIndex: number,
  pageNumber = 1
): ScannedPdfRow | null {
  const line = (rawLine || "").trim();
  if (!line || line.length < 5) return null;

  // Ignorar linhas puras de cabeçalho ou rodapé
  const norm = normalizeReportText(line.toUpperCase());
  if (
    norm.startsWith("CODPROD") ||
    norm.startsWith("CODIGO") ||
    norm.startsWith("PERIODO DE VALIDADE") ||
    norm.startsWith("PAGINA") ||
    norm.startsWith("RELATORIO")
  ) {
    return null;
  }

  // Detectar data de validade dd/mm/aaaa
  const dateMatch = line.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (!dateMatch) {
    return {
      code: "",
      description: line,
      validity: "",
      quantity: 0,
      status: "DESCONHECIDO",
      rawText: line,
      needsReview: true,
      reviewReason: "Data de validade ausente ou ilegível",
      pageNumber,
    };
  }

  const validity = dateMatch[1];
  const dateIndex = line.indexOf(validity);

  // Parte antes da validade: Código e Descrição
  const beforeDate = line.slice(0, dateIndex).trim();
  // Parte depois da validade: % Tolerância, Quantidade e Status
  const afterDate = line.slice(dateIndex + validity.length).trim();

  // Código: primeiro número da linha (geralmente 3 a 7 dígitos)
  const codeMatch = beforeDate.match(/^(\d{3,8})\b/) || beforeDate.match(/\b(\d{3,8})\b/);
  const code = codeMatch ? codeMatch[1].trim() : "";

  let description = "";
  if (codeMatch) {
    description = beforeDate
      .replace(codeMatch[0], "")
      .replace(/^[;\s,.\-]+/, "")
      .trim()
      .toUpperCase();
  } else {
    description = beforeDate.toUpperCase();
  }

  // Analisar quantidade e status após a validade
  const parsedQtyStatus = parseQuantityAndStatusCell(afterDate);

  let needsReview = parsedQtyStatus.needsReview;
  let reviewReason = parsedQtyStatus.reviewReason;

  // Validação do código: numérico obrigatório
  if (!code || !/^\d+$/.test(code)) {
    needsReview = true;
    reviewReason = reviewReason || "Código numérico ausente ou inválido";
  }

  return {
    code,
    description,
    validity,
    quantity: parsedQtyStatus.quantity,
    precoManuscrito: parsedQtyStatus.precoManuscrito,
    status: parsedQtyStatus.status,
    obs: parsedQtyStatus.obs,
    rawText: line,
    needsReview,
    reviewReason,
    pageNumber,
  };
}

/**
 * Agrupa as linhas extraídas por código e consolida as validades e estoques.
 * Regras:
 * - Some por código, nunca por nome. Nomes iguais com códigos diferentes são itens separados.
 * - Se um código tiver mais de uma validade, mostra cada validade e o total do código.
 * - Código novo é criado. Código existente tem validade e estoque NORMAL substituídos pelos do PDF.
 * - Nenhum histórico de uploads anteriores é apagado.
 * - Código presente no upload anterior e ausente no novo fica marcado como "fora do último relatório" e sai do total.
 * - Subir o mesmo PDF de novo não duplica estoque.
 */
export function aggregateScannedRows(
  rows: ScannedPdfRow[],
  previousProducts: EncarteProduct[] = [],
  reportDate?: string
): AggregatedScannedProduct[] {
  // Agrupa apenas linhas com código identificado
  const rowsByCode = new Map<string, ScannedPdfRow[]>();
  const invalidRows: ScannedPdfRow[] = [];

  for (const row of rows) {
    if (!row.code) {
      invalidRows.push(row);
      continue;
    }
    const list = rowsByCode.get(row.code) || [];
    list.push(row);
    rowsByCode.set(row.code, list);
  }

  const currentUploadedCodes = new Set<string>();
  const aggregated: AggregatedScannedProduct[] = [];

  for (const [code, codeRows] of rowsByCode.entries()) {
    currentUploadedCodes.add(code);

    // Soma estoque de linhas NORMAL
    let totalStock = 0;
    const validityEntries: AggregatedScannedProduct["validityEntries"] = [];
    const originalSnippets: string[] = [];
    const reviewReasons: string[] = [];
    let needsReview = false;
    let precoManuscrito: string | undefined;
    const obsList: string[] = [];

    // Escolhe a melhor descrição disponível nas linhas
    let description = "";
    for (const r of codeRows) {
      originalSnippets.push(r.rawText);
      if (!description && r.description) {
        description = r.description;
      }
      if (r.needsReview) {
        needsReview = true;
        if (r.reviewReason) reviewReasons.push(r.reviewReason);
      }
      if (r.precoManuscrito && !precoManuscrito) {
        precoManuscrito = r.precoManuscrito;
      }
      if (r.obs) {
        obsList.push(r.obs);
      }

      // Adiciona na lista de validades
      validityEntries.push({
        validity: r.validity,
        quantity: r.quantity,
        status: r.status,
        precoManuscrito: r.precoManuscrito,
        obs: r.obs,
      });

      if (r.status === "NORMAL") {
        totalStock += r.quantity;
      }
    }

    // Ordenar validades cronologicamente (data mais próxima primeiro)
    validityEntries.sort((a, b) => {
      const [da, ma, ya] = (a.validity || "").split("/").map(Number);
      const [db, mb, yb] = (b.validity || "").split("/").map(Number);
      const timeA = new Date(ya || 2099, (ma || 1) - 1, da || 1).getTime();
      const timeB = new Date(yb || 2099, (mb || 1) - 1, db || 1).getTime();
      return timeA - timeB;
    });

    // Validade principal exibida: a mais próxima
    const primaryValidity = validityEntries[0]?.validity || "";

    // Verifica se já existia em upload anterior
    const prevMatch = previousProducts.find((p) => p.code.trim() === code);
    const statusRelatorio = prevMatch ? "atualizado" : "novo";

    aggregated.push({
      code,
      description: description || `PRODUTO ${code}`,
      validity: primaryValidity,
      validityEntries,
      totalStock,
      precoManuscrito: precoManuscrito || prevMatch?.precoManuscrito,
      price: precoManuscrito || prevMatch?.price || "",
      unit: prevMatch?.unit || "UND",
      unitSource: prevMatch?.unitSource || "padrao",
      packaging: prevMatch?.packaging || "",
      productUrl: prevMatch?.productUrl,
      image: prevMatch?.image || "",
      obs: obsList.join("; ") || prevMatch?.obs,
      needsReview,
      reviewReasons,
      statusRelatorio,
      reportDate,
      originalSnippets,
      included: true,
    });
  }

  // Identificar produtos do upload anterior que estão ausentes no novo relatório
  // "Código presente no upload anterior e ausente no novo fica marcado como 'fora do último relatório' e sai do total."
  for (const prev of previousProducts) {
    const cleanCode = prev.code.trim();
    if (!currentUploadedCodes.has(cleanCode)) {
      aggregated.push({
        code: cleanCode,
        description: prev.name,
        validity: prev.validity,
        validityEntries: prev.validityEntries || [
          {
            validity: prev.validity,
            quantity: 0,
            status: "FORA",
          },
        ],
        totalStock: 0, // sai do total
        precoManuscrito: prev.precoManuscrito,
        price: prev.price,
        unit: prev.unit,
        unitSource: prev.unitSource || "padrao",
        packaging: prev.packaging,
        productUrl: prev.productUrl,
        image: prev.image,
        obs: prev.obs ? `${prev.obs} (fora do último relatório)` : "Fora do último relatório",
        needsReview: false,
        reviewReasons: [],
        statusRelatorio: "fora_do_ultimo_relatorio",
        reportDate,
        originalSnippets: [prev.originalSnippet || "Histórico de upload anterior"],
        included: false, // sai do encarte automaticamente
      });
    }
  }

  return aggregated;
}

/**
 * Cruza e enriquece os produtos do PDF escaneado com os links/dados do site da Cescom.
 * Regras:
 * - Ao receber links de categoria ou produto, associa cada código à sua página.
 * - Lê a unidade (UNIDADE, CAIXA, FARDO, PACOTE, DISPLAY) uma vez por código.
 * - Campo de correção manual da unidade por código: prevalece sobre o site e fica marcada como "manual".
 * - Sem unidade no site e sem correção manual, a linha vai para revisão.
 * - Releia o site só para código novo ou sob pedido.
 * - Descrição: vem do PDF. Se estiver vazia, vem da página do produto.
 */
export function enrichProductsWithSiteData(
  products: AggregatedScannedProduct[],
  siteProducts: EncarteProduct[],
  manualUnits: Map<string, string> = new Map()
): AggregatedScannedProduct[] {
  // Mapa de produtos do site por código
  const siteByCode = new Map<string, EncarteProduct>();
  for (const sp of siteProducts) {
    if (sp.code) {
      siteByCode.set(sp.code.trim().toLowerCase(), sp);
    }
  }

  return products.map((prod) => {
    const codeKey = prod.code.trim().toLowerCase();
    const siteMatch = siteByCode.get(codeKey);
    const manualUnit = manualUnits.get(codeKey) || manualUnits.get(prod.code.trim());

    let finalUnit = prod.unit;
    let unitSource = prod.unitSource;
    let packaging = prod.packaging;
    let productUrl = prod.productUrl || siteMatch?.productUrl;
    let image = prod.image || siteMatch?.image || "";
    let description = prod.description;
    let needsReview = prod.needsReview;
    const reviewReasons = [...prod.reviewReasons];

    // 1. Correção manual prevalece sempre
    if (manualUnit) {
      finalUnit = normalizeSaleUnit(manualUnit);
      unitSource = "manual";
      // Remove aviso de falta de unidade se havia
      const idx = reviewReasons.indexOf("Unidade de venda ausente");
      if (idx >= 0) reviewReasons.splice(idx, 1);
    } else if (siteMatch) {
      // 2. Dado vindo do site
      if (siteMatch.unit) {
        finalUnit = normalizeSaleUnit(siteMatch.unit);
        unitSource = "site";
      }
      if (siteMatch.packaging && !packaging) {
        packaging = siteMatch.packaging;
      }
      // Se a descrição do PDF estiver vazia ou for genérica "PRODUTO X", usa a do site
      if ((!description || description.startsWith("PRODUTO ")) && siteMatch.name) {
        description = siteMatch.name;
      }
    } else {
      // 3. Sem unidade no site e sem correção manual
      if (unitSource !== "manual" && (!finalUnit || finalUnit === "UND" && !prod.packaging)) {
        needsReview = true;
        if (!reviewReasons.includes("Unidade de venda ausente (verificar no site ou corrigir manualmente)")) {
          reviewReasons.push("Unidade de venda ausente (verificar no site ou corrigir manualmente)");
        }
      }
    }

    if (reviewReasons.length === 0) {
      needsReview = false;
    }

    return {
      ...prod,
      description,
      unit: finalUnit,
      unitSource,
      packaging,
      productUrl,
      image,
      needsReview,
      reviewReasons,
    };
  });
}

/**
 * Converte AggregatedScannedProduct em EncarteProduct padrão para inclusão no encarte.
 */
export function scannedProductToEncarteProduct(
  p: AggregatedScannedProduct
): EncarteProduct {
  // Formata estoque (ex: "43 UND")
  const stockStr = p.totalStock > 0 ? `${p.totalStock} ${p.unit}` : undefined;

  return {
    id: `scan-prod-${p.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code: p.code,
    name: p.description,
    packaging: p.packaging || "",
    validity: p.validity,
    price: p.price || p.precoManuscrito || "",
    unit: p.unit,
    unitConfirmed: p.unitSource === "manual",
    stock: stockStr,
    badge: "nenhum",
    image: p.image || "",
    included: p.included !== false,
    productUrl: p.productUrl,
    precoManuscrito: p.precoManuscrito,
    obs: p.obs,
    status: p.validityEntries[0]?.status || "NORMAL",
    statusRelatorio: p.statusRelatorio,
    originalSnippet: p.originalSnippets.join("\n"),
    reportDate: p.reportDate,
    unitSource: p.unitSource,
    validityEntries: p.validityEntries,
    needsReview: p.needsReview,
    reviewReason: p.reviewReasons.join("; "),
  };
}

/**
 * Processador principal de Buffer/Arquivo PDF ou texto OCR.
 * Extrai texto, detecta tabelas estruturadas ou realiza OCR.
 */
export async function parseScannedPdfReport(
  fileOrBuffer: File | ArrayBuffer | string,
  previousProducts: EncarteProduct[] = []
): Promise<ScannedPdfParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let textLines: string[] = [];
  let totalPages = 1;

  if (typeof fileOrBuffer === "string") {
    // Texto pré-extraído (ex: via OCR em worker ou teste)
    textLines = fileOrBuffer.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } else {
    // Processamento de arquivo PDF com pdfjs-dist
    try {
      const pdfjs = await import("pdfjs-dist");
      let buffer: ArrayBuffer;
      if (typeof (fileOrBuffer as File).arrayBuffer === "function") {
        buffer = await (fileOrBuffer as File).arrayBuffer();
      } else {
        buffer = fileOrBuffer as ArrayBuffer;
      }

      const loadingTask = pdfjs.getDocument({ data: buffer });
      const pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Agrupar itens de texto por linha (coordenada Y aproximada)
        const items = textContent.items as any[];
        if (items && items.length > 0) {
          const linesByY = new Map<number, { x: number; text: string }[]>();
          for (const item of items) {
            const y = Math.round(item.transform[5]);
            const x = Math.round(item.transform[4]);
            const text = item.str || "";
            if (!text.trim()) continue;

            // Agrupa itens com Y próximo (+- 3px)
            let matchedY = y;
            for (const existingY of linesByY.keys()) {
              if (Math.abs(existingY - y) <= 4) {
                matchedY = existingY;
                break;
              }
            }
            const lineItems = linesByY.get(matchedY) || [];
            lineItems.push({ x, text });
            linesByY.set(matchedY, lineItems);
          }

          // Ordenar linhas de cima para baixo (Y decrescente no PDF)
          const sortedYs = Array.from(linesByY.keys()).sort((a, b) => b - a);
          for (const y of sortedYs) {
            const lineItems = linesByY.get(y) || [];
            lineItems.sort((a, b) => a.x - b.x);
            const lineStr = lineItems.map((it) => it.text).join(" ").trim();
            if (lineStr) textLines.push(lineStr);
          }
        }
      }

      // Se o PDF for um scan rasterizado puro (sem camada de texto nativa) e estivermos no browser,
      // renderiza as páginas em canvas e executa OCR via Tesseract.js
      if (textLines.length === 0 && typeof window !== "undefined" && typeof document !== "undefined") {
        try {
          const Tesseract = await import("tesseract.js");
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const ocrRes = await Tesseract.recognize(canvas, "por");
              const ocrLines = (ocrRes?.data?.text || "")
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);
              textLines.push(...ocrLines);
            }
          }
        } catch (ocrErr: any) {
          warnings.push(`Tentativa de OCR na imagem do PDF: ${ocrErr?.message || String(ocrErr)}`);
        }
      }
    } catch (err: any) {
      errors.push(`Erro ao carregar o arquivo PDF: ${err?.message || String(err)}`);
    }
  }

  if (textLines.length === 0) {
    return {
      ok: false,
      metadata: {
        headerColumnsFound: [],
        totalPages,
        totalRows: 0,
        validRows: 0,
        reviewRows: 0,
      },
      rows: [],
      aggregated: [],
      errors: errors.length ? errors : ["O PDF não contém texto extraível. Execute o OCR na imagem escaneada."],
      warnings,
    };
  }

  // 1. Extrair Metadados do Relatório
  const metadata = extractReportMetadata(textLines, totalPages);
  if (metadata.headerWarning) {
    warnings.push(metadata.headerWarning);
  }

  // 2. Extrair cada linha de produto
  const rows: ScannedPdfRow[] = [];
  textLines.forEach((line, index) => {
    const parsed = parseScannedPdfLine(line, index + 1);
    if (parsed) {
      rows.push(parsed);
    }
  });

  metadata.totalRows = rows.length;
  metadata.validRows = rows.filter((r) => !r.needsReview).length;
  metadata.reviewRows = rows.filter((r) => r.needsReview).length;

  // 3. Agregar por código e comparar com produtos anteriores
  const aggregated = aggregateScannedRows(rows, previousProducts, metadata.reportDate);

  return {
    ok: aggregated.length > 0,
    metadata,
    rows,
    aggregated,
    errors,
    warnings,
  };
}
