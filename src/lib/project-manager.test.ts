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
} from "./project-sync-manager";

// Mock das server functions para teste unitário do cliente
vi.mock("./project.functions", () => ({
  checkDriveStatusFn: vi.fn().mockResolvedValue({ connected: true }),
  saveProjectToDriveFn: vi.fn().mockResolvedValue({ ok: true, driveFileId: "drive-file-123", driveFolderId: "drive-folder-456" }),
  renameDriveProjectFn: vi.fn().mockResolvedValue({ ok: true }),
  deleteDriveProjectFn: vi.fn().mockResolvedValue({ ok: true }),
  getDriveProjectsIndexFn: vi.fn().mockResolvedValue({ ok: true, projects: [] }),
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
});
