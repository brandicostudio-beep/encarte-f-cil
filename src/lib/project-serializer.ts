import type {
  ProjectData,
  ProjectUpdateAnalysis,
  ProductChangeDiff,
} from "@/types/project";
import type { EncarteProduct } from "@/types/encarte";
import { DEFAULT_CAMPAIGN, DEFAULT_STORE } from "@/types/encarte";

/**
 * Caracteres proibidos em nomes de arquivos/pastas no Google Drive e sistemas de arquivos.
 */
export const INVALID_DRIVE_NAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * Valida e sanitiza o nome do projeto.
 */
export function validateProjectName(rawName?: string | null): {
  valid: boolean;
  cleanName: string;
  error?: string;
} {
  const trimmed = (rawName || "").trim();
  if (!trimmed) {
    return {
      valid: false,
      cleanName: "",
      error: "O nome do projeto não pode ficar em branco.",
    };
  }

  if (trimmed.length > 120) {
    return {
      valid: false,
      cleanName: trimmed.slice(0, 120),
      error: "O nome do projeto deve ter no máximo 120 caracteres.",
    };
  }

  if (INVALID_DRIVE_NAME_CHARS.test(trimmed)) {
    const sanitized = trimmed.replace(INVALID_DRIVE_NAME_CHARS, "-").trim();
    return {
      valid: false,
      cleanName: sanitized,
      error: `O nome contém caracteres inválidos (${'\\ / : * ? " < > |'}). Sugestão: "${sanitized}"`,
    };
  }

  return {
    valid: true,
    cleanName: trimmed,
  };
}

/**
 * Remove imagens pesadas em base64 (Data URLs) dos produtos antes de salvar no JSON do projeto.
 * Preserva o photoSource, photoOriginName e referências de arquivo leves.
 */
export function stripHeavyImagesForStorage(products: EncarteProduct[]): EncarteProduct[] {
  return products.map((p) => {
    const clone: EncarteProduct = { ...p };

    // Se for data:image (base64 pesado), não salva dentro do JSON
    if (typeof clone.image === "string" && clone.image.startsWith("data:")) {
      clone.image = "";
    }

    // Se tiver fotos alternativas em base64, limpa os dataUrl pesados
    if (clone.alternativePhotos && clone.alternativePhotos.length > 0) {
      clone.alternativePhotos = clone.alternativePhotos.map((alt) => ({
        ...alt,
        dataUrl: undefined,
      }));
    }

    return clone;
  });
}

/**
 * Serializa os dados do projeto para uma string JSON compacta e segura.
 */
export function serializeProject(project: ProjectData): string {
  const sanitizedProject: ProjectData = {
    ...project,
    name: project.name.trim() || "Encarte Sem Nome",
    updatedAt: new Date().toISOString(),
    products: stripHeavyImagesForStorage(project.products),
  };

  return JSON.stringify(sanitizedProject, null, 2);
}

/**
 * Desserializa e valida a estrutura de um JSON de projeto.
 */
export function deserializeProject(jsonContent: string): {
  ok: boolean;
  project?: ProjectData;
  data?: ProjectData;
  error?: string;
} {
  if (!jsonContent || typeof jsonContent !== "string") {
    return { ok: false, error: "Não foi possível abrir o arquivo do projeto: Arquivo de projeto inválido ou corrompido (conteúdo vazio)." };
  }

  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Não foi possível abrir o arquivo do projeto: Arquivo de projeto inválido ou corrompido (estrutura inválida)." };
    }

    // Validações fundamentais
    if (!parsed.id && !parsed.name) {
      return { ok: false, error: "Não foi possível abrir o arquivo do projeto: Arquivo de projeto inválido ou corrompido (sem identificadores)." };
    }

    const project: ProjectData = {
      id: String(parsed.id || `proj-${Date.now()}`),
      name: String(parsed.name || "Encarte Restaurado"),
      createdAt: String(parsed.createdAt || new Date().toISOString()),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      version: Number(parsed.version) || 1,
      isTrashed: Boolean(parsed.isTrashed),
      trashedAt: parsed.trashedAt ? String(parsed.trashedAt) : undefined,
      source: {
        type: ["spreadsheet", "url", "manual"].includes(parsed.source?.type)
          ? parsed.source.type
          : "manual",
        filename: parsed.source?.filename ? String(parsed.source.filename) : undefined,
        fileSize: typeof parsed.source?.fileSize === "number" ? parsed.source.fileSize : undefined,
        importedAt: parsed.source?.importedAt ? String(parsed.source.importedAt) : undefined,
        columnsSummary: parsed.source?.columnsSummary ? String(parsed.source.columnsSummary) : undefined,
        url: parsed.source?.url ? String(parsed.source.url) : undefined,
        lastScrapedAt: parsed.source?.lastScrapedAt ? String(parsed.source.lastScrapedAt) : undefined,
      },
      products: Array.isArray(parsed.products)
        ? parsed.products.map((p: any, idx: number) => ({
            id: String(p?.id || `p-${Date.now()}-${idx}`),
            code: String(p?.code ?? idx + 1),
            name: String(p?.name ?? "PRODUTO"),
            packaging: String(p?.packaging ?? ""),
            packagingType: p?.packagingType,
            packagingQuantity: p?.packagingQuantity,
            packagingUnit: p?.packagingUnit,
            packagingWeight: p?.packagingWeight,
            validity: String(p?.validity ?? ""),
            price: String(p?.price ?? ""),
            unit: String(p?.unit ?? "UND"),
            unitConfirmed: Boolean(p?.unitConfirmed),
            stock: p?.stock ? String(p.stock) : undefined,
            badge: p?.badge || "nenhum",
            image: String(p?.image ?? ""),
            included: p?.included !== undefined ? Boolean(p.included) : true,
            productUrl: p?.productUrl,
            photoSource: p?.photoSource,
            photoOriginName: p?.photoOriginName,
            customStyle: p?.customStyle,
            alternativePhotos: Array.isArray(p?.alternativePhotos) ? p.alternativePhotos : undefined,
            imageScale: typeof p?.imageScale === "number" ? p.imageScale : undefined,
          }))
        : [],
      campaign: {
        ...DEFAULT_CAMPAIGN,
        ...(parsed.campaign || {}),
      },
      store: {
        ...DEFAULT_STORE,
        ...(parsed.store || {}),
      },
      versionHistory: Array.isArray(parsed.versionHistory)
        ? parsed.versionHistory.map((vh: any) => ({
            version: Number(vh?.version) || 1,
            savedAt: String(vh?.savedAt || new Date().toISOString()),
            itemCount: Number(vh?.itemCount) || 0,
            notes: vh?.notes ? String(vh.notes) : undefined,
            driveFileId: vh?.driveFileId ? String(vh.driveFileId) : undefined,
          }))
        : [],
      driveFolderId: parsed.driveFolderId ? String(parsed.driveFolderId) : undefined,
      currentDriveFileId: parsed.currentDriveFileId ? String(parsed.currentDriveFileId) : undefined,
    };

    return { ok: true, data: project, project };
  } catch (err) {
    return {
      ok: false,
      error: `Não foi possível abrir o arquivo do projeto: Arquivo de projeto inválido ou corrompido (${
        err instanceof Error ? err.message : "formato corrompido"
      })`,
    };
  }
}

/**
 * Compara os produtos atuais do projeto com uma nova lista de produtos (ex.: planilha atualizada ou link re-lido)
 * e gera um relatório detalhado de diferenças.
 */
export function analyzeProjectUpdates(
  currentProducts: EncarteProduct[],
  newProducts: EncarteProduct[]
): ProjectUpdateAnalysis {
  const currentByCode = new Map<string, EncarteProduct>();
  for (const p of currentProducts) {
    if (p.code) currentByCode.set(p.code.trim(), p);
  }

  const newByCode = new Map<string, EncarteProduct>();
  for (const p of newProducts) {
    if (p.code) newByCode.set(p.code.trim(), p);
  }

  const diffs: ProductChangeDiff[] = [];

  // 1. Produtos alterados ou mantidos
  for (const [code, newP] of newByCode.entries()) {
    const oldP = currentByCode.get(code);
    if (!oldP) {
      // Produto novo adicionado na planilha/fonte
      diffs.push({
        code,
        name: newP.name,
        type: "added",
        changes: [],
        newProduct: newP,
        selected: true,
      });
      continue;
    }

    const fieldChanges: ProductChangeDiff["changes"] = [];

    // Preço
    const oldPrice = String(oldP.price || "").trim();
    const newPrice = String(newP.price || "").trim();
    if (newPrice && oldPrice !== newPrice) {
      fieldChanges.push({ field: "price", oldValue: oldPrice, newValue: newPrice });
    }

    // Unidade de venda
    const oldUnit = String(oldP.unit || "").trim().toUpperCase();
    const newUnit = String(newP.unit || "").trim().toUpperCase();
    if (newUnit && oldUnit !== newUnit) {
      fieldChanges.push({ field: "unit", oldValue: oldUnit, newValue: newUnit });
    }

    // Estoque
    const oldStock = String(oldP.stock || "").trim();
    const newStock = String(newP.stock || "").trim();
    if (newStock && oldStock !== newStock) {
      fieldChanges.push({ field: "stock", oldValue: oldStock, newValue: newStock });
    }

    // Validade
    const oldVal = String(oldP.validity || "").trim();
    const newVal = String(newP.validity || "").trim();
    if (newVal && oldVal !== newVal) {
      fieldChanges.push({ field: "validity", oldValue: oldVal, newValue: newVal });
    }

    // Embalagem
    const oldPack = String(oldP.packaging || "").trim();
    const newPack = String(newP.packaging || "").trim();
    if (newPack && oldPack !== newPack) {
      fieldChanges.push({ field: "packaging", oldValue: oldPack, newValue: newPack });
    }

    if (fieldChanges.length > 0) {
      diffs.push({
        code,
        name: newP.name,
        type: "changed",
        changes: fieldChanges,
        newProduct: newP,
        selected: true,
      });
    }
  }

  // 2. Produtos que estavam no projeto mas foram removidos da nova planilha
  for (const [code, oldP] of currentByCode.entries()) {
    if (!newByCode.has(code)) {
      diffs.push({
        code,
        name: oldP.name,
        type: "removed",
        changes: [],
        selected: false, // Por padrão, não remove sem o usuário marcar explicitamente
      });
    }
  }

  const totalNew = diffs.filter((d) => d.type === "added").length;
  const totalRemoved = diffs.filter((d) => d.type === "removed").length;
  const totalChanged = diffs.filter((d) => d.type === "changed").length;

  return {
    hasUpdates: diffs.length > 0,
    hasChanges: diffs.length > 0,
    checkedAt: new Date().toISOString(),
    totalNew,
    totalRemoved,
    totalChanged,
    totalChanges: diffs.length,
    diffs,
  };
}
