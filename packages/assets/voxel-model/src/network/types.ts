// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server";
import type { UVLayoutData } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  blockNodeSchema,
  blockTransformSchema,
  folderNodeSchema,
  mirrorAxesSchema,
  nodeTransformSchema,
  vector3Schema,
  voxelModelCommandSchema,
  voxelModelSnapshotSchema
} from "./VoxelModelCommand.schema.ts";

export type Vector3JSON = network.Infer<typeof vector3Schema>;
export type MirrorAxes = network.Infer<typeof mirrorAxesSchema>;
export type BlockTransformJSON = network.Infer<typeof blockTransformSchema>;
export type NodeTransformJSON = network.Infer<typeof nodeTransformSchema>;

export type { UVLayoutData };

export type FolderNodeJSON = network.Infer<typeof folderNodeSchema>;
export type BlockNodeJSON = network.Infer<typeof blockNodeSchema>;
export type ModelNodeJSON = FolderNodeJSON | BlockNodeJSON;
export type ModelNodeKind = ModelNodeJSON["kind"];

export type VoxelModelCommand = network.Infer<typeof voxelModelCommandSchema>;
export type VoxelModelCommandAction = VoxelModelCommand["action"];
export type VoxelModelNetworkCommand = VoxelModelCommand & network.NetworkCommandHeader;
export type VoxelModelSnapshot = network.Infer<typeof voxelModelSnapshotSchema>;

export type VoxelModelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export type VoxelModelServerMessage = network.NetworkServerMessage<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  VoxelModelAssetNotice
>;

export type VoxelModelRoom = network.Room<
  VoxelModelNetworkCommand,
  VoxelModelServerMessage
>;
