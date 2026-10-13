// Import Internal Dependencies
import type {
  CollaboratorPresence,
  PresencePeer
} from "./types.ts";

export function compareClientIds(
  left: string,
  right: string
): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function sortSelfFirst<TPeer extends CollaboratorPresence>(
  peers: Iterable<TPeer>,
  selfId: string
): TPeer[] {
  return [...peers].sort((left, right) => {
    if (left.clientId === selfId || right.clientId === selfId) {
      return Number(right.clientId === selfId) -
        Number(left.clientId === selfId);
    }

    return compareClientIds(left.clientId, right.clientId);
  });
}

export function normalizePeerMax(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return Infinity;
  }

  return Math.max(0, Math.floor(value));
}

export interface PeerPartition<TPeer extends PresencePeer> {
  visible: readonly TPeer[];
  hidden: readonly TPeer[];
}

export function partitionPeers<TPeer extends PresencePeer>(
  peers: readonly TPeer[],
  max: number
): PeerPartition<TPeer> {
  if (peers.length <= max) {
    return {
      visible: peers,
      hidden: []
    };
  }

  const selfIndex = peers.findIndex((peer) => peer.self);
  if (max === 0 || selfIndex < max) {
    return {
      visible: peers.slice(0, max),
      hidden: peers.slice(max)
    };
  }

  return {
    visible: [...peers.slice(0, max - 1), peers[selfIndex]],
    hidden: peers.filter(
      (_, index) => index >= max - 1 && index !== selfIndex
    )
  };
}
