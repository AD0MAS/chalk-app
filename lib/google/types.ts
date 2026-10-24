// Shared by server and client code (the navbar sync dot, Nustatymai).

/** off = not connected · synced = Sage · syncing = Sand · error = Coral (DESIGN.md §1.1). */
export type SyncState = "off" | "synced" | "syncing" | "error";

export type SyncInfo = {
  state: SyncState;
  pending: number; // lessons/deletions Google does not have yet
  failed: number; // of those, how many failed last time ("nesinchronizuota")
  message: string | null; // connection-level problem, e.g. access revoked
  lastSyncAt: string | null;
};

export const SYNC_OFF: SyncInfo = { state: "off", pending: 0, failed: 0, message: null, lastSyncAt: null };
