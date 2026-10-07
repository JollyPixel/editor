// Import Third-party Dependencies
import type { HistoryRefusal } from "@jolly-pixel/history";
import type { PresencePeer } from "@jolly-pixel/ui";

export function describeRefusal(
  refusal: HistoryRefusal,
  peers: readonly PresencePeer[]
): string {
  switch (refusal.reason) {
    case "server":
      return "the server refused it";
    case "closed":
      return "its animation set is closed";
    case "gone":
      return "it is gone";
    case "changed":
      return "it was changed since";
    case "dropped":
      return "it was lost while offline";
    case "peer": {
      const peer = peers.find(({ clientId }) => clientId === refusal.clientId);

      return peer === undefined ? "it was changed since" : `${peer.displayName} changed it since`;
    }
  }
}
