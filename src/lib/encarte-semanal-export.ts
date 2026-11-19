/**
 * Exportador em Alta Resolução (PNG / ZIP) para o Encarte Semanal.
 * Renderiza em Canvas 2D nativo (1080x1920) com precisão pixel-perfect.
 * Garante que os textos de guia da arte ("FOTO", "COD / DESCRIÇÃO" e "TEXTO EDITÁVEL")
 * fiquem 100% cobertos e nunca apareçam no resultado final.
 */

import type {
  EncarteSemanalConfig,
  EncarteSemanalProduct,
  EncarteSemanalCellPosition,
} from "@/types/encarte-semanal";
import {
  calculateEncarteSemanalGridCells,
  resolveSemanalCellPhotos,
} from "./encarte-semanal-layout";
import { semanalCodes, semanalPhotos, semanalPhotoBounds } from "./encarte-semanal-editing";
import { removeWhiteBackground } from "./colecoes-image-processor";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = async () => {
      if (src.startsWith("https://")) {
        try {
          const { fetchImage } = await import("./product.functions");
          const result = await fetchImage({ data: { url: src } });
          if (result.image) { resolve(await loadImage(result.image)); return; }
        } catch { /* Apresentar falha ao exportador. */ }
      }
      reject(new Error("Não foi possível carregar uma foto para exportação."));
    };
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > maxWidth) { lines.push(current); current = word; }
      else current = next;
    }
    lines.push(current);
  }
  return lines.slice(0, Math.max(1, maxLines));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renderiza uma página de até 20 produtos sobre o modelo de arte em 1080x1920.
 */
export async function renderEncarteSemanalPageToCanvas(
  products: (EncarteSemanalProduct | null | undefined)[],
  config: EncarteSemanalConfig,
  targetCanvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const { gridConfig, templateImage, footerText } = config;
  const canvasWidth = gridConfig.canvasWidth || 1080;
  const canvasHeight = gridConfig.canvasHeight || 1920;

  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto 2D do Canvas não disponível.");

  // 1. FUNDO: Desenhar o modelo de arte
  let templateLoaded = false;
  if (templateImage) {
    try {
      const bgImg = await loadImage(templateImage);
      ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
      templateLoaded = true;
    } catch {
      templateLoaded = false;
    }
  }

  if (!templateLoaded) {
    // Fallback elegante caso a imagem falhe: gradiente bordô Cescom
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, "#200408");
    grad.addColorStop(0.3, "#3d060e");
    grad.addColorStop(1, "#180205");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. CALCULAR CÉLULAS DA GRADE
  const cells = calculateEncarteSemanalGridCells(gridConfig);

  // 3. RENDERIZAR CADA CÉLULA (FOTO + BARRA COM COD E DESCRIÇÃO)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const product = products[i];
    if (!product) continue;

    const insetX = 8;
    const barW = cell.width - insetX * 2;
    const barX = cell.x + insetX;
    const barY = cell.barY;
    const barH = cell.barHeight || 54;

    // Todas as fotos usam a mesma geometria da prévia; transformações são independentes.
    const photos = semanalPhotos(product);
    for (let index = 0; index < photos.length; index++) {
      try {
        const img = await loadImage(photos[index] || "");
        const aspect = img.naturalWidth / img.naturalHeight;
        const bounds = semanalPhotoBounds(product, index, photos.length, cell.width, cell.photoAreaHeight, aspect);
        ctx.drawImage(img, cell.x + bounds.x, cell.y + bounds.y, bounds.width, bounds.height);
      } catch {
        throw new Error(`A foto ${index + 1} do box ${i + 1} não pôde ser exportada. Troque a foto e tente novamente.`);
      }
    }

    // B. DESENHAR BARRA INFERIOR AMARELA/DOURADA
    // Cobre perfeitamente as guias "COD / DESCRIÇÃO" do modelo
    ctx.save();
    ctx.fillStyle = gridConfig.barColor || "#F6E0A6";
    roundRect(ctx, barX, barY, barW, barH, 7);
    ctx.fill();

    // Faixa laranja de Limite (se houver, ex: "LIMITE: 1000CX")
    if (product.limit) {
      const limitW = barW * 0.75;
      const limitH = 14;
      const limitX = barX + (barW - limitW) / 2;
      const limitY = barY - limitH + 1;

      ctx.fillStyle = "#E65100";
      roundRect(ctx, limitX, limitY, limitW, limitH, 3);
      ctx.fill();

      ctx.font = "900 9px 'Inter', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`LIMITE: ${product.limit.toUpperCase()}`, limitX + limitW / 2, limitY + limitH / 2);
    }

    // Textos da barra: COD (à esquerda) e DESCRIÇÃO (ao centro/direita)
    // Produtos classificados como Principal ficam SEM CÓDIGO na barra
    const isPrincipal = Boolean(product.isPrincipal || (!product.code && !product.secondaryCode));
    const displayCode = isPrincipal ? "" : semanalCodes(product).join(" / ");
    const desc = product.description ? product.description.trim().toUpperCase() : "";

    let textStartX = barX + 8;
    let availableDescWidth = barW - 16;

    if (displayCode) {
      const codeFontSize = product.codeFontSize ?? 13;
      ctx.font = `900 ${codeFontSize}px 'Inter', monospace, sans-serif`;
      const codeWidth = ctx.measureText(displayCode).width;
      const codeBoxW = Math.min(codeWidth + 10, barW * 0.42);

      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const codeLines = wrapText(ctx, displayCode, codeBoxW - 8, Math.floor(barH / (codeFontSize * 1.2)));
      codeLines.forEach((line, index) => ctx.fillText(line, barX + codeBoxW / 2, barY + barH / 2 + (index - (codeLines.length - 1) / 2) * codeFontSize * 1.2));

      // Linha divisória vertical suave
      ctx.strokeStyle = "rgba(122, 13, 18, 0.3)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(barX + codeBoxW, barY + 6);
      ctx.lineTo(barX + codeBoxW, barY + barH - 6);
      ctx.stroke();

      textStartX = barX + codeBoxW + 6;
      availableDescWidth = barW - codeBoxW - 12;
    }

    // Descrição do Produto
    if (desc) {
      const fontSize = product.descriptionFontSize ?? 12;
      ctx.font = `900 ${fontSize}px 'Barlow', sans-serif`;
      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrapText(ctx, desc, availableDescWidth, Math.max(1, Math.floor(barH / (fontSize * 1.2))));
      const descCenterX = textStartX + availableDescWidth / 2;
      lines.forEach((line, index) => ctx.fillText(line, descCenterX, barY + barH / 2 + (index - (lines.length - 1) / 2) * fontSize * 1.2));
    }
    ctx.restore();
  }

  // 4. RODAPÉ DA OFERTA (COBRINDO A SETA E "TEXTO EDITÁVEL")
  // Faixa escura limpa na base da arte (y: 1855 a 1920)
  ctx.save();
  ctx.fillStyle = "#0a0204";
  ctx.fillRect(0, 1855, canvasWidth, 65);

  if (footerText && footerText.trim()) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Se tiver quebra de linha ou o termo padrão de ofertas
    const cleanFooter = footerText.trim().toUpperCase();
    const parts = cleanFooter.includes("OU ENQUANTO")
      ? cleanFooter.split("OU ENQUANTO")
      : [cleanFooter];

    if (parts.length > 1) {
      ctx.font = "900 12.5px 'Inter', sans-serif";
      ctx.fillText(parts[0].trim(), canvasWidth / 2, 1874);

      ctx.font = "700 10.5px 'Inter', sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`OU ENQUANTO ${parts[1].trim()}`, canvasWidth / 2, 1894);
    } else {
      ctx.font = "900 12px 'Inter', sans-serif";
      ctx.fillText(cleanFooter, canvasWidth / 2, 1885);
    }
  }
  ctx.restore();

  return canvas;
}

/**
 * Converte o Canvas em Blob PNG de alta resolução.
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao converter canvas para blob PNG."));
    }, "image/png");
  });
}

/**
 * Dispara o download de um arquivo Blob no navegador.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Exporta uma página única como PNG.
 */
export async function exportEncarteSemanalPageAsPng(
  products: (EncarteSemanalProduct | null | undefined)[],
  config: EncarteSemanalConfig,
  pageNumber = 1
): Promise<void> {
  const canvas = await renderEncarteSemanalPageToCanvas(products, config);
  const blob = await canvasToBlob(canvas);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");
  const filename = `encarte_semanal_${dateStr}_pag_${pageNumber}.png`;
  triggerFileDownload(blob, filename);
}

/**
 * Exporta todas as páginas do encarte em um arquivo ZIP.
 */
export async function exportAllEncarteSemanalPagesAsZip(
  pages: EncarteSemanalProduct[][],
  config: EncarteSemanalConfig,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    onProgress?.(pageNum, pages.length);
    const pageProducts = pages[i];
    const canvas = await renderEncarteSemanalPageToCanvas(pageProducts, config);
    const blob = await canvasToBlob(canvas);
    const filename = `encarte_semanal_${dateStr}_pag_${pageNum}.png`;
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerFileDownload(zipBlob, `encarte_semanal_${dateStr}.zip`);
}
