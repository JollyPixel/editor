// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

// Import Internal Dependencies
import { createBlockTransform } from "#src/model/blockTransform.ts";
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  FolderNodeJSON,
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "#src/network/types.ts";

// CONSTANTS
export const TRANSFORM: BlockTransformJSON = createBlockTransform();

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

export function blockNode(
  id: string,
  parentId: string | null = null
): BlockNodeJSON {
  return {
    kind: "block",
    id,
    parentId,
    name: id,
    transform: TRANSFORM
  };
}

export function folderNode(
  id: string,
  parentId: string | null = null
): FolderNodeJSON {
  return {
    kind: "folder",
    id,
    parentId,
    name: id
  };
}

export function blockAdded(
  id: string,
  parentId: string | null = null
): VoxelModelCommand {
  return {
    action: "node-added",
    node: blockNode(id, parentId)
  };
}

export function folderAdded(
  id: string,
  parentId: string | null = null
): VoxelModelCommand {
  return {
    action: "node-added",
    node: folderNode(id, parentId)
  };
}
