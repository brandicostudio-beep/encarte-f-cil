/**
 * Layout e cálculo de coordenadas da grade para o Encarte Semanal.
 * 4 colunas x 5 linhas = 20 produtos por tela.
 * Resolução padrão: 1080 x 1920.
 */

import {
  DEFAULT_ENCARTE_SEMANAL_GRID,
  type EncarteSemanalCellPosition,
  type EncarteSemanalGridConfig,
  type EncarteSemanalProduct,
} from "@/types/encarte-semanal";

/**
 * Calcula as coordenadas exatas de cada célula da grade na arte (1080x1920).
 * Respeita a configuração de topo (yStart), base (yEnd), margens e divisórias.
 */
export function calculateEncarteSemanalGridCells(
  gridConfig: EncarteSemanalGridConfig = DEFAULT_ENCARTE_SEMANAL_GRID
): EncarteSemanalCellPosition[] {
  const {
    xStart,
    xEnd,
    yStart,
    yEnd,
    columns,
    columnsCount = 4,
    rowsCount = 5,
    barHeight = 54,
  } = gridConfig;

  const totalHeight = yEnd - yStart;
  const rowHeight = totalHeight / rowsCount;
  const cells: EncarteSemanalCellPosition[] = [];

  const useDefaultExactColumns =
    columnsCount === 4 &&
    Array.isArray(columns) &&
    columns.length === 5 &&
    columns[0] === xStart &&
    columns[4] === xEnd;

  let index = 0;
  for (let r = 0; r < rowsCount; r++) {
    const y = yStart + r * rowHeight;

    for (let c = 0; c < columnsCount; c++) {
      let x: number;
      let width: number;

      if (useDefaultExactColumns) {
        x = columns[c];
        width = columns[c + 1] - x;
      } else {
        const colWidth = (xEnd - xStart) / columnsCount;
        x = xStart + c * colWidth;
        width = colWidth;
      }

      const photoAreaHeight = rowHeight - barHeight;
      const barY = y + photoAreaHeight;

      cells.push({
        index,
        colIndex: c,
        rowIndex: r,
        x,
        y,
        width,
        height: rowHeight,
        photoAreaHeight,
        barY,
        barHeight,
      });

      index++;
    }
  }

  return cells;
}

export interface SemanalPhotosResolution {
  photo1: string;
  photo2: string;
  hasTwoPhotos: boolean;
}

/**
 * Resolve as fotos a serem exibidas no box do Encarte Semanal (1 ou 2 fotos lado a lado).
 * Regras:
 * - Padrão visual clássico e espaçoso: 1 FOTO ÚNICA E CENTRALIZADA no box, com proporções 100% naturais.
 * - Duplicação (2 unidades da mesma foto): apenas se o usuário ativar explicitamente (duplicatePhoto === true).
 * - Duas fotos distintas (variação de sabor/fragrância ou 2º código): quando houver secondaryImage ou quando for item Principal com foto alternativa.
 */
export function resolveSemanalCellPhotos(product: EncarteSemanalProduct): SemanalPhotosResolution {
  const photo1 = product.image ? product.image.trim() : "";
  const photo2Custom = product.secondaryImage ? product.secondaryImage.trim() : "";
  const altPhoto =
    product.alternativePhotos && product.alternativePhotos.length > 0
      ? product.alternativePhotos[0].dataUrl
      : "";

  let photo2 = "";
  if (photo2Custom) {
    photo2 = photo2Custom;
  } else if (product.isPrincipal && altPhoto && altPhoto !== photo1) {
    photo2 = altPhoto;
  } else if (product.duplicatePhoto === true && photo1) {
    photo2 = photo1;
  }

  const hasTwoPhotos = Boolean(photo1 && photo2);

  return {
    photo1,
    photo2,
    hasTwoPhotos,
  };
}

export interface EncarteSemanalPaginationResult {
  pages: EncarteSemanalProduct[][];
  pendingProducts: EncarteSemanalProduct[];
  totalPages: number;
  totalValid: number;
  totalPending: number;
}

/**
 * Pagina os produtos em telas de 20 produtos (4x5).
 * Separa os produtos sem foto para a aba de pendências,
 * garantindo que não sejam gerados cards vazios no encarte final.
 */
export function paginateEncarteSemanalProducts(
  products: EncarteSemanalProduct[],
  itemsPerPage = 20
): EncarteSemanalPaginationResult {
  const validProducts: EncarteSemanalProduct[] = [];
  const pendingProducts: EncarteSemanalProduct[] = [];

  for (const prod of products || []) {
    if (prod.included === false) continue;

    // Regra: Produto sem foto vai para a lista de pendências
    if (!prod.image || prod.image.trim() === "") {
      pendingProducts.push(prod);
    } else {
      validProducts.push(prod);
    }
  }

  const pages: EncarteSemanalProduct[][] = [];
  const perPage = itemsPerPage > 0 ? itemsPerPage : 20;

  for (let i = 0; i < validProducts.length; i += perPage) {
    const chunk = validProducts.slice(i, i + perPage);
    pages.push(chunk);
  }

  // Se não houver nenhum produto válido mas houver lista, mantém pelo menos 1 página vazia
  if (pages.length === 0) {
    pages.push([]);
  }

  return {
    pages,
    pendingProducts,
    totalPages: pages.length,
    totalValid: validProducts.length,
    totalPending: pendingProducts.length,
  };
}
