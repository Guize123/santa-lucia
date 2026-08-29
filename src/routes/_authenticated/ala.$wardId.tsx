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
                    className={`border-2 ${
                      inactive
                        ? "border-dashed border-border bg-muted/40"
                        : admission
                          ? "border-primary/30"
                          : "border-success/40"
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-bold">{bed.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {inactive
                              ? "Leito inativo (bloqueado para novas internações)"
                              : admission
                                ? "Leito ocupado"
                                : "Leito livre"}
                          </p>
                        </div>
                        <span className="shrink-0">
                          {inactive ? (
                            <CircleSlash className="size-5 text-muted-foreground" />
                          ) : admission ? (
                            <BedDouble className="size-5 text-primary" />
                          ) : (
                            <CircleCheck className="size-5 text-success" />
                          )}
                        </span>
                      </div>

                      {admission && patient ? (
                        <div className="mt-4 space-y-2">
                          <p className="truncate font-semibold">{patient.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Prontuário {patient.medical_record ?? "—"} · Internado desde{" "}
                            {formatDate(admission.admitted_at)} ({daysSince(admission.admitted_at)}{" "}
                            dia(s))
                          </p>
                          <Badge variant={lastScreening ? "secondary" : "destructive"}>
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
                          <p className="text-sm text-muted-foreground">
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
