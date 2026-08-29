import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

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
            <Card key={ward.id} className="border-border/70">
              <CardContent className="p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-xl font-bold">{ward.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ward.description || "Sem descrição"}
                    </p>
                  </div>
                  <Badge variant={ward.is_active ? "default" : "secondary"} className="shrink-0">
                    {ward.is_active ? "Ala ativa" : "Ala inativa"}
                  </Badge>
                </div>
                <p className="mt-4 text-sm">
                  <strong>{occupied}</strong> leito(s) ocupado(s) de{" "}
                  <strong>{wardBeds.length}</strong> ativo(s) ·{" "}
                  <strong>{Math.max(0, wardBeds.length - occupied)}</strong> livre(s)
                </p>
                <Button asChild className="mt-5 w-full justify-between">
                  <Link to="/ala/$wardId" params={{ wardId: ward.id }}>
                    Abrir mapa de leitos
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
