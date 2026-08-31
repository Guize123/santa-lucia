import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Copy, GripHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  calculateArmCircumferenceAdequacy,
  nutritionalDiagnosisFromArm,
} from "@/lib/armCircumference";
import {
  ageFromBirthDate,
  formatNumber,
  nanLabel,
  SOURCE_LABELS,
  type Admission,
  type Patient,
  type Screening,
} from "@/lib/domain";

interface AnamnesisNoteProps {
  admission: Admission;
  patient: Patient;
  screening?: Screening | undefined;
  onClose: () => void;
}

const answer = (value: unknown): string => (value === true ? "SIM" : value === false ? "NÃO" : "—");

function measureLine(
  value: number | null,
  unit: string,
  source: Screening["weight_source"],
): string {
  if (value === null) return "—";
  const sourceLabel = source ? SOURCE_LABELS[source].toUpperCase() : "ORIGEM NÃO INFORMADA";
  return `${formatNumber(value, unit)} (${sourceLabel})`;
}

export function buildAnamnesisText(
  admission: Admission,
  patient: Patient,
  screening?: Screening,
): string {
  if (!screening) {
    return [
      `Paciente: ${patient.full_name}`,
      "",
      "AINDA NÃO HÁ TRIAGEM REGISTRADA PARA GERAR A COLINHA DA ANAMNESE.",
    ].join("\n");
  }

  const conditions = screening.conditions ?? {};
  const armAdequacy = calculateArmCircumferenceAdequacy({
    armCircumferenceCm: screening.arm_circumference_cm ?? Number.NaN,
    ageYears: ageFromBirthDate(patient.birth_date),
    sex: patient.sex,
  });
  const estimatedMeasures =
    screening.weight_source === "estimado" || screening.height_source === "estimado";
  const aacocDescription =
    typeof conditions["aacoc_descricao"] === "string" ? conditions["aacoc_descricao"].trim() : "";
  const intolerance = conditions["intolerancia_alimentar"];
  const intoleranceWhich =
    typeof conditions["intolerancia_qual"] === "string"
      ? conditions["intolerancia_qual"].trim()
      : "";
  const dm = conditions["dm"] === true;
  const has = conditions["has"] === true;
  const comorbidities = [dm ? "DM" : "", has ? "HAS" : ""].filter(Boolean).join(" E ");
  const physicalExam =
    conditions["edema"] === true
      ? "CORADO, HIDRATADO E COM EDEMAS"
      : "CORADO, HIDRATADO E SEM EDEMAS";
  const functionalCapacity =
    conditions["aacoc"] === true
      ? "ACORDADO, ATENTO, CONSCIENTE, ORIENTADO E COMUNICATIVO"
      : aacocDescription || "NÃO INFORMADA";
  const gastrointestinal =
    typeof conditions["funcao_intestinal"] === "string" && conditions["funcao_intestinal"]
      ? conditions["funcao_intestinal"].toUpperCase()
      : "NEGA";

  const observations = [
    estimatedMeasures ? "PESO E ALTURA ESTIMADOS POR FÓRMULA" : "",
    `CB: ${formatNumber(screening.arm_circumference_cm, " cm")}`,
    `AJ: ${formatNumber(screening.knee_height_cm, " cm")}`,
    comorbidities ? `PACIENTE ALEGA ${comorbidities}` : "",
  ].filter(Boolean);

  return [
    `Peso: ${measureLine(screening.weight_kg, " kg", screening.weight_source)}`,
    `Altura: ${measureLine(screening.height_cm, " cm", screening.height_source)}`,
    `IMC<20,5: ${answer(conditions["imc_menor_20_5"])}`,
    `Perda de apetite: ${answer(conditions["reducao_fome"])}`,
    `Perda de peso: ${answer(conditions["perda_de_peso"])}`,
    "",
    `Diagnóstico médico: ${admission.main_diagnosis?.trim() || "NÃO INFORMADO"}`,
    `Exame físico: ${physicalExam}`,
    `Capacidade funcional: ${functionalCapacity}`,
    `Intolerância alimentar: ${intolerance === true ? intoleranceWhich || "SIM" : intolerance === false ? "NEGA" : "—"}`,
    `Sintomas gastrointestinais: ${gastrointestinal}`,
    "",
    "Observações:",
    ...observations,
    "",
    `Diagnóstico Nutricional: ${nutritionalDiagnosisFromArm(armAdequacy?.classification)}`,
    "",
    "Conduta nutricional: PLANO DE CUIDADOS ACOMPANHO QUADRO CLÍNICO E NUTRICIONAL",
    "",
    `NÍVEL DE ATENDIMENTO NUTRICIONAL: NAN ${nanLabel(screening.nan_level).toUpperCase()}`,
  ].join("\n");
}

export function AnamnesisNote({ admission, patient, screening, onClose }: AnamnesisNoteProps) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(16, typeof window === "undefined" ? 80 : window.innerWidth / 2 - 240),
    y: Math.max(16, typeof window === "undefined" ? 80 : window.innerHeight / 2 - 260),
  }));
  const [copied, setCopied] = useState(false);
  const dragOrigin = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });
  const text = useMemo(
    () => buildAnamnesisText(admission, patient, screening),
    [admission, patient, screening],
  );

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextX = dragOrigin.current.x + event.clientX - dragOrigin.current.pointerX;
    const nextY = dragOrigin.current.y + event.clientY - dragOrigin.current.pointerY;
    setPosition({
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - 280)),
      y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - 96)),
    });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Colinha copiada.");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section
      className="fixed z-50 flex min-h-[320px] min-w-[280px] max-w-[calc(100vw-16px)] flex-col overflow-hidden border border-border bg-background shadow-2xl"
      style={{ left: position.x, top: position.y, width: 480, height: 560, resize: "both" }}
      aria-label={`Colinha da anamnese de ${patient.full_name}`}
    >
      <div
        className="flex cursor-move touch-none items-center gap-2 border-b border-border bg-muted px-3 py-2"
        onPointerDown={startDrag}
        onPointerMove={drag}
      >
        <GripHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">Colinha da anamnese</h2>
          <p className="truncate text-xs text-muted-foreground">{patient.full_name}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={copy} title="Copiar colinha">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="sr-only">Copiar colinha</span>
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={onClose} title="Fechar">
          <X className="size-4" />
          <span className="sr-only">Fechar</span>
        </Button>
      </div>
      <textarea
        className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed outline-none"
        defaultValue={text}
        aria-label="Texto da colinha da anamnese"
        spellCheck={false}
      />
    </section>
  );
}
