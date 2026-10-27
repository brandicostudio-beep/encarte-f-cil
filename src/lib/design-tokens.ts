/**
 * DESIGN TOKENS - GERADOR DE ENCARTES DE VAREJO
 * Padrões de cores, tipografia, espaçamento e contrastes para uso no Editor e na Peça A4 Impressa.
 */

export const DESIGN_TOKENS = {
  // Paleta Cromática Institucional de Varejo (Alto Contraste e Energia)
  colors: {
    // Preto rico para fundos de alto contraste e legibilidade
    dark: "#0D0D0D",
    darkSecondary: "#1A1A1A",

    // Vermelho promocional de varejo (energia e urgência)
    primary: "#E30613",
    primaryDark: "#B30009",

    // Vermelho escuro para títulos de produto (evita vibração excessiva nos nomes mantendo legibilidade)
    nameBurgundy: "#8B0000",

    // Amarelo varejo de alto brilho para tags de preço e chamadas
    accent: "#FFD400",
    accentLight: "#FFF066",

    // Branco puro para os cards de produtos (garante que as fotos e preços se destaquem)
    surface: "#FFFFFF",

    // Neutros e bordas acessíveis
    borderLight: "#E5E7EB",
    borderMedium: "#D1D5DB",
    textMuted: "#6B7280",
    textSubtle: "#9CA3AF",

    // Estados e Pendências (com contraste AAA)
    pendingAmber: "#D97706",
    pendingAmberBg: "#FFFBEB",
    pendingAmberBorder: "#FDE68A",

    expiredRed: "#DC2626",
    expiredRedBg: "#FEF2F2",
    expiredRedBorder: "#FECACA",

    successGreen: "#15803D",
    successGreenBg: "#F0FDF4",
    successGreenBorder: "#BBF7D0",
  },

  // Escalas Tipográficas Estritas para Impressão A4 (Pontos / pt)
  // Regra de Varejo: Nada impresso abaixo de 8pt. Preço é o protagonista.
  typography: {
    print: {
      price: {
        fontSize: "30pt", // Protagonista absoluto do card
        lineHeight: "1",
        fontWeight: "900",
        fontFamily: "'Anton', 'Bebas Neue', Impact, sans-serif",
      },
      productName: {
        fontSize: "12pt", // Entre 11pt e 13pt conforme especificado
        lineHeight: "1.15",
        fontWeight: "800",
        fontFamily: "'Barlow', 'Inter', system-ui, sans-serif",
      },
      metadata: {
        fontSize: "8.5pt", // Entre 8pt e 9pt (código, embalagem, validade e estoque)
        lineHeight: "1.2",
        fontWeight: "700",
        fontFamily: "'Barlow', 'Inter', monospace, sans-serif",
      },
      campaignTitle: {
        fontSize: "44pt",
        lineHeight: "0.95",
        fontWeight: "900",
        fontFamily: "'Anton', 'Bebas Neue', Impact, sans-serif",
      },
      campaignSubtitle: {
        fontSize: "16pt",
        lineHeight: "1.1",
        fontWeight: "800",
        fontFamily: "'Barlow', system-ui, sans-serif",
      },
      footerLegal: {
        fontSize: "8pt", // Limite mínimo aceitável de leitura de rodapé
        lineHeight: "1.2",
        fontWeight: "500",
        fontFamily: "system-ui, sans-serif",
      },
    },
  },

  // Grade e Geometria da Peça A4 (210 x 297 mm)
  geometry: {
    widthMm: 210,
    heightMm: 297,
    safeMarginMm: 5, // Margem de segurança nas bordas (5mm)
    bleedMm: 3, // Sangria gráfica para corte (3mm)
    gridModuleMm: 8, // Grade modular de 8mm
    aspectRatio: 1 / 1.4142,

    // Resoluções de Renderização em Pixels
    screenPreviewWidthPx: 794,
    screenPreviewHeightPx: 1123,
    print300DpiWidthPx: 2480,
    print300DpiHeightPx: 3508,
  },

  // Acessibilidade e Contraste
  accessibility: {
    minTouchTargetPx: 44, // Áreas de toque de no mínimo 44px
    minContrastRatio: 4.5, // WCAG AA texto normal
    priceTextStroke: "1px #0D0D0D", // Contorno fino para amarelo sobre vermelho
    priceShadow: "1px 1px 0px #0D0D0D", // Sombra nítida para evitar perda de contraste
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
