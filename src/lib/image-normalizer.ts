/**
 * Normalizador Óptico e Balanceador de Proporção para Fotos de Produtos de Varejo.
 * 
 * Em encartes de supermercado, produtos reais possuem formatos e embalagens díspares:
 * - Garrafas e aerossóis (aspecto estreito e alto, ex: 1:3);
 * - Sacos e caixas (aspecto volumoso e quadrado, ex: 1:1);
 * - Potes e latas (aspecto médio ou largo, ex: 4:3).
 *
 * Além disso, fotos extraídas de catálogos frequentemente possuem bordas brancas/transparentes
 * excessivas embutidas no arquivo JPG/PNG, fazendo o produto parecer minúsculo em relação aos outros.
 *
 * Este módulo resolve:
 * 1. Cálculo de escala óptica compensatória baseada na razão de aspecto (Optical Sizing);
 * 2. Recorte automático de margens brancas e transparentes (Auto-Trim Canvas);
 * 3. Normalização de proporção visual para que todos os produtos pareçam do mesmo tamanho no encarte.
 */

export interface OpticalMetrics {
  aspectRatio: number;
  opticalScale: number;
  isSlender: boolean;
  isSquareBulky: boolean;
  isWide: boolean;
}

/**
 * Calcula a escala óptica ideal para equilibrar o peso visual do produto na grade.
 * - Produtos compridos/estreitos ganham ganho de escala vertical (zoom óptico);
 * - Produtos quadrados/volumosos recebem recuo óptico para não engolir o card;
 * - Produtos horizontais ganham ligeiro ganho para preencher a largura.
 */
export function calculateOpticalScale(aspectRatio: number): number {
  if (!aspectRatio || isNaN(aspectRatio) || aspectRatio <= 0) return 1.0;

  // Ultra-esguio (garrafas altas, sprays, tubos finos: ratio <= 0.45)
  if (aspectRatio <= 0.45) {
    return 1.28;
  }
  // Esguio (garrafas padrão, potes altos: 0.45 < ratio <= 0.65)
  if (aspectRatio <= 0.65) {
    return 1.18;
  }
  // Quadrado volumoso (sacos de salgadinho, caixas de sabão, fardos: 0.85 <= ratio <= 1.18)
  // Reduz ligeiramente para que a área (largura x altura) não seja desproporcionalmente gigante
  if (aspectRatio >= 0.85 && aspectRatio <= 1.18) {
    return 0.88;
  }
  // Largo / horizontal (barras, bandejas: ratio >= 1.35)
  if (aspectRatio >= 1.35) {
    return 1.12;
  }
  // Neutro/médio (0.65 < ratio < 0.85 ou 1.18 < ratio < 1.35)
  return 1.0;
}

/**
 * Retorna métricas completas para diagnóstico e balanceamento do produto.
 */
export function getOpticalMetrics(width: number, height: number): OpticalMetrics {
  const safeW = Math.max(1, width || 1);
  const safeH = Math.max(1, height || 1);
  const aspectRatio = safeW / safeH;
  const opticalScale = calculateOpticalScale(aspectRatio);

  return {
    aspectRatio,
    opticalScale,
    isSlender: aspectRatio <= 0.65,
    isSquareBulky: aspectRatio >= 0.85 && aspectRatio <= 1.18,
    isWide: aspectRatio >= 1.35,
  };
}

/**
 * Detecta e recorta bordas brancas ou transparentes de uma imagem (Data URL ou URL CORS-friendly).
 * Retorna a Data URL da imagem recortada rente ao produto e a nova razão de aspecto.
 */
export async function autoTrimImageWhitespace(
  imageSrc: string,
  tolerance = 15,
): Promise<{
  trimmedSrc: string;
  trimmedAspect: number;
  originalAspect: number;
  wasTrimmed: boolean;
}> {
  if (!imageSrc || typeof window === "undefined" || !window.document) {
    return { trimmedSrc: imageSrc, trimmedAspect: 1, originalAspect: 1, wasTrimmed: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const originalAspect = w / h;

        if (w < 10 || h < 10) {
          return resolve({ trimmedSrc: imageSrc, trimmedAspect: originalAspect, originalAspect, wasTrimmed: false });
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          return resolve({ trimmedSrc: imageSrc, trimmedAspect: originalAspect, originalAspect, wasTrimmed: false });
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let hasContent = false;

        const whiteThreshold = 255 - tolerance;

        // Amostra pixels para encontrar a caixa delimitadora (bounding box) real
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Fundo transparente
            const isTransparent = a < 25;
            // Fundo branco ou quase branco
            const isWhite =
              a >= 25 &&
              r >= whiteThreshold &&
              g >= whiteThreshold &&
              b >= whiteThreshold &&
              Math.abs(r - g) <= tolerance &&
              Math.abs(r - b) <= tolerance;

            if (!isTransparent && !isWhite) {
              hasContent = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // Se não encontrou conteúdo distinto ou a imagem é praticamente toda cheia
        if (!hasContent) {
          return resolve({ trimmedSrc: imageSrc, trimmedAspect: originalAspect, originalAspect, wasTrimmed: false });
        }

        const marginW = (minX + (w - 1 - maxX)) / w;
        const marginH = (minY + (h - 1 - maxY)) / h;

        // Só recorta se a margem detectada for superior a 5% (para evitar processamento desnecessário)
        if (marginW < 0.05 && marginH < 0.05) {
          return resolve({ trimmedSrc: imageSrc, trimmedAspect: originalAspect, originalAspect, wasTrimmed: false });
        }

        // Adiciona um respiro mínimo de segurança de 2% para não colar no produto
        const pad = Math.max(2, Math.round(Math.min(w, h) * 0.02));
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
        const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");
        if (!cropCtx) {
          return resolve({ trimmedSrc: imageSrc, trimmedAspect: originalAspect, originalAspect, wasTrimmed: false });
        }

        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const trimmedSrc = cropCanvas.toDataURL("image/png");
        const trimmedAspect = cropW / cropH;

        resolve({
          trimmedSrc,
          trimmedAspect,
          originalAspect,
          wasTrimmed: true,
        });
      } catch {
        // Em caso de restrição de CORS em imagem remota, fallback seguro sem quebrar
        resolve({ trimmedSrc: imageSrc, trimmedAspect: 1, originalAspect: 1, wasTrimmed: false });
      }
    };

    img.onerror = () => {
      resolve({ trimmedSrc: imageSrc, trimmedAspect: 1, originalAspect: 1, wasTrimmed: false });
    };

    img.src = imageSrc;
  });
}

/**
 * Otimiza e redimensiona uma imagem Base64 (Data URL) para dimensões máximas compatíveis
 * com os cards do encarte (máx 1200x1200px), reduzindo o peso de dezenas de megabytes para ~100KB.
 * Previne estouro de memória e cota de armazenamento no navegador.
 */
export function optimizeDataUrl(
  dataUrl: string,
  maxDimension = 1200,
  quality = 0.88
): Promise<string> {
  if (typeof window === "undefined" || !dataUrl || !dataUrl.startsWith("data:image")) {
    return Promise.resolve(dataUrl);
  }
  // Se for pequena (<150KB), não precisa reprocessar
  if (dataUrl.length < 150000) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h || (w <= maxDimension && h <= maxDimension)) {
          return resolve(dataUrl);
        }

        if (w > h) {
          if (w > maxDimension) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          }
        } else {
          if (h > maxDimension) {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0, w, h);
        const mime = dataUrl.includes("image/png") ? "image/png" : "image/jpeg";
        const optimized = canvas.toDataURL(mime, quality);
        resolve(optimized);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
