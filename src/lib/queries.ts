import { supabase } from "@/integrations/supabase/client";
import type {
  Admission,
  AnthropometricEstimate,
  Bed,
  CareType,
  Patient,
  Room,
  Screening,
  Ward,
} from "./domain";

const cast = <T>(data: unknown): T[] => (data ?? []) as T[];
const CACHE_PREFIX = "nutri-triage:query-cache:v1:";

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // O app continua online mesmo se o dispositivo não permitir armazenamento local.
  }
}

async function withOfflineCache<T>(key: string, request: () => Promise<T>): Promise<T> {
  try {
    const value = await request();
    writeCache(key, value);
    return value;
  } catch (error) {
    const cached = readCache<T>(key);
    if (cached !== null) return cached;
    throw error;
  }
}

export async function fetchWards(): Promise<Ward[]> {
  return withOfflineCache("wards", async () => {
    const { data, error } = await supabase.from("wards").select("*").order("name");
    if (error) throw error;
    return cast<Ward>(data);
  });
}

export async function fetchWard(id: string): Promise<Ward | null> {
  return withOfflineCache(`ward:${id}`, async () => {
    const { data, error } = await supabase.from("wards").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as Ward | null;
  });
}

export async function fetchRooms(wardId?: string): Promise<Room[]> {
  return withOfflineCache(`rooms:${wardId ?? "all"}`, async () => {
    let query = supabase.from("rooms").select("*").order("name");
    if (wardId) query = query.eq("ward_id", wardId);
    const { data, error } = await query;
    if (error) throw error;
    return cast<Room>(data);
  });
}

export async function fetchBeds(wardId?: string): Promise<Bed[]> {
  return withOfflineCache(`beds:${wardId ?? "all"}`, async () => {
    let query = supabase.from("beds").select("*").order("label");
    if (wardId) query = query.eq("ward_id", wardId);
    const { data, error } = await query;
    if (error) throw error;
    return cast<Bed>(data);
  });
}

export async function fetchAdmissions(options?: {
  status?: "ativa" | "alta";
  patientId?: string;
}): Promise<Admission[]> {
  const key = `admissions:${options?.status ?? "all"}:${options?.patientId ?? "all"}`;
  return withOfflineCache(key, async () => {
    let query = supabase.from("admissions").select("*").order("admitted_at", { ascending: false });
    if (options?.status) query = query.eq("status", options.status);
    if (options?.patientId) query = query.eq("patient_id", options.patientId);
    const { data, error } = await query;
    if (error) throw error;
    return cast<Admission>(data);
  });
}

export async function fetchPatients(): Promise<Patient[]> {
  return withOfflineCache("patients", async () => {
    const { data, error } = await supabase.from("patients").select("*").order("full_name");
    if (error) throw error;
    return cast<Patient>(data);
  });
}

export async function fetchPatient(id: string): Promise<Patient | null> {
  return withOfflineCache(`patient:${id}`, async () => {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as Patient | null;
  });
}

export async function fetchScreenings(patientId?: string): Promise<Screening[]> {
  return withOfflineCache(`screenings:${patientId ?? "all"}`, async () => {
    let query = supabase.from("screenings").select("*").order("screened_at", { ascending: false });
    if (patientId) query = query.eq("patient_id", patientId);
    const { data, error } = await query;
    if (error) throw error;
    return cast<Screening>(data);
  });
}

export async function fetchEstimates(patientId: string): Promise<AnthropometricEstimate[]> {
  return withOfflineCache(`estimates:${patientId}`, async () => {
    const { data, error } = await supabase
      .from("anthropometric_estimates")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return cast<AnthropometricEstimate>(data);
  });
}

/** Visão geral por tipo de atendimento, usada no painel inicial. */
export interface CareTypeOverview {
  careType: CareType;
  wards: number;
  beds: number;
  occupied: number;
  free: number;
  screenedLast7Days: number;
  neverScreened: number;
}

export function buildOverview(
  wards: Ward[],
  beds: Bed[],
  admissions: Admission[],
  screenings: Screening[],
): CareTypeOverview[] {
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  return (["particular", "sus", "uti"] as CareType[]).map((careType) => {
    const typeWards = wards.filter((w) => w.care_type === careType && w.is_active);
    const wardIds = new Set(typeWards.map((w) => w.id));
    const typeBeds = beds.filter((b) => wardIds.has(b.ward_id) && b.is_active);
    const bedIds = new Set(typeBeds.map((b) => b.id));
    const typeAdmissions = admissions.filter((a) => bedIds.has(a.bed_id));
    const admissionIds = new Set(typeAdmissions.map((a) => a.id));
    const typeScreenings = screenings.filter((s) => admissionIds.has(s.admission_id));
    const screenedAdmissions = new Set(typeScreenings.map((s) => s.admission_id));

    return {
      careType,
      wards: typeWards.length,
      beds: typeBeds.length,
      occupied: typeAdmissions.length,
      free: Math.max(0, typeBeds.length - typeAdmissions.length),
      screenedLast7Days: typeScreenings.filter(
        (s) => new Date(s.screened_at).getTime() >= sevenDaysAgo,
      ).length,
      neverScreened: typeAdmissions.filter((a) => !screenedAdmissions.has(a.id)).length,
    };
  });
}
