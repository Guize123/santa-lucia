import { supabase } from "@/integrations/supabase/client";

export type OfflineTable =
  | "wards"
  | "rooms"
  | "beds"
  | "patients"
  | "admissions"
  | "screenings"
  | "anthropometric_estimates";

export interface OfflineOperation {
  id: string;
  table: OfflineTable;
  action: "insert" | "update" | "delete";
  payload?: Record<string, unknown> | Record<string, unknown>[];
  recordId?: string;
  createdAt: string;
}

const OUTBOX_KEY = "nutri-triage:offline-outbox:v1";
export const OFFLINE_SYNC_EVENT = "nutri-triage:offline-sync";

const hasWindow = (): boolean => typeof window !== "undefined";

function readOutbox(): OfflineOperation[] {
  if (!hasWindow()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]") as OfflineOperation[];
  } catch {
    return [];
  }
}

function writeOutbox(operations: OfflineOperation[]): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(operations));
  window.dispatchEvent(
    new CustomEvent(OFFLINE_SYNC_EVENT, { detail: { pending: operations.length } }),
  );
}

export function pendingOfflineOperations(): number {
  return readOutbox().length;
}

export function createOfflineOperation(
  operation: Omit<OfflineOperation, "id" | "createdAt">,
): OfflineOperation {
  return {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

function enqueue(operation: OfflineOperation): void {
  const current = readOutbox();
  if (!current.some((item) => item.id === operation.id)) writeOutbox([...current, operation]);
}

function isConnectionError(error: unknown): boolean {
  if (!hasWindow() || !window.navigator.onLine) return true;
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /fetch|network|offline|connection|failed to fetch|load failed/.test(message);
}

export async function runOrQueue<T>(
  operation: OfflineOperation,
  onlineAction: () => Promise<T>,
): Promise<{ queued: boolean; value: T | null }> {
  if (hasWindow() && !window.navigator.onLine) {
    enqueue(operation);
    return { queued: true, value: null };
  }

  try {
    return { queued: false, value: await onlineAction() };
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    enqueue(operation);
    return { queued: true, value: null };
  }
}

async function execute(operation: OfflineOperation): Promise<void> {
  if (operation.action === "insert") {
    const { error } = await supabase.from(operation.table).insert(operation.payload as never);
    if (error) throw error;
    return;
  }
  if (!operation.recordId) throw new Error("Operação offline sem identificador do registro.");
  if (operation.action === "update") {
    const { error } = await supabase
      .from(operation.table)
      .update(operation.payload as never)
      .eq("id", operation.recordId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(operation.table).delete().eq("id", operation.recordId);
  if (error) throw error;
}

let syncing = false;

export async function syncOfflineOperations(): Promise<{ synced: number; pending: number }> {
  if (!hasWindow() || !window.navigator.onLine || syncing) {
    return { synced: 0, pending: pendingOfflineOperations() };
  }

  syncing = true;
  let synced = 0;
  try {
    const operations = readOutbox();
    for (const operation of operations) {
      try {
        await execute(operation);
        synced += 1;
        writeOutbox(readOutbox().filter((item) => item.id !== operation.id));
      } catch (error) {
        if (isConnectionError(error)) break;
        console.error("Falha ao sincronizar operação offline", operation, error);
        break;
      }
    }
    const pending = pendingOfflineOperations();
    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_EVENT, {
        detail: { pending, synced, completed: pending === 0 },
      }),
    );
    return { synced, pending };
  } finally {
    syncing = false;
  }
}

export function registerOfflineSupport(): () => void {
  if (!hasWindow()) return () => undefined;

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js");
  }

  const sync = () => void syncOfflineOperations();
  window.addEventListener("online", sync);
  window.addEventListener("focus", sync);
  void syncOfflineOperations();

  return () => {
    window.removeEventListener("online", sync);
    window.removeEventListener("focus", sync);
  };
}
