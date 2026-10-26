// Import Internal Dependencies
import type { PresencePeer } from "../peer/types.ts";
import type { PeerMarkMap } from "./PeerMarkTracker.ts";

export interface PeerMarkHandlers<TKey> {
  hold(
    peer: PresencePeer,
    key: TKey
  ): void;
  release(
    clientId: string
  ): void;
}

export function reconcilePeerMarks<TKey>(
  marks: PeerMarkMap<TKey>,
  previous: ReadonlyMap<string, TKey>,
  handlers: PeerMarkHandlers<TKey>
): Map<string, TKey> {
  const next = new Map<string, TKey>();
  const peers = new Map<string, PresencePeer>();
  for (const [key, entries] of marks) {
    for (const peer of entries) {
      next.set(peer.clientId, key);
      peers.set(peer.clientId, peer);
    }
  }

  for (const clientId of previous.keys()) {
    if (!next.has(clientId)) {
      handlers.release(clientId);
    }
  }
  for (const [clientId, key] of next) {
    if (previous.get(clientId) !== key) {
      handlers.hold(peers.get(clientId)!, key);
    }
  }

  return next;
}
