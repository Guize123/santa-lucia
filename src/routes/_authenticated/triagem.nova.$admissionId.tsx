import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/hospital/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateArmCircumferenceAdequacy,
  nutritionalDiagnosisFromArm,
} from "@/lib/armCircumference";
import {
  calculateBMI,
  calculateHeightChumlea,
  calculateWeightChumleaArmKnee,
  type ChumleaProtocol,
  type EstimateAudit,
  type Sex,
} from "@/lib/anthropometricCalculations";
import {
  RACE_LABELS,
  SOURCE_LABELS,
  ageFromBirthDate,
  careTypeLabel,
  formatDate,
  formatNumber,
  nanLabel,
  nextScreeningDate,
  type MeasureSource,
  type NanLevel,
} from "@/lib/domain";
import {
  fetchAdmissions,
  fetchBeds,
  fetchEstimates,
  fetchPatient,
  fetchScreenings,
  fetchWard,
} from "@/lib/queries";
import { createOfflineOperation, runOrQueue } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/triagem/nova/$admissionId")({
  validateSearch: (search: Record<string, unknown>) => ({
    editar: typeof search["editar"] === "string" ? search["editar"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nova triagem nutricional — Hospital Santa Lúcia" },
      {
        name: "description",
        content:
          "Roteiro de triagem nutricional: peso e altura com origem explícita, IMC automático, comorbidades, dentição, função intestinal, edema e observações.",
      },
      { property: "og:title", content: "Nova triagem nutricional" },
      {
        property: "og:description",
        content: "Antropometria com origem explícita das medidas e auditoria das estimativas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NovaTriagemPage,
});

type YesNo = "" | "sim" | "nao";

const num = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const toBool = (value: YesNo): boolean | null => (value === "" ? null : value === "sim");

function NovaTriagemPage() {
  const { admissionId } = Route.useParams();
  const { editar: screeningIdToEdit } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: admissions = [] } = useQuery({
    queryKey: ["admissions"],
    queryFn: () => fetchAdmissions(),
  });
  const admission = admissions.find((a) => a.id === admissionId);
  const { data: patient } = useQuery({
    queryKey: ["patient", admission?.patient_id],
    queryFn: () => fetchPatient(admission!.patient_id),
    enabled: !!admission,
  });
  const { data: beds = [] } = useQuery({ queryKey: ["beds"], queryFn: () => fetchBeds() });
  const bed = beds.find((b) => b.id === admission?.bed_id);
  const { data: ward } = useQuery({
    queryKey: ["ward", bed?.ward_id],
    queryFn: () => fetchWard(bed!.ward_id),
    enabled: !!bed,
  });
  const { data: screenings = [], isPending: screeningsPending } = useQuery({
    queryKey: ["screenings", patient?.id],
    queryFn: () => fetchScreenings(patient!.id),
    enabled: !!patient,
  });
  const { data: estimates = [], isPending: estimatesPending } = useQuery({
    queryKey: ["estimates", patient?.id],
    queryFn: () => fetchEstimates(patient!.id),
    enabled: !!patient,
  });
  const editingScreening = screeningIdToEdit
    ? screenings.find((screening) => screening.id === screeningIdToEdit)
    : undefined;

  const [professionalName, setProfessionalName] = useState("");
  const [isReassessment, setIsReassessment] = useState(false);

  // Peso e altura
  const [knowsWeight, setKnowsWeight] = useState<YesNo>("sim");
  const [weightInput, setWeightInput] = useState("");
  const [directWeightSource, setDirectWeightSource] = useState<"aferido" | "relatado">("relatado");
  const [knowsHeight, setKnowsHeight] = useState<YesNo>("sim");
  const [heightInput, setHeightInput] = useState("");
  const [directHeightSource, setDirectHeightSource] = useState<"aferido" | "relatado">("relatado");
  const [protocol, setProtocol] = useState<ChumleaProtocol | "">("");
  const [arm, setArm] = useState("");
  const [knee, setKnee] = useState("");

  // Roteiro clínico
  const [dm, setDm] = useState<YesNo>("");
  const [has, setHas] = useState<YesNo>("");
  const [intolerance, setIntolerance] = useState<YesNo>("");
  const [intoleranceWhich, setIntoleranceWhich] = useState("");
  const [denture, setDenture] = useState<YesNo>("");
  const [fullDentition, setFullDentition] = useState<YesNo>("");
  const [hardFoodDifficulty, setHardFoodDifficulty] = useState<YesNo>("");
  const [hungerReduction, setHungerReduction] = useState<YesNo>("");
  const [weightLoss, setWeightLoss] = useState<YesNo>("");
  const [usualWeight, setUsualWeight] = useState("");
  const [lossMonths, setLossMonths] = useState("");
  const [bowel, setBowel] = useState("");
  const [edema, setEdema] = useState<YesNo>("");
  const [aacoc, setAacoc] = useState<YesNo>("");
  const [aacocDescription, setAacocDescription] = useState("");
  const [intubated, setIntubated] = useState<YesNo>("");
  const [observation, setObservation] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const loadedScreeningId = useRef<string | null>(null);

  useEffect(() => {
    if (
      !screeningIdToEdit ||
      !editingScreening ||
      screeningsPending ||
      estimatesPending ||
      loadedScreeningId.current === editingScreening.id
    ) {
      return;
    }

    const existingConditions = (editingScreening.conditions ?? {}) as Record<string, unknown>;
    const yesNo = (value: unknown): YesNo =>
      value === true ? "sim" : value === false ? "nao" : "";
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    const matchingEstimate = estimates.find(
      (estimate) =>
        estimate.screening_id === editingScreening.id &&
        (estimate.protocol === "branca" || estimate.protocol === "negra"),
    );
    const inferredProtocol =
      matchingEstimate?.protocol === "branca" || matchingEstimate?.protocol === "negra"
        ? matchingEstimate.protocol
        : patient?.race === "preta"
          ? "negra"
          : "branca";

    setProfessionalName(editingScreening.professional_name ?? "");
    setIsReassessment(editingScreening.is_reassessment);
    setKnowsWeight(editingScreening.weight_source === "estimado" ? "nao" : "sim");
    setWeightInput(
      editingScreening.weight_source === "estimado" || editingScreening.weight_kg === null
        ? ""
        : String(editingScreening.weight_kg),
    );
    setDirectWeightSource(editingScreening.weight_source === "aferido" ? "aferido" : "relatado");
    setKnowsHeight(editingScreening.height_source === "estimado" ? "nao" : "sim");
    setHeightInput(
      editingScreening.height_source === "estimado" || editingScreening.height_cm === null
        ? ""
        : String(editingScreening.height_cm),
    );
    setDirectHeightSource(editingScreening.height_source === "aferido" ? "aferido" : "relatado");
    setProtocol(
      editingScreening.weight_source === "estimado" || editingScreening.height_source === "estimado"
        ? inferredProtocol
        : "",
    );
    setArm(
      editingScreening.arm_circumference_cm === null
        ? ""
        : String(editingScreening.arm_circumference_cm),
    );
    setKnee(
      editingScreening.knee_height_cm === null ? "" : String(editingScreening.knee_height_cm),
    );
    setDm(yesNo(existingConditions["dm"]));
    setHas(yesNo(existingConditions["has"]));
    setIntolerance(yesNo(existingConditions["intolerancia_alimentar"]));
    setIntoleranceWhich(text(existingConditions["intolerancia_qual"]));
    setDenture(yesNo(existingConditions["protese_dentaria"]));
    setFullDentition(yesNo(existingConditions["denticao_completa"]));
    setHardFoodDifficulty(yesNo(existingConditions["dificuldade_alimentos_rigidos"]));
    setHungerReduction(yesNo(existingConditions["reducao_fome"]));
    setWeightLoss(yesNo(existingConditions["perda_de_peso"]));
    setUsualWeight(
      editingScreening.usual_weight_kg === null ? "" : String(editingScreening.usual_weight_kg),
    );
    setLossMonths(
      editingScreening.weight_loss_period_months === null
        ? ""
        : String(editingScreening.weight_loss_period_months),
    );
    setBowel(text(existingConditions["funcao_intestinal"]));
    setEdema(yesNo(existingConditions["edema"]));
    setAacoc(yesNo(existingConditions["aacoc"]));
    setAacocDescription(text(existingConditions["aacoc_descricao"]));
    setIntubated(yesNo(existingConditions["intubado"]));
    setObservation(editingScreening.clinical_notes ?? "");
    loadedScreeningId.current = editingScreening.id;
  }, [
    editingScreening,
    estimates,
    estimatesPending,
    patient?.race,
    screeningIdToEdit,
    screeningsPending,
  ]);

  const sex = (patient?.sex === "M" ? "M" : "F") as Sex;
  const race = patient?.race ?? "nao_informado";
  const age = ageFromBirthDate(patient?.birth_date ?? null);
  const explicitProtocol = protocol || undefined;
  const needsEstimate = knowsWeight === "nao" || knowsHeight === "nao";
  const nanLevel: NanLevel =
    intubated === "sim" ? "terciario" : age !== null && age >= 70 ? "secundario" : "primario";
  const nextScreening = nextScreeningDate(nanLevel);

  /** Prótese dentária implica dentição incompleta. */
  const handleDenture = (value: YesNo) => {
    setDenture(value);
    if (value === "sim") setFullDentition("nao");
    if (value === "nao") setHardFoodDifficulty("");
  };

  /** Peso relatado quando o paciente sabe; senão Chumlea (AJ + CB) com auditoria. */
  const weightResult = useMemo(() => {
    if (knowsWeight === "sim") {
      const value = num(weightInput);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        value,
        source: directWeightSource as MeasureSource,
        method:
          directWeightSource === "aferido"
            ? "Aferido durante o atendimento"
            : "Relatado pelo paciente/familiar",
        audit: null as EstimateAudit | null,
        failure: null as string | null,
      };
    }
    if (knowsWeight !== "nao") return null;
    const result = calculateWeightChumleaArmKnee({
      sex,
      race,
      armCircumferenceCm: num(arm),
      kneeHeightCm: num(knee),
      ...(explicitProtocol ? { explicitProtocol } : {}),
      professionalName,
    });
    if (!result.ok) {
      if (
        editingScreening?.weight_source === "estimado" &&
        editingScreening.weight_kg !== null &&
        !arm.trim() &&
        !knee.trim()
      ) {
        return {
          value: editingScreening.weight_kg,
          source: "estimado" as MeasureSource,
          method: editingScreening.weight_method,
          audit: null as EstimateAudit | null,
          failure: null as string | null,
        };
      }
      return { value: null, source: null, method: null, audit: null, failure: result.message };
    }
    return {
      value: result.value,
      source: "estimado" as MeasureSource,
      method: result.audit.method,
      audit: result.audit,
      failure: null,
    };
  }, [
    knowsWeight,
    weightInput,
    directWeightSource,
    sex,
    race,
    arm,
    knee,
    explicitProtocol,
    professionalName,
    editingScreening,
  ]);

  const heightResult = useMemo(() => {
    if (knowsHeight === "sim") {
      const value = num(heightInput);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        value,
        source: directHeightSource as MeasureSource,
        method:
          directHeightSource === "aferido"
            ? "Aferida durante o atendimento"
            : "Relatada pelo paciente/familiar",
        audit: null as EstimateAudit | null,
        failure: null as string | null,
      };
    }
    if (knowsHeight !== "nao") return null;
    const result = calculateHeightChumlea({
      sex,
      race,
      kneeHeightCm: num(knee),
      ageYears: age ?? NaN,
      ...(explicitProtocol ? { explicitProtocol } : {}),
      professionalName,
    });
    if (!result.ok) {
      if (
        editingScreening?.height_source === "estimado" &&
        editingScreening.height_cm !== null &&
        !knee.trim()
      ) {
        return {
          value: editingScreening.height_cm,
          source: "estimado" as MeasureSource,
          method: editingScreening.height_method,
          audit: null as EstimateAudit | null,
          failure: null as string | null,
        };
      }
      return { value: null, source: null, method: null, audit: null, failure: result.message };
    }
    return {
      value: result.value,
      source: "estimado" as MeasureSource,
      method: result.audit.method,
      audit: result.audit,
      failure: null,
    };
  }, [
    knowsHeight,
    heightInput,
    directHeightSource,
    sex,
    race,
    knee,
    age,
    explicitProtocol,
    professionalName,
    editingScreening,
  ]);

  const bmiResult = useMemo(() => {
    if (!weightResult?.value || !heightResult?.value) return null;
    const result = calculateBMI(weightResult.value, heightResult.value, professionalName);
    return result.ok ? result : null;
  }, [weightResult, heightResult, professionalName]);

  /** IMC < 20,5 é preenchido automaticamente a partir do IMC calculado. */
  const bmiUnder205: YesNo = bmiResult ? (bmiResult.value < 20.5 ? "sim" : "nao") : "";

  const armAdequacy = useMemo(
    () =>
      calculateArmCircumferenceAdequacy({
        armCircumferenceCm: num(arm),
        ageYears: age,
        sex: patient?.sex ?? null,
      }),
    [age, arm, patient?.sex],
  );

  const protocolPending = needsEstimate && !protocol;

  const conditions: Record<string, boolean | string | number | null> = {
    imc_menor_20_5: toBool(bmiUnder205),
    dm: toBool(dm),
    has: toBool(has),
    intolerancia_alimentar: toBool(intolerance),
    intolerancia_qual: intolerance === "sim" ? intoleranceWhich.trim().slice(0, 200) || null : null,
    protese_dentaria: toBool(denture),
    denticao_completa: toBool(fullDentition),
    dificuldade_alimentos_rigidos: toBool(hardFoodDifficulty),
    reducao_fome: toBool(hungerReduction),
    perda_de_peso: toBool(weightLoss),
    funcao_intestinal: bowel || null,
    edema: toBool(edema),
    aacoc: toBool(aacoc),
    aacoc_descricao: aacoc === "nao" ? aacocDescription.trim().slice(0, 300) || null : null,
    intubado: toBool(intubated),
    adequacao_cb_percentual: armAdequacy?.adequacyPercentage ?? null,
    classificacao_cb: armAdequacy?.classification ?? null,
    referencia_cb_cm: armAdequacy?.referenceCm ?? null,
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admission || !patient) throw new Error("Internação não encontrada.");
      if (professionalName.trim().length < 3) {
        throw new Error("Informe o nome do profissional responsável pela triagem.");
      }
      const optional = (value: string) => {
        const parsed = num(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };

      if (screeningIdToEdit && !editingScreening) {
        throw new Error("A triagem selecionada não foi encontrada.");
      }

      const screeningId = editingScreening?.id ?? crypto.randomUUID();
      const screeningPayload = {
        admission_id: admission.id,
        patient_id: patient.id,
        professional_name: professionalName.trim().slice(0, 120),
        is_reassessment: isReassessment,
        nan_level: nanLevel,
        next_screening_at: nextScreening.toISOString(),
        weight_kg: weightResult?.value ?? null,
        weight_source: weightResult?.source ?? null,
        weight_method: weightResult?.method ?? null,
        height_cm: heightResult?.value ?? null,
        height_source: heightResult?.source ?? null,
        height_method: heightResult?.method ?? null,
        bmi: bmiResult?.value ?? null,
        usual_weight_kg: optional(usualWeight),
        weight_loss_period_months: optional(lossMonths),
        arm_circumference_cm: optional(arm),
        knee_height_cm: optional(knee),
        conditions,
        clinical_notes: observation.trim().slice(0, 1000) || null,
        appetite:
          hungerReduction === "sim" ? "Reduzido" : hungerReduction === "nao" ? "Preservado" : null,
        chewing:
          denture === "sim"
            ? hardFoodDifficulty === "sim"
              ? "Uso de prótese · dificuldade com alimentos rígidos/secos"
              : "Uso de prótese"
            : denture === "nao"
              ? "Dentição completa"
              : null,
      };
      const screeningSave = editingScreening
        ? await runOrQueue(
            createOfflineOperation({
              table: "screenings",
              action: "update",
              recordId: screeningId,
              payload: screeningPayload,
            }),
            async () => {
              const { error } = await supabase
                .from("screenings")
                .update(screeningPayload)
                .eq("id", screeningId);
              if (error) throw error;
            },
          )
        : await runOrQueue(
            createOfflineOperation({
              table: "screenings",
              action: "insert",
              payload: { id: screeningId, ...screeningPayload },
            }),
            async () => {
              const { error } = await supabase
                .from("screenings")
                .insert({ id: screeningId, ...screeningPayload });
              if (error) throw error;
            },
          );

      let auditQueued = false;
      if (editingScreening) {
        const previousAudits = estimates.filter(
          (estimate) => estimate.screening_id === editingScreening.id,
        );
        for (const estimate of previousAudits) {
          const auditDelete = await runOrQueue(
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
          auditQueued ||= auditDelete.queued;
        }
      }

      const audits = [weightResult?.audit, heightResult?.audit, bmiResult?.audit].filter(
        Boolean,
      ) as EstimateAudit[];

      if (audits.length > 0) {
        const auditRows = audits.map((audit) => ({
          id: crypto.randomUUID(),
          screening_id: screeningId,
          patient_id: patient.id,
          target: audit.target,
          method: audit.method,
          formula: audit.formula,
          protocol: audit.protocol ?? null,
          parameters: audit.parameters,
          result: audit.result,
          unit: audit.unit,
          professional_name: professionalName.trim().slice(0, 120),
        }));
        const auditSave = await runOrQueue(
          createOfflineOperation({
            table: "anthropometric_estimates",
            action: "insert",
            payload: auditRows,
          }),
          async () => {
            const { error: auditError } = await supabase
              .from("anthropometric_estimates")
              .insert(auditRows);
            if (auditError) throw auditError;
          },
        );
        auditQueued = auditSave.queued;
      }
      return {
        screeningId,
        queued: screeningSave.queued || auditQueued,
        edited: Boolean(editingScreening),
      };
    },
    onSuccess: ({ queued, edited }) => {
      toast.success(
        queued
          ? `${edited ? "Alteração" : "Triagem"} salva no aparelho. Ela será sincronizada quando a internet voltar.`
          : edited
            ? "Triagem atualizada com sucesso."
            : "Triagem registrada com sucesso.",
      );
      queryClient.invalidateQueries();
      setConfirmOpen(false);
      if (patient) navigate({ to: "/paciente/$patientId", params: { patientId: patient.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a triagem.");
    },
  });

  if (!admission || !patient || (screeningIdToEdit && (screeningsPending || estimatesPending))) {
    return (
      <AppShell
        title={screeningIdToEdit ? "Editar triagem" : "Nova triagem"}
        crumbs={[{ label: "Painel", to: "/painel" }]}
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Carregando dados da internação...
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${editingScreening ? "Editar triagem" : "Nova triagem"} — ${patient.full_name}`}
      subtitle={`${ward?.name ?? "—"} · Leito ${bed?.label ?? "—"} · ${careTypeLabel(
        admission.care_type,
      )} · Raça/cor: ${RACE_LABELS[patient.race]}`}
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
        { label: patient.full_name, to: "/paciente/$patientId", params: { patientId: patient.id } },
        { label: editingScreening ? "Editar triagem" : "Nova triagem" },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* 1. Identificação */}
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
              <CardDescription>
                O NAN é definido automaticamente pela idade e pela condição de intubação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnly label="Nome do paciente" value={patient.full_name} />
                <ReadOnly label="Data da internação" value={formatDate(admission.admitted_at)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof">Profissional responsável</Label>
                <Input
                  id="prof"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  placeholder="Nome do nutricionista"
                  maxLength={120}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="reassess"
                  checked={isReassessment}
                  onCheckedChange={setIsReassessment}
                />
                <Label htmlFor="reassess">Esta triagem é uma reavaliação</Label>
              </div>
              <YesNoField label="Paciente intubado?" value={intubated} onChange={setIntubated} />
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnly label="NAN automático" value={nanLabel(nanLevel)} />
                <ReadOnly
                  label="Retorno da triagem"
                  value={formatDate(nextScreening.toISOString())}
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. Peso e altura */}
          <Card>
            <CardHeader>
              <CardTitle>Peso e altura</CardTitle>
              <CardDescription>
                A origem de cada medida é sempre registrada. Valores estimados nunca são
                apresentados como aferidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <YesNoField
                  label="Peso disponível sem estimativa por fórmula?"
                  value={knowsWeight}
                  onChange={setKnowsWeight}
                />
                {knowsWeight === "sim" && (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label>Peso (kg)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="Ex.: 68,5"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Origem do peso</Label>
                      <Select
                        value={directWeightSource}
                        onValueChange={(value) =>
                          setDirectWeightSource(value as "aferido" | "relatado")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aferido">Aferido</SelectItem>
                          <SelectItem value="relatado">Relatado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {knowsWeight === "nao" && (
                  <p className="text-sm text-muted-foreground">
                    Peso será estimado por Chumlea a partir da altura do joelho (AJ) e da
                    circunferência do braço (CB), com o protocolo selecionado abaixo.
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <YesNoField
                  label="Altura disponível sem estimativa por fórmula?"
                  value={knowsHeight}
                  onChange={setKnowsHeight}
                />
                {knowsHeight === "sim" && (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label>Altura (cm)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="Ex.: 165"
                        value={heightInput}
                        onChange={(e) => setHeightInput(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Origem da altura</Label>
                      <Select
                        value={directHeightSource}
                        onValueChange={(value) =>
                          setDirectHeightSource(value as "aferido" | "relatado")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aferido">Aferida</SelectItem>
                          <SelectItem value="relatado">Relatada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {knowsHeight === "nao" && (
                  <p className="text-sm text-muted-foreground">
                    Altura será estimada por Chumlea a partir da altura do joelho (AJ) e da idade
                    {age === null ? "" : ` (${age} anos)`}.
                  </p>
                )}
                {knowsHeight === "nao" && age === null && (
                  <p className="text-sm text-destructive">
                    A data de nascimento do paciente é necessária para estimar a altura.
                  </p>
                )}
              </div>

              {needsEstimate && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Protocolo da equação (branca ou preta)</Label>
                      <Select
                        value={protocol}
                        onValueChange={(value) => setProtocol(value as ChumleaProtocol)}
                      >
                        <SelectTrigger className="max-w-sm">
                          <SelectValue placeholder="Selecione o protocolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="branca">Branca</SelectItem>
                          <SelectItem value="negra">Preta / negra</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Raça/cor cadastrada: {RACE_LABELS[patient.race]}. A escolha do protocolo é
                        sempre explícita e fica registrada na auditoria.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="AJ — altura do joelho (cm)" value={knee} onChange={setKnee} />
                      {knowsWeight === "nao" && (
                        <Field
                          label="CB — circunferência do braço (cm)"
                          value={arm}
                          onChange={setArm}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {(weightResult?.failure || heightResult?.failure) && (
                <Alert variant="destructive">
                  <AlertTitle>Cálculo não realizado</AlertTitle>
                  <AlertDescription>
                    {weightResult?.failure ?? heightResult?.failure}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2 rounded-xl bg-surface p-4">
                <ResultLine
                  label="Peso"
                  value={formatNumber(weightResult?.value ?? null, " kg")}
                  source={weightResult?.source ?? null}
                />
                <ResultLine
                  label="Altura"
                  value={formatNumber(heightResult?.value ?? null, " cm")}
                  source={heightResult?.source ?? null}
                />
                <ResultLine
                  label="IMC calculado"
                  value={formatNumber(bmiResult?.value ?? null, " kg/m²")}
                />
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">IMC &lt; 20,5</span>
                  <Badge variant={bmiUnder205 === "sim" ? "destructive" : "secondary"}>
                    {bmiUnder205 === ""
                      ? "Aguardando peso e altura"
                      : bmiUnder205 === "sim"
                        ? "Sim"
                        : "Não"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resultado atualizado automaticamente conforme AJ e CB são preenchidos.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Comorbidades e alimentação */}
          <Card>
            <CardHeader>
              <CardTitle>Comorbidades e alimentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <YesNoField label="Diabetes mellitus (DM)" value={dm} onChange={setDm} />
                <YesNoField label="Hipertensão arterial (HAS)" value={has} onChange={setHas} />
              </div>
              <Separator />
              <YesNoField
                label="Tem intolerância a algum alimento?"
                value={intolerance}
                onChange={setIntolerance}
              />
              {intolerance === "sim" && (
                <div className="space-y-2">
                  <Label htmlFor="intol">Qual alimento?</Label>
                  <Input
                    id="intol"
                    value={intoleranceWhich}
                    onChange={(e) => setIntoleranceWhich(e.target.value)}
                    maxLength={200}
                    placeholder="Ex.: lactose"
                  />
                </div>
              )}
              <Separator />
              <YesNoField label="Usa prótese dentária?" value={denture} onChange={handleDenture} />
              <YesNoField
                label="Dentição completa"
                value={fullDentition}
                onChange={setFullDentition}
                disabled={denture === "sim"}
                hint={
                  denture === "sim"
                    ? "Desmarcado automaticamente por uso de prótese dentária."
                    : undefined
                }
              />
              {denture === "sim" && (
                <YesNoField
                  label="Tem dificuldade com alimentos rígidos ou secos?"
                  value={hardFoodDifficulty}
                  onChange={setHardFoodDifficulty}
                />
              )}
              <Separator />
              <YesNoField
                label="Reduziu a fome nas últimas semanas?"
                value={hungerReduction}
                onChange={setHungerReduction}
              />
              <YesNoField label="Teve perda de peso?" value={weightLoss} onChange={setWeightLoss} />
              {weightLoss === "sim" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Peso usual (kg)" value={usualWeight} onChange={setUsualWeight} />
                  <Field
                    label="Período da perda (meses)"
                    value={lossMonths}
                    onChange={setLossMonths}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Avaliação complementar */}
          <Card>
            <CardHeader>
              <CardTitle>Avaliação complementar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Função intestinal</Label>
                <Select value={bowel} onValueChange={setBowel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Normal", "Constipação", "Diarreia", "Alternada", "Ostomia"].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <YesNoField label="Apresenta edema?" value={edema} onChange={setEdema} />
              {knowsWeight === "nao" ? (
                <ReadOnly
                  label="CB — circunferência do braço (cm)"
                  value={
                    Number.isFinite(num(arm)) && num(arm) > 0
                      ? `${formatNumber(num(arm), " cm")} · já informada na estimativa de peso`
                      : "Informe a CB na seção Peso e altura"
                  }
                />
              ) : (
                <Field label="CB — circunferência do braço (cm)" value={arm} onChange={setArm} />
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <ReadOnly
                  label="CB de referência (P50)"
                  value={
                    armAdequacy
                      ? `${formatNumber(armAdequacy.referenceCm, " cm")} · ${armAdequacy.referenceAgeRange}`
                      : "Informe CB, sexo e data de nascimento"
                  }
                />
                <ReadOnly
                  label="Adequação da CB"
                  value={
                    armAdequacy
                      ? formatNumber(armAdequacy.adequacyPercentage, "%")
                      : "Aguardando dados"
                  }
                />
                <ReadOnly
                  label="Classificação da CB"
                  value={armAdequacy?.classification ?? "Aguardando dados"}
                />
              </div>

              <YesNoField
                label="Paciente AACOC (acordado, atento, consciente, orientado e comunicativo)?"
                value={aacoc}
                onChange={setAacoc}
              />
              {aacoc === "nao" && (
                <div className="space-y-2">
                  <Label htmlFor="aacoc-description">Descreva como o paciente está</Label>
                  <Textarea
                    id="aacoc-description"
                    value={aacocDescription}
                    onChange={(event) => setAacocDescription(event.target.value)}
                    maxLength={300}
                    placeholder="Ex.: sonolento, desorientado e pouco comunicativo"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="obs">Observação</Label>
                <Textarea
                  id="obs"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  maxLength={1000}
                  placeholder="Pedidos do paciente, alimentos que não come, outras observações..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden space-y-4 lg:sticky lg:top-6 lg:block lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valores calculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ResultLine
                label="Peso"
                value={formatNumber(weightResult?.value ?? null, " kg")}
                source={weightResult?.source ?? null}
              />
              <ResultLine
                label="Altura"
                value={formatNumber(heightResult?.value ?? null, " cm")}
                source={heightResult?.source ?? null}
              />
              <ResultLine label="IMC" value={formatNumber(bmiResult?.value ?? null, " kg/m²")} />
              <ResultLine label="CB" value={formatNumber(num(arm) || null, " cm")} />
              <ResultLine
                label="Adequação da CB"
                value={
                  armAdequacy
                    ? `${formatNumber(armAdequacy.adequacyPercentage, "%")} · ${armAdequacy.classification}`
                    : "—"
                }
              />
              <Separator />
              <p className="text-xs text-muted-foreground">
                Cada estimativa é registrada com método, fórmula, protocolo, parâmetros, data e
                profissional.
              </p>
              <Button
                className="w-full"
                onClick={() => setConfirmOpen(true)}
                disabled={protocolPending}
              >
                Revisar e salvar
              </Button>
              {protocolPending && (
                <p className="text-xs text-destructive">
                  Selecione o protocolo (branca ou preta) para calcular as estimativas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barra fixa de resumo/ação no celular */}
      <div className="h-32 lg:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 text-xs">
          <MiniStat label="Peso" value={formatNumber(weightResult?.value ?? null, " kg")} />
          <MiniStat label="Altura" value={formatNumber(heightResult?.value ?? null, " cm")} />
          <MiniStat label="IMC" value={formatNumber(bmiResult?.value ?? null, "")} />
          <MiniStat
            label="CB"
            value={
              armAdequacy
                ? formatNumber(armAdequacy.adequacyPercentage, "%")
                : formatNumber(num(arm) || null, " cm")
            }
          />
        </div>
        <Button
          className="mt-2 h-12 w-full text-base"
          onClick={() => setConfirmOpen(true)}
          disabled={protocolPending}
        >
          Revisar e salvar
        </Button>
        {protocolPending && (
          <p className="mt-1 text-center text-xs text-destructive">
            Selecione o protocolo (branca ou preta).
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingScreening ? "Confirmar alterações" : "Confirmar triagem"}
            </DialogTitle>
            <DialogDescription>
              {editingScreening
                ? "Revise o resumo antes de atualizar esta triagem."
                : "Revise o resumo antes de salvar. Após salvar, o registro passa a compor o histórico do paciente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>{patient.full_name}</strong> · {ward?.name} · Leito {bed?.label}
            </p>
            <p>Internação: {formatDate(admission.admitted_at)}</p>
            <p>Profissional: {professionalName || "não informado"}</p>
            <p>Tipo: {isReassessment ? "Reavaliação" : "Triagem inicial"}</p>
            <p>
              NAN: {nanLabel(nanLevel)} · retorno em {formatDate(nextScreening.toISOString())}
            </p>
            <Separator />
            <ResultLine
              label="Peso"
              value={formatNumber(weightResult?.value ?? null, " kg")}
              source={weightResult?.source ?? null}
            />
            <ResultLine
              label="Altura"
              value={formatNumber(heightResult?.value ?? null, " cm")}
              source={heightResult?.source ?? null}
            />
            <ResultLine label="IMC" value={formatNumber(bmiResult?.value ?? null, " kg/m²")} />
            <ResultLine
              label="IMC < 20,5"
              value={bmiUnder205 === "" ? "—" : bmiUnder205 === "sim" ? "Sim" : "Não"}
            />
            <Separator />
            <SummaryLine label="DM" value={dm} />
            <SummaryLine label="HAS" value={has} />
            <SummaryLine
              label="Intolerância alimentar"
              value={intolerance}
              extra={intolerance === "sim" ? intoleranceWhich : ""}
            />
            <SummaryLine label="Prótese dentária" value={denture} />
            <SummaryLine label="Dentição completa" value={fullDentition} />
            <SummaryLine
              label="Dificuldade com alimentos rígidos/secos"
              value={hardFoodDifficulty}
            />
            <SummaryLine label="Redução da fome" value={hungerReduction} />
            <SummaryLine label="Perda de peso" value={weightLoss} />
            <ResultLine label="Função intestinal" value={bowel || "—"} />
            <SummaryLine label="Edema" value={edema} />
            <ResultLine label="CB" value={formatNumber(num(arm) || null, " cm")} />
            <ResultLine
              label="Adequação da CB"
              value={
                armAdequacy
                  ? `${formatNumber(armAdequacy.adequacyPercentage, "%")} · ${armAdequacy.classification}`
                  : "—"
              }
            />
            <ResultLine
              label="Diagnóstico nutricional"
              value={nutritionalDiagnosisFromArm(armAdequacy?.classification)}
            />
            <SummaryLine label="Intubado" value={intubated} />
            <SummaryLine label="AACOC" value={aacoc} />
            {aacoc === "nao" && aacocDescription.trim() && (
              <ResultLine label="Estado do paciente" value={aacocDescription.trim()} />
            )}
            {observation.trim() && (
              <>
                <Separator />
                <p className="text-muted-foreground">Observação: {observation.trim()}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar e editar
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando..."
                : editingScreening
                  ? "Salvar alterações"
                  : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
  disabled?: boolean;
  hint?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2" role="group" aria-label={label}>
        {(["sim", "nao"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? "default" : "outline"}
            disabled={disabled}
            aria-pressed={value === option}
            className={cn("h-12 min-w-24 flex-1 text-base sm:h-10 sm:flex-none sm:text-sm")}
            onClick={() => onChange(value === option ? "" : option)}
          >
            {option === "sim" ? "Sim" : "Não"}
          </Button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        className="h-12 text-base sm:h-10 sm:text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SummaryLine({ label, value, extra }: { label: string; value: YesNo; extra?: string }) {
  const text = value === "" ? "—" : value === "sim" ? "Sim" : "Não";
  return <ResultLine label={label} value={extra ? `${text} · ${extra}` : text} />;
}

function ResultLine({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: MeasureSource | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <strong>{value}</strong>
        {source && (
          <Badge variant={source === "aferido" ? "default" : "secondary"}>
            {SOURCE_LABELS[source]}
          </Badge>
        )}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1.5 text-center">
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-bold">{value}</p>
    </div>
  );
}
