// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import { VoxelMeshBuilder } from "../src/mesh/VoxelMeshBuilder.ts";
import type { BlockDefinitionIn } from "../src/blocks/BlockDefinition.ts";
import {
  TerrainBlock,
  generateTerrain
} from "../examples/scripts/utils/terrain.ts";

// CONSTANTS
const kTerrainLayer = "Terrain";
const kWaterLayer = "Water";
const kTileSize = 8;
const kCols = 4;

/**
 * Naive vs greedy on one world, interleaved inside a single process.
 *
 * Separate `npm run bench` invocations drift by 50-120% on a thermally
 * throttling machine, which swamps anything under ~20%. Alternating the two
 * builders over the same chunks makes them share whatever the machine is doing,
 * and reporting the minimum discards the runs that were interrupted.
 *
 * Usage: node bench/mesh-compare.bench.ts [--size 512] [--chunk 256] [--rounds 5]
 */
const { values } = parseArgs({
  options: {
    size: { type: "string", default: "512" },
    chunk: { type: "string", default: "256" },
    seed: { type: "string", default: "1337" },
    rounds: { type: "string", default: "5" }
  }
});

const size = Number(values.size);
const chunkSize = Number(values.chunk);
const seed = Number(values.seed);
const rounds = Number(values.rounds);

const engine = new VoxelEngine({
  chunkSize,
  layers: [kTerrainLayer, kWaterLayer],
  blocks: terrainBlocks(),
  alphaTest: 0.5
});
engine.tilesetManager.registerTexture(
  { id: "terrain", src: "memory://terrain", tileSize: kTileSize, cols: kCols, rows: 2 },
  mockTexture()
);

const terrain = generateTerrain(
  (position, blockId) => engine.setVoxel(
    blockId === TerrainBlock.Water ? kWaterLayer : kTerrainLayer,
    { position, blockId }
  ),
  { seed, size }
);

const shared = {
  world: engine.world,
  blockRegistry: engine.blockRegistry,
  shapeRegistry: engine.shapeRegistry,
  tilesetManager: engine.tilesetManager
};
const variants = [
  { name: "naive ", builder: new VoxelMeshBuilder({ ...shared, greedy: false }), times: [] as number[] },
  { name: "greedy", builder: new VoxelMeshBuilder({ ...shared, greedy: true }), times: [] as number[] }
];

// One untimed round so both builders enter the loop already optimised.
for (const { builder } of variants) {
  meshAll(builder);
}

for (let round = 0; round < rounds; round++) {
  for (const variant of variants) {
    const startedAt = performance.now();
    meshAll(variant.builder);
    variant.times.push(performance.now() - startedAt);
  }
}

console.log(
  `${size}² terrain, ${terrain.voxelCount.toLocaleString("en-US")} voxels, ` +
  `chunk ${chunkSize}, ${rounds} rounds`
);
for (const { name, builder, times } of variants) {
  const { triangles, vertices, bytesPerVertex } = meshAll(builder);
  console.log(
    [
      name,
      `min ${min(times).toFixed(1)}ms`,
      `median ${median(times).toFixed(1)}ms`,
      `tris ${triangles.toLocaleString("en-US")}`,
      `verts ${vertices.toLocaleString("en-US")}`,
      `${bytesPerVertex}B/vert`
    ].join("  |  ")
  );
}

function meshAll(
  builder: VoxelMeshBuilder
): { triangles: number; vertices: number; bytesPerVertex: number; } {
  let triangles = 0;
  let vertices = 0;
  let bytesPerVertex = 0;

  for (const { layer, chunk } of engine.world.getAllChunks()) {
    const geometries = builder.buildChunkGeometries(chunk, layer);
    if (geometries === null) {
      continue;
    }

    triangles += builder.stats.triangles;
    vertices += builder.stats.vertices;
    bytesPerVertex = builder.stats.bytesPerVertex;
    // The buffers are reused for the next chunk; only the geometries are new.
    for (const geometry of geometries.values()) {
      geometry.dispose();
    }
  }

  return { triangles, vertices, bytesPerVertex };
}

function min(
  values: number[]
): number {
  return Math.min(...values);
}

function median(
  values: number[]
): number {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[sorted.length >> 1];
}

function terrainBlocks(): BlockDefinitionIn[] {
  return Object.values(TerrainBlock).map((id, index) => {
    return {
      id,
      name: `Block ${id}`,
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        tilesetId: "terrain",
        col: index % kCols,
        row: Math.floor(index / kCols)
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
    image: { width: kCols * kTileSize, height: 2 * kTileSize },
    dispose() {
      // no-op
    }
  };
}
