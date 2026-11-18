/**
 * Utilitários para formatação e nomenclatura de arquivos exportados do Encarte (PNG e ZIP).
 * 
 * Padrão solicitado:
 * - Páginas numeradas e com data: ex: validade_curta_17_11_2026_pag_1.png
 * - Arquivo ZIP: ex: validade_curta_17_11_2026.zip
 */

/**
 * Retorna a data no formato DD_MM_YYYY
 */
export function formatExportDate(date: Date = new Date()): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}_${mm}_${yyyy}`;
}

/**
 * Sanitiza e define o prefixo base do nome do arquivo.
 * Padrão: "validade_curta"
 * Se houver título customizado pelo usuário (diferente dos títulos genéricos),
 * converte para snake_case limpo.
 */
export function getEncarteFileBaseSlug(title?: string): string {
  if (!title) return "validade_curta";

  const clean = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Títulos genéricos/padrões viram "validade_curta"
  if (
    !clean ||
    clean === "encarte" ||
    clean === "detona_precos" ||
    clean === "encarte_ofertas_da_semana" ||
    clean === "ofertas_da_semana" ||
    clean.includes("validade")
  ) {
    return "validade_curta";
  }

  return clean;
}

/**
 * Monta o nome do arquivo PNG de uma página específica.
 * Ex: validade_curta_17_11_2026_pag_1.png
 */
export function buildEncartePageFilename(
  baseSlug: string,
  dateStr: string,
  pageNumber: number
): string {
  return `${baseSlug}_${dateStr}_pag_${pageNumber}.png`;
}

/**
 * Monta o nome do arquivo ZIP com todas as páginas.
 * Ex: validade_curta_17_11_2026.zip
 */
export function buildEncarteZipFilename(
  baseSlug: string,
  dateStr: string
): string {
  return `${baseSlug}_${dateStr}.zip`;
}
