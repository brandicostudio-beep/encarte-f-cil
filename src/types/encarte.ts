export type BadgeType = "nenhum" | "oferta" | "leve" | "imperdivel";

export type ProductsPerPageOption = 6 | 8 | 9 | 10 | 12;

export type PackagingType = "UNIDADE" | "PACOTE" | "CAIXA" | "FARDO" | "";
export type MeasureUnit = "UNID" | "GR" | "KG" | "ML" | "L" | "LT" | "";

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
}

export const DEFAULT_STORE: StoreConfig = {
  name: "SUPERMERCADO BOM PREÇO",
  logo: "",
  address: "Av. Principal, 1200 - Centro",
  phone: "(11) 99999-8888",
  legalNotice: "Ofertas válidas enquanto durarem os estoques. Imagens meramente ilustrativas. Proibida venda de bebidas para menores de 18 anos.",
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
