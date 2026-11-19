import { getDriveRequestConfig } from "./drive-api";
import type {
  ProjectData,
  ProjectIndexFile,
  ProjectIndexItem,
  ProjectVersionSummary,
} from "@/types/project";
import { serializeProject, deserializeProject } from "./project-serializer";
import { DEFAULT_CAMPAIGN, DEFAULT_STORE } from "@/types/encarte";
import { parseSpreadsheetFile } from "./spreadsheet-parser";

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
    // 1. Procurar pastas existentes com esse nome
    const q = `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,modifiedTime)&pageSize=10&supportsAllDrives=true`;

    const searchRes = await fetchFn(searchUrl, { headers: config.headers });
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (Array.isArray(data.files) && data.files.length > 0) {
        if (data.files.length === 1 && data.files[0]?.id) {
          return { ok: true, folderId: data.files[0].id };
        }
        // Se houver mais de uma pasta com o mesmo nome, seleciona a que possui subpastas ou a mais recente
        for (const f of data.files) {
          try {
            const childQ = `'${f.id}' in parents and trashed = false`;
            const childUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
              childQ
            )}&pageSize=1&fields=files(id)&supportsAllDrives=true`;
            const childRes = await fetchFn(childUrl, { headers: config.headers });
            if (childRes.ok) {
              const childData = await childRes.json();
              if (Array.isArray(childData.files) && childData.files.length > 0) {
                return { ok: true, folderId: f.id };
              }
            }
          } catch {}
        }
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
    // Criar arquivo via multipart/related
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
      // Se havia um arquivo existente anterior, exclui para não deixar duplicata
      if (existingFileId && existingFileId !== created.id) {
        try {
          await fetchFn(
            `${config.baseUrl}/files/${encodeURIComponent(existingFileId)}?supportsAllDrives=true`,
            {
              method: "DELETE",
              headers: config.headers,
            }
          );
        } catch {}
      }
      return { ok: true, fileId: created.id };
    }

    return { ok: false, error: `Falha ao gravar arquivo "${name}" no Drive.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro no Drive" };
  }
}

/**
 * Realiza varredura ativa em todas as subpastas da pasta raiz "Encartes Fácil".
 * Se houver projetos existentes no Drive que não constem no indice.json
 * (por exemplo, criados em outro computador, por sessões anteriores ou sem atualização de índice),
 * inspeciona os arquivos .json de cada pasta e recupera os projetos automaticamente.
 */
export async function reconcileDriveIndexWithSubfolders(
  rootFolderId: string,
  baseIndex: ProjectIndexFile,
  existingIndexFileId?: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; index: ProjectIndexFile; indexFileId?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, index: baseIndex, indexFileId: existingIndexFileId };

  try {
    // 1. Listar todas as subpastas dentro de "Encartes Fácil"
    const folderQuery = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const folderUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
      folderQuery
    )}&fields=files(id,name,createdTime,modifiedTime)&pageSize=100&supportsAllDrives=true`;

    const folderRes = await fetchFn(folderUrl, { headers: config.headers });
    if (!folderRes.ok) {
      return { ok: true, index: baseIndex, indexFileId: existingIndexFileId };
    }

    const folderData = await folderRes.json();
    const driveFolders: Array<{ id: string; name: string; createdTime?: string; modifiedTime?: string }> =
      Array.isArray(folderData.files) ? folderData.files : [];

    const existingProjects = [...(baseIndex.projects || [])];
    let hasChanges = false;

    const projectFolderIdMap = new Set<string>();
    const projectIdMap = new Set<string>();
    for (const p of existingProjects) {
      if (p.driveFolderId) projectFolderIdMap.add(p.driveFolderId);
      if (p.id) projectIdMap.add(p.id);
    }

    for (const folder of driveFolders) {
      const nameMatch = folder.name.match(/^(.*?)\s*\[([a-zA-Z0-9_-]+)\]$/);
      const extractedName = nameMatch ? nameMatch[1].trim() : folder.name.trim();
      const extractedId = nameMatch ? nameMatch[2].trim() : undefined;

      // Verifica se o projeto já consta no índice
      const existing = existingProjects.find(
        (p) => p.driveFolderId === folder.id || (extractedId && p.id === extractedId)
      );

      // Se já consta no índice E já tem itemCount > 0 E tem driveFileId, apenas atualiza datas
      if (existing && existing.itemCount > 0 && existing.driveFileId) {
        if (!existing.driveFolderId) {
          existing.driveFolderId = folder.id;
          hasChanges = true;
        }
        if (folder.modifiedTime && (!existing.updatedAt || new Date(folder.modifiedTime) > new Date(existing.updatedAt))) {
          existing.updatedAt = folder.modifiedTime;
          hasChanges = true;
        }
        continue;
      }

      // Descobre arquivos .json ou projetos dentro da pasta (busca ampla com pageSize=100)
      let discoveredFileId: string | undefined;
      let discoveredProjectData: any = null;

      try {
        // 1. Busca prioritária por arquivos .json (pageSize=100)
        const jsonQuery = `'${folder.id}' in parents and (name contains '.json' or mimeType = 'application/json') and trashed = false`;
        const jsonUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
          jsonQuery
        )}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=name+desc&pageSize=100&supportsAllDrives=true`;

        let filesRes = await fetchFn(jsonUrl, { headers: config.headers });
        let filesData = filesRes.ok ? await filesRes.json() : { files: [] };
        let jsonFiles = (filesData.files || []).filter(
          (f: any) =>
            typeof f.name === "string" &&
            (f.name.endsWith(".json") || f.mimeType === "application/json")
        );

        // 2. Se a busca específica por .json não retornou arquivos, faz busca ampla (pageSize=100)
        if (jsonFiles.length === 0) {
          const allQuery = `'${folder.id}' in parents and trashed = false`;
          const allUrl = `${config.baseUrl}/files?q=${encodeURIComponent(
            allQuery
          )}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime+desc&pageSize=100&supportsAllDrives=true`;
          const allRes = await fetchFn(allUrl, { headers: config.headers });
          if (allRes.ok) {
            const allData = await allRes.json();
            jsonFiles = (allData.files || []).filter(
              (f: any) =>
                typeof f.name === "string" &&
                (f.name.endsWith(".json") || f.name.endsWith(".encarte") || f.mimeType === "application/json")
            );
          }
        }

        if (typeof jsonFiles[0]?.id === "string") {
          const fileId: string = jsonFiles[0].id;
          discoveredFileId = fileId;
          try {
            const mediaRes = await fetchFn(
              `${config.baseUrl}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
              { headers: config.headers }
            );
            if (mediaRes.ok) {
              const text = await mediaRes.text();
              const des = deserializeProject(text);
              if (des.ok && des.project) {
                discoveredProjectData = des.project;
              } else {
                try {
                  const raw = JSON.parse(text);
                  discoveredProjectData = raw.project || raw.data || raw;
                } catch {}
              }
            }
          } catch {}
        }
      } catch {}

      const effectiveId =
        discoveredProjectData?.id ||
        extractedId ||
        `drive_folder_${folder.id}`;
      const effectiveName =
        discoveredProjectData?.name ||
        extractedName ||
        folder.name;
      const effectiveVersion =
        Number(discoveredProjectData?.version) || 1;
      const prods =
        discoveredProjectData?.products ||
        discoveredProjectData?.items ||
        discoveredProjectData?.produtos;
      const effectiveItemCount = Array.isArray(prods)
        ? prods.length
        : Number(discoveredProjectData?.itemCount) ||
          Number(discoveredProjectData?.versionHistory?.[0]?.itemCount) ||
          0;
      const effectiveCreatedAt =
        discoveredProjectData?.createdAt ||
        folder.createdTime ||
        folder.modifiedTime ||
        new Date().toISOString();
      const effectiveUpdatedAt =
        discoveredProjectData?.updatedAt ||
        folder.modifiedTime ||
        folder.createdTime ||
        new Date().toISOString();

      // Se o projeto já constava no índice (mas estava com 0 itens ou sem driveFileId), atualiza os dados existentes
      if (existing) {
        if (!existing.driveFolderId) {
          existing.driveFolderId = folder.id;
          hasChanges = true;
        }
        if (effectiveItemCount > 0 && existing.itemCount !== effectiveItemCount) {
          existing.itemCount = effectiveItemCount;
          hasChanges = true;
        }
        if (discoveredFileId && existing.driveFileId !== discoveredFileId) {
          existing.driveFileId = discoveredFileId;
          hasChanges = true;
        }
        if (discoveredProjectData?.version) {
          existing.currentVersion = Number(discoveredProjectData.version);
          hasChanges = true;
        }
        if (discoveredProjectData?.name && discoveredProjectData.name !== folder.name) {
          existing.name = discoveredProjectData.name;
          hasChanges = true;
        }
        continue;
      }

      const newItem: ProjectIndexItem = {
        id: effectiveId,
        name: effectiveName,
        createdAt: effectiveCreatedAt,
        updatedAt: effectiveUpdatedAt,
        currentVersion: effectiveVersion,
        versionCount: (discoveredProjectData?.versionHistory?.length || 0) + 1,
        itemCount: effectiveItemCount,
        sourceType: discoveredProjectData?.source?.type || "manual",
        sourceName: discoveredProjectData?.source?.filename || "Google Drive",
        syncStatus: "synced",
        isTrashed: Boolean(discoveredProjectData?.isTrashed),
        trashedAt: discoveredProjectData?.trashedAt,
        driveFolderId: folder.id,
        driveFileId: discoveredFileId,
      };

      existingProjects.push(newItem);
      projectFolderIdMap.add(folder.id);
      projectIdMap.add(effectiveId);
      hasChanges = true;
    }

    const updatedIndex: ProjectIndexFile = {
      ...baseIndex,
      updatedAt: new Date().toISOString(),
      projects: existingProjects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    };

    let savedIndexFileId = existingIndexFileId;
    if (hasChanges) {
      try {
        const writeRes = await writeDriveIndex(rootFolderId, updatedIndex, existingIndexFileId, options);
        if (writeRes.ok && writeRes.fileId) {
          savedIndexFileId = writeRes.fileId;
        }
      } catch (err) {
        console.warn("Aviso: Falha ao salvar índice reconciliado no Drive:", err);
      }
    }

    return { ok: true, index: updatedIndex, indexFileId: savedIndexFileId };
  } catch (err) {
    console.error("Erro na reconciliação de pastas do Drive:", err);
    return { ok: true, index: baseIndex, indexFileId: existingIndexFileId };
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
    )}&orderBy=modifiedTime+desc&fields=files(id,name,modifiedTime)&pageSize=10&supportsAllDrives=true`;

    const searchRes = await fetchFn(searchUrl, { headers: config.headers });
    if (!searchRes.ok) {
      return { ok: false, error: "Falha ao buscar indice.json no Drive." };
    }

    const data = await searchRes.json();
    let index: ProjectIndexFile = {
      app: "encartes-facil",
      version: 1,
      updatedAt: new Date().toISOString(),
      projects: [],
    };
    let indexFileId: string | undefined;

    if (Array.isArray(data.files) && data.files.length > 0 && data.files[0]?.id) {
      const fileId: string = data.files[0].id;
      indexFileId = fileId;
      try {
        const mediaRes = await fetchFn(
          `${config.baseUrl}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          { headers: config.headers }
        );
        if (mediaRes.ok) {
          const text = await mediaRes.text();
          const parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.projects)) {
            index = parsed;
          }
        }
      } catch (err) {
        console.warn("Aviso ao ler indice.json existente:", err);
      }
    }

    // Reconciliação automática com todas as subpastas da pasta Encartes Fácil
    const reconcileRes = await reconcileDriveIndexWithSubfolders(
      rootFolderId,
      index,
      indexFileId,
      options
    );

    return {
      ok: true,
      index: reconcileRes.index,
      indexFileId: reconcileRes.indexFileId || indexFileId,
    };
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
      driveFileId,
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
 * Localiza e carrega a versão mais recente de um projeto no Google Drive a partir do seu ID.
 */
export async function loadProjectFromDriveById(
  projectId: string,
  driveFolderId?: string,
  options: DriveOpOptions = {}
): Promise<{ ok: boolean; project?: ProjectData; error?: string }> {
  const { token, fetchFn = fetch } = options;
  const config = getDriveRequestConfig(token);
  if (!config) return { ok: false, error: "Sem conexão com o Google Drive." };

  try {
    const rootRes = await getOrCreateRootFolder(options);
    if (!rootRes.ok || !rootRes.folderId) {
      return { ok: false, error: rootRes.error || "Pasta raiz do Drive não acessível." };
    }

    let targetFolderId = driveFolderId;
    let directFileId: string | undefined;

    // 1. Tentar ler do índice do Drive
    const idxRes = await readDriveIndex(rootRes.folderId, options);
    const found = idxRes.ok ? idxRes.index?.projects?.find(p => p.id === projectId) : undefined;
    if (found) {
      if (found) {
        if (found.driveFileId) {
          directFileId = found.driveFileId;
        }
        if (!targetFolderId && found.driveFolderId) {
          targetFolderId = found.driveFolderId;
        }
      }
    }

    // 2. Se temos directFileId, tenta baixar direto
    if (directFileId) {
      const loadRes = await loadProjectFromDrive(directFileId, options);
      if (loadRes.ok && loadRes.project) {
        return loadRes;
      }
    }

    // Se o targetFolderId não foi informado mas o projectId deriva do folderId
    if (!targetFolderId && projectId.startsWith("drive_folder_")) {
      targetFolderId = projectId.replace("drive_folder_", "");
    }

    // 3. Se não temos a pasta do projeto ainda, busca pelo nome no Drive
    if (!targetFolderId) {
      const q = `'${rootRes.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '[${projectId.replace(/'/g, "\\'")}]' and trashed = false`;
      const searchRes = await fetchFn(
        `${config.baseUrl}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`,
        { headers: config.headers }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (Array.isArray(data.files) && data.files.length > 0) {
          targetFolderId = data.files[0]?.id;
        }
      }
    }

    if (!targetFolderId) {
      return { ok: false, error: "Pasta do projeto não encontrada no Google Drive." };
    }

    // 4. Buscar os arquivos JSON de versão dentro da pasta do projeto, ordenados pelo nome desc (projeto-v002 antes de v001)
    const jsonQuery = `'${targetFolderId}' in parents and (name contains '.json' or mimeType = 'application/json') and trashed = false`;
    let filesRes = await fetchFn(
      `${config.baseUrl}/files?q=${encodeURIComponent(jsonQuery)}&orderBy=name+desc&fields=files(id,name,mimeType,modifiedTime)&pageSize=100&supportsAllDrives=true`,
      { headers: config.headers }
    );

    let filesData = filesRes.ok ? await filesRes.json() : { files: [] };
    let jsonFiles = (filesData.files || []).filter((f: any) =>
      typeof f.name === "string" && (f.name.endsWith(".json") || f.mimeType === "application/json")
    );

    // Se a busca específica por .json não encontrou, faz busca ampla por qualquer arquivo na pasta (pageSize=100)
    if (jsonFiles.length === 0) {
      const allQuery = `'${targetFolderId}' in parents and trashed = false`;
      const allRes = await fetchFn(
        `${config.baseUrl}/files?q=${encodeURIComponent(allQuery)}&orderBy=modifiedTime+desc&fields=files(id,name,mimeType,size)&pageSize=100&supportsAllDrives=true`,
        { headers: config.headers }
      );
      if (allRes.ok) {
        const allData = await allRes.json();
        jsonFiles = (allData.files || []).filter((f: any) =>
          typeof f.name === "string" && (f.name.endsWith(".json") || f.name.endsWith(".encarte") || f.mimeType === "application/json")
        );
      }
    }

    if (jsonFiles.length > 0) {
      // O primeiro arquivo é a versão mais recente
      const latestFileId = jsonFiles[0].id;
      return await loadProjectFromDrive(latestFileId, options);
    }

    // 5. Se não tem JSON, verifica se existe planilha (.csv ou .xlsx) na pasta para recuperar os produtos
    try {
      const spreadsheetQuery = `'${targetFolderId}' in parents and (name contains '.csv' or name contains '.xlsx' or mimeType = 'text/csv' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed = false`;
      const sheetRes = await fetchFn(
        `${config.baseUrl}/files?q=${encodeURIComponent(spreadsheetQuery)}&orderBy=modifiedTime+desc&fields=files(id,name,mimeType)&pageSize=5&supportsAllDrives=true`,
        { headers: config.headers }
      );
      if (sheetRes.ok) {
        const sheetData = await sheetRes.json();
        const csvFile = (sheetData.files || [])[0];
        if (csvFile && typeof csvFile.id === "string") {
          const mediaRes = await fetchFn(
            `${config.baseUrl}/files/${encodeURIComponent(csvFile.id)}?alt=media&supportsAllDrives=true`,
            { headers: config.headers }
          );
          if (mediaRes.ok) {
            const buffer = await mediaRes.arrayBuffer();
            const parsed = await parseSpreadsheetFile(new File([buffer], csvFile.name));
            if (parsed.success && parsed.validProducts.length > 0) {
              const recoveredProject: ProjectData = {
                id: projectId,
                name: found?.name || "Encarte Recuperado",
                createdAt: found?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
                source: {
                  type: "spreadsheet",
                  filename: csvFile.name,
                  importedAt: new Date().toISOString(),
                },
                products: parsed.validProducts,
                campaign: DEFAULT_CAMPAIGN,
                store: DEFAULT_STORE,
                versionHistory: [
                  {
                    version: 1,
                    savedAt: new Date().toISOString(),
                    itemCount: parsed.validProducts.length,
                    notes: `Recuperado a partir da planilha ${csvFile.name}`,
                  },
                ],
                driveFolderId: targetFolderId,
              };
              return { ok: true, project: recoveredProject };
            }
          }
        }
      }
    } catch {}

    // 6. Se não encontrou JSON nem planilha na pasta, abre como projeto pronto para edição associado a essa pasta na nuvem
    const fallbackProject: ProjectData = {
      id: projectId,
      name: found?.name || "Encarte",
      createdAt: found?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      source: { type: "manual" },
      products: [],
      campaign: DEFAULT_CAMPAIGN,
      store: DEFAULT_STORE,
      versionHistory: [
        {
          version: 1,
          savedAt: new Date().toISOString(),
          itemCount: 0,
          notes: "Projeto aberto a partir da pasta na nuvem",
        },
      ],
      driveFolderId: targetFolderId,
    };
    return { ok: true, project: fallbackProject };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao carregar projeto do Drive",
    };
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
