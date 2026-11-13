// Import Third-party Dependencies
import type { EditableDocumentKind } from "@jolly-pixel/network/client";
import type { VoxelWorldCommand } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BLOCKSET_KIND } from "../asset/blockset.ts";
import { VOXEL_MAP_KIND } from "../asset/voxelMap.ts";
import {
  blocksetCommandProtocol,
  blocksetEditCommandSchema
} from "./blockset/BlocksetCommand.schema.ts";
import {
  blocksetDocumentKind,
  type SyncedBlockset,
  type SyncedBlocksetOptions
} from "./blockset/SyncedBlockset.ts";
import type {
  BlocksetEditCommand,
  BlocksetRoom
} from "./blockset/types.ts";
import {
  voxelCommandProtocol,
  voxelCommandSchema
} from "./voxelMap/VoxelCommand.schema.ts";
import {
  voxelMapDocumentKind,
  type SyncedVoxelMap,
  type SyncedVoxelMapOptions
} from "./voxelMap/SyncedVoxelMap.ts";
import type { VoxelMapRoom } from "./voxelMap/types.ts";

export type VoxelMapEditableKind = EditableDocumentKind<
  typeof VOXEL_MAP_KIND,
  VoxelMapRoom,
  SyncedVoxelMap,
  VoxelWorldCommand
>;

export type BlocksetEditableKind = EditableDocumentKind<
  typeof BLOCKSET_KIND,
  BlocksetRoom,
  SyncedBlockset,
  BlocksetEditCommand
>;

export function voxelMapEditableKind(
  options: SyncedVoxelMapOptions = {}
): VoxelMapEditableKind {
  return {
    ...voxelMapDocumentKind(options),
    commandSchema: voxelCommandSchema,
    commandProtocol: voxelCommandProtocol,
    localEdits: (synced) => synced
  };
}

export function blocksetEditableKind(
  options: SyncedBlocksetOptions = {}
): BlocksetEditableKind {
  return {
    ...blocksetDocumentKind(options),
    commandSchema: blocksetEditCommandSchema,
    commandProtocol: blocksetCommandProtocol,
    localEdits: (synced) => synced
  };
}
