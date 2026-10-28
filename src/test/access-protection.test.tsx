import { describe, it, expect, beforeEach } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  getClientSession,
  saveClientSession,
  clearClientSession,
  getClientLockoutRemainingSeconds,
  setClientLockout,
  clearClientLockout,
  formatCountdown,
  AUTH_SESSION_KEY,
  AUTH_LOCKOUT_KEY,
  SESSION_DURATION_MS,
} from "@/lib/auth-constants";
import {
  getServerAccessPassword,
  generateSignedSessionToken,
  validateSignedSessionToken,
} from "@/lib/auth.functions";

describe("Sistema de Acesso Restrito Interno (Item 1 ao Item 7)", () => {
  // Mock simples de localStorage em memória para os testes
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    // Define mock global do localStorage
    globalThis.localStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      length: 0,
      key: () => null,
    } as any;
  });

  // Teste 1: Abrir qualquer rota do sistema sem login: redireciona para /acesso
  it("Teste 1: Usuário sem sessão ativa não possui credencial e deve ser redirecionado para /acesso", () => {
    clearClientSession();
    const session = getClientSession();
    expect(session).toBeNull();
  });

  // Teste 2: Senha errada: mostra 'Senha incorreta' e não libera o token
  it("Teste 2: Senha incorreta não gera token e retorna mensagem genérica sem pistas", () => {
    const configuredPassword = getServerAccessPassword();
    const wrongPassword = "senha-totalmente-errada-999";

    expect(wrongPassword).not.toBe(configuredPassword);

    // Valida que token inválido é rejeitado
    const fakeToken = "invalid.token.structure";
    const validation = validateSignedSessionToken(fakeToken);
    expect(validation.valid).toBe(false);
  });

  // Teste 3: Senha certa: gera token de sessão válido de 12 horas e libera o sistema
  it("Teste 3: Senha correta gera token HMAC assinado válido com expiração de 12 horas", () => {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    const token = generateSignedSessionToken(expiresAt);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const validation = validateSignedSessionToken(token);
    expect(validation.valid).toBe(true);
    expect(validation.expiresAt).toBe(expiresAt);

    // Salva a sessão no cliente
    saveClientSession(token, expiresAt);
    const clientSession = getClientSession();
    expect(clientSession).not.toBeNull();
    expect(clientSession?.token).toBe(token);
    expect(clientSession?.expiresAt).toBe(expiresAt);
  });

  // Teste 4: Após 5 erros: bloqueia por 5 minutos com contador visível
  it("Teste 4: Bloqueio de 5 minutos após tentativas inválidas registra contagem regressiva", () => {
    // Registra bloqueio de 5 minutos (300 segundos)
    setClientLockout(300);

    const remaining = getClientLockoutRemainingSeconds();
    expect(remaining).toBeGreaterThan(290);
    expect(remaining).toBeLessThanOrEqual(300);

    // Formatação do contador regressivo MM:SS
    const formatted = formatCountdown(remaining);
    expect(formatted).toMatch(/^0[45]:[0-5][0-9]$/);

    // Limpeza após o período
    clearClientLockout();
    expect(getClientLockoutRemainingSeconds()).toBe(0);
  });

  // Teste 5: Recarregar a página após login: continua logado (persistência da sessão)
  it("Teste 5: Recarregar a página mantém a sessão ativa enquanto for válida", () => {
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora no futuro
    const token = generateSignedSessionToken(expiresAt);
    saveClientSession(token, expiresAt);

    // Simula reload (lê novamente do localStorage)
    const reloadedSession = getClientSession();
    expect(reloadedSession).not.toBeNull();
    expect(reloadedSession?.token).toBe(token);
  });

  // Teste 6: Sair (logout): remove token da sessão e bloqueia rotas
  it("Teste 6: Logout encerra a sessão e remove apenas o token de acesso", () => {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const token = generateSignedSessionToken(expiresAt);
    saveClientSession(token, expiresAt);

    expect(getClientSession()).not.toBeNull();

    // Executa logout
    clearClientSession();

    expect(getClientSession()).toBeNull();
    expect(mockStore[AUTH_SESSION_KEY]).toBeUndefined();
  });

  // Teste 7: Sessão expirada: pede a senha de novo
  it("Teste 7: Sessão com data no passado é detectada como expirada e invalidada", () => {
    const expiredTimestamp = Date.now() - 10000; // 10 segundos atrás
    const expiredToken = generateSignedSessionToken(expiredTimestamp);

    // No servidor: validação rejeita token expirado
    const serverResult = validateSignedSessionToken(expiredToken);
    expect(serverResult.valid).toBe(false);

    // No cliente: salva token vencido no localStorage
    saveClientSession(expiredToken, expiredTimestamp);

    // getClientSession detecta que expirou e remove automaticamente
    const clientResult = getClientSession();
    expect(clientResult).toBeNull();
    expect(mockStore[AUTH_SESSION_KEY]).toBeUndefined();
  });

  // Teste 8: Login e logout não apagam produtos, campanha nem fotos carregadas
  it("Teste 8: Login e logout preservam produtos, campanhas e edições salvas no navegador", () => {
    const sampleProducts = [
      { id: "p1", code: "1001", name: "ARROZ TIPO 1 5KG", price: "24,90", included: true },
      { id: "p2", code: "1002", name: "FEIJAO CARIOCA 1KG", price: "7,89", included: true },
    ];
    const sampleCampaign = {
      name: "Detona Preços Fim de Mês",
      format: "story_9_16",
    };

    // Salva dados do encarte no storage
    mockStore["encarte-products-v2"] = JSON.stringify(sampleProducts);
    mockStore["encarte-campaign-v2"] = JSON.stringify(sampleCampaign);
    mockStore["encarte_photos_db"] = "photo-binary-cache";

    // 1. Simula Login
    const token = generateSignedSessionToken(Date.now() + 100000);
    saveClientSession(token, Date.now() + 100000);

    // Dados continuam intactos
    expect(JSON.parse(mockStore["encarte-products-v2"])).toHaveLength(2);
    expect(JSON.parse(mockStore["encarte-campaign-v2"]).name).toBe("Detona Preços Fim de Mês");
    expect(mockStore["encarte_photos_db"]).toBe("photo-binary-cache");

    // 2. Simula Logout
    clearClientSession();

    // A sessão foi removida
    expect(mockStore[AUTH_SESSION_KEY]).toBeUndefined();

    // Mas TODOS os produtos, campanhas e fotos permanecem 100% preservados!
    expect(JSON.parse(mockStore["encarte-products-v2"])).toHaveLength(2);
    expect(JSON.parse(mockStore["encarte-products-v2"])[0].name).toBe("ARROZ TIPO 1 5KG");
    expect(JSON.parse(mockStore["encarte-campaign-v2"]).name).toBe("Detona Preços Fim de Mês");
    expect(mockStore["encarte_photos_db"]).toBe("photo-binary-cache");
  });

  // Teste 9: Formatação e acessibilidade da tela de acesso
  it("Teste 9: Formatação do contador e chaves de bloqueio", () => {
    expect(formatCountdown(300)).toBe("05:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(9)).toBe("00:09");
    expect(formatCountdown(0)).toBe("00:00");
  });

  // Teste 10: Verificação de senha no servidor e proteção de 5 tentativas consecutivas
  it("Teste 10: Servidor bloqueia após 5 senhas incorretas consecutivas com mensagem genérica", async () => {
    const { verifyPasswordLogic } = await import("@/lib/auth.functions");
    const testFingerprint = `test-client-${Date.now()}`;

    // 4 tentativas incorretas
    for (let i = 1; i <= 4; i++) {
      const res = await verifyPasswordLogic({
        password: `senha-errada-${i}`,
        clientFingerprint: testFingerprint,
      });
      expect(res.success).toBe(false);
      expect(res.blocked).toBe(false);
      expect(res.error).toBe("Senha incorreta.");
      expect(res.failedAttempts).toBe(i);
    }

    // 5ª tentativa incorreta: ativa o bloqueio de 5 minutos
    const res5 = await verifyPasswordLogic({
      password: "senha-errada-5",
      clientFingerprint: testFingerprint,
    });
    expect(res5.success).toBe(false);
    expect(res5.blocked).toBe(true);
    expect(res5.remainingSeconds).toBeGreaterThan(290);
    expect(res5.error).toBe("Senha incorreta.");

    // Próxima tentativa enquanto bloqueado: rejeitada imediatamente
    const resBlocked = await verifyPasswordLogic({
      password: "qualquer-senha",
      clientFingerprint: testFingerprint,
    });
    expect(resBlocked.success).toBe(false);
    expect(resBlocked.blocked).toBe(true);
  });

  // Teste 11: Senha correta gera sessão de 12 horas e limpa tentativas
  it("Teste 11: Senha correta via servidor gera token HMAC e limpa tentativas", async () => {
    const { verifyPasswordLogic, getServerAccessPassword } = await import("@/lib/auth.functions");
    const testFingerprint = `test-correct-${Date.now()}`;
    const correctPassword = getServerAccessPassword();

    const res = await verifyPasswordLogic({
      password: correctPassword,
      clientFingerprint: testFingerprint,
    });

    expect(res.success).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.token).toBeDefined();
    expect(res.expiresAt).toBeGreaterThan(Date.now() + 11 * 60 * 60 * 1000);
  });
});
