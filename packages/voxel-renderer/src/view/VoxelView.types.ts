// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockSurface } from "../blocks/BlockSurface.ts";
import type { BlockShape } from "../blocks/shape/BlockShape.ts";
import type { VoxelColliderFactory } from "../collision/VoxelCollider.ts";
import type { VoxelInspectorOptions } from "../inspector/index.ts";
import type { TilesetSource } from "../tileset/loadTilesets.ts";
import type { VoxelLogger } from "../utils/logger.ts";
import type { ViewDistanceOptions } from "../world/ViewDistance.ts";

export type ViewDistancePolicy =
  | "hide"
  | "unload";

export type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string,
  surface: BlockSurface
) => void;

export type TileMinification =
  | "average"
  | "nearest";

export interface VoxelViewOptions {
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
   * Called once for each new material with its tileset ID and surface;
   * `surface.materialGroup` tells grouped blocks apart.
   */
  materialCustomizer?: MaterialCustomizerFn;

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
   * Initial inspector view; mesh counters are collected in every mode.
   */
  inspector?: VoxelInspectorOptions;

  /**
   * Enables greedy merging; incompatible with custom UV shader compilation.
   * @default false
   */
  greedy?: boolean;

  /**
   * How atlas tiles are drawn once a screen pixel covers several texels.
   * `"average"` fades distant faces toward the average colour of their tile,
   * which stops the moire and shimmer that `"nearest"` shows far away.
   * Needs readable atlas pixels (a 2D canvas, same-origin images); falls
   * back to `"nearest"` otherwise.
   * @default "average"
   */
  tileMinification?: TileMinification;

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

  /**
   * Keeps the shader-only `tileRegion` and `tileRepeat` chunk attributes in
   * JavaScript memory after their first render uploads them. Raycasting and
   * colliders never read them; a renderer that did not draw the chunk first
   * cannot upload them once released.
   * @default false
   */
  retainVertexData?: boolean;

  /**
   * Strength of the ambient occlusion baked into chunk vertices, from 0 (off)
   * to 1 (fully occluded corners turn black). Darkens the albedo, so it
   * shades direct and indirect light alike.
   * @default 0
   */
  ambientOcclusion?: number;

  /**
   * Chunk meshes cast shadows; assignable later through `castShadow`.
   * @default false
   */
  castShadow?: boolean;

  /**
   * Chunk meshes receive shadows; assignable later through `receiveShadow`.
   * @default false
   */
  receiveShadow?: boolean;
}
