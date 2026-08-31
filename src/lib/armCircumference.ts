export type ArmCircumferenceClassification =
  | "Desnutrição grave"
  | "Desnutrição moderada"
  | "Desnutrição leve"
  | "Eutrofia"
  | "Sobrepeso"
  | "Obesidade";

interface ArmReference {
  minAge: number;
  maxAge: number;
  label: string;
  male: number;
  female: number;
}

/** Valores P50 enviados pelo hospital para cálculo da adequação da CB. */
export const ARM_CIRCUMFERENCE_P50: ArmReference[] = [
  { minAge: 18, maxAge: 24, label: "18–24,9 anos", male: 30.7, female: 26.8 },
  { minAge: 25, maxAge: 29, label: "25–29,9 anos", male: 31.8, female: 27.6 },
  { minAge: 30, maxAge: 34, label: "30–34,9 anos", male: 32.5, female: 28.6 },
  { minAge: 35, maxAge: 39, label: "35–39,9 anos", male: 32.9, female: 29.4 },
  { minAge: 40, maxAge: 44, label: "40–44,9 anos", male: 32.8, female: 29.7 },
  { minAge: 45, maxAge: 49, label: "45–49,9 anos", male: 32.6, female: 30.1 },
  { minAge: 50, maxAge: 54, label: "50–54,9 anos", male: 32.3, female: 30.6 },
  { minAge: 55, maxAge: 59, label: "55–59,9 anos", male: 32.3, female: 30.9 },
  { minAge: 60, maxAge: 64, label: "60–64,9 anos", male: 32, female: 30.8 },
  { minAge: 65, maxAge: 69, label: "65–69,9 anos", male: 31.1, female: 30.5 },
  { minAge: 70, maxAge: 74, label: "70–74,9 anos", male: 30.7, female: 30.3 },
];

export interface ArmCircumferenceResult {
  adequacyPercentage: number;
  classification: ArmCircumferenceClassification;
  referenceCm: number;
  referenceAgeRange: string;
}

export function classifyArmCircumference(
  adequacyPercentage: number,
): ArmCircumferenceClassification {
  if (adequacyPercentage < 70) return "Desnutrição grave";
  if (adequacyPercentage <= 80) return "Desnutrição moderada";
  if (adequacyPercentage <= 90) return "Desnutrição leve";
  if (adequacyPercentage <= 110) return "Eutrofia";
  if (adequacyPercentage <= 120) return "Sobrepeso";
  return "Obesidade";
}

export function calculateArmCircumferenceAdequacy({
  armCircumferenceCm,
  ageYears,
  sex,
}: {
  armCircumferenceCm: number;
  ageYears: number | null;
  sex: string | null;
}): ArmCircumferenceResult | null {
  if (!Number.isFinite(armCircumferenceCm) || armCircumferenceCm <= 0 || ageYears === null) {
    return null;
  }
  if (ageYears < 18 || (sex !== "M" && sex !== "F")) return null;

  // A tabela fornecida termina em 74,9 anos; acima disso, mantém-se a última referência disponível.
  const reference =
    ARM_CIRCUMFERENCE_P50.find((item) => ageYears >= item.minAge && ageYears <= item.maxAge) ??
    (ageYears >= 75 ? ARM_CIRCUMFERENCE_P50.at(-1) : undefined);
  if (!reference) return null;

  const referenceCm = sex === "M" ? reference.male : reference.female;
  const adequacyPercentage = Math.round(((armCircumferenceCm * 100) / referenceCm) * 10) / 10;

  return {
    adequacyPercentage,
    classification: classifyArmCircumference(adequacyPercentage),
    referenceCm,
    referenceAgeRange: reference.label,
  };
}

export function nutritionalDiagnosisFromArm(
  classification: ArmCircumferenceClassification | null | undefined,
): string {
  if (!classification) return "NÃO CLASSIFICADO — CB NÃO INFORMADA";
  return `${classification.toUpperCase()} DE ACORDO COM ADEQUAÇÃO DA % DA CB`;
}
