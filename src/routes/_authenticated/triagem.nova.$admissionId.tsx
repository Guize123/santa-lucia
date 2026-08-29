import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/hospital/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import {
  calculateBMI,
  calculateHeightChumlea,
  calculateWeightChumleaArmKnee,
  calculateWeightChumleaComplete,
  calculateWeightLossPercentage,
  requiresExplicitProtocol,
  type ChumleaProtocol,
  type EstimateAudit,
  type Sex,
} from "@/lib/anthropometricCalculations";
import {
  CLINICAL_CONDITIONS,
  RACE_LABELS,
  SOURCE_LABELS,
  ageFromBirthDate,
  careTypeLabel,
  formatNumber,
  type MeasureSource,
} from "@/lib/domain";
import { fetchAdmissions, fetchBeds, fetchPatient, fetchWard } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/triagem/nova/$admissionId")({
  head: () => ({
    meta: [
      { title: "Nova triagem nutricional — Hospital Santa Lúcia" },
      {
        name: "description",
        content:
          "Registro de triagem nutricional com antropometria auditada, condições clínicas, alimentação e resumo de confirmação antes de salvar.",
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

type WeightMode = "aferido" | "relatado" | "chumlea_braco_joelho" | "chumlea_completo" | "sem";
type HeightMode = "aferido" | "relatado" | "chumlea_joelho" | "sem";

const num = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

function NovaTriagemPage() {
  const { admissionId } = Route.useParams();
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

  const [professionalName, setProfessionalName] = useState("");
  const [isReassessment, setIsReassessment] = useState(false);

  const [weightMode, setWeightMode] = useState<WeightMode>("aferido");
  const [heightMode, setHeightMode] = useState<HeightMode>("aferido");
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [usualWeight, setUsualWeight] = useState("");
  const [lossMonths, setLossMonths] = useState("");
  const [arm, setArm] = useState("");
  const [calf, setCalf] = useState("");
  const [knee, setKnee] = useState("");
  const [skinfold, setSkinfold] = useState("");
  const [protocol, setProtocol] = useState<ChumleaProtocol | "">("");

  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [appetite, setAppetite] = useState("");
  const [intake, setIntake] = useState("");
  const [chewing, setChewing] = useState("");
  const [swallowing, setSwallowing] = useState("");
  const [dietType, setDietType] = useState("");
  const [feedingRoute, setFeedingRoute] = useState("");
  const [feedingNotes, setFeedingNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sex = (patient?.sex === "M" ? "M" : "F") as Sex;
  const race = patient?.race ?? "nao_informado";
  const age = ageFromBirthDate(patient?.birth_date ?? null);
  const needsProtocol = requiresExplicitProtocol(race);
  const explicitProtocol = protocol || undefined;

  /** Peso: aferido/relatado vêm do formulário; estimados usam Chumlea + auditoria. */
  const weightResult = useMemo(() => {
    if (weightMode === "aferido" || weightMode === "relatado") {
      const value = num(weightInput);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        value,
        source: weightMode as MeasureSource,
        method: weightMode === "aferido" ? "Balança (aferido)" : "Relatado pelo paciente/familiar",
        audit: null as EstimateAudit | null,
        failure: null as string | null,
      };
    }
    if (weightMode === "sem") return null;
    const result =
      weightMode === "chumlea_braco_joelho"
        ? calculateWeightChumleaArmKnee({
            sex,
            race,
            armCircumferenceCm: num(arm),
            kneeHeightCm: num(knee),
            explicitProtocol,
            professionalName,
          })
        : calculateWeightChumleaComplete({
            sex,
            race,
            calfCircumferenceCm: num(calf),
            kneeHeightCm: num(knee),
            armCircumferenceCm: num(arm),
            subscapularSkinfoldMm: num(skinfold),
            explicitProtocol,
            professionalName,
          });
    if (!result.ok) {
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
    weightMode,
    weightInput,
    sex,
    race,
    arm,
    knee,
    calf,
    skinfold,
    explicitProtocol,
    professionalName,
  ]);

  const heightResult = useMemo(() => {
    if (heightMode === "aferido" || heightMode === "relatado") {
      const value = num(heightInput);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        value,
        source: heightMode as MeasureSource,
        method:
          heightMode === "aferido"
            ? "Estadiômetro/fita (aferido)"
            : "Relatado pelo paciente/familiar",
        audit: null as EstimateAudit | null,
        failure: null as string | null,
      };
    }
    if (heightMode === "sem") return null;
    const result = calculateHeightChumlea({
      sex,
      race,
      kneeHeightCm: num(knee),
      ageYears: age ?? NaN,
      explicitProtocol,
      professionalName,
    });
    if (!result.ok) {
      return { value: null, source: null, method: null, audit: null, failure: result.message };
    }
    return {
      value: result.value,
      source: "estimado" as MeasureSource,
      method: result.audit.method,
      audit: result.audit,
      failure: null,
    };
  }, [heightMode, heightInput, sex, race, knee, age, explicitProtocol, professionalName]);

  const bmiResult = useMemo(() => {
    if (!weightResult?.value || !heightResult?.value) return null;
    const result = calculateBMI(weightResult.value, heightResult.value, professionalName);
    return result.ok ? result : null;
  }, [weightResult, heightResult, professionalName]);

  const lossResult = useMemo(() => {
    const usual = num(usualWeight);
    if (!weightResult?.value || !Number.isFinite(usual) || usual <= 0) return null;
    const months = num(lossMonths);
    const result = calculateWeightLossPercentage(
      usual,
      weightResult.value,
      Number.isFinite(months) ? months : undefined,
      professionalName,
    );
    return result.ok ? result : null;
  }, [usualWeight, weightResult, lossMonths, professionalName]);

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

      const { data, error } = await supabase
        .from("screenings")
        .insert({
          admission_id: admission.id,
          patient_id: patient.id,
          professional_name: professionalName.trim().slice(0, 120),
          is_reassessment: isReassessment,
          weight_kg: weightResult?.value ?? null,
          weight_source: weightResult?.source ?? null,
          weight_method: weightResult?.method ?? null,
          height_cm: heightResult?.value ?? null,
          height_source: heightResult?.source ?? null,
          height_method: heightResult?.method ?? null,
          bmi: bmiResult?.value ?? null,
          usual_weight_kg: optional(usualWeight),
          weight_loss_percentage: lossResult?.value ?? null,
          weight_loss_period_months: optional(lossMonths),
          arm_circumference_cm: optional(arm),
          calf_circumference_cm: optional(calf),
          knee_height_cm: optional(knee),
          subscapular_skinfold_mm: optional(skinfold),
          conditions,
          clinical_notes: clinicalNotes.trim().slice(0, 1000) || null,
          appetite: appetite || null,
          intake_acceptance: intake || null,
          chewing: chewing || null,
          swallowing: swallowing || null,
          diet_type: dietType.trim().slice(0, 120) || null,
          feeding_route: feedingRoute || null,
          feeding_notes: feedingNotes.trim().slice(0, 1000) || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const screeningId = (data as { id: string }).id;

      const audits = [
        weightResult?.audit,
        heightResult?.audit,
        bmiResult?.audit,
        lossResult?.audit,
      ].filter(Boolean) as EstimateAudit[];

      if (audits.length > 0) {
        const { error: auditError } = await supabase.from("anthropometric_estimates").insert(
          audits.map((audit) => ({
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
          })),
        );
        if (auditError) throw auditError;
      }
      return screeningId;
    },
    onSuccess: () => {
      toast.success("Triagem registrada com sucesso.");
      queryClient.invalidateQueries();
      setConfirmOpen(false);
      if (patient) navigate({ to: "/paciente/$patientId", params: { patientId: patient.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a triagem.");
    },
  });

  if (!admission || !patient) {
    return (
      <AppShell title="Nova triagem" crumbs={[{ label: "Painel", to: "/painel" }]}>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Carregando dados da internação...
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const protocolPending =
    needsProtocol &&
    !protocol &&
    (weightMode.startsWith("chumlea") || heightMode.startsWith("chumlea"));

  return (
    <AppShell
      title={`Nova triagem — ${patient.full_name}`}
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
        { label: "Nova triagem" },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identificação da triagem</CardTitle>
              <CardDescription>
                Nenhuma classificação automática de risco é aplicada neste MVP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Antropometria</CardTitle>
              <CardDescription>
                A origem de cada medida é sempre registrada. Valores estimados nunca são
                apresentados como aferidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {needsProtocol && (
                <Alert>
                  <AlertTitle>Escolha explícita de protocolo necessária</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Para raça/cor <strong>{RACE_LABELS[patient.race]}</strong> não existe equação
                      de Chumlea validada. Escolha explicitamente o protocolo ou use outro método /
                      não calcular.
                    </p>
                    <Select
                      value={protocol}
                      onValueChange={(value) => setProtocol(value as ChumleaProtocol)}
                    >
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Nenhum protocolo selecionado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branca">
                          Protocolo da equação branca (escolha explícita)
                        </SelectItem>
                        <SelectItem value="negra">
                          Protocolo da equação negra (escolha explícita)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label>Origem do peso</Label>
                <Select
                  value={weightMode}
                  onValueChange={(value) => setWeightMode(value as WeightMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aferido">Peso aferido em balança</SelectItem>
                    <SelectItem value="relatado">Peso relatado pelo paciente/familiar</SelectItem>
                    <SelectItem value="chumlea_braco_joelho">
                      Estimar — Chumlea (braço e joelho)
                    </SelectItem>
                    <SelectItem value="chumlea_completo">
                      Estimar — Chumlea completo (panturrilha, joelho, braço, dobra)
                    </SelectItem>
                    <SelectItem value="sem">Não calcular / sem peso</SelectItem>
                  </SelectContent>
                </Select>
                {(weightMode === "aferido" || weightMode === "relatado") && (
                  <Input
                    inputMode="decimal"
                    placeholder="Peso em kg"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-3">
                <Label>Origem da altura</Label>
                <Select
                  value={heightMode}
                  onValueChange={(value) => setHeightMode(value as HeightMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aferido">Altura aferida</SelectItem>
                    <SelectItem value="relatado">Altura relatada</SelectItem>
                    <SelectItem value="chumlea_joelho">
                      Estimar — Chumlea (altura do joelho e idade)
                    </SelectItem>
                    <SelectItem value="sem">Não calcular / sem altura</SelectItem>
                  </SelectContent>
                </Select>
                {(heightMode === "aferido" || heightMode === "relatado") && (
                  <Input
                    inputMode="decimal"
                    placeholder="Altura em cm"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                  />
                )}
                {heightMode === "chumlea_joelho" && age === null && (
                  <p className="text-sm text-destructive">
                    A data de nascimento do paciente é necessária para estimar a altura.
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Circunferência do braço (cm)"
                  value={arm}
                  onChange={setArm}
                />
                <Field
                  label="Circunferência da panturrilha (cm)"
                  value={calf}
                  onChange={setCalf}
                />
                <Field label="Altura do joelho (cm)" value={knee} onChange={setKnee} />
                <Field
                  label="Dobra cutânea subescapular (mm)"
                  value={skinfold}
                  onChange={setSkinfold}
                />
                <Field label="Peso usual (kg)" value={usualWeight} onChange={setUsualWeight} />
                <Field
                  label="Período da perda de peso (meses)"
                  value={lossMonths}
                  onChange={setLossMonths}
                />
              </div>

              {(weightResult?.failure || heightResult?.failure) && (
                <Alert variant="destructive">
                  <AlertTitle>Cálculo não realizado</AlertTitle>
                  <AlertDescription>
                    {weightResult?.failure ?? heightResult?.failure}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Condições clínicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CLINICAL_CONDITIONS.map((condition) => (
                  <label
                    key={condition.key}
                    className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm"
                  >
                    <Checkbox
                      checked={!!conditions[condition.key]}
                      onCheckedChange={(checked) =>
                        setConditions((prev) => ({ ...prev, [condition.key]: checked === true }))
                      }
                    />
                    {condition.label}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinical">Observações clínicas</Label>
                <Textarea
                  id="clinical"
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alimentação e mastigação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Choice
                  label="Apetite"
                  value={appetite}
                  onChange={setAppetite}
                  options={["Preservado", "Reduzido", "Ausente"]}
                />
                <Choice
                  label="Aceitação da dieta"
                  value={intake}
                  onChange={setIntake}
                  options={["Total", "Parcial (>50%)", "Parcial (<50%)", "Ausente"]}
                />
                <Choice
                  label="Mastigação"
                  value={chewing}
                  onChange={setChewing}
                  options={["Preservada", "Prejudicada", "Uso de prótese", "Ausência de dentes"]}
                />
                <Choice
                  label="Deglutição"
                  value={swallowing}
                  onChange={setSwallowing}
                  options={["Preservada", "Prejudicada", "Engasgos frequentes"]}
                />
                <Choice
                  label="Via de alimentação"
                  value={feedingRoute}
                  onChange={setFeedingRoute}
                  options={["Oral", "Enteral", "Parenteral", "Mista", "Jejum"]}
                />
                <div className="space-y-2">
                  <Label htmlFor="diet">Tipo de dieta</Label>
                  <Input
                    id="diet"
                    value={dietType}
                    onChange={(e) => setDietType(e.target.value)}
                    maxLength={120}
                    placeholder="Ex.: branda hipossódica"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feednotes">Observações da alimentação</Label>
                <Textarea
                  id="feednotes"
                  value={feedingNotes}
                  onChange={(e) => setFeedingNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
              <ResultLine
                label="Perda de peso"
                value={formatNumber(lossResult?.value ?? null, "%")}
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
                  Selecione o protocolo explicitamente para prosseguir com a estimativa.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar triagem</DialogTitle>
            <DialogDescription>
              Revise o resumo antes de salvar. Após salvar, o registro passa a compor o histórico do
              paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>{patient.full_name}</strong> · {ward?.name} · Leito {bed?.label}
            </p>
            <p>Profissional: {professionalName || "não informado"}</p>
            <p>Tipo: {isReassessment ? "Reavaliação" : "Triagem inicial"}</p>
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
              label="Perda de peso"
              value={formatNumber(lossResult?.value ?? null, "%")}
            />
            <Separator />
            <p>
              Condições assinaladas:{" "}
              {CLINICAL_CONDITIONS.filter((c) => conditions[c.key])
                .map((c) => c.label)
                .join(", ") || "nenhuma"}
            </p>
            <p>
              Alimentação: apetite {appetite || "—"} · aceitação {intake || "—"} · mastigação{" "}
              {chewing || "—"} · via {feedingRoute || "—"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar e editar
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
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
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Não informado" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
