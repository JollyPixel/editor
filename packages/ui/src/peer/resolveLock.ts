// Import Internal Dependencies
import type { CollaboratorPresence } from "./types.ts";

export interface ResolvedLock {
  /**
   * Remote holder, or null while the local peer owns the path.
   */
  lockedBy: CollaboratorPresence | null;
  /** Everyone advertising the path, local peer included, in a stable order. */
  peers: CollaboratorPresence[];
}

const kEmptyLock: ResolvedLock = {
  lockedBy: null,
  peers: []
};

/**
 * Resolves one path, giving the local peer precedence.
 */
export function resolveLock(
  peers: Iterable<CollaboratorPresence>,
  path: string | null,
  selfId: string
): ResolvedLock {
  if (path === null) {
    return kEmptyLock;
  }

  const editing = [...peers].filter((peer) => peer.editing === path);
  if (editing.length === 0) {
    return kEmptyLock;
  }

  const held = editing.some((peer) => peer.clientId === selfId);

  return {
    lockedBy: held ?
      null :
      editing.find((peer) => peer.clientId !== selfId) ?? null,
    peers: sortSelfFirst(editing, selfId)
  };
}

/**
 * Sorts self first, then by `clientId` for consistent client order.
 */
export function sortSelfFirst<TPeer extends CollaboratorPresence>(
  peers: readonly TPeer[],
  selfId: string
): TPeer[] {
  return [...peers].sort((left, right) => {
    if (left.clientId === selfId) {
      return right.clientId === selfId ? 0 : -1;
    }
    if (right.clientId === selfId) {
      return 1;
    }

    return left.clientId < right.clientId ? -1 : Number(left.clientId > right.clientId);
  });
}
