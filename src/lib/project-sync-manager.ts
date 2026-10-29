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
} from "./project.functions";
import { analyzeProjectUpdates, validateProjectName } from "./project-serializer";

export interface SyncManagerCallbacks {
  onStatusChange?: (status: ProjectSyncStatus, notice?: string) => void;
  onProjectSaved?: (project: ProjectData, notice: string) => void;
}

/**
 * Salva o projeto ativo no IndexedDB local e, se conectado, sincroniza com o Google Drive.
 */
export async function saveProjectUnified(
  project: ProjectData,
  isNewVersion = false,
  callbacks?: SyncManagerCallbacks
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

  // 2. Tentar sincronizar com Google Drive
  try {
    const driveStatus = await checkDriveStatusFn();
    if (driveStatus.connected) {
      const driveRes = await saveProjectToDriveFn({ data: { project: projectToSave } });
      if (driveRes.ok) {
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
 * Lista todos os projetos combinando IndexedDB e Google Drive.
 */
export async function listAllProjectsUnified(
  includeTrashed = false
): Promise<{ items: ProjectIndexItem[]; driveConnected: boolean }> {
  // 1. Ler projetos locais do IndexedDB
  const localItems = await listProjectsLocal(includeTrashed);

  // 2. Checar Google Drive
  let driveConnected = false;
  try {
    const driveStatus = await checkDriveStatusFn();
    driveConnected = Boolean(driveStatus.connected);

    if (driveConnected) {
      const driveIndexRes = await getDriveProjectsIndexFn();
      if (driveIndexRes.ok && driveIndexRes.index?.projects) {
        // Mesclar dados do Drive atualizando status de sincronização
        const driveProjects = driveIndexRes.index.projects;
        for (const item of localItems) {
          const inDrive = driveProjects.find((dp) => dp.id === item.id);
          if (inDrive) {
            item.syncStatus = "synced";
            item.driveFolderId = inDrive.driveFolderId;
          }
        }
      }
    }
  } catch {
    driveConnected = false;
  }

  return { items: localItems, driveConnected };
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
