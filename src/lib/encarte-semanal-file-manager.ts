/**
/**
 * Gerenciador de Salvamento e Abertura em Pasta Local para o Encarte Semanal.
 * Permite salvar o encarte diretamente na pasta do computador (via File System Access API)
 * e reabrir futuramente pelo mesmo caminho, mantendo produtos, fotos, grade e rodapé.
 */

import type {
  EncarteSemanalProduct,
  EncarteSemanalGridConfig,
} from "@/types/encarte-semanal";
import { DEFAULT_ENCARTE_SEMANAL_GRID } from "@/types/encarte-semanal";

export interface EncarteSemanalProjectFile {
  format: "encarte-semanal";
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  footerText: string;
  templateImage: string;
  gridConfig: EncarteSemanalGridConfig;
  products: EncarteSemanalProduct[];
  metadata?: {
    totalProducts: number;
    withPhotoCount: number;
    savedVia: "file-system-api" | "download" | "indexeddb";
    filePathHint?: string;
  };
}

export interface SaveFileResult {
  ok: boolean;
  filename?: string;
  fileHandle?: any; // FileSystemFileHandle
  error?: string;
}

export interface OpenFileResult {
  ok: boolean;
  project?: EncarteSemanalProjectFile;
  filename?: string;
  fileHandle?: any; // FileSystemFileHandle
  error?: string;
}

/**
 * Converte o projeto do Encarte Semanal em string JSON estruturada.
 */
export function serializeEncarteSemanalProject(
  products: EncarteSemanalProduct[],
  config: {
    name?: string;
    templateImage: string;
    footerText: string;
    gridConfig: EncarteSemanalGridConfig;
    filePathHint?: string;
  }
): string {
  const now = new Date().toISOString();
  const withPhotoCount = products.filter((p) => Boolean(p.image)).length;

  const project: EncarteSemanalProjectFile = {
    format: "encarte-semanal",
    version: 1,
    id: `encarte-semanal-${Date.now()}`,
    name: config.name || "Encarte Semanal - Ofertas da Semana",
    createdAt: now,
    updatedAt: now,
    footerText: config.footerText,
    templateImage: config.templateImage,
    gridConfig: config.gridConfig || DEFAULT_ENCARTE_SEMANAL_GRID,
    products,
    metadata: {
      totalProducts: products.length,
      withPhotoCount,
      savedVia: "file-system-api",
      filePathHint: config.filePathHint,
    },
  };

  return JSON.stringify(project, null, 2);
}

/**
 * Analisa e valida uma string JSON como projeto do Encarte Semanal.
 */
export function deserializeEncarteSemanalProject(
  jsonText: string
): { ok: boolean; project?: EncarteSemanalProjectFile; error?: string } {
  try {
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== "object") {
      return { ok: false, error: "Arquivo vazio ou inválido." };
    }

    if (!Array.isArray(data.products)) {
      return { ok: false, error: "Arquivo não contém a lista de produtos do encarte." };
    }

    const project: EncarteSemanalProjectFile = {
      format: "encarte-semanal",
      version: data.version || 1,
      id: data.id || `encarte-semanal-${Date.now()}`,
      name: data.name || "Encarte Semanal",
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      footerText: data.footerText || "",
      templateImage: data.templateImage || "/templates/template-encarte-semanal.jpg",
      gridConfig: {
        ...DEFAULT_ENCARTE_SEMANAL_GRID,
        ...(data.gridConfig || {}),
      },
      products: data.products,
      metadata: data.metadata,
    };

    return { ok: true, project };
  } catch (err: any) {
    return { ok: false, error: `JSON inválido: ${err?.message || err}` };
  }
}

/**
 * Verifica se a API de gravação de arquivos nativa do navegador está disponível.
 */
export function isSaveFilePickerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).showSaveFilePicker === "function"
  );
}

/**
 * Verifica se a API de abertura de arquivos nativa do navegador está disponível.
 */
export function isOpenFilePickerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).showOpenFilePicker === "function"
  );
}

/**
 * Gera um nome de arquivo padrão padronizado com data (ex.: encarte_semanal_18_11_2026.json).
 */
export function generateDefaultFilename(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `encarte_semanal_${day}_${month}_${year}.json`;
}

/**
 * Salva diretamente na pasta do computador escolhida pelo usuário.
 * Retorna o handle do arquivo para permitir salvamentos subsequentes no mesmo arquivo.
 */
export async function saveEncarteSemanalToComputer(
  products: EncarteSemanalProduct[],
  config: {
    name?: string;
    templateImage: string;
    footerText: string;
    gridConfig: EncarteSemanalGridConfig;
    suggestedFilename?: string;
    existingFileHandle?: any;
  }
): Promise<SaveFileResult> {
  const suggestedName = config.suggestedFilename || generateDefaultFilename();
  const jsonContent = serializeEncarteSemanalProject(products, {
    ...config,
    filePathHint: suggestedName,
  });

  // 1. Se já tiver um fileHandle ativo e compatível, salva direto no mesmo arquivo!
  if (config.existingFileHandle && typeof config.existingFileHandle.createWritable === "function") {
    try {
      const writable = await config.existingFileHandle.createWritable();
      await writable.write(jsonContent);
      await writable.close();
      return {
        ok: true,
        filename: config.existingFileHandle.name || suggestedName,
        fileHandle: config.existingFileHandle,
      };
    } catch (err: any) {
      console.warn("Aviso ao salvar no handle existente, abrindo novo seletor:", err);
    }
  }

  // 2. Tenta usar File System Access API para salvar na pasta escolhida
  if (isSaveFilePickerSupported()) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Projeto Encarte Semanal (*.json)",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(jsonContent);
      await writable.close();

      return {
        ok: true,
        filename: handle.name || suggestedName,
        fileHandle: handle,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { ok: false, error: "Salvamento cancelado pelo usuário." };
      }
      console.warn("showSaveFilePicker falhou, usando download alternativo:", err);
    }
  }

  // 3. Fallback clássico: Download direto para a pasta de downloads/computador
  try {
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return {
      ok: true,
      filename: suggestedName,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Falha ao salvar arquivo: ${err?.message || err}`,
    };
  }
}

/**
 * Abre o encarte semanal da pasta do computador (pelo mesmo caminho salvo).
 */
export async function openEncarteSemanalFromComputer(): Promise<OpenFileResult> {
  if (isOpenFilePickerSupported()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Projeto Encarte Semanal (*.json)",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
      });

      if (!handle) {
        return { ok: false, error: "Nenhum arquivo selecionado." };
      }

      const file = await handle.getFile();
      const text = await file.text();
      const res = deserializeEncarteSemanalProject(text);

      if (!res.ok || !res.project) {
        return { ok: false, error: res.error || "Arquivo de encarte inválido." };
      }

      return {
        ok: true,
        project: res.project,
        filename: handle.name || file.name,
        fileHandle: handle,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { ok: false, error: "Abertura cancelada pelo usuário." };
      }
      return { ok: false, error: `Erro ao abrir arquivo: ${err?.message || err}` };
    }
  }

  return {
    ok: false,
    error: "Navegador não suporta seleção direta de arquivo pelo sistema.",
  };
}

/**
 * Processa um arquivo File lido via input tradicional.
 */
export async function readEncarteSemanalFromFile(file: File): Promise<OpenFileResult> {
  try {
    const text = typeof file.text === "function" ? await file.text() : await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
    const res = deserializeEncarteSemanalProject(text);
    if (!res.ok || !res.project) {
      return { ok: false, error: res.error || "Arquivo de encarte semanal inválido." };
    }
    return {
      ok: true,
      project: res.project,
      filename: file.name,
    };
  } catch (err: any) {
    return { ok: false, error: `Erro ao ler arquivo: ${err?.message || err}` };
  }
}
