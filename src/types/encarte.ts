export type BadgeType = "nenhum" | "oferta" | "leve" | "imperdivel";

export type ProductsPerPageOption = 6 | 8 | 9 | 12;

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
  included: boolean;       // Marcado para entrar no encarte
  productUrl?: string;     // URL da página do produto (se disponível)
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

export interface CampaignConfig {
  title: string;           // Padrão: "DETONA PREÇOS"
  subtitle: string;        // Padrão: "Produtos com validade curta!"
  observation: string;     // Padrão: "Não aceitamos devolução. Prazo 07 dias"
  productsPerPage: ProductsPerPageOption; // Padrão: 12 (opções: 6, 8, 9, 12)
  customHeaderImage?: string; // Data URL ou URL da imagem de cabeçalho enviada pelo usuário (2480x875 / 2551x910)
  headerTextOverlay?: boolean; // Se verdadeiro, renderiza título e subtítulo por cima da arte
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
  productsPerPage: 12,
  customHeaderImage: "",
  headerTextOverlay: false,
};

export const BADGE_LABELS: Record<BadgeType, string> = {
  nenhum: "Sem selo",
  oferta: "OFERTA",
  leve: "LEVE JÁ",
  imperdivel: "IMPERDÍVEL",
};
