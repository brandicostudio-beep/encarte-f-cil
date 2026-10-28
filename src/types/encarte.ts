export type BadgeType = "nenhum" | "oferta" | "leve" | "imperdivel";

export type ProductsPerPageOption = 6 | 8 | 9 | 10 | 12;

export type PackagingType = "UNIDADE" | "PACOTE" | "CAIXA" | "FARDO" | "";
export type MeasureUnit = "UNID" | "GR" | "KG" | "ML" | "L" | "LT" | "";

export interface ProductCustomStyle {
  // Cores
  pillBgColor?: string;       // Fundo da pílula de preço (ex: #E30613)
  pillTextColor?: string;     // Cor do texto/valor na pílula (ex: #FFE600)
  validityBgColor?: string;   // Fundo da barra de validade (ex: #000000)
  validityTextColor?: string; // Cor do texto de validade (ex: #FFFFFF)
  stockBgColor?: string;      // Fundo da barra de estoque (ex: #000000)
  stockTextColor?: string;    // Cor do texto de estoque (ex: #FFFFFF)
  boxBorderColor?: string;    // Borda do box do produto (ex: #D9D9D9)
  boxBgColor?: string;        // Fundo do box (ex: #FFFFFF)
  nameColor?: string;         // Cor do nome do produto (ex: #000000)
  headerColor?: string;       // Cor do cabeçalho código/embalagem (ex: #000000)

  // Tipografia & Alinhamento
  nameFontSize?: number;      // Tamanho da fonte do nome em px (min: 24, max: 54)
  nameFontWeight?: "normal" | "semibold" | "bold"; // normal=400, semibold=600, bold=700
  nameAlign?: "left" | "center" | "right";

  headerFontSize?: number;    // Tamanho da fonte do código/embalagem em px (min: 20, max: 40)
  headerFontWeight?: "normal" | "semibold" | "bold";
  headerAlign?: "left" | "center" | "right";

  priceFontSize?: number;     // Tamanho da fonte do valor em px (min: 30, max: 64)
  priceFontWeight?: "normal" | "semibold" | "bold";

  // Visibilidade dos Elementos
  showCode?: boolean;         // Padrão: true
  showName?: boolean;         // Padrão: true
  showValidity?: boolean;     // Padrão: true
  showStock?: boolean;        // Padrão: true
  showBadge?: boolean;        // Padrão: true

  // Foto do Produto
  imageScale?: number;        // Escala / zoom da foto (0.5 a 1.3)
  imageOffsetX?: number;      // Ajuste de posição X (-25 a 25 px)
  imageOffsetY?: number;      // Ajuste de posição Y (-25 a 25 px)

  // Deslocamento do Box
  boxOffsetX?: number;        // Deslocamento fino dentro do box (-20 a 20 px)
  boxOffsetY?: number;

  // Marcação se foi personalizado
  isCustomized?: boolean;
}

export interface CampaignGlobalStyle {
  pillBgColor?: string;
  pillTextColor?: string;
  validityBgColor?: string;
  validityTextColor?: string;
  stockBgColor?: string;
  stockTextColor?: string;
  boxBorderColor?: string;
  boxBgColor?: string;
  nameColor?: string;
  headerColor?: string;
  nameFontSize?: number;
  nameFontWeight?: "normal" | "semibold" | "bold";
  nameAlign?: "left" | "center" | "right";
  headerFontSize?: number;
  headerFontWeight?: "normal" | "semibold" | "bold";
  headerAlign?: "left" | "center" | "right";
  priceFontSize?: number;
  priceFontWeight?: "normal" | "semibold" | "bold";
  showCode?: boolean;
  showName?: boolean;
  showValidity?: boolean;
  showStock?: boolean;
  showBadge?: boolean;
  showFooter?: boolean;
}

export interface EncarteProduct {
  id: string;
  code: string;            // Código do produto (ex: "24657")
  name: string;            // Nome do produto em caixa alta (ex: "CAFÉ TRADICIONAL A VÁCUO")
  packaging: string;       // Embalagem formatada (ex: "PACOTE 1X24 UNID", "UNIDADE 1X320 GR")
  packagingType?: PackagingType;
  packagingQuantity?: string; // ex: "1X24", "18X320"
  packagingUnit?: MeasureUnit; // ex: "UNID", "GR"
  packagingWeight?: string;   // ex: "320 GR", "1,01 KG"
  validity: string;        // Validade (ex: "15/11/2026")
  price: string;           // Preço no formato "4,99" (vazio inicialmente se não preenchido)
  unit: string;            // "UND" ou "KG"
  stock?: string;          // Estoque opcional (ex: "50 UND")
  badge: BadgeType;        // Selo opcional
  image: string;           // Data URL ou URL remota
  imageScale?: number;     // Escala / zoom óptico da foto (padrão: 1.0)
  included: boolean;       // Marcado para entrar no encarte
  productUrl?: string;     // URL da página do produto (se disponível)
  photoSource?: "drive" | "zip" | "upload" | "link" | "sample" | "folder"; // Origem da foto
  photoOriginName?: string; // Nome do arquivo de foto
  customStyle?: ProductCustomStyle; // Estilos visuais personalizados na edição final
  alternativePhotos?: {
    id: string;
    filename: string;
    dataUrl?: string;
    fileId?: string;
    isPrimary?: boolean;
    source?: "drive" | "zip" | "upload" | "folder";
  }[];
}

export interface StoreConfig {
  name: string;            // Nome da loja
  logo: string;            // Logo em Data URL ou URL
  address: string;         // Endereço
  phone: string;           // Telefone / WhatsApp
  legalNotice: string;     // Nota legal configurável
  primaryColor: string;    // Vermelho padrão: #dc2626
  accentColor: string;     // Amarelo padrão: #facc15
  darkColor: string;       // Preto padrão: #0a0a0a
}

export type EncarteFormat = "story_9_16" | "a4";

export interface TemplateProductArea {
  x: number;          // Posição X da área branca em pixels no canvas base (padrão 46)
  y: number;          // Posição Y da área branca em pixels no canvas base (padrão 661)
  width: number;      // Largura da área branca em pixels (padrão 1012)
  height: number;     // Altura da área branca em pixels (padrão 1202)
  canvasWidth: number;  // Largura base do template (padrão 1080)
  canvasHeight: number; // Altura base do template (padrão 1920)
}

export const DEFAULT_TEMPLATE_9_16_AREA: TemplateProductArea = {
  x: 46,
  y: 661,
  width: 1012,
  height: 1202,
  canvasWidth: 1080,
  canvasHeight: 1920,
};

export interface CampaignConfig {
  title: string;           // Padrão: "DETONA PREÇOS"
  subtitle: string;        // Padrão: "Produtos com validade curta!"
  observation: string;     // Padrão: "Não aceitamos devolução. Prazo 07 dias"
  productsPerPage: ProductsPerPageOption; // Padrão: 12 (opções: 6, 8, 9, 12)
  customHeaderImage?: string; // Data URL ou URL da imagem de cabeçalho enviada pelo usuário (2480x875 / 2551x910)
  headerTextOverlay?: boolean; // Se verdadeiro, renderiza título e subtítulo por cima da arte
  
  // Modo de Encarte e Template 9:16 (1080 × 1920 px)
  format: EncarteFormat;
  template916Image: string; // PNG/JPG do template completo
  template916Area: TemplateProductArea;
  exportResolution916?: "1080x1920" | "2160x3840";
  blockExportWithoutPhoto?: boolean; // Padrão: false (se marcado, bloqueia exportação se houver produto sem foto)
  globalStyle?: CampaignGlobalStyle; // Estilos visuais globais da campanha aplicados na edição final
  pageStyles?: Record<number, CampaignGlobalStyle>; // Estilos visuais por página aplicados na edição final
}

export const DEFAULT_STORE: StoreConfig = {
  name: "",
  logo: "",
  address: "",
  phone: "",
  legalNotice: "",
  primaryColor: "#dc2626",
  accentColor: "#facc15",
  darkColor: "#0a0a0a",
};

export const DEFAULT_CAMPAIGN: CampaignConfig = {
  title: "DETONA PREÇOS",
  subtitle: "PRODUTOS COM VALIDADE CURTA!",
  observation: "Não aceitamos devolução. Prazo 07 dias.",
  productsPerPage: 10,
  customHeaderImage: "",
  headerTextOverlay: false,
  format: "story_9_16",
  template916Image: "/templates/template-detona-precos-9-16.png",
  template916Area: DEFAULT_TEMPLATE_9_16_AREA,
  exportResolution916: "1080x1920",
  blockExportWithoutPhoto: false,
};

export const BADGE_LABELS: Record<BadgeType, string> = {
  nenhum: "Sem selo",
  oferta: "OFERTA",
  leve: "LEVE JÁ",
  imperdivel: "IMPERDÍVEL",
};
