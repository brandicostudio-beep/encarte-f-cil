import { describe, it, expect } from "vitest";
import {
  parseWinthorCsv,
  normalizeHeaderKey,
  mapHeaderToField,
  parseBrazilianNumber,
  normalizeDateString,
  decodeBufferToString,
  splitCsvRow,
} from "./painel-validade-parser";

describe("Painel de Validade - Parser de Planilha Winthor/WMS", () => {
  it("normaliza cabeçalhos removendo acentos, dois-pontos e espaços", () => {
    expect(normalizeHeaderKey("PREÇO_VENDA")).toBe("preco_venda");
    expect(normalizeHeaderKey(":DATAINICIAL")).toBe("datainicial");
    expect(normalizeHeaderKey("%TOLERANCIA")).toBe("tolerancia");
    expect(normalizeHeaderKey("QTDISP_WMS")).toBe("qtdisp_wms");
    expect(normalizeHeaderKey("QTVENDMES1")).toBe("qtvendmes1");
  });

  it("mapeia cabeçalhos para os campos internos corretos", () => {
    expect(mapHeaderToField("CODPROD")).toBe("codprod");
    expect(mapHeaderToField("DESCRICAO")).toBe("descricao");
    expect(mapHeaderToField("DTVAL")).toBe("dtval");
    expect(mapHeaderToField("QTDISP_WMS")).toBe("qtdisp_wms");
    expect(mapHeaderToField("PRECO_VENDA")).toBe("preco_venda");
    expect(mapHeaderToField("PREÇO_VENDA")).toBe("preco_venda");
    expect(mapHeaderToField("PREO_VENDA")).toBe("preco_venda");
    expect(mapHeaderToField("PRE\uFFFDO_VENDA")).toBe("preco_venda");
    expect(mapHeaderToField("PREÇO_TOTAL")).toBe("preco_total");
    expect(mapHeaderToField("PREO_TOTAL")).toBe("preco_total");
    expect(mapHeaderToField("PRE\uFFFDO_TOTAL")).toBe("preco_total");
    expect(mapHeaderToField("QTVENDMES")).toBe("qtvendmes");
    expect(mapHeaderToField("QTVENDMES1")).toBe("qtvendmes1");
    expect(mapHeaderToField("QTVENDMES2")).toBe("qtvendmes2");
    expect(mapHeaderToField("QTVENDMES3")).toBe("qtvendmes3");
    expect(mapHeaderToField("CODCOMPRADOR")).toBe("codcomprador");
    expect(mapHeaderToField("NOME")).toBe("nomeComprador");
  });

  it("converte números brasileiros com vírgula e ponto", () => {
    expect(parseBrazilianNumber("2,9")).toBe(2.9);
    expect(parseBrazilianNumber("1.250,50")).toBe(1250.5);
    expect(parseBrazilianNumber("0,4")).toBe(0.4);
    expect(parseBrazilianNumber(36)).toBe(36);
    expect(parseBrazilianNumber("")).toBe(0);
    expect(parseBrazilianNumber(null)).toBe(0);
  });

  it("converte datas para dd/mm/aaaa", () => {
    expect(normalizeDateString("22/11/2026")).toBe("22/11/2026");
    expect(normalizeDateString("2026-11-22")).toBe("22/11/2026");
    expect(normalizeDateString("5/12/26")).toBe("05/12/2026");
  });

  it("decodifica buffer com acentuação ISO-8859-1 / Windows-1252", () => {
    // String "PREÇO_VENDA;DESCRIÇÃO" codificada em Windows-1252 (ISO-8859-1)
    // O byte de 'Ç' em ISO-8859-1 é 0xC7 e 'Ã' é 0xC3
    const win1252Bytes = new Uint8Array([
      0x50, 0x52, 0x45, 0xc7, 0x4f, // PREÇO
      0x5f, 0x56, 0x45, 0x4e, 0x44, 0x41, // _VENDA
      0x3b, // ;
      0x44, 0x45, 0x53, 0x43, 0x52, 0x49, 0xc7, 0xc3, 0x4f, // DESCRIÇÃO
    ]);

    const decoded = decodeBufferToString(win1252Bytes);
    expect(decoded).toContain("PREÇO_VENDA");
    expect(decoded).toContain("DESCRIÇÃO");
  });

  it("separa colunas respeitando aspas e ponto e vírgula", () => {
    const row = '22292;"BATATA PALHA, ESPECIAL";UNIDADE;20/11/2026;50';
    const cols = splitCsvRow(row, ";");
    expect(cols.length).toBe(5);
    expect(cols[0]).toBe("22292");
    expect(cols[1]).toBe("BATATA PALHA, ESPECIAL");
    expect(cols[3]).toBe("20/11/2026");
    expect(cols[4]).toBe("50");
  });

  it("bloqueia importação se faltar coluna obrigatória e lista os nomes", () => {
    const csvIncompleto = "CODPROD;DESCRICAO;EMBALAGEM\n101;LEITE;CX";
    const preview = parseWinthorCsv(csvIncompleto, "incompleto.csv");

    expect(preview.lotesValidos.length).toBe(0);
    expect(preview.colunasFaltantes).toContain("dtval");
    expect(preview.colunasFaltantes).toContain("qtdisp_wms");
    expect(preview.colunasFaltantes).toContain("preco_venda");
    expect(preview.linhasComErro.length).toBeGreaterThan(0);
    expect(preview.linhasComErro[0].erro).toContain("Colunas obrigatórias ausentes");
  });

  it("importa CSV do Winthor com 4 colunas de venda e calcula prévia de novidades", () => {
    const csvValido = [
      "CODPROD;DESCRICAO;EMBALAGEM;DTVAL;QTDISP_WMS;PRECO_VENDA;QTVENDMES;QTVENDMES1;QTVENDMES2;QTVENDMES3;CODCOMPRADOR;NOME",
      "22292;BATATA PALHA BELLA PALHA;UNIDADE 1X80 GR;20/11/2026;36;4,50;5;12;14;10;01;JOAO COMPRADOR",
      "26032;SALGADINHO BATATA LAYS;UNIDADE 1X62 GR;23/11/2026;50;5,99;2;20;18;22;02;MARIA COMPRADORA",
      "99999;;UNIDADE;25/11/2026;10;2,00;0;0;0;0;01;JOAO COMPRADOR", // Sem descrição -> fallback
      ";SEM CODIGO;UNIDADE;25/11/2026;10;2,00;0;0;0;0;01;JOAO COMPRADOR", // Linha inválida (sem código)
    ].join("\r\n");

    const preview = parseWinthorCsv(csvValido, "teste-winthor.csv");

    expect(preview.colunasFaltantes.length).toBe(0);
    expect(preview.lotesValidos.length).toBe(3); // 3 válidos
    expect(preview.linhasComErro.length).toBe(1); // 1 com código vazio
    expect(preview.linhasComErro[0].erro).toContain("Código do produto vazio");

    const item1 = preview.lotesValidos[0];
    expect(item1.codprod).toBe("22292");
    expect(item1.descricao).toBe("BATATA PALHA BELLA PALHA");
    expect(item1.qtdisp_wms).toBe(36);
    expect(item1.preco_venda).toBe(4.5);
    expect(item1.qtvendmes).toBe(5);
    expect(item1.qtvendmes1).toBe(12);
    expect(item1.qtvendmes2).toBe(14);
    expect(item1.qtvendmes3).toBe(10);
    expect(item1.codcomprador).toBe("01");
    expect(item1.nomeComprador).toBe("JOAO COMPRADOR");
  });

  it("processa com perfeição o formato real de exportação diária do Winthor", () => {
    const csvReal = [
      "CODPROD;DESCRICAO;EMBALAGEM;DTVAL;DIASAVENCER;PRAZOVAL;%TOLERANCIA;QTRESERV;QTDISP_WMS;QTEST_WINTHOR;QTVENDMES;QTVENDMES1;QTVENDMES2;QTVENDMES3;PREÇO_VENDA;PREÇO_TOTAL;STATUS;:DATAINICIAL;:DATAFINAL;CODCOMPRADOR;NOME;",
      "11782;MOLHO P/SALADA LIZA LIMAO;1X234 ML;04/11/2026;-13;240;80;0;36;36;6;6;22;12;2,9;104,4;NORMAL;01/11/2026;05/12/2027;21338;MARIANA DIPRE;",
      "26499;FAROFA PRONTA YOKI TRAD.L450 P400;1X450 GR;28/05/2027;192;240;80;0;7651;7651;0;50;0;0;6,56;50190,56;NORMAL;01/11/2026;05/12/2027;21338;MARIANA DIPRE;",
    ].join("\r\n");

    const preview = parseWinthorCsv(csvReal, "TESTE_VALIDADE.csv");

    expect(preview.colunasFaltantes.length).toBe(0);
    expect(preview.lotesValidos.length).toBe(2);
    expect(preview.linhasComErro.length).toBe(0);

    const lote1 = preview.lotesValidos[0];
    expect(lote1.codprod).toBe("11782");
    expect(lote1.qtdisp_wms).toBe(36);
    expect(lote1.preco_venda).toBe(2.9);
    expect(lote1.preco_total).toBe(104.4);
    expect(lote1.qtvendmes).toBe(6);
    expect(lote1.nomeComprador).toBe("MARIANA DIPRE");

    const lote2 = preview.lotesValidos[1];
    expect(lote2.codprod).toBe("26499");
    expect(lote2.qtdisp_wms).toBe(7651);
    expect(lote2.preco_venda).toBe(6.56);
    expect(lote2.preco_total).toBe(50190.56);
  });
});
