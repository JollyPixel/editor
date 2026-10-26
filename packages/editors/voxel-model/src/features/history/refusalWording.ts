// Import Third-party Dependencies
import type { RefusalWording } from "@jolly-pixel/history";
import type { PresencePeer } from "@jolly-pixel/ui";

export function refusalWording(
  peers: readonly PresencePeer[]
): RefusalWording {
  return {
    closed: "its animation set is closed",
    peerName: (clientId) => peers.find((peer) => peer.clientId === clientId)?.displayName
  };
}
