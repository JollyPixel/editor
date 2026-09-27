// Import Third-party Dependencies
import type { TreeBadge } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// CONSTANTS
const kMaxBadges = 3;

export function peerBadges(
  id: string,
  marks: PeerMarkMap<string>
): TreeBadge[] {
  const peers = marks.get(id) ?? [];

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
