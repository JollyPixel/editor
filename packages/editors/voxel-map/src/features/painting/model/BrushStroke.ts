// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelRotationValue } from "./brushOrientation.ts";

export type StrokeMode = "place" | "remove";

export interface VoxelPaint {
  blockId: number;
  rotation: VoxelRotationValue;
  flipY: boolean;
}

export interface BrushStrokeOptions {
  mode: StrokeMode;
  /**
   * Height every cell of the stroke sits at, in cells.
   */
  height: number;
  layerName: string;
  /**
   * Absent while removing.
   */
  paint?: VoxelPaint;
}

/**
 * One press-to-release painting gesture.
 *
 * A stroke stays at the height it started at, matching the footprint of the
 * brush: painting never climbs onto the voxels it just laid down, never digs
 * under them, and stamps every cell at most once.
 */
export class BrushStroke {
  readonly mode: StrokeMode;
  readonly height: number;
  readonly layerName: string;
  readonly paint: VoxelPaint | undefined;

  #stamped = new Set<string>();
  #last: VoxelCoord | null = null;

  constructor(
    options: BrushStrokeOptions
  ) {
    this.mode = options.mode;
    this.height = options.height;
    this.layerName = options.layerName;
    this.paint = options.paint;
  }

  lock(
    cell: VoxelCoord
  ): VoxelCoord {
    return {
      x: cell.x,
      y: this.height,
      z: cell.z
    };
  }

  /**
   * Brush centers to stamp on the way to `center`, at most `limit` of them so
   * a fast pointer cannot dump a whole line at once. The stroke walks the
   * cells in between rather than skipping them, and resumes from where it
   * stopped on the next call.
   */
  advance(
    center: VoxelCoord,
    limit = Number.POSITIVE_INFINITY
  ): VoxelCoord[] {
    const target = this.lock(center);
    const previous = this.#last;

    if (previous === null) {
      this.#last = target;

      return [target];
    }

    const cells = lineBetween(previous, target, limit);
    if (cells.length > 0) {
      this.#last = cells[cells.length - 1];
    }

    return cells;
  }

  /**
   * Whether the stroke still has ground to cover before it reaches `center`.
   */
  trails(
    center: VoxelCoord
  ): boolean {
    const target = this.lock(center);

    return this.#last !== null && (
      this.#last.x !== target.x ||
      this.#last.y !== target.y ||
      this.#last.z !== target.z
    );
  }

  /**
   * Keeps the cells this stroke has not stamped yet, and records them.
   */
  claim(
    cells: Iterable<VoxelCoord>
  ): VoxelCoord[] {
    const result: VoxelCoord[] = [];

    for (const cell of cells) {
      const key = `${cell.x},${cell.y},${cell.z}`;
      if (this.#stamped.has(key)) {
        continue;
      }

      this.#stamped.add(key);
      result.push(cell);
    }

    return result;
  }
}

/**
 * Cells joining `from` to `to`, `from` excluded and `to` included.
 */
function lineBetween(
  from: VoxelCoord,
  to: VoxelCoord,
  limit: number
): VoxelCoord[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const steps = Math.max(
    Math.abs(dx),
    Math.abs(dy),
    Math.abs(dz)
  );
  if (steps === 0) {
    return [];
  }

  const walked = Math.min(steps, Math.max(1, Math.floor(limit)));
  const cells: VoxelCoord[] = [];
  for (let step = 1; step <= walked; step++) {
    const ratio = step / steps;
    cells.push({
      x: from.x + Math.round(dx * ratio),
      y: from.y + Math.round(dy * ratio),
      z: from.z + Math.round(dz * ratio)
    });
  }

  return cells;
}
