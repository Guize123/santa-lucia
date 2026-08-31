import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Printer, Tag, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/hospital/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CARE_TYPES, formatDate, formatDietLabel } from "@/lib/domain";
import {
  buildOverview,
  fetchAdmissions,
  fetchBeds,
  fetchPatients,
  fetchRooms,
  fetchScreenings,
  fetchWards,
} from "@/lib/queries";
import { useMemo } from "react";

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
  const { data: wards = [], isPending } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });
  const { data: beds = [] } = useQuery({ queryKey: ["beds"], queryFn: () => fetchBeds() });
  const { data: rooms = [] } = useQuery({ queryKey: ["rooms"], queryFn: () => fetchRooms() });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });
  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions", "ativa"],
    queryFn: () => fetchAdmissions({ status: "ativa" }),
  });
  const { data: screenings = [] } = useQuery({
    queryKey: ["screenings"],
    queryFn: () => fetchScreenings(),
  });
  const overview = useMemo(
    () => buildOverview(wards, beds, admissions, screenings),
    [wards, beds, admissions, screenings],
  );

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
      <Tabs defaultValue="visao-geral">
        <TabsList className="mb-5">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="etiquetas">
            <Tag className="size-4" aria-hidden="true" />
            Etiquetas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="etiquetas" className="mt-0">
          <EtiquetasTab
            wards={wards}
            beds={beds}
            rooms={rooms}
            patients={patients}
            admissions={admissions}
          />
        </TabsContent>
        <TabsContent value="visao-geral" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-3">
            {isPending
              ? CARE_TYPES.map((type) => <Skeleton key={type.value} className="h-56 rounded-2xl" />)
              : CARE_TYPES.map((type) => {
                  const data = overview?.find((o) => o.careType === type.value);
                  const typeWards = wards.filter((w) => w.care_type === type.value && w.is_active);
                  return (
                    <Link
                      key={type.value}
                      to="/atendimento/$careType"
                      params={{ careType: type.value }}
                      aria-label={`Abrir atendimento ${type.label}`}
                      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Card className="gap-0 overflow-hidden border-border/70 py-0 transition-colors group-hover:border-primary/60 group-hover:bg-muted/30">
                        <div className="h-1.5 bg-primary" aria-hidden="true" />
                        <CardContent className="p-6">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Tipo de atendimento
                              </p>
                              <h2 className="mt-1 truncate font-display text-2xl font-bold group-hover:text-primary">
                                {type.label}
                              </h2>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {type.description}
                              </p>
                            </div>
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                              <BedDouble className="size-5" />
                            </span>
                          </div>

                          <dl className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-muted px-4 py-3">
                              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Leitos ativos
                              </dt>
                              <dd className="mt-0.5 font-display text-3xl font-bold">
                                {data?.beds ?? 0}
                              </dd>
                            </div>
                            <div
                              className={`rounded-xl px-4 py-3 ${
                                data && data.neverScreened > 0 ? "bg-brand/10" : "bg-muted"
                              }`}
                            >
                              <dt
                                className={`text-[11px] font-semibold uppercase tracking-wide ${
                                  data && data.neverScreened > 0
                                    ? "text-brand"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Sem triagem
                              </dt>
                              <dd
                                className={`mt-0.5 font-display text-3xl font-bold ${
                                  data && data.neverScreened > 0 ? "text-brand" : ""
                                }`}
                              >
                                {data && data.neverScreened > 0 && (
                                  <TriangleAlert
                                    className="mb-1 mr-1 inline size-5"
                                    aria-hidden="true"
                                  />
                                )}
                                {data?.neverScreened ?? 0}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                            <span>
                              <strong className="text-foreground">{data?.occupied ?? 0}</strong>{" "}
                              ocupado(s)
                            </span>
                            <span>
                              <strong className="text-success">{data?.free ?? 0}</strong> livre(s)
                            </span>
                            <span>
                              <strong className="text-foreground">
                                {data?.screenedLast7Days ?? 0}
                              </strong>{" "}
                              triagem(ns) em 7 dias
                            </span>
                            <span>
                              <strong className="text-foreground">{typeWards.length}</strong> ala(s)
                              ativa(s)
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

interface EtiquetasTabProps {
  wards: import("@/lib/domain").Ward[];
  beds: import("@/lib/domain").Bed[];
  rooms: import("@/lib/domain").Room[];
  patients: import("@/lib/domain").Patient[];
  admissions: import("@/lib/domain").Admission[];
}

function EtiquetasTab({ wards, beds, rooms, patients, admissions }: EtiquetasTabProps) {
  const etiquetas = useMemo(
    () =>
      admissions.map((admission) => {
        const patient = patients.find((p) => p.id === admission.patient_id);
        const bed = beds.find((b) => b.id === admission.bed_id);
        const ward = bed ? wards.find((w) => w.id === bed.ward_id) : undefined;
        const room = bed?.room_id ? rooms.find((r) => r.id === bed.room_id) : undefined;
        return { admission, patient, bed, ward, room };
      }),
    [admissions, patients, beds, wards, rooms],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          Etiquetas de dieta (7,5 cm × 3 cm) dos pacientes internados, agrupadas por tipo de
          atendimento.
        </p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Imprimir etiquetas
        </Button>
      </div>

      <div className="etiquetas-print space-y-8">
        {CARE_TYPES.map((type) => {
          const group = etiquetas.filter((e) => e.admission.care_type === type.value);
          return (
            <section key={type.value} aria-labelledby={`etiquetas-${type.value}`}>
              <div className="flex items-center gap-3 print:hidden">
                <h2
                  id={`etiquetas-${type.value}`}
                  className="font-display text-xl font-bold text-foreground"
                >
                  {type.label}
                </h2>
                <Badge variant="secondary">{group.length} etiqueta(s)</Badge>
              </div>

              {group.length === 0 ? (
                <Card className="mt-4 print:hidden">
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    Nenhum paciente internado neste atendimento.
                  </CardContent>
                </Card>
              ) : (
                <div className="etiquetas-grupo mt-4 flex flex-wrap gap-4">
                  {group.map(({ admission, patient, bed, ward }) => (
                    <Etiqueta
                      key={admission.id}
                      patient={patient}
                      wardLabel={ward?.name ?? ""}
                      bedLabel={bed?.label ?? ""}
                      diet={formatDietLabel(admission.diet_note, admission.notes)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface EtiquetaProps {
  patient: import("@/lib/domain").Patient | undefined;
  wardLabel: string;
  bedLabel: string;
  diet: string;
}

/** Etiqueta física de 7,5 cm × 3 cm, replicando o modelo impresso do hospital. */
function Etiqueta({ patient, wardLabel, bedLabel, diet }: EtiquetaProps) {
  const sexo = patient?.sex === "M" ? "Masc." : patient?.sex === "F" ? "Fem." : "";
  const nascimento = patient?.birth_date ? formatDate(patient.birth_date) : "";
  const leito = bedLabel.replace(/^(?:leito|lt\.?)\s*:?\s*/i, "");

  return (
    <article
      className="etiqueta flex shrink-0 flex-col justify-between bg-white px-[2mm] py-[1.5mm] text-black"
      style={{ width: "75mm", height: "30mm", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <p className="truncate text-[11.5px] font-bold uppercase leading-[1.1]">
        {patient?.full_name ?? ""}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 text-[10px] leading-[1.1]">
        <p className="truncate">
          {sexo} {nascimento}
        </p>
        <p className="max-w-[40mm] truncate text-right">
          {wardLabel} <span className="whitespace-nowrap">Lt:{leito}</span>
        </p>
      </div>
      <p className="truncate text-[10px] leading-[1.1]">Mãe: {patient?.mother_name ?? ""}</p>
      <p className="flex items-end gap-1 text-[10px] leading-[1.1]">
        <span className="shrink-0">Dieta:</span>
        <span className="min-w-0 flex-1 truncate border-b border-black pb-[1px] font-semibold">
          {diet}
        </span>
      </p>
    </article>
  );
}
