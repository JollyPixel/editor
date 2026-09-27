// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

// Import Internal Dependencies
import { createBlockTransform } from "#src/model/blockTransform.ts";
import { createMaterialSurface } from "#src/model/materialSurface.ts";
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  FolderNodeJSON,
  MaterialFolderJSON,
  ModelMaterialJSON,
  UVLayoutData,
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "#src/network/types.ts";

// CONSTANTS
export const TRANSFORM: BlockTransformJSON = createBlockTransform();
export const UV: UVLayoutData = {
  state: "stacked",
  rect: { x: 0, y: 0, width: 16, height: 16 }
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

export function blockNode(
  id: string,
  parentId: string | null = null
): BlockNodeJSON {
  return {
    kind: "block",
    id,
    parentId,
    name: id,
    transform: TRANSFORM,
    uv: UV
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

export function material(
  id: string,
  parentId: string | null = null
): ModelMaterialJSON {
  return {
    kind: "material",
    id,
    parentId,
    name: id,
    surface: createMaterialSurface()
  };
}

export function materialFolder(
  id: string,
  parentId: string | null = null
): MaterialFolderJSON {
  return {
    kind: "folder",
    id,
    parentId,
    name: id
  };
}

export function materialAdded(
  id: string,
  parentId: string | null = null
): VoxelModelCommand {
  return {
    action: "material-added",
    material: material(id, parentId)
  };
}

export function materialFolderAdded(
  id: string,
  parentId: string | null = null
): VoxelModelCommand {
  return {
    action: "material-folder-added",
    folder: materialFolder(id, parentId)
  };
}
