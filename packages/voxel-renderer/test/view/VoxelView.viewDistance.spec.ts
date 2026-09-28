// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { ViewDistance } from "../../src/view/options/index.ts";
import { makeFakeCollider } from "../helpers/fakes.ts";
import {
  chunkMeshes,
  createView,
  fillChunks,
  makeView,
  placeCube,
  sortedChunkCoords,
  type ViewTestOptions
} from "../helpers/view.ts";
import { CHUNK_SIZE as kChunkSize } from "../helpers/ids.ts";

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
  options?: ViewTestOptions;
  meshless?: boolean;
  steps: Step[];
}

function makeFourChunkView(
  options: ViewTestOptions = {},
  meshless = false
): VoxelView {
  const settings: ViewTestOptions = {
    layers: ["Ground"],
    ...options,
    meshing: {
      budgetMs: 0,
      ...options.meshing
    }
  };
  const view = meshless
    ? createView({ chunkSize: kChunkSize, ...settings })
    : makeView(settings);
  fillChunks(view, "Ground", 4);

  return view;
}

function snapshot(
  view: VoxelView
): Snapshot {
  const meshes = chunkMeshes(view);
  const overlay = view.root.getObjectByName("VoxelInspector");
  const bounds = view.root.getObjectByName("VoxelInspector:chunkBounds");

  return {
    built: sortedChunkCoords(meshes),
    visible: sortedChunkCoords(meshes.filter((mesh) => mesh.visible)),
    wireframes: sortedChunkCoords(overlay?.children ?? []),
    bounds: sortedChunkCoords(bounds?.children ?? []),
    chunks: view.inspector.mesh.stats.chunks,
    culled: view.inspector.mesh.stats.culledChunks
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

const kInspected: ViewTestOptions = {
  range: { viewDistance: kTight },
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
    options: {
      ...kInspected,
      range: {
        viewDistance: kTight,
        policy: "unload"
      }
    },
    steps: [
      { focus: kNear, expect: { built: kFirstPair } },
      { focus: kFar, expect: { built: kLastPair, bounds: kLastPair, chunks: 2 } },
      { focus: kNear, expect: { built: kFirstPair } }
    ]
  },
  {
    name: "applies a widened view distance without waiting for the focus",
    options: { range: { viewDistance: kTight } },
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
    options: { range: { viewDistance: 1 } },
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
    options: {
      ...kInspected,
      range: {
        viewDistance: kTight,
        policy: "unload"
      }
    },
    meshless: true,
    steps: [
      { focus: kNear, expect: { bounds: kFirstPair } },
      { focus: kFar, expect: { bounds: kLastPair, chunks: 2 } }
    ]
  }
];

describe("VoxelView - view distance", () => {
  for (const { name, options, meshless, steps } of kScenarios) {
    it(name, () => {
      const view = makeFourChunkView(options, meshless);

      steps.forEach(({ focus, viewDistance, layerVisible, expect }, index) => {
        if (focus) {
          view.focus = focus;
        }
        if (viewDistance) {
          view.range.viewDistance = viewDistance;
        }
        if (layerVisible !== undefined) {
          view.document.world.setLayerVisible("Ground", layerVisible);
        }
        view.tick(0);

        assert.deepEqual(pick(snapshot(view), expect), expect, `step ${index}`);
      });
    });
  }

  it("leaves chunks beyond the view distance dirty and meshes their missed edits later", () => {
    const view = makeFourChunkView({ range: { viewDistance: 1 } });
    const lastChunk = view.document.world.getLayer("Ground")!.getChunk(3, 0, 0)!;
    view.focus = kNear;
    view.tick(0);
    assert.equal(lastChunk.dirty, true);

    placeCube(view, "Ground", { x: 13, y: 1, z: 0 });
    view.focus = kFar;
    view.tick(0);

    assert.ok(snapshot(view).built.includes("3,0,0"));
    assert.equal(lastChunk.dirty, false);
    assert.equal(lastChunk.voxelCount, 2);
  });

  it("skips queued chunks the view distance no longer admits", (t) => {
    let clock = 0;
    t.mock.method(performance, "now", () => clock++);
    const view = makeFourChunkView({
      range: { viewDistance: kTight },
      meshing: { budgetMs: 1 }
    });
    view.tick(0);

    view.focus = kNear;
    for (let i = 0; i < 4; i++) {
      view.tick(0);
    }

    const { built, visible } = snapshot(view);
    assert.deepEqual(built, kFirstPair);
    assert.deepEqual(visible, kFirstPair);
    assert.equal(view.document.world.getLayer("Ground")!.getChunk(3, 0, 0)!.dirty, true);
  });

  it("meshes a chunk edited in range while chunks beyond it stay dirty", () => {
    const view = makeFourChunkView({ range: { viewDistance: kTight } });
    view.focus = kNear;
    view.tick(0);

    placeCube(view, "Ground", { x: 1, y: 5, z: 1 });
    view.tick(0);

    const beyond = view.document.world.getLayer("Ground")!.getChunk(3, 0, 0)!;
    assert.ok(snapshot(view).built.includes("0,1,0"));
    assert.equal(beyond.dirty, true);
  });

  it("keeps colliders for chunks the view distance unloads", () => {
    const fake = makeFakeCollider();
    const view = makeFourChunkView({
      range: {
        viewDistance: kTight,
        policy: "unload"
      },
      collider: () => fake.collider
    });
    view.focus = kNear;
    view.tick(0);
    const near = [...fake.live];
    assert.equal(near.length, 2);

    view.focus = kFar;
    view.tick(0);

    assert.deepEqual(snapshot(view).built, kLastPair);
    assert.ok(near.every((key) => fake.live.has(key)));
  });
});
