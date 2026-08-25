// Import Internal Dependencies
import { sortSelfFirst } from "./resolveLock.ts";
import type { PresencePeer } from "./Presence.ts";
import type { CollaboratorPresence } from "./types.ts";

/**
 * Converts a snapshot to display peers with the local peer first.
 */
export function toPresencePeers(
  peers: Iterable<CollaboratorPresence>,
  selfId: string
): PresencePeer[] {
  return sortSelfFirst([...peers], selfId).map((peer) => {
    return {
      ...peer,
      self: peer.clientId === selfId
    };
  });
}
