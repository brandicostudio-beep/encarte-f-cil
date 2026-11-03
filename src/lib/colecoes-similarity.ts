import type { ColecaoProduct } from "@/types/colecoes";

/**
 * Lista abrangente de sabores, recheios e variações comuns no varejo alimentício e mercearia.
 */
const FLAVORS_AND_VARIANTS = [
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
  "limão",
  "maracuja",
  "maracujá",
  "abacaxi",
  "banana",
  "maca",
  "maçã",
  "uva",
  "cereja",
  "framboesa",
  "amora",
  "avela",
  "avelã",
  "nozes",
  "castanha",
  "nata",
  "mel",
  "menta",
  "menthol",
  "churros",
  "red velvet",
  "cookies",
  "cookies & cream",
  "pacoca",
  "paçoca",
  "amendoim",

  // Salgados e Temperos
  "presunto",
  "queijo nacho",
  "queijo",
  "quatro queijos",
  "4 queijos",
  "cebola e salsa",
  "cebola",
  "salsa",
  "bacon",
  "calabresa",
  "frango assado",
  "frango com catupiry",
  "frango",
  "carne assada",
  "carne de sol",
  "carne",
  "costela",
  "churrasco",
  "picanha",
  "requeijao",
  "requeijão",
  "cheddar",
  "parmesao",
  "parmesão",
  "provolone",
  "ervas finas",
  "alho e oleo",
  "alho e óleo",
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
  "guaraná",
  "laranja",
  "manga",
  "caju",
  "pessego",
  "pêssego",

  // Limpeza e Higiene
  "lavanda",
  "floral",
  "marine",
  "eucalipto",
  "alecrim",
  "camomila",
  "aloe vera",
  "citrus",
  "talco",
  "suave",
  "intenso",
];

/**
 * Palavras estruturais que podem ser removidas ao derivar o nome genérico base.
 */
const DESCRIPTOR_TERMS = [
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
 * Extrai o nome-base genérico de um produto removendo o sabor, recheio ou aroma.
 * Exemplo:
 * - "Biscoito Oreo 80g Chocolate" -> "Biscoito Oreo 80g"
 * - "Biscoito Oreo 80g Baunilha" -> "Biscoito Oreo 80g"
 * - "Gelatina Royal Uva 25g" -> "Gelatina Royal 25g"
 * - "Salgadinho Yokitos Conchinha Presunto 153g" -> "Salgadinho Yokitos Conchinha 153g"
 */
export function extractGenericBaseName(rawName: string): string {
  if (!rawName) return "";
  let working = rawName.trim();

  // Preservar gramatura/tamanho se existir (ex: 80g, 153g, 1kg, 200ml, 1x24 unid)
  const sizeMatch =
    working.match(/\b(\d+X\d+\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i) ||
    working.match(/\b(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/i) ||
    working.match(/\b(\d+[\d.,]*\s*(?:G|KG|ML|L))\b/i);

  const sizeToken = sizeMatch ? sizeMatch[1].trim() : "";

  // Procura e remove termos de sabor/recheio
  for (const flavor of FLAVORS_AND_VARIANTS) {
    const re = new RegExp(`\\b${flavor}\\b`, "gi");
    working = working.replace(re, " ");
  }

  // Remove termos descritores
  for (const desc of DESCRIPTOR_TERMS) {
    const re = new RegExp(`\\b${desc}\\b`, "gi");
    working = working.replace(re, " ");
  }

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
