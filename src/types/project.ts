import type { EncarteProduct, CampaignConfig, StoreConfig } from "./encarte";

export interface ProjectSourceInfo {
  type: "spreadsheet" | "url" | "manual";
  filename?: string | undefined;
  fileSize?: number | undefined;
  importedAt?: string | undefined;
  columnsSummary?: string | undefined;
  url?: string | undefined;
  lastScrapedAt?: string | undefined;
}

export interface ProjectPhotoReference {
  code: string;
  fileId?: string | undefined;
  filename?: string | undefined;
  source?: ("drive" | "zip" | "upload" | "sample" | "folder") | undefined;
  url?: string | undefined;
  isPrimary?: boolean | undefined;
}

export interface ProjectVersionSummary {
  version: number;
  savedAt: string;
  itemCount: number;
  notes?: string | undefined;
  driveFileId?: string | undefined;
}

export interface ProjectData {
  id: string; // Ex: proj-1730214812345-abc1
  name: string; // Ex: Encarte Fim de Semana - Outubro
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  version: number; // 1, 2, 3...
  isTrashed?: boolean | undefined;
  trashedAt?: string | undefined;

  // Origem dos dados
  source: ProjectSourceInfo;

  // Produtos com referências leves (sem imagens base64 pesadas)
  products: EncarteProduct[];

  // Configurações
  campaign: CampaignConfig;
  store: StoreConfig;

  // Histórico de versões
  versionHistory: ProjectVersionSummary[];

  // IDs de pastas no Google Drive (se sincronizado)
  driveFolderId?: string | undefined;
  currentDriveFileId?: string | undefined;
}

export type ProjectSyncStatus =
  | "synced"
  | "unsaved"
  | "local_only"
  | "sync_error"
  | "update_available";

export interface ProjectIndexItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  versionCount: number;
  itemCount: number;
  sourceType: "spreadsheet" | "url" | "manual";
  sourceName?: string | undefined;
  syncStatus: ProjectSyncStatus;
  isTrashed?: boolean | undefined;
  trashedAt?: string | undefined;
  driveFolderId?: string | undefined;
  thumbnailUrl?: string | undefined;
}

export interface ProjectIndexFile {
  app: "encartes-facil";
  version: number;
  updatedAt: string;
  projects: ProjectIndexItem[];
}

export interface ProductChangeDiff {
  code: string;
  name: string;
  type: "added" | "removed" | "changed";
  changes: {
    field: "price" | "unit" | "stock" | "validity" | "packaging";
    oldValue: string;
    newValue: string;
  }[];
  newProduct?: EncarteProduct | undefined;
  selected?: boolean | undefined;
}

export interface ProjectUpdateAnalysis {
  hasUpdates: boolean;
  hasChanges?: boolean | undefined;
  checkedAt: string;
  totalNew: number;
  totalRemoved: number;
  totalChanged: number;
  totalChanges?: number | undefined;
  diffs: ProductChangeDiff[];
}
