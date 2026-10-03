// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

export interface PeerMarkHandlers {
  hold(
    peer: PresencePeer,
    uuid: string
  ): void;
  release(
    clientId: string
  ): void;
}

export function reconcilePeerMarks(
  marks: PeerMarkMap<string>,
  previous: ReadonlyMap<string, string>,
  handlers: PeerMarkHandlers
): Map<string, string> {
  const next = new Map<string, string>();
  const peers = new Map<string, PresencePeer>();
  for (const [uuid, entries] of marks) {
    for (const peer of entries) {
      next.set(peer.clientId, uuid);
      peers.set(peer.clientId, peer);
    }
  }

  for (const clientId of previous.keys()) {
    if (!next.has(clientId)) {
      handlers.release(clientId);
    }
  }
  for (const [clientId, uuid] of next) {
    if (previous.get(clientId) !== uuid) {
      handlers.hold(peers.get(clientId)!, uuid);
    }
  }

  return next;
}
