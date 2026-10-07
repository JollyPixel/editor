// Import Third-party Dependencies
import {
  VOXEL_ABSENT,
  VoxelTemplate,
  type PackedVoxel,
  type VoxelCoord,
  type VoxelLayer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { CellRegion } from "./CellRegion.ts";

// CONSTANTS
const kFaceNeighbours = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
] as const;

export interface ConnectedCellsTemplateOptions {
  id: string;
  name: string;
}

export class ConnectedCells implements Iterable<VoxelCoord> {
  static flood(
    layer: VoxelLayer,
    start: VoxelCoord
  ): ConnectedCells | null {
    const cell = {
      x: start.x,
      y: start.y,
      z: start.z
    };
    if (layer.getPackedVoxelAt(cell) === VOXEL_ABSENT) {
      return null;
    }

    const positions: number[] = [cell.x, cell.y, cell.z];
    const voxels: PackedVoxel[] = [];
    const partners: PackedVoxel[] = [];
    const visited = new Set<string>([`${cell.x},${cell.y},${cell.z}`]);
    for (let head = 0; head < positions.length; head += 3) {
      const x = positions[head];
      const y = positions[head + 1];
      const z = positions[head + 2];
      cell.x = x;
      cell.y = y;
      cell.z = z;
      voxels.push(layer.getPackedVoxelAt(cell));
      partners.push(layer.getPartnerVoxelAt(cell));

      for (const [dx, dy, dz] of kFaceNeighbours) {
        cell.x = x + dx;
        cell.y = y + dy;
        cell.z = z + dz;
        const key = `${cell.x},${cell.y},${cell.z}`;
        if (
          !visited.has(key) &&
          layer.getPackedVoxelAt(cell) !== VOXEL_ABSENT
        ) {
          visited.add(key);
          positions.push(cell.x, cell.y, cell.z);
        }
      }
    }

    return new ConnectedCells(positions, voxels, partners);
  }

  readonly bounds: CellRegion;

  #positions: Int32Array;
  #voxels: Uint32Array;
  #partners: Int32Array;

  constructor(
    positions: ArrayLike<number>,
    voxels: ArrayLike<PackedVoxel>,
    partners: ArrayLike<PackedVoxel>
  ) {
    if (
      voxels.length === 0 ||
      positions.length !== voxels.length * 3 ||
      partners.length !== voxels.length
    ) {
      throw new RangeError(
        `ConnectedCells: ${positions.length} coordinates, ` +
        `${voxels.length} voxels and ${partners.length} partners.`
      );
    }

    this.#positions = Int32Array.from(positions);
    this.#voxels = Uint32Array.from(voxels);
    this.#partners = Int32Array.from(partners);

    const min = {
      x: Infinity,
      y: Infinity,
      z: Infinity
    };
    const max = {
      x: -Infinity,
      y: -Infinity,
      z: -Infinity
    };
    for (const { x, y, z } of this) {
      min.x = Math.min(min.x, x);
      min.y = Math.min(min.y, y);
      min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x);
      max.y = Math.max(max.y, y);
      max.z = Math.max(max.z, z);
    }
    this.bounds = CellRegion.spanning(min, max);

    Object.freeze(this);
  }

  get size(): number {
    return this.#voxels.length;
  }

  * [Symbol.iterator](): IterableIterator<VoxelCoord> {
    const positions = this.#positions;
    for (let i = 0; i < positions.length; i += 3) {
      yield {
        x: positions[i],
        y: positions[i + 1],
        z: positions[i + 2]
      };
    }
  }

  toTemplate(
    options: ConnectedCellsTemplateOptions
  ): VoxelTemplate {
    return new VoxelTemplate({
      id: options.id,
      name: options.name,
      pivot: this.bounds.min,
      positions: this.#positions,
      voxels: this.#voxels,
      partners: this.#partners
    });
  }
}
