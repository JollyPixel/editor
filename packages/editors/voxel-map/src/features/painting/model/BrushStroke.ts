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
import { BrushFootprint } from "./BrushFootprint.ts";
import type { BrushPattern } from "../BrushStore.ts";

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
  pattern?: BrushPattern;
  layerName: string;
  paint?: VoxelPaint;
  aimedPart?: VoxelPart | null;
}

export interface StrokeAim {
  place: VoxelCoord;
  remove: VoxelCoord;
}

export interface StrokeTarget {
  center: VoxelCoord;
  paints: boolean;
  joins: boolean;
}

export class BrushStroke {
  readonly mode: StrokeMode;
  readonly origin: VoxelCoord;
  readonly pattern: BrushPattern;
  readonly layerName: string;
  readonly paint: VoxelPaint | undefined;
  readonly aimedPart: VoxelPart | null;

  #stamped = new Set<string>();
  #latest = new Set<string>();
  #last: VoxelCoord | null = null;

  constructor(
    options: BrushStrokeOptions
  ) {
    this.mode = options.mode;
    this.origin = { ...options.origin };
    this.pattern = options.pattern ?? "square";
    this.layerName = options.layerName;
    this.paint = options.paint;
    this.aimedPart = options.aimedPart ?? null;
  }

  get height(): number {
    return this.#last?.y ?? this.origin.y;
  }

  footprintAt(
    position: VoxelCoord,
    size: number
  ): BrushFootprint {
    return new BrushFootprint({
      position,
      size,
      pattern: this.pattern
    });
  }

  claims(
    cell: VoxelCoord
  ): boolean {
    return this.#stamped.has(coordinateKey(cell));
  }

  revisit(
    cell: VoxelCoord,
    entry: VoxelCoord | null = null
  ): StrokeTarget {
    const extension = this.#extensionFrom(cell, entry);
    if (extension !== null) {
      return {
        center: extension,
        paints: true,
        joins: false
      };
    }

    return {
      center: { ...cell },
      paints: this.mode !== "place",
      joins: true
    };
  }

  follow(
    aim: StrokeAim
  ): StrokeTarget {
    if (this.claims(aim.remove)) {
      return this.revisit(aim.remove);
    }

    return {
      center: { ...this.mode === "place" ? aim.place : aim.remove },
      paints: true,
      joins: true
    };
  }

  advance(
    center: VoxelCoord,
    joins = true
  ): VoxelCoord[] {
    const previous = this.#last;
    this.#last = { ...center };

    if (!joins || previous === null) {
      return [{ ...center }];
    }
    if (sameCell(previous, center)) {
      return [];
    }

    const floor = Math.min(previous.y, center.y);
    const cells = lineBetween(
      { ...previous, y: floor },
      { ...center, y: floor }
    );

    return [...cells.slice(0, -1), { ...center }];
  }

  claim(
    cells: Iterable<VoxelCoord>
  ): VoxelCoord[] {
    const result: VoxelCoord[] = [];

    this.#latest.clear();
    for (const cell of cells) {
      const key = coordinateKey(cell);
      this.#latest.add(key);
      if (this.#stamped.has(key)) {
        continue;
      }

      this.#stamped.add(key);
      result.push(cell);
    }

    return result;
  }

  #extensionFrom(
    cell: VoxelCoord,
    entry: VoxelCoord | null
  ): VoxelCoord | null {
    if (
      this.mode !== "place" ||
      entry === null ||
      this.#latest.has(coordinateKey(cell))
    ) {
      return null;
    }

    const neighbour = {
      x: cell.x + entry.x,
      y: cell.y + entry.y,
      z: cell.z + entry.z
    };

    return this.claims(neighbour) ? null : neighbour;
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
