/**
 * Exportação em PNG e ZIP do Encarte de Coleções (1080x1920 px)
 * Regras:
 * - Exporte PNG por página, 1080x1920.
 * - Nomeie os arquivos com o nome da coleção e o número da página.
 */

export function sanitizeCollectionFileName(name: string): string {
  return (name || "colecao")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "colecao";
}

export function formatColecaoPageFilename(collectionName: string, pageNumber: number): string {
  const cleanName = sanitizeCollectionFileName(collectionName);
  const pageStr = String(pageNumber).padStart(2, "0");
  return `${cleanName}-pagina-${pageStr}.png`;
}

/**
 * Exporta uma página individual para download em PNG (1080x1920)
 */
export async function exportColecaoPageAsPng(
  pageElement: HTMLElement,
  collectionName: string,
  pageNumber: number
): Promise<string> {
  const { toPng } = await import("html-to-image");

  const dataUrl = await toPng(pageElement, {
    width: 1080,
    height: 1920,
    pixelRatio: 1, // 1:1 exato com as dimensões 1080x1920
    cacheBust: true,
    style: {
      transform: "none",
    },
  });

  const filename = formatColecaoPageFilename(collectionName, pageNumber);

  // Trigger download no navegador
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return filename;
}

/**
 * Exporta todas as páginas da coleção em um arquivo .ZIP
 */
export async function exportColecaoAllPagesZip(
  pageElements: { element: HTMLElement; pageNumber: number }[],
  collectionName: string
): Promise<void> {
  const [{ default: JSZip }, { toPng }] = await Promise.all([
    import("jszip"),
    import("html-to-image"),
  ]);

  const zip = new JSZip();
  const cleanName = sanitizeCollectionFileName(collectionName);

  for (const item of pageElements) {
    const dataUrl = await toPng(item.element, {
      width: 1080,
      height: 1920,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: "none" },
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const filename = formatColecaoPageFilename(collectionName, item.pageNumber);
    zip.file(filename, base64Data, { base64: true });
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cleanName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
