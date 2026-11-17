import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getClientSession } from "@/lib/auth-constants";
import { PainelValidadeWorkspace } from "@/components/painel-validade/PainelValidadeWorkspace";
import type {
  ValidadeFilterParams,
  FaixaVencimento,
  FaixaEscoaTempo,
  FaixaGiroMes,
  FaixaCobertura,
  RitmoMesStatus,
} from "@/types/painel-validade";

export const Route = createFileRoute("/painel-validade")({
  validateSearch: (search: Record<string, unknown>): Partial<ValidadeFilterParams> => {
    return {
      busca: typeof search?.busca === "string" ? search.busca : undefined,
      filtroRapido:
        search?.filtroRapido === "critico" ||
        search?.filtroRapido === "vence_7d" ||
        search?.filtroRapido === "vai_sobrar" ||
        search?.filtroRapido === "parado" ||
        search?.filtroRapido === "todos"
          ? (search.filtroRapido as ValidadeFilterParams["filtroRapido"])
          : undefined,
      faixaVencimento:
        typeof search?.faixaVencimento === "string"
          ? (search.faixaVencimento as FaixaVencimento | "todas")
          : undefined,
      faixaEscoaTempo:
        typeof search?.faixaEscoaTempo === "string"
          ? (search.faixaEscoaTempo as FaixaEscoaTempo | "todas")
          : undefined,
      faixaGiroMes:
        typeof search?.faixaGiroMes === "string"
          ? (search.faixaGiroMes as FaixaGiroMes | "todas")
          : undefined,
      faixaCobertura:
        typeof search?.faixaCobertura === "string"
          ? (search.faixaCobertura as FaixaCobertura | "todas")
          : undefined,
      ritmoMes:
        typeof search?.ritmoMes === "string"
          ? (search.ritmoMes as RitmoMesStatus | "todas")
          : undefined,
      noEncarte:
        search?.noEncarte === "sim" || search?.noEncarte === "nao" || search?.noEncarte === "todos"
          ? (search.noEncarte as "todos" | "sim" | "nao")
          : undefined,
      comprador: typeof search?.comprador === "string" ? search.comprador : undefined,
      ordenacao:
        typeof search?.ordenacao === "string"
          ? (search.ordenacao as ValidadeFilterParams["ordenacao"])
          : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Painel de Validade e Giro (Interno) - Geraencarte" },
      {
        name: "description",
        content: "Painel de controle visual interno de validade e giro por lote.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PainelValidadeRoutePage,
});

function PainelValidadeRoutePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/painel-validade" });
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getClientSession()) {
      navigate({
        to: "/acesso",
        search: { redirect: "/painel-validade" } as never,
      });
      return;
    }
    setAuthed(true);
  }, [navigate]);

  const handleFiltersChange = useCallback(
    (newFilters: ValidadeFilterParams) => {
      // Sincroniza os filtros na URL sem recarregar a página
      navigate({
        to: "/painel-validade",
        search: {
          busca: newFilters.busca || undefined,
          filtroRapido: newFilters.filtroRapido !== "todos" ? newFilters.filtroRapido : undefined,
          faixaVencimento:
            newFilters.faixaVencimento !== "todas" ? newFilters.faixaVencimento : undefined,
          faixaEscoaTempo:
            newFilters.faixaEscoaTempo !== "todas" ? newFilters.faixaEscoaTempo : undefined,
          faixaGiroMes:
            newFilters.faixaGiroMes !== "todas" ? newFilters.faixaGiroMes : undefined,
          faixaCobertura:
            newFilters.faixaCobertura !== "todas" ? newFilters.faixaCobertura : undefined,
          ritmoMes: newFilters.ritmoMes !== "todas" ? newFilters.ritmoMes : undefined,
          noEncarte: newFilters.noEncarte !== "todos" ? newFilters.noEncarte : undefined,
          comprador: newFilters.comprador !== "todos" ? newFilters.comprador : undefined,
          ordenacao:
            newFilters.ordenacao !== "critico_primeiro" ? newFilters.ordenacao : undefined,
        } as never,
        replace: true,
      });
    },
    [navigate]
  );

  if (!authed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <PainelValidadeWorkspace
        initialFilters={search}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
