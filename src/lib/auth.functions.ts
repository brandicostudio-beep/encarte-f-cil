import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
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
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of serverAttemptsStore.entries()) {
      if (entry.blockedUntil && entry.blockedUntil < now && entry.failedAttempts === 0) {
        serverAttemptsStore.delete(key);
      }
    }
  }, 15 * 60 * 1000).unref?.();
}

/**
 * Obtém a senha interna configurada como segredo do projeto.
 * Lê de APP_ACCESS_PASSWORD ou ACCESS_PASSWORD.
 * Possui fallback seguro para desenvolvimento/testes locais.
 */
export function getServerAccessPassword(): string {
  const envPassword =
    process.env.APP_ACCESS_PASSWORD ||
    process.env.ACCESS_PASSWORD ||
    process.env.ENCARTE_ACCESS_PASSWORD;

  if (envPassword && envPassword.trim().length > 0) {
    return envPassword.trim();
  }

  // Fallback seguro de desenvolvimento e testes
  return "encarte123";
}

/**
 * Segredo usado para assinar tokens HMAC de sessão.
 */
function getSessionHmacSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.APP_ACCESS_PASSWORD ||
    "encarte-auth-secret-key-salt-2026"
  );
}

/**
 * Cria token de sessão HMAC assinado digitalmente.
 */
export function generateSignedSessionToken(expiresAt: number): string {
  const payload = JSON.stringify({
    exp: expiresAt,
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex"),
  });
  const payloadBase64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionHmacSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Valida a integridade e expiração de um token HMAC assinado.
 */
export function validateSignedSessionToken(
  token: string
): { valid: boolean; expiresAt?: number } {
  if (!token || typeof token !== "string") return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };

  const [payloadBase64, providedSig] = parts;

  // Recalcula a assinatura esperada
  const expectedSig = crypto
    .createHmac("sha256", getSessionHmacSecret())
    .update(payloadBase64)
    .digest("base64url");

  const sigBuf = Buffer.from(providedSig);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    );
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
 * Compara strings de forma segura contra timing-attacks.
 */
function timingSafePasswordMatch(input: string, target: string): boolean {
  const bufA = Buffer.from(input, "utf8");
  const bufB = Buffer.from(target, "utf8");

  if (bufA.length !== bufB.length) {
    // Comparação falsa com mesmo tamanho para evitar vazamento de timing
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
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
      error: "Muitas tentativas incorretas. Acesso bloqueado temporariamente.",
    };
  }

  // Se o bloqueio expirou, zera as tentativas
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.failedAttempts = 0;
    entry.blockedUntil = null;
  }

  const expectedPassword = getServerAccessPassword();
  const isCorrect = timingSafePasswordMatch(data.password, expectedPassword);

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
  const token = generateSignedSessionToken(expiresAt);

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
    const result = validateSignedSessionToken(data.token);
    return result;
  });
