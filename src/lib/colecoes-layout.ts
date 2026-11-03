import type { ColecaoProduct, ColecaoGridArea } from "@/types/colecoes";
import { DEFAULT_COLECAO_GRID_AREA } from "@/types/colecoes";
import { extractGenericBaseName, normalizeText } from "./colecoes-similarity";

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

  if (product.isPrincipal) {
    const title = (
      product.genericDescription || extractGenericBaseName(product.description)
    ).trim();

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
    photo2: photoPrincipal, // Duas posições com a mesma foto
    title: product.description.trim(), // Descrição original
    code: product.code, // Código do produto visível (CÓD: xxxxx)
    isPrincipal: false,
    hasVariants: false,
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

  // Agrupamento por nome-base genérico (ex: "Sabonete Ypê", "Detergente Ypê", "Lava Roupas Pó Tixan")
  const groupsByBaseName = new Map<string, ColecaoProduct[]>();

  for (const prod of validProducts) {
    // Se o produto já foi atribuído como variação interna de outro principal, não forma grupo standalone
    if (explicitlyAssignedVariantIds.has(prod.id)) {
      continue;
    }

    const baseName = extractGenericBaseName(prod.description) || prod.description;
    const baseKey = normalizeText(baseName);

    const existing = groupsByBaseName.get(baseKey);
    if (existing) {
      existing.push(prod);
    } else {
      groupsByBaseName.set(baseKey, [prod]);
    }
  }

  const displayProducts: ColecaoProduct[] = [];

  for (const [_baseKey, groupItems] of groupsByBaseName.entries()) {
    if (groupItems.length === 1) {
      // Produto único no grupo
      const item = groupItems[0];
      displayProducts.push(item);
    } else {
      // Múltiplos produtos com o mesmo nome-base (ex.: várias fragrâncias ou códigos repetidos como 24820 e 20594)
      // Agrupa em um único principal! Nunca exibe dois cards com o mesmo nome-base.
      const explicitPrincipal = groupItems.find((p) => p.isPrincipal);
      const mainProd = explicitPrincipal || groupItems[0];
      const otherVariants = groupItems.filter((p) => p.id !== mainProd.id);

      const genericTitle =
        mainProd.genericDescription ||
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
 * Calcula as coordenadas exatas da grade de 4 colunas x 5 linhas dentro da área vermelha.
 */
export function calculateGridCellPositions(
  gridArea: ColecaoGridArea = DEFAULT_COLECAO_GRID_AREA
): GridCellPosition[] {
  const cells: GridCellPosition[] = [];
  const { columns, yStart, yEnd, rows } = gridArea;
  const numCols = columns.length - 1; // 4 colunas
  const rowHeight = (yEnd - yStart) / rows; // 1375 / 5 = 275px

  for (let r = 0; r < rows; r++) {
    const y = yStart + r * rowHeight;
    for (let c = 0; c < numCols; c++) {
      const x = columns[c];
      const nextX = columns[c + 1];
      const width = nextX - x;
      cells.push({
        colIndex: c,
        rowIndex: r,
        x,
        y,
        width,
        height: rowHeight,
      });
    }
  }

  return cells;
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
  if (activeProducts.length === 0) return [[]];

  const pages: ColecaoProduct[][] = [];
  for (let i = 0; i < activeProducts.length; i += itemsPerPage) {
    pages.push(activeProducts.slice(i, i + itemsPerPage));
  }

  return pages;
}
