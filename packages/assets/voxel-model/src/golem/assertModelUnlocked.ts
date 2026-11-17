// Import Third-party Dependencies
import { LockedByPeerError } from "@jolly-pixel/golem.kit";
import {
  parsePeerProfile,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  holdsModelLock,
  modelFootprint,
  type ModelValueRef,
  type VoxelModelCommand
} from "../network/client.ts";

export function assertModelUnlocked(
  room: Room,
  commands: readonly VoxelModelCommand[]
): void {
  const refs = commands.flatMap((command) => modelFootprint(command).conflicts);
  if (refs.length === 0) {
    return;
  }

  for (const peer of room.peers.values()) {
    const locked = peer.clientId === room.clientId ?
      undefined :
      refs.find((ref) => holdsModelLock(peer.presence, ref));
    if (locked !== undefined) {
      throw new LockedByPeerError(
        parsePeerProfile(peer.profile).username,
        lockLabel(locked)
      );
    }
  }
}

function lockLabel(
  ref: ModelValueRef
): string {
  switch (ref.kind) {
    case "material-name":
      return `the name of material ${JSON.stringify(ref.id)}`;
    case "material-surface":
      return `the ${ref.field} of material ${JSON.stringify(ref.id)}`;
    default:
      return `the ${ref.kind} of block ${JSON.stringify(ref.id)}`;
  }
}
