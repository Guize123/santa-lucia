import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/hospital/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CLINICAL_CONDITIONS,
  SCREENING_QUESTIONS,
  formatScreeningAnswer,
  RACE_LABELS,
  SOURCE_LABELS,
  ageFromBirthDate,
  careTypeLabel,
  daysSince,
  formatDate,
  formatDateTime,
  formatNumber,
  type Screening,
} from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { createOfflineOperation, runOrQueue } from "@/lib/offline";
import {
  fetchAdmissions,
  fetchBeds,
  fetchEstimates,
  fetchPatient,
  fetchScreenings,
  fetchWards,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/paciente/$patientId")({
  head: () => ({
    meta: [
      { title: "Ficha do paciente — Triagem Nutricional Santa Lúcia" },
      {
        name: "description",
        content:
          "Ficha individual com resumo, antropometria, condições clínicas, alimentação e mastigação, triagens e histórico de internações.",
      },
      { property: "og:title", content: "Ficha do paciente — Triagem Nutricional" },
      {
        property: "og:description",
        content: "Resumo clínico, antropometria auditada e histórico de triagens.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PacientePage,
});

function SourceBadge({ source, method }: { source: string | null; method: string | null }) {
  if (!source) return <Badge variant="outline">Origem não informada</Badge>;
  return (
    <Badge variant={source === "aferido" ? "default" : "secondary"}>
      {SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] ?? source}
      {method ? ` · ${method}` : ""}
    </Badge>
  );
}

function PacientePage() {
  const { patientId } = Route.useParams();
  const queryClient = useQueryClient();
  const [deletingScreening, setDeletingScreening] = useState<Screening | null>(null);

  const { data: patient, isPending } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => fetchPatient(patientId),
  });
  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions", "patient", patientId],
    queryFn: () => fetchAdmissions({ patientId }),
  });
  const { data: screenings = [] } = useQuery({
    queryKey: ["screenings", patientId],
    queryFn: () => fetchScreenings(patientId),
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", patientId],
    queryFn: () => fetchEstimates(patientId),
  });
  const { data: beds = [] } = useQuery({ queryKey: ["beds"], queryFn: () => fetchBeds() });
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: fetchWards });

  const bedById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const wardById = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);

  const activeAdmission = admissions.find((a) => a.status === "ativa");
  const lastScreening = screenings[0];
  const bed = activeAdmission ? bedById.get(activeAdmission.bed_id) : undefined;
  const ward = bed ? wardById.get(bed.ward_id) : undefined;

  const deleteScreening = useMutation({
    mutationFn: async () => {
      if (!deletingScreening) throw new Error("Selecione a triagem que deseja excluir.");

      let queued = false;
      const linkedEstimates = estimates.filter(
        (estimate) => estimate.screening_id === deletingScreening.id,
      );

      for (const estimate of linkedEstimates) {
        const result = await runOrQueue(
          createOfflineOperation({
            table: "anthropometric_estimates",
            action: "delete",
            recordId: estimate.id,
          }),
          async () => {
            const { error } = await supabase
              .from("anthropometric_estimates")
              .delete()
              .eq("id", estimate.id);
            if (error) throw error;
          },
        );
        queued ||= result.queued;
      }

      const result = await runOrQueue(
        createOfflineOperation({
          table: "screenings",
          action: "delete",
          recordId: deletingScreening.id,
        }),
        async () => {
          const { error } = await supabase
            .from("screenings")
            .delete()
            .eq("id", deletingScreening.id);
          if (error) throw error;
        },
      );

      return {
        queued: queued || result.queued,
        screeningId: deletingScreening.id,
        estimateIds: linkedEstimates.map((estimate) => estimate.id),
      };
    },
    onSuccess: ({ queued, screeningId, estimateIds }) => {
      queryClient.setQueryData<Screening[]>(["screenings", patientId], (current = []) =>
        current.filter((screening) => screening.id !== screeningId),
      );
      queryClient.setQueryData<typeof estimates>(["estimates", patientId], (current = []) =>
        current.filter((estimate) => !estimateIds.includes(estimate.id)),
      );
      if (!queued) {
        void queryClient.invalidateQueries({ queryKey: ["screenings", patientId] });
        void queryClient.invalidateQueries({ queryKey: ["estimates", patientId] });
      }
      toast.success(
        queued
          ? "Exclusão salva no aparelho. Ela será sincronizada quando a internet voltar."
          : "Triagem excluída com sucesso.",
      );
      setDeletingScreening(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a triagem.");
    },
  });

  if (isPending) {
    return (
      <AppShell title="Carregando ficha..." crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Skeleton className="h-64 rounded-2xl" />
      </AppShell>
    );
  }

  if (!patient) {
    return (
      <AppShell title="Paciente não encontrado" crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Não encontramos este paciente.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const age = ageFromBirthDate(patient.birth_date);

  const cond = (lastScreening?.conditions ?? {}) as Record<string, unknown>;
  const isYes = (key: string) => cond[key] === true;
  const quickFlags: { label: string; alert: boolean }[] = [
    ...(isYes("imc_menor_20_5") ? [{ label: "IMC < 20,5", alert: true }] : []),
    ...(isYes("perda_de_peso") ? [{ label: "Perda de peso", alert: true }] : []),
    ...(isYes("reducao_fome") ? [{ label: "Redução da fome", alert: true }] : []),
    ...(isYes("edema") ? [{ label: "Edema", alert: true }] : []),
    ...(isYes("dm") ? [{ label: "DM", alert: false }] : []),
    ...(isYes("has") ? [{ label: "HAS", alert: false }] : []),
    ...(isYes("intolerancia_alimentar")
      ? [
          {
            label: `Intolerância${cond["intolerancia_qual"] ? `: ${String(cond["intolerancia_qual"])}` : ""}`,
            alert: false,
          },
        ]
      : []),
    ...(isYes("protese_dentaria") ? [{ label: "Prótese dentária", alert: false }] : []),
    ...(isYes("dificuldade_alimentos_rigidos")
      ? [{ label: "Dificuldade c/ alimentos rígidos", alert: true }]
      : []),
    ...(typeof cond["funcao_intestinal"] === "string" && cond["funcao_intestinal"]
      ? [{ label: `Intestino: ${String(cond["funcao_intestinal"])}`, alert: false }]
      : []),
    ...(cond["aacoc"] === false ? [{ label: "Não AACOC", alert: true }] : []),
  ];

  return (
    <AppShell
      title={patient.full_name}
      subtitle={`Prontuário ${patient.medical_record ?? "—"} · ${
        age !== null ? `${age} anos` : "idade não informada"
      } · ${patient.sex === "M" ? "Masculino" : patient.sex === "F" ? "Feminino" : "Sexo não informado"} · Raça/cor: ${
        RACE_LABELS[patient.race]
      }`}
      crumbs={[
        { label: "Painel", to: "/painel" },
        ...(ward
          ? [
              {
                label: `Atendimento ${careTypeLabel(ward.care_type)}`,
                to: "/atendimento/$careType",
                params: { careType: ward.care_type },
              },
              { label: ward.name, to: "/ala/$wardId", params: { wardId: ward.id } },
            ]
          : []),
        { label: patient.full_name },
      ]}
      actions={
        activeAdmission ? (
          <Button asChild>
            <Link
              to="/triagem/nova/$admissionId"
              params={{ admissionId: activeAdmission.id }}
              search={{ editar: undefined }}
            >
              Nova triagem
            </Link>
          </Button>
        ) : undefined
      }
    >
      {/* Resumo rápido — visão simples ao abrir o paciente pelo leito */}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-5">
          {lastScreening ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Última triagem · {formatDateTime(lastScreening.screened_at)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickStat
                  label="Peso"
                  value={formatNumber(lastScreening.weight_kg, " kg")}
                  note={lastScreening.weight_source === "estimado" ? "estimado" : "relatado"}
                />
                <QuickStat
                  label="Altura"
                  value={formatNumber(lastScreening.height_cm, " cm")}
                  note={lastScreening.height_source === "estimado" ? "estimada" : "relatada"}
                />
                <QuickStat
                  label="IMC"
                  value={formatNumber(lastScreening.bmi, "")}
                  note={
                    lastScreening.bmi !== null && lastScreening.bmi < 20.5
                      ? "abaixo de 20,5"
                      : "kg/m²"
                  }
                  alert={lastScreening.bmi !== null && lastScreening.bmi < 20.5}
                />
                <QuickStat
                  label="CB"
                  value={formatNumber(lastScreening.arm_circumference_cm, " cm")}
                  note="circunf. braço"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {quickFlags.map((flag) => (
                  <Badge key={flag.label} variant={flag.alert ? "destructive" : "secondary"}>
                    {flag.label}
                  </Badge>
                ))}
                {quickFlags.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Sem alterações relevantes registradas.
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma triagem registrada ainda para este paciente.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="antropometria">Antropometria</TabsTrigger>
          <TabsTrigger value="condicoes">Condições clínicas</TabsTrigger>
          <TabsTrigger value="alimentacao">Alimentação e mastigação</TabsTrigger>
          <TabsTrigger value="triagens">Triagens</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internação atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {activeAdmission ? (
                  <>
                    <Info label="Situação" value="Internação ativa" />
                    <Info
                      label="Local"
                      value={`${ward?.name ?? "—"} · ${bed?.label ?? "—"} (${
                        ward ? careTypeLabel(ward.care_type) : "—"
                      })`}
                    />
                    <Info
                      label="Entrada"
                      value={`${formatDate(activeAdmission.admitted_at)} · ${daysSince(
                        activeAdmission.admitted_at,
                      )} dia(s) de internação`}
                    />
                    <Info label="Diagnóstico" value={activeAdmission.main_diagnosis ?? "—"} />
                  </>
                ) : (
                  <p className="text-muted-foreground">Paciente sem internação ativa no momento.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Última triagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lastScreening ? (
                  <>
                    <Info label="Data" value={formatDateTime(lastScreening.screened_at)} />
                    <Info
                      label="Profissional"
                      value={lastScreening.professional_name || "não informado"}
                    />
                    <Info
                      label="Tipo"
                      value={lastScreening.is_reassessment ? "Reavaliação" : "Triagem inicial"}
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-muted-foreground">Peso:</span>
                      <strong>{formatNumber(lastScreening.weight_kg, " kg")}</strong>
                      <SourceBadge
                        source={lastScreening.weight_source}
                        method={lastScreening.weight_method}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Altura:</span>
                      <strong>{formatNumber(lastScreening.height_cm, " cm")}</strong>
                      <SourceBadge
                        source={lastScreening.height_source}
                        method={lastScreening.height_method}
                      />
                    </div>
                    <Info label="IMC" value={formatNumber(lastScreening.bmi, " kg/m²")} />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhuma triagem registrada para este paciente.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações do cadastro</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {patient.notes || "Sem observações."}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="antropometria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Medidas por triagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {screenings.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma medida registrada.</p>
              )}
              {screenings.map((s) => (
                <div key={s.id} className="rounded-xl border border-border p-4">
                  <p className="font-semibold">{formatDateTime(s.screened_at)}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Measure
                      label="Peso"
                      value={formatNumber(s.weight_kg, " kg")}
                      source={s.weight_source}
                      method={s.weight_method}
                    />
                    <Measure
                      label="Altura"
                      value={formatNumber(s.height_cm, " cm")}
                      source={s.height_source}
                      method={s.height_method}
                    />
                    <Measure label="IMC" value={formatNumber(s.bmi, " kg/m²")} />
                    <Measure label="Peso usual" value={formatNumber(s.usual_weight_kg, " kg")} />
                    <Measure
                      label="Perda de peso"
                      value={`${formatNumber(s.weight_loss_percentage, "%")}${
                        s.weight_loss_period_months
                          ? ` em ${formatNumber(s.weight_loss_period_months)} mês(es)`
                          : ""
                      }`}
                    />
                    <Measure
                      label="Circ. braço"
                      value={formatNumber(s.arm_circumference_cm, " cm")}
                    />
                    <Measure
                      label="Circ. panturrilha"
                      value={formatNumber(s.calf_circumference_cm, " cm")}
                    />
                    <Measure
                      label="Altura do joelho"
                      value={formatNumber(s.knee_height_cm, " cm")}
                    />
                    <Measure
                      label="Dobra subescapular"
                      value={formatNumber(s.subscapular_skinfold_mm, " mm")}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditoria das estimativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {estimates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma estimativa registrada — todos os valores foram aferidos ou relatados.
                </p>
              )}
              {estimates.map((estimate) => (
                <div key={estimate.id} className="rounded-xl bg-surface p-4 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <p className="min-w-0 font-semibold">
                      {estimate.method} — {formatNumber(estimate.result)} {estimate.unit}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {estimate.target}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">Fórmula: {estimate.formula}</p>
                  {estimate.protocol && (
                    <p className="text-muted-foreground">Protocolo: {estimate.protocol}</p>
                  )}
                  <p className="text-muted-foreground">
                    Parâmetros:{" "}
                    {Object.entries(estimate.parameters ?? {})
                      .map(([key, value]) => `${key}=${String(value)}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(estimate.created_at)} ·{" "}
                    {estimate.professional_name || "profissional não informado"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condicoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Condições clínicas registradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {screenings.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma triagem registrada.</p>
              )}
              {screenings.map((s) => {
                const answers = SCREENING_QUESTIONS.map((q) => ({
                  ...q,
                  text: formatScreeningAnswer(s.conditions?.[q.key]),
                })).filter((q) => q.text !== null);
                const legacy = CLINICAL_CONDITIONS.filter(
                  (c) =>
                    s.conditions?.[c.key] === true &&
                    !SCREENING_QUESTIONS.some((q) => q.key === c.key),
                );
                return (
                  <div key={s.id} className="rounded-xl border border-border p-4">
                    <p className="font-semibold">{formatDateTime(s.screened_at)}</p>
                    {answers.length === 0 && legacy.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nenhuma condição assinalada nesta triagem.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {answers.map((q) => (
                          <Info key={q.key} label={q.label} value={q.text ?? "—"} />
                        ))}
                      </div>
                    )}
                    {legacy.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {legacy.map((c) => (
                          <Badge key={c.key} variant="secondary">
                            {c.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {s.clinical_notes && (
                      <p className="mt-3 text-sm text-muted-foreground">{s.clinical_notes}</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alimentacao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alimentação e mastigação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {screenings.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma triagem registrada.</p>
              )}
              {screenings.map((s) => (
                <div key={s.id} className="rounded-xl border border-border p-4 text-sm">
                  <p className="font-semibold">{formatDateTime(s.screened_at)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Info label="Apetite" value={s.appetite ?? "—"} />
                    <Info label="Aceitação da dieta" value={s.intake_acceptance ?? "—"} />
                    <Info label="Mastigação" value={s.chewing ?? "—"} />
                    <Info label="Deglutição" value={s.swallowing ?? "—"} />
                    <Info label="Tipo de dieta" value={s.diet_type ?? "—"} />
                    <Info label="Via de alimentação" value={s.feeding_route ?? "—"} />
                  </div>
                  {s.feeding_notes && (
                    <p className="mt-3 text-muted-foreground">{s.feeding_notes}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triagens">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Triagens registradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {screenings.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma triagem registrada.</p>
              )}
              {screenings.map((s) => (
                <div
                  key={s.id}
                  className="grid items-center gap-3 rounded-xl bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{formatDateTime(s.screened_at)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.professional_name || "profissional não informado"} · Peso{" "}
                      {formatNumber(s.weight_kg, " kg")} (
                      {s.weight_source ?? "origem não informada"}) · IMC {formatNumber(s.bmi)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-start">
                    <Badge variant={s.is_reassessment ? "secondary" : "default"}>
                      {s.is_reassessment ? "Reavaliação" : "Triagem inicial"}
                    </Badge>
                    <Button asChild size="icon" variant="outline" title="Editar triagem">
                      <Link
                        to="/triagem/nova/$admissionId"
                        params={{ admissionId: s.admission_id }}
                        search={{ editar: s.id }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar triagem</span>
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir triagem"
                      onClick={() => setDeletingScreening(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir triagem</span>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de internações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {admissions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma internação registrada.</p>
              )}
              {admissions.map((admission) => {
                const admissionBed = bedById.get(admission.bed_id);
                const admissionWard = admissionBed ? wardById.get(admissionBed.ward_id) : undefined;
                const count = screenings.filter((s) => s.admission_id === admission.id).length;
                return (
                  <div key={admission.id} className="rounded-xl border border-border p-4 text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {admissionWard?.name ?? "Ala removida"} · {admissionBed?.label ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {careTypeLabel(admission.care_type)} · Entrada{" "}
                          {formatDate(admission.admitted_at)}
                          {admission.discharged_at
                            ? ` · Alta ${formatDate(admission.discharged_at)}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={admission.status === "ativa" ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {admission.status === "ativa" ? "Ativa" : "Alta registrada"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Diagnóstico: {admission.main_diagnosis ?? "—"} · {count} triagem(ns)
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(deletingScreening)}
        onOpenChange={(open) => {
          if (!open && !deleteScreening.isPending) setDeletingScreening(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta triagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A triagem de {deletingScreening ? formatDateTime(deletingScreening.screened_at) : ""}{" "}
              será removida junto com seus cálculos antropométricos. O paciente e a internação não
              serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteScreening.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteScreening.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteScreening.mutate();
              }}
            >
              {deleteScreening.isPending ? "Excluindo..." : "Excluir triagem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Measure({
  label,
  value,
  source,
  method,
}: {
  label: string;
  value: string;
  source?: string | null;
  method?: string | null;
}) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
      {source !== undefined && (
        <div className="mt-1">
          <SourceBadge source={source ?? null} method={method ?? null} />
        </div>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  note,
  alert,
}: {
  label: string;
  value: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${alert ? "bg-destructive/10" : "bg-surface"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 truncate text-lg font-bold ${alert ? "text-destructive" : ""}`}>
        {value}
      </p>
      {note && <p className="truncate text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
