// Import Internal Dependencies
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import type { VoxelCoord } from "../../document/world/types.ts";
import type { MeshableLayerVisibility } from "../meshing/types.ts";
import type {
  LightChunkKey,
  LightGrid
} from "./LightGrid.ts";

export interface LightChangesOptions {
  world: VoxelWorld;
  visibility: MeshableLayerVisibility;
  grid: LightGrid;
}

interface LayerSnapshot {
  revision: number;
  visible: boolean;
  position: Readonly<VoxelCoord>;
  chunks: Map<VoxelChunk, number>;
}

export class LightChanges {
  #world: VoxelWorld;
  #visibility: MeshableLayerVisibility;
  #grid: LightGrid;
  #layers = new Map<VoxelLayer, LayerSnapshot>();
  #collected = new Set<LightChunkKey>();

  constructor(
    options: LightChangesOptions
  ) {
    this.#world = options.world;
    this.#visibility = options.visibility;
    this.#grid = options.grid;
  }

  collect(): ReadonlySet<LightChunkKey> {
    this.#collected.clear();
    this.#sync(this.#collected);

    return this.#collected;
  }

  settle(): void {
    this.#layers.clear();
    this.#sync(null);
  }

  #sync(
    changed: Set<LightChunkKey> | null
  ): void {
    const layers = this.#world.getLayers();
    for (const layer of layers) {
      this.#syncLayer(layer, changed);
    }

    if (this.#layers.size > layers.length) {
      const current = new Set(layers);
      for (const [layer, snapshot] of this.#layers) {
        if (!current.has(layer)) {
          this.#coverAll(snapshot, changed);
          this.#layers.delete(layer);
        }
      }
    }
  }

  #syncLayer(
    layer: VoxelLayer,
    changed: Set<LightChunkKey> | null
  ): void {
    const visible = this.#visibility.isVisible(layer);
    let snapshot = this.#layers.get(layer);
    if (
      snapshot === undefined ||
      snapshot.visible !== visible ||
      !samePosition(snapshot.position, layer.position)
    ) {
      if (snapshot !== undefined) {
        this.#coverAll(snapshot, changed);
      }
      snapshot = {
        revision: -1,
        visible,
        position: { ...layer.position },
        chunks: new Map()
      };
      this.#layers.set(layer, snapshot);
    }
    if (!visible || snapshot.revision === layer.revision) {
      return;
    }

    snapshot.revision = layer.revision;
    for (const chunk of layer.getChunks()) {
      if (snapshot.chunks.get(chunk) !== chunk.revision) {
        snapshot.chunks.set(chunk, chunk.revision);
        this.#cover(snapshot, chunk, changed);
      }
    }

    if (snapshot.chunks.size > layer.chunkCount) {
      for (const chunk of snapshot.chunks.keys()) {
        if (layer.getChunk(chunk.cx, chunk.cy, chunk.cz) !== chunk) {
          snapshot.chunks.delete(chunk);
          this.#cover(snapshot, chunk, changed);
        }
      }
    }
  }

  #coverAll(
    snapshot: LayerSnapshot,
    changed: Set<LightChunkKey> | null
  ): void {
    for (const chunk of snapshot.chunks.keys()) {
      this.#cover(snapshot, chunk, changed);
    }
  }

  #cover(
    snapshot: LayerSnapshot,
    chunk: VoxelChunk,
    changed: Set<LightChunkKey> | null
  ): void {
    if (changed === null) {
      return;
    }

    for (const key of this.#grid.keysUnder(chunk, snapshot.position)) {
      changed.add(key);
    }
  }
}

function samePosition(
  a: Readonly<VoxelCoord>,
  b: Readonly<VoxelCoord>
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
