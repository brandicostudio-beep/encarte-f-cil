import type {
  ColecaoProduct,
  ColecaoGridArea,
  ColecaoGridSettings,
  Rect,
} from "@/types/colecoes";
import { DEFAULT_COLECAO_GRID_AREA } from "@/types/colecoes";
import {
  extractGenericBaseName,
  extractGenericGroupTitle,
  parseNormalizedWeight,
  parsePackagingType,
  extractBrand,
  normalizeText,
} from "./colecoes-similarity";

export type { ColecaoGridSettings, Rect };

export interface CardDisplayData {
  photo1: string;
  photo2: string;
  title: string;
  code?: string; // Presente APENAS para não-principal (Regra 3)
  isPrincipal: boolean;
  hasVariants: boolean;
}

export interface GridCellPosition {
  colIndex: number;
  rowIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CategorizedColecaoProducts {
  displayProducts: ColecaoProduct[];
  pendingProducts: ColecaoProduct[];
}

/**
 * Resolve as informações de exibição de um card segundo as regras do Encarte de Coleções:
 *
 * 1. Principal com variações: as duas primeiras fotos da lista lado a lado,
 *    apenas a descrição genérica (ex: "Biscoito Oreo 80g" ou "Sabonete Ypê"). Sem código e sem nome da variação.
 * 2. Principal sem variações: a foto principal repetida nas duas posições,
 *    apenas a descrição genérica. Sem código.
 * 3. Não principal: duas posições com a mesma foto, descrição e código do produto em amarelo (CÓD: xxxxx).
 */
export function resolveCardDisplayData(product: ColecaoProduct): CardDisplayData {
  const photoPrincipal = product.image || "";
  const customSecondary = (product.secondaryImage || "").trim();

  if (product.isPrincipal) {
    const title = (
      product.genericDescription || extractGenericBaseName(product.description)
    ).trim();

    // Se o usuário personalizou explicitamente a foto secundária (slot 2)
    if (customSecondary) {
      return {
        photo1: photoPrincipal,
        photo2: customSecondary,
        title,
        code: undefined,
        isPrincipal: true,
        hasVariants: true,
      };
    }

    const variants = product.variants || [];
    // Prioriza variação com foto diferente da principal para renderizar as duas fotos lado a lado
    const firstVariantWithDifferentPhoto = variants.find(
      (v) => Boolean(v.image && v.image.trim() !== "" && v.image !== photoPrincipal)
    );
    const firstVariantWithAnyPhoto = variants.find(
      (v) => Boolean(v.image && v.image.trim() !== "")
    );
    const chosenVariant = firstVariantWithDifferentPhoto || firstVariantWithAnyPhoto;

    if (chosenVariant && chosenVariant.image) {
      // Regra 1: Principal com variações
      return {
        photo1: photoPrincipal,
        photo2: chosenVariant.image,
        title,
        code: undefined, // Sem código para principal
        isPrincipal: true,
        hasVariants: true,
      };
    } else {
      // Regra 2: Principal sem variações
      return {
        photo1: photoPrincipal,
        photo2: photoPrincipal, // Foto principal repetida nas duas posições
        title,
        code: undefined, // Sem código para principal
        isPrincipal: true,
        hasVariants: false,
      };
    }
  }

  // Regra 3: Não principal
  return {
    photo1: photoPrincipal,
    photo2: customSecondary || photoPrincipal, // Permite foto secundária customizada ou repete foto 1
    title: product.description.trim(), // Descrição original
    code: product.code, // Código do produto visível (CÓD: xxxxx)
    isPrincipal: false,
    hasVariants: Boolean(customSecondary && customSecondary !== photoPrincipal),
  };
}

/**
 * Separa produtos sem foto para a Lista de Pendências e agrupa produtos
 * com o mesmo nome-base genérico em um único card principal, evitando duplicidades.
 */
export function categorizeAndGroupColecaoProducts(
  products: ColecaoProduct[]
): CategorizedColecaoProducts {
  const pendingProducts: ColecaoProduct[] = [];
  const validProducts: ColecaoProduct[] = [];

  for (const p of products || []) {
    // Regra de segurança: Produto sem foto não gera card vazio. Aparece como pendência.
    if (!p.image || p.image.trim() === "") {
      pendingProducts.push(p);
    } else if (p.included !== false) {
      validProducts.push(p);
    }
  }

  // Conjunto de IDs que já foram atribuídos explicitamente como variações de algum principal
  const explicitlyAssignedVariantIds = new Set<string>();
  for (const p of validProducts) {
    if (p.isPrincipal && Array.isArray(p.variantIds)) {
      for (const vid of p.variantIds) {
        explicitlyAssignedVariantIds.add(vid);
      }
    }
  }

  // Agrupamento por critérios de variação real:
  // 1. Mesmo nome-base (extractGenericGroupTitle)
  // 2. Mesma marca (extractBrand)
  // 3. Mesma gramatura ou volume normalizados (parseNormalizedWeight)
  // 4. Mesmo tipo de embalagem (parsePackagingType)
  // Produtos com gramaturas diferentes (ex.: 1,3 kg vs 2,2 kg) geram cards distintos.
  const groupsByKey = new Map<string, ColecaoProduct[]>();

  for (const prod of validProducts) {
    // Se o produto já foi atribuído como variação interna de outro principal, não forma grupo standalone
    if (explicitlyAssignedVariantIds.has(prod.id)) {
      continue;
    }

    const weight = parseNormalizedWeight(prod.description);
    const pkg = parsePackagingType(prod.description);
    const brand = extractBrand(prod.description);
    const baseTitle =
      extractGenericGroupTitle(prod.description) ||
      extractGenericBaseName(prod.description) ||
      prod.description;
    const baseNorm = normalizeText(baseTitle);

    let groupKey: string;
    if (weight) {
      const weightKey = `${weight.value}${weight.unit}`;
      const pkgKey = pkg !== "padrao" ? pkg : "";
      groupKey = `${baseNorm}|${brand}|${weightKey}|${pkgKey}`;
    } else if (prod.isPrincipal) {
      // Principal explicitamente definido sem gramatura específica
      groupKey = `${baseNorm}|${brand}|principal_${prod.id}`;
    } else {
      // Sem gramatura informada: agrupa se tiver a mesma base genérica ou descrição exata
      const normDesc = normalizeText(prod.description);
      groupKey = `${baseNorm}|${brand}|pendente|${normDesc}`;
    }

    // Se houver algum grupo já existente com o mesmo baseTitle e brand compatível
    // e o produto atual for não-principal enquanto o grupo tiver um principal compatível sem choque de peso:
    let matchedKey = groupKey;
    if (!weight && !prod.isPrincipal) {
      for (const [k, items] of groupsByKey.entries()) {
        const hasPrincipal = items.some((it) => it.isPrincipal);
        if (hasPrincipal && k.startsWith(`${baseNorm}|${brand}|`)) {
          // Checar se não há choque explícito de gramatura
          const itemWeight = parseNormalizedWeight(items[0].description);
          if (!itemWeight) {
            matchedKey = k;
            break;
          }
        }
      }
    }

    const existing = groupsByKey.get(matchedKey);
    if (existing) {
      existing.push(prod);
    } else {
      groupsByKey.set(matchedKey, [prod]);
    }
  }

  const displayProducts: ColecaoProduct[] = [];

  for (const [_key, groupItems] of groupsByKey.entries()) {
    if (groupItems.length === 1) {
      // Produto único no grupo
      const item = groupItems[0];
      displayProducts.push(item);
    } else {
      // Múltiplos produtos compatíveis agrupados em um único principal
      const explicitPrincipal = groupItems.find((p) => p.isPrincipal);
      const mainProd = explicitPrincipal || groupItems[0];
      const otherVariants = groupItems.filter((p) => p.id !== mainProd.id);

      const genericTitle =
        mainProd.genericDescription ||
        extractGenericGroupTitle(mainProd.description) ||
        extractGenericBaseName(mainProd.description).trim().toUpperCase();

      const combinedVariants = [...(mainProd.variants || []), ...otherVariants];

      const groupedPrincipal: ColecaoProduct = {
        ...mainProd,
        isPrincipal: true,
        genericDescription: genericTitle,
        variants: combinedVariants,
        variantIds: combinedVariants.map((v) => v.id),
      };

      displayProducts.push(groupedPrincipal);
    }
  }

  return {
    displayProducts,
    pendingProducts,
  };
}

/**
 * Calcula as coordenadas exatas da grade configurável (colunas x linhas) dentro da área vermelha.
 * Suporta colunas customizadas (1 a 6), linhas customizadas (1 a 10) e espaçamento entre células.
 * Mantém compatibilidade exata com o padrão histórico de 4 colunas x 5 linhas em [29, 286, 541, 794, 1051].
 */
export function calculateGridCellPositions(
  gridArea: ColecaoGridArea = DEFAULT_COLECAO_GRID_AREA,
  customCols?: number,
  customRows?: number,
  cellSpacing = 0
): GridCellPosition[] {
  const cells: GridCellPosition[] = [];
  const { xStart, xEnd, yStart, yEnd } = gridArea;

  const numCols =
    customCols && customCols >= 1
      ? customCols
      : gridArea.columns
      ? gridArea.columns.length - 1
      : 4;
  const numRows =
    customRows && customRows >= 1 ? customRows : gridArea.rows || 5;

  const totalWidth = xEnd - xStart;
  const totalHeight = yEnd - yStart;

  // Se numCols for igual ao número padrão de colunas (4) e sem espaçamento, usa as colunas exatas históricas
  const useExactDefaultCols =
    numCols === 4 &&
    cellSpacing === 0 &&
    gridArea.columns &&
    gridArea.columns.length === 5;

  const rowHeight = totalHeight / numRows;

  for (let r = 0; r < numRows; r++) {
    const y = yStart + r * rowHeight + (cellSpacing > 0 ? cellSpacing / 2 : 0);
    const h = rowHeight - (cellSpacing > 0 ? cellSpacing : 0);

    for (let c = 0; c < numCols; c++) {
      let x: number;
      let w: number;

      if (useExactDefaultCols) {
        x = gridArea.columns[c];
        w = gridArea.columns[c + 1] - x;
      } else {
        const colWidth = totalWidth / numCols;
        x = xStart + c * colWidth + (cellSpacing > 0 ? cellSpacing / 2 : 0);
        w = colWidth - (cellSpacing > 0 ? cellSpacing : 0);
      }

      cells.push({
        colIndex: c,
        rowIndex: r,
        x,
        y,
        width: w,
        height: h,
      });
    }
  }

  return cells;
}

/**
 * Pagina itens genéricos em lotes de tamanho `perPage`.
 */
export function paginate<T>(items: T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/**
 * Calcula os retângulos de células da grade conforme as configurações e área informada.
 */
export function getCellRects(
  s: ColecaoGridSettings,
  area: { x: number; y: number; width: number; height: number }
): Rect[] {
  const cellW = (area.width - s.gapX * (s.columns - 1)) / s.columns;
  const cellH = (area.height - s.gapY * (s.rows - 1)) / s.rows;
  const rects: Rect[] = [];
  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.columns; col++) {
      rects.push({
        x: area.x + col * (cellW + s.gapX),
        y: area.y + row * (cellH + s.gapY),
        w: cellW,
        h: cellH,
        col,
        row,
      });
    }
  }
  return rects;
}

// Ordem de empilhamento: o lado escolhido fica na frente
export function zIndexFor(col: number, s: ColecaoGridSettings): number {
  return s.frontSide === "left" ? s.columns - col : col + 1;
}

/**
 * Divide a lista de produtos em páginas com no máximo `itemsPerPage` produtos por página (padrão: 20).
 * Exemplo:
 * - 21 produtos -> Página 1 com 20, Página 2 com 1
 * - 40 produtos -> Página 1 com 20, Página 2 com 20
 */
export function paginateColecaoProducts(
  products: ColecaoProduct[],
  itemsPerPage = 20
): ColecaoProduct[][] {
  const activeProducts = (products || []).filter((p) => p.included !== false);
  return paginate(activeProducts, itemsPerPage);
}
