// Import Node.js Dependencies
import {
  afterEach,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import type {
  VoxelEngine,
  VoxelEngineOptions
} from "../src/VoxelEngine.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { makeLogger } from "./helpers/fakes.ts";
import {
  CUBE_ID,
  LEAVES_ID,
  RAMP_ID,
  STAIR_ID
} from "./helpers/ids.ts";
import {
  buildRequests,
  inProcessWorkers,
  meshInWorkers,
  meshSnapshot,
  type InProcessWorkers
} from "./helpers/meshWorkers.ts";

// CONSTANTS
const kGround = "Ground";
const kWater = "Water";
const kEngines = new Set<VoxelEngine>();

function makeWorld(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeEngine({
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
      placeCube(engine, kGround, { x, y: 0, z });
      if ((x + z) % 3 === 0) {
        placeCube(engine, kGround, { x, y: 1, z }, RAMP_ID);
      }
      if ((x * z) % 5 === 1) {
        placeCube(engine, kGround, { x, y: 2, z }, STAIR_ID);
      }
      if (x === z) {
        placeCube(engine, kGround, { x, y: 3, z }, LEAVES_ID);
      }
    }
  }
  for (let x = 0; x < 6; x++) {
    placeCube(engine, kWater, { x, y: 1, z: 5 });
  }
  engine.world.getLayer(kWater)!.opacity = 0.5;
  kEngines.add(engine);

  return engine;
}

async function makeWorkerWorld(
  workers: InProcessWorkers,
  options: VoxelEngineOptions = {}
): Promise<VoxelEngine> {
  const engine = makeWorld({
    ...options,
    meshWorkers: {
      createWorker: workers.createWorker,
      count: 2
    }
  });
  engine.init();
  await meshInWorkers(engine);

  return engine;
}

function mainThreadSnapshot(
  options: VoxelEngineOptions = {}
): ReturnType<typeof meshSnapshot> {
  const engine = makeWorld(options);
  engine.init();

  return meshSnapshot(engine);
}

describe("VoxelEngine - mesh workers", () => {
  afterEach(() => {
    for (const engine of kEngines) {
      engine.dispose();
    }
    kEngines.clear();
  });

  for (const options of [
    {},
    { greedy: true },
    { ambientOcclusion: 1 },
    { vertexPulling: true, ambientOcclusion: 1 }
  ] satisfies VoxelEngineOptions[]) {
    it(`builds the main-thread geometry with ${JSON.stringify(options)}`, async() => {
      const workers = inProcessWorkers();
      const engine = await makeWorkerWorld(workers, options);

      assert.ok(buildRequests(workers) > 0);
      assert.deepEqual(meshSnapshot(engine), mainThreadSnapshot(options));
    });
  }

  it("defers init meshing to the workers", async() => {
    const workers = inProcessWorkers();
    const engine = makeWorld({
      meshWorkers: { createWorker: workers.createWorker }
    });

    engine.init();
    assert.equal(chunkMeshes(engine).length, 0);

    engine.tick(0);
    assert.ok(engine.pendingRebuilds > 0);

    await meshInWorkers(engine);
    assert.equal(engine.pendingRebuilds, 0);
    assert.ok(chunkMeshes(engine).length > 0);
  });

  it("rebuilds a chunk edited while its worker build runs", async() => {
    const workers = inProcessWorkers();
    const engine = await makeWorkerWorld(workers);

    placeCube(engine, kGround, { x: 1, y: 5, z: 1 });
    engine.tick(0);
    engine.world.removeVoxel(kGround, { position: { x: 1, y: 0, z: 1 } });
    await meshInWorkers(engine);

    const expected = makeWorld();
    placeCube(expected, kGround, { x: 1, y: 5, z: 1 });
    expected.world.removeVoxel(kGround, { position: { x: 1, y: 0, z: 1 } });
    expected.init();
    assert.deepEqual(meshSnapshot(engine), meshSnapshot(expected));
  });

  it("rebuilds a chunk whose finished build read a neighbour edited since", async() => {
    const workers = inProcessWorkers();
    const engine = await makeWorkerWorld(workers);
    const sent = workers.requests.length;

    placeCube(engine, kGround, { x: 1, y: 2, z: 1 }, CUBE_ID);
    engine.tick(0);
    await setImmediate();
    placeCube(engine, kGround, { x: 5, y: 2, z: 1 }, CUBE_ID);
    await meshInWorkers(engine);

    const originBuilds = workers.requests.slice(sent).filter(
      (request) => request.type === "build" &&
        request.members.some(({ cx, cy, cz }) => cx === 0 && cy === 0 && cz === 0)
    );
    assert.equal(originBuilds.length, 2);

    const expected = makeWorld();
    placeCube(expected, kGround, { x: 1, y: 2, z: 1 }, CUBE_ID);
    placeCube(expected, kGround, { x: 5, y: 2, z: 1 }, CUBE_ID);
    expected.init();
    assert.deepEqual(meshSnapshot(engine), meshSnapshot(expected));
  });

  it("flushes synchronously and ignores the builds still running", async() => {
    const workers = inProcessWorkers();
    const engine = makeWorld({
      meshWorkers: { createWorker: workers.createWorker }
    });
    engine.init();
    engine.tick(0);

    engine.flush();
    const flushed = meshSnapshot(engine);
    assert.equal(engine.pendingRebuilds, 0);
    assert.deepEqual(flushed, mainThreadSnapshot());

    await meshInWorkers(engine);
    assert.deepEqual(meshSnapshot(engine), flushed);
  });

  it("rebuilds chunks whose running build used replaced block definitions", async() => {
    const workers = inProcessWorkers();
    const engine = makeWorld({
      meshWorkers: { createWorker: workers.createWorker }
    });
    const redefined = makeBlockDef(CUBE_ID, "cube", {
      defaultTexture: { col: 1, row: 0 }
    });
    engine.init();
    engine.tick(0);

    engine.blockRegistry.register(redefined);
    await meshInWorkers(engine);

    const expected = makeWorld();
    expected.blockRegistry.register(redefined);
    expected.init();
    assert.deepEqual(meshSnapshot(engine), meshSnapshot(expected));
  });

  it("falls back to the main thread when a worker crashes", async() => {
    const workers = inProcessWorkers();
    const errors: string[] = [];
    const logger = makeLogger();
    logger.error = (message) => void errors.push(message);
    const engine = makeWorld({
      logger,
      meshWorkers: { createWorker: workers.createWorker }
    });
    engine.init();
    engine.tick(0);

    workers.crash();
    engine.tick(0);

    assert.equal(errors.length, 1);
    assert.equal(engine.pendingRebuilds, 0);
    assert.deepEqual(meshSnapshot(engine), mainThreadSnapshot());
  });

  it("stays on the main thread without cross-origin isolation", (t) => {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
      value: false,
      configurable: true
    });
    t.after(() => Reflect.deleteProperty(globalThis, "crossOriginIsolated"));
    const workers = inProcessWorkers();
    const warnings: string[] = [];
    const engine = makeWorld({
      logger: makeLogger(warnings),
      meshWorkers: { createWorker: workers.createWorker }
    });

    engine.init();

    assert.equal(warnings.length, 1);
    assert.ok(chunkMeshes(engine).length > 0);
    assert.equal(workers.requests.length, 0);
  });
});
