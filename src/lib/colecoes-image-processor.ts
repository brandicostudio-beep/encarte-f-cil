/**
 * Processador de imagens de alta performance.
 * Remove fundos brancos, off-white, cinzas claros e halos com algoritmo Flood-Fill (BFS) de borda,
 * preserva textos e detalhes brancos internos do rótulo,
 * aplica auto-trim no conteúdo útil e gera imagens com fundo transparente (PNG transparente).
 * Suporta proxy de imagens remotas para evitar restrições de CORS no Canvas.
 */

const imageCache = new Map<string, string>();

/**
 * Converte URLs remotas (ex: AgileCDN da Cescom) em Data URL via proxy do servidor
 * para eliminar completamente bloqueios de CORS e canvas tainted.
 */
async function loadRemoteUrlAsDataUrl(src: string): Promise<string> {
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    return src;
  }

  // 1. Tentar via endpoint de proxy da aplicação
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(src);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  // 2. Tentar fetch direto se a origem suportar CORS
  try {
    const directRes = await fetch(src);
    if (directRes.ok) {
      const blob = await directRes.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(src);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  return src;
}

/**
 * Recorta o fundo branco/cinza de uma imagem e retorna Data URL PNG transparente com auto-trim.
 * Utiliza BFS Flood-Fill a partir das bordas externas, garantindo que detalhes e textos brancos
 * no interior da embalagem (ex: "Predilecta", "Yoki", "Royal") permaneçam 100% intactos.
 */
export async function removeWhiteBackground(src: string): Promise<string> {
  if (!src || !src.trim()) return "";

  // 1. Se já for PNG (que já possui fundo transparente da pasta de origem ou upload),
  // NUNCA fazer recorte destrutivo ou re-processamento que deforme o produto.
  if (src.startsWith("data:image/png")) {
    return src;
  }

  // Retorna do cache se já processada com sucesso
  if (imageCache.has(src)) {
    const cached = imageCache.get(src)!;
    if (cached.startsWith("data:image/png")) {
      return cached;
    }
  }

  // Ambiente sem DOM/Image real (Node/Vitest/SSR)
  if (
    typeof window === "undefined" ||
    !window.document ||
    typeof Image === "undefined"
  ) {
    return src;
  }

  // Se for URL remota (ex: AgileCDN), converte para Data URL via proxy primeiro
  const targetSrc = await loadRemoteUrlAsDataUrl(src);

  return new Promise<string>((resolve) => {
    // Timeout generoso para redes remotas
    const timer = setTimeout(() => {
      resolve(targetSrc);
    }, 6000);

    const finish = (result: string) => {
      clearTimeout(timer);
      if (result && result.startsWith("data:image/png")) {
        imageCache.set(src, result);
        if (targetSrc !== src) {
          imageCache.set(targetSrc, result);
        }
      }
      resolve(result);
    };

    const img = new Image();
    // Apenas define crossOrigin se ainda for URL remota (Data URL não pode ter crossOrigin)
    if (!targetSrc.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 300;
        const height = img.naturalHeight || img.height || 300;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          finish(targetSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // BFS Flood-Fill para remover APENAS o fundo conectado às 4 bordas externas
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];

        const isBgPixel = (p1d: number) => {
          const idx = p1d * 4;
          const a = data[idx + 3];
          if (a === 0) return true; // Já transparente

          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const maxDiff = Math.max(
            Math.abs(r - g),
            Math.abs(g - b),
            Math.abs(r - b)
          );

          // Pixels claros com baixa saturação (branco, off-white, cinza claro e ruído JPEG)
          return (
            (r >= 180 && g >= 180 && b >= 180 && maxDiff <= 38) ||
            (r >= 225 && g >= 225 && b >= 225)
          );
        };

        // 1. Inicializa fila com pixels das 4 bordas
        for (let x = 0; x < width; x++) {
          const top = 0 * width + x;
          if (isBgPixel(top)) {
            visited[top] = 1;
            queue.push(top);
          }
          const bot = (height - 1) * width + x;
          if (isBgPixel(bot)) {
            visited[bot] = 1;
            queue.push(bot);
          }
        }
        for (let y = 0; y < height; y++) {
          const left = y * width + 0;
          if (isBgPixel(left)) {
            visited[left] = 1;
            queue.push(left);
          }
          const right = y * width + (width - 1);
          if (isBgPixel(right)) {
            visited[right] = 1;
            queue.push(right);
          }
        }

        // 2. Executa Flood-Fill
        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const cx = curr % width;
          const cy = Math.floor(curr / width);
          const pIdx = curr * 4;

          // Torna o pixel do fundo 100% transparente
          data[pIdx + 3] = 0;

          // 4 vizinhos
          const neighbors = [
            cy > 0 ? (cy - 1) * width + cx : -1,
            cy < height - 1 ? (cy + 1) * width + cx : -1,
            cx > 0 ? cy * width + (cx - 1) : -1,
            cx < width - 1 ? cy * width + (cx + 1) : -1,
          ];

          for (const n of neighbors) {
            if (n >= 0 && !visited[n] && isBgPixel(n)) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        // 3. Calcula bounding box do conteúdo remanescente para Auto-Trim
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let hasContent = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] > 15) {
              hasContent = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Retorna o PNG transparente mantendo as dimensões e proporções originais
        // (sem corte automático destrutivo que corta tampas ou deforma a embalagem)
        const transparentPng = canvas.toDataURL("image/png");
        finish(transparentPng);
      } catch (err) {
        console.warn("Erro ao processar canvas:", err);
        finish(targetSrc);
      }
    };

    img.onerror = () => {
      finish(targetSrc);
    };

    img.src = targetSrc;
  });
}
