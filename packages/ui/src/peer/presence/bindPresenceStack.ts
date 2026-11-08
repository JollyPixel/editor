// Import Internal Dependencies
import type { JollyPeerSelectDetail } from "./events.ts";
import type { PresenceStack } from "./PresenceStack.ts";
import type { PresencePeer } from "../PresencePeer.ts";

export interface PeerListSource {
  readonly peers: readonly PresencePeer[];
  subscribe(
    event: "peersChange",
    listener: (peers: readonly PresencePeer[]) => void
  ): () => void;
}

export function bindPresenceStack(
  element: PresenceStack,
  source: PeerListSource,
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

  show(source.peers);
  const unsubscribe = source.subscribe("peersChange", show);
  element.addEventListener("jolly-peer-select", select);

  return () => {
    unsubscribe();
    element.removeEventListener("jolly-peer-select", select);
  };
}
