// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  GroupTransformJSON,
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "#src/network/types.ts";

// CONSTANTS
export const TRANSFORM: GroupTransformJSON = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

let seq = 0;

export function networkCommand<T extends VoxelModelCommand>(
  command: T,
  overrides: Partial<NetworkCommandHeader> = {}
): T & VoxelModelNetworkCommand {
  seq++;

  return {
    ...command,
    clientId: "client-A",
    seq,
    timestamp: 1000 + seq,
    ...overrides
  } as T & VoxelModelNetworkCommand;
}

export function groupAdded(
  uuid: string,
  name = uuid
): VoxelModelCommand {
  return {
    action: "group-added",
    uuid,
    name,
    transform: TRANSFORM
  };
}
