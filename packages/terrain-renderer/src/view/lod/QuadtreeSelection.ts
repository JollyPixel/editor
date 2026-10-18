// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "../../document/ChunkCoord.ts";
import type { TerrainReader } from "../../document/TerrainDocument.ts";
import {
  LodRanges,
  REGION_SIZE
} from "./LodRanges.ts";
import { skirtMasks } from "./skirtMasks.ts";

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface NodeBounds {
  readonly min: Point3;
  readonly max: Point3;
}

export interface SelectedNode {
  readonly level: number;
  /**
   * World X and Z of the node's corner, in metres.
   */
  readonly x: number;
  readonly z: number;
  /**
   * Side in metres: the level's node size, or half of it when the node draws
   * one quarter of a coarser node.
   */
  readonly size: number;
  readonly bounds: NodeBounds;
  /**
   * One bit per edge, in `SKIRT_EDGES` order, set where a node of another
   * level lies across the edge.
   */
  readonly skirts: number;
}

type WalkedNode = Omit<SelectedNode, "skirts">;

export interface QuadtreeSelectOptions {
  visible?: (bounds: NodeBounds) => boolean;
}

export class QuadtreeSelection {
  readonly ranges: LodRanges;

  #terrain: TerrainReader;

  constructor(
    terrain: TerrainReader,
    ranges: LodRanges = new LodRanges()
  ) {
    this.#terrain = terrain;
    this.ranges = ranges;
  }

  select(
    camera: Point3,
    options: QuadtreeSelectOptions = {}
  ): SelectedNode[] {
    const selected: WalkedNode[] = [];
    const walk = new SelectionWalk(
      this.#terrain,
      this.ranges,
      camera,
      options.visible ?? (() => true),
      selected
    );
    for (const region of this.#regions()) {
      walk.node(
        region.x * REGION_SIZE,
        region.z * REGION_SIZE,
        this.ranges.rootLevel
      );
    }
    const masks = skirtMasks(selected);

    return selected.map((node, index) => {
      return { ...node, skirts: masks[index] };
    });
  }

  #regions(): Iterable<{ x: number; z: number; }> {
    const regions = new Map<string, { x: number; z: number; }>();
    const chunksPerRegion = REGION_SIZE / CHUNK_SAMPLES;
    for (const { coord } of this.#terrain.chunks()) {
      const x = Math.floor(coord.x / chunksPerRegion);
      const z = Math.floor(coord.z / chunksPerRegion);
      regions.set(`${x},${z}`, { x, z });
    }

    return regions.values();
  }
}

class SelectionWalk {
  #terrain: TerrainReader;
  #ranges: LodRanges;
  #camera: Point3;
  #visible: (bounds: NodeBounds) => boolean;
  #selected: WalkedNode[];
  #bounds = new Map<string, NodeBounds | null>();

  constructor(
    terrain: TerrainReader,
    ranges: LodRanges,
    camera: Point3,
    visible: (bounds: NodeBounds) => boolean,
    selected: WalkedNode[]
  ) {
    this.#terrain = terrain;
    this.#ranges = ranges;
    this.#camera = camera;
    this.#visible = visible;
    this.#selected = selected;
  }

  node(
    x: number,
    z: number,
    level: number
  ): boolean {
    const size = this.#ranges.nodeSize(level);
    const bounds = this.#nodeBounds(x, z, size);
    if (bounds === null) {
      return true;
    }
    if (!this.#within(bounds, this.#ranges.range(level))) {
      return false;
    }
    if (!this.#visible(bounds)) {
      return true;
    }
    if (level === 0 || !this.#within(bounds, this.#ranges.range(level - 1))) {
      this.#selected.push({ level, x, z, size, bounds });

      return true;
    }

    const half = size / 2;
    for (const [childX, childZ] of [
      [x, z],
      [x + half, z],
      [x, z + half],
      [x + half, z + half]
    ]) {
      if (this.node(childX, childZ, level - 1)) {
        continue;
      }

      const quarter = this.#nodeBounds(childX, childZ, half);
      if (quarter !== null && this.#visible(quarter)) {
        this.#selected.push({ level, x: childX, z: childZ, size: half, bounds: quarter });
      }
    }

    return true;
  }

  #within(
    bounds: NodeBounds,
    range: number
  ): boolean {
    const dx = axisGap(this.#camera.x, bounds.min.x, bounds.max.x);
    const dy = axisGap(this.#camera.y, bounds.min.y, bounds.max.y);
    const dz = axisGap(this.#camera.z, bounds.min.z, bounds.max.z);

    return dx * dx + dy * dy + dz * dz <= range * range;
  }

  #nodeBounds(
    x: number,
    z: number,
    size: number
  ): NodeBounds | null {
    const key = `${x},${z},${size}`;
    let bounds = this.#bounds.get(key);
    if (bounds === undefined) {
      bounds = this.#computeBounds(x, z, size);
      this.#bounds.set(key, bounds);
    }

    return bounds;
  }

  #computeBounds(
    x: number,
    z: number,
    size: number
  ): NodeBounds | null {
    let minY = Infinity;
    let maxY = -Infinity;
    const first = ChunkCoord.containing(x, z);
    const last = ChunkCoord.containing(x + size - 1, z + size - 1);
    let covered = false;
    for (let chunkZ = first.z; chunkZ <= last.z; chunkZ++) {
      for (let chunkX = first.x; chunkX <= last.x; chunkX++) {
        const chunk = this.#terrain.chunk(new ChunkCoord(chunkX, chunkZ));
        if (chunk !== undefined) {
          covered = true;
          minY = Math.min(minY, chunk.heightRange.min);
          maxY = Math.max(maxY, chunk.heightRange.max);
        }
      }
    }
    if (!covered) {
      return null;
    }

    return {
      min: { x, y: minY, z },
      max: { x: x + size, y: maxY, z: z + size }
    };
  }
}

function axisGap(
  value: number,
  min: number,
  max: number
): number {
  if (value < min) {
    return min - value;
  }

  return value > max ? value - max : 0;
}
