// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelRotationValue } from "./brushOrientation.ts";
import {
  planeThrough,
  type BrushAnchor,
  type BrushAxis,
  type BrushPattern,
  type BrushPlane
} from "./brushFootprint.ts";

export type StrokeMode = "place" | "replace" | "remove";

export interface VoxelPaint {
  blockId: number;
  rotation: VoxelRotationValue;
  flipY: boolean;
}

export interface BrushStrokeOptions {
  mode: StrokeMode;
  origin: VoxelCoord;
  axis?: BrushAxis;
  pattern?: BrushPattern;
  anchor?: BrushAnchor;
  layerName: string;
  /**
   * Undefined in remove mode.
   */
  paint?: VoxelPaint;
}

/**
 * Plane-locked stroke that follows the cursor and stamps each cell once.
 */
export class BrushStroke {
  readonly mode: StrokeMode;
  readonly origin: VoxelCoord;
  readonly plane: BrushPlane;
  readonly axis: BrushAxis;
  readonly pattern: BrushPattern;
  readonly anchor: BrushAnchor;
  readonly layerName: string;
  readonly paint: VoxelPaint | undefined;

  #stamped = new Set<string>();
  #last: VoxelCoord | null = null;
  #pivot: VoxelCoord | null = null;

  constructor(
    options: BrushStrokeOptions
  ) {
    this.mode = options.mode;
    this.origin = { ...options.origin };
    this.axis = options.axis ?? "xz";
    this.plane = planeThrough(this.axis, this.origin);
    this.pattern = options.pattern ?? "square";
    this.anchor = options.anchor ?? "bottom";
    this.layerName = options.layerName;
    this.paint = options.paint;
  }

  lock(
    cell: VoxelCoord
  ): VoxelCoord {
    return {
      ...cell,
      [this.plane.axis]: this.plane.value
    };
  }

  steer(
    cursor: VoxelCoord
  ): VoxelCoord {
    this.#pivot ??= { ...cursor };
    const { origin } = this;
    const pivot = this.#pivot;

    return this.lock({
      x: origin.x + cursor.x - pivot.x,
      y: origin.y + cursor.y - pivot.y,
      z: origin.z + cursor.z - pivot.z
    });
  }

  advance(
    center: VoxelCoord
  ): VoxelCoord[] {
    const target = this.lock(center);
    const previous = this.#last;

    if (previous === null) {
      this.#last = target;

      return [target];
    }

    const cells = lineBetween(previous, target);
    if (cells.length > 0) {
      this.#last = cells[cells.length - 1];
    }

    return cells;
  }

  trails(
    center: VoxelCoord
  ): boolean {
    return this.#last !== null && !sameCell(
      this.#last,
      this.lock(center)
    );
  }

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

function sameCell(
  left: VoxelCoord | null,
  right: VoxelCoord
): boolean {
  return left !== null &&
    left.x === right.x &&
    left.y === right.y &&
    left.z === right.z;
}

function lineBetween(
  from: VoxelCoord,
  to: VoxelCoord
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

  const cells: VoxelCoord[] = [];
  for (let step = 1; step <= steps; step++) {
    const ratio = step / steps;
    cells.push({
      x: from.x + Math.round(dx * ratio),
      y: from.y + Math.round(dy * ratio),
      z: from.z + Math.round(dz * ratio)
    });
  }

  return cells;
}
