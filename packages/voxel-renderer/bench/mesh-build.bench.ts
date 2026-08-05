// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { createBenchEngine, populateTerrain } from "./common.ts";

/**
 * Headless replay of `demo-noise-world`: generate terrain, then mesh dirty
 * chunks. Measures the same two phases shown in the demo HUD.
 *
 * Usage: node bench/mesh-build.bench.ts [--size 1024] [--chunk 256] [--runs 3] [--greedy]
 */
const { values } = parseArgs({
  options: {
    size: { type: "string", default: "1024" },
    chunk: { type: "string", default: "256" },
    seed: { type: "string", default: "1337" },
    runs: { type: "string", default: "3" },
    greedy: { type: "boolean", default: false }
  }
});

const runs = Number(values.runs);
const greedy = values.greedy;

for (let run = 0; run < runs; run++) {
  const engine = createBenchEngine(
    Number(values.chunk),
    greedy
  );

  const generateStart = performance.now();
  const terrain = populateTerrain(engine, {
    seed: Number(values.seed),
    size: Number(values.size)
  });
  const generateMs = performance.now() - generateStart;

  // Use `flush()` so meshing is measured in one pass instead of frame-budgeted ticks.
  const meshStart = performance.now();
  engine.flush();
  const meshMs = performance.now() - meshStart;

  const { triangles, vertices } = engine.debug.stats;
  // Geometry memory is mostly `arrayBuffers`; `heapUsed` alone under-reports cost.
  const {
    heapUsed, arrayBuffers, rss
  } = process.memoryUsage();
  console.log(
    [
      `run ${run + 1}/${runs}`,
      greedy ? "greedy" : "naive ",
      `voxels ${terrain.voxelCount.toLocaleString("en-US")}`,
      `generate ${generateMs.toFixed(1)}ms`,
      `mesh ${meshMs.toFixed(1)}ms`,
      `tris ${triangles.toLocaleString("en-US")}`,
      `verts ${vertices.toLocaleString("en-US")}`,
      `heap ${mb(heapUsed)}`,
      `buffers ${mb(arrayBuffers)}`,
      `rss ${mb(rss)}`
    ].join("  |  ")
  );

  engine.dispose();
}

function mb(
  bytes: number
): string {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
}
