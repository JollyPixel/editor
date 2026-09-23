// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type {
  VoxelLayerConfigurableOptions,
  VoxelLayerOptions
} from "./world/VoxelLayer.ts";
import type { VoxelCoord } from "./world/types.ts";
import type { VoxelPatchCells } from "./world/voxelPatch.ts";
import type {
  ResolvedBlockDefinition
} from "./blocks/BlockDefinition.ts";
import type { TilesetDefinition } from "./tileset/types.ts";
import type {
  VoxelObjectLayerJSON,
  VoxelObjectJSON
} from "./serialization/types.ts";
import type {
  VoxelSetOptions,
  VoxelRemoveOptions,
  PartialExcept
} from "./types.ts";

export type VoxelLayerCommand =
  | {
    action: "added";
    layerName: string;
    metadata: {
      options: VoxelLayerConfigurableOptions;
    };
  }
  | {
    action: "removed";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "updated";
    layerName: string;
    metadata: {
      options: Partial<VoxelLayerConfigurableOptions>;
    };
  }
  | {
    action: "cloned";
    layerName: string;
    metadata: {
      options: PartialExcept<VoxelLayerOptions, "name">;
    };
  }
  | {
    action: "merged";
    layerName: string;
    metadata: {
      targetLayerName: string;
    };
  }
  | {
    action: "position-updated";
    layerName: string;
    metadata: { position: VoxelCoord; } | { delta: VoxelCoord; };
  }
  | {
    action: "position-rebased";
    layerName: string;
    metadata: { position: VoxelCoord; };
  }
  | {
    action: "voxel-set";
    layerName: string;
    metadata: {
      position: Vector3Like;
      blockId: number;
      rotation: number;
      flipX: boolean;
      flipZ: boolean;
      flipY: boolean;
    };
  }
  | {
    action: "voxel-removed";
    layerName: string;
    metadata: {
      position: Vector3Like;
    };
  }
  | {
    action: "voxels-set";
    layerName: string;
    metadata: {
      entries: VoxelSetOptions[];
    };
  }
  | {
    action: "voxels-removed";
    layerName: string;
    metadata: {
      entries: VoxelRemoveOptions[];
    };
  }
  | {
    action: "voxels-patched";
    layerName: string;
    metadata: {
      cells: VoxelPatchCells;
    };
  }
  | {
    action: "reordered";
    layerName: string;
    metadata: {
      direction: "up" | "down";
    };
  }
  | {
    action: "layer-moved";
    layerName: string;
    metadata: {
      toIndex: number;
    };
  }
  | {
    action: "object-layer-added";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "object-layer-removed";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "object-layer-updated";
    layerName: string;
    metadata: {
      patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>;
    };
  }
  | {
    action: "object-added";
    layerName: string;
    metadata: {
      object: VoxelObjectJSON;
    };
  }
  | {
    action: "object-removed";
    layerName: string;
    metadata: {
      objectId: string;
    };
  }
  | {
    action: "object-moved";
    layerName: string;
    metadata: {
      objectId: string;
      fromLayerName: string;
      toLayerName: string;
    };
  }
  | {
    action: "object-updated";
    layerName: string;
    metadata: {
      objectId: string;
      patch: Partial<VoxelObjectJSON>;
    };
  };

export type VoxelLayerCommandAction = VoxelLayerCommand["action"];

export const VOXEL_LAYER_COMMAND_ACTIONS: readonly VoxelLayerCommandAction[] = [
  "added",
  "removed",
  "updated",
  "cloned",
  "merged",
  "position-updated",
  "position-rebased",
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed",
  "voxels-patched",
  "reordered",
  "layer-moved",
  "object-layer-added",
  "object-layer-removed",
  "object-layer-updated",
  "object-added",
  "object-removed",
  "object-moved",
  "object-updated"
];

export type VoxelBlockCommand =
  | {
    action: "block-defined";
    block: ResolvedBlockDefinition;
  }
  | {
    action: "block-removed";
    blockId: number;
  }
  | {
    action: "block-moved";
    blockId: number;
    toIndex: number;
  };

export type VoxelBlockCommandAction = VoxelBlockCommand["action"];

export const VOXEL_BLOCK_COMMAND_ACTIONS: readonly VoxelBlockCommandAction[] = [
  "block-defined",
  "block-removed",
  "block-moved"
];

export type VoxelTilesetCommand =
  | {
    action: "tileset-added";
    tileset: TilesetDefinition;
  }
  | {
    action: "tileset-removed";
    tilesetId: string;
  }
  | {
    action: "tileset-resized";
    tilesetId: string;
    tileSize: number;
  }
  | {
    action: "default-tile-size-updated";
    defaultTileSize: number;
  };

export type VoxelTilesetCommandAction = VoxelTilesetCommand["action"];

export const VOXEL_TILESET_COMMAND_ACTIONS: readonly VoxelTilesetCommandAction[] = [
  "tileset-added",
  "tileset-removed",
  "tileset-resized",
  "default-tile-size-updated"
];

export type VoxelCommand =
  | VoxelLayerCommand
  | VoxelBlockCommand
  | VoxelTilesetCommand;

export type VoxelCommandAction = VoxelCommand["action"];

export const VOXEL_COMMAND_ACTIONS: readonly VoxelCommandAction[] = [
  ...VOXEL_LAYER_COMMAND_ACTIONS,
  ...VOXEL_BLOCK_COMMAND_ACTIONS,
  ...VOXEL_TILESET_COMMAND_ACTIONS
];

export type VoxelCommandOrigin = "local" | "remote";

export interface VoxelCommandContext {
  /**
   * `"local"` for a change made on this engine, `"remote"` for a command
   * replayed with `apply()` on behalf of another peer.
   */
  origin: VoxelCommandOrigin;
}

export type VoxelCommandListener = (
  command: VoxelCommand,
  context: VoxelCommandContext
) => void;

export function isVoxelLayerCommand(
  command: { action: string; }
): command is VoxelLayerCommand {
  return VOXEL_LAYER_COMMAND_ACTIONS.some(
    (action) => action === command.action
  );
}

export function isVoxelBlockCommand(
  command: { action: string; }
): command is VoxelBlockCommand {
  return VOXEL_BLOCK_COMMAND_ACTIONS.some(
    (action) => action === command.action
  );
}

export function isVoxelTilesetCommand(
  command: { action: string; }
): command is VoxelTilesetCommand {
  return VOXEL_TILESET_COMMAND_ACTIONS.some(
    (action) => action === command.action
  );
}
