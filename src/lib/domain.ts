import type { Race } from "./anthropometricCalculations";

export type { Race };

export type CareType = "particular" | "sus" | "uti";
export type MeasureSource = "aferido" | "estimado" | "relatado";
export type AdmissionStatus = "ativa" | "alta";

export interface Ward {
  id: string;
  name: string;
  care_type: CareType;
  description: string | null;
  is_active: boolean;
}

export interface Room {
  id: string;
  ward_id: string;
  name: string;
  is_active: boolean;
}

export interface Bed {
  id: string;
  ward_id: string;
  room_id: string | null;
  label: string;
  is_active: boolean;
}

export interface Patient {
  id: string;
  full_name: string;
  birth_date: string | null;
  sex: string | null;
  race: Race;
  medical_record: string | null;
  mother_name: string | null;
  notes: string | null;
}

export interface Admission {
  id: string;
  patient_id: string;
  bed_id: string;
  care_type: CareType;
  status: AdmissionStatus;
  admitted_at: string;
  discharged_at: string | null;
  main_diagnosis: string | null;
  diet_note: string | null;
  notes: string | null;
}

/** Nível de Avaliação Nutricional (NAN) definido na triagem. */
export type NanLevel = "primario" | "secundario";

export const NAN_LEVELS: { value: NanLevel; label: string; days: number }[] = [
  { value: "primario", label: "Primário", days: 5 },
  { value: "secundario", label: "Secundário", days: 4 },
];

export const nanDays = (level: NanLevel): number =>
  NAN_LEVELS.find((l) => l.value === level)?.days ?? 5;

export const nanLabel = (level: string | null | undefined): string =>
  NAN_LEVELS.find((l) => l.value === level)?.label ?? "—";

/** Data de retorno da triagem: primário = 5 dias, secundário = 4 dias. */
export function nextScreeningDate(level: NanLevel, from: Date = new Date()): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + nanDays(level));
  return date;
}

export interface Screening {
  id: string;
  admission_id: string;
  patient_id: string;
  screened_at: string;
  professional_name: string;
  is_reassessment: boolean;
  nan_level: NanLevel | null;
  next_screening_at: string | null;
  weight_kg: number | null;
  weight_source: MeasureSource | null;
  weight_method: string | null;
  height_cm: number | null;
  height_source: MeasureSource | null;
  height_method: string | null;
  bmi: number | null;
  usual_weight_kg: number | null;
  weight_loss_percentage: number | null;
  weight_loss_period_months: number | null;
  arm_circumference_cm: number | null;
  calf_circumference_cm: number | null;
  knee_height_cm: number | null;
  subscapular_skinfold_mm: number | null;
  conditions: Record<string, boolean | string | null> | null;
  appetite: string | null;
  intake_acceptance: string | null;
  chewing: string | null;
  swallowing: string | null;
  diet_type: string | null;
  feeding_route: string | null;
  feeding_notes: string | null;
  clinical_notes: string | null;
}

export interface AnthropometricEstimate {
  id: string;
  screening_id: string | null;
  patient_id: string;
  target: string;
  method: string;
  formula: string;
  protocol: string | null;
  parameters: Record<string, unknown> | null;
  result: number | null;
  unit: string | null;
  professional_name: string;
  created_at: string;
}

export const CARE_TYPES: {
  value: CareType;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    value: "particular",
    label: "Particular",
    short: "Particular",
    description: "Internações em quartos particulares e convênios.",
  },
  {
    value: "sus",
    label: "SUS",
    short: "SUS",
    description: "Internações pelo Sistema Único de Saúde.",
  },
  {
    value: "uti",
    label: "UTI",
    short: "UTI",
    description: "Unidades de terapia intensiva.",
  },
];

export const careTypeLabel = (value: CareType) =>
  CARE_TYPES.find((c) => c.value === value)?.label ?? value;

export const RACE_LABELS: Record<Race, string> = {
  branca: "Branca",
  preta: "Preta",
  parda: "Parda",
  amarela: "Amarela",
  indigena: "Indígena",
  nao_informado: "Não informado",
};

export const SOURCE_LABELS: Record<MeasureSource, string> = {
  aferido: "Aferido",
  estimado: "Estimado",
  relatado: "Relatado pelo paciente/familiar",
};

export const CLINICAL_CONDITIONS: { key: string; label: string }[] = [
  { key: "nausea", label: "Náusea" },
  { key: "vomito", label: "Vômito" },
  { key: "diarreia", label: "Diarreia" },
  { key: "constipacao", label: "Constipação" },
  { key: "disfagia", label: "Disfagia" },
  { key: "dor", label: "Dor" },
  { key: "dispneia", label: "Dispneia" },
  { key: "febre", label: "Febre" },
  { key: "edema", label: "Edema" },
  { key: "ascite", label: "Ascite" },
  { key: "lesao_por_pressao", label: "Lesão por pressão" },
  { key: "jejum_prolongado", label: "Jejum prolongado" },
];

/**
 * Perguntas do roteiro de triagem gravadas no jsonb `conditions`.
 * `kind` define como o valor é apresentado no histórico do paciente.
 */
export const SCREENING_QUESTIONS: {
  key: string;
  label: string;
  kind: "sim_nao" | "texto";
}[] = [
  { key: "imc_menor_20_5", label: "IMC < 20,5", kind: "sim_nao" },
  { key: "dm", label: "Diabetes mellitus (DM)", kind: "sim_nao" },
  { key: "has", label: "Hipertensão arterial (HAS)", kind: "sim_nao" },
  { key: "intolerancia_alimentar", label: "Intolerância alimentar", kind: "sim_nao" },
  { key: "intolerancia_qual", label: "Qual intolerância", kind: "texto" },
  { key: "protese_dentaria", label: "Prótese dentária", kind: "sim_nao" },
  { key: "denticao_completa", label: "Dentição completa", kind: "sim_nao" },
  {
    key: "dificuldade_alimentos_rigidos",
    label: "Dificuldade com alimentos rígidos ou secos",
    kind: "sim_nao",
  },
  { key: "reducao_fome", label: "Redução da fome nas últimas semanas", kind: "sim_nao" },
  { key: "perda_de_peso", label: "Perda de peso", kind: "sim_nao" },
  { key: "funcao_intestinal", label: "Função intestinal", kind: "texto" },
  { key: "edema", label: "Edema", kind: "sim_nao" },
  { key: "aacoc", label: "AACOC (acordado, atento, consciente, orientado e comunicativo)", kind: "sim_nao" },
];

export function formatScreeningAnswer(value: boolean | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return value;
}

export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}
