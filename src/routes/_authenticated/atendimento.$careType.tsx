import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { AppShell } from "@/components/hospital/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CARE_TYPES, type CareType } from "@/lib/domain";
import { fetchAdmissions, fetchBeds, fetchWards } from "@/lib/queries";

const isCareType = (value: string): value is CareType =>
  value === "particular" || value === "sus" || value === "uti";

export const Route = createFileRoute("/_authenticated/atendimento/$careType")({
  head: ({ params }) => {
    const label = CARE_TYPES.find((c) => c.value === params.careType)?.label ?? "Atendimento";
    return {
      meta: [
        { title: `Atendimento ${label} — Triagem Nutricional Santa Lúcia` },
        {
          name: "description",
          content: `Alas e ocupação de leitos do atendimento ${label} no Hospital Santa Lúcia.`,
        },
        { property: "og:title", content: `Atendimento ${label} — Triagem Nutricional` },
        {
          property: "og:description",
          content: `Alas, leitos e internações ativas do atendimento ${label}.`,
        },
      ],
    };
  },
  component: AtendimentoPage,
});

function AtendimentoPage() {
  const { careType } = Route.useParams();
  if (!isCareType(careType)) throw notFound();

  const meta = CARE_TYPES.find((c) => c.value === careType)!;
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });
  const { data: beds = [] } = useQuery({ queryKey: ["beds"], queryFn: () => fetchBeds() });
  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions", "ativa"],
    queryFn: () => fetchAdmissions({ status: "ativa" }),
  });

  const typeWards = wards.filter((w) => w.care_type === careType);

  return (
    <AppShell
      title={`Atendimento ${meta.label}`}
      subtitle={meta.description}
      crumbs={[
        { label: "Painel", to: "/painel" },
        { label: `Atendimento ${meta.label}` },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {typeWards.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma ala cadastrada para este tipo de atendimento.{" "}
              <Link to="/admin" className="font-semibold text-primary hover:underline">
                Cadastrar na administração
              </Link>
              .
            </CardContent>
          </Card>
        )}
        {typeWards.map((ward) => {
          const wardBeds = beds.filter((b) => b.ward_id === ward.id && b.is_active);
          const bedIds = new Set(wardBeds.map((b) => b.id));
          const occupied = admissions.filter((a) => bedIds.has(a.bed_id)).length;
          return (
            <Link
              key={ward.id}
              to="/ala/$wardId"
              params={{ wardId: ward.id }}
              aria-label={`Abrir ala ${ward.name}`}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Card className="gap-0 overflow-hidden border-border/70 py-0 transition-colors group-hover:border-primary/60 group-hover:bg-muted/30">
                <div className="h-1.5 bg-primary" aria-hidden="true" />
                <CardContent className="p-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Ala · {meta.label}
                      </p>
                      <h2 className="mt-1 truncate font-display text-2xl font-bold group-hover:text-primary">
                        {ward.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ward.description || "Sem descrição"}
                      </p>
                    </div>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                      <Building2 className="size-5" aria-hidden="true" />
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted px-4 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Leitos ativos
                      </dt>
                      <dd className="mt-0.5 font-display text-3xl font-bold">{wardBeds.length}</dd>
                    </div>
                    <div className="rounded-xl bg-muted px-4 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Ocupados
                      </dt>
                      <dd className="mt-0.5 font-display text-3xl font-bold text-primary">
                        {occupied}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-success">
                        {Math.max(0, wardBeds.length - occupied)}
                      </strong>{" "}
                      leito(s) livre(s)
                    </span>
                    <Badge variant={ward.is_active ? "default" : "secondary"}>
                      {ward.is_active ? "Ala ativa" : "Ala inativa"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
