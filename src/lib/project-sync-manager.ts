import type {
  ProjectData,
  ProjectIndexItem,
  ProjectSyncStatus,
  ProductChangeDiff,
} from "@/types/project";
import type { EncarteProduct } from "@/types/encarte";
import {
  saveProjectLocal,
  loadProjectLocal,
  listProjectsLocal,
  renameProjectLocal,
  duplicateProjectLocal,
  deleteProjectLocal,
  restoreFromTrashLocal,
  loadProjectVersionLocal,
} from "./project-indexeddb";
import {
  checkDriveStatusFn,
  saveProjectToDriveFn,
  renameDriveProjectFn,
  deleteDriveProjectFn,
  getDriveProjectsIndexFn,
  loadProjectFromDriveByIdFn,
} from "./project.functions";
import {
  analyzeProjectUpdates,
  validateProjectName,
  stripHeavyImagesForStorage,
  serializeProject,
  deserializeProject,
} from "./project-serializer";
import { getCachedPhoto } from "./drive-cache";

export interface SyncManagerCallbacks {
  onStatusChange?: (status: ProjectSyncStatus, notice?: string) => void;
  onProjectSaved?: (project: ProjectData, notice: string) => void;
}

// Cache temporário em memória para o índice do Drive (evita múltiplas requisições repetidas de rede)
let driveIndexCache: {
  timestamp: number;
  projects: any[];
} | null = null;
const DRIVE_CACHE_TTL_MS = 25000;

export function invalidateDriveIndexCache(): void {
  driveIndexCache = null;
}

/**
 * Re-hidrata fotos de produtos a partir do cache local se a URL estiver vazia.
 */
export function rehydrateProductPhotos(products: EncarteProduct[]): EncarteProduct[] {
  return products.map((p) => {
    if (p.image && p.image.trim()) return p;
    const cached = getCachedPhoto(p.code);
    if (cached?.dataUrl) {
      return { ...p, image: cached.dataUrl, photoSource: p.photoSource || "drive" };
    }
    return p;
  });
}

/**
 * Salva o projeto SOMENTE no computador (IndexedDB local), de forma instantânea (<20ms).
 */
export async function saveProjectLocallyOnly(
  project: ProjectData,
  isNewVersion = false,
  callbacks?: SyncManagerCallbacks
): Promise<{ ok: boolean; version: number; project?: ProjectData; error?: string }> {
  callbacks?.onStatusChange?.("unsaved", "Salvando no computador...");

  const versionToSave = isNewVersion ? (project.version || 1) + 1 : (project.version || 1);
  const now = new Date().toISOString();

  const projectToSave: ProjectData = {
    ...project,
    version: versionToSave,
    updatedAt: now,
  };

  const localRes = await saveProjectLocal(projectToSave, isNewVersion);
  if (!localRes.ok) {
    callbacks?.onStatusChange?.("sync_error", "Erro ao salvar no computador.");
    return { ok: false, version: projectToSave.version, error: localRes.error };
  }

  const timeStr = `${String(new Date().getHours()).padStart(2, "0")}:${String(
    new Date().getMinutes()
  ).padStart(2, "0")}`;

  callbacks?.onStatusChange?.("local_only", `Salvo no computador às ${timeStr}`);
  callbacks?.onProjectSaved?.(projectToSave, `Salvo às ${timeStr} no computador`);
  return { ok: true, version: versionToSave, project: projectToSave };
}

/**
 * Salva o projeto ativo no IndexedDB local de imediato e, se conectado, sincroniza com o Google Drive.
 */
export async function saveProjectUnified(
  project: ProjectData,
  isNewVersion = false,
  callbacks?: SyncManagerCallbacks,
  options?: { localOnly?: boolean }
): Promise<{ ok: boolean; version: number; error?: string }> {
  callbacks?.onStatusChange?.("unsaved", "Salvando projeto...");

  const versionToSave = isNewVersion ? (project.version || 1) + 1 : (project.version || 1);
  const now = new Date().toISOString();

  const projectToSave: ProjectData = {
    ...project,
    version: versionToSave,
    updatedAt: now,
  };

  // 1. Salvar no IndexedDB (Offline-first, instantâneo)
  const localRes = await saveProjectLocal(projectToSave, isNewVersion);
  if (!localRes.ok) {
    callbacks?.onStatusChange?.("sync_error", "Erro ao salvar localmente.");
    return { ok: false, version: projectToSave.version, error: localRes.error };
  }

  const timeStr = `${String(new Date().getHours()).padStart(2, "0")}:${String(
    new Date().getMinutes()
  ).padStart(2, "0")}`;

  // Se o usuário optou por salvar apenas no computador, finaliza imediatamente!
  if (options?.localOnly) {
    callbacks?.onStatusChange?.("local_only", `Salvo no computador às ${timeStr}`);
    callbacks?.onProjectSaved?.(projectToSave, `Salvo às ${timeStr} no computador`);
    return { ok: true, version: versionToSave };
  }

  // Notifica IMEDIATAMENTE que o projeto já está seguro salvo localmente
  callbacks?.onStatusChange?.("local_only", `Salvo no PC às ${timeStr} • Sincronizando com Google Drive...`);
  callbacks?.onProjectSaved?.(projectToSave, `Salvo às ${timeStr}`);

  // 2. Tentar sincronizar com Google Drive
  try {
    const driveStatus = await checkDriveStatusFn();
    if (driveStatus.connected) {
      // Prepara versão compacta para transmissão pela rede (sem data URLs gigantes)
      const cleanProjectForDrive: ProjectData = {
        ...projectToSave,
        products: stripHeavyImagesForStorage(projectToSave.products),
      };

      const driveRes = await saveProjectToDriveFn({ data: { project: cleanProjectForDrive } });
      if (driveRes.ok) {
        invalidateDriveIndexCache();
        if (driveRes.driveFolderId) {
          projectToSave.driveFolderId = driveRes.driveFolderId;
          await saveProjectLocal(projectToSave, false); // Atualiza ID do Drive no IndexedDB
        }
        callbacks?.onStatusChange?.("synced", `Salvo às ${timeStr} (Google Drive)`);
        callbacks?.onProjectSaved?.(projectToSave, `Salvo às ${timeStr}`);
        return { ok: true, version: versionToSave };
      }
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar projeto com Drive:", err);
  }

  // Fallback para armazenamento local
  callbacks?.onStatusChange?.("local_only", `Salvo às ${timeStr} (Offline)`);
  callbacks?.onProjectSaved?.(projectToSave, `Salvo às ${timeStr} localmente`);
  return { ok: true, version: versionToSave };
}

/**
 * Exporta e baixa o arquivo do projeto (.json) diretamente para a pasta do computador.
 */
export function downloadProjectFile(project: ProjectData): { ok: boolean; filename?: string; error?: string } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, error: "Ambiente sem suporte a DOM" };
  }
  try {
    const jsonStr = serializeProject(project);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = project.name.trim().replace(/[\\/:*?"<>|\s]+/g, "_").toLowerCase() || "encarte";
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `encarte_${safeName}_v${project.version || 1}_${dateStr}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 1000);
    return { ok: true, filename };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao baixar arquivo." };
  }
}

/**
 * Carrega um projeto pelo ID e faz o download direto como arquivo .json no computador.
 */
export async function downloadProjectById(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await loadProjectUnified(projectId);
  if (!res.ok || !res.project) {
    return { ok: false, error: res.error || "Não foi possível carregar o projeto para exportação." };
  }
  downloadProjectFile(res.project);
  return { ok: true };
}

/**
 * Importa um arquivo .json ou .encarte salvo no computador e grava no IndexedDB local.
 */
export async function importProjectFromFile(file: File): Promise<{
  ok: boolean;
  project?: ProjectData;
  error?: string;
}> {
  try {
    const text = await file.text();
    const res = deserializeProject(text);
    if (!res.ok || !res.project) {
      return { ok: false, error: res.error || "Arquivo de projeto inválido ou incompatível." };
    }

    const importedProject: ProjectData = {
      ...res.project,
      updatedAt: new Date().toISOString(),
    };

    // Salva imediatamente no banco local
    const localSave = await saveProjectLocal(importedProject, false);
    if (!localSave.ok) {
      return { ok: false, error: localSave.error || "Erro ao salvar o projeto no computador." };
    }

    invalidateDriveIndexCache();
    return { ok: true, project: importedProject };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao processar o arquivo selecionado.",
    };
  }
}

/**
 * Cria um novo projeto a partir do atual ("Salvar Como").
 */
export async function saveProjectAsUnified(
  currentProject: ProjectData,
  newName: string,
  callbacks?: SyncManagerCallbacks
): Promise<{ ok: boolean; newProject?: ProjectData; error?: string }> {
  const nameVal = validateProjectName(newName);
  if (!nameVal.valid) {
    return { ok: false, error: nameVal.error };
  }

  const now = new Date().toISOString();
  const newId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const newProject: ProjectData = {
    ...currentProject,
    id: newId,
    name: nameVal.cleanName,
    createdAt: now,
    updatedAt: now,
    version: 1,
    driveFolderId: undefined,
    currentDriveFileId: undefined,
    versionHistory: [
      {
        version: 1,
        savedAt: now,
        itemCount: currentProject.products.length,
        notes: `Criado a partir de "${currentProject.name}"`,
      },
    ],
  };

  const saveRes = await saveProjectUnified(newProject, false, callbacks);
  if (!saveRes.ok) {
    return { ok: false, error: saveRes.error };
  }

  return { ok: true, newProject };
}

/**
 * Renomeia um projeto existente no IndexedDB e no Google Drive.
 */
export async function renameProjectUnified(
  projectId: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  const nameVal = validateProjectName(newName);
  if (!nameVal.valid) {
    return { ok: false, error: nameVal.error };
  }

  // 1. Renomeia no IndexedDB
  const localRes = await renameProjectLocal(projectId, nameVal.cleanName);
  if (!localRes.ok) {
    return { ok: false, error: localRes.error };
  }

  // 2. Renomeia no Drive se conectado
  try {
    await renameDriveProjectFn({
      data: { projectId, newName: nameVal.cleanName },
    });
    invalidateDriveIndexCache();
  } catch {
    /* Drive offline continua válido */
  }

  return { ok: true };
}

/**
 * Duplica um projeto gerando cópia independente.
 */
export async function duplicateProjectUnified(
  projectId: string,
  customName?: string
): Promise<{ ok: boolean; newProject?: ProjectData; error?: string }> {
  const localRes = await duplicateProjectLocal(projectId, customName);
  if (!localRes.ok || !localRes.newProject) {
    return { ok: false, error: localRes.error };
  }

  // Tentar salvar a cópia no Drive
  try {
    await saveProjectToDriveFn({ data: { project: localRes.newProject } });
    invalidateDriveIndexCache();
  } catch {
    /* ignore */
  }

  return { ok: true, newProject: localRes.newProject };
}

/**
 * Move projeto para a lixeira ou exclui definitivamente.
 */
export async function deleteProjectUnified(
  projectId: string,
  permanent = false
): Promise<{ ok: boolean; error?: string }> {
  // 1. IndexedDB
  const localRes = await deleteProjectLocal(projectId, permanent);
  if (!localRes.ok) {
    return { ok: false, error: localRes.error };
  }

  // 2. Google Drive
  try {
    await deleteDriveProjectFn({ data: { projectId, permanent } });
    invalidateDriveIndexCache();
  } catch {
    /* ignore */
  }

  return { ok: true };
}

/**
 * Restaura um projeto da lixeira.
 */
export async function restoreProjectUnified(
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  return await restoreFromTrashLocal(projectId);
}

/**
 * Restaura uma versão anterior criando uma nova versão (ex: restaurar v1 cria v4).
 */
export async function restoreVersionUnified(
  projectId: string,
  versionNumber: number,
  callbacks?: SyncManagerCallbacks
): Promise<{ ok: boolean; restoredProject?: ProjectData; error?: string }> {
  // 1. Carrega dados da versão antiga
  const versionRes = await loadProjectVersionLocal(projectId, versionNumber);
  if (!versionRes.ok || !versionRes.project) {
    return { ok: false, error: versionRes.error || "Versão não encontrada." };
  }

  // 2. Carrega o projeto atual para saber o próximo número de versão
  const currentRes = await loadProjectLocal(projectId);
  const currentVersion = currentRes.ok && currentRes.project ? currentRes.project.version : versionNumber;
  const nextVersion = currentVersion + 1;

  const now = new Date().toISOString();
  const restoredProject: ProjectData = {
    ...versionRes.project,
    id: projectId,
    version: nextVersion,
    updatedAt: now,
    versionHistory: [
      ...(currentRes.project?.versionHistory || versionRes.project.versionHistory || []),
      {
        version: nextVersion,
        savedAt: now,
        itemCount: versionRes.project.products.length,
        notes: `Restaurada a partir da versão v${versionNumber}`,
      },
    ],
  };

  // 3. Salva a nova versão restaurada
  const saveRes = await saveProjectUnified(restoredProject, false, callbacks);
  if (!saveRes.ok) {
    return { ok: false, error: saveRes.error };
  }

  return { ok: true, restoredProject };
}

/**
 * Carrega um projeto pelo ID, buscando primeiro no IndexedDB local e,
 * se não existir ou se for da nuvem, baixando diretamente do Google Drive.
 */
export async function loadProjectUnified(projectId: string): Promise<{
  ok: boolean;
  project?: ProjectData;
  source: "local" | "drive";
  error?: string;
}> {
  // 1. Tentar ler do IndexedDB local primeiro
  const localRes = await loadProjectLocal(projectId);
  if (localRes.ok && localRes.project) {
    const rehydrated: ProjectData = {
      ...localRes.project,
      products: rehydrateProductPhotos(localRes.project.products || []),
    };
    return { ok: true, project: rehydrated, source: "local" };
  }

  // 2. Se não encontrou localmente, tentar baixar do Google Drive
  try {
    const driveStatus = await checkDriveStatusFn();
    if (driveStatus.connected) {
      const driveRes = await loadProjectFromDriveByIdFn({
        data: { projectId },
      });
      if (driveRes.ok && driveRes.project) {
        const rehydrated: ProjectData = {
          ...driveRes.project,
          products: rehydrateProductPhotos(driveRes.project.products || []),
        };
        // Salva imediatamente no IndexedDB local para acesso offline e rápido futuro
        await saveProjectLocal(rehydrated, false);
        return { ok: true, project: rehydrated, source: "drive" };
      }
      if (driveRes.error) {
        return { ok: false, source: "drive", error: driveRes.error };
      }
    }
  } catch (err) {
    return {
      ok: false,
      source: "drive",
      error: err instanceof Error ? err.message : "Falha ao baixar projeto da nuvem.",
    };
  }

  return {
    ok: false,
    source: "local",
    error: localRes.error || "Projeto não encontrado localmente nem no Drive.",
  };
}

/**
 * Lista todos os projetos combinando IndexedDB e Google Drive.
 * Garante que projetos salvos na nuvem em outro computador apareçam imediatamente.
 */
export async function listAllProjectsUnified(
  includeTrashed = false,
  forceRefresh = false
): Promise<{ items: ProjectIndexItem[]; driveConnected: boolean }> {
  // 1. Ler projetos locais do IndexedDB
  const localItems = await listProjectsLocal(includeTrashed);
  const itemsMap = new Map<string, ProjectIndexItem>();
  for (const item of localItems) {
    itemsMap.set(item.id, item);
  }

  // 2. Checar Google Drive
  let driveConnected = false;
  try {
    const driveStatus = await checkDriveStatusFn();
    driveConnected = Boolean(driveStatus.connected);

    if (driveConnected) {
      let driveProjects: any[] | null = null;
      const now = Date.now();

      if (!forceRefresh && driveIndexCache && now - driveIndexCache.timestamp < DRIVE_CACHE_TTL_MS) {
        driveProjects = driveIndexCache.projects;
      } else {
        const driveIndexRes = await getDriveProjectsIndexFn();
        if (driveIndexRes.ok && driveIndexRes.index?.projects) {
          driveProjects = driveIndexRes.index.projects;
          driveIndexCache = {
            timestamp: now,
            projects: driveProjects,
          };
        }
      }

      if (driveProjects) {
        for (const dp of driveProjects) {
          const isTrashedMatch = includeTrashed ? Boolean(dp.isTrashed) : !dp.isTrashed;
          if (!isTrashedMatch) continue;

          const localItem = itemsMap.get(dp.id);
          if (localItem) {
            localItem.syncStatus = "synced";
            localItem.driveFolderId = dp.driveFolderId;
            localItem.driveFileId = dp.driveFileId;
          } else {
            // PROJETO EXISTE NA NUVEM MAS NÃO NESTE COMPUTADOR
            // Adiciona para que apareça em qualquer computador!
            const cloudItem: ProjectIndexItem = {
              id: dp.id,
              name: dp.name || "Encarte na Nuvem",
              createdAt: dp.createdAt || new Date().toISOString(),
              updatedAt: dp.updatedAt || new Date().toISOString(),
              currentVersion: dp.currentVersion || 1,
              versionCount: dp.versionCount || 1,
              itemCount: dp.itemCount || 0,
              sourceType: dp.sourceType || "manual",
              sourceName: dp.sourceName || "Google Drive",
              syncStatus: "cloud_only",
              isTrashed: Boolean(dp.isTrashed),
              trashedAt: dp.trashedAt,
              driveFolderId: dp.driveFolderId,
              driveFileId: dp.driveFileId,
            };
            itemsMap.set(dp.id, cloudItem);
          }
        }
      }
    }
  } catch {
    driveConnected = false;
  }

  const items = Array.from(itemsMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return { items, driveConnected };
}

/**
 * Aplica as alterações selecionadas pelo usuário na verificação de atualizações.
 */
export function applySelectedUpdates(
  currentProducts: EncarteProduct[],
  diffs: ProductChangeDiff[]
): EncarteProduct[] {
  const selectedDiffs = diffs.filter((d) => d.selected);
  const diffsByCode = new Map<string, ProductChangeDiff>();
  for (const d of selectedDiffs) {
    diffsByCode.set(d.code.trim(), d);
  }

  // 1. Atualizar ou filtrar produtos existentes
  let updatedList: EncarteProduct[] = [];

  for (const p of currentProducts) {
    const diff = diffsByCode.get(p.code.trim());
    if (diff && diff.type === "removed") {
      // Usuário aceitou remover o produto
      continue;
    }

    if (diff && diff.type === "changed" && diff.newProduct) {
      // Aplicar campos alterados mantendo customStyles e imagem existentes
      const merged: EncarteProduct = {
        ...p,
        price: diff.newProduct.price || p.price,
        unit: diff.newProduct.unit || p.unit,
        stock: diff.newProduct.stock !== undefined ? diff.newProduct.stock : p.stock,
        validity: diff.newProduct.validity || p.validity,
        packaging: diff.newProduct.packaging || p.packaging,
      };
      updatedList.push(merged);
    } else {
      updatedList.push(p);
    }
  }

  // 2. Adicionar novos produtos
  for (const diff of selectedDiffs) {
    if (diff.type === "added" && diff.newProduct) {
      updatedList.push(diff.newProduct);
    }
  }

  return updatedList;
}
