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
  gridConfig: EncarteSemanalGridConfig = DEFAULT_ENCARTE_SEMANAL_GRID,
  productCount?: number
): EncarteSemanalCellPosition[] {
  const {
    xStart,
    xEnd,
    yStart,
    yEnd,
    columnsCount = 4,
    rowsCount = 5,
    itemsPerPage,
    barHeight = 54,
  } = gridConfig;

  const targetCount =
    typeof productCount === "number" && productCount > 0
      ? productCount
      : typeof itemsPerPage === "number" && itemsPerPage > 0
      ? itemsPerPage
      : columnsCount * rowsCount;

  const dynColumns = Math.max(1, Math.min(columnsCount, targetCount));
  const dynRows = Math.max(1, Math.ceil(targetCount / dynColumns));

  const totalWidth = xEnd - xStart;
  const totalHeight = yEnd - yStart;
  const cellWidth = totalWidth / dynColumns;
  const cellHeight = totalHeight / dynRows;

  const cells: EncarteSemanalCellPosition[] = [];
  let index = 0;
  for (let r = 0; r < dynRows; r++) {
    const remaining = targetCount - index;
    const itemsInRow = Math.min(dynColumns, remaining);
    if (itemsInRow <= 0) break;

    const rowWidth = itemsInRow * cellWidth;
    const rowOffsetX = xStart + (totalWidth - rowWidth) / 2;
    const y = yStart + r * cellHeight;

    for (let c = 0; c < itemsInRow; c++) {
      const x = rowOffsetX + c * cellWidth;
      const photoAreaHeight = cellHeight - barHeight;
      const barY = y + photoAreaHeight;
      cells.push({
        index,
        colIndex: c,
        rowIndex: r,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        photoAreaHeight,
        barY,
        barHeight,
      });
      index++;
    }
  }
  return cells;
}

/**
 * Retorna a configuração de grade efetiva para uma página específica (ex.: Página 1 com 18 itens, Página 2 com 10).
 */
export function getSemanalPageGridConfig(
  gridConfig: EncarteSemanalGridConfig = DEFAULT_ENCARTE_SEMANAL_GRID,
  pageNumber = 1
): EncarteSemanalGridConfig {
  const customCount = gridConfig.perPageItems?.[pageNumber];
  const baseCount = gridConfig.itemsPerPage || gridConfig.columnsCount * gridConfig.rowsCount || 20;
  const count = typeof customCount === "number" && customCount > 0 ? customCount : baseCount;

  if (count === baseCount) {
    return {
      ...gridConfig,
      itemsPerPage: count,
    };
  }

  const autoCols =
    count <= 2 ? count : count <= 4 ? 2 : count <= 8 ? 3 : count <= 20 ? 4 : count <= 25 ? 5 : 6;
  const autoRows = Math.max(1, Math.ceil(count / autoCols));

  return {
    ...gridConfig,
    itemsPerPage: count,
    columnsCount: autoCols,
    rowsCount: autoRows,
  };
}

/**
 * Calcula o índice global inicial (slotIndex) de uma página considerando quantidades individuais por página.
 */
export function getSemanalPageStartOffset(
  gridConfig: EncarteSemanalGridConfig = DEFAULT_ENCARTE_SEMANAL_GRID,
  pageNumber = 1
): number {
  let offset = 0;
  for (let p = 1; p < pageNumber; p++) {
    offset += getSemanalPageGridConfig(gridConfig, p).itemsPerPage;
  }
  return offset;
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

/**
 * Resolve os produtos de cada slot (0..totalSlots-1) de uma página específica,
 * garantindo que cada página fique 100% isolada e nenhum produto seja duplicado
 * em dois boxes quando outros itens forem editados ou movidos.
 */
export function resolveSemanalPageSlotProducts(
  products: EncarteSemanalProduct[],
  gridConfig: EncarteSemanalGridConfig,
  pageNum: number,
  pageItems: EncarteSemanalProduct[],
  totalSlots: number
): (EncarteSemanalProduct | null)[] {
  const slots: (EncarteSemanalProduct | null)[] = Array.from({ length: totalSlots }, () => null);
  const assignedIds = new Set<string>();
  const pageOffset = getSemanalPageStartOffset(gridConfig, pageNum);
  const baseItemsPerPage = gridConfig.itemsPerPage || 20;

  // 1. Prioridade máxima: posição local exata na página (pageIndex + pageSlotIndex)
  for (const p of products) {
    if (
      p.pageIndex === pageNum &&
      p.pageSlotIndex !== undefined &&
      p.pageSlotIndex >= 0 &&
      p.pageSlotIndex < totalSlots &&
      !slots[p.pageSlotIndex] &&
      !assignedIds.has(p.id)
    ) {
      slots[p.pageSlotIndex] = p;
      assignedIds.add(p.id);
    }
  }

  // 2. Produtos salvos com pageIndex explícito + slotIndex legado (nunca vaza para outra página!)
  const pageOwnedWithLegacySlot = products.filter(
    (p) => p.pageIndex === pageNum && p.pageSlotIndex === undefined && !assignedIds.has(p.id)
  );
  if (pageOwnedWithLegacySlot.length > 0) {
    const remainingLegacy: EncarteSemanalProduct[] = [];
    for (const p of pageOwnedWithLegacySlot) {
      const localIdx = p.slotIndex !== undefined ? p.slotIndex - pageOffset : -1;
      if (localIdx >= 0 && localIdx < totalSlots && !slots[localIdx] && !assignedIds.has(p.id)) {
        slots[localIdx] = p;
        assignedIds.add(p.id);
      } else {
        remainingLegacy.push(p);
      }
    }
    if (remainingLegacy.length > 0) {
      const sortedRemaining = [...remainingLegacy].sort(
        (a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0)
      );
      let cursor = 0;
      for (const p of sortedRemaining) {
        if (assignedIds.has(p.id)) continue;
        while (cursor < totalSlots && slots[cursor] !== null) cursor++;
        if (cursor >= totalSlots) break;
        slots[cursor] = p;
        assignedIds.add(p.id);
      }
    }
  }

  // 3. Produtos legados sem pageIndex, mas com slotIndex global explícito (restritos à sua página de origem)
  for (const p of products) {
    if (
      p.pageIndex === undefined &&
      p.slotIndex !== undefined &&
      Math.floor(p.slotIndex / baseItemsPerPage) + 1 === pageNum &&
      !assignedIds.has(p.id)
    ) {
      const localIdx = p.slotIndex - pageOffset;
      if (localIdx >= 0 && localIdx < totalSlots && !slots[localIdx]) {
        slots[localIdx] = p;
        assignedIds.add(p.id);
      }
    }
  }

  // 4. Produtos importados via planilha sem pageIndex nem slotIndex (sequência da página)
  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    if (slots[slotIdx]) continue;
    const unpinned = pageItems[slotIdx];
    if (
      unpinned &&
      unpinned.pageIndex === undefined &&
      unpinned.slotIndex === undefined &&
      !assignedIds.has(unpinned.id)
    ) {
      slots[slotIdx] = unpinned;
      assignedIds.add(unpinned.id);
    }
  }

  return slots;
}
