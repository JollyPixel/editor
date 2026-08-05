// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { VoxelMeshBuilder } from "../src/mesh/VoxelMeshBuilder.ts";
import { createBenchEngine, populateTerrain } from "./common.ts";

/**
 * Naive vs greedy on one world, interleaved inside a single process.
 *
 * Separate process runs can drift heavily under thermal throttling. Alternating
 * variants on the same chunks cancels most machine drift; reporting min keeps
 * the least-interrupted sample.
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
const rounds = Number(values.rounds);

const engine = createBenchEngine(chunkSize);
const terrain = populateTerrain(engine, {
  seed: Number(values.seed),
  size
});

const shared = {
  world: engine.world,
  blockRegistry: engine.blockRegistry,
  shapeRegistry: engine.shapeRegistry,
  tilesetManager: engine.tilesetManager
};
const variants = [
  {
    name: "naive",
    builder: new VoxelMeshBuilder({ ...shared, greedy: false }),
    times: [] as number[]
  },
  {
    name: "greedy",
    builder: new VoxelMeshBuilder({ ...shared, greedy: true }),
    times: [] as number[]
  }
] satisfies { name: string; builder: VoxelMeshBuilder; times: number[]; }[];

// Warmup pass so both builders start timed rounds in optimized code paths.
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
      `min ${Math.min(...times).toFixed(1)}ms`,
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
    // Builder buffers are reused; dispose per-chunk geometries to avoid accumulation.
    for (const geometry of geometries.values()) {
      geometry.dispose();
    }
  }

  return { triangles, vertices, bytesPerVertex };
}

function median(
  values: number[]
): number {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[sorted.length >> 1];
}
