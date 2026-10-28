import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAccessPasswordServer } from "@/lib/auth.functions";
import {
  saveClientSession,
  getClientSession,
  getClientLockoutRemainingSeconds,
  setClientLockout,
  clearClientLockout,
  formatCountdown,
  AUTH_FAILED_ATTEMPTS_KEY,
} from "@/lib/auth-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/acesso")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Acesso Restrito - Gerador de Encartes" },
      { name: "description", content: "Acesso exclusivo interno da equipe." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcessoPage,
});

function AcessoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/acesso" });
  const redirectTarget = search.redirect || "/";

  const verifyPasswordFn = useServerFn(verifyAccessPasswordServer);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Se já possui sessão válida, redireciona imediatamente para o destino
  useEffect(() => {
    const existing = getClientSession();
    if (existing) {
      navigate({ to: redirectTarget as any });
    }
  }, [navigate, redirectTarget]);

  // 2. Foco automático no campo de senha e restauração de bloqueio local se ativo
  useEffect(() => {
    const remaining = getClientLockoutRemainingSeconds();
    if (remaining > 0) {
      setLockoutSeconds(remaining);
      setErrorMessage("Senha incorreta.");
    }

    // Foco automático
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // 3. Contador regressivo em tempo real quando bloqueado
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearClientLockout();
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutSeconds > 0 || loading) return;

    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage("Senha incorreta.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Fingerprint do cliente para rate limiting local/navegador
      let clientFingerprint = "local-browser";
      try {
        clientFingerprint = `client-${window.navigator.userAgent.slice(0, 32)}`;
      } catch {}

      const res = await verifyPasswordFn({
        data: {
          password: trimmed,
          clientFingerprint,
        },
      });

      if (res.success && res.token && res.expiresAt) {
        // Sucesso: salva sessão de 12 horas, limpa erros e bloqueios
        saveClientSession(res.token, res.expiresAt);
        clearClientLockout();
        try {
          localStorage.removeItem(AUTH_FAILED_ATTEMPTS_KEY);
        } catch {}

        // Redireciona de volta para a rota original
        navigate({ to: redirectTarget as any });
      } else {
        // Falha no login: incrementa contagem local também
        let currentFailed = 1;
        try {
          const rawCount = localStorage.getItem(AUTH_FAILED_ATTEMPTS_KEY);
          currentFailed = rawCount ? parseInt(rawCount, 10) + 1 : 1;
          localStorage.setItem(AUTH_FAILED_ATTEMPTS_KEY, String(currentFailed));
        } catch {}

        // Se bloqueado pelo servidor ou por atingir 5 erros
        if (res.blocked || currentFailed >= 5) {
          const secs = res.remainingSeconds || 300; // 5 minutos
          setLockoutSeconds(secs);
          setClientLockout(secs);
          setErrorMessage("Senha incorreta.");
        } else {
          // Mensagem estritamente genérica conforme requisito
          setErrorMessage("Senha incorreta.");
        }

        setPassword("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Erro na verificação:", err);
      setErrorMessage("Senha incorreta.");
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = lockoutSeconds > 0;

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Decorativo com as cores do sistema (Preto, Vermelho e Amarelo) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#E30613]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#FFD400]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cartão de Acesso Responsivo */}
      <div className="w-full max-w-sm sm:max-w-md bg-[#171717] border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Cabeçalho do Cartão */}
        <div className="text-center space-y-3 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E30613] to-red-800 text-white shadow-lg mx-auto border border-red-500/30">
            <Lock className="h-7 w-7 text-white stroke-[2.2]" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFD400]/15 border border-[#FFD400]/30 text-[#FFE600] text-[11px] font-bold uppercase tracking-wider mb-2">
              <ShieldAlert className="h-3.5 w-3.5" />
              Acesso Restrito
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Gerador de Encartes
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Digite a senha interna para acessar o sistema.
            </p>
          </div>
        </div>

        {/* Formulário de Acesso */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="access-password"
              className="text-xs font-semibold text-neutral-200 block"
            >
              Senha de Acesso
            </Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="access-password"
                type={showPassword ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                disabled={isBlocked || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isBlocked ? "Bloqueado temporariamente" : "Digite a senha..."}
                className="h-11 bg-neutral-900 border-neutral-700 text-white pr-10 focus-visible:ring-2 focus-visible:ring-[#FFD400] text-sm rounded-lg"
                aria-label="Campo para digitar a senha de acesso"
                aria-describedby={errorMessage ? "error-feedback" : undefined}
                data-testid="access-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isBlocked || loading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1 rounded focus:outline-hidden focus:ring-1 focus:ring-[#FFD400]"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                data-testid="toggle-password-visibility"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mensagem de Erro Genérica */}
          {errorMessage && !isBlocked && (
            <div
              id="error-feedback"
              data-testid="access-error-message"
              className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bloqueio por 5 Tentativas Excedidas */}
          {isBlocked && (
            <div
              data-testid="lockout-banner"
              className="p-3.5 bg-amber-950/60 border border-amber-700/80 rounded-lg text-amber-200 text-xs space-y-1.5 animate-in fade-in duration-200"
              role="alert"
            >
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Clock className="h-4 w-4 text-amber-400 shrink-0 animate-spin-slow" />
                <span>Limite de 5 tentativas atingido</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Por motivos de segurança, o acesso está bloqueado por 5 minutos.
              </p>
              <div className="pt-1 flex items-center justify-between text-xs font-mono font-bold bg-black/40 px-2.5 py-1.5 rounded border border-amber-900/50">
                <span className="text-neutral-400 uppercase text-[10px]">Tempo restante:</span>
                <span data-testid="lockout-countdown" className="text-[#FFE600] text-sm">
                  {formatCountdown(lockoutSeconds)}
                </span>
              </div>
            </div>
          )}

          {/* Botão Entrar */}
          <Button
            type="submit"
            disabled={isBlocked || loading || password.length === 0}
            className="w-full h-11 bg-[#E30613] hover:bg-red-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] rounded-lg mt-2"
            data-testid="submit-access-button"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verificando...
              </span>
            ) : isBlocked ? (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Bloqueado ({formatCountdown(lockoutSeconds)})
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                Entrar no Sistema
                <ArrowRight className="h-4 w-4 ml-0.5" />
              </span>
            )}
          </Button>
        </form>

        {/* Rodapé Informativo */}
        <div className="mt-6 pt-4 border-t border-neutral-800/80 text-center">
          <p className="text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
            Sessão segura válida por 12 horas
          </p>
        </div>
      </div>
    </div>
  );
}
