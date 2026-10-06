// Import Internal Dependencies
import type { TreeBadge } from "../data/tree/contract.ts";
import type { PeerMarkMap } from "./PeerMarkTracker.ts";

// CONSTANTS
const kMaxBadges = 3;

export function peerBadges<TKey>(
  key: TKey,
  marks: PeerMarkMap<TKey>
): TreeBadge[] {
  const peers = marks.get(key) ?? [];

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
