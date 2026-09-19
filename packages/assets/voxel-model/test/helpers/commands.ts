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
  clientId = "client-A"
): T & VoxelModelNetworkCommand {
  seq++;

  return {
    ...command,
    clientId,
    seq,
    timestamp: 1000 + seq
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
