import { getDriveRequestConfig } from "./drive-api";
import type {
  ProjectData,
  ProjectIndexFile,
  ProjectIndexItem,
  ProjectVersionSummary,
} from "@/types/project";
import { serializeProject, deserializeProject } from "./project-serializer";

const ROOT_FOLDER_NAME = "Encartes Fácil";
const INDEX_FILE_NAME = "indice.json";

interface DriveOpOptions {
  token?: string | null | undefined;
  fetchFn?: typeof fetch;
}

/**
 * Verifica se a conexão com o Google Drive está ativa e autorizada.
 */
export async function checkDriveConnection(
  options: DriveOpOptions = {}
): Promise<{ connected: boolean; reason?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) {
    return {
      connected: false,
      reason: "Conector do Google Drive não configurado no ambiente.",
    };
  }

  try {
    const res = await fetchFn(
      `${config.baseUrl}/about?fields=user(displayName,emailAddress)&supportsAllDrives=true`,
      { headers: config.headers }
    );
    if (res.ok) {
      return { connected: true };
    }
    if (res.status === 401) {
      return { connected: false, reason: "Acesso expirado. Reconecte o Google Drive." };
    }
    return { connected: false, reason: `Status ${res.status} ao conectar com Drive.` };
  } catch (err) {
    return {
      connected: false,
      reason: err instanceof Error ? err.message : "Erro de conexão de rede com o Drive.",
    };
  }
}

/**
 * Localiza ou cria a pasta raiz "Encartes Fácil" no Google Drive do usuário.
 */
export async function getOrCreateRootFolder(
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; folderId?: string; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) {
    return { ok: false, error: "Conexão com Google Drive não disponível." };
  }

  try {
    // 1. Procurar pasta existente com esse nome
    const q = `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`;

    const searchRes = await fetchFn(searchUrl, { headers: config.headers });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (Array.isArray(data.files) && data.files.length > 0 && data.files[0]?.id) {
        return { ok: true, folderId: data.files[0].id };
      }
    }

    // 2. Não existe: criar pasta raiz
    const createRes = await fetchFn(`${config.baseUrl}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        ...config.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return { ok: true, folderId: created.id };
    }

    return { ok: false, error: "Falha ao criar pasta 'Encartes Fácil' no Drive." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro no Drive" };
  }
}

/**
 * Localiza ou cria a subpasta de um projeto específico dentro da pasta "Encartes Fácil".
 */
export async function getOrCreateProjectFolder(
  rootFolderId: string,
  projectName: string,
  projectId: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; folderId?: string; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Conexão com Drive indisponível." };

  const folderName = `${projectName} [${projectId}]`;

  try {
    const q = `'${rootFolderId}' in parents and name = '${folderName.replace(
      /'/g,
      "\\'"
    )}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`;

    const searchRes = await fetchFn(searchUrl, { headers: config.headers });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (Array.isArray(data.files) && data.files.length > 0 && data.files[0]?.id) {
        return { ok: true, folderId: data.files[0].id };
      }
    }

    // Criar subpasta
    const createRes = await fetchFn(`${config.baseUrl}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        ...config.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return { ok: true, folderId: created.id };
    }

    return { ok: false, error: `Falha ao criar pasta para o projeto "${projectName}".` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro no Drive" };
  }
}

/**
 * Cria ou atualiza um arquivo JSON no Google Drive usando upload multipart.
 */
async function uploadJsonFileToDrive(
  name: string,
  jsonString: string,
  parentId?: string,
  existingFileId?: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Conexão com Drive indisponível." };

  try {
    if (existingFileId) {
      // Atualizar conteúdo de arquivo existente
      const patchUrl = `${config.baseUrl}/files/${encodeURIComponent(
        existingFileId
      )}?uploadType=media&supportsAllDrives=true`;
      const res = await fetchFn(patchUrl, {
        method: "PATCH",
        headers: {
          ...config.headers,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: jsonString,
      });

      if (res.ok) {
        return { ok: true, fileId: existingFileId };
      }
    }

    // Criar novo arquivo via multipart/related
    const boundary = "-------EncarteFacilBoundary" + Date.now();
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const metadata = {
      name,
      mimeType: "application/json",
      parents: parentId ? [parentId] : undefined,
    };

    const multipartBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      jsonString +
      closeDelim;

    const createUrl = `${config.baseUrl}/files?uploadType=multipart&supportsAllDrives=true`;
    const res = await fetchFn(createUrl, {
      method: "POST",
      headers: {
        ...config.headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (res.ok) {
      const created = await res.json();
      return { ok: true, fileId: created.id };
    }

    return { ok: false, error: `Falha ao gravar arquivo "${name}" no Drive.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro no Drive" };
  }
}

/**
 * Lê o arquivo indice.json na pasta raiz "Encartes Fácil".
 */
export async function readDriveIndex(
  rootFolderId: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; index?: ProjectIndexFile; indexFileId?: string; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Sem conexão com Drive." };

  try {
    const q = `'${rootFolderId}' in parents and name = '${INDEX_FILE_NAME}' and trashed = false`;
    const searchUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`;

    const searchRes = await fetchFn(searchUrl, { headers: config.headers });
    if (!searchRes.ok) {
      return { ok: false, error: "Falha ao buscar indice.json no Drive." };
    }

    const data = await searchRes.json();
    if (!Array.isArray(data.files) || data.files.length === 0 || !data.files[0]?.id) {
      // Índice ainda não existe: retorna estrutura vazia
      return {
        ok: true,
        index: { app: "encartes-facil", version: 1, updatedAt: new Date().toISOString(), projects: [] },
      };
    }

    const fileId = data.files[0].id;
    const mediaRes = await fetchFn(
      `${config.baseUrl}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: config.headers }
    );

    if (!mediaRes.ok) {
      return { ok: false, error: "Falha ao ler conteúdo de indice.json." };
    }

    const text = await mediaRes.text();
    const parsed = JSON.parse(text);
    return { ok: true, index: parsed, indexFileId: fileId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro lendo índice do Drive" };
  }
}

/**
 * Grava ou atualiza o arquivo indice.json no Google Drive.
 */
export async function writeDriveIndex(
  rootFolderId: string,
  index: ProjectIndexFile,
  existingIndexFileId?: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  const jsonStr = JSON.stringify(index, null, 2);
  return uploadJsonFileToDrive(INDEX_FILE_NAME, jsonStr, rootFolderId, existingIndexFileId, options);
}

/**
 * Salva uma nova versão do projeto no Google Drive (ex: projeto-v001.json)
 * e atualiza o indice.json correspondente.
 */
export async function saveProjectVersionToDrive(
  project: ProjectData,
  options: DriveOpOptions = {}
): Promise<{
  ok: boolean;
  version: number;
  driveFolderId?: string;
  driveFileId?: string;
  error?: string;
}> {
  const { token } = options;
  const config = getDriveRequestConfig(token);
  if (!config) {
    return { ok: false, version: project.version, error: "Conexão com Google Drive inativa." };
  }

  // 1. Obter pasta raiz
  const rootRes = await getOrCreateRootFolder(options);
  if (!rootRes.ok || !rootRes.folderId) {
    return { ok: false, version: project.version, error: rootRes.error };
  }
  const rootFolderId = rootRes.folderId;

  // 2. Obter subpasta do projeto
  const projFolderRes = await getOrCreateProjectFolder(
    rootFolderId,
    project.name,
    project.id,
    options
  );
  if (!projFolderRes.ok || !projFolderRes.folderId) {
    return { ok: false, version: project.version, error: projFolderRes.error };
  }
  const projectFolderId = projFolderRes.folderId;

  // 3. Montar nome do arquivo da versão (ex.: projeto-v001.json)
  const versionNum = project.version || 1;
  const versionPadded = String(versionNum).padStart(3, "0");
  const fileName = `projeto-v${versionPadded}.json`;

  const now = new Date().toISOString();
  const serialized = serializeProject({
    ...project,
    driveFolderId: projectFolderId,
    updatedAt: now,
  });

  // 4. Fazer upload do arquivo de versão
  const uploadRes = await uploadJsonFileToDrive(
    fileName,
    serialized,
    projectFolderId,
    undefined,
    options
  );

  if (!uploadRes.ok || !uploadRes.fileId) {
    return { ok: false, version: versionNum, error: uploadRes.error };
  }
  const driveFileId = uploadRes.fileId;

  // 5. Atualizar o indice.json na raiz do Drive
  try {
    const idxRes = await readDriveIndex(rootFolderId, options);
    const currentIndex = idxRes.index || {
      app: "encartes-facil",
      version: 1,
      updatedAt: now,
      projects: [],
    };

    const projectIndexItem: ProjectIndexItem = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt || now,
      updatedAt: now,
      currentVersion: versionNum,
      versionCount: (project.versionHistory?.length || 0) + 1,
      itemCount: project.products.length,
      sourceType: project.source.type,
      sourceName: project.source.filename || project.source.url,
      syncStatus: "synced",
      isTrashed: Boolean(project.isTrashed),
      trashedAt: project.trashedAt,
      driveFolderId: projectFolderId,
    };

    const existingIdx = currentIndex.projects.findIndex((p) => p.id === project.id);
    if (existingIdx >= 0) {
      currentIndex.projects[existingIdx] = projectIndexItem;
    } else {
      currentIndex.projects.unshift(projectIndexItem);
    }
    currentIndex.updatedAt = now;

    await writeDriveIndex(rootFolderId, currentIndex, idxRes.indexFileId, options);
  } catch (err) {
    console.warn("Aviso: falha ao atualizar indice.json no Drive:", err);
  }

  return {
    ok: true,
    version: versionNum,
    driveFolderId: projectFolderId,
    driveFileId,
  };
}

/**
 * Baixa e desserializa uma versão de projeto do Google Drive.
 */
export async function loadProjectFromDrive(
  fileId: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; project?: ProjectData; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Sem conexão com Drive." };

  try {
    const mediaUrl = `${config.baseUrl}/files/${encodeURIComponent(
      fileId
    )}?alt=media&supportsAllDrives=true`;
    const res = await fetchFn(mediaUrl, { headers: config.headers });

    if (!res.ok) {
      return { ok: false, error: `Falha ao baixar projeto do Drive (status ${res.status}).` };
    }

    const text = await res.text();
    return deserializeProject(text);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao carregar do Drive" };
  }
}

/**
 * Renomeia a pasta de um projeto no Google Drive e atualiza o indice.json.
 */
export async function renameDriveProject(
  projectId: string,
  newName: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Sem conexão com Drive." };

  try {
    const rootRes = await getOrCreateRootFolder(options);
    if (!rootRes.ok || !rootRes.folderId) return { ok: false, error: rootRes.error };

    const idxRes = await readDriveIndex(rootRes.folderId, options);
    if (!idxRes.ok || !idxRes.index) return { ok: false, error: idxRes.error };

    const item = idxRes.index.projects.find((p) => p.id === projectId);
    if (!item) return { ok: false, error: "Projeto não encontrado no índice do Drive." };

    // Se tiver pasta no Drive, renomeia
    if (item.driveFolderId) {
      const folderName = `${newName} [${projectId}]`;
      await fetchFn(
        `${config.baseUrl}/files/${encodeURIComponent(item.driveFolderId)}?supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { ...config.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName }),
        }
      );
    }

    // Atualiza nome no índice
    item.name = newName;
    item.updatedAt = new Date().toISOString();
    await writeDriveIndex(rootRes.folderId, idxRes.index, idxRes.indexFileId, options);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao renomear no Drive" };
  }
}

/**
 * Move a pasta do projeto para a lixeira do Drive ou exclui permanentemente.
 */
export async function deleteDriveProject(
  projectId: string,
  permanent = false,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Sem conexão com Drive." };

  try {
    const rootRes = await getOrCreateRootFolder(options);
    if (!rootRes.ok || !rootRes.folderId) return { ok: false, error: rootRes.error };

    const idxRes = await readDriveIndex(rootRes.folderId, options);
    if (!idxRes.ok || !idxRes.index) return { ok: false, error: idxRes.error };

    const item = idxRes.index.projects.find((p) => p.id === projectId);

    if (permanent) {
      if (item?.driveFolderId) {
        await fetchFn(
          `${config.baseUrl}/files/${encodeURIComponent(item.driveFolderId)}?supportsAllDrives=true`,
          {
            method: "DELETE",
            headers: config.headers,
          }
        );
      }
      idxRes.index.projects = idxRes.index.projects.filter((p) => p.id !== projectId);
    } else {
      if (item) {
        item.isTrashed = true;
        item.trashedAt = new Date().toISOString();
        if (item.driveFolderId) {
          await fetchFn(
            `${config.baseUrl}/files/${encodeURIComponent(
              item.driveFolderId
            )}?supportsAllDrives=true`,
            {
              method: "PATCH",
              headers: { ...config.headers, "Content-Type": "application/json" },
              body: JSON.stringify({ trashed: true }),
            }
          );
        }
      }
    }

    idxRes.index.updatedAt = new Date().toISOString();
    await writeDriveIndex(rootRes.folderId, idxRes.index, idxRes.indexFileId, options);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao excluir no Drive" };
  }
}
