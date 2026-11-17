import { describe, it, expect, beforeEach } from "vitest";
import {
  createSnapshotFromRaw,
  getActiveSnapshot,
  loadSnapshotsList,
  setActiveSnapshotId,
  refreshEncartePinsOnActiveSnapshot,
  getActiveEncarteProductCodes,
  getStorage,
  MAX_SNAPSHOTS,
  SNAPSHOTS_STORAGE_KEY,
} from "./painel-validade-storage";
import type { ValidadeLoteRaw } from "@/types/painel-validade";

describe("Painel de Validade - Gerenciador de Snapshots e Storage", () => {
  beforeEach(() => {
    getStorage().clear();
  });

  const mockRawLotes: ValidadeLoteRaw[] = [
    {
      codprod: "101",
      descricao: "BATATA PALHA",
      embalagem: "UN",
      dtval: "20/11/2026",
      qtdisp_wms: 36,
      preco_venda: 4.5,
      qtvendmes: 2,
      qtvendmes1: 12,
      qtvendmes2: 12,
      qtvendmes3: 12,
    },
    {
      codprod: "102",
      descricao: "BISCOITO RECHEADO",
      embalagem: "UN",
      dtval: "25/11/2026",
      qtdisp_wms: 50,
      preco_venda: 3.0,
      qtvendmes: 5,
      qtvendmes1: 20,
      qtvendmes2: 20,
      qtvendmes3: 20,
    },
  ];

  it("cria snapshot com metadados e calcula os lotes", () => {
    const snap = createSnapshotFromRaw(
      mockRawLotes,
      "relatorio-wms-17-11.csv",
      "Carlos Comprador",
      new Date("2026-11-17T12:00:00")
    );

    expect(snap.id).toBeDefined();
    expect(snap.nomeArquivo).toBe("relatorio-wms-17-11.csv");
    expect(snap.importadoPor).toBe("Carlos Comprador");
    expect(snap.totalLotes).toBe(2);
    expect(snap.totalProdutosUnicos).toBe(2);
    expect(snap.lotes.length).toBe(2);

    const active = getActiveSnapshot();
    expect(active?.id).toBe(snap.id);
  });

  it("limita o histórico de snapshots aos últimos 10 (MAX_SNAPSHOTS)", () => {
    for (let i = 0; i < 15; i++) {
      createSnapshotFromRaw(
        mockRawLotes,
        `relatorio_${i}.csv`,
        `Autor ${i}`
      );
    }

    const all = loadSnapshotsList();
    expect(all.length).toBe(MAX_SNAPSHOTS);
    expect(all[0].nomeArquivo).toBe("relatorio_14.csv"); // Mais recente no topo
  });

  it("permite reverter para snapshot anterior escolhendo o active ID", () => {
    const snap1 = createSnapshotFromRaw(mockRawLotes, "snap1.csv");
    const snap2 = createSnapshotFromRaw(mockRawLotes, "snap2.csv");

    expect(getActiveSnapshot()?.id).toBe(snap2.id);

    setActiveSnapshotId(snap1.id);
    expect(getActiveSnapshot()?.id).toBe(snap1.id);
  });

  it("lê produtos ativos do encarte e atualiza pino NO ENCARTE", () => {
    // Simula produtos no encarte ativo em localStorage
    const encarteProducts = [
      { id: "1", code: "101", included: true },
      { id: "2", code: "999", included: true },
      { id: "3", code: "102", included: false }, // Não incluído
    ];
    getStorage().setItem("encarte-products-v2", JSON.stringify(encarteProducts));

    const codes = getActiveEncarteProductCodes();
    expect(codes.has("101")).toBe(true);
    expect(codes.has("999")).toBe(true);
    expect(codes.has("102")).toBe(false);

    // Cria snapshot: 101 deve ter noEncarte = true, 102 = false
    const snap = createSnapshotFromRaw(mockRawLotes, "test.csv");
    const lote101 = snap.lotes.find((l) => l.codprod === "101");
    const lote102 = snap.lotes.find((l) => l.codprod === "102");

    expect(lote101?.noEncarte).toBe(true);
    expect(lote102?.noEncarte).toBe(false);

    // Agora inclui 102 no encarte e atualiza
    encarteProducts[2].included = true;
    getStorage().setItem("encarte-products-v2", JSON.stringify(encarteProducts));

    const updated = refreshEncartePinsOnActiveSnapshot();
    const updated102 = updated?.lotes.find((l) => l.codprod === "102");
    expect(updated102?.noEncarte).toBe(true);
  });
});
