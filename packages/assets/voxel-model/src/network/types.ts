// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server/kinds";

export interface Vector3JSON {
  x: number;
  y: number;
  z: number;
}

export interface MirrorAxes {
  x: boolean;
  y: boolean;
  z: boolean;
}

export interface GroupTransformJSON {
  position: Vector3JSON;
  pivotOffset: Vector3JSON;
  size: Vector3JSON;
  scale: Vector3JSON;
  rotation: Vector3JSON;
}

export type ModelCommand =
  | {
    action: "group-added";
    uuid: string;
    name: string;
    transform: GroupTransformJSON;
  }
  | {
    action: "group-removed";
    uuid: string;
  }
  | {
    action: "group-renamed";
    uuid: string;
    name: string;
  }
  | {
    action: "group-reparented";
    uuid: string;
    parentUuid: string | null;
    transform: GroupTransformJSON;
  }
  | {
    action: "group-reparented-local";
    uuid: string;
    parentUuid: string | null;
  }
  | {
    action: "group-transformed";
    uuid: string;
    transform: GroupTransformJSON;
    flipAxes?: MirrorAxes;
  };

export type FolderCommand =
  | {
    action: "folder-added";
    uuid: string;
    name: string;
    parentId: string | null;
  }
  | {
    action: "folder-removed";
    uuid: string;
  }
  | {
    action: "folder-renamed";
    uuid: string;
    name: string;
  }
  | {
    action: "folder-reparented";
    uuid: string;
    parentId: string | null;
  }
  | {
    action: "block-placed";
    blockUuid: string;
    folderId: string;
  }
  | {
    action: "block-unplaced";
    blockUuid: string;
  };

export type VoxelModelCommand = ModelCommand | FolderCommand;

export type ModelCommandAction = ModelCommand["action"];
export type FolderCommandAction = FolderCommand["action"];

export type ModelNetworkCommand = ModelCommand & network.NetworkCommandHeader;
export type FolderNetworkCommand = FolderCommand & network.NetworkCommandHeader;
export type VoxelModelNetworkCommand = VoxelModelCommand & network.NetworkCommandHeader;

export interface ModelNodeJSON {
  uuid: string;
  name: string;
  parentUuid: string | null;
  position: Vector3JSON;
  pivotOffset: Vector3JSON;
  size: Vector3JSON;
  scale: Vector3JSON;
  rotation: Vector3JSON;
  flipAxes?: MirrorAxes;
}

export interface FolderNodeJSON {
  uuid: string;
  name: string;
  parentId: string | null;
}

export interface FolderPlacementJSON {
  blockUuid: string;
  folderId: string;
}

export interface VoxelModelSnapshot {
  nodes: ModelNodeJSON[];
  folders: FolderNodeJSON[];
  placements: FolderPlacementJSON[];
}

export type VoxelModelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export type VoxelModelServerMessage = network.NetworkServerMessage<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  VoxelModelAssetNotice
>;

export const MODEL_COMMAND_ACTIONS: readonly ModelCommandAction[] = [
  "group-added",
  "group-removed",
  "group-renamed",
  "group-reparented",
  "group-reparented-local",
  "group-transformed"
];

const kModelActions = new Set<string>(MODEL_COMMAND_ACTIONS);

export function isModelCommand<T extends VoxelModelCommand>(
  command: T
): command is Extract<T, ModelCommand> {
  return kModelActions.has(command.action);
}
