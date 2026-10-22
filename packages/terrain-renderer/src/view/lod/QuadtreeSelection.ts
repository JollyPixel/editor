// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "../../terrain/ChunkCoord.ts";
import type { HeightRange } from "../../terrain/TerrainChunk.ts";
import type { TerrainReader } from "../../terrain/Terrain.ts";
import type { Point3 } from "../../math/point3.ts";
import {
  LodRanges,
  REGION_SIZE
} from "./LodRanges.ts";
import { skirtMasks } from "./skirtMasks.ts";

// CONSTANTS
const kInterpolatedFrom = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1]
] as const;

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

interface NodeRect {
  readonly x: number;
  readonly z: number;
  readonly size: number;
}

interface CachedBounds {
  readonly rect: NodeRect;
  readonly bounds: NodeBounds | null;
}

interface WalkFrame {
  readonly camera: Point3;
  readonly visible: (bounds: NodeBounds) => boolean;
  readonly selected: WalkedNode[];
  readonly bounds: Map<string, CachedBounds>;
}
type WalkResult = "handled" | "outOfRange";

export interface QuadtreeSelectOptions {
  visible?: (bounds: NodeBounds) => boolean;
}

export class QuadtreeSelection {
  readonly ranges: LodRanges;

  #terrain: TerrainReader;
  #bounds = new Map<string, CachedBounds>();
  #regions: { x: number; z: number; }[] | null = null;

  constructor(
    terrain: TerrainReader,
    ranges: LodRanges = new LodRanges()
  ) {
    this.#terrain = terrain;
    this.ranges = ranges;
  }

  invalidate(
    chunks?: Iterable<ChunkCoord>
  ): void {
    this.#regions = null;
    if (chunks === undefined) {
      this.#bounds.clear();

      return;
    }

    const reach: NodeRect[] = [];
    for (const { originSample: { x, z } } of chunks) {
      reach.push({ x: x - CHUNK_SAMPLES, z: z - CHUNK_SAMPLES, size: CHUNK_SAMPLES * 2 });
    }
    for (const [key, { rect }] of this.#bounds) {
      if (reach.some((other) => overlaps(rect, other))) {
        this.#bounds.delete(key);
      }
    }
  }

  select(
    camera: Point3,
    options: QuadtreeSelectOptions = {}
  ): SelectedNode[] {
    const selected: WalkedNode[] = [];
    const walk = new SelectionWalk(this.#terrain, this.ranges, {
      camera,
      visible: options.visible ?? (() => true),
      selected,
      bounds: this.#bounds
    });
    this.#regions ??= this.#knownRegions();
    for (const region of this.#regions) {
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

  #knownRegions(): { x: number; z: number; }[] {
    const regions = new Map<string, { x: number; z: number; }>();
    const chunksPerRegion = REGION_SIZE / CHUNK_SAMPLES;
    for (const coord of this.#terrain.overview.coords()) {
      const x = Math.floor(coord.x / chunksPerRegion);
      const z = Math.floor(coord.z / chunksPerRegion);
      regions.set(`${x},${z}`, { x, z });
    }

    return [...regions.values()];
  }
}

class SelectionWalk {
  #terrain: TerrainReader;
  #ranges: LodRanges;
  #camera: Point3;
  #visible: (bounds: NodeBounds) => boolean;
  #selected: WalkedNode[];
  #bounds: Map<string, CachedBounds>;

  constructor(
    terrain: TerrainReader,
    ranges: LodRanges,
    frame: WalkFrame
  ) {
    this.#terrain = terrain;
    this.#ranges = ranges;
    this.#camera = frame.camera;
    this.#visible = frame.visible;
    this.#selected = frame.selected;
    this.#bounds = frame.bounds;
  }

  node(
    x: number,
    z: number,
    level: number
  ): WalkResult {
    const size = this.#ranges.nodeSize(level);
    const bounds = this.#nodeBounds(x, z, size);
    if (bounds === null) {
      return "handled";
    }
    if (!this.#within(bounds, this.#ranges.range(level))) {
      return "outOfRange";
    }
    if (!this.#visible(bounds)) {
      return "handled";
    }
    if (level === 0 || !this.#within(bounds, this.#ranges.range(level - 1))) {
      this.#selected.push({ level, x, z, size, bounds });

      return "handled";
    }

    const half = size / 2;
    for (const [childX, childZ] of [
      [x, z],
      [x + half, z],
      [x, z + half],
      [x + half, z + half]
    ]) {
      if (this.node(childX, childZ, level - 1) === "handled") {
        continue;
      }

      const quarter = this.#nodeBounds(childX, childZ, half);
      if (quarter !== null && this.#visible(quarter)) {
        this.#selected.push({
          level,
          x: childX,
          z: childZ,
          size: half,
          bounds: quarter
        });
      }
    }

    return "handled";
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
    let cached = this.#bounds.get(key);
    if (cached === undefined) {
      cached = {
        rect: { x, z, size },
        bounds: this.#computeBounds(x, z, size)
      };
      this.#bounds.set(key, cached);
    }

    return cached.bounds;
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
        const range = chunkHeightRange(this.#terrain, new ChunkCoord(chunkX, chunkZ));
        if (range !== null) {
          covered = true;
          minY = Math.min(minY, range.min);
          maxY = Math.max(maxY, range.max);
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

function chunkHeightRange(
  terrain: TerrainReader,
  coord: ChunkCoord
): HeightRange | null {
  const chunk = terrain.chunk(coord);
  if (chunk !== undefined) {
    return chunk.heightRange;
  }
  if (!terrain.knows(coord)) {
    return null;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const [dx, dz] of kInterpolatedFrom) {
    const range = terrain.overview.heightRange(new ChunkCoord(coord.x + dx, coord.z + dz));
    if (range !== undefined) {
      min = Math.min(min, range.min);
      max = Math.max(max, range.max);
    }
  }

  return { min, max };
}

function overlaps(
  left: NodeRect,
  right: NodeRect
): boolean {
  return left.x < right.x + right.size && right.x < left.x + left.size &&
    left.z < right.z + right.size && right.z < left.z + left.size;
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
