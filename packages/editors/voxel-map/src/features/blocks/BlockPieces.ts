// Import Third-party Dependencies
import type * as THREE from "three";
import {
  BlockSurface,
  type ResolvedBlockDefinition,
  type VoxelTransform
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockGeometry,
  textureOf,
  type BlockRenderSources
} from "./blockGeometry.ts";

export interface BlockPiece {
  readonly geometry: THREE.BufferGeometry;
  readonly texture: THREE.Texture | null;
  readonly surface: BlockSurface;
}

export class BlockPieces {
  readonly #sources: BlockRenderSources;
  readonly #pieces = new Map<ResolvedBlockDefinition, Map<number, BlockPiece | null>>();
  #atlasVersion: number;

  constructor(
    sources: BlockRenderSources
  ) {
    this.#sources = sources;
    this.#atlasVersion = sources.atlases.version;
  }

  pieceOf(
    block: ResolvedBlockDefinition,
    transform: VoxelTransform
  ): BlockPiece | null {
    if (this.#atlasVersion !== this.#sources.atlases.version) {
      this.#atlasVersion = this.#sources.atlases.version;
      this.clear();
    }

    let byTransform = this.#pieces.get(block);
    if (byTransform === undefined) {
      byTransform = new Map();
      this.#pieces.set(block, byTransform);
    }

    const cached = byTransform.get(transform.packed);
    if (cached !== undefined) {
      return cached;
    }

    const geometry = buildBlockGeometry(block, this.#sources, transform);
    const piece = geometry === null ?
      null :
      {
        geometry,
        texture: textureOf(block, this.#sources),
        surface: new BlockSurface(block)
      };
    byTransform.set(transform.packed, piece);

    return piece;
  }

  clear(): void {
    for (const byTransform of this.#pieces.values()) {
      for (const piece of byTransform.values()) {
        piece?.geometry.dispose();
      }
    }
    this.#pieces.clear();
  }
}
