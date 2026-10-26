// Import Third-party Dependencies
import type { PeerColorAllocator } from "@jolly-pixel/three";
import type { PresencePeer } from "@jolly-pixel/ui";

// CONSTANTS
const kFallbackColor = "#ffffff";

export function presenceColorAllocator(
  peers: () => readonly PresencePeer[]
): PeerColorAllocator {
  return {
    peerColor: (clientId) => peers()
      .find((peer) => peer.clientId === clientId)?.color ?? kFallbackColor,
    release: () => void 0
  };
}
