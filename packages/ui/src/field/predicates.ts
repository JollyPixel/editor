// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "./mixed.ts";
import type {
  CollaboratorPresence
} from "../collab/types.ts";

/**
 * Whether a value differs from its default.
 */
export function isModified<TValue>(
  value: FieldValue<TValue>,
  fallback: TValue | undefined,
  equals: (a: TValue, b: TValue) => boolean = Object.is
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
 * Resolves the peer that owns a field lock.
 */
export function resolveHolder(
  peers: readonly CollaboratorPresence[],
  lockedBy: CollaboratorPresence | null
): CollaboratorPresence | null {
  if (lockedBy !== null) {
    return lockedBy;
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
