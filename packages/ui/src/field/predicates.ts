// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "./mixed.ts";
import type { PresencePeer } from "../peer/PresencePeer.ts";

// CONSTANTS
const kNoPeerChips: PeerChips = Object.freeze({
  shown: Object.freeze([]),
  overflow: 0
});

export interface PeerChips {
  shown: readonly PresencePeer[];
  overflow: number;
}

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

export function lockHolder(
  editors: readonly PresencePeer[]
): PresencePeer | null {
  if (editors.some((peer) => peer.self === true)) {
    return null;
  }

  return editors[0] ?? null;
}

export function splitPeerChips(
  editors: readonly PresencePeer[],
  limit: number
): PeerChips {
  if (editors.length === 0) {
    return kNoPeerChips;
  }

  const shown: PresencePeer[] = [];
  let others = 0;
  for (const peer of editors) {
    if (peer.self === true) {
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
