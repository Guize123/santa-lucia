import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/hospital/AppShell";
import { BedCard } from "@/components/hospital/BedCard";
import { NewAdmissionDialog } from "@/components/hospital/NewAdmissionDialog";
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

export const Route = createFileRoute("/_authenticated/quarto/$roomId")({
  head: () => ({
    meta: [
      { title: "Leitos do quarto — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Leitos do quarto com estado de ocupação, pacientes internados e situação da triagem nutricional.",
      },
      { property: "og:title", content: "Leitos do quarto — Triagem Nutricional" },
      {
        property: "og:description",
        content: "Leitos, internações ativas e situação de triagem por leito no quarto.",
      },
    ],
  }),
  component: QuartoPage,
});

function QuartoPage() {
  const { roomId } = Route.useParams();
  const [admissionBed, setAdmissionBed] = useState<Bed | null>(null);

  const { data: rooms = [], isPending: roomsPending } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(),
  });
  const room = rooms.find((r) => r.id === roomId);

  const { data: ward } = useQuery({
    queryKey: ["ward", room?.ward_id],
    queryFn: () => fetchWard(room!.ward_id),
    enabled: !!room,
  });
  const { data: allBeds = [] } = useQuery({
    queryKey: ["beds", room?.ward_id],
    queryFn: () => fetchBeds(room!.ward_id),
    enabled: !!room,
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

  const beds = useMemo(() => allBeds.filter((b) => b.room_id === roomId), [allBeds, roomId]);
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const admissionByBed = useMemo(() => new Map(admissions.map((a) => [a.bed_id, a])), [admissions]);
  const lastScreeningByAdmission = useMemo(() => {
    const map = new Map<string, (typeof screenings)[number]>();
    for (const screening of screenings) {
      const current = map.get(screening.admission_id);
      if (!current || new Date(screening.screened_at) > new Date(current.screened_at)) {
        map.set(screening.admission_id, screening);
      }
    }
    return map;
  }, [screenings]);

  if (roomsPending) {
    return (
      <AppShell title="Carregando quarto..." crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Skeleton className="h-64 rounded-2xl" />
      </AppShell>
    );
  }

  if (!room) {
    return (
      <AppShell title="Quarto não encontrado" crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Este quarto não existe ou foi removido da estrutura.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const activeBeds = beds.filter((b) => b.is_active);
  const occupied = activeBeds.filter((b) => admissionByBed.has(b.id)).length;

  return (
    <AppShell
      title={room.name}
      subtitle={
        ward
          ? `${ward.name} · ${careTypeLabel(ward.care_type)} · ${occupied} de ${activeBeds.length} leito(s) ativo(s) ocupado(s)`
          : undefined
      }
      crumbs={[
        { label: "Painel", to: "/painel" },
        ...(ward
          ? [
              {
                label: `Atendimento ${careTypeLabel(ward.care_type)}`,
                to: "/atendimento/$careType" as const,
                params: { careType: ward.care_type },
              },
              { label: ward.name, to: "/ala/$wardId" as const, params: { wardId: ward.id } },
            ]
          : []),
        { label: room.name },
      ]}
      actions={
        <Button asChild variant="outline">
          <Link to="/admin">Gerenciar estrutura</Link>
        </Button>
      }
    >
      {beds.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Este quarto ainda não possui leitos cadastrados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {beds.map((bed) => {
            const admission = admissionByBed.get(bed.id);
            return (
              <BedCard
                key={bed.id}
                bed={bed}
                admission={admission}
                patient={admission ? patientById.get(admission.patient_id) : undefined}
                latestScreening={admission ? lastScreeningByAdmission.get(admission.id) : undefined}
                onAdmit={setAdmissionBed}
              />
            );
          })}
        </div>
      )}

      {ward && (
        <NewAdmissionDialog
          bed={admissionBed}
          careType={ward.care_type}
          onOpenChange={(open) => !open && setAdmissionBed(null)}
        />
      )}
    </AppShell>
  );
}
