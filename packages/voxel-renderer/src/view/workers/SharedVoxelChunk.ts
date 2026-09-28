// Import Internal Dependencies
import { VoxelStore } from "../../document/world/storage/VoxelStore.ts";
import type { PackedVoxel } from "../../document/world/storage/packedVoxel.ts";
import type { MeshableChunk } from "../meshing/types.ts";
import type { MeshWorkerChunk } from "./protocol.ts";

export class SharedVoxelChunk implements MeshableChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly size: number;
  readonly shift: number;
  readonly mask: number;
  readonly store: VoxelStore;

  constructor(
    chunk: MeshWorkerChunk,
    size: number
  ) {
    this.cx = chunk.cx;
    this.cy = chunk.cy;
    this.cz = chunk.cz;
    this.size = size;
    this.shift = Math.log2(size);
    this.mask = size - 1;
    this.store = VoxelStore.fromArrays(chunk.keys, chunk.values, chunk.count);
  }

  get voxelCount(): number {
    return this.store.size;
  }

  getPackedAt(
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel {
    const { shift } = this;

    return this.store.get(lx | (ly << shift) | (lz << (shift * 2)));
  }

  mayContain(): boolean {
    return true;
  }
}
