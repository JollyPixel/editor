// Import Third-party Dependencies
import type {
  PeerMarks,
  PresencePeer
} from "@jolly-pixel/ui";

// CONSTANTS
const kSelfFallbackColor = "#5b7fb8";
const kSelfFallbackName = "You";

export function withSelf<TKey>(
  marks: PeerMarks<TKey>,
  key: TKey | null,
  peers: Iterable<PresencePeer>
): PeerMarks<TKey> {
  return key === null ? marks : marks.prepend(findSelf(peers), key);
}

function findSelf(
  peers: Iterable<PresencePeer>
): PresencePeer {
  for (const peer of peers) {
    if (peer.self) {
      return {
        clientId: peer.clientId,
        displayName: peer.displayName,
        color: peer.color,
        self: true
      };
    }
  }

  return {
    clientId: "",
    displayName: kSelfFallbackName,
    color: kSelfFallbackColor,
    self: true
  };
}
