import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getClientSession } from "@/lib/auth-constants";
import { EncarteSemanalWorkspace } from "@/components/encarte-semanal/EncarteSemanalWorkspace";

export const Route = createFileRoute("/encarte-semanal")({
  head: () => ({
    meta: [
      { title: "Encarte Semanal - Ofertas da Semana - Cescom" },
      {
        name: "description",
        content:
          "Crie encartes de ofertas semanais com modelo fixo permanente, 20 produtos por tela, fotos nítidas e exportação PNG.",
      },
      { property: "og:title", content: "Encarte Semanal - Ofertas da Semana" },
      {
        property: "og:description",
        content: "Encarte semanal permanente com grade de 20 produtos e exportação PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EncarteSemanalRoutePage,
});

function EncarteSemanalRoutePage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getClientSession()) {
      navigate({ to: "/acesso", search: { redirect: "/encarte-semanal" } as never });
      return;
    }
    setAuthed(true);
  }, [navigate]);

  if (!authed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <EncarteSemanalWorkspace />
    </div>
  );
}
