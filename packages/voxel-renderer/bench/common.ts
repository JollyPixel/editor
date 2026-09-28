// Import Node.js Dependencies
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { Worker } from "node:worker_threads";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type { MeshWorkerOptions } from "../src/render/ChunkMeshWorkers.ts";
import type { BlockDefinition } from "../src/blocks/BlockDefinition.ts";
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
 * Creates a `VoxelEngine` pre-wired for terrain generation benchmarks.
 */
export function createBenchEngine(
  chunkSize: number,
  workers?: MeshWorkerOptions
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize,
    layers: [
      TERRAIN_LAYER,
      WATER_LAYER
    ],
    blocks: terrainBlocks(),
    rendering: {
      alphaTest: 0.5
    },
    meshing: {
      workers
    }
  });
  engine.loadTileset(
    {
      id: "terrain",
      src: "memory://terrain",
      tileSize: TILE_SIZE,
      cols: COLS,
      rows: Math.ceil(Object.keys(TerrainBlock).length / COLS)
    },
    mockTexture()
  );

  return engine;
}

/**
 * Populates terrain and routes water voxels to `WATER_LAYER`.
 */
export function populateTerrain(
  engine: VoxelEngine,
  options: TerrainOptions
): TerrainStats {
  return generateTerrain(
    (position, blockId) => engine.world.setVoxel(
      blockId === TerrainBlock.Water ? WATER_LAYER : TERRAIN_LAYER,
      {
        position,
        blockId
      }
    ),
    options
  );
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
        tilesetId: "terrain",
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
  engine: VoxelEngine
): number {
  const start = performance.now();
  engine.flush();

  return performance.now() - start;
}

export async function settle(
  engine: VoxelEngine,
  frameMs = kFrameMs
): Promise<number> {
  const idle = performance.eventLoopUtilization();
  do {
    const start = performance.now();
    engine.tick(0);
    await setTimeout(Math.max(0, frameMs - (performance.now() - start)));
  } while (engine.pendingRebuilds > 0);

  return performance.eventLoopUtilization(idle).active;
}
