// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "./mixed.ts";
import type {
  CollaboratorPresence
} from "../peer/types.ts";

// CONSTANTS
const kNoPeerChips: PeerChips = Object.freeze({
  shown: Object.freeze([]),
  overflow: 0
});

export interface PeerChips {
  shown: readonly CollaboratorPresence[];
  overflow: number;
}

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
  selfId: string
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
  limit: number,
  selfId: string
): PeerChips {
  if (peers.length === 0) {
    return kNoPeerChips;
  }

  const shown: CollaboratorPresence[] = [];
  let others = 0;
  for (const peer of peers) {
    if (peer.clientId === selfId) {
      continue;
    }

    others++;
    if (others <= limit) {
      shown.push(peer);
    }
  }
  if (others === 0) {
    return kNoPeerChips;
  }

  return {
    shown,
    overflow: Math.max(others - limit, 0)
  };
}
