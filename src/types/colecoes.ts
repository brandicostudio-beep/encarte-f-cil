/**
 * Tipos e configurações para o Encarte de Coleções
 * Predefinição separada do encarte de validade (isolamento completo de dados e renderização).
 */

export interface ColecaoProduct {
  id: string;
  code: string;                  // Código do produto (ex: "24657")
  description: string;           // Descrição original da planilha ou link
  genericDescription?: string;   // Descrição genérica para produtos principais (ex: "Biscoito Oreo 80g")
  image: string;                 // Foto principal (URL ou Data URL)
  secondaryImage?: string;       // Foto secundária personalizada (slot 2)
  isPrincipal: boolean;          // Flag de produto principal
  variantGroupId?: string;       // Identificador do grupo de variações
  variantIds?: string[];         // IDs dos produtos que são variações deste principal
  variants?: ColecaoProduct[];   // Objetos de variações vinculados
  included?: boolean;            // Se o produto está ativo no encarte
  limit?: string;                // Faixa laranja opcional de limite (ex.: "1500CX", "10 UN")
}

export interface ColecaoGridArea {
  xStart: number;                // 29
  xEnd: number;                  // 1051
  yStart: number;                // 475
  yEnd: number;                  // 1850
  columns: number[];             // [29, 286, 541, 794, 1051]
  rows: number;                  // 5
  canvasWidth: number;           // 1080
  canvasHeight: number;          // 1920
}

export const DEFAULT_COLECAO_GRID_AREA: ColecaoGridArea = {
  xStart: 29,
  xEnd: 1051,
  yStart: 475,
  yEnd: 1850,
  columns: [29, 286, 541, 794, 1051],
  rows: 5,
  canvasWidth: 1080,
  canvasHeight: 1920,
};

export interface ColecaoGridSettings {
  columns: number;          // 1–6
  rows: number;             // 1–10
  perPage: number;          // padrão = columns × rows
  gapX: number;
  gapY: number;
  productScale: number;     // 1.0–1.6
  frontSide: "left" | "right";
  showDividers: boolean;
  footerText: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
  row: number;
}

export interface ColecaoElement {
  id: string;
  productId: string;
  x: number; y: number;          // px no canvas 1080×1920
  w: number; h: number;
  rotation: number;              // graus
  z: number;
  manual?: boolean;              // se true, mudar a grade não reposiciona
  locked?: boolean;
  hidden?: boolean;
}

export interface ColecaoConfig {
  name: string;                  // Nome da coleção (ex: "Esquenta Black Cescom")
  templateImage: string;         // Imagem de fundo 1080x1920
  gridArea: ColecaoGridArea;
  itemsPerPage: number;          // Padrão: 20 (4 colunas x 5 linhas ou customizado)
  columnsCount?: number;         // Colunas (1 a 6, padrão: 4)
  rowsCount?: number;            // Linhas (1 a 10, padrão: 5)
  autoItemsPerPage?: boolean;    // Se true, itemsPerPage = columnsCount * rowsCount
  productScale?: number;         // Escala do produto (1.0 a 1.6 ou em % 80 a 160)
  overlapAmount?: number;        // Sobreposição entre fotos em % (0 a 40, padrão: 15)
  stackOrder?: "left-in-front" | "right-in-front"; // Ordem de empilhamento z-index
  frontSide?: "left" | "right";  // Lado na frente ("left" | "right")
  showDottedLines?: boolean;     // Linhas pontilhadas vermelhas entre células (padrão: true)
  showDividers?: boolean;        // Divisores entre células
  cellSpacing?: number;          // Espaçamento entre células em px (0 a 20, padrão: 0)
  gapX?: number;                 // Espaço horizontal entre colunas
  gapY?: number;                 // Espaço vertical entre linhas
  footerText?: string;           // Texto do rodapé de oferta
  exportScale?: number;          // 1 (1080x1920) ou 2 (2160x3840)
}

export const DEFAULT_COLECAO_CONFIG: ColecaoConfig = {
  name: "Esquenta Black Cescom",
  templateImage: "/templates/template-esquenta-black-cescom.png",
  gridArea: DEFAULT_COLECAO_GRID_AREA,
  itemsPerPage: 20,
  columnsCount: 4,
  rowsCount: 5,
  autoItemsPerPage: true,
  productScale: 130,
  overlapAmount: 15,
  stackOrder: "right-in-front",
  frontSide: "right",
  showDottedLines: true,
  showDividers: true,
  cellSpacing: 0,
  gapX: 0,
  gapY: 0,
  footerText: "OFERTA VÁLIDA DO DIA 02/11 AO DIA 07/11\nOU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS.",
  exportScale: 1,
};
