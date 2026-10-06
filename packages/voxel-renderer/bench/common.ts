// Import Node.js Dependencies
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { Worker } from "node:worker_threads";

// Import Internal Dependencies
import { VoxelDocument } from "../src/document/VoxelDocument.ts";
import { VoxelView } from "../src/view/VoxelView.ts";
import type { MeshWorkerOptions } from "../src/view/workers/ChunkMeshWorkers.ts";
import type { BlockDefinition } from "../src/document/blocks/BlockDefinition.ts";
import { TerrainBlock } from "../examples/scripts/noise-world/blocks.ts";
import {
  generateTerrain,
  type TerrainOptions,
  type TerrainStats
} from "../examples/scripts/noise-world/terrain.ts";

// CONSTANTS
export const TERRAIN_LAYER = "Terrain";
export const WATER_LAYER = "Water";
export const TILE_SIZE = 8;
export const COLS = 4;
const kFrameMs = 1000 / 60;

/**
 * Creates a `VoxelView` pre-wired for terrain generation benchmarks.
 */
export function createBenchView(
  chunkSize: number,
  workers?: MeshWorkerOptions
): VoxelView {
  const document = new VoxelDocument({
    chunkSize,
    layers: [
      TERRAIN_LAYER,
      WATER_LAYER
    ],
    blocks: terrainBlocks()
  });
  const view = new VoxelView(document, {
    rendering: {
      alphaTest: 0.5
    },
    meshing: {
      workers
    }
  });
  view.loadBlockset(
    {
      id: "terrain",
      src: "memory://terrain",
      tileSize: TILE_SIZE,
      cols: COLS,
      rows: Math.ceil(Object.keys(TerrainBlock).length / COLS)
    },
    mockTexture()
  );

  return view;
}

/**
 * Populates terrain and routes water voxels to `WATER_LAYER`.
 */
export function populateTerrain(
  view: VoxelView,
  options: TerrainOptions
): TerrainStats {
  const terrain: number[] = [];
  const water: number[] = [];
  const stats = generateTerrain(
    (position, blockId) => {
      (blockId === TerrainBlock.Water ? water : terrain)
        .push(position.x, position.y, position.z, blockId, 0);
    },
    options
  );
  view.document.world.patchVoxels(TERRAIN_LAYER, terrain);
  view.document.world.patchVoxels(WATER_LAYER, water);

  return stats;
}

function terrainBlocks(): BlockDefinition[] {
  return Object.values(TerrainBlock).map((id, index) => {
    return {
      id,
      name: `Block ${id}`,
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        blocksetId: "terrain",
        col: index % COLS,
        row: Math.floor(index / COLS)
      }
    };
  });
}

function mockTexture(): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: {
      width: COLS * TILE_SIZE,
      height: 2 * TILE_SIZE
    },
    dispose() {
      // Benchmark texture stub: nothing to release.
    }
  };
}

export function nodeMeshWorkers(
  count: number
): MeshWorkerOptions {
  return {
    count,
    createWorker() {
      const worker = new Worker(new URL("./meshWorker.ts", import.meta.url));

      return {
        postMessage(message) {
          worker.postMessage(message);
        },
        addEventListener(
          type: "message" | "error",
          listener: (event: MessageEvent) => void
        ) {
          worker.on(type, (data: unknown) => listener(new MessageEvent(type, { data })));
        },
        terminate() {
          void worker.terminate();
        }
      };
    }
  };
}

export function flushed(
  view: VoxelView
): number {
  const start = performance.now();
  view.flush();

  return performance.now() - start;
}

export async function settle(
  view: VoxelView,
  frameMs = kFrameMs
): Promise<number> {
  const idle = performance.eventLoopUtilization();
  do {
    const start = performance.now();
    view.tick(0);
    await setTimeout(Math.max(0, frameMs - (performance.now() - start)));
  } while (view.pendingRebuilds > 0);

  return performance.eventLoopUtilization(idle).active;
}
