import { parseTripSnapshot } from "@/lib/trip-payload";
import type { TripState } from "@/types/trip";

export const localTripStorageKey = "singapore-family-trip-v1";
export const localTripBackupKey = "singapore-family-trip-v1-backup";

type StorageReader = Pick<Storage, "getItem" | "removeItem">;

export function extractPastedShareToken(value: string) {
  const candidate = value.trim();
  const fragment = candidate.includes("#") ? candidate.slice(candidate.lastIndexOf("#") + 1) : candidate;
  return /^[a-f0-9]{32}$/i.test(fragment) ? fragment.toLowerCase() : undefined;
}

export function readLocalTrip(storage: StorageReader, key = localTripStorageKey): {
  state?: TripState;
  hadStoredState: boolean;
} {
  const stored = storage.getItem(key);
  if (!stored) return { hadStoredState: false };
  try {
    return { state: parseTripSnapshot(JSON.parse(stored)), hadStoredState: true };
  } catch {
    storage.removeItem(key);
    return { hadStoredState: false };
  }
}

export function makeLocalBackup(state: TripState, now = new Date()) {
  return {
    createdAt: now.toISOString(),
    state: structuredClone(state),
  };
}
