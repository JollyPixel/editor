// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockDefinition } from "./blocks/BlockDefinition.ts";
import type { BlockShape } from "./blocks/BlockShape.ts";
import type { VoxelColliderFactory } from "./collision/VoxelCollider.ts";
import type { VoxelDebuggerOptions } from "./debug/VoxelDebugger.ts";
import type { TilesetSource } from "./tileset/loadTilesets.ts";
import type { ViewDistanceOptions } from "./world/ViewDistance.ts";
import type {
  VoxelBlockHookListener,
  VoxelLayerHookListener
} from "./hooks.ts";
import type { VoxelLogger } from "./utils/logger.ts";

export const VoxelRotation = {
  None: 0,
  CCW90: 1,
  Deg180: 2,
  CW90: 3
} as const;

export type ViewDistancePolicy =
  | "hide"
  | "unload";

export type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string
) => void;

export interface VoxelLoadOptions {
  /**
   * Collapses layers before rendering; higher-priority voxels win overlaps.
   */
  mergeLayers?: boolean;

  /**
   * Atlases to register before loading a world that uses them.
   */
  tilesets?: Iterable<TilesetSource>;
}

export interface VoxelEngineOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Collision factory called once with the registries; disabled when omitted.
   */
  collider?: VoxelColliderFactory;
  /**
   * Chunk material type.
   * @default "lambert"
   */
  material?: "lambert" | "standard";

  /**
   * Called once for each new material with its tileset ID.
   */
  materialCustomizer?: MaterialCustomizerFn;

  layers?: string[];
  blocks?: BlockDefinition[];
  /**
   * Shapes registered after the defaults from `BlockShapeRegistry`.
   */
  shapes?: BlockShape[];
  /**
   * Alpha-test cutoff; 0 disables fragment discards.
   * @default 0.1
   */
  alphaTest?: number;

  /**
   * Debug logger; defaults to a no-op implementation.
   */
  logger?: VoxelLogger;

  /**
   * Receives local layer mutations for external synchronization.
   */
  onLayerUpdated?: VoxelLayerHookListener;

  onBlockUpdated?: VoxelBlockHookListener;

  /**
   * Initial debug view; counters are collected in every mode.
   */
  debug?: VoxelDebuggerOptions;

  /**
   * Atlas gutter in texels; 0 disables padding.
   * @default half the tile size, clamped to 2..8
   */
  tilesetPadding?: number;

  /**
   * Enables greedy merging; incompatible with custom UV shader compilation.
   * @default false
   */
  greedy?: boolean;

  /**
   * Preloaded atlases (see `loadTilesets`) registered synchronously during
   * construction.
   */
  tilesets?: Iterable<TilesetSource>;

  /**
   * Per-tick rebuild budget in milliseconds; 0 drains the queue.
   * @default 8
   */
  rebuildBudgetMs?: number;

  /**
   * Chunk radius around `focus` kept meshed and drawn, as a radius in chunks
   * or a full `ViewDistance` description. Ignored while `focus` is null.
   * @default Infinity
   */
  viewDistance?: number | ViewDistanceOptions;

  /**
   * What happens to a chunk that leaves the view distance: `"hide"` keeps its
   * geometry ready to show again, `"unload"` frees it and remeshes on return.
   * @default "hide"
   */
  viewDistancePolicy?: ViewDistancePolicy;
}
