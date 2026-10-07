// Import Node.js Dependencies
import { parseArgs } from "node:util";
import { performance } from "node:perf_hooks";

// Import Internal Dependencies
import { VoxelDocument } from "../src/document/VoxelDocument.ts";
import { BlockShapeRegistry } from "../src/document/blocks/shape/BlockShapeRegistry.ts";
import type { BlockDefinition } from "../src/document/blocks/BlockDefinition.ts";
import { VoxelLayerVisibility } from "../src/view/VoxelLayerVisibility.ts";
import { BlockLight } from "../src/view/lighting/BlockLight.ts";
import { LightFalloff } from "../src/view/lighting/LightFalloff.ts";
import type { LitTarget } from "../src/view/lighting/ChunkLightTextures.ts";
import type { LightChunkKey } from "../src/view/lighting/LightGrid.ts";

// CONSTANTS
const kLayer = "Ground";
const kStoneId = 1;
const kGlowId = 2;

/**
 * Headless block light replay: a stone floor with scattered emitters and
 * pillars, timed through the same update and texture refresh the view runs.
 *
 * Usage: node bench/block-light.bench.ts [--size 256] [--lights 300] [--chunk 16] [--tint #ffffff] [--runs 5]
 */
const { values } = parseArgs({
  options: {
    size: { type: "string", default: "256" },
    lights: { type: "string", default: "300" },
    chunk: { type: "string", default: "16" },
    tint: { type: "string", default: "#ffffff" },
    seed: { type: "string", default: "1337" },
    runs: { type: "string", default: "5" },
    edits: { type: "string", default: "200" }
  }
});

const size = Number(values.size);
const chunkSize = Number(values.chunk);
const runs = Number(values.runs);
const edits = Number(values.edits);

function random(
  seed: number
): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 2 ** 32;
  };
}

function block(
  id: number,
  materialGroup?: string
): BlockDefinition {
  return {
    id,
    name: `block ${id}`,
    shapeId: "cube",
    faceTextures: {},
    defaultTexture: { blocksetId: "bench", col: 0, row: 0 },
    collidable: true,
    properties: {},
    ...(materialGroup === undefined ? {} : { materialGroup })
  };
}

function median(
  samples: number[]
): number {
  const sorted = samples.toSorted((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

function createScene() {
  const document = new VoxelDocument({
    chunkSize,
    layers: [kLayer],
    blocks: [
      block(kStoneId),
      block(kGlowId, "glow")
    ],
    materialGroups: [
      { id: "glow", emissive: values.tint, lightLevel: 15 }
    ]
  });
  const next = random(Number(values.seed));
  const cells: number[] = [];
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      cells.push(x, 0, z, kStoneId, 0);
    }
  }
  const lights: { x: number; y: number; z: number; }[] = [];
  for (let i = 0; i < Number(values.lights); i++) {
    const light = {
      x: Math.floor(next() * size),
      y: 1 + Math.floor(next() * 3),
      z: Math.floor(next() * size)
    };
    lights.push(light);
    cells.push(light.x, light.y, light.z, kGlowId, 0);

    const pillarX = Math.floor(next() * size);
    const pillarZ = Math.floor(next() * size);
    for (let y = 1; y < 5; y++) {
      cells.push(pillarX, y, pillarZ, kStoneId, 0);
    }
  }
  document.world.patchVoxels(kLayer, cells);

  const light = new BlockLight({
    world: document.world,
    blocks: document.blocks,
    shapes: BlockShapeRegistry.createDefault(),
    materialGroups: document.materialGroups,
    visibility: new VoxelLayerVisibility()
  });
  const targets: LitTarget[] = [];
  for (const chunk of document.world.getLayer(kLayer)!.getChunks()) {
    targets.push({
      key: `${chunk.cx},${chunk.cy},${chunk.cz}`,
      origin: {
        x: chunk.cx * chunkSize,
        y: chunk.cy * chunkSize,
        z: chunk.cz * chunkSize
      }
    });
  }

  return { document, light, lights, targets };
}

type Scene = ReturnType<typeof createScene>;

function refresh(
  scene: Scene
): number {
  const changed: ReadonlySet<LightChunkKey> = scene.light.update();
  if (changed.size === 0) {
    return 0;
  }

  let rebuilt = 0;
  for (const target of scene.targets) {
    if (scene.light.textures.affects(target, changed)) {
      scene.light.textures.rebuild(target);
      rebuilt++;
    }
  }

  return rebuilt;
}

function timed(
  action: () => void
): number {
  const start = performance.now();
  action();

  return performance.now() - start;
}

for (let run = 0; run < runs; run++) {
  const scene = createScene();
  const { light, lights, document } = scene;

  let textures = 0;
  const firstMs = timed(() => {
    textures = refresh(scene);
  });

  const fullMs = median(Array.from({ length: 5 }, () => timed(() => {
    light.invalidate();
    refresh(scene);
  })));

  const fillMs = median(Array.from({ length: 5 }, () => timed(() => {
    for (const target of scene.targets) {
      light.textures.rebuild(target);
    }
  })));

  const falloffMs = median(Array.from({ length: 6 }, (_, index) => timed(() => {
    light.falloff = index % 2 === 0 ? LightFalloff.FOCUSED : LightFalloff.WIDE;
    refresh(scene);
  })));
  light.falloff = LightFalloff.WIDE;
  refresh(scene);

  const editSamples: number[] = [];
  for (let i = 0; i < edits; i++) {
    const near = lights[i % lights.length];
    const position = { x: near.x + 1, y: near.y, z: near.z };
    const placing = i % 2 === 0;
    editSamples.push(timed(() => {
      if (placing) {
        document.world.setVoxel(kLayer, { position, blockId: kStoneId });
      }
      else {
        document.world.removeVoxel(kLayer, { position });
      }
      refresh(scene);
    }));
  }

  const idleRuns = 10_000;
  const idleMs = timed(() => {
    for (let i = 0; i < idleRuns; i++) {
      light.update();
    }
  }) / idleRuns;

  console.log(
    [
      `run ${run + 1}/${runs}`,
      `textures ${textures}`,
      `first ${firstMs.toFixed(1)}ms`,
      `full ${fullMs.toFixed(1)}ms`,
      `fill ${fillMs.toFixed(2)}ms`,
      `falloff ${falloffMs.toFixed(1)}ms`,
      `edit p50 ${median(editSamples).toFixed(2)}ms`,
      `edit max ${Math.max(...editSamples).toFixed(2)}ms`,
      `idle ${(idleMs * 1000).toFixed(2)}us`
    ].join(" | ")
  );
}
