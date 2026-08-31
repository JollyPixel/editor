// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type { BlockDefinition } from "../src/blocks/BlockDefinition.ts";
import {
  TerrainBlock,
  generateTerrain,
  type TerrainOptions,
  type TerrainStats
} from "../examples/scripts/utils/terrain.ts";

// CONSTANTS
export const TERRAIN_LAYER = "Terrain";
export const WATER_LAYER = "Water";
export const TILE_SIZE = 8;
export const COLS = 4;

/**
 * Creates a `VoxelEngine` pre-wired for terrain generation benchmarks.
 */
export function createBenchEngine(
  chunkSize: number,
  greedy = false
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize,
    layers: [
      TERRAIN_LAYER,
      WATER_LAYER
    ],
    blocks: terrainBlocks(),
    alphaTest: 0.5,
    greedy
  });
  engine.tilesetManager.registerTexture(
    {
      id: "terrain",
      src: "memory://terrain",
      tileSize: TILE_SIZE,
      cols: COLS,
      rows: 2
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
