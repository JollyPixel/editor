// Import Third-party Dependencies
import type { VoxelView } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { generateTerrain } from "./terrain.ts";

export interface WorldBuildOptions {
  layer: string;
  seed: number;
  size: number;
}

export class WorldBuild {
  readonly seed: number;
  readonly treeCount: number;
  readonly generateMs: number;
  readonly meshed: Promise<void>;

  #meshMs = 0;

  constructor(
    voxels: VoxelView,
    options: WorldBuildOptions
  ) {
    const { layer, seed, size } = options;
    this.seed = seed;

    const generateStart = performance.now();
    const cells: number[] = [];
    this.treeCount = generateTerrain(
      (position, blockId) => {
        cells.push(position.x, position.y, position.z, blockId, 0);
      },
      { seed, size }
    );
    voxels.document.world.patchVoxels(layer, cells);
    this.generateMs = performance.now() - generateStart;

    const meshStart = performance.now();
    voxels.tick(0);
    this.meshed = voxels.whenIdle().then(() => {
      this.#meshMs = performance.now() - meshStart;
    });
  }

  get meshMs(): number {
    return this.#meshMs;
  }
}
