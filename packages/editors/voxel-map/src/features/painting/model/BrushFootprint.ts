// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_AXES,
  BRUSH_PATTERNS,
  type BrushAxis,
  type BrushPattern
} from "../BrushStore.ts";
import {
  CellFace,
  type BrushAnchor,
  type CellFaceId,
  type CoordAxis
} from "./CellFace.ts";

// CONSTANTS
const kCoordAxes: readonly CoordAxis[] = ["x", "y", "z"];
const kAnchors: readonly BrushAnchor[] = ["bottom", "top", "center"];
const kRadiusTrim = 0.5;

export interface BrushShape {
  size: number;
  axis: BrushAxis;
  pattern: BrushPattern;
}

export interface BrushFootprintOptions extends BrushShape {
  position: VoxelCoord;
  anchor?: BrushAnchor;
  face?: CellFace;
}

export interface BrushFootprintJSON extends BrushShape {
  position: VoxelCoord;
  anchor: BrushAnchor;
  face?: CellFaceId;
}

export interface BrushBounds {
  min: VoxelCoord;
  span: VoxelCoord;
}

export interface BrushPlane {
  axis: CoordAxis;
  value: number;
}

export class BrushFootprint implements BrushShape {
  static parse(
    value: unknown
  ): BrushFootprint | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const position = Reflect.get(value, "position");
    const size = Reflect.get(value, "size");
    if (
      typeof size !== "number" ||
      !Number.isFinite(size) ||
      size < 1 ||
      !isVoxelCoord(position)
    ) {
      return null;
    }

    const axis = BRUSH_AXES.find((known) => known === Reflect.get(value, "axis"));
    const pattern = BRUSH_PATTERNS.find(
      (known) => known === Reflect.get(value, "pattern")
    );
    const anchor = kAnchors.find(
      (known) => known === Reflect.get(value, "anchor")
    );
    const face = CellFace.parse(Reflect.get(value, "face"));

    return new BrushFootprint({
      position,
      size: Math.floor(size),
      axis: axis ?? "xz",
      pattern: pattern ?? "square",
      ...anchor === undefined ? {} : { anchor },
      ...face === undefined ? {} : { face }
    });
  }

  static planeThrough(
    axis: BrushAxis,
    cell: VoxelCoord
  ): BrushPlane {
    const lock = planeNormalAxis(axis);

    return {
      axis: lock,
      value: cell[lock]
    };
  }

  readonly position: Readonly<VoxelCoord>;
  readonly size: number;
  readonly axis: BrushAxis;
  readonly pattern: BrushPattern;
  readonly anchor: BrushAnchor;
  readonly face: CellFace | undefined;

  constructor(
    options: BrushFootprintOptions
  ) {
    const { x, y, z } = options.position;

    this.position = Object.freeze({ x, y, z });
    this.size = options.size;
    this.axis = options.axis;
    this.pattern = options.pattern;
    this.anchor = options.anchor ?? "bottom";
    this.face = options.face;

    Object.freeze(this);
  }

  get isBall(): boolean {
    return this.axis === "xyz" && this.pattern === "circle";
  }

  get shapeKey(): string {
    return `${this.size}:${this.axis}:${this.pattern}`;
  }

  get bounds(): BrushBounds {
    const { position, size, axis, anchor } = this;
    const half = Math.floor(size / 2);
    const lift = {
      bottom: 0,
      top: size - 1,
      center: half
    }[anchor];
    const min = { ...position };
    const span = {
      x: 1,
      y: 1,
      z: 1
    };

    for (const coord of kCoordAxes) {
      if (!axis.includes(coord)) {
        continue;
      }

      span[coord] = size;
      min[coord] = position[coord] - (coord === "y" ? lift : half);
    }

    return {
      min,
      span
    };
  }

  get center(): VoxelCoord {
    const { min, span } = this.bounds;

    return {
      x: min.x + (span.x / 2),
      y: min.y + (span.y / 2),
      z: min.z + (span.z / 2)
    };
  }

  movedTo(
    position: VoxelCoord
  ): BrushFootprint {
    return new BrushFootprint({
      ...this.#options(),
      position
    });
  }

  cells(): VoxelCoord[] {
    const { min, span } = this.bounds;
    const circle = this.pattern === "circle";
    const reach = this.#reach();
    const cells: VoxelCoord[] = [];

    for (let dx = 0; dx < span.x; dx++) {
      for (let dy = 0; dy < span.y; dy++) {
        for (let dz = 0; dz < span.z; dz++) {
          const cell = {
            x: min.x + dx,
            y: min.y + dy,
            z: min.z + dz
          };
          if (circle && !this.#withinRadius(min, cell, reach)) {
            continue;
          }

          cells.push(cell);
        }
      }
    }

    return cells;
  }

  overlaps(
    other: BrushFootprint | null
  ): boolean {
    if (other === null) {
      return false;
    }

    const left = this.bounds;
    const right = other.bounds;

    return kCoordAxes.every((coord) => {
      const leftEnd = left.min[coord] + left.span[coord];
      const rightEnd = right.min[coord] + right.span[coord];

      return left.min[coord] < rightEnd && right.min[coord] < leftEnd;
    });
  }

  equals(
    other: BrushFootprint | null
  ): boolean {
    return other !== null &&
      this.size === other.size &&
      this.axis === other.axis &&
      this.pattern === other.pattern &&
      this.face === other.face &&
      this.anchor === other.anchor &&
      this.position.x === other.position.x &&
      this.position.y === other.position.y &&
      this.position.z === other.position.z;
  }

  toJSON(): BrushFootprintJSON {
    return {
      position: { ...this.position },
      size: this.size,
      axis: this.axis,
      pattern: this.pattern,
      anchor: this.anchor,
      ...this.face === undefined ? {} : { face: this.face.id }
    };
  }

  #options(): BrushFootprintOptions {
    return {
      position: this.position,
      size: this.size,
      axis: this.axis,
      pattern: this.pattern,
      anchor: this.anchor,
      ...this.face === undefined ? {} : { face: this.face }
    };
  }

  #withinRadius(
    min: VoxelCoord,
    cell: VoxelCoord,
    reach: number
  ): boolean {
    const radius = this.size / 2;
    let distance = 0;

    for (const coord of kCoordAxes) {
      if (!this.axis.includes(coord)) {
        continue;
      }

      const offset = cell[coord] + 0.5 - (min[coord] + radius);
      distance += offset * offset;
    }

    return distance <= reach;
  }

  #reach(): number {
    const radius = this.size / 2;
    if (this.axis !== "xyz") {
      return radius * radius;
    }

    const pole = radius - 0.5;
    const offCenter = this.size % 2 === 0 ? 0.5 : 0;

    return Math.max(
      (radius * radius) - (radius * kRadiusTrim),
      (pole * pole) + offCenter
    );
  }
}

function planeNormalAxis(
  axis: BrushAxis
): CoordAxis {
  switch (axis) {
    case "xy":
      return "z";
    case "yz":
      return "x";
    default:
      return "y";
  }
}

function isVoxelCoord(
  value: unknown
): value is VoxelCoord {
  return typeof value === "object" && value !== null &&
    typeof Reflect.get(value, "x") === "number" &&
    typeof Reflect.get(value, "y") === "number" &&
    typeof Reflect.get(value, "z") === "number";
}
