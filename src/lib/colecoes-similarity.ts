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
  "preta",
  "preto",
  "roxa",
  "roxo",

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
 * Estrutura de gramatura ou volume normalizados.
 * Unidade base: 'g' para peso e 'ml' para volume.
 */
export interface NormalizedWeight {
  value: number; // valor numérico normalizado em gramas (g) ou mililitros (ml)
  unit: "g" | "ml";
  display: string; // formato amigável para exibição (ex: "1,3 kg", "500 ml", "80 g")
}

/**
 * Tipos de embalagem reconhecidos no varejo brasileiro.
 */
export type PackagingType =
  | "sache"
  | "caixa"
  | "pacote"
  | "refil"
  | "garrafa"
  | "pote"
  | "lata"
  | "padrao";

/**
 * Marcas frequentes no varejo nacional para indexação segura.
 */
const KNOWN_BRANDS = [
  "YPE", "YPÊ", "TIXAN", "OREO", "POMAROLA", "PREDILECTA", "DORI", "NINHO", "NESTLE", "NESTLÉ",
  "QUALY", "SADIA", "PERDIGAO", "PERDIGÃO", "SEARA", "PILAO", "PILÃO", "MELITTA", "MARATA", "MARATÁ",
  "COCA-COLA", "PEPSI", "AMBEV", "HEINEKEN", "COLGATE", "SORRISO", "ORAL-B", "DOVE", "REXONA", "NIVEA",
  "PANTENE", "SEDA", "PALMOLIVE", "LUX", "MINUANO", "BRILHANTE", "OMO", "ARIEL", "CONFORT", "COMFORT",
  "DOWNY", "VANISH", "VEJA", "AJAX", "PINHO SOL", "YOKITOS", "PASSATEMPO", "TRAKINAS", "BAUDUCCO",
  "DONA BENTA", "CAMIL", "TIO JOAO", "TIO JOÃO", "TODDY", "NESCAU", "SOYA", "LIZA", "VIGOR", "ITAMBE",
  "ITAMBÉ", "PIRACANJUBA"
];

/**
 * Normaliza gramatura ou volume para unidade padrão (g ou ml).
 * Exemplos:
 * - "1,3 kg" / "1.3kg" -> { value: 1300, unit: "g", display: "1,3 kg" }
 * - "2,2 kg" -> { value: 2200, unit: "g", display: "2,2 kg" }
 * - "1 l" / "2L" -> { value: 2000, unit: "ml", display: "2 L" }
 * - "500 ml" -> { value: 500, unit: "ml", display: "500 ml" }
 * - "80g" -> { value: 80, unit: "g", display: "80 g" }
 * - "24X300 GR" -> { value: 300, unit: "g", display: "24X300 GR" }
 * Retorna null se não houver gramatura/volume informado no texto.
 */
export function parseNormalizedWeight(text: string): NormalizedWeight | null {
  if (!text) return null;

  // 1. Formato multiplicador: ex "24X300 GR", "12 x 1L", "6X500ML"
  const multMatch = text.match(
    /\b(\d+)\s*[xX]\s*([\d.,]+)\s*(kg|kilo|quilo|quilos|g|gr|gramas|l|lt|litro|litros|ml)\b/i
  );
  if (multMatch) {
    const val = parseFloat(multMatch[2].replace(",", "."));
    const rawUnit = multMatch[3].toLowerCase();

    if (rawUnit.startsWith("k")) {
      return { value: Math.round(val * 1000), unit: "g", display: multMatch[0].trim() };
    }
    if (rawUnit.startsWith("g")) {
      return { value: Math.round(val), unit: "g", display: multMatch[0].trim() };
    }
    if (rawUnit.startsWith("l")) {
      return { value: Math.round(val * 1000), unit: "ml", display: multMatch[0].trim() };
    }
    if (rawUnit === "ml") {
      return { value: Math.round(val), unit: "ml", display: multMatch[0].trim() };
    }
  }

  // 2. Valores isolados no formato numérico + unidade
  const singleMatch = text.match(
    /\b([\d.,]+)\s*(kg|kilo|quilo|quilos|g|gr|gramas|l|lt|litro|litros|ml)\b/i
  );
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(",", "."));
    const rawUnit = singleMatch[2].toLowerCase();

    if (rawUnit.startsWith("k")) {
      return {
        value: Math.round(val * 1000),
        unit: "g",
        display: `${singleMatch[1]} kg`.replace(".", ","),
      };
    }
    if (rawUnit.startsWith("g")) {
      return {
        value: Math.round(val),
        unit: "g",
        display: `${singleMatch[1]} g`.replace(".", ","),
      };
    }
    if (rawUnit.startsWith("l")) {
      return {
        value: Math.round(val * 1000),
        unit: "ml",
        display: `${singleMatch[1]} L`.replace(".", ","),
      };
    }
    if (rawUnit === "ml") {
      return {
        value: Math.round(val),
        unit: "ml",
        display: `${singleMatch[1]} ml`.replace(".", ","),
      };
    }
  }

  return null;
}

/**
 * Identifica o tipo de embalagem a partir do texto do produto.
 * Ex: sachê, caixa, pacote, refil, garrafa, pote, lata ou padrão.
 */
export function parsePackagingType(text: string): PackagingType {
  if (!text) return "padrao";
  const norm = normalizeText(text);

  if (/\b(sache|saches)\b/.test(norm)) return "sache";
  if (/\b(caixa|caixas|cx)\b/.test(norm)) return "caixa";
  if (/\b(refil|refils|refis)\b/.test(norm)) return "refil";
  if (/\b(pacote|pacotes|pct|pcte)\b/.test(norm)) return "pacote";
  if (/\b(garrafa|garrafas|pet)\b/.test(norm)) return "garrafa";
  if (/\b(pote|potes)\b/.test(norm)) return "pote";
  if (/\b(lata|latas)\b/.test(norm)) return "lata";

  return "padrao";
}

/**
 * Extrai a marca do produto normalizada a partir da lista de marcas conhecidas
 * ou da estrutura lexical da descrição.
 */
export function extractBrand(text: string): string {
  if (!text) return "";
  const norm = text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const b of KNOWN_BRANDS) {
    const bNorm = b.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const re = new RegExp("(^|[\\s,.-]+)" + bNorm + "(?=$|[\\s,.-]+)", "i");
    if (re.test(norm)) {
      return bNorm;
    }
  }

  // Fallback: última palavra maiúscula relevante
  const words = norm.split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    if (
      !["SACHE", "CAIXA", "REFIL", "PACOTE", "POTE", "LATA", "PET", "GR", "KG", "ML", "UNID"].includes(
        lastWord
      )
    ) {
      return lastWord;
    }
  }

  return "";
}

/**
 * Deriva a descrição genérica do grupo recomendada para o card (sem fragrância, sem gramatura e sem código).
 * Ex:
 * - "AMACIANTE AZUL INTENSO YPÊ 2L" -> "AMACIANTE YPÊ"
 * - "LAVA ROUPAS PÓ PRIMAVERA TIXAN 1,3 kg SACHÊ" -> "LAVA ROUPAS PÓ TIXAN"
 * - "SABONETE FLOR DE YPÊ ROSA" -> "SABONETE YPÊ"
 * - "DETERGENTE CAPIM LIMÃO YPÊ 500ML" -> "DETERGENTE YPÊ"
 * - "BISCOITO RECHEADO OREO 80G CHOCOLATE" -> "BISCOITO OREO"
 */
export function extractGenericGroupTitle(text: string): string {
  if (!text) return "";
  let working = extractGenericBaseName(text);

  // Remove termos de embalagem
  const pkgWords = [
    "sache", "saches", "sachê", "sachês", "caixa", "caixas", "cx",
    "refil", "refils", "refis", "pacote", "pacotes", "pct", "pcte",
    "garrafa", "garrafas", "pet", "pote", "potes", "lata", "latas",
  ];
  for (const pw of pkgWords) {
    working = working.replace(buildAccentInsensitiveRegex(pw), " ");
  }

  // Remove gramaturas ou tamanhos remanescentes
  working = working.replace(/\b(\d+X\d+\s*(?:GR|G|KG|ML|L|UNID|UN))\b/gi, " ");
  working = working.replace(/\b(\d+[\d.,]*\s*(?:GR|G|KG|ML|L|UNID|UN))\b/gi, " ");
  working = working.replace(/\b(\d+[\d.,]*\s*(?:G|KG|ML|L))\b/gi, " ");

  // Limpeza de preposições ou conectivos soltos
  working = working.replace(/\s+(de|do|da|com|em|e)\s+([A-Z0-9À-ÿ]+)$/gi, " $2");
  working = working.replace(/\s+(de|do|da|com|em|e)\s*$/gi, "");
  working = working.replace(/^\s*(de|do|da|com|em|e)\s+/gi, "");
  working = working.replace(/\s+/g, " ").trim();

  return working.toUpperCase();
}

/**
 * Avalia se dois produtos são candidatos compatíveis segundo as 4 regras de negócio de variação:
 * 1. Mesmo nome-base (categoria e linha) após remover sabor/fragrância/cor.
 * 2. Mesma marca.
 * 3. Mesma gramatura ou volume normalizados.
 * 4. Mesmo tipo de embalagem (sachê não agrupa com caixa).
 */
export interface SimilarityEvaluation {
  isRelated: boolean;
  isCompatible: boolean;
  reasons: string[];
}

export function evaluateSimilarity(
  target: ColecaoProduct,
  candidate: ColecaoProduct
): SimilarityEvaluation {
  const reasons: string[] = [];

  const targetTitle = extractGenericGroupTitle(target.description);
  const candTitle = extractGenericGroupTitle(candidate.description);

  // 1. Relação de base/categoria
  const isBaseRelated =
    areProductsSimilar(targetTitle, candTitle) ||
    areProductsSimilar(target.description, candidate.description);

  if (!isBaseRelated) {
    return {
      isRelated: false,
      isCompatible: false,
      reasons: ["Produto de categoria ou linha diferente"],
    };
  }

  // 2. Marca
  const targetBrand = extractBrand(target.description);
  const candBrand = extractBrand(candidate.description);
  if (targetBrand && candBrand && targetBrand !== candBrand) {
    reasons.push(`Marca diferente (${candBrand} vs ${targetBrand})`);
  }

  // 3. Gramatura ou Volume
  const targetWeight = parseNormalizedWeight(target.description);
  const candWeight = parseNormalizedWeight(candidate.description);

  if (!targetWeight || !candWeight) {
    reasons.push("Gramatura pendente (não informada no nome)");
  } else if (
    targetWeight.unit !== candWeight.unit ||
    Math.abs(targetWeight.value - candWeight.value) > 0.01
  ) {
    reasons.push(`Gramatura diferente (${candWeight.display} vs ${targetWeight.display})`);
  }

  // 4. Tipo de Embalagem
  const targetPkg = parsePackagingType(target.description);
  const candPkg = parsePackagingType(candidate.description);
  if (targetPkg !== "padrao" && candPkg !== "padrao" && targetPkg !== candPkg) {
    reasons.push(`Embalagem diferente (${candPkg} vs ${targetPkg})`);
  }

  return {
    isRelated: true,
    isCompatible: reasons.length === 0,
    reasons,
  };
}

export interface IncompatibleVariant {
  product: ColecaoProduct;
  reasons: string[];
}

export interface CandidateGroupsResult {
  compatible: ColecaoProduct[];
  incompatible: IncompatibleVariant[];
}

/**
 * Encontra variações candidatas dividindo em grupos:
 * - compatible: passam em todos os critérios (marca, gramatura e embalagem iguais).
 * - incompatible: da mesma linha/categoria, mas com restrições (ex: gramatura diferente, embalagem diferente).
 */
export function findSimilarCandidateGroups(
  targetProduct: ColecaoProduct,
  allProducts: ColecaoProduct[]
): CandidateGroupsResult {
  if (!targetProduct || !allProducts) {
    return { compatible: [], incompatible: [] };
  }

  const compatible: ColecaoProduct[] = [];
  const incompatible: IncompatibleVariant[] = [];

  for (const p of allProducts) {
    if (p.id === targetProduct.id || p.code === targetProduct.code) continue;

    const evaluation = evaluateSimilarity(targetProduct, p);
    if (!evaluation.isRelated) continue;

    if (evaluation.isCompatible) {
      compatible.push(p);
    } else {
      incompatible.push({ product: p, reasons: evaluation.reasons });
    }
  }

  return { compatible, incompatible };
}

/**
 * Busca produtos similares em uma lista para um produto selecionado.
 * Retorna apenas candidatos 100% compatíveis por padrão.
 */
export function findSimilarCandidates(
  targetProduct: ColecaoProduct,
  allProducts: ColecaoProduct[]
): ColecaoProduct[] {
  return findSimilarCandidateGroups(targetProduct, allProducts).compatible;
}
