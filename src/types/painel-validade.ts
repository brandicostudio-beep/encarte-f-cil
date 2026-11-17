/**
 * Tipos e Interfaces do Painel de Validade (Visão Gestor de Distribuição e Comprador)
 */

export type FaixaVencimento =
  | "vencido"      // < 0 dias
  | "ate_7d"       // 0 a 7 dias
  | "8_a_30d"      // 8 a 30 dias
  | "31_a_60d"     // 31 a 60 dias
  | "61_a_90d"     // 61 a 90 dias
  | "acima_90d"    // > 90 dias
  | "sem_validade" // sem data válida informada
  | "todas";

export type FaixaEscoaTempo =
  | "vai_sobrar"   // < 60%
  | "no_limite"    // 60% a 99%
  | "escoa_tempo"  // 100%
  | "sem_estoque"; // Sem estoque no Winthor / CD

export type FaixaGiroMes =
  | "parado"       // 0%
  | "baixo"        // < 10%
  | "medio"        // 10% a 30%
  | "alto";        // > 30%

export type FaixaCobertura =
  | "sem_venda"
  | "ate_2_meses"
  | "2_a_6_meses"
  | "acima_6_meses";

export type RitmoMesStatus =
  | "acima_normal" // > 120%
  | "normal"       // 80% a 120%
  | "abaixo_normal"// < 80%
  | "sem_base";

export interface ValidadeLoteRaw {
  codprod: string;
  descricao: string;
  embalagem: string;
  dtval: string;             // dd/mm/aaaa
  diasavencer?: number;
  prazoval?: number;
  percentTolerancia?: number;
  qtreserv?: number;
  qtdisp_wms: number;        // Estoque considerado
  qtest_winthor?: number;
  qtvendmes?: number | null; // Mês atual parcial
  qtvendmes1?: number | null; // M-1 fechado
  qtvendmes2?: number | null; // M-2 fechado
  qtvendmes3?: number | null; // M-3 fechado
  preco_venda: number;
  preco_total?: number;
  status?: string;
  datainicial?: string;
  datafinal?: string;
  codcomprador?: string;
  nomeComprador?: string;
  loteNumero?: string;
  foto?: string;
}

export interface ValidadeDiagnosticoSobra {
  titulo: string;
  resumoLinha: string;
  explicacaoSimples: string;
  mesesFechados: Array<{
    rotulo: string;
    subtitulo: string;
    valor: number | null;
    textoFormatado: string;
    semDados: boolean;
  }>;
  mediaMensalFechada: number;
  ritmoAtualDia: number;
  estoque: number;
  diasParaVencer: number;
  vendaPrevista: number;
  sobraPrevista: number;
  escoaTempoPercent: number;
  isSemVenda: boolean;
  isSemEstoque: boolean;
  isEscoa100: boolean;
  isVencido: boolean;
  vendaIrregular: boolean;
  avisoIrregularidade: string | null;

  // Inteligência de Esforço Comercial e Risco da Sobra
  multiplicadorEsforco: number | null; // RitmoNecessario / RitmoAtual (ex: 1.5x)
  nivelEsforco: "normal" | "atencao" | "alerta_promocao" | "critico_queima";
  recomendacaoComercial: string;
  prejuizoPrevistoSobra: number; // sobraPrevista * precoVenda
  vendaEsperadaMesAtual: number; // Média mensal * (diaAtual / diasDoMes)
}

export interface ValidadeLoteCalculado {
  id: string; // Chave única: codprod + "_" + dtval + "_" + (loteNumero || "0")
  codprod: string;
  descricao: string;
  embalagem: string;
  dtval: string;
  dtvalDate: Date | null;
  diasParaVencer: number;
  isVencido: boolean;

  // Estoque & Preços
  estoque: number;
  isSemEstoque: boolean;
  qtdisp_wms?: number;
  qtest_winthor?: number;
  precoVenda: number;
  precoTotalPlanilha?: number;
  valorEmRisco: number; // precoVenda * sobraPrevista

  // Vendas & Médias
  vendaMesAtual: number;      // QTVENDMES (mês parcial, fallback 0)
  vendaM1: number;            // QTVENDMES1 (fallback 0)
  vendaM2: number;            // QTVENDMES2 (fallback 0)
  vendaM3: number;            // QTVENDMES3 (fallback 0)
  vendaMesAtualRaw?: number | null; // Valor bruto (null se sem dados)
  vendaM1Raw?: number | null;
  vendaM2Raw?: number | null;
  vendaM3Raw?: number | null;
  mediaMensalFechada: number; // Média (M1 + M2 + M3) / 3
  isSemVenda: boolean;        // Se M1 = M2 = M3 = 0

  // Ritmos & Escoamento
  ritmoAtualDia: number;      // mediaMensalFechada / 30
  ritmoNecessarioDia: number; // estoque / diasParaVencer (null se vencido)
  escoaTempoPercent: number;  // min(100, (ritmoAtualDia * diasParaVencer / estoque) * 100)
  sobraPrevistaUnidades: number; // max(0, estoque - (ritmoAtualDia * diasParaVencer))
  coberturaMeses: number | null; // estoque / mediaMensalFechada (null se sem venda)
  giroMesPercent: number;     // min(100, (mediaMensalFechada / estoque) * 100)
  ritmoMesStatus: RitmoMesStatus;
  vendaIrregular: boolean;    // max >= 3*min ou zero com positivo

  // Inteligência de Esforço Comercial e Risco da Sobra
  multiplicadorEsforco?: number | null; // RitmoNecessario / RitmoAtual (ex: 1.5x)
  nivelEsforco?: "normal" | "atencao" | "alerta_promocao" | "critico_queima";
  recomendacaoComercial?: string;
  prejuizoPrevistoSobra?: number; // sobraPrevista * precoVenda
  vendaEsperadaMesAtual?: number; // Média mensal * (diaAtual / diasDoMes)

  // Classificações
  faixaVencimento: FaixaVencimento;
  faixaEscoaTempo: FaixaEscoaTempo;
  faixaGiroMes: FaixaGiroMes;
  faixaCobertura: FaixaCobertura;

  // Integração com Encarte
  noEncarte: boolean;

  // Metadados Winthor
  codcomprador: string;
  nomeComprador: string;
  prazoval?: number;
  percentTolerancia?: number;
  foto?: string;

  // Status de Snapshot
  isNovoLote?: boolean;
  saiuDoEncarte?: boolean;
}

export interface ValidadeSnapshot {
  id: string;
  criadoEm: string;           // ISO timestamp
  importadoPor: string;
  nomeArquivo: string;
  totalLotes: number;
  totalProdutosUnicos: number;
  lotes: ValidadeLoteCalculado[];
  referenceDate: string;      // ISO date usado no cálculo
}

export interface ValidadePreviewImport {
  nomeArquivo: string;
  totalLinhasLidas: number;
  lotesValidos: ValidadeLoteRaw[];
  linhasComErro: Array<{ linha: number; erro: string; conteudo: string }>;
  totalProdutosNovos: number;
  totalProdutosSairam: number;
  totalLotesAlterados: number;
  colunasDetectadas: string[];
  colunasFaltantes: string[];
}

export interface ValidadeFilterParams {
  busca?: string;
  filtroRapido?: "todos" | "critico" | "vence_7d" | "vai_sobrar" | "parado" | "sem_vendas_3m" | "sem_estoque";
  faixaVencimento?: FaixaVencimento | "todas";
  faixaEscoaTempo?: FaixaEscoaTempo | "todas";
  faixaGiroMes?: FaixaGiroMes | "todas";
  faixaCobertura?: FaixaCobertura | "todas";
  ritmoMes?: RitmoMesStatus | "todas";
  noEncarte?: "todos" | "sim" | "nao";
  comprador?: string;
  ordenacao?: "critico_primeiro" | "escoa_tempo_asc" | "vencimento_asc" | "estoque_desc" | "nome_asc";
}

export interface ValidadeAlertCounts {
  critico: number;            // Vence <= 30d E escoa < 60%
  urgente: number;            // Vence <= 7d E escoa < 100%
  parado: number;             // Sem venda M1..3 E vence <= 90d
  ritmoCaiu: number;          // Mês parcial abaixo do normal E escoa < 100%
  novoLote: number;           // Lote não existente no snapshot anterior
  saiuDoEncarte: number;      // Estava no encarte e não está mais
}

export interface ValidadeKpiCounts {
  vencidos: number;
  ate7d: number;
  de8a30d: number;
  de31a60d: number;
  de61a90d: number;
  acima90d: number;
  semValidade: number;
  total: number;
}
