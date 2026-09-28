// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockSurface } from "../blocks/BlockSurface.ts";
import type { ChunkMaterialCache } from "../render/ChunkMaterialCache.ts";

export type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string,
  surface: BlockSurface
) => void;

export type TileMinification =
  | "average"
  | "nearest";

export interface VoxelRenderingOptions {
  /**
   * Chunk material type.
   * @default "lambert"
   */
  material?: "lambert" | "standard";

  /**
   * Called once for each new material with its tileset ID and surface;
   * `surface.materialGroup` tells grouped blocks apart. Chunk vertices are
   * pulled in the vertex shader, so the material's `positionNode` must stay
   * untouched and `map` is null.
   */
  customizer?: MaterialCustomizerFn;

  /**
   * Alpha-test cutoff; 0 disables fragment discards.
   * @default 0.1
   */
  alphaTest?: number;

  /**
   * Mask blocks write their texel coverage as MSAA sample coverage.
   * Needs a multisampled target and an opaque canvas.
   * @default false
   */
  alphaToCoverage?: boolean;

  /**
   * How atlas tiles are drawn once a screen pixel covers several texels.
   * `"average"` box-filters the texels each pixel covers, which stops the
   * moire and shimmer that `"nearest"` shows far away.
   *
   * Needs readable atlas pixels (a 2D canvas, same-origin images); falls back to `"nearest"` otherwise.
   * @default "average"
   */
  tileMinification?: TileMinification;
}

export interface VoxelRenderingContext {
  materials: ChunkMaterialCache;
  remesh: (source: string) => void;
}

export class VoxelRendering {
  #context: VoxelRenderingContext;

  constructor(
    context: VoxelRenderingContext
  ) {
    this.#context = context;
  }

  get tileMinification(): TileMinification {
    return this.#context.materials.tileAveraging ? "average" : "nearest";
  }

  set tileMinification(
    value: TileMinification
  ) {
    const { materials, remesh } = this.#context;
    const averaging = value === "average";
    if (averaging === materials.tileAveraging) {
      return;
    }

    materials.tileAveraging = averaging;
    materials.invalidate();
    remesh("tileMinification");
  }

  get alphaToCoverage(): boolean {
    return this.#context.materials.alphaToCoverage;
  }

  set alphaToCoverage(
    value: boolean
  ) {
    const { materials, remesh } = this.#context;
    if (value === materials.alphaToCoverage) {
      return;
    }

    materials.alphaToCoverage = value;
    materials.invalidate();
    remesh("alphaToCoverage");
  }
}
