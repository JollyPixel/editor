// Import Internal Dependencies
import type { CollaboratorPresence } from "./types.ts";

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
