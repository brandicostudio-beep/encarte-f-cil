import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getClientSession } from "@/lib/auth-constants";
import { ColecoesWorkspace } from "@/components/colecoes/ColecoesWorkspace";

export const Route = createFileRoute("/colecoes")({
  head: () => ({
    meta: [
      { title: "Encarte de Coleções 9:16 - Esquenta Black Cescom" },
      {
        name: "description",
        content:
          "Crie encartes promocionais de coleções com sobreposição, grade configurável, fotos 100% nítidas e exportação PNG.",
      },
      { property: "og:title", content: "Encarte de Coleções 9:16" },
      {
        property: "og:description",
        content: "Encarte de coleções com grade configurável e exportação em alta resolução.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ColecoesRoutePage,
});

function ColecoesRoutePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getClientSession()) {
      navigate({ to: "/acesso", search: { redirect: "/colecoes" } as never });
      return;
    }
    setAuthed(true);
  }, [navigate]);

  if (!authed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <ColecoesWorkspace />
    </div>
  );
}
