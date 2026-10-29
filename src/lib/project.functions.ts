import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  checkDriveConnection,
  saveProjectVersionToDrive,
  loadProjectFromDrive,
  renameDriveProject,
  deleteDriveProject,
  getOrCreateRootFolder,
  readDriveIndex,
} from "./project-drive";
import type { ProjectData } from "@/types/project";

/**
 * Verifica o status de conexão com o Google Drive via conector Lovable.
 */
export const checkDriveStatusFn = createServerFn({ method: "POST" })
  .handler(async () => {
    return await checkDriveConnection();
  });

/**
 * Lê o índice de projetos salvos no Google Drive do usuário.
 */
export const getDriveProjectsIndexFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const rootRes = await getOrCreateRootFolder();
    if (!rootRes.ok || !rootRes.folderId) {
      return { ok: false, error: rootRes.error || "Não foi possível acessar a pasta Encartes Fácil no Drive." };
    }

    const idxRes = await readDriveIndex(rootRes.folderId);
    if (!idxRes.ok || !idxRes.index) {
      return { ok: false, error: idxRes.error || "Falha ao ler índice do Drive." };
    }

    return { ok: true, index: idxRes.index };
  });

/**
 * Salva uma versão de projeto no Google Drive.
 */
export const saveProjectToDriveFn = createServerFn({ method: "POST" })
  .validator((d: { project: ProjectData }) => d)
  .handler(async ({ data }) => {
    return await saveProjectVersionToDrive(data.project);
  });

/**
 * Carrega o conteúdo de um projeto a partir de um arquivo no Google Drive.
 */
export const loadProjectFromDriveFn = createServerFn({ method: "POST" })
  .validator((d: { fileId: string }) => z.object({ fileId: z.string().min(5) }).parse(d))
  .handler(async ({ data }) => {
    return await loadProjectFromDrive(data.fileId);
  });

/**
 * Renomeia um projeto no Google Drive.
 */
export const renameDriveProjectFn = createServerFn({ method: "POST" })
  .validator((d: { projectId: string; newName: string }) =>
    z.object({ projectId: z.string().min(1), newName: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data }) => {
    return await renameDriveProject(data.projectId, data.newName);
  });

/**
 * Move para a lixeira ou exclui definitivamente um projeto no Google Drive.
 */
export const deleteDriveProjectFn = createServerFn({ method: "POST" })
  .validator((d: { projectId: string; permanent?: boolean }) =>
    z.object({ projectId: z.string().min(1), permanent: z.boolean().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    return await deleteDriveProject(data.projectId, data.permanent);
  });
