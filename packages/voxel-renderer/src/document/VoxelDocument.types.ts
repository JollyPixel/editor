// Import Internal Dependencies
import type { BlockDefinition } from "../blocks/BlockDefinition.ts";
import type { VoxelHistoryOptions } from "../history/VoxelHistory.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import type { VoxelLogger } from "../utils/logger.ts";
import type {
  VoxelCommandAction,
  VoxelCommandListener,
  VoxelCommandOrigin
} from "../commands.ts";

export interface VoxelApplyOptions {
  /**
   * @default "local"
   */
  origin?: VoxelCommandOrigin;
}

export interface VoxelLoadOptions {
  /**
   * Collapses layers before rendering; higher-priority voxels win overlaps.
   */
  mergeLayers?: boolean;

  /**
   * Tileset definitions declared before loading a world that uses them.
   */
  tilesets?: Iterable<TilesetDefinition>;
}

/**
 * Why every chunk built from this document is out of date.
 */
export interface VoxelInvalidation {
  reason: VoxelCommandAction | "load" | "tileset-registered";
}

export type VoxelDocumentEvents = {
  command: VoxelCommandListener;
  loaded: () => void;
  invalidated: (invalidation: VoxelInvalidation) => void;
};

export interface VoxelDocumentOptions {
  /**
   * @default 16
   */
  chunkSize?: number;

  layers?: string[];
  blocks?: BlockDefinition[];

  /**
   * Tileset definitions declared before any texture is registered for them.
   */
  tilesets?: Iterable<TilesetDefinition>;

  materialGroups?: Iterable<MaterialGroupJSON>;

  /**
   * Undo/redo of voxel edits made through `VoxelWorld`; disabled by default.
   */
  history?: VoxelHistoryOptions;

  /**
   * Debug logger; defaults to a no-op implementation.
   */
  logger?: VoxelLogger;

  /**
   * Subscribed to the `"command"` event before any command is applied.
   */
  onCommand?: VoxelCommandListener;
}
