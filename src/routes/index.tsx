import { createFileRoute } from "@tanstack/react-router";

import { AccessSelection } from "@/components/hospital/AccessSelection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content: "Selecione o perfil de acesso ao sistema de triagem nutricional.",
      },
    ],
  }),
  component: AccessSelection,
});
