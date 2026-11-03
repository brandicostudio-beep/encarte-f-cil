/**
 * Processador de imagens do Encarte de Coleções
 * Remove fundos brancos, cinzas e halos de fotos de produtos,
 * gerando imagens com fundo transparente (PNG transparente).
 */

const imageCache = new Map<string, string>();

/**
 * Recorta o fundo branco/cinza de uma imagem e retorna Data URL PNG transparente.
 * Em ambientes sem canvas real (Node/SSR/testes), retorna a imagem original ou mock transparente seguro.
 */
export async function removeWhiteBackground(src: string): Promise<string> {
  if (!src || !src.trim()) return "";

  // Retorna do cache se já processada
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }

  // Se estiver em ambiente Node/Vitest sem DOM real
  if (typeof window === "undefined" || !window.document || typeof Image === "undefined") {
    // Retorna a própria URL ou um data URL transparente em testes
    return src;
  }

  return new Promise<string>((resolve) => {
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
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const totalPixels = data.length;

        // Processa cada pixel (RGBA)
        for (let i = 0; i < totalPixels; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

          // Pixels quase brancos ou cinzas claros com baixa saturação de cor
          if (r > 220 && g > 220 && b > 220 && maxDiff <= 25) {
            if (r >= 240 && g >= 240 && b >= 240) {
              // 100% transparente
              data[i + 3] = 0;
            } else {
              // Transição suave para evitar halo nas bordas
              const avg = (r + g + b) / 3;
              const alphaFactor = Math.max(0, Math.min(1, (240 - avg) / 20));
              data[i + 3] = Math.round(a * alphaFactor);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const transparentPng = canvas.toDataURL("image/png");
        imageCache.set(src, transparentPng);
        resolve(transparentPng);
      } catch (err) {
        // Se houver restrição de CORS em imagem remota, fallback seguro para a URL original
        imageCache.set(src, src);
        resolve(src);
      }
    };

    img.onerror = () => {
      resolve(src);
    };

    img.src = src;
  });
}
