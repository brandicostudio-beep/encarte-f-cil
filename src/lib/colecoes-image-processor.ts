/**
 * Processador de imagens do Encarte de Coleções
 * Remove fundos brancos, cinzas e halos de fotos de produtos,
 * aplica auto-trim no conteúdo útil e gera imagens com fundo transparente (PNG transparente).
 */

const imageCache = new Map<string, string>();

/**
 * Recorta o fundo branco/cinza de uma imagem e retorna Data URL PNG transparente com auto-trim.
 * Em ambientes sem canvas real (Node/Vitest/SSR), retorna a imagem original com segurança.
 */
export async function removeWhiteBackground(src: string): Promise<string> {
  if (!src || !src.trim()) return "";

  // Retorna do cache se já processada
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }

  // Ambiente sem DOM/Image real
  if (
    typeof window === "undefined" ||
    !window.document ||
    typeof Image === "undefined"
  ) {
    return src;
  }

  return new Promise<string>((resolve) => {
    // Timeout de segurança para evitar travamentos em testes ou redes instáveis
    const timer = setTimeout(() => {
      imageCache.set(src, src);
      resolve(src);
    }, 800);

    const finish = (result: string) => {
      clearTimeout(timer);
      imageCache.set(src, result);
      resolve(result);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 300;
        const height = img.naturalHeight || img.height || 300;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          finish(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let hasContent = false;

        // Processa cada pixel (RGBA) e detecta bounding box do conteúdo
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            if (a === 0) continue;

            const maxDiff = Math.max(
              Math.abs(r - g),
              Math.abs(g - b),
              Math.abs(r - b)
            );

            // Pixels quase brancos ou cinzas claros com baixa saturação (limiar aperfeiçoado)
            if (r > 215 && g > 215 && b > 215 && maxDiff <= 25) {
              if (r >= 238 && g >= 238 && b >= 238) {
                // 100% transparente
                data[idx + 3] = 0;
              } else {
                // Transição suave para evitar halo nas bordas
                const avg = (r + g + b) / 3;
                const alphaFactor = Math.max(0, Math.min(1, (238 - avg) / 23));
                data[idx + 3] = Math.round(a * alphaFactor);
              }
            }

            // Se o pixel final tiver conteúdo visível
            if (data[idx + 3] > 20) {
              hasContent = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Auto-trim: se detectou margens ao redor do conteúdo útil, recorta
        if (hasContent && (minX > 2 || minY > 2 || maxX < width - 3 || maxY < height - 3)) {
          const trimW = Math.max(10, maxX - minX + 1);
          const trimH = Math.max(10, maxY - minY + 1);
          const trimmedCanvas = document.createElement("canvas");
          trimmedCanvas.width = trimW;
          trimmedCanvas.height = trimH;
          const trimCtx = trimmedCanvas.getContext("2d");
          if (trimCtx) {
            trimCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
            const trimmedPng = trimmedCanvas.toDataURL("image/png");
            finish(trimmedPng);
            return;
          }
        }

        const transparentPng = canvas.toDataURL("image/png");
        finish(transparentPng);
      } catch {
        finish(src);
      }
    };

    img.onerror = () => {
      finish(src);
    };

    img.src = src;
  });
}
