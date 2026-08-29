import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CircleCheck, CircleSlash, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/hospital/AppShell";
import { NewAdmissionDialog } from "@/components/hospital/NewAdmissionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  careTypeLabel,
  daysSince,
  formatDate,
  type Bed,
} from "@/lib/domain";
import {
  fetchAdmissions,
  fetchBeds,
  fetchPatients,
  fetchRooms,
  fetchScreenings,
  fetchWard,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/ala/$wardId")({
  head: () => ({
    meta: [
      { title: "Mapa de leitos da ala — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Mapa de leitos da ala com estado de ocupação, pacientes internados e situação da triagem nutricional.",
      },
      { property: "og:title", content: "Mapa de leitos da ala — Triagem Nutricional" },
      {
        property: "og:description",
        content: "Leitos, internações ativas e situação de triagem por leito.",
      },
    ],
  }),
  component: AlaPage,
});

function AlaPage() {
  const { wardId } = Route.useParams();
  const [admissionBed, setAdmissionBed] = useState<Bed | null>(null);

  const { data: ward, isPending } = useQuery({
    queryKey: ["ward", wardId],
    queryFn: () => fetchWard(wardId),
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", wardId],
    queryFn: () => fetchRooms(wardId),
  });
  const { data: beds = [] } = useQuery({
    queryKey: ["beds", wardId],
    queryFn: () => fetchBeds(wardId),
  });
  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions", "ativa"],
    queryFn: () => fetchAdmissions({ status: "ativa" }),
  });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: screenings = [] } = useQuery({
    queryKey: ["screenings"],
    queryFn: () => fetchScreenings(),
  });

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const admissionByBed = useMemo(
    () => new Map(admissions.map((a) => [a.bed_id, a])),
    [admissions],
  );
  const lastScreeningByAdmission = useMemo(() => {
    const map = new Map<string, string>();
    for (const screening of screenings) {
      const current = map.get(screening.admission_id);
      if (!current || new Date(screening.screened_at) > new Date(current)) {
        map.set(screening.admission_id, screening.screened_at);
      }
    }
    return map;
  }, [screenings]);

  const groups = useMemo(() => {
    const withRoom = rooms.map((room) => ({
      key: room.id,
      label: room.name,
      beds: beds.filter((b) => b.room_id === room.id),
    }));
    const withoutRoom = beds.filter((b) => !b.room_id);
    return withoutRoom.length > 0
      ? [...withRoom, { key: "sem-sala", label: "Leitos sem sala", beds: withoutRoom }]
      : withRoom;
  }, [rooms, beds]);

  if (isPending) {
    return (
      <AppShell title="Carregando ala..." crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Skeleton className="h-64 rounded-2xl" />
      </AppShell>
    );
  }

  if (!ward) {
    return (
      <AppShell title="Ala não encontrada" crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta ala não existe ou foi removida da estrutura.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const activeBeds = beds.filter((b) => b.is_active);
  const occupied = activeBeds.filter((b) => admissionByBed.has(b.id)).length;

  return (
    <AppShell
      title={ward.name}
      subtitle={`${careTypeLabel(ward.care_type)} · ${occupied} de ${activeBeds.length} leito(s) ativo(s) ocupado(s)`}
      crumbs={[
        { label: "Painel", to: "/painel" },
        {
          label: `Atendimento ${careTypeLabel(ward.care_type)}`,
          to: "/atendimento/$careType",
          params: { careType: ward.care_type },
        },
        { label: ward.name },
      ]}
      actions={
        <Button asChild variant="outline">
          <Link to="/admin">Gerenciar estrutura</Link>
        </Button>
      }
    >
      {ward.description && <p className="mb-6 text-sm text-muted-foreground">{ward.description}</p>}

      <div className="space-y-8">
        {groups.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Esta ala ainda não possui leitos cadastrados.
            </CardContent>
          </Card>
        )}
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 font-display text-lg font-bold">{group.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.beds.map((bed) => {
                const admission = admissionByBed.get(bed.id);
                const patient = admission ? patientById.get(admission.patient_id) : undefined;
                const lastScreening = admission
                  ? lastScreeningByAdmission.get(admission.id)
                  : undefined;
                const inactive = !bed.is_active;

                return (
                  <Card
                    key={bed.id}
                    className={`gap-0 overflow-hidden border-border/70 py-0 ${
                      inactive ? "bg-muted/40" : ""
                    }`}
                  >
                    <div
                      className={`h-1.5 ${inactive ? "bg-border" : "bg-teal"}`}
                      aria-hidden="true"
                    />
                    <CardContent className="p-5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Leito
                          </p>
                          <p className="mt-1 truncate font-display text-xl font-bold">
                            {bed.label}
                          </p>
                        </div>
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                          {inactive ? (
                            <CircleSlash className="size-5" aria-hidden="true" />
                          ) : admission ? (
                            <BedDouble className="size-5 text-primary" aria-hidden="true" />
                          ) : (
                            <CircleCheck className="size-5 text-success" aria-hidden="true" />
                          )}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-muted px-3 py-2.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Status
                          </dt>
                          <dd className="mt-0.5 truncate text-sm font-bold">
                            {inactive ? "Inativo" : admission ? "Ocupado" : "Livre"}
                          </dd>
                        </div>
                        <div
                          className={`rounded-xl px-3 py-2.5 ${
                            admission && !lastScreening ? "bg-brand/10" : "bg-muted"
                          }`}
                        >
                          <dt
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              admission && !lastScreening ? "text-brand" : "text-muted-foreground"
                            }`}
                          >
                            Triagem
                          </dt>
                          <dd
                            className={`mt-0.5 truncate text-sm font-bold ${
                              admission && !lastScreening ? "text-brand" : ""
                            }`}
                          >
                            {inactive
                              ? "—"
                              : admission
                                ? lastScreening
                                  ? "Em dia"
                                  : "Pendente"
                                : "—"}
                          </dd>
                        </div>
                      </dl>

                      {admission && patient ? (
                        <div className="mt-4">
                          <p className="truncate font-semibold">{patient.full_name}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                            <span>Prontuário {patient.medical_record ?? "—"}</span>
                            <span>
                              Desde {formatDate(admission.admitted_at)} (
                              {daysSince(admission.admitted_at)} dia(s))
                            </span>
                          </p>
                          <Badge
                            variant={lastScreening ? "secondary" : "destructive"}
                            className="mt-2"
                          >
                            {lastScreening
                              ? `Triado em ${formatDate(lastScreening)}`
                              : "Sem triagem registrada"}
                          </Badge>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Button asChild size="sm">
                              <Link
                                to="/paciente/$patientId"
                                params={{ patientId: patient.id }}
                              >
                                Abrir ficha
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <Link
                                to="/triagem/nova/$admissionId"
                                params={{ admissionId: admission.id }}
                              >
                                Nova triagem
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
                            {inactive
                              ? "Reative o leito na administração para internar um paciente."
                              : "Nenhum paciente internado neste leito."}
                          </p>
                          {!inactive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 w-full gap-2"
                              onClick={() => setAdmissionBed(bed)}
                            >
                              <UserPlus className="size-4" />
                              Internar paciente
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <NewAdmissionDialog
        bed={admissionBed}
        careType={ward.care_type}
        onOpenChange={(open) => !open && setAdmissionBed(null)}
      />
    </AppShell>
  );
}
