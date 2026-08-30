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
  notes: string | null;
}

export interface Screening {
  id: string;
  admission_id: string;
  patient_id: string;
  screened_at: string;
  professional_name: string;
  is_reassessment: boolean;
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
