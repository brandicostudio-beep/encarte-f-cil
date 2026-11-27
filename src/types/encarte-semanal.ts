/**
 * Tipos e configurações para o Encarte Semanal (Ofertas da Semana)
 * Modo separado do encarte de validade e do encarte de Coleções.
 * Grade padrão: 4 colunas x 5 linhas = 20 produtos por tela (1080x1920).
 */

export interface EncarteSemanalProduct {
  id: string;
  code: string;                  // Código do produto (ex: "19396" ou vazio quando for item Principal)
  description: string;           // Descrição (ex: "AMEIXA EM CALDA LATA PREDILECTA")
  isPrincipal?: boolean;         // Se é item Principal (sem código na arte, descrição genérica sem variação/fragrância)
  image?: string;                 // URL ou DataURL da foto 1 / principal (PNG com transparência)
  secondaryImage?: string;        // Foto 2 opcional / variação de sabor, fragrância ou 2º produto no box
  secondaryCode?: string;         // Segundo código opcional (ex: "17585" em "14352 / 17585")
  additionalProducts?: Array<{ code: string; image?: string }>;
  photoTransforms?: Array<{ x: number; y: number; scale: number }>;
  codeFontSize?: number;
  descriptionFontSize?: number;
  duplicatePhoto?: boolean;       // Se true, repete a mesma foto lado a lado quando não houver foto secundária (padrão true para o visual clássico do encarte)
  alternativePhotos?: Array<{
    filename: string;
    dataUrl: string;
    source?: string;
  }>;
  limit?: string;                // Opcional: Faixa de limite (ex.: "1000CX", "10 UN")
  limitFontSize?: number;        // Tamanho da fonte do limite em px (padrão 9, opções: 9, 11, 13, 15)
  limitWidthPercent?: number;    // Largura da faixa de limite em % do box (padrão 75, opções: 75, 90, 100)
  badge?: string;                // Selo promocional opcional (ex: "LANÇAMENTO", "OFERTA", "DESTAQUE", "LEVE +")
  badgeColor?: "red" | "amber" | "green" | "purple" | "blue"; // Cor de fundo do selo promocional
  flipHorizontal?: boolean;      // Espelha Foto 1 horizontalmente
  flipHorizontal2?: boolean;     // Espelha Foto 2 horizontalmente
  scale?: number;                // Escala da foto (padrão 1.15 ou 115%)
  scale2?: number;               // Escala independente da foto 2 (padrão igual a scale)
  offsetX2?: number;             // Ajuste horizontal em px da foto 2
  offsetY2?: number;             // Ajuste vertical em px da foto 2
  offsetX?: number;              // Ajuste horizontal em px
  offsetY?: number;              // Ajuste vertical em px
  overlapY?: number;              // Sobreposição sobre a barra inferior em px
  included?: boolean;            // Se está ativo no encarte
  pageIndex?: number;            // Índice da página em que está posicionado (1, 2, 3...)
  pageSlotIndex?: number;        // Posição local dentro da página (0..N-1), independente de outras páginas
  slotIndex?: number;            // Posição global legada na grade

  // Histórico para desfazer alterações de código
  originalCode?: string;
  originalDescription?: string;
  originalImage?: string;
}

export interface EncarteSemanalGridConfig {
  canvasWidth: number;           // 1080
  canvasHeight: number;          // 1920
  xStart: number;                // 29
  xEnd: number;                  // 1051
  yStart: number;                // 475
  yEnd: number;                  // 1850
  columns: number[];             // [29, 286, 541, 794, 1051]
  columnsCount: number;          // 4
  rowsCount: number;             // 5
  itemsPerPage: number;          // 20
  perPageItems?: Record<number, number>; // Quantidade personalizada por página (ex: { 1: 18, 2: 10 })
  barHeight: number;             // 54
  barColor: string;              // "#F6E0A6"
  barTextColor: string;          // "#7A0D12"
}

export const DEFAULT_ENCARTE_SEMANAL_GRID: EncarteSemanalGridConfig = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  xStart: 29,
  xEnd: 1051,
  yStart: 475,
  yEnd: 1850,
  columns: [29, 286, 541, 794, 1051],
  columnsCount: 4,
  rowsCount: 5,
  itemsPerPage: 20,
  barHeight: 54,
  barColor: "#F6E0A6",
  barTextColor: "#7A0D12",
};

export interface EncarteSemanalConfig {
  name: string;
  templateImage: string;         // Imagem de fundo 1080x1920 (data URL ou path)
  footerText: string;            // Texto da oferta no rodapé
  gridConfig: EncarteSemanalGridConfig;
  exportScale: number;           // 1 (1080x1920) ou 2 (2160x3840)
}

export const DEFAULT_ENCARTE_SEMANAL_CONFIG: EncarteSemanalConfig = {
  name: "Encarte Semanal - Ofertas da Semana",
  templateImage: "/templates/template-encarte-semanal.jpg",
  footerText: "OFERTA VÁLIDA DO DIA 16/11 AO DIA 21/11 OU ENQUANTO DURAREM OS ESTOQUES PROMOCIONAIS.",
  gridConfig: DEFAULT_ENCARTE_SEMANAL_GRID,
  exportScale: 2,
};

export interface EncarteSemanalCellPosition {
  index: number;
  colIndex: number;
  rowIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  photoAreaHeight: number;
  barY: number;
  barHeight: number;
}

export interface EncarteSemanalImportResult {
  success: boolean;
  products: EncarteSemanalProduct[];
  warnings: string[];
  errors: string[];
  totalRows: number;
  validRows: number;
}
