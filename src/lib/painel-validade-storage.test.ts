import { describe, it, expect, beforeEach } from "vitest";
import {
  createSnapshotFromRaw,
  getActiveSnapshot,
  loadSnapshotsList,
  setActiveSnapshotId,
  refreshEncartePinsOnActiveSnapshot,
  getActiveEncarteProductCodes,
  getActiveEncarteInfo,
  getActiveEncartePhotoMap,
  saveLastProjectEncarteCache,
  syncLastEncarteData,
  addLoteToEncarte,
  removeLoteFromEncarte,
  getStorage,
  MAX_SNAPSHOTS,
  SNAPSHOTS_STORAGE_KEY,
} from "./painel-validade-storage";
import {
  normalizeProductCode,
  resolverFotoProduto,
} from "./painel-validade-analytics";
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

  it("considera o último encarte feito mesmo com zeros à esquerda no código e recupera foto", () => {
    // Encarte tem código sem zero à esquerda mas com foto vinculada
    const encarteProducts = [
      {
        id: "p-22743",
        code: "22743",
        name: "MARIA MOLE CHOCOLATE APTI",
        image: "https://minha-loja.com/fotos/22743.png",
        included: true,
      },
    ];
    getStorage().setItem("encarte-products-v2", JSON.stringify(encarteProducts));

    // Planilha traz o produto como "022743" (com zero à esquerda)
    const rawComZeros: ValidadeLoteRaw[] = [
      {
        codprod: "022743",
        descricao: "MARIA MOLE CHOCOLATE APTI",
        embalagem: "1X50 GR",
        dtval: "30/11/2026",
        qtdisp_wms: 17,
        preco_venda: 1.67,
      },
    ];

    const snap = createSnapshotFromRaw(rawComZeros, "teste-zeros.csv");
    const lote = snap.lotes[0];

    // Deve reconhecer presença no último encarte feito e puxar a foto vinculada
    expect(lote.noEncarte).toBe(true);
    expect(lote.foto).toBe("https://minha-loja.com/fotos/22743.png");
  });

  it("considera o último projeto salvo em cache quando encarte-products-v2 estiver vazio", () => {
    // Sem nada em encarte-products-v2
    getStorage().removeItem("encarte-products-v2");

    // Salva o último projeto no cache
    saveLastProjectEncarteCache({
      id: "proj-123",
      name: "Encarte Semanal 46",
      products: [
        {
          code: "101",
          name: "BATATA PALHA",
          image: "data:image/jpeg;base64,mockBatata",
          included: true,
        },
      ],
    });

    const info = getActiveEncarteInfo();
    expect(info.codes.has("101")).toBe(true);
    expect(info.photoByCode.get("101")).toBe("data:image/jpeg;base64,mockBatata");
    expect(info.sourceEncarteName).toBe("Encarte Semanal 46");

    const snap = createSnapshotFromRaw(mockRawLotes, "teste-cache.csv");
    const lote101 = snap.lotes.find((l) => l.codprod === "101");
    expect(lote101?.noEncarte).toBe(true);
    expect(lote101?.foto).toBe("data:image/jpeg;base64,mockBatata");
  });

  it("puxa fallback de foto do Cescom AgileCDN se o produto não estiver no encarte nem no drive", () => {
    // Produto 11782 não está no encarte
    getStorage().clear();
    const foto = resolverFotoProduto("11782");
    expect(foto).toBe("https://cescom.agilecdn.com.br/11782_thumb_1.jpg");
  });

  it("adiciona lote ao encarte mais recente com 1 clique e atualiza pino e snapshot", () => {
    // 1. Cria snapshot inicial onde o produto 101 não está no encarte
    getStorage().clear();
    const snap = createSnapshotFromRaw(mockRawLotes, "validade.csv");
    const lote101 = snap.lotes.find((l) => l.codprod === "101")!;
    expect(lote101.noEncarte).toBe(false);

    // 2. Executa addLoteToEncarte
    const res = addLoteToEncarte(lote101);
    expect(res.ok).toBe(true);
    expect(res.action).toBe("added");
    expect(res.productCode).toBe("101");

    // 3. Verifica se encarte-products-v2 foi populado corretamente
    const rawEncarte = getStorage().getItem("encarte-products-v2");
    expect(rawEncarte).toBeDefined();
    const encarteProducts = JSON.parse(rawEncarte!);
    expect(encarteProducts.length).toBe(1);
    expect(encarteProducts[0].code).toBe("101");
    expect(encarteProducts[0].name).toBe("BATATA PALHA");
    expect(encarteProducts[0].price).toBe("4,50");
    expect(encarteProducts[0].validity).toBe("20/11/2026");
    expect(encarteProducts[0].included).toBe(true);

    // 4. Snapshot ativo foi atualizado imediatamente para noEncarte = true
    const active = getActiveSnapshot()!;
    const updated101 = active.lotes.find((l) => l.codprod === "101")!;
    expect(updated101.noEncarte).toBe(true);

    // 5. Teste de remoção com removeLoteFromEncarte
    removeLoteFromEncarte("101");
    const activeAposRemover = getActiveSnapshot()!;
    const removido101 = activeAposRemover.lotes.find((l) => l.codprod === "101")!;
    expect(removido101.noEncarte).toBe(false);
  });

  it("sincroniza último encarte salvo na nuvem e atualiza pino noEncarte do snapshot", async () => {
    getStorage().clear();

    saveLastProjectEncarteCache({
      id: "proj-nuvem-001",
      name: "Encarte Nuvem",
      updatedAt: new Date().toISOString(),
      products: [
        {
          id: "p-101",
          code: "101",
          name: "BATATA PALHA",
          packaging: "UN",
          validity: "20/11/2026",
          price: "5,00",
          unit: "UND",
          included: true,
          image: "https://example.com/batata.png",
        },
      ],
    } as any);

    const info = await syncLastEncarteData();
    expect(info.codes.has("101")).toBe(true);
    expect(info.sourceEncarteName).toBe("Encarte Nuvem");

    const snap = createSnapshotFromRaw(mockRawLotes, "validade-nuvem.csv");
    const lote101 = snap.lotes.find((l) => l.codprod === "101");
    expect(lote101?.noEncarte).toBe(true);
    expect(lote101?.foto).toBe("https://example.com/batata.png");
  });
});
