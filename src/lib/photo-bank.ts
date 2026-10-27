import JSZip from "jszip";
import type { EncarteProduct } from "@/types/encarte";

export interface LoadedPhoto {
  filename: string;
  dataUrl: string;
  extractedCode: string;
}

export interface PhotoBankResult {
  totalPhotos: number;
  matchedCount: number;
  unmatchedPhotos: string[];
  photosByCode: Map<string, { filename: string; dataUrl: string }>;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

/**
 * Extrai o código do produto a partir do nome do arquivo.
 * Aceita: "24657.jpg", "24657-1.jpg", "24657_frente.jpg", "00123-embalagem.png".
 * Se fornecida uma lista de códigos de produtos existentes, prioriza correspondência exata ou por prefixo.
 */
export function extractProductCodeFromFilename(
  filename: string,
  knownCodes?: string[]
): string {
  // Remover caminho se houver e extensão
  const basename = filename.split("/").pop()?.split("\\").pop()?.replace(IMAGE_EXTENSIONS, "") || "";
  const cleanBase = basename.trim();

  // 1. Se tivermos os códigos conhecidos, checa se algum casa com o início do arquivo
  if (knownCodes && knownCodes.length > 0) {
    // Ordenar códigos pelo comprimento decrescente para evitar que um prefixo curto "24" pegue "24657"
    const sorted = [...knownCodes].sort((a, b) => b.length - a.length);
    for (const code of sorted) {
      const c = code.trim();
      if (!c) continue;
      if (
        cleanBase.toLowerCase() === c.toLowerCase() ||
        cleanBase.toLowerCase().startsWith(`${c.toLowerCase()}-`) ||
        cleanBase.toLowerCase().startsWith(`${c.toLowerCase()}_`) ||
        cleanBase.toLowerCase().startsWith(`${c.toLowerCase()} `)
      ) {
        return c;
      }
    }
  }

  // 2. Extração genérica: pega o token alfanumérico inicial antes do primeiro delimitador (- ou _)
  const tokenMatch = cleanBase.match(/^([A-Za-z0-9]+)/);
  if (tokenMatch) {
    return tokenMatch[1] ?? cleanBase;
  }

  return cleanBase;
}

/**
 * Converte um File de imagem para Data URL.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Processa upload de imagens em lote (FileList / File[]) ou arquivo compactado (.zip).
 */
export async function processPhotoBankUpload(
  files: File[] | FileList,
  knownProductCodes: string[] = []
): Promise<LoadedPhoto[]> {
  const loadedPhotos: LoadedPhoto[] = [];
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    // 1. Se for arquivo .zip
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.keys(zip.files).filter(
          (path) => !path.startsWith("__MACOSX") && IMAGE_EXTENSIONS.test(path)
        );

        for (const path of entries) {
          const zipEntry = zip.files[path];
          if (zipEntry && !zipEntry.dir) {
            const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
            const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/jpeg";
            const base64 = await zipEntry.async("base64");
            const dataUrl = `data:${mime};base64,${base64}`;
            const filename = path.split("/").pop() || path;
            const extractedCode = extractProductCodeFromFilename(filename, knownProductCodes);

            loadedPhotos.push({ filename, dataUrl, extractedCode });
          }
        }
      } catch (err) {
        console.error("Erro ao descompactar arquivo .zip:", err);
      }
    } else if (IMAGE_EXTENSIONS.test(file.name)) {
      // 2. Arquivo de imagem avulso
      try {
        const dataUrl = await fileToDataUrl(file);
        const extractedCode = extractProductCodeFromFilename(file.name, knownProductCodes);
        loadedPhotos.push({ filename: file.name, dataUrl, extractedCode });
      } catch (err) {
        console.error(`Erro ao ler imagem ${file.name}:`, err);
      }
    }
  }

  return loadedPhotos;
}

/**
 * Associa as fotos carregadas aos produtos.
 * Regra: Quando houver mais de uma foto do mesmo código, usar a primeira em ordem alfabética.
 */
export function matchPhotosWithProducts(
  loadedPhotos: LoadedPhoto[],
  products: EncarteProduct[]
): {
  updatedProducts: EncarteProduct[];
  matchedCount: number;
  unmatchedPhotos: string[];
} {
  // Agrupar fotos por código do produto
  const photosByCode = new Map<string, LoadedPhoto[]>();

  for (const photo of loadedPhotos) {
    const code = photo.extractedCode.toLowerCase().trim();
    if (!photosByCode.has(code)) {
      photosByCode.set(code, []);
    }
    photosByCode.get(code)!.push(photo);
  }

  // Para cada código com múltiplas fotos, ordenar alfabeticamente pelo filename e pegar a primeira
  const selectedPhotoByCode = new Map<string, LoadedPhoto>();
  for (const [code, list] of photosByCode.entries()) {
    list.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
    const first = list[0];
    if (first) selectedPhotoByCode.set(code, first);
  }

  const validProductCodes = new Set(products.map((p) => p.code.toLowerCase().trim()));
  const matchedCodes = new Set<string>();

  // Prioridade da imagem:
  // 1. Foto do banco de fotos
  // 2. Imagem da página (se já tiver)
  // 3. Placeholder neutro (se vazio)
  const updatedProducts = products.map((product) => {
    const code = product.code.toLowerCase().trim();
    const photo = selectedPhotoByCode.get(code);

    if (photo) {
      matchedCodes.add(code);
      return {
        ...product,
        image: photo.dataUrl,
      };
    }
    return product;
  });

  // Fotos que não correspondem a nenhum produto
  const unmatchedPhotos: string[] = [];
  for (const photo of loadedPhotos) {
    const code = photo.extractedCode.toLowerCase().trim();
    if (!validProductCodes.has(code)) {
      unmatchedPhotos.push(photo.filename);
    }
  }

  return {
    updatedProducts,
    matchedCount: matchedCodes.size,
    unmatchedPhotos,
  };
}
