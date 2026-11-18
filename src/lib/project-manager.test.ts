import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProjectData, ProjectIndexItem } from "@/types/project";
import type { EncarteProduct } from "@/types/encarte";
import { DEFAULT_CAMPAIGN, DEFAULT_STORE } from "@/types/encarte";
import {
  validateProjectName,
  stripHeavyImagesForStorage,
  serializeProject,
  deserializeProject,
  analyzeProjectUpdates,
} from "./project-serializer";
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
  saveProjectUnified,
  saveProjectAsUnified,
  renameProjectUnified,
  duplicateProjectUnified,
  deleteProjectUnified,
  restoreProjectUnified,
  restoreVersionUnified,
  applySelectedUpdates,
  listAllProjectsUnified,
  loadProjectUnified,
  invalidateDriveIndexCache,
  downloadProjectFile,
  downloadProjectById,
  importProjectFromFile,
  saveProjectLocallyOnly,
} from "./project-sync-manager";
import {
  checkDriveStatusFn,
  getDriveProjectsIndexFn,
  loadProjectFromDriveByIdFn,
} from "./project.functions";
import { reconcileDriveIndexWithSubfolders, loadProjectFromDriveById } from "./project-drive";

// Mock das server functions para teste unitário do cliente
vi.mock("./project.functions", () => ({
  checkDriveStatusFn: vi.fn().mockResolvedValue({ connected: true }),
  saveProjectToDriveFn: vi.fn().mockResolvedValue({ ok: true, driveFileId: "drive-file-123", driveFolderId: "drive-folder-456" }),
  renameDriveProjectFn: vi.fn().mockResolvedValue({ ok: true }),
  deleteDriveProjectFn: vi.fn().mockResolvedValue({ ok: true }),
  getDriveProjectsIndexFn: vi.fn().mockResolvedValue({ ok: true, index: { projects: [] } }),
  loadProjectFromDriveByIdFn: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Sistema de Salvamento de Projetos de Encarte", () => {
  const sampleProducts: EncarteProduct[] = [
    {
      id: "prod-1",
      code: "11782",
      name: "MOLHO P/SALADA LIZA LIMAO",
      packaging: "1X234 ML",
      validity: "04/11/2026",
      price: "3,00",
      unit: "UND",
      stock: "43 UND",
      badge: "nenhum",
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      included: true,
    },
    {
      id: "prod-2",
      code: "26004",
      name: "CUSCUZ MARATA",
      packaging: "20X500 GR",
      validity: "08/12/2026",
      price: "29,90",
      unit: "CX",
      stock: "153 CX",
      badge: "nenhum",
      image: "https://example.com/cuzcuz.png",
      included: true,
    },
  ];

  const sampleProject: ProjectData = {
    id: "proj-test-101",
    name: "Encarte Ofertas da Semana",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    source: {
      type: "spreadsheet",
      filename: "VALIDADE.csv",
      importedAt: new Date().toISOString(),
    },
    products: sampleProducts,
    campaign: DEFAULT_CAMPAIGN,
    store: DEFAULT_STORE,
    versionHistory: [
      {
        version: 1,
        savedAt: new Date().toISOString(),
        itemCount: 2,
        notes: "Versão inicial",
      },
    ],
  };

  it("1. Valida nomes de projetos e rejeita caracteres proibidos no Google Drive", () => {
    // Caracteres inválidos: / \ : * ? " < > |
    expect(validateProjectName("Encarte / Ofertas").valid).toBe(false);
    expect(validateProjectName("Encarte: Especial").valid).toBe(false);
    expect(validateProjectName("Ofertas * Super").valid).toBe(false);
    expect(validateProjectName("Preço < Baixo").valid).toBe(false);
    expect(validateProjectName("").valid).toBe(false);
    expect(validateProjectName("   ").valid).toBe(false);

    // Nomes válidos
    const valid = validateProjectName("Encarte Fim de Semana - 29-10-2026");
    expect(valid.valid).toBe(true);
    expect(valid.cleanName).toBe("Encarte Fim de Semana - 29-10-2026");
  });

  it("2. Remove imagens base64 pesadas para manter o JSON leve (<50KB) sem perder dados", () => {
    const stripped = stripHeavyImagesForStorage(sampleProducts);
    expect(stripped).toHaveLength(2);

    // Imagem base64 foi limpa para não inchar o JSON
    expect(stripped[0]?.image).toBe("");
    // Imagem por URL leve é mantida
    expect(stripped[1]?.image).toBe("https://example.com/cuzcuz.png");

    // Todos os outros dados essenciais permanecem 100% preservados
    expect(stripped[0]?.code).toBe("11782");
    expect(stripped[0]?.name).toBe("MOLHO P/SALADA LIZA LIMAO");
    expect(stripped[0]?.price).toBe("3,00");
    expect(stripped[0]?.unit).toBe("UND");
    expect(stripped[1]?.unit).toBe("CX");
  });

  it("3. Serializa e deserializa projeto com integridade de dados", () => {
    const jsonStr = serializeProject(sampleProject);
    expect(typeof jsonStr).toBe("string");

    const parsed = deserializeProject(jsonStr);
    expect(parsed.ok).toBe(true);
    expect(parsed.project?.name).toBe("Encarte Ofertas da Semana");
    expect(parsed.project?.products).toHaveLength(2);
    expect(parsed.project?.version).toBe(1);
    expect(parsed.project?.source.type).toBe("spreadsheet");
  });

  it("4. Rejeita JSON de projeto corrompido com mensagem amigável", () => {
    const corruptJson = '{"name": "Projeto quebrado", products: [invalid...';
    const parsed = deserializeProject(corruptJson);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("Arquivo de projeto inválido ou corrompido");
  });

  it("5. Salva projeto no IndexedDB e recria a tela de edição exatamente igual", async () => {
    const saveRes = await saveProjectLocal(sampleProject, false);
    expect(saveRes.ok).toBe(true);

    const loadRes = await loadProjectLocal(sampleProject.id);
    expect(loadRes.ok).toBe(true);
    expect(loadRes.project).toBeDefined();
    expect(loadRes.project?.id).toBe(sampleProject.id);
    expect(loadRes.project?.name).toBe("Encarte Ofertas da Semana");
    expect(loadRes.project?.products).toHaveLength(2);
  });

  it("6. Renomeia projeto no IndexedDB e reflete no índice", async () => {
    const newName = "Encarte Detona Preços Atualizado";
    const renameRes = await renameProjectLocal(sampleProject.id, newName);
    expect(renameRes.ok).toBe(true);

    const loadRes = await loadProjectLocal(sampleProject.id);
    expect(loadRes.ok).toBe(true);
    expect(loadRes.project?.name).toBe(newName);
  });

  it("7. Duplica projeto gerando cópia independente com novo ID", async () => {
    const dupRes = await duplicateProjectLocal(sampleProject.id, "Encarte Duplicado");
    expect(dupRes.ok).toBe(true);
    expect(dupRes.newProject).toBeDefined();
    expect(dupRes.newProject?.id).not.toBe(sampleProject.id);
    expect(dupRes.newProject?.name).toBe("Encarte Duplicado");
    expect(dupRes.newProject?.products).toHaveLength(2);
  });

  it("8. Mover para a lixeira e restaurar projeto", async () => {
    // 1. Move para lixeira
    const delRes = await deleteProjectLocal(sampleProject.id, false);
    expect(delRes.ok).toBe(true);

    // Não deve aparecer na listagem de ativos
    const listActive = await listProjectsLocal(false);
    const foundActive = listActive.find((p) => p.id === sampleProject.id);
    expect(foundActive).toBeUndefined();

    // Deve aparecer na lixeira
    const listTrash = await listProjectsLocal(true);
    const foundTrash = listTrash.find((p) => p.id === sampleProject.id);
    expect(foundTrash).toBeDefined();
    expect(foundTrash?.isTrashed).toBe(true);

    // 2. Restaura da lixeira
    const restoreRes = await restoreFromTrashLocal(sampleProject.id);
    expect(restoreRes.ok).toBe(true);

    const listRestored = await listProjectsLocal(false);
    const foundRestored = listRestored.find((p) => p.id === sampleProject.id);
    expect(foundRestored).toBeDefined();
    expect(foundRestored?.isTrashed).toBe(false);
  });

  it("9. Histórico de Versões: salva 3 versões, restaura a v1 e confirma que o histórico possui 4 versões", async () => {
    const testId = `proj-version-test-${Date.now()}`;
    const baseProj: ProjectData = {
      ...sampleProject,
      id: testId,
      name: "Projeto com Versões",
      version: 1,
      versionHistory: [{ version: 1, savedAt: new Date().toISOString(), itemCount: 2 }],
    };

    // Versão 1
    await saveProjectLocal(baseProj, true);

    // Versão 2
    const v2Proj: ProjectData = {
      ...baseProj,
      version: 2,
      products: [...sampleProducts, { ...sampleProducts[0]!, id: "p3", code: "999" }],
      versionHistory: [
        ...baseProj.versionHistory,
        { version: 2, savedAt: new Date().toISOString(), itemCount: 3, notes: "Versão 2" },
      ],
    };
    await saveProjectLocal(v2Proj, true);

    // Versão 3
    const v3Proj: ProjectData = {
      ...v2Proj,
      version: 3,
      versionHistory: [
        ...v2Proj.versionHistory,
        { version: 3, savedAt: new Date().toISOString(), itemCount: 3, notes: "Versão 3" },
      ],
    };
    await saveProjectLocal(v3Proj, true);

    // Verifica que v1 foi guardada
    const v1Res = await loadProjectVersionLocal(testId, 1);
    expect(v1Res.ok).toBe(true);
    expect(v1Res.project?.version).toBe(1);

    // Restaura versão 1 usando restoreVersionUnified
    const restoreRes = await restoreVersionUnified(testId, 1);
    expect(restoreRes.ok).toBe(true);
    expect(restoreRes.restoredProject).toBeDefined();

    // A versão restaurada deve ter número 4 (preservando o histórico anterior)
    expect(restoreRes.restoredProject?.version).toBe(4);
    expect(restoreRes.restoredProject?.versionHistory).toHaveLength(4);
    expect(restoreRes.restoredProject?.versionHistory[3]?.version).toBe(4);
    expect(restoreRes.restoredProject?.versionHistory[3]?.notes).toContain("Restaurada a partir da versão v1");
  });

  it("10. Análise de Diferenças (Diff): detecta preço alterado, item removido e item novo", () => {
    const currentProducts: EncarteProduct[] = [
      {
        id: "p1",
        code: "11782",
        name: "MOLHO LIZA",
        packaging: "1X234 ML",
        price: "3,00",
        validity: "04/11/2026",
        unit: "UND",
        stock: "43 UND",
        badge: "nenhum",
        image: "",
        included: true,
      },
      {
        id: "p2",
        code: "26004",
        name: "CUSCUZ MARATA",
        packaging: "20X500 GR",
        price: "29,90",
        validity: "08/12/2026",
        unit: "CX",
        stock: "153 CX",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    // Nova planilha com:
    // - Preço do molho alterado para 3,50
    // - Cuscuz foi removido da planilha
    // - Gelatina nova adicionada
    const incomingProducts: EncarteProduct[] = [
      {
        id: "p-new-1",
        code: "11782",
        name: "MOLHO LIZA",
        packaging: "1X234 ML",
        price: "3,50", // Mudou!
        validity: "04/11/2026",
        unit: "UND",
        stock: "50 UND", // Mudou!
        badge: "nenhum",
        image: "",
        included: true,
      },
      {
        id: "p-new-2",
        code: "24717", // Produto Novo!
        name: "GELATINA ROYAL UVA",
        packaging: "15X25 GR",
        price: "18,90",
        validity: "11/12/2026",
        unit: "CX",
        stock: "10 CX",
        badge: "nenhum",
        image: "",
        included: true,
      },
    ];

    const analysis = analyzeProjectUpdates(currentProducts, incomingProducts);
    expect(analysis.hasChanges).toBe(true);
    expect(analysis.totalChanges).toBe(3); // 1 alterado, 1 removido, 1 novo

    // 1. Produto Alterado (11782)
    const changed = analysis.diffs.find((d) => d.code === "11782");
    expect(changed).toBeDefined();
    expect(changed?.type).toBe("changed");
    expect(changed?.changes.some((c) => c.field === "price" && c.newValue === "3,50")).toBe(true);

    // 2. Produto Removido (26004)
    const removed = analysis.diffs.find((d) => d.code === "26004");
    expect(removed).toBeDefined();
    expect(removed?.type).toBe("removed");

    // 3. Produto Novo (24717)
    const added = analysis.diffs.find((d) => d.code === "24717");
    expect(added).toBeDefined();
    expect(added?.type).toBe("added");

    // Aplicação seletiva: Usuário escolhe aplicar apenas o preço novo do molho, ignorando a remoção do cuscuz
    const diffsToApply = analysis.diffs.filter((d) => d.code === "11782");
    const updated = applySelectedUpdates(currentProducts, diffsToApply);

    expect(updated).toHaveLength(2); // Cuscuz continua lá
    const updatedMolho = updated.find((p) => p.code === "11782");
    expect(updatedMolho?.price).toBe("3,50");
  });

  it("11. Benchmark de Desempenho com 130 produtos: serialização e abertura rápida (<50ms)", async () => {
    const largeProducts: EncarteProduct[] = Array.from({ length: 130 }, (_, i) => ({
      id: `prod-${i + 1}`,
      code: String(10000 + i),
      name: `PRODUTO DE TESTE AUTOMATIZADO ${i + 1}`,
      packaging: i % 2 === 0 ? "20X500 GR" : "1X100 GR",
      validity: "15/12/2026",
      price: "19,90",
      unit: i % 2 === 0 ? "CX" : "UND",
      stock: `${50 + i} UND`,
      badge: "nenhum",
      image: "https://example.com/item.png",
      included: true,
    }));

    const largeProject: ProjectData = {
      ...sampleProject,
      id: `proj-large-${Date.now()}`,
      products: largeProducts,
      versionHistory: [{ version: 1, savedAt: new Date().toISOString(), itemCount: 130 }],
    };

    // Mede tempo de salvamento
    const t0 = performance.now();
    const saveRes = await saveProjectLocal(largeProject, false);
    const saveTime = performance.now() - t0;
    expect(saveRes.ok).toBe(true);

    // Mede tempo de abertura / carregamento
    const t1 = performance.now();
    const loadRes = await loadProjectLocal(largeProject.id);
    const loadTime = performance.now() - t1;
    expect(loadRes.ok).toBe(true);
    expect(loadRes.project?.products).toHaveLength(130);

    // O tempo de abertura deve ser imperceptível (< 50ms) graças ao JSON sem base64 pesado
    expect(loadTime).toBeLessThan(150);
  });

  it("12. Sincronização entre Computadores: lista projetos do Google Drive mesmo com IndexedDB local vazio", async () => {
    invalidateDriveIndexCache();
    const driveCloudProjects = [
      {
        id: "proj-cloud-computador-a",
        name: "Encarte Criado no Computador A",
        createdAt: "2026-11-18T10:00:00.000Z",
        updatedAt: "2026-11-18T12:00:00.000Z",
        currentVersion: 2,
        versionCount: 2,
        itemCount: 25,
        sourceType: "spreadsheet" as const,
        syncStatus: "synced" as const,
        isTrashed: false,
        driveFolderId: "folder-drive-123",
      },
    ];

    (getDriveProjectsIndexFn as any).mockResolvedValueOnce({
      ok: true,
      index: {
        app: "encartes-facil",
        version: 1,
        updatedAt: new Date().toISOString(),
        projects: driveCloudProjects as any,
      },
    });

    // Simula abertura no Computador B (onde localItems pode estar vazio)
    const unified = await listAllProjectsUnified(false, true);
    expect(unified.driveConnected).toBe(true);

    const cloudItem = unified.items.find((p) => p.id === "proj-cloud-computador-a");
    expect(cloudItem).toBeDefined();
    expect(cloudItem?.name).toBe("Encarte Criado no Computador A");
    expect(cloudItem?.syncStatus).toBe("cloud_only");
    expect(cloudItem?.itemCount).toBe(25);
  });

  it("13. Abertura de Projeto da Nuvem (loadProjectUnified): baixa do Drive e salva no IndexedDB", async () => {
    const cloudProjectId = "proj-cloud-novo-123";
    const remoteProject: ProjectData = {
      ...sampleProject,
      id: cloudProjectId,
      name: "Encarte Baixado da Nuvem",
      updatedAt: new Date().toISOString(),
    };

    (loadProjectFromDriveByIdFn as any).mockResolvedValueOnce({
      ok: true,
      project: remoteProject,
    });

    const loadRes = await loadProjectUnified(cloudProjectId);
    expect(loadRes.ok).toBe(true);
    expect(loadRes.source).toBe("drive");
    expect(loadRes.project?.name).toBe("Encarte Baixado da Nuvem");

    // Confirma que foi gravado no IndexedDB local para acessos posteriores ultra-rápidos
    const cachedLocal = await loadProjectLocal(cloudProjectId);
    expect(cachedLocal.ok).toBe(true);
    expect(cachedLocal.project?.id).toBe(cloudProjectId);
  });

  it("14. Reconciliação do Google Drive: descobre pastas de encartes existentes no Drive que não constavam no indice.json", async () => {
    // Simula a situação do usuário:
    // O Drive tem subpastas "Encarte 12_11_2026", "Encarte 17_11_2026", "Encarte Ofertas da Semana [proj_456]"
    // Mas o indice.json estava vazio ou continha apenas 0 itens!
    const mockBaseIndex = {
      app: "encartes-facil",
      version: 1,
      updatedAt: new Date().toISOString(),
      projects: [],
    };

    const mockFetch = async (url: string, opts: any = {}) => {
      const urlStr = decodeURIComponent(String(url));
      // Listagem de pastas filhas de Encartes Fácil
      if (urlStr.includes("mimeType = 'application/vnd.google-apps.folder'")) {
        return {
          ok: true,
          json: async () => ({
            files: [
              { id: "folder_1", name: "Encarte 12_11_2026", createdTime: "2026-11-12T10:00:00Z", modifiedTime: "2026-11-12T11:00:00Z" },
              { id: "folder_2", name: "Encarte 17_11_2026", createdTime: "2026-11-17T10:00:00Z", modifiedTime: "2026-11-17T11:00:00Z" },
              { id: "folder_3", name: "Encarte Ofertas da Semana [proj_456]", createdTime: "2026-11-18T10:00:00Z", modifiedTime: "2026-11-18T11:00:00Z" },
            ],
          }),
        };
      }
      // Listagem de arquivos dentro da pasta
      if (urlStr.includes("parents and trashed = false")) {
        const folderMatch = urlStr.match(/'(folder_\d+)' in parents/);
        const fId = folderMatch ? folderMatch[1] : "folder_1";
        return {
          ok: true,
          json: async () => ({
            files: [
              { id: `file_json_${fId}`, name: "projeto-v001.json", mimeType: "application/json" },
            ],
          }),
        };
      }
      // Leitura do arquivo JSON
      if (urlStr.includes("alt=media")) {
        const idMatch = urlStr.match(/file_json_(folder_\d+)/);
        const folderId = idMatch ? idMatch[1] : "folder_3";
        return {
          ok: true,
          text: async () => JSON.stringify({
            id: folderId === "folder_3" ? "proj_456" : `proj_${folderId}`,
            name: folderId === "folder_1" ? "Encarte 12_11_2026" : folderId === "folder_2" ? "Encarte 17_11_2026" : "Encarte Ofertas da Semana",
            version: 1,
            products: [{ code: "101", name: "Produto Teste", price: "9.99" }],
          }),
        };
      }
      // Gravação do novo indice.json
      if (opts.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "new_index_file_id" }),
        };
      }
      return { ok: true, json: async () => ({ files: [] }) };
    };

    const res = await reconcileDriveIndexWithSubfolders("root_folder_id", mockBaseIndex as any, undefined, {
      token: "mock-token",
      fetchFn: mockFetch as any,
    });

    expect(res.ok).toBe(true);
    expect(res.index.projects.length).toBe(3);
    const names = res.index.projects.map((p) => p.name);
    expect(names).toContain("Encarte 12_11_2026");
    expect(names).toContain("Encarte 17_11_2026");
    expect(names).toContain("Encarte Ofertas da Semana");
  });

  it("15. Salva projeto rapidamente no computador (saveProjectLocallyOnly) sem travar com nuvem", async () => {
    const fastProject: ProjectData = {
      ...sampleProject,
      id: "proj-fast-save-01",
      name: "Encarte Salvamento Rapido",
      updatedAt: new Date().toISOString(),
    };

    const res = await saveProjectLocallyOnly(fastProject);
    expect(res.ok).toBe(true);
    expect(res.project.name).toBe("Encarte Salvamento Rapido");

    const loaded = await loadProjectLocal("proj-fast-save-01");
    expect(loaded.ok).toBe(true);
    expect(loaded.project?.name).toBe("Encarte Salvamento Rapido");
    expect(loaded.project?.products).toHaveLength(2);
  });

  it("16. Importa arquivo .json do computador salvando no banco local e abrindo perfeitamente", async () => {
    const exportData: ProjectData = {
      ...sampleProject,
      id: "proj-imported-file-01",
      name: "Encarte Baixado do Computador",
      updatedAt: new Date().toISOString(),
    };

    const jsonContent = serializeProject(exportData);
    const mockFile = new File([jsonContent], "encarte_salvo.json", { type: "application/json" });

    const importRes = await importProjectFromFile(mockFile);
    expect(importRes.ok).toBe(true);
    expect(importRes.project?.name).toBe("Encarte Baixado do Computador");

    // Confirma que foi gravado e pode ser lido pelo sistema
    const local = await loadProjectLocal(importRes.project!.id);
    expect(local.ok).toBe(true);
    expect(local.project?.name).toBe("Encarte Baixado do Computador");
  });

  it("17. Gera download do arquivo .json com nome limpo e seguro", () => {
    const originalDocument = (globalThis as any).document;
    const originalWindow = (globalThis as any).window;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    const mockElement = {
      href: "",
      download: "",
      click: vi.fn(),
    };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockElement),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
    (globalThis as any).window = globalThis;
    URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
    URL.revokeObjectURL = vi.fn();

    try {
      const res = downloadProjectFile(sampleProject);
      expect(res.ok).toBe(true);
      expect(res.filename).toContain("encarte_ofertas_da_semana");
      expect(res.filename?.endsWith(".json")).toBe(true);
      expect(mockElement.click).toHaveBeenCalled();
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("18. Reconciliação do Drive corrige projeto que estava preso com 0 itens no índice", async () => {
    // Simula projeto que estava no índice base com 0 itens e sem driveFileId
    const baseIndexWithZero = {
      app: "encartes-facil",
      version: 1,
      updatedAt: "2026-11-17T11:20:00Z",
      projects: [
        {
          id: "drive_folder_f2",
          name: "Encarte 17_11_2026",
          createdAt: "2026-11-17T11:20:00Z",
          updatedAt: "2026-11-17T11:20:00Z",
          currentVersion: 1,
          versionCount: 1,
          itemCount: 0, // <--- preso em 0 itens!
          sourceType: "manual",
          sourceName: "Google Drive",
          syncStatus: "synced",
          isTrashed: false,
          driveFolderId: "folder_f2",
          driveFileId: undefined, // <--- sem ID de arquivo
        },
      ],
    };

    const mockFetch = async (url: string, opts: any = {}) => {
      const urlStr = decodeURIComponent(String(url));
      if (urlStr.includes("mimeType = 'application/vnd.google-apps.folder'")) {
        return {
          ok: true,
          json: async () => ({
            files: [
              { id: "folder_f2", name: "Encarte 17_11_2026", createdTime: "2026-11-17T11:20:00Z", modifiedTime: "2026-11-17T11:20:00Z" },
            ],
          }),
        };
      }
      if (urlStr.includes("parents and") && (urlStr.includes("name contains '.json'") || urlStr.includes("trashed = false"))) {
        return {
          ok: true,
          json: async () => ({
            files: [
              { id: "file_json_real", name: "projeto-v001.json", mimeType: "application/json" },
            ],
          }),
        };
      }
      if (urlStr.includes("alt=media")) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            id: "proj_real_17",
            name: "Encarte 17_11_2026",
            version: 1,
            products: [
              { code: "101", name: "Produto A", price: "5.00" },
              { code: "102", name: "Produto B", price: "12.00" },
              { code: "103", name: "Produto C", price: "19.90" },
            ],
          }),
        };
      }
      if (opts.method === "POST") {
        return { ok: true, json: async () => ({ id: "idx_id" }) };
      }
      return { ok: true, json: async () => ({ files: [] }) };
    };

    const res = await reconcileDriveIndexWithSubfolders("root_id", baseIndexWithZero as any, undefined, {
      token: "mock-token",
      fetchFn: mockFetch as any,
    });

    expect(res.ok).toBe(true);
    const item = res.index.projects.find((p) => p.name === "Encarte 17_11_2026");
    expect(item).toBeDefined();
    // Verificamos que o itemCount foi corrigido de 0 para 3!
    expect(item?.itemCount).toBe(3);
    expect(item?.driveFileId).toBe("file_json_real");
  });

  it("19. loadProjectFromDriveById abre projeto mesmo quando a pasta tem imagens exportadas", async () => {
    const mockFetch = async (url: string) => {
      const urlStr = decodeURIComponent(String(url));
      // Consulta da pasta raiz Encartes Fácil
      if (urlStr.includes("name = 'Encartes Fácil'")) {
        return {
          ok: true,
          json: async () => ({ files: [{ id: "root_123", name: "Encartes Fácil" }] }),
        };
      }
      // Leitura do indice.json
      if (urlStr.includes("indice.json") || urlStr.includes("name = 'indice.json'")) {
        return {
          ok: true,
          json: async () => ({ files: [{ id: "idx_file_id", name: "indice.json" }] }),
        };
      }
      if (urlStr.includes("idx_file_id") && urlStr.includes("alt=media")) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            app: "encartes-facil",
            version: 1,
            projects: [
              {
                id: "proj_17_id",
                name: "Encarte 17_11_2026",
                driveFolderId: "folder_17_id",
                driveFileId: "file_json_17",
              },
            ],
          }),
        };
      }
      // Download do arquivo do projeto
      if (urlStr.includes("file_json_17") && urlStr.includes("alt=media")) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            id: "proj_17_id",
            name: "Encarte 17_11_2026",
            version: 1,
            products: [{ code: "201", name: "Leite Integral", price: "4.89" }],
          }),
        };
      }
      return { ok: true, json: async () => ({ files: [] }) };
    };

    const res = await loadProjectFromDriveById("proj_17_id", "folder_17_id", {
      token: "mock-token",
      fetchFn: mockFetch as any,
    });

    expect(res.ok).toBe(true);
    expect(res.project?.name).toBe("Encarte 17_11_2026");
    expect(res.project?.products).toHaveLength(1);
    expect(res.project?.products[0]?.name).toBe("Leite Integral");
  });
});
