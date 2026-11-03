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
  isPrincipal: boolean;          // Flag de produto principal
  variantGroupId?: string;       // Identificador do grupo de variações
  variantIds?: string[];         // IDs dos produtos que são variações deste principal
  variants?: ColecaoProduct[];   // Objetos de variações vinculados
  included?: boolean;            // Se o produto está ativo no encarte
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

export interface ColecaoConfig {
  name: string;                  // Nome da coleção (ex: "Esquenta Black Cescom")
  templateImage: string;         // Imagem de fundo 1080x1920
  gridArea: ColecaoGridArea;
  itemsPerPage: number;          // Padrão: 20 (4 colunas x 5 linhas)
}

export const DEFAULT_COLECAO_CONFIG: ColecaoConfig = {
  name: "Esquenta Black Cescom",
  templateImage: "/templates/template-esquenta-black-cescom.png",
  gridArea: DEFAULT_COLECAO_GRID_AREA,
  itemsPerPage: 20,
};
