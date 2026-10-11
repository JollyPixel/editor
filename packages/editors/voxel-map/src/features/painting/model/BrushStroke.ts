// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelEntry,
  type VoxelPart,
  type VoxelRotationStep,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { AimedHalf } from "./AimedHalf.ts";
import {
  BrushFootprint,
  type BrushPlane
} from "./BrushFootprint.ts";
import type { BrushAnchor } from "./CellFace.ts";
import type { BrushAxis, BrushPattern } from "../BrushStore.ts";

export type StrokeMode = "place" | "replace" | "remove";

export interface VoxelPaint {
  blockId: number;
  rotation: VoxelRotationStep;
  flipY: boolean;
}

export function canMergePaint(
  view: VoxelView,
  layerName: string,
  position: VoxelCoord,
  paint: VoxelPaint
): boolean {
  return view.canMergeVoxelPart(layerName, position, {
    blockId: paint.blockId,
    transform: new VoxelTransform(paint).packed
  });
}

export interface BrushStrokeOptions {
  mode: StrokeMode;
  origin: VoxelCoord;
  aimed?: VoxelCoord;
  axis?: BrushAxis;
  pattern?: BrushPattern;
  anchor?: BrushAnchor;
  layerName: string;
  paint?: VoxelPaint;
  aimedPart?: VoxelPart | null;
}

export interface StrokeTarget {
  center: VoxelCoord;
  paints: boolean;
}

export class BrushStroke {
  readonly mode: StrokeMode;
  readonly origin: VoxelCoord;
  readonly plane: BrushPlane;
  readonly axis: BrushAxis;
  readonly pattern: BrushPattern;
  readonly anchor: BrushAnchor;
  readonly layerName: string;
  readonly paint: VoxelPaint | undefined;
  readonly aimedPart: VoxelPart | null;

  #stamped = new Set<string>();
  #last: VoxelCoord | null = null;
  #reach: VoxelCoord;

  constructor(
    options: BrushStrokeOptions
  ) {
    this.mode = options.mode;
    this.origin = { ...options.origin };
    this.axis = options.axis ?? "xz";
    this.plane = BrushFootprint.planeThrough(this.axis, this.origin);
    this.pattern = options.pattern ?? "square";
    this.anchor = options.anchor ?? "bottom";
    this.layerName = options.layerName;
    this.paint = options.paint;
    this.aimedPart = options.aimedPart ?? null;

    const aimed = options.aimed ?? this.origin;
    this.#reach = {
      x: this.origin.x - aimed.x,
      y: this.origin.y - aimed.y,
      z: this.origin.z - aimed.z
    };
  }

  footprintAt(
    position: VoxelCoord,
    size: number
  ): BrushFootprint {
    return new BrushFootprint({
      position,
      size,
      axis: this.axis,
      pattern: this.pattern,
      anchor: this.anchor
    });
  }

  lock(
    cell: VoxelCoord
  ): VoxelCoord {
    return {
      ...cell,
      [this.plane.axis]: this.plane.value
    };
  }

  claims(
    cell: VoxelCoord
  ): boolean {
    return this.#stamped.has(coordinateKey(cell));
  }

  revisit(
    cell: VoxelCoord
  ): StrokeTarget {
    return {
      center: this.lock(cell),
      paints: this.mode !== "place"
    };
  }

  follow(
    block: VoxelCoord
  ): StrokeTarget {
    if (this.claims(block)) {
      return this.revisit(block);
    }

    const reach = this.#reach;

    return {
      center: this.lock({
        x: block.x + reach.x,
        y: block.y + reach.y,
        z: block.z + reach.z
      }),
      paints: true
    };
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
      const key = coordinateKey(cell);
      if (this.#stamped.has(key)) {
        continue;
      }

      this.#stamped.add(key);
      result.push(cell);
    }

    return result;
  }

  aimedHalfAt(
    position: VoxelCoord,
    entry: VoxelEntry
  ): AimedHalf | null {
    const aimed = this.aimedPart;

    return aimed === null || !sameCell(this.origin, position) ?
      null :
      AimedHalf.select(entry, aimed);
  }
}

function coordinateKey(
  cell: VoxelCoord
): string {
  return `${cell.x},${cell.y},${cell.z}`;
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
