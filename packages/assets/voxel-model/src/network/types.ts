// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import type {
  folderCommandSchema,
  folderNodeSchema,
  folderPlacementSchema,
  groupTransformSchema,
  mirrorAxesSchema,
  modelCommandSchema,
  modelNodeSchema,
  vector3Schema,
  voxelModelSnapshotSchema
} from "./VoxelModelCommand.schema.ts";

export type Vector3JSON = network.Infer<typeof vector3Schema>;
export type MirrorAxes = network.Infer<typeof mirrorAxesSchema>;
export type GroupTransformJSON = network.Infer<typeof groupTransformSchema>;

export type ModelCommand = network.Infer<typeof modelCommandSchema>;
export type FolderCommand = network.Infer<typeof folderCommandSchema>;

export type VoxelModelCommand = ModelCommand | FolderCommand;

export type ModelCommandAction = ModelCommand["action"];
export type FolderCommandAction = FolderCommand["action"];

export type ModelNetworkCommand = ModelCommand & network.NetworkCommandHeader;
export type FolderNetworkCommand = FolderCommand & network.NetworkCommandHeader;
export type VoxelModelNetworkCommand = VoxelModelCommand & network.NetworkCommandHeader;

export type ModelNodeJSON = network.Infer<typeof modelNodeSchema>;
export type FolderNodeJSON = network.Infer<typeof folderNodeSchema>;
export type FolderPlacementJSON = network.Infer<typeof folderPlacementSchema>;
export type VoxelModelSnapshot = network.Infer<typeof voxelModelSnapshotSchema>;

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
