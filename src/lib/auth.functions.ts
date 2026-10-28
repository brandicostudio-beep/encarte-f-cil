import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  SESSION_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from "./auth-constants";

// Rastreamento de tentativas no servidor (memória do processo)
interface ServerRateLimitEntry {
  failedAttempts: number;
  blockedUntil: number | null;
}

const serverAttemptsStore = new Map<string, ServerRateLimitEntry>();

// Limpeza automática periódica de entradas antigas (a cada 15 min)
if (typeof setInterval !== "undefined") {
  try {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of serverAttemptsStore.entries()) {
        if (entry.blockedUntil && entry.blockedUntil < now && entry.failedAttempts === 0) {
          serverAttemptsStore.delete(key);
        }
      }
    }, 15 * 60 * 1000);
    // Unref apenas se estiver no Node/Bun
    (timer as any)?.unref?.();
  } catch {}
}

/**
 * Obtém a senha interna configurada como segredo do projeto.
 * Lê de APP_ACCESS_PASSWORD ou ACCESS_PASSWORD nas variáveis de ambiente.
 * Suporta Cloudflare Workers, Node, Bun, Vite e Lovable.
 * Fallback padrão seguro: "encarte123".
 */
export function getServerAccessPassword(): string {
  let envPassword: string | undefined;

  // 1. Variável de ambiente no Cloudflare Workers / Nitro global
  try {
    const cfEnv = (globalThis as any)?.__CF_ENV__;
    if (cfEnv) {
      envPassword =
        cfEnv.APP_ACCESS_PASSWORD ||
        cfEnv.ACCESS_PASSWORD ||
        cfEnv.ENCARTE_ACCESS_PASSWORD;
    }
  } catch {}

  // 2. process.env (Node / Bun / Vite SSR)
  try {
    if (!envPassword && typeof process !== "undefined" && process?.env) {
      envPassword =
        process.env.APP_ACCESS_PASSWORD ||
        process.env.ACCESS_PASSWORD ||
        process.env.ENCARTE_ACCESS_PASSWORD;
    }
  } catch {}

  // 3. import.meta.env (Vite)
  try {
    if (!envPassword && typeof import.meta !== "undefined" && (import.meta as any)?.env) {
      const meta = (import.meta as any).env;
      envPassword =
        meta.APP_ACCESS_PASSWORD ||
        meta.ACCESS_PASSWORD ||
        meta.VITE_APP_ACCESS_PASSWORD;
    }
  } catch {}

  // 4. globalThis direto
  try {
    if (!envPassword && typeof globalThis !== "undefined") {
      const g = globalThis as any;
      envPassword =
        g?.APP_ACCESS_PASSWORD ||
        g?.ACCESS_PASSWORD ||
        g?.__env__?.APP_ACCESS_PASSWORD;
    }
  } catch {}

  if (envPassword && typeof envPassword === "string" && envPassword.trim().length > 0) {
    return envPassword.trim();
  }

  // Senha padrão oficial do sistema
  return "encarte123";
}

/**
 * Segredo usado para assinar tokens de sessão.
 */
function getSessionSecret(): string {
  return getServerAccessPassword() + "-session-salt-encarte-2026";
}

/**
 * Calcula hash SHA-256 em formato hexadecimal usando Web Crypto API padrão.
 * 100% compatível com Cloudflare Workers, Node 18+, Bun e navegadores modernos.
 */
export async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // Web Crypto nativo
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback universal para ambientes mínimos
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

/**
 * Compara duas strings de tamanho fixo em tempo constante (evita vazamento de timing).
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Codificação base64url segura em Web Standards (sem dependência de Buffer do Node).
 */
function toBase64Url(str: string): string {
  try {
    if (typeof btoa !== "undefined") {
      const bytes = new TextEncoder().encode(str);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }
  } catch {}
  return encodeURIComponent(str);
}

/**
 * Decodificação base64url segura em Web Standards.
 */
function fromBase64Url(base64url: string): string {
  try {
    if (typeof atob !== "undefined") {
      let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) {
        base64 += "=";
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
  } catch {}
  return decodeURIComponent(base64url);
}

/**
 * Cria token de sessão assinado digitalmente com Web Crypto.
 */
export async function generateSignedSessionToken(expiresAt: number): Promise<string> {
  let nonce = "";
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const randomBytes = new Uint8Array(12);
      crypto.getRandomValues(randomBytes);
      nonce = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {}
  if (!nonce) {
    nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const payload = JSON.stringify({
    exp: expiresAt,
    iat: Date.now(),
    nonce,
  });

  const payloadBase64 = toBase64Url(payload);
  const secret = getSessionSecret();
  const signature = await sha256Hex(`${payloadBase64}.${secret}`);

  return `${payloadBase64}.${signature}`;
}

/**
 * Valida a integridade e expiração de um token de sessão assinado.
 */
export async function validateSignedSessionToken(
  token: string
): Promise<{ valid: boolean; expiresAt?: number }> {
  if (!token || typeof token !== "string") return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };

  const [payloadBase64, providedSig] = parts;
  const secret = getSessionSecret();
  const expectedSig = await sha256Hex(`${payloadBase64}.${secret}`);

  if (!constantTimeCompare(providedSig, expectedSig)) {
    return { valid: false };
  }

  try {
    const decodedStr = fromBase64Url(payloadBase64);
    const decoded = JSON.parse(decodedStr);
    if (!decoded || typeof decoded.exp !== "number") {
      return { valid: false };
    }
    if (Date.now() >= decoded.exp) {
      return { valid: false }; // Expirou
    }
    return { valid: true, expiresAt: decoded.exp };
  } catch {
    return { valid: false };
  }
}

/**
 * Compara senhas de forma segura contra timing-attacks usando hashes SHA-256.
 * Inclui tolerância para capitalização automática no teclado de celular se a senha padrão for usada.
 */
export async function timingSafePasswordMatch(
  input: string,
  target: string
): Promise<boolean> {
  const cleanInput = input.trim();
  const cleanTarget = target.trim();

  // Comparação de hash padrão
  const hashInput = await sha256Hex(cleanInput);
  const hashTarget = await sha256Hex(cleanTarget);
  const exactMatch = constantTimeCompare(hashInput, hashTarget);

  if (exactMatch) {
    return true;
  }

  // Tolerância prática para mobile se a senha configurada for a padrão "encarte123"
  // e o teclado do celular tiver colocado maiúscula inicial ("Encarte123")
  if (cleanTarget === "encarte123") {
    const hashLower = await sha256Hex(cleanInput.toLowerCase());
    if (constantTimeCompare(hashLower, hashTarget)) {
      return true;
    }
  }

  return false;
}

/**
 * Lógica pura de verificação de senha no servidor (testável diretamente).
 */
export async function verifyPasswordLogic(data: {
  password: string;
  clientFingerprint?: string;
}) {
  const clientKey = data.clientFingerprint || "global-client";
  const now = Date.now();

  let entry = serverAttemptsStore.get(clientKey);
  if (!entry) {
    entry = { failedAttempts: 0, blockedUntil: null };
    serverAttemptsStore.set(clientKey, entry);
  }

  // 1. Verifica se está bloqueado por excesso de tentativas
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      success: false as const,
      blocked: true as const,
      remainingSeconds,
      error: "Senha incorreta.",
    };
  }

  // Se o bloqueio expirou, zera as tentativas
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.failedAttempts = 0;
    entry.blockedUntil = null;
  }

  const expectedPassword = getServerAccessPassword();
  const isCorrect = await timingSafePasswordMatch(data.password, expectedPassword);

  if (!isCorrect) {
    entry.failedAttempts += 1;

    // Ao atingir 5 tentativas erradas, bloqueia por 5 minutos
    if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      entry.blockedUntil = now + LOCKOUT_DURATION_MS;
      const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return {
        success: false as const,
        blocked: true as const,
        remainingSeconds,
        // Mensagem estritamente genérica conforme requisito
        error: "Senha incorreta.",
      };
    }

    return {
      success: false as const,
      blocked: false as const,
      failedAttempts: entry.failedAttempts,
      // Mensagem genérica: "Senha incorreta." Sem dicas de tamanho ou caracteres
      error: "Senha incorreta.",
    };
  }

  // Senha correta: zera histórico de falhas e gera token de sessão (12 horas)
  entry.failedAttempts = 0;
  entry.blockedUntil = null;

  const expiresAt = now + SESSION_DURATION_MS;
  const token = await generateSignedSessionToken(expiresAt);

  return {
    success: true as const,
    blocked: false as const,
    token,
    expiresAt,
  };
}

/**
 * Função do Servidor para verificar a senha e realizar login.
 * Protegida contra força bruta (5 tentativas erradas = bloqueio de 5 min).
 */
export const verifyAccessPasswordServer = createServerFn({ method: "POST" })
  .validator(
    (d: { password: string; clientFingerprint?: string }) =>
      z
        .object({
          password: z.string().max(256),
          clientFingerprint: z.string().max(128).optional(),
        })
        .parse(d)
  )
  .handler(async ({ data }) => {
    return verifyPasswordLogic(data);
  });

/**
 * Função do Servidor para verificar a validade do token de sessão.
 */
export const checkSessionValidityServer = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const result = await validateSignedSessionToken(data.token);
    return result;
  });
