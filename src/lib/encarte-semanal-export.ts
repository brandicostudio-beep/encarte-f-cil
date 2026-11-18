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
import { calculateEncarteSemanalGridCells } from "./encarte-semanal-layout";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Se falhar o carregamento, rejeita suavemente
      reject(new Error(`Falha ao carregar imagem: ${src.slice(0, 50)}...`));
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
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Se exceder maxLines, adiciona ellipsis
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[lines.length - 1];
    if (ctx.measureText(last).width > maxWidth - 10) {
      lines[lines.length - 1] = last.slice(0, -3) + "...";
    }
  }

  return lines;
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
  products: EncarteSemanalProduct[],
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

  // 2. COBRIR TEXTOS DE GUIA DA ARTE
  // Na célula 1 (col 0, row 0), a arte modelo possui o texto "FOTO".
  // Cobrimos essa área com um patch da cor bordô de fundo para garantir que não apareça.
  const cells = calculateEncarteSemanalGridCells(gridConfig);
  if (cells.length > 0) {
    const cell0 = cells[0];
    ctx.fillStyle = "#330409";
    ctx.fillRect(cell0.x + 2, cell0.y + 2, cell0.width - 4, cell0.photoAreaHeight - 4);
  }

  // 3. RENDERIZAR CADA CÉLULA (FOTO + BARRA COM COD E DESCRIÇÃO)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const product = products[i];
    if (!product) continue;

    const barW = cell.width - 6;
    const barX = cell.x + 3;
    const barY = cell.barY;
    const barH = cell.barHeight || 54;

    // A. DESENHAR FOTO (na área de foto, podendo avançar sobre a barra)
    if (product.image) {
      try {
        const photoImg = await loadImage(product.image);
        const scale = (product.scale || 1.15) > 10 ? (product.scale || 115) / 100 : product.scale || 1.15;
        const overlapY = product.overlapY ?? 8;
        const offsetX = product.offsetX || 0;
        const offsetY = product.offsetY || 0;

        // Dimensões da foto mantendo proporção
        const aspect = photoImg.width / photoImg.height;
        let drawW = (cell.width * 0.9) * scale;
        let drawH = drawW / aspect;

        const maxH = (cell.photoAreaHeight + overlapY) * scale;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * aspect;
        }

        const drawX = cell.x + (cell.width - drawW) / 2 + offsetX;
        // Alinhada na base da área de foto + overlap sobre a barra
        const drawY = cell.y + cell.photoAreaHeight - drawH + overlapY + offsetY;

        ctx.save();
        // Sombra de destaque para recorte de produto
        ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 6;
        ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
        ctx.restore();
      } catch (err) {
        console.warn(`Aviso ao desenhar foto do produto ${product.code}:`, err);
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
    const code = product.code ? product.code.trim() : "";
    const desc = product.description ? product.description.trim().toUpperCase() : "";

    let textStartX = barX + 8;
    let availableDescWidth = barW - 16;

    if (code) {
      ctx.font = "900 13px 'Inter', monospace, sans-serif";
      const codeWidth = ctx.measureText(code).width;
      const codeBoxW = Math.min(codeWidth + 10, barW * 0.38);

      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(code, barX + codeBoxW / 2, barY + barH / 2);

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
      ctx.font = "900 11px 'Inter', sans-serif";
      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = wrapText(ctx, desc, availableDescWidth, 2);
      const descCenterX = textStartX + availableDescWidth / 2;

      if (lines.length === 1) {
        ctx.fillText(lines[0], descCenterX, barY + barH / 2);
      } else if (lines.length >= 2) {
        ctx.fillText(lines[0], descCenterX, barY + barH / 2 - 7);
        ctx.fillText(lines[1], descCenterX, barY + barH / 2 + 7);
      }
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
  products: EncarteSemanalProduct[],
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
  config: EncarteSemanalConfig
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const pageProducts = pages[i];
    const canvas = await renderEncarteSemanalPageToCanvas(pageProducts, config);
    const blob = await canvasToBlob(canvas);
    const filename = `encarte_semanal_${dateStr}_pag_${pageNum}.png`;
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerFileDownload(zipBlob, `encarte_semanal_${dateStr}.zip`);
}
