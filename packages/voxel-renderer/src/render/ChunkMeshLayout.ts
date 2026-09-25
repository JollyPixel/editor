// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type {
  IterableLayerChunk,
  VoxelWorld
} from "../world/VoxelWorld.ts";
import type { VoxelCoord } from "../world/types.ts";

export interface ChunkMeshTarget {
  readonly key: string;
  readonly layer: VoxelLayer | null;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly origin: Readonly<VoxelCoord>;
}

export class ChunkMeshLayout {
  #world: VoxelWorld;

  constructor(
    world: VoxelWorld
  ) {
    this.#world = world;
  }

  composites(
    layer: VoxelLayer
  ): boolean {
    const size = this.#world.chunkSize;
    const { x, y, z } = layer.position;

    return layer.visible &&
      layer.opacity >= 1 &&
      x % size === 0 &&
      y % size === 0 &&
      z % size === 0;
  }

  originOf(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): VoxelCoord {
    const size = this.#world.chunkSize;

    return {
      x: (chunk.cx * size) + layer.position.x,
      y: (chunk.cy * size) + layer.position.y,
      z: (chunk.cz * size) + layer.position.z
    };
  }

  targetOf(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): ChunkMeshTarget | null {
    if (!layer.effectivelyVisible) {
      return null;
    }

    const origin = this.originOf(layer, chunk);
    if (!this.composites(layer)) {
      return {
        key: `layer:${layer.id}:${chunk}`,
        layer,
        cx: chunk.cx,
        cy: chunk.cy,
        cz: chunk.cz,
        origin
      };
    }

    const size = this.#world.chunkSize;
    const cx = origin.x / size;
    const cy = origin.y / size;
    const cz = origin.z / size;

    return {
      key: `cell:${cx},${cy},${cz}`,
      layer: null,
      cx,
      cy,
      cz,
      origin
    };
  }

  membersOf(
    target: ChunkMeshTarget
  ): IterableLayerChunk[] {
    const layers = this.#world.getLayers();
    const { layer } = target;

    if (layer !== null) {
      const chunk = layers.includes(layer) &&
        layer.effectivelyVisible &&
        !this.composites(layer) ?
        layer.getChunk(target.cx, target.cy, target.cz) :
        undefined;

      return chunk === undefined ? [] : [{ layer, chunk }];
    }

    const size = this.#world.chunkSize;
    const members: IterableLayerChunk[] = [];
    for (const candidate of layers) {
      if (!this.composites(candidate)) {
        continue;
      }

      const { x, y, z } = candidate.position;
      const chunk = candidate.getChunk(
        target.cx - (x / size),
        target.cy - (y / size),
        target.cz - (z / size)
      );
      if (chunk !== undefined) {
        members.push({ layer: candidate, chunk });
      }
    }

    return members;
  }
}
