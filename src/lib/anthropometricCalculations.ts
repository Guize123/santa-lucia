/**
 * anthropometricCalculations
 * ---------------------------------------------------------------------------
 * Módulo isolado com os cálculos antropométricos usados na triagem nutricional.
 *
 * Regras de ouro deste módulo:
 * 1. Nenhuma função altera estado da aplicação nem grava no banco — elas apenas
 *    calculam e devolvem, junto do resultado, um registro de auditoria
 *    (`EstimateAudit`) contendo método, fórmula/protocolo, medidas usadas,
 *    data/hora e profissional responsável.
 * 2. Valores estimados NUNCA devem ser apresentados como aferidos. Toda
 *    estimativa carrega `source: "estimado"` na auditoria.
 * 3. Para pessoas pardas, amarelas, indígenas ou sem raça/cor informada as
 *    equações de Chumlea não possuem protocolo validado. Nesses casos o módulo
 *    se recusa a escolher automaticamente entre a equação "branca" e "negra":
 *    é obrigatório informar `protocol` explicitamente (decisão do profissional)
 *    ou usar outro método / não calcular.
 */

export type Sex = "F" | "M";

export type Race = "branca" | "preta" | "parda" | "amarela" | "indigena" | "nao_informado";

/** Protocolo das equações originais de Chumlea (amostras "white" e "black"). */
export type ChumleaProtocol = "branca" | "negra";

export interface EstimateAudit {
  /** O que foi estimado. */
  target: "peso" | "altura" | "imc" | "perda_de_peso";
  /** Método/instrumento conceitual utilizado. */
  method: string;
  /** Fórmula aplicada, em texto legível. */
  formula: string;
  /** Protocolo/equação escolhido (quando aplicável). */
  protocol?: string;
  /** Medidas e parâmetros que entraram no cálculo. */
  parameters: Record<string, number | string | null>;
  result: number;
  unit: string;
  /** Origem do dado — estimativas nunca são "aferido". */
  source: "estimado" | "calculado";
  professionalName: string;
  calculatedAt: string;
}

export interface CalcSuccess {
  ok: true;
  value: number;
  audit: EstimateAudit;
}

export interface CalcFailure {
  ok: false;
  /** `protocol_required` sinaliza que a UI deve pedir escolha explícita. */
  reason: "invalid_input" | "protocol_required";
  message: string;
}

export type CalcResult = CalcSuccess | CalcFailure;

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const isPositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const now = () => new Date().toISOString();

/**
 * Raças/cores em que as equações de Chumlea NÃO possuem protocolo próprio.
 * A escolha entre a equação "branca" e "negra" precisa ser explícita.
 */
export const RACES_REQUIRING_EXPLICIT_PROTOCOL: Race[] = [
  "parda",
  "amarela",
  "indigena",
  "nao_informado",
];

export function requiresExplicitProtocol(race: Race): boolean {
  return RACES_REQUIRING_EXPLICIT_PROTOCOL.includes(race);
}

/**
 * Resolve qual equação de Chumlea usar.
 * - branca -> protocolo "branca"; preta -> protocolo "negra"
 * - demais -> exige `explicitProtocol`; sem ele, devolve null (a UI deve
 *   solicitar a escolha ou oferecer outro método / não calcular).
 */
export function resolveChumleaProtocol(
  race: Race,
  explicitProtocol?: ChumleaProtocol,
): ChumleaProtocol | null {
  if (explicitProtocol) return explicitProtocol;
  if (race === "branca") return "branca";
  if (race === "preta") return "negra";
  return null;
}

const protocolRequiredFailure = (): CalcFailure => ({
  ok: false,
  reason: "protocol_required",
  message:
    "Para esta raça/cor não há equação de Chumlea validada. Selecione explicitamente o protocolo (branca ou negra) ou utilize outro método / não calcular.",
});

const invalid = (message: string): CalcFailure => ({
  ok: false,
  reason: "invalid_input",
  message,
});

/* -------------------------------------------------------------------------
 * IMC — Índice de Massa Corporal (Quetelet)
 * Fórmula: IMC = peso (kg) / altura (m)²
 * ---------------------------------------------------------------------- */
export function calculateBMI(
  weightKg: number,
  heightCm: number,
  professionalName = "",
): CalcResult {
  if (!isPositive(weightKg) || !isPositive(heightCm)) {
    return invalid("Informe peso (kg) e altura (cm) válidos para calcular o IMC.");
  }
  const heightM = heightCm / 100;
  const value = round(weightKg / (heightM * heightM));

  return {
    ok: true,
    value,
    audit: {
      target: "imc",
      method: "Cálculo direto de IMC",
      formula: "IMC = peso (kg) / altura (m)²",
      parameters: { peso_kg: weightKg, altura_cm: heightCm },
      result: value,
      unit: "kg/m²",
      source: "calculado",
      professionalName,
      calculatedAt: now(),
    },
  };
}

/* -------------------------------------------------------------------------
 * Percentual de perda de peso
 * Fórmula: % perda = ((peso usual − peso atual) / peso usual) × 100
 * Valor negativo indica ganho de peso.
 * ---------------------------------------------------------------------- */
export function calculateWeightLossPercentage(
  usualWeightKg: number,
  currentWeightKg: number,
  periodMonths?: number,
  professionalName = "",
): CalcResult {
  if (!isPositive(usualWeightKg) || !isPositive(currentWeightKg)) {
    return invalid("Informe peso usual e peso atual válidos.");
  }
  const value = round(((usualWeightKg - currentWeightKg) / usualWeightKg) * 100);

  return {
    ok: true,
    value,
    audit: {
      target: "perda_de_peso",
      method: "Percentual de perda de peso involuntária",
      formula: "% perda = ((peso usual − peso atual) / peso usual) × 100",
      parameters: {
        peso_usual_kg: usualWeightKg,
        peso_atual_kg: currentWeightKg,
        periodo_meses: periodMonths ?? null,
      },
      result: value,
      unit: "%",
      source: "calculado",
      professionalName,
      calculatedAt: now(),
    },
  };
}

/* -------------------------------------------------------------------------
 * Peso estimado — Chumlea (1988), versão reduzida com circunferência do braço
 * e altura do joelho.
 *
 * Homens:   Peso = (AJ × 1,19) + (CB × 3,21) − 86,82
 * Mulheres: Peso = (AJ × 1,01) + (CB × 2,81) − 60,04
 *
 * AJ = altura do joelho (cm); CB = circunferência do braço (cm).
 * Esta versão reduzida não é estratificada por raça/cor, porém a raça/cor é
 * registrada na auditoria e, quando não há protocolo validado, exigimos a mesma
 * confirmação explícita usada nas demais equações de Chumlea, para não induzir
 * o profissional a assumir equivalência de protocolos.
 * ---------------------------------------------------------------------- */
export interface ChumleaArmKneeInput {
  sex: Sex;
  race: Race;
  armCircumferenceCm: number;
  kneeHeightCm: number;
  explicitProtocol?: ChumleaProtocol;
  professionalName?: string;
}

export function calculateWeightChumleaArmKnee(input: ChumleaArmKneeInput): CalcResult {
  const { sex, race, armCircumferenceCm, kneeHeightCm, explicitProtocol } = input;
  const professionalName = input.professionalName ?? "";

  if (!isPositive(armCircumferenceCm) || !isPositive(kneeHeightCm)) {
    return invalid("Informe circunferência do braço (cm) e altura do joelho (cm).");
  }
  const protocol = resolveChumleaProtocol(race, explicitProtocol);
  if (!protocol) return protocolRequiredFailure();

  const formula =
    sex === "M"
      ? "Peso = (AJ × 1,19) + (CB × 3,21) − 86,82"
      : "Peso = (AJ × 1,01) + (CB × 2,81) − 60,04";

  const value =
    sex === "M"
      ? round(kneeHeightCm * 1.19 + armCircumferenceCm * 3.21 - 86.82)
      : round(kneeHeightCm * 1.01 + armCircumferenceCm * 2.81 - 60.04);

  return {
    ok: true,
    value,
    audit: {
      target: "peso",
      method: "Peso estimado — Chumlea (1988), braço e joelho",
      formula,
      protocol: `Chumlea 1988 · ${sex === "M" ? "homens" : "mulheres"} · protocolo ${protocol}`,
      parameters: {
        sexo: sex,
        raca_cor: race,
        protocolo_escolhido: protocol,
        protocolo_explicito: explicitProtocol ?? "não",
        circunferencia_braco_cm: armCircumferenceCm,
        altura_joelho_cm: kneeHeightCm,
      },
      result: value,
      unit: "kg",
      source: "estimado",
      professionalName,
      calculatedAt: now(),
    },
  };
}

/* -------------------------------------------------------------------------
 * Peso estimado — Chumlea (1988), versão completa, estratificada por sexo e
 * protocolo (amostras "white"/"black" do estudo original).
 *
 * CP = circunferência da panturrilha (cm); AJ = altura do joelho (cm);
 * CB = circunferência do braço (cm); DCSE = dobra cutânea subescapular (mm).
 *
 * Homens, protocolo branca:
 *   Peso = (0,98 × CP) + (1,16 × AJ) + (1,73 × CB) + (0,37 × DCSE) − 81,69
 * Homens, protocolo negra:
 *   Peso = (1,09 × CP) + (1,46 × AJ) + (0,45 × CB) + (0,25 × DCSE) − 51,16
 * Mulheres, protocolo branca:
 *   Peso = (1,27 × CP) + (0,87 × AJ) + (0,98 × CB) + (0,40 × DCSE) − 62,35
 * Mulheres, protocolo negra:
 *   Peso = (1,24 × CP) + (1,21 × AJ) + (0,33 × CB) + (0,15 × DCSE) − 59,21
 * ---------------------------------------------------------------------- */
export interface ChumleaCompleteInput {
  sex: Sex;
  race: Race;
  calfCircumferenceCm: number;
  kneeHeightCm: number;
  armCircumferenceCm: number;
  subscapularSkinfoldMm: number;
  explicitProtocol?: ChumleaProtocol;
  professionalName?: string;
}

export function calculateWeightChumleaComplete(input: ChumleaCompleteInput): CalcResult {
  const {
    sex,
    race,
    calfCircumferenceCm: cp,
    kneeHeightCm: aj,
    armCircumferenceCm: cb,
    subscapularSkinfoldMm: dcse,
    explicitProtocol,
  } = input;
  const professionalName = input.professionalName ?? "";

  if (!isPositive(cp) || !isPositive(aj) || !isPositive(cb) || !isPositive(dcse)) {
    return invalid(
      "Informe panturrilha (cm), altura do joelho (cm), braço (cm) e dobra subescapular (mm).",
    );
  }
  const protocol = resolveChumleaProtocol(race, explicitProtocol);
  if (!protocol) return protocolRequiredFailure();

  let value: number;
  let formula: string;

  if (sex === "M" && protocol === "branca") {
    formula = "Peso = (0,98 × CP) + (1,16 × AJ) + (1,73 × CB) + (0,37 × DCSE) − 81,69";
    value = round(0.98 * cp + 1.16 * aj + 1.73 * cb + 0.37 * dcse - 81.69);
  } else if (sex === "M") {
    formula = "Peso = (1,09 × CP) + (1,46 × AJ) + (0,45 × CB) + (0,25 × DCSE) − 51,16";
    value = round(1.09 * cp + 1.46 * aj + 0.45 * cb + 0.25 * dcse - 51.16);
  } else if (protocol === "branca") {
    formula = "Peso = (1,27 × CP) + (0,87 × AJ) + (0,98 × CB) + (0,40 × DCSE) − 62,35";
    value = round(1.27 * cp + 0.87 * aj + 0.98 * cb + 0.4 * dcse - 62.35);
  } else {
    formula = "Peso = (1,24 × CP) + (1,21 × AJ) + (0,33 × CB) + (0,15 × DCSE) − 59,21";
    value = round(1.24 * cp + 1.21 * aj + 0.33 * cb + 0.15 * dcse - 59.21);
  }

  return {
    ok: true,
    value,
    audit: {
      target: "peso",
      method: "Peso estimado — Chumlea (1988), equação completa",
      formula,
      protocol: `Chumlea 1988 · ${sex === "M" ? "homens" : "mulheres"} · protocolo ${protocol}`,
      parameters: {
        sexo: sex,
        raca_cor: race,
        protocolo_escolhido: protocol,
        protocolo_explicito: explicitProtocol ?? "não",
        circunferencia_panturrilha_cm: cp,
        altura_joelho_cm: aj,
        circunferencia_braco_cm: cb,
        dobra_subescapular_mm: dcse,
      },
      result: value,
      unit: "kg",
      source: "estimado",
      professionalName,
      calculatedAt: now(),
    },
  };
}

/* -------------------------------------------------------------------------
 * Altura estimada — Chumlea, a partir da altura do joelho e da idade,
 * estratificada por sexo e protocolo.
 *
 * Homens, protocolo branca:   Altura = 78,31 + (1,94 × AJ) − (0,14 × idade)
 * Homens, protocolo negra:    Altura = 79,69 + (1,85 × AJ) − (0,14 × idade)
 * Mulheres, protocolo branca: Altura = 82,21 + (1,85 × AJ) − (0,21 × idade)
 * Mulheres, protocolo negra:  Altura = 89,58 + (1,61 × AJ) − (0,17 × idade)
 * ---------------------------------------------------------------------- */
export interface ChumleaHeightInput {
  sex: Sex;
  race: Race;
  kneeHeightCm: number;
  ageYears: number;
  explicitProtocol?: ChumleaProtocol;
  professionalName?: string;
}

export function calculateHeightChumlea(input: ChumleaHeightInput): CalcResult {
  const { sex, race, kneeHeightCm: aj, ageYears, explicitProtocol } = input;
  const professionalName = input.professionalName ?? "";

  if (!isPositive(aj) || !isPositive(ageYears)) {
    return invalid("Informe altura do joelho (cm) e idade (anos).");
  }
  const protocol = resolveChumleaProtocol(race, explicitProtocol);
  if (!protocol) return protocolRequiredFailure();

  let value: number;
  let formula: string;

  if (sex === "M" && protocol === "branca") {
    formula = "Altura = 78,31 + (1,94 × AJ) − (0,14 × idade)";
    value = round(78.31 + 1.94 * aj - 0.14 * ageYears);
  } else if (sex === "M") {
    formula = "Altura = 79,69 + (1,85 × AJ) − (0,14 × idade)";
    value = round(79.69 + 1.85 * aj - 0.14 * ageYears);
  } else if (protocol === "branca") {
    formula = "Altura = 82,21 + (1,85 × AJ) − (0,21 × idade)";
    value = round(82.21 + 1.85 * aj - 0.21 * ageYears);
  } else {
    formula = "Altura = 89,58 + (1,61 × AJ) − (0,17 × idade)";
    value = round(89.58 + 1.61 * aj - 0.17 * ageYears);
  }

  return {
    ok: true,
    value,
    audit: {
      target: "altura",
      method: "Altura estimada — Chumlea (altura do joelho)",
      formula,
      protocol: `Chumlea · ${sex === "M" ? "homens" : "mulheres"} · protocolo ${protocol}`,
      parameters: {
        sexo: sex,
        raca_cor: race,
        protocolo_escolhido: protocol,
        protocolo_explicito: explicitProtocol ?? "não",
        altura_joelho_cm: aj,
        idade_anos: ageYears,
      },
      result: value,
      unit: "cm",
      source: "estimado",
      professionalName,
      calculatedAt: now(),
    },
  };
}
