// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
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
 * Headless replay of `examples/demo-noise-world.ts`: generate the same terrain,
 * then mesh every dirty chunk. Only the two numbers the example reports are
 * measured — voxel writes and mesh build — so a change here is directly
 * comparable to what the in-browser HUD shows.
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

const size = Number(values.size);
const chunkSize = Number(values.chunk);
const seed = Number(values.seed);
const runs = Number(values.runs);
const greedy = values.greedy;

for (let run = 0; run < runs; run++) {
  const engine = new VoxelEngine({
    chunkSize,
    layers: [kTerrainLayer, kWaterLayer],
    blocks: terrainBlocks(),
    alphaTest: 0.5,
    greedy
  });
  engine.tilesetManager.registerTexture(
    { id: "terrain", src: "memory://terrain", tileSize: kTileSize, cols: kCols, rows: 2 },
    mockTexture()
  );

  const generateStart = performance.now();
  const terrain = generateTerrain(
    (position, blockId) => engine.setVoxel(
      blockId === TerrainBlock.Water ? kWaterLayer : kTerrainLayer,
      { position, blockId }
    ),
    { seed, size }
  );
  const generateMs = performance.now() - generateStart;

  // `flush()` rather than `tick()`: the tick budget would spread the rebuild
  // over hundreds of frames, which is the point of the budget but not of this
  // measurement.
  const meshStart = performance.now();
  engine.flush();
  const meshMs = performance.now() - meshStart;

  const { triangles, vertices } = countGeometry(engine);
  // Voxels live in typed arrays, geometry in THREE buffers: both land in
  // `arrayBuffers`, not `heapUsed`. Reporting heap alone hides most of the cost.
  const { heapUsed, arrayBuffers, rss } = process.memoryUsage();
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

function countGeometry(
  engine: VoxelEngine
): { triangles: number; vertices: number; } {
  let indices = 0;
  let vertices = 0;

  engine.root.traverse((object) => {
    const geometry = (object as any).geometry;
    if (!geometry) {
      return;
    }
    indices += geometry.getIndex()?.count ?? 0;
    vertices += geometry.getAttribute("position")?.count ?? 0;
  });

  return { triangles: indices / 3, vertices };
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
