// Import Third-party Dependencies
import {
  VOXEL_ABSENT,
  VoxelTemplate,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  isCellCoord,
  sameCellCoord
} from "../CellRegion.ts";

export interface PresenceSnapshotJSON {
  pivot: VoxelCoord;
  positions: number[];
  voxels: number[];
  partners: number[];
}

export class PresenceSnapshot {
  static capture(
    template: VoxelTemplate
  ): PresenceSnapshot {
    const positions: number[] = [];
    const voxels: number[] = [];
    const partners: number[] = [];
    for (const [x, y, z, packed, partner] of template.localVoxels()) {
      positions.push(x, y, z);
      voxels.push(packed);
      partners.push(partner);
    }

    return new PresenceSnapshot({
      pivot: { ...template.pivot },
      positions,
      voxels,
      partners
    });
  }

  static parse(
    value: object
  ): PresenceSnapshot | null {
    const pivot = Reflect.get(value, "pivot");
    const positions = Reflect.get(value, "positions");
    const voxels = Reflect.get(value, "voxels");
    const partners = Reflect.get(value, "partners");
    if (
      !isCellCoord(pivot) ||
      !isIntegers(voxels, 0) ||
      voxels.length === 0 ||
      !isIntegers(positions, 0) ||
      positions.length !== voxels.length * 3 ||
      !isIntegers(partners, VOXEL_ABSENT) ||
      partners.length !== voxels.length
    ) {
      return null;
    }

    return new PresenceSnapshot({
      pivot,
      positions,
      voxels,
      partners
    });
  }

  readonly pivot: Readonly<VoxelCoord>;
  readonly positions: readonly number[];
  readonly voxels: readonly number[];
  readonly partners: readonly number[];

  constructor(
    json: PresenceSnapshotJSON
  ) {
    this.pivot = Object.freeze({ ...json.pivot });
    this.positions = Object.freeze([...json.positions]);
    this.voxels = Object.freeze([...json.voxels]);
    this.partners = Object.freeze([...json.partners]);

    Object.freeze(this);
  }

  toTemplate(
    id: string,
    name: string
  ): VoxelTemplate {
    return new VoxelTemplate({
      id,
      name,
      pivot: this.pivot,
      positions: this.positions,
      voxels: this.voxels,
      partners: this.partners
    });
  }

  equals(
    other: PresenceSnapshot
  ): boolean {
    return sameCellCoord(this.pivot, other.pivot) &&
      sameNumbers(this.voxels, other.voxels) &&
      sameNumbers(this.partners, other.partners) &&
      sameNumbers(this.positions, other.positions);
  }

  toJSON(): PresenceSnapshotJSON {
    return {
      pivot: { ...this.pivot },
      positions: [...this.positions],
      voxels: [...this.voxels],
      partners: [...this.partners]
    };
  }
}

function isIntegers(
  value: unknown,
  min: number
): value is number[] {
  return Array.isArray(value) &&
    value.every((item) => Number.isInteger(item) && item >= min);
}

function sameNumbers(
  left: readonly number[],
  right: readonly number[]
): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}
