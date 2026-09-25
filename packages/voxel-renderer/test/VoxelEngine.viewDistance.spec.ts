// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelEngine,
  type VoxelEngineOptions
} from "../src/VoxelEngine.ts";
import { ViewDistance } from "../src/world/index.ts";
import { makeFakeCollider } from "./helpers/fakes.ts";
import {
  chunkMeshes,
  fillChunks,
  makeEngine,
  placeCube,
  sortedChunkCoords
} from "./helpers/engine.ts";
import { CHUNK_SIZE as kChunkSize } from "./helpers/ids.ts";

// CONSTANTS
const kNear = { x: 2, y: 2, z: 2 };
const kFar = { x: 14, y: 2, z: 2 };
const kTight = { chunks: 1, hysteresis: 0 };
const kFirstPair = ["0,0,0", "1,0,0"];
const kLastPair = ["2,0,0", "3,0,0"];
const kAll = [...kFirstPair, ...kLastPair];

interface Snapshot {
  built: string[];
  visible: string[];
  wireframes: string[];
  bounds: string[];
  chunks: number;
  culled: number;
}

interface Step {
  focus?: typeof kNear;
  viewDistance?: ViewDistance;
  layerVisible?: boolean;
  expect: Partial<Snapshot>;
}

interface Scenario {
  name: string;
  options?: VoxelEngineOptions;
  meshless?: boolean;
  steps: Step[];
}

function makeFourChunkEngine(
  options: VoxelEngineOptions = {},
  meshless = false
): VoxelEngine {
  const settings: VoxelEngineOptions = {
    layers: ["Ground"],
    rebuildBudgetMs: 0,
    ...options
  };
  const engine = meshless
    ? new VoxelEngine({ chunkSize: kChunkSize, ...settings })
    : makeEngine(settings);
  fillChunks(engine, "Ground", 4);

  return engine;
}

function snapshot(
  engine: VoxelEngine
): Snapshot {
  const meshes = chunkMeshes(engine);
  const overlay = engine.root.getObjectByName("VoxelInspector");
  const bounds = engine.root.getObjectByName("VoxelInspector:chunkBounds");

  return {
    built: sortedChunkCoords(meshes),
    visible: sortedChunkCoords(meshes.filter((mesh) => mesh.visible)),
    wireframes: sortedChunkCoords(overlay?.children ?? []),
    bounds: sortedChunkCoords(bounds?.children ?? []),
    chunks: engine.inspector.mesh.stats.chunks,
    culled: engine.inspector.mesh.stats.culledChunks
  };
}

function pick(
  actual: Snapshot,
  expected: Partial<Snapshot>
): Partial<Snapshot> {
  return Object.fromEntries(
    Object.keys(expected).map((key) => [key, actual[key as keyof Snapshot]])
  );
}

const kInspected: VoxelEngineOptions = {
  viewDistance: kTight,
  inspector: {
    mode: "overlay",
    chunkBounds: true
  }
};

const kScenarios: Scenario[] = [
  {
    name: "hides chunks leaving the view distance and shows them again",
    options: kInspected,
    steps: [
      {
        focus: kNear,
        expect: {
          built: kFirstPair,
          visible: kFirstPair,
          wireframes: kFirstPair,
          bounds: kFirstPair
        }
      },
      {
        focus: kFar,
        expect: {
          built: kAll,
          visible: kLastPair,
          wireframes: kLastPair,
          bounds: kLastPair,
          chunks: 4,
          culled: 2
        }
      },
      {
        focus: kNear,
        expect: { visible: kFirstPair, wireframes: kFirstPair, bounds: kFirstPair, culled: 2 }
      },
      {
        viewDistance: ViewDistance.Unlimited,
        expect: { visible: kAll, bounds: kAll, culled: 0 }
      }
    ]
  },
  {
    name: "keeps the chunks of a layer hidden out of range hidden when they return",
    options: kInspected,
    steps: [
      { focus: kNear, expect: { built: kFirstPair } },
      { focus: kFar, expect: { built: kAll, visible: kLastPair } },
      { layerVisible: false, expect: { built: kFirstPair, visible: [] } },
      { focus: kNear, expect: { built: [], visible: [], wireframes: [] } }
    ]
  },
  {
    name: "disposes chunks leaving the view distance under the unload policy",
    options: { ...kInspected, viewDistancePolicy: "unload" },
    steps: [
      { focus: kNear, expect: { built: kFirstPair } },
      { focus: kFar, expect: { built: kLastPair, bounds: kLastPair, chunks: 2 } },
      { focus: kNear, expect: { built: kFirstPair } }
    ]
  },
  {
    name: "applies a widened view distance without waiting for the focus",
    options: { viewDistance: kTight },
    steps: [
      { focus: kNear, expect: { built: kFirstPair } },
      { viewDistance: new ViewDistance({ chunks: 4, hysteresis: 0 }), expect: { built: kAll } }
    ]
  },
  {
    name: "meshes every chunk when the view distance is unlimited",
    steps: [{ focus: kNear, expect: { built: kAll } }]
  },
  {
    name: "meshes every chunk while no focus is set",
    options: { viewDistance: 1 },
    steps: [{ expect: { built: kAll } }]
  },
  {
    name: "hides the bounds of meshless chunks",
    options: kInspected,
    meshless: true,
    steps: [
      { focus: kNear, expect: { bounds: kFirstPair } },
      { focus: kFar, expect: { built: [], bounds: kLastPair, chunks: 4, culled: 2 } }
    ]
  },
  {
    name: "unloads the bounds of meshless chunks",
    options: { ...kInspected, viewDistancePolicy: "unload" },
    meshless: true,
    steps: [
      { focus: kNear, expect: { bounds: kFirstPair } },
      { focus: kFar, expect: { bounds: kLastPair, chunks: 2 } }
    ]
  }
];

describe("VoxelEngine - view distance", () => {
  for (const { name, options, meshless, steps } of kScenarios) {
    it(name, () => {
      const engine = makeFourChunkEngine(options, meshless);

      steps.forEach(({ focus, viewDistance, layerVisible, expect }, index) => {
        if (focus) {
          engine.focus = focus;
        }
        if (viewDistance) {
          engine.viewDistance = viewDistance;
        }
        if (layerVisible !== undefined) {
          engine.world.setLayerVisible("Ground", layerVisible);
        }
        engine.tick(0);

        assert.deepEqual(pick(snapshot(engine), expect), expect, `step ${index}`);
      });
    });
  }

  it("leaves chunks beyond the view distance dirty and meshes their missed edits later", () => {
    const engine = makeFourChunkEngine({ viewDistance: 1 });
    const lastChunk = engine.world.getLayer("Ground")!.getChunk(3, 0, 0)!;
    engine.focus = kNear;
    engine.tick(0);
    assert.equal(lastChunk.dirty, true);

    placeCube(engine, "Ground", { x: 13, y: 1, z: 0 });
    engine.focus = kFar;
    engine.tick(0);

    assert.ok(snapshot(engine).built.includes("3,0,0"));
    assert.equal(lastChunk.dirty, false);
    assert.equal(lastChunk.voxelCount, 2);
  });

  it("keeps colliders for chunks the view distance unloads", () => {
    const fake = makeFakeCollider();
    const engine = makeFourChunkEngine({
      viewDistance: kTight,
      viewDistancePolicy: "unload",
      collider: () => fake.collider
    });
    engine.focus = kNear;
    engine.tick(0);
    const near = [...fake.live];
    assert.equal(near.length, 2);

    engine.focus = kFar;
    engine.tick(0);

    assert.deepEqual(snapshot(engine).built, kLastPair);
    assert.ok(near.every((key) => fake.live.has(key)));
  });
});
