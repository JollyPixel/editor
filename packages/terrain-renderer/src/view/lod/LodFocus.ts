// Import Internal Dependencies
import {
  ChunkCoord,
  type ChunkKey
} from "../../terrain/ChunkCoord.ts";

// CONSTANTS
const kInset = 1e-3;

export const NO_FOCUS: NodeFocus = Object.freeze({ bias: 1, minLevel: Infinity });

export interface LodFocusArea {
  readonly chunks: readonly { readonly x: number; readonly z: number; }[];
  /**
   * Factor on the LoD distance bands over the area's chunks.
   */
  readonly lodBias: number;
  /**
   * The coarsest level the area's chunks are drawn at, whatever their distance.
   */
  readonly minLevel: number;
}

export interface NodeFocus {
  readonly bias: number;
  readonly minLevel: number;
}

export class LodFocus {
  #chunks = new Map<ChunkKey, NodeFocus>();

  constructor(
    areas: Iterable<LodFocusArea> = []
  ) {
    for (const { chunks, lodBias, minLevel } of areas) {
      for (const { x, z } of chunks) {
        const key = new ChunkCoord(x, z).key;
        const known = this.#chunks.get(key) ?? NO_FOCUS;
        this.#chunks.set(key, {
          bias: Math.max(known.bias, lodBias),
          minLevel: Math.min(known.minLevel, minLevel)
        });
      }
    }
  }

  over(
    x: number,
    z: number,
    size: number
  ): NodeFocus {
    if (this.#chunks.size === 0) {
      return NO_FOCUS;
    }

    const first = ChunkCoord.containing(x, z);
    const last = ChunkCoord.containing(x + size - kInset, z + size - kInset);
    let bias = NO_FOCUS.bias;
    let minLevel = NO_FOCUS.minLevel;
    for (let chunkZ = first.z; chunkZ <= last.z; chunkZ++) {
      for (let chunkX = first.x; chunkX <= last.x; chunkX++) {
        const focus = this.#chunks.get(`${chunkX},${chunkZ}`);
        if (focus !== undefined) {
          bias = Math.max(bias, focus.bias);
          minLevel = Math.min(minLevel, focus.minLevel);
        }
      }
    }

    return bias === NO_FOCUS.bias && minLevel === NO_FOCUS.minLevel ? NO_FOCUS : { bias, minLevel };
  }
}
