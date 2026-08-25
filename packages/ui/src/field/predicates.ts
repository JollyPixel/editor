// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "./mixed.ts";
import type {
  CollaboratorPresence
} from "../peer/types.ts";

/**
 * Whether a value differs from its default.
 */
export function isModified<TValue>(
  value: FieldValue<TValue>,
  fallback: TValue | undefined,
  equals: (a: TValue, b: TValue) => boolean
): boolean {
  if (fallback === undefined) {
    return false;
  }

  if (isMixed(value)) {
    return true;
  }

  return !equals(value, fallback);
}

/**
 * Resolves a remote holder while excluding the local peer.
 */
export function resolveHolder(
  peers: readonly CollaboratorPresence[],
  lockedBy: CollaboratorPresence | null,
  selfId = ""
): CollaboratorPresence | null {
  if (lockedBy !== null) {
    return lockedBy;
  }
  if (
    peers.some((peer) => peer.clientId === selfId && peer.editing !== undefined)
  ) {
    return null;
  }

  return peers.find(
    (peer) => peer.editing !== undefined
  ) ?? null;
}

/**
 * Splits visible peer chips from their overflow count.
 */
export function splitPeerChips(
  peers: readonly CollaboratorPresence[],
  limit: number
): { shown: CollaboratorPresence[]; overflow: number; } {
  if (peers.length <= limit) {
    return {
      shown: [...peers],
      overflow: 0
    };
  }

  return {
    shown: peers.slice(0, limit),
    overflow: peers.length - limit
  };
}
