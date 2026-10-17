// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  createBenchView,
  flushed,
  nodeMeshWorkers,
  populateTerrain,
  settle
} from "./common.ts";

const { values } = parseArgs({
  options: {
    size: { type: "string", default: "1024" },
    chunk: { type: "string", default: "256" },
    seed: { type: "string", default: "1337" },
    runs: { type: "string", default: "3" },
    workers: { type: "string", default: "0" }
  }
});

const runs = Number(values.runs);
const workers = Number(values.workers);

for (let run = 0; run < runs; run++) {
  const view = createBenchView(
    Number(values.chunk),
    workers > 0 ? nodeMeshWorkers(workers) : undefined
  );

  const generateStart = performance.now();
  const terrain = populateTerrain(view, {
    seed: Number(values.seed),
    size: Number(values.size)
  });
  const generateMs = performance.now() - generateStart;

  const meshStart = performance.now();
  const mainMs = workers > 0 ? await settle(view) : flushed(view);
  const meshMs = performance.now() - meshStart;

  const { triangles, vertices } = view.inspector.mesh.stats;
  const {
    heapUsed, arrayBuffers, rss
  } = process.memoryUsage();
  console.log(
    [
      `run ${run + 1}/${runs}`,
      `voxels ${terrain.voxelCount.toLocaleString("en-US")}`,
      `generate ${generateMs.toFixed(1)}ms`,
      `mesh ${meshMs.toFixed(1)}ms`,
      `main thread ${mainMs.toFixed(1)}ms`,
      `tris ${triangles.toLocaleString("en-US")}`,
      `verts ${vertices.toLocaleString("en-US")}`,
      `heap ${mb(heapUsed)}`,
      `buffers ${mb(arrayBuffers)}`,
      `rss ${mb(rss)}`
    ].join("  |  ")
  );

  view.dispose();
}

function mb(
  bytes: number
): string {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
}
