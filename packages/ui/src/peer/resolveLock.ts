// Import Internal Dependencies
import { sortSelfFirst } from "./peerOrder.ts";
import type { CollaboratorPresence } from "./types.ts";

export interface ResolvedLock {
  /**
   * Remote holder, or null while the local peer owns the path.
   */
  lockedBy: CollaboratorPresence | null;
  /**
   * Everyone advertising the path, local peer included, in a stable order.
   */
  peers: readonly CollaboratorPresence[];
}

const kEmptyLock: ResolvedLock = Object.freeze({
  lockedBy: null,
  peers: Object.freeze([])
});

export function resolveLock(
  peers: Iterable<CollaboratorPresence>,
  path: string | null,
  selfId: string
): ResolvedLock {
  if (path === null) {
    return kEmptyLock;
  }

  let editing: CollaboratorPresence[] | null = null;
  for (const peer of peers) {
    if (peer.editing === path) {
      editing ??= [];
      editing.push(peer);
    }
  }
  if (editing === null) {
    return kEmptyLock;
  }

  const ordered = sortSelfFirst(editing, selfId);

  return {
    lockedBy: ordered[0].clientId === selfId ? null : ordered[0],
    peers: ordered
  };
}
