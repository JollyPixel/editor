// Import Internal Dependencies
import { sortSelfFirst } from "./peerOrder.ts";
import type {
  CollaboratorPresence,
  PresencePeer
} from "./types.ts";

export function toPresencePeers(
  peers: Iterable<CollaboratorPresence>,
  selfId: string
): PresencePeer[] {
  return sortSelfFirst(peers, selfId).map((peer) => {
    return {
      ...peer,
      self: peer.clientId === selfId
    };
  });
}
