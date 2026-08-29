import { createFileRoute, Link } from "@tanstack/react-router";
import { BedDouble, ClipboardList, Ruler, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CARE_TYPES } from "@/lib/domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Triagem Nutricional — Hospital Santa Lúcia" },
      {
        name: "description",
        content:
          "Acesso restrito ao sistema de triagem nutricional do Hospital Santa Lúcia: estrutura de alas, leitos, internações e fichas dos pacientes.",
      },
      { property: "og:title", content: "Triagem Nutricional — Hospital Santa Lúcia" },
      {
        property: "og:description",
        content:
          "Sistema hospitalar de triagem nutricional com estrutura Particular, SUS e UTI, antropometria e histórico.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BedDouble,
    title: "Estrutura hospitalar completa",
    text: "Alas por tipo de atendimento, salas opcionais e leitos com estado explícito.",
  },
  {
    icon: ClipboardList,
    title: "Ficha do paciente",
    text: "Resumo, antropometria, condições clínicas, alimentação, triagens e histórico.",
  },
  {
    icon: Ruler,
    title: "Antropometria auditável",
    text: "IMC, perda de peso e estimativas de Chumlea com registro de método e fórmula.",
  },
  {
    icon: ShieldCheck,
    title: "Dados protegidos",
    text: "Nenhum dado de paciente é público. Acesso somente para profissionais autenticados.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          Ambiente de demonstração · dados fictícios
        </span>
        <h1 className="mt-5 max-w-3xl font-display text-3xl font-extrabold leading-tight sm:text-5xl">
          Triagem Nutricional — Hospital Santa Lúcia
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Fluxo hospitalar do leito à ficha: identifique rapidamente quem já foi triado, registre
          antropometria com auditoria de cada estimativa e preserve todo o histórico de internações e
          triagens.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Entrar no sistema</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ modo: "cadastro" }}>
              Criar acesso profissional
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {CARE_TYPES.map((type) => (
            <Card key={type.value} className="border-border/70">
              <CardContent className="p-5">
                <p className="font-display text-lg font-bold">{type.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <feature.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{feature.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
