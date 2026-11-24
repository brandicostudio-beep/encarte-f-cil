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
import { removeWhiteBackground } from "./colecoes-image-processor";

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

    // A. DESENHAR FOTO(S) (mantendo 100% da proporção original e sem deformar embalagens)
    const { photo1, photo2, hasTwoPhotos } = resolveSemanalCellPhotos(product);
    const scale = (product.scale || 1.0) > 10 ? (product.scale || 100) / 100 : product.scale || 1.0;
    const overlapY = product.overlapY ?? 2;
    const offsetX = product.offsetX || 0;
    const offsetY = product.offsetY || 0;

    // Área útil da foto com folga de 16px no topo para respiração ampla entre linhas de boxes
    const availableW = barW;
    const availableH = cell.photoAreaHeight - 16;

    if (hasTwoPhotos && photo1 && photo2) {
      try {
        const [img1, img2] = await Promise.all([
          loadImage(photo1),
          loadImage(photo2),
        ]);

        const aspect1 = (img1.naturalWidth || img1.width) / (img1.naturalHeight || img1.height);
        const aspect2 = (img2.naturalWidth || img2.width) / (img2.naturalHeight || img2.height);

        // Cada produto ocupa até 54% da largura do box, com altura contida
        const maxItemW = availableW * 0.54 * scale;
        const maxItemH = availableH * scale;

        // Foto 1 com proporção nativa
        let drawW1 = maxItemW;
        let drawH1 = drawW1 / aspect1;
        if (drawH1 > maxItemH) {
          drawH1 = maxItemH;
          drawW1 = drawH1 * aspect1;
        }

        // Foto 2 com proporção nativa e escala independente
        const scale2 = product.scale2
          ? (product.scale2 > 10 ? product.scale2 / 100 : product.scale2)
          : scale;
        const offsetX2 = product.offsetX2 ?? offsetX;
        const offsetY2 = product.offsetY2 ?? offsetY;

        let drawW2 = availableW * 0.54 * scale2;
        let drawH2 = drawW2 / aspect2;
        if (drawH2 > availableH * scale2) {
          drawH2 = availableH * scale2;
          drawW2 = drawH2 * aspect2;
        }

        // Posicionamento elegante lado a lado, contido estritamente dentro do box
        const x1 = barX + Math.max(0, (barW * 0.48 - drawW1) / 2) + offsetX;
        const y1 = barY - drawH1 + overlapY + offsetY;

        const x2 = barX + barW - drawW2 - Math.max(0, (barW * 0.48 - drawW2) / 2) + offsetX2;
        const y2 = barY - drawH2 + overlapY + offsetY2;

        // Foto 1 (Esquerda / Trás)
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        if (product.flipHorizontal) {
          ctx.translate(x1 + drawW1, y1);
          ctx.scale(-1, 1);
          ctx.drawImage(img1, 0, 0, drawW1, drawH1);
        } else {
          ctx.drawImage(img1, x1, y1, drawW1, drawH1);
        }
        ctx.restore();

        // Foto 2 (Direita / Frente)
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.50)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 5;
        if (product.flipHorizontal2) {
          ctx.translate(x2 + drawW2, y2);
          ctx.scale(-1, 1);
          ctx.drawImage(img2, 0, 0, drawW2, drawH2);
        } else {
          ctx.drawImage(img2, x2, y2, drawW2, drawH2);
        }
        ctx.restore();
      } catch (err) {
        console.warn(`Aviso ao desenhar fotos do produto ${product.code}:`, err);
      }
    } else if (photo1) {
      try {
        const photoImg = await loadImage(photo1);

        const aspect = (photoImg.naturalWidth || photoImg.width) / (photoImg.naturalHeight || photoImg.height);
        const maxW = availableW * 0.88 * scale;
        const maxH = availableH * scale;

        let drawW = maxW;
        let drawH = drawW / aspect;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * aspect;
        }

        const drawX = barX + (barW - drawW) / 2 + offsetX;
        const drawY = barY - drawH + overlapY + offsetY;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 5;
        if (product.flipHorizontal) {
          ctx.translate(drawX + drawW, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(photoImg, 0, 0, drawW, drawH);
        } else {
          ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
        }
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

    // Faixa laranja de Limite com tamanho de fonte e largura configuráveis (ex: "LIMITE: 1000CX")
    if (product.limit) {
      const fontSize = product.limitFontSize || 9;
      const widthPct = (product.limitWidthPercent || 75) / 100;
      const limitW = barW * widthPct;
      const limitH = Math.max(14, fontSize + 5);
      const limitX = barX + (barW - limitW) / 2;
      const limitY = barY - limitH + 1;

      ctx.fillStyle = "#E65100";
      roundRect(ctx, limitX, limitY, limitW, limitH, 3);
      ctx.fill();

      ctx.font = `900 ${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`LIMITE: ${product.limit.toUpperCase()}`, limitX + limitW / 2, limitY + limitH / 2);
    }

    // Textos da barra: COD (à esquerda) e DESCRIÇÃO (ao centro/direita)
    // Produtos classificados como Principal ficam SEM CÓDIGO na barra
    const isPrincipal = Boolean(product.isPrincipal || (!product.code && !product.secondaryCode));
    const displayCode = isPrincipal
      ? ""
      : product.secondaryCode
      ? `${product.code || ""} / ${product.secondaryCode}`.trim()
      : (product.code ? product.code.trim() : "");
    const desc = product.description ? product.description.trim().toUpperCase() : "";

    let textStartX = barX + 8;
    let availableDescWidth = barW - 16;

    if (displayCode) {
      const codeFontSize = displayCode.length > 10 ? 9 : displayCode.length > 6 ? 11 : 13;
      ctx.font = `900 ${codeFontSize}px 'Inter', monospace, sans-serif`;
      const codeWidth = ctx.measureText(displayCode).width;
      const codeBoxW = Math.min(codeWidth + 10, barW * 0.42);

      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayCode, barX + codeBoxW / 2, barY + barH / 2);

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

    // D. DESENHAR SELO PROMOCIONAL (BADGE DE VAREJO)
    if (product.badge && product.badge.trim()) {
      ctx.save();
      const badgeText = product.badge.trim().toUpperCase();
      ctx.font = "900 10px 'Inter', Arial, sans-serif";
      const textMetrics = ctx.measureText(badgeText);
      const badgeW = Math.min(barW - 16, textMetrics.width + 20);
      const badgeH = 20;
      const badgeX = barX + 6;
      const badgeY = cell.y + 6;

      let bgBadge = "#DC2626"; // red padrão
      let textBadgeColor = "#FFFFFF";
      if (product.badgeColor === "amber") {
        bgBadge = "#F59E0B";
        textBadgeColor = "#000000";
      } else if (product.badgeColor === "green") {
        bgBadge = "#16A34A";
      } else if (product.badgeColor === "purple") {
        bgBadge = "#9333EA";
      } else if (product.badgeColor === "blue") {
        bgBadge = "#2563EB";
      }

      ctx.fillStyle = bgBadge;
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = textBadgeColor;
      ctx.shadowColor = "transparent";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 9.5px 'Inter', Arial, sans-serif";
      ctx.fillText(`★ ${badgeText}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
      ctx.restore();
    }
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
