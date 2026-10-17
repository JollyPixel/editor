// Import Third-party Dependencies
import type {
  JollyPeerSelectDetail,
  PresencePeer,
  PresenceStack
} from "@jolly-pixel/ui";

export interface PresenceSource {
  readonly peers: readonly PresencePeer[];
  subscribe(
    event: "peersChange",
    listener: (peers: readonly PresencePeer[]) => void
  ): () => void;
}

export function bindPresenceStack(
  element: PresenceStack,
  presence: PresenceSource,
  onSelect: (clientId: string) => void
): () => void {
  function show(
    peers: readonly PresencePeer[]
  ): void {
    element.peers = peers;
    element.hidden = peers.every((peer) => peer.self);
  }

  function select(
    event: CustomEvent<JollyPeerSelectDetail>
  ): void {
    onSelect(event.detail.clientId);
  }

  show(presence.peers);
  const unsubscribe = presence.subscribe("peersChange", show);
  element.addEventListener("jolly-peer-select", select);

  return () => {
    unsubscribe();
    element.removeEventListener("jolly-peer-select", select);
  };
}
