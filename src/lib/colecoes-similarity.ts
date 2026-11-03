import type { ColecaoProduct } from "@/types/colecoes";

/**
 * Lista abrangente de sabores, recheios, fragrâncias e variações comuns no varejo alimentício e produtos de limpeza.
 * Ordenada por tamanho decrescente para priorizar expressões compostas (ex: "agua de coco e alecrim verde" antes de "alecrim").
 */
const RAW_FLAVORS_AND_VARIANTS = [
  // Fragrâncias Compostas e Limpeza
  "agua de coco e alecrim verde",
  "agua de coco e alecrim",
  "agua de coco",
  "alecrim verde",
  "frescor das flores",
  "azul intenso",
  "capim limao",
  "primavera sache",
  "primavera refil",
  "maciez sache",
  "primavera",
  "maciez",
  "aconchego",
  "delicado",
  "frescor",
  "carinho",
  "ternura",
  "flores e frutas",
  "flores de lavanda",
  "lavanda e camomila",
  "oxigenio ativo",
  "bicarbonato",
  "alecrim",
  "lavanda",
  "floral",
  "marine",
  "eucalipto",
  "camomila",
  "aloe vera",
  "citrus",
  "talco",
  "suave",
  "intenso",
  "clear",
  "neutro",
  "active",
  "power",
  "sache",
  "refil",

  // Cores / Variações de Fragrância e Sub-linhas Comuns
  "flor de",
  "flores de",
  "rosa",
  "verde",
  "azul",
  "branca",
  "amarela",
  "vermelha",
  "dourada",

  // Doces e Frutas
  "chocolate ao leite",
  "chocolate branco",
  "chocolate meio amargo",
  "chocolate amargo",
  "chocolate",
  "baunilha",
  "morango",
  "brigadeiro",
  "doce de leite",
  "leite condensado",
  "caramelo salgado",
  "caramelo",
  "coco",
  "limao",
  "maracuja",
  "abacaxi",
  "banana",
  "maca",
  "uva",
  "cereja",
  "framboesa",
  "amora",
  "avela",
  "nozes",
  "castanha",
  "nata",
  "mel",
  "menta",
  "menthol",
  "churros",
  "red velvet",
  "cookies & cream",
  "cookies",
  "pacoca",
  "amendoim",

  // Salgados e Temperos
  "presunto",
  "queijo nacho",
  "quatro queijos",
  "4 queijos",
  "queijo",
  "cebola e salsa",
  "cebola",
  "salsa",
  "bacon",
  "calabresa",
  "frango com catupiry",
  "frango assado",
  "frango",
  "carne assada",
  "carne de sol",
  "carne",
  "costela",
  "churrasco",
  "picanha",
  "requeijao",
  "cheddar",
  "parmesao",
  "provolone",
  "ervas finas",
  "alho e oleo",
  "alho",
  "azeitona preta",
  "azeitona",
  "tomate seco",
  "tomate",
  "pimenta",
  "original",
  "natural",
  "sal marinho",

  // Bebidas
  "cola",
  "guarana",
  "laranja",
  "manga",
  "caju",
  "pessego",
];

// Ordenação decrescente por quantidade de caracteres para expressões compostas
const FLAVORS_AND_VARIANTS = [...RAW_FLAVORS_AND_VARIANTS].sort(
  (a, b) => b.length - a.length
);

/**
 * Palavras estruturais que podem ser removidas ao derivar o nome genérico base.
 */
const DESCRIPTOR_TERMS = [
  "fragrancia",
  "fragrância",
  "aroma",
  "essencia",
  "essência",
  "sabor",
  "sabores",
  "recheio",
  "recheado",
  "recheada",
  "cobertura",
  "coberto",
  "coberta",
  "tipo",
  "versao",
  "versão",
  "linha",
];

/**
 * Remove acentos e converte para minúsculas normalizadas.
 */
export function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.,/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cria padrão regex tolerante a acentuação e limites de palavras não-ASCII.
 */
function buildAccentInsensitiveRegex(phrase: string): RegExp {
  const pattern = phrase
    .split("")
    .map((c) => {
      if ("aáàãâ".includes(c)) return "[aáàãâ]";
      if ("eéèê".includes(c)) return "[eéèê]";
      if ("iíìî".includes(c)) return "[iíìî]";
      if ("oóòõô".includes(c)) return "[oóòõô]";
      if ("uúùû".includes(c)) return "[uúùû]";
      if ("cç".includes(c)) return "[cç]";
      return c;
    })
    .join("");

  return new RegExp("(^|[\\s,.-]+)" + pattern + "(?=$|[\\s,.-]+)", "gi");
}

/**
 * Extrai o nome-base genérico de um produto removendo a fragrância, sabor, recheio ou aroma.
 * Exemplo:
 * - "Sabonete Água de Coco e Alecrim Verde Ypê" -> "Sabonete Ypê"
 * - "Detergente Capim Limão Ypê" -> "Detergente Ypê"
 * - "Biscoito Recheado Oreo 80g Chocolate" -> "Biscoito Oreo 80g"
 * - "Lava Roupas Pó Maciez Tixan" -> "Lava Roupas Pó Tixan"
 * - "Amaciante Frescor das Flores Ypê" -> "Amaciante Ypê"
 */
export function extractGenericBaseName(rawName: string): string {
  if (!rawName) return "";
  let working = rawName.trim();

  // Preservar gramatura/tamanho se existir (ex: 80g, 153g, 1kg, 200ml, 1x24 unid, etc.)
  const sizeMatch =
    working.match(/\b(\d+X\d+\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i) ||
    working.match(/\b(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i) ||
    working.match(/\b(\d+[\d.,]*\s*(?:G|KG|ML|L))\b/i);

  const sizeToken = sizeMatch ? sizeMatch[1].trim() : "";

  // Procura e remove termos de sabor/fragrância/variação (expressões compostas primeiro)
  for (const flavor of FLAVORS_AND_VARIANTS) {
    const re = buildAccentInsensitiveRegex(flavor);
    working = working.replace(re, " ");
  }

  // Remove termos descritores
  for (const desc of DESCRIPTOR_TERMS) {
    const re = buildAccentInsensitiveRegex(desc);
    working = working.replace(re, " ");
  }

  // Limpeza de conectivos órfãos deixados após a remoção (de, do, da, com, em, e)
  working = working.replace(/\s+(de|do|da|com|em|e)\s+([A-Z0-9À-ÿ]+)$/gi, " $2");
  working = working.replace(/\s+(de|do|da|com|em|e)\s*$/gi, "");
  working = working.replace(/^\s*(de|do|da|com|em|e)\s+/gi, "");

  // Limpeza de hífens soltos, barras e múltiplos espaços
  working = working
    .replace(/[-–—/]\s*[-–—/]/g, " ")
    .replace(/\s*[-–—/]\s*$/g, "")
    .replace(/^\s*[-–—/]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Se perdeu a gramatura durante a limpeza mas ela existia, reinserir no final de forma limpa
  if (sizeToken && !new RegExp(`\\b${sizeToken}\\b`, "i").test(working)) {
    working = `${working} ${sizeToken}`.trim();
  }

  return working;
}

/**
 * Calcula a similaridade entre dois nomes de produtos (excluindo sabores e recheios).
 * Retorna true se pertencem ao mesmo produto-base.
 */
export function areProductsSimilar(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  if (nameA.trim().toLowerCase() === nameB.trim().toLowerCase()) return true;

  const baseA = normalizeText(extractGenericBaseName(nameA));
  const baseB = normalizeText(extractGenericBaseName(nameB));

  if (baseA === baseB && baseA.length > 3) return true;

  // Comparação por tokens
  const tokensA = new Set(baseA.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(baseB.split(" ").filter((t) => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let common = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) common++;
  }

  const minTokens = Math.min(tokensA.size, tokensB.size);
  const maxTokens = Math.max(tokensA.size, tokensB.size);

  // Se compartilham pelo menos 80% dos tokens da base menor e a diferença de tamanho é pequena
  return common >= 2 && common / minTokens >= 0.8 && minTokens / maxTokens >= 0.6;
}

/**
 * Busca produtos similares em uma lista para um produto selecionado.
 * Retorna os candidatos a variação (excluindo o próprio produto principal).
 */
export function findSimilarCandidates(
  targetProduct: ColecaoProduct,
  allProducts: ColecaoProduct[]
): ColecaoProduct[] {
  if (!targetProduct || !allProducts) return [];

  return allProducts.filter((p) => {
    // Ignorar o próprio produto
    if (p.id === targetProduct.id || p.code === targetProduct.code) return false;

    // Verificar se possuem o mesmo nome-base (ignorando sabor/recheio)
    return areProductsSimilar(targetProduct.description, p.description);
  });
}
