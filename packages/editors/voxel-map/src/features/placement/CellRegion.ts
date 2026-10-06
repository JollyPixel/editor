// Import Third-party Dependencies
import type * as THREE from "three";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

export interface CellRegionJSON {
  min: VoxelCoord;
  max: VoxelCoord;
}

export class CellRegion {
  static spanning(
    from: VoxelCoord,
    to: VoxelCoord
  ): CellRegion {
    return new CellRegion(
      {
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        z: Math.min(from.z, to.z)
      },
      {
        x: Math.max(from.x, to.x) + 1,
        y: Math.max(from.y, to.y) + 1,
        z: Math.max(from.z, to.z) + 1
      }
    );
  }

  static fromBox(
    box: THREE.Box3
  ): CellRegion {
    return new CellRegion(box.min, box.max);
  }

  static parse(
    value: unknown
  ): CellRegion | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const min = Reflect.get(value, "min");
    const max = Reflect.get(value, "max");
    if (
      !isCellCoord(min) ||
      !isCellCoord(max) ||
      max.x <= min.x ||
      max.y <= min.y ||
      max.z <= min.z
    ) {
      return null;
    }

    return new CellRegion(min, max);
  }

  readonly min: Readonly<VoxelCoord>;
  readonly max: Readonly<VoxelCoord>;

  constructor(
    min: VoxelCoord,
    max: VoxelCoord
  ) {
    this.min = Object.freeze({
      x: Math.floor(min.x),
      y: Math.floor(min.y),
      z: Math.floor(min.z)
    });
    this.max = Object.freeze({
      x: Math.max(this.min.x + 1, Math.ceil(max.x)),
      y: Math.max(this.min.y + 1, Math.ceil(max.y)),
      z: Math.max(this.min.z + 1, Math.ceil(max.z))
    });

    Object.freeze(this);
  }

  get size(): VoxelCoord {
    return {
      x: this.max.x - this.min.x,
      y: this.max.y - this.min.y,
      z: this.max.z - this.min.z
    };
  }

  equals(
    other: CellRegionJSON | null
  ): boolean {
    return other !== null &&
      sameCellCoord(other.min, this.min) &&
      sameCellCoord(other.max, this.max);
  }

  toJSON(): CellRegionJSON {
    return {
      min: { ...this.min },
      max: { ...this.max }
    };
  }
}

export function isCellCoord(
  value: unknown
): value is VoxelCoord {
  return typeof value === "object" && value !== null &&
    Number.isInteger(Reflect.get(value, "x")) &&
    Number.isInteger(Reflect.get(value, "y")) &&
    Number.isInteger(Reflect.get(value, "z"));
}

export function sameCellCoord(
  left: VoxelCoord,
  right: VoxelCoord
): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}
