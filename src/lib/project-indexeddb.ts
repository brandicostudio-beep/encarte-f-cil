import type {
  ProjectData,
  ProjectIndexItem,
  ProjectVersionSummary,
} from "@/types/project";
import { serializeProject, deserializeProject } from "./project-serializer";

const DB_NAME = "EncartesFacilDB";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

// Fallback em memória para testes unitários ou ambientes SSR sem IndexedDB
const memProjects = new Map<string, ProjectData>();
const memVersions = new Map<string, { projectId: string; version: number; savedAt: string; data: string }>();

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function getDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error("IndexedDB não está disponível neste ambiente."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store de projetos
        if (!db.objectStoreNames.contains("projects")) {
          const projectStore = db.createObjectStore("projects", { keyPath: "id" });
          projectStore.createIndex("updatedAt", "updatedAt", { unique: false });
          projectStore.createIndex("isTrashed", "isTrashed", { unique: false });
        }

        // Store de histórico de versões
        if (!db.objectStoreNames.contains("versions")) {
          const versionStore = db.createObjectStore("versions", {
            keyPath: ["projectId", "version"],
          });
          versionStore.createIndex("projectId", "projectId", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

/**
 * Salva ou atualiza um projeto localmente no IndexedDB e grava a versão no histórico.
 */
export async function saveProjectLocal(
  project: ProjectData,
  createVersion = true
): Promise<{ ok: boolean; version: number; error?: string }> {
  try {
    const now = new Date().toISOString();
    const versionNum = createVersion ? (project.version || 1) : project.version;

    const versionSummary: ProjectVersionSummary = {
      version: versionNum,
      savedAt: now,
      itemCount: project.products.length,
      notes: `Salvo localmente com ${project.products.length} produtos`,
    };

    const existingHist = project.versionHistory || [];
    const hasVersion = existingHist.some((v) => v.version === versionNum);
    const updatedHistory = hasVersion
      ? existingHist.map((v) => (v.version === versionNum ? versionSummary : v))
      : [...existingHist, versionSummary];

    const projectToStore: ProjectData = {
      ...project,
      updatedAt: now,
      version: versionNum,
      versionHistory: updatedHistory,
    };

    const serialized = serializeProject(projectToStore);

    if (!isIndexedDBAvailable()) {
      memProjects.set(project.id, projectToStore);
      if (createVersion) {
        memVersions.set(`${project.id}:${versionNum}`, {
          projectId: project.id,
          version: versionNum,
          savedAt: now,
          data: serialized,
        });
      }
      return { ok: true, version: versionNum };
    }

    const db = await getDB();

    // Transação para gravar projeto e versão
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["projects", "versions"], "readwrite");
      const projectStore = tx.objectStore("projects");
      const versionStore = tx.objectStore("versions");

      projectStore.put(projectToStore);

      if (createVersion) {
        versionStore.put({
          projectId: project.id,
          version: versionNum,
          savedAt: now,
          data: serialized,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return { ok: true, version: versionNum };
  } catch (err) {
    return {
      ok: false,
      version: project.version || 1,
      error: err instanceof Error ? err.message : "Erro ao salvar no IndexedDB",
    };
  }
}

/**
 * Carrega um projeto do IndexedDB.
 */
export async function loadProjectLocal(id: string): Promise<{
  ok: boolean;
  project?: ProjectData;
  error?: string;
}> {
  try {
    if (!isIndexedDBAvailable()) {
      const found = memProjects.get(id);
      if (found) {
        return { ok: true, project: JSON.parse(JSON.stringify(found)) };
      }
      return { ok: false, error: "Projeto não encontrado no armazenamento local." };
    }

    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction("projects", "readonly");
      const store = tx.objectStore("projects");
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve({ ok: true, project: request.result });
        } else {
          resolve({ ok: false, error: "Projeto não encontrado no armazenamento local." });
        }
      };

      request.onerror = () => {
        resolve({ ok: false, error: "Falha ao ler projeto do IndexedDB." });
      };
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro no IndexedDB",
    };
  }
}

/**
 * Lista todos os projetos salvos no IndexedDB para a tela de Arquivos Recentes.
 */
export async function listProjectsLocal(
  includeTrashed = false
): Promise<ProjectIndexItem[]> {
  try {
    if (!isIndexedDBAvailable()) {
      const rawList = Array.from(memProjects.values());
      const filtered = rawList.filter((p) =>
        includeTrashed ? Boolean(p.isTrashed) : !p.isTrashed
      );

      const items: ProjectIndexItem[] = filtered.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        currentVersion: p.version,
        versionCount: p.versionHistory?.length || 1,
        itemCount: p.products.length,
        sourceType: p.source.type,
        sourceName: p.source.filename || p.source.url,
        syncStatus: p.driveFolderId ? "synced" : "local_only",
        isTrashed: Boolean(p.isTrashed),
        trashedAt: p.trashedAt,
        driveFolderId: p.driveFolderId,
      }));

      items.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return items;
    }

    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction("projects", "readonly");
      const store = tx.objectStore("projects");
      const request = store.getAll();

      request.onsuccess = () => {
        const rawList: ProjectData[] = request.result || [];
        const filtered = rawList.filter((p) =>
          includeTrashed ? Boolean(p.isTrashed) : !p.isTrashed
        );

        const items: ProjectIndexItem[] = filtered.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          currentVersion: p.version,
          versionCount: p.versionHistory?.length || 1,
          itemCount: p.products.length,
          sourceType: p.source.type,
          sourceName: p.source.filename || p.source.url,
          syncStatus: p.driveFolderId ? "synced" : "local_only",
          isTrashed: Boolean(p.isTrashed),
          trashedAt: p.trashedAt,
          driveFolderId: p.driveFolderId,
        }));

        // Ordenar por última alteração decrescente (mais recentes primeiro)
        items.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        resolve(items);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Renomeia um projeto localmente no IndexedDB sem alterar o conteúdo.
 */
export async function renameProjectLocal(
  id: string,
  newName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await loadProjectLocal(id);
    if (!existing.ok || !existing.project) {
      return { ok: false, error: "Projeto não encontrado." };
    }

    const updated: ProjectData = {
      ...existing.project,
      name: newName.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!isIndexedDBAvailable()) {
      memProjects.set(id, updated);
      return { ok: true };
    }

    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(updated);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () => resolve({ ok: false, error: "Falha ao renomear no IndexedDB." });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao renomear" };
  }
}

/**
 * Duplica um projeto criando um clone com novo ID e versão 1.
 */
export async function duplicateProjectLocal(
  id: string,
  customName?: string
): Promise<{ ok: boolean; newProject?: ProjectData; error?: string }> {
  try {
    const existing = await loadProjectLocal(id);
    if (!existing.ok || !existing.project) {
      return { ok: false, error: "Projeto original não encontrado para duplicação." };
    }

    const now = new Date().toISOString();
    const newId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newName = customName || `${existing.project.name} (Cópia)`;

    const duplicated: ProjectData = {
      ...existing.project,
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isTrashed: false,
      trashedAt: undefined,
      driveFolderId: undefined,
      currentDriveFileId: undefined,
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          itemCount: existing.project.products.length,
          notes: `Duplicado a partir de "${existing.project.name}"`,
        },
      ],
    };

    const saveRes = await saveProjectLocal(duplicated, true);
    if (!saveRes.ok) {
      return { ok: false, error: saveRes.error };
    }

    return { ok: true, newProject: duplicated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao duplicar" };
  }
}

/**
 * Move para a lixeira (exclusão lógica) ou exclui definitivamente do IndexedDB.
 */
export async function deleteProjectLocal(
  id: string,
  permanent = false
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isIndexedDBAvailable()) {
      if (permanent) {
        memProjects.delete(id);
        for (const [key, val] of memVersions.entries()) {
          if (val.projectId === id) memVersions.delete(key);
        }
        return { ok: true };
      }
      const existing = memProjects.get(id);
      if (!existing) return { ok: false, error: "Projeto não encontrado." };
      existing.isTrashed = true;
      existing.trashedAt = new Date().toISOString();
      memProjects.set(id, existing);
      return { ok: true };
    }

    const db = await getDB();

    if (permanent) {
      return new Promise((resolve) => {
        const tx = db.transaction(["projects", "versions"], "readwrite");
        tx.objectStore("projects").delete(id);

        // Remove também as versões associadas
        const vStore = tx.objectStore("versions");
        const vIndex = vStore.index("projectId");
        const vReq = vIndex.getAllKeys(id);
        vReq.onsuccess = () => {
          for (const key of vReq.result || []) {
            vStore.delete(key);
          }
        };

        tx.oncomplete = () => resolve({ ok: true });
        tx.onerror = () => resolve({ ok: false, error: "Erro ao excluir definitivamente." });
      });
    }

    // Move para a lixeira
    const existing = await loadProjectLocal(id);
    if (!existing.ok || !existing.project) {
      return { ok: false, error: "Projeto não encontrado." };
    }

    const trashed: ProjectData = {
      ...existing.project,
      isTrashed: true,
      trashedAt: new Date().toISOString(),
    };

    return new Promise((resolve) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(trashed);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () => resolve({ ok: false, error: "Erro ao mover para a lixeira." });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao excluir" };
  }
}

/**
 * Restaura um projeto da lixeira.
 */
export async function restoreFromTrashLocal(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isIndexedDBAvailable()) {
      const existing = memProjects.get(id);
      if (!existing) return { ok: false, error: "Projeto não encontrado." };
      existing.isTrashed = false;
      existing.trashedAt = undefined;
      existing.updatedAt = new Date().toISOString();
      memProjects.set(id, existing);
      return { ok: true };
    }

    const db = await getDB();
    const existing = await loadProjectLocal(id);
    if (!existing.ok || !existing.project) {
      return { ok: false, error: "Projeto não encontrado." };
    }

    const restored: ProjectData = {
      ...existing.project,
      isTrashed: false,
      trashedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(restored);
      tx.oncomplete = () => resolve({ ok: true });
      tx.onerror = () => resolve({ ok: false, error: "Erro ao restaurar da lixeira." });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao restaurar" };
  }
}

/**
 * Carrega uma versão específica do projeto a partir do histórico de versões.
 */
export async function loadProjectVersionLocal(
  projectId: string,
  versionNumber: number
): Promise<{ ok: boolean; project?: ProjectData; error?: string }> {
  try {
    if (!isIndexedDBAvailable()) {
      const ver = memVersions.get(`${projectId}:${versionNumber}`);
      if (!ver || !ver.data) {
        return { ok: false, error: `Versão v${versionNumber} não encontrada.` };
      }
      const deserialized = deserializeProject(ver.data);
      if (deserialized.ok && (deserialized.project || deserialized.data)) {
        return { ok: true, project: deserialized.project || deserialized.data };
      }
      return { ok: false, error: deserialized.error || "Dados da versão corrompidos." };
    }

    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction("versions", "readonly");
      const store = tx.objectStore("versions");
      const req = store.get([projectId, versionNumber]);

      req.onsuccess = () => {
        if (!req.result || !req.result.data) {
          resolve({ ok: false, error: `Versão v${versionNumber} não encontrada.` });
          return;
        }

        const deserialized = deserializeProject(req.result.data);
        if (deserialized.ok && (deserialized.project || deserialized.data)) {
          resolve({ ok: true, project: deserialized.project || deserialized.data });
        } else {
          resolve({ ok: false, error: deserialized.error || "Dados da versão corrompidos." });
        }
      };

      req.onerror = () => {
        resolve({ ok: false, error: "Falha ao ler versão do IndexedDB." });
      };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao buscar versão" };
  }
}
