// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BRUSH_PATTERNS,
  type BrushPattern
} from "../BrushStore.ts";
import {
  CellFace,
  type CellFaceId,
  type CoordAxis
} from "./CellFace.ts";

// CONSTANTS
const kCoordAxes: readonly CoordAxis[] = ["x", "y", "z"];

export interface BrushShape {
  size: number;
  pattern: BrushPattern;
}

export interface BrushFootprintOptions extends BrushShape {
  position: VoxelCoord;
  face?: CellFace;
}

export interface BrushFootprintJSON extends BrushShape {
  position: VoxelCoord;
  face?: CellFaceId;
}

export interface BrushBounds {
  min: VoxelCoord;
  span: VoxelCoord;
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

    const pattern = BRUSH_PATTERNS.find(
      (known) => known === Reflect.get(value, "pattern")
    );
    const face = CellFace.parse(Reflect.get(value, "face"));

    return new BrushFootprint({
      position,
      size: Math.floor(size),
      pattern: pattern ?? "square",
      ...face === undefined ? {} : { face }
    });
  }

  readonly position: Readonly<VoxelCoord>;
  readonly size: number;
  readonly pattern: BrushPattern;
  readonly face: CellFace | undefined;

  constructor(
    options: BrushFootprintOptions
  ) {
    const { x, y, z } = options.position;

    this.position = Object.freeze({ x, y, z });
    this.size = options.size;
    this.pattern = options.pattern;
    this.face = options.face;

    Object.freeze(this);
  }

  get shapeKey(): string {
    return `${this.size}:${this.pattern}`;
  }

  get bounds(): BrushBounds {
    const { position, size } = this;
    const half = Math.floor(size / 2);

    return {
      min: {
        x: position.x - half,
        y: position.y,
        z: position.z - half
      },
      span: {
        x: size,
        y: 1,
        z: size
      }
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
    const cells: VoxelCoord[] = [];

    for (let dx = 0; dx < span.x; dx++) {
      for (let dz = 0; dz < span.z; dz++) {
        const cell = {
          x: min.x + dx,
          y: min.y,
          z: min.z + dz
        };
        if (circle && !this.#withinRadius(min, cell)) {
          continue;
        }

        cells.push(cell);
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
      this.pattern === other.pattern &&
      this.face === other.face &&
      this.position.x === other.position.x &&
      this.position.y === other.position.y &&
      this.position.z === other.position.z;
  }

  toJSON(): BrushFootprintJSON {
    return {
      position: { ...this.position },
      size: this.size,
      pattern: this.pattern,
      ...this.face === undefined ? {} : { face: this.face.id }
    };
  }

  #options(): BrushFootprintOptions {
    return {
      position: this.position,
      size: this.size,
      pattern: this.pattern,
      ...this.face === undefined ? {} : { face: this.face }
    };
  }

  #withinRadius(
    min: VoxelCoord,
    cell: VoxelCoord
  ): boolean {
    const radius = this.size / 2;
    const dx = cell.x + 0.5 - (min.x + radius);
    const dz = cell.z + 0.5 - (min.z + radius);

    return (dx * dx) + (dz * dz) <= radius * radius;
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
