// Import Internal Dependencies
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";
import type {
  IterableLayerChunk,
  VoxelWorld
} from "../../document/world/VoxelWorld.ts";
import type { VoxelCoord } from "../../document/world/types.ts";
import {
  AUTHORED_LAYER_VISIBILITY,
  type MeshableLayerVisibility
} from "../meshing/types.ts";

interface ChunkMeshTargetBase {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly origin: Readonly<VoxelCoord>;
}

export interface CellMeshTarget extends ChunkMeshTargetBase {
  readonly kind: "cell";
}

export interface LayerMeshTarget extends ChunkMeshTargetBase {
  readonly kind: "layer";
  readonly layer: VoxelLayer;
}

export type ChunkMeshTarget =
  | CellMeshTarget
  | LayerMeshTarget;

export class ChunkMeshLayout {
  #world: VoxelWorld;
  #visibility: MeshableLayerVisibility;

  constructor(
    world: VoxelWorld,
    visibility: MeshableLayerVisibility = AUTHORED_LAYER_VISIBILITY
  ) {
    this.#world = world;
    this.#visibility = visibility;
  }

  composites(
    layer: VoxelLayer
  ): boolean {
    const size = this.#world.chunkSize;
    const { x, y, z } = layer.position;

    return this.#visibility.isVisible(layer) &&
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
    if (!this.#visibility.isVisible(layer)) {
      return null;
    }

    const origin = this.originOf(layer, chunk);
    if (!this.composites(layer)) {
      return {
        kind: "layer",
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
      kind: "cell",
      key: `cell:${cx},${cy},${cz}`,
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

    if (target.kind === "layer") {
      const { layer } = target;
      const chunk = layers.includes(layer) &&
        this.#visibility.isVisible(layer) &&
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
