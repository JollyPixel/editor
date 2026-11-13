// Import Internal Dependencies
import type { PeerMetadata } from "../types.ts";

// CONSTANTS
export const PEER_FIELD_LOCK_KEY = "fieldLock";

export function parsePeerFieldLock(
  presence: PeerMetadata | undefined
): string | null {
  const path = presence?.[PEER_FIELD_LOCK_KEY];

  return typeof path === "string" ? path : null;
}
