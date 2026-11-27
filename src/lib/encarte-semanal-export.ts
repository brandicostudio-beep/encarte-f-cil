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
  getSemanalPageGridConfig,
  resolveSemanalCellPhotos,
} from "./encarte-semanal-layout";
import { computeSemanalTwoPhotoLayout } from "./encarte-semanal-editing";
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

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): { lines: string[]; overflowed: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  let overflowed = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;

    if (width <= maxWidth || !currentLine) {
      currentLine = testLine;
    } else if (lines.length < maxLines - 1) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      overflowed = true;
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (overflowed && lines.length > 0) {
    const lastIdx = lines.length - 1;
    let last = lines[lastIdx];
    while (last.length > 3 && ctx.measureText(`${last}...`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[lastIdx] = `${last}...`;
  }

  return { lines, overflowed };
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
  const exportScale = Math.max(1, config.exportScale || 2);

  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = canvasWidth * exportScale;
  canvas.height = canvasHeight * exportScale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto 2D do Canvas não disponível.");

  ctx.save();
  ctx.scale(exportScale, exportScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

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

        const scale2 = product.scale2
          ? (product.scale2 > 10 ? product.scale2 / 100 : product.scale2)
          : scale;
        const offsetX2 = product.offsetX2 ?? 0;
        const offsetY2 = product.offsetY2 ?? 0;

        const twoLayout = computeSemanalTwoPhotoLayout({
          boxX: cell.x,
          boxWidth: cell.width,
          photoAreaHeight: cell.photoAreaHeight,
          barY,
          aspect1,
          aspect2,
          scale1: scale,
          scale2,
          overlapY,
          offsetX1: offsetX,
          offsetY1: offsetY,
          offsetX2,
          offsetY2,
        });

        const { x: x1, y: y1, width: drawW1, height: drawH1 } = twoLayout.photo1;
        const { x: x2, y: y2, width: drawW2, height: drawH2 } = twoLayout.photo2;

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

        const drawX = cell.x + (cell.width - drawW) / 2 + offsetX;
        const drawY = cell.y + (cell.photoAreaHeight - drawH) / 2 + offsetY;

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
      const codeLines =
        product.code?.trim() && product.secondaryCode?.trim()
          ? [product.code.trim(), product.secondaryCode.trim()]
          : [displayCode];
      const codeFontSize =
        codeLines.length > 1 ? 13 : displayCode.length > 6 ? 13 : 15;
      ctx.font = `900 ${codeFontSize}px 'Segoe UI', Roboto, Arial, sans-serif`;
      const maxCodeWidth = Math.max(...codeLines.map((c) => ctx.measureText(c).width));
      const codeBoxW = Math.min(maxCodeWidth + 12, barW * 0.42);

      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (codeLines.length > 1) {
        ctx.fillText(codeLines[0], barX + codeBoxW / 2, barY + barH / 2 - 7.5);
        ctx.fillText(codeLines[1], barX + codeBoxW / 2, barY + barH / 2 + 7.5);
      } else {
        ctx.fillText(codeLines[0], barX + codeBoxW / 2, barY + barH / 2);
      }

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

    // Descrição do Produto (ajusta fonte automaticamente de 13.5px até 10.5px para nunca cortar palavras)
    if (desc) {
      ctx.fillStyle = gridConfig.barTextColor || "#7A0D12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let chosenFontSize = 13.5;
      let wrapped = { lines: [desc], overflowed: false };
      for (const candidateSize of [13.5, 12.5, 11.5, 10.5]) {
        ctx.font = `900 ${candidateSize}px 'Segoe UI', Roboto, Arial, sans-serif`;
        wrapped = wrapText(ctx, desc, availableDescWidth, 2);
        chosenFontSize = candidateSize;
        if (!wrapped.overflowed) break;
      }

      ctx.font = `900 ${chosenFontSize}px 'Segoe UI', Roboto, Arial, sans-serif`;
      const descCenterX = textStartX + availableDescWidth / 2;
      const lineOffset = chosenFontSize >= 13 ? 8.5 : 7.5;

      if (wrapped.lines.length === 1) {
        ctx.fillText(wrapped.lines[0], descCenterX, barY + barH / 2, availableDescWidth);
      } else if (wrapped.lines.length >= 2) {
        ctx.fillText(wrapped.lines[0], descCenterX, barY + barH / 2 - lineOffset, availableDescWidth);
        ctx.fillText(wrapped.lines[1], descCenterX, barY + barH / 2 + lineOffset, availableDescWidth);
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

    const cleanFooter = footerText.trim().toUpperCase();
    const rawLines = cleanFooter.includes("\n")
      ? cleanFooter.split("\n").map((l) => l.trim()).filter(Boolean)
      : cleanFooter.length > 62 && cleanFooter.includes("OU ENQUANTO")
      ? [
          cleanFooter.split("OU ENQUANTO")[0].trim(),
          `OU ENQUANTO ${cleanFooter.split("OU ENQUANTO")[1].trim()}`,
        ]
      : [cleanFooter];

    ctx.font = "800 16px 'Segoe UI', Roboto, Arial, sans-serif";
    if (rawLines.length >= 2) {
      ctx.fillText(rawLines[0], canvasWidth / 2, 1876, canvasWidth - 48);
      ctx.fillText(rawLines.slice(1).join(" "), canvasWidth / 2, 1898, canvasWidth - 48);
    } else {
      ctx.fillText(rawLines[0], canvasWidth / 2, 1887, canvasWidth - 48);
    }
  }
  ctx.restore();
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
    const pageConfig: EncarteSemanalConfig = {
      ...config,
      gridConfig: getSemanalPageGridConfig(config.gridConfig, pageNum),
    };
    const canvas = await renderEncarteSemanalPageToCanvas(pageProducts, pageConfig);
    const blob = await canvasToBlob(canvas);
    const filename = `encarte_semanal_${dateStr}_pag_${pageNum}.png`;
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerFileDownload(zipBlob, `encarte_semanal_${dateStr}.zip`);
}
