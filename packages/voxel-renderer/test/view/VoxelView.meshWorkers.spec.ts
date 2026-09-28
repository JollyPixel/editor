// Import Node.js Dependencies
import {
  afterEach,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  chunkMeshes,
  makeView,
  placeCube,
  type ViewTestOptions
} from "../helpers/view.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeLogger } from "../helpers/fakes.ts";
import {
  CUBE_ID,
  LEAVES_ID,
  RAMP_ID,
  STAIR_ID
} from "../helpers/ids.ts";
import {
  buildRequests,
  inProcessWorkers,
  meshInWorkers,
  meshSnapshot,
  type InProcessWorkers
} from "../helpers/meshWorkers.ts";

// CONSTANTS
const kGround = "Ground";
const kWater = "Water";
const kViews = new Set<VoxelView>();

function makeWorld(
  options: ViewTestOptions = {}
): VoxelView {
  const view = makeView({
    layers: [kGround, kWater],
    blocks: [
      makeBlockDef(CUBE_ID, "cube"),
      makeBlockDef(RAMP_ID, "ramp"),
      makeBlockDef(STAIR_ID, "stair"),
      makeBlockDef(LEAVES_ID, "cube", { alphaMode: "mask" })
    ],
    ...options
  });
  for (let x = -3; x < 9; x++) {
    for (let z = -2; z < 7; z++) {
      placeCube(view, kGround, { x, y: 0, z });
      if ((x + z) % 3 === 0) {
        placeCube(view, kGround, { x, y: 1, z }, RAMP_ID);
      }
      if ((x * z) % 5 === 1) {
        placeCube(view, kGround, { x, y: 2, z }, STAIR_ID);
      }
      if (x === z) {
        placeCube(view, kGround, { x, y: 3, z }, LEAVES_ID);
      }
    }
  }
  for (let x = 0; x < 6; x++) {
    placeCube(view, kWater, { x, y: 1, z: 5 });
  }
  view.document.world.setLayerPosition(kWater, { x: 0, y: 1, z: 0 });
  kViews.add(view);

  return view;
}

async function makeWorkerWorld(
  workers: InProcessWorkers,
  options: ViewTestOptions = {}
): Promise<VoxelView> {
  const view = makeWorld({
    ...options,
    meshing: {
      workers: {
        createWorker: workers.createWorker,
        count: 2
      }
    }
  });
  view.init();
  await meshInWorkers(view);

  return view;
}

function mainThreadSnapshot(
  options: ViewTestOptions = {}
): ReturnType<typeof meshSnapshot> {
  const view = makeWorld(options);
  view.init();

  return meshSnapshot(view);
}

describe("VoxelView - mesh workers", () => {
  afterEach(() => {
    for (const view of kViews) {
      view.dispose();
    }
    kViews.clear();
  });

  for (const options of [
    {},
    { lighting: { ambientOcclusion: 1 } }
  ] satisfies ViewTestOptions[]) {
    it(`builds the main-thread geometry with ${JSON.stringify(options)}`, async() => {
      const workers = inProcessWorkers();
      const view = await makeWorkerWorld(workers, options);

      assert.ok(buildRequests(workers) > 0);
      assert.deepEqual(meshSnapshot(view), mainThreadSnapshot(options));
    });
  }

  it("defers init meshing to the workers", async() => {
    const workers = inProcessWorkers();
    const view = makeWorld({
      meshing: { workers: { createWorker: workers.createWorker } }
    });

    view.init();
    assert.equal(chunkMeshes(view).length, 0);

    view.tick(0);
    assert.ok(view.pendingRebuilds > 0);

    await meshInWorkers(view);
    assert.equal(view.pendingRebuilds, 0);
    assert.ok(chunkMeshes(view).length > 0);
  });

  it("rebuilds a chunk edited while its worker build runs", async() => {
    const workers = inProcessWorkers();
    const view = await makeWorkerWorld(workers);

    placeCube(view, kGround, { x: 1, y: 5, z: 1 });
    view.tick(0);
    view.document.world.removeVoxel(kGround, { position: { x: 1, y: 0, z: 1 } });
    await meshInWorkers(view);

    const expected = makeWorld();
    placeCube(expected, kGround, { x: 1, y: 5, z: 1 });
    expected.document.world.removeVoxel(kGround, { position: { x: 1, y: 0, z: 1 } });
    expected.init();
    assert.deepEqual(meshSnapshot(view), meshSnapshot(expected));
  });

  it("rebuilds a chunk whose finished build read a neighbour edited since", async() => {
    const workers = inProcessWorkers();
    const view = await makeWorkerWorld(workers);
    const sent = workers.requests.length;

    placeCube(view, kGround, { x: 1, y: 2, z: 1 }, CUBE_ID);
    view.tick(0);
    await setImmediate();
    placeCube(view, kGround, { x: 5, y: 2, z: 1 }, CUBE_ID);
    await meshInWorkers(view);

    const originBuilds = workers.requests.slice(sent).filter(
      (request) => request.type === "build" &&
        request.members.some(({ cx, cy, cz }) => cx === 0 && cy === 0 && cz === 0)
    );
    assert.equal(originBuilds.length, 2);

    const expected = makeWorld();
    placeCube(expected, kGround, { x: 1, y: 2, z: 1 }, CUBE_ID);
    placeCube(expected, kGround, { x: 5, y: 2, z: 1 }, CUBE_ID);
    expected.init();
    assert.deepEqual(meshSnapshot(view), meshSnapshot(expected));
  });

  it("flushes synchronously and ignores the builds still running", async() => {
    const workers = inProcessWorkers();
    const view = makeWorld({
      meshing: { workers: { createWorker: workers.createWorker } }
    });
    view.init();
    view.tick(0);

    view.flush();
    const flushed = meshSnapshot(view);
    assert.equal(view.pendingRebuilds, 0);
    assert.deepEqual(flushed, mainThreadSnapshot());

    await meshInWorkers(view);
    assert.deepEqual(meshSnapshot(view), flushed);
  });

  it("rebuilds chunks whose running build used replaced block definitions", async() => {
    const workers = inProcessWorkers();
    const view = makeWorld({
      meshing: { workers: { createWorker: workers.createWorker } }
    });
    const redefined = makeBlockDef(CUBE_ID, "cube", {
      defaultTexture: { col: 1, row: 0 }
    });
    view.init();
    view.tick(0);

    view.document.blocks.register(redefined);
    await meshInWorkers(view);

    const expected = makeWorld();
    expected.document.blocks.register(redefined);
    expected.init();
    assert.deepEqual(meshSnapshot(view), meshSnapshot(expected));
  });

  it("falls back to the main thread when a worker crashes", async() => {
    const workers = inProcessWorkers();
    const errors: string[] = [];
    const logger = makeLogger();
    logger.error = (message) => void errors.push(message);
    const view = makeWorld({
      logger,
      meshing: { workers: { createWorker: workers.createWorker } }
    });
    view.init();
    view.tick(0);

    workers.crash();
    view.tick(0);

    assert.equal(errors.length, 1);
    assert.equal(view.pendingRebuilds, 0);
    assert.deepEqual(meshSnapshot(view), mainThreadSnapshot());
  });

  it("stays on the main thread without cross-origin isolation", (t) => {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
      value: false,
      configurable: true
    });
    t.after(() => Reflect.deleteProperty(globalThis, "crossOriginIsolated"));
    const workers = inProcessWorkers();
    const warnings: string[] = [];
    const view = makeWorld({
      logger: makeLogger(warnings),
      meshing: { workers: { createWorker: workers.createWorker } }
    });

    view.init();

    assert.equal(warnings.length, 1);
    assert.ok(chunkMeshes(view).length > 0);
    assert.equal(workers.requests.length, 0);
  });
});
