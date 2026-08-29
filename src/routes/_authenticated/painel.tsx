import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BedDouble, ClipboardList, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/hospital/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CARE_TYPES, careTypeLabel, formatDateTime } from "@/lib/domain";
import { fetchOverview, fetchScreenings, fetchWards } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de atendimentos — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Painel inicial com métricas de leitos, internações ativas e triagens por tipo de atendimento: Particular, SUS e UTI.",
      },
      { property: "og:title", content: "Painel de atendimentos — Triagem Nutricional" },
      {
        property: "og:description",
        content: "Métricas de ocupação e triagem por tipo de atendimento.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data: overview, isPending } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });
  const { data: screenings = [] } = useQuery({ queryKey: ["screenings"], queryFn: () => fetchScreenings() });

  return (
    <AppShell
      title="Painel de atendimentos"
      subtitle="Selecione o tipo de atendimento para navegar até as alas, leitos e fichas."
      crumbs={[{ label: "Painel" }]}
      actions={
        <Button asChild variant="outline">
          <Link to="/admin">Administração da estrutura</Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {isPending
          ? CARE_TYPES.map((type) => <Skeleton key={type.value} className="h-56 rounded-2xl" />)
          : CARE_TYPES.map((type) => {
              const data = overview?.find((o) => o.careType === type.value);
              const typeWards = wards.filter((w) => w.care_type === type.value && w.is_active);
              return (
                <Card key={type.value} className="overflow-hidden border-border/70">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-2xl font-bold">{type.label}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                        <BedDouble className="size-5" />
                      </span>
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-3">
                      <Metric label="Leitos ativos" value={data?.beds ?? 0} />
                      <Metric label="Leitos ocupados" value={data?.occupied ?? 0} tone="brand" />
                      <Metric label="Leitos livres" value={data?.free ?? 0} tone="success" />
                      <Metric
                        label="Sem triagem"
                        value={data?.neverScreened ?? 0}
                        tone={data && data.neverScreened > 0 ? "warning" : "muted"}
                      />
                    </dl>

                    <p className="mt-4 text-xs text-muted-foreground">
                      {data?.screenedLast7Days ?? 0} triagem(ns) registrada(s) nos últimos 7 dias ·{" "}
                      {typeWards.length} ala(s) ativa(s)
                    </p>

                    <div className="mt-5 space-y-2">
                      {typeWards.length === 0 && (
                        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                          Nenhuma ala ativa cadastrada para este tipo de atendimento.
                        </p>
                      )}
                      {typeWards.map((ward) => (
                        <Button
                          key={ward.id}
                          asChild
                          variant="outline"
                          className="h-auto w-full justify-between px-4 py-3"
                        >
                          <Link to="/ala/$wardId" params={{ wardId: ward.id }}>
                            <span className="truncate text-left font-semibold">{ward.name}</span>
                            <ArrowRight className="size-4 shrink-0" />
                          </Link>
                        </Button>
                      ))}
                    </div>

                    <Button asChild className="mt-4 w-full">
                      <Link to="/atendimento/$careType" params={{ careType: type.value }}>
                        Ver atendimento {type.short}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Triagens mais recentes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {screenings.length === 0 && (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                Nenhuma triagem registrada ainda.
              </CardContent>
            </Card>
          )}
          {screenings.slice(0, 6).map((screening) => (
            <Card key={screening.id}>
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    <Link
                      to="/paciente/$patientId"
                      params={{ patientId: screening.patient_id }}
                      className="hover:underline"
                    >
                      Ficha do paciente
                    </Link>
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {formatDateTime(screening.screened_at)} · {screening.professional_name || "—"}
                  </p>
                </div>
                <Badge variant={screening.is_reassessment ? "secondary" : "default"}>
                  {screening.is_reassessment ? "Reavaliação" : "Triagem inicial"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="size-4" />
        Classificação automática de risco nutricional (NRS-2002, MUST, GLIM) não faz parte deste MVP.
        O modelo já está preparado para reavaliações e dashboard futuro.
      </p>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "brand" | "success" | "warning";
}) {
  const toneClass =
    tone === "brand"
      ? "text-brand"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning-foreground"
          : "text-foreground";
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-display text-2xl font-bold ${toneClass}`}>
        {tone === "warning" && value > 0 && <TriangleAlert className="mb-1 mr-1 inline size-4" />}
        {value}
      </dd>
    </div>
  );
}
