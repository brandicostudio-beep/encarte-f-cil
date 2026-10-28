/**
 * Constantes e Utilitários de Sessão de Acesso do Gerador de Encartes.
 */

// Duração padrão da sessão: 12 horas (em milissegundos) - Ajustável
export const SESSION_DURATION_HOURS = 12;
export const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;

// Proteção contra força bruta: 5 erros = 5 minutos de bloqueio
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 5;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

// Chaves de armazenamento
export const AUTH_SESSION_KEY = "encarte_access_session";
export const AUTH_LOCKOUT_KEY = "encarte_access_lockout";
export const AUTH_FAILED_ATTEMPTS_KEY = "encarte_access_failed_count";

export interface ClientAuthSession {
  token: string;
  expiresAt: number;
}

/**
 * Obtém o storage seguro (funciona no browser e no runner de testes).
 */
function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return null;
}

/**
 * Recupera a sessão ativa do localStorage.
 * Retorna null se não existir ou se estiver expirada.
 */
export function getClientSession(): ClientAuthSession | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientAuthSession;
    if (!parsed || !parsed.token || typeof parsed.expiresAt !== "number") {
      return null;
    }
    // Verificação de expiração local
    if (Date.now() >= parsed.expiresAt) {
      storage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Salva a sessão ativa no localStorage com data de expiração.
 */
export function saveClientSession(token: string, expiresAt: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, expiresAt }));
  } catch (err) {
    console.error("Erro ao salvar sessão de acesso:", err);
  }
}

/**
 * Encerra a sessão removendo o token de acesso.
 * IMPORTANTE: Não remove os dados do encarte (produtos, fotos, edição final),
 * atendendo estritamente à regra de preservar os dados do usuário.
 */
export function clearClientSession(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(AUTH_SESSION_KEY);
  } catch {}
}

/**
 * Retorna quantos segundos restam no bloqueio de tentativas local.
 * Retorna 0 se não estiver bloqueado.
 */
export function getClientLockoutRemainingSeconds(): number {
  const storage = getStorage();
  if (!storage) return 0;
  try {
    const raw = storage.getItem(AUTH_LOCKOUT_KEY);
    if (!raw) return 0;
    const blockedUntil = parseInt(raw, 10);
    if (isNaN(blockedUntil)) return 0;
    const diff = blockedUntil - Date.now();
    if (diff <= 0) {
      storage.removeItem(AUTH_LOCKOUT_KEY);
      storage.removeItem(AUTH_FAILED_ATTEMPTS_KEY);
      return 0;
    }
    return Math.ceil(diff / 1000);
  } catch {
    return 0;
  }
}

/**
 * Registra o bloqueio de tentativas no cliente.
 */
export function setClientLockout(seconds: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const blockedUntil = Date.now() + seconds * 1000;
    storage.setItem(AUTH_LOCKOUT_KEY, String(blockedUntil));
  } catch {}
}

/**
 * Limpa o bloqueio e contador de falhas.
 */
export function clearClientLockout(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(AUTH_LOCKOUT_KEY);
    storage.removeItem(AUTH_FAILED_ATTEMPTS_KEY);
  } catch {}
}

/**
 * Formata segundos restantes em string MM:SS
 */
export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
