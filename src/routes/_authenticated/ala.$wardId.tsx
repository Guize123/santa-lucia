import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/hospital/AppShell";
import { BedCard } from "@/components/hospital/BedCard";
import { NewAdmissionDialog } from "@/components/hospital/NewAdmissionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { careTypeLabel, type Bed } from "@/lib/domain";
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
      { title: "Mapa da ala — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Quartos e leitos da ala com estado de ocupação, pacientes internados e situação da triagem nutricional.",
      },
      { property: "og:title", content: "Mapa da ala — Triagem Nutricional" },
      {
        property: "og:description",
        content: "Quartos, leitos, internações ativas e situação de triagem da ala.",
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

  const bedsWithoutRoom = useMemo(() => beds.filter((b) => !b.room_id), [beds]);

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
  const crumbs = [
    { label: "Painel", to: "/painel" as const },
    {
      label: `Atendimento ${careTypeLabel(ward.care_type)}`,
      to: "/atendimento/$careType" as const,
      params: { careType: ward.care_type },
    },
    { label: ward.name },
  ];

  return (
    <AppShell
      title={ward.name}
      subtitle={`${careTypeLabel(ward.care_type)} · ${occupied} de ${activeBeds.length} leito(s) ativo(s) ocupado(s)`}
      crumbs={crumbs}
      actions={
        <Button asChild variant="outline">
          <Link to="/admin">Gerenciar estrutura</Link>
        </Button>
      }
    >
      {ward.description && <p className="mb-6 text-sm text-muted-foreground">{ward.description}</p>}

      {rooms.length === 0 && beds.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta ala ainda não possui quartos nem leitos cadastrados.
          </CardContent>
        </Card>
      )}

      {/* Ala com quartos: lista de blocos retangulares de quartos */}
      {rooms.length > 0 && (
        <div className="grid gap-4">
          {rooms.map((room) => {
            const roomBeds = beds.filter((b) => b.room_id === room.id);
            const roomActive = roomBeds.filter((b) => b.is_active);
            const roomOccupied = roomActive.filter((b) => admissionByBed.has(b.id)).length;
            const pendingScreening = roomActive.filter((b) => {
              const admission = admissionByBed.get(b.id);
              return admission && !lastScreeningByAdmission.has(admission.id);
            }).length;

            return (
              <Link
                key={room.id}
                to="/quarto/$roomId"
                params={{ roomId: room.id }}
                aria-label={`Abrir quarto ${room.name}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card className="gap-0 overflow-hidden border-border/70 py-0 transition-colors group-hover:border-primary/60 group-hover:bg-muted/30">
                  <div className="h-1.5 bg-primary" aria-hidden="true" />
                  <CardContent className="p-5 sm:p-6">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Quarto · {ward.name}
                        </p>
                        <h2 className="mt-1 truncate font-display text-2xl font-bold group-hover:text-primary">
                          {room.name}
                        </h2>
                      </div>
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                        <DoorOpen className="size-5" aria-hidden="true" />
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
                      <div className="rounded-xl bg-muted px-4 py-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Leitos
                        </dt>
                        <dd className="mt-0.5 font-display text-3xl font-bold">
                          {roomActive.length}
                        </dd>
                      </div>
                      <div
                        className={`rounded-xl px-4 py-3 ${
                          pendingScreening > 0 ? "bg-brand/10" : "bg-muted"
                        }`}
                      >
                        <dt
                          className={`text-[11px] font-semibold uppercase tracking-wide ${
                            pendingScreening > 0 ? "text-brand" : "text-muted-foreground"
                          }`}
                        >
                          {pendingScreening > 0 ? "Triagem pendente" : "Ocupados"}
                        </dt>
                        <dd
                          className={`mt-0.5 font-display text-3xl font-bold ${
                            pendingScreening > 0 ? "text-brand" : "text-primary"
                          }`}
                        >
                          {pendingScreening > 0 ? pendingScreening : roomOccupied}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-primary">{roomOccupied}</strong> ocupado(s)
                      </span>
                      <span>
                        <strong className="text-success">
                          {Math.max(0, roomActive.length - roomOccupied)}
                        </strong>{" "}
                        livre(s)
                      </span>
                      {pendingScreening > 0 && (
                        <Badge variant="destructive">
                          {pendingScreening} triagem(ns) pendente(s)
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Ala sem quartos (ou leitos avulsos): leitos diretamente na tela da ala */}
      {(rooms.length === 0 ? beds : bedsWithoutRoom).length > 0 && (
        <section className={rooms.length > 0 ? "mt-8" : undefined}>
          {rooms.length > 0 && (
            <h2 className="mb-3 font-display text-lg font-bold">Leitos sem quarto</h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(rooms.length === 0 ? beds : bedsWithoutRoom).map((bed) => {
              const admission = admissionByBed.get(bed.id);
              return (
                <BedCard
                  key={bed.id}
                  bed={bed}
                  admission={admission}
                  patient={admission ? patientById.get(admission.patient_id) : undefined}
                  lastScreening={
                    admission ? lastScreeningByAdmission.get(admission.id) : undefined
                  }
                  onAdmit={setAdmissionBed}
                />
              );
            })}
          </div>
        </section>
      )}

      <NewAdmissionDialog
        bed={admissionBed}
        careType={ward.care_type}
        onOpenChange={(open) => !open && setAdmissionBed(null)}
      />
    </AppShell>
  );
}
