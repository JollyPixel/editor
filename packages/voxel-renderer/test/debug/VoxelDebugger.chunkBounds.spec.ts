// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../../src/VoxelEngine.types.ts";
import { VoxelDebugger } from "../../src/debug/index.ts";
import { MeshBuildStats } from "../../src/mesh/index.ts";
import { ViewDistance } from "../../src/world/index.ts";
import {
  makeEngine as makeBaseEngine,
  fillChunks,
  CUBE_ID as kCubeId,
  CHUNK_SIZE as kChunkSize
} from "../helpers/engine.ts";
import {
  findDebugGroup,
  makeDebugEngine
} from "./VoxelDebugger.helpers.ts";

function findBoundsGroup(
  engine: VoxelEngine
): THREE.Object3D | undefined {
  return engine.root.children.find(
    (child) => child.name === "VoxelDebugger:chunkBounds"
  );
}

/**
 * Four chunks along +X, a one-chunk radius, and focus on the first one. Only
 * chunks 0 and 1 are built until moving focus to the far end swaps the pair.
 */
function makeCulledEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeBaseEngine({
    layers: ["Ground"],
    debug: { chunkBounds: true },
    /*
     * Drain the whole queue: the assertions expect every admitted chunk to be
     * meshed and registered by the end of a single tick.
     */
    rebuildBudgetMs: 0,
    viewDistance: {
      chunks: 1,
      hysteresis: 0
    },
    ...options
  });
  fillChunks(engine, "Ground", 4);
  engine.focus = { x: 2, y: 2, z: 2 };
  engine.tick(0);

  return engine;
}

/**
 * Same viewport fixture without a tileset, so every admitted chunk builds no
 * geometry but still participates in visibility and debugger lifecycles.
 */
function makeMeshlessCulledEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize: kChunkSize,
    layers: ["Ground"],
    debug: { chunkBounds: true },
    rebuildBudgetMs: 0,
    viewDistance: {
      chunks: 1,
      hysteresis: 0
    },
    ...options
  });
  fillChunks(engine, "Ground", 4);
  engine.focus = { x: 2, y: 2, z: 2 };
  engine.tick(0);

  return engine;
}

/**
 * Chunk coordinates of the drawn boxes, layer prefix stripped, sorted.
 */
function boundsKeys(
  engine: VoxelEngine
): string[] {
  return boundsBoxes(engine)
    .map((box) => box.name.split(":")[1])
    .sort();
}

function boundsBoxes(
  engine: VoxelEngine
): THREE.LineSegments[] {
  const group = findBoundsGroup(engine);
  assert.ok(group, "the bounds group must be attached to the engine root");

  return group.children.filter(
    (child): child is THREE.LineSegments => child instanceof THREE.LineSegments
  );
}

describe("VoxelDebugger - chunk bounds", () => {
  it("is off by default and leaves nothing in the scene graph", () => {
    const engine = makeDebugEngine();

    assert.equal(engine.debug.chunkBounds, false);
    assert.equal(findBoundsGroup(engine), undefined);
  });

  it("outlines one box per chunk, independently of the mode", () => {
    const engine = makeDebugEngine();
    engine.debug.chunkBounds = true;

    assert.equal(engine.debug.mode, "off");
    assert.equal(boundsBoxes(engine).length, 1);
    assert.equal(findDebugGroup(engine), undefined);
  });

  it("places the box on the chunk origin, scaled to the chunk size", () => {
    const engine = makeDebugEngine({ debug: { chunkBounds: true } });
    fillChunks(engine, "Ground", 3);
    engine.tick(0);

    const origins = boundsBoxes(engine)
      .map((box) => box.position.x)
      .sort((a, b) => a - b);

    assert.deepEqual(origins, [0, kChunkSize, kChunkSize * 2]);
    for (const box of boundsBoxes(engine)) {
      assert.equal(box.position.y, 0);
      assert.equal(box.position.z, 0);
      assert.equal(box.scale.x, kChunkSize);
      assert.equal(box.scale.y, kChunkSize);
      assert.equal(box.scale.z, kChunkSize);
    }
  });

  it("shifts the box by the layer offset", () => {
    const engine = makeBaseEngine({ debug: { chunkBounds: true } });
    engine.world.addLayer("Shifted").offset = { x: 10, y: 20, z: 30 };
    engine.world.setVoxel("Shifted", {
      position: { x: 10, y: 20, z: 30 },
      blockId: kCubeId
    });
    engine.tick(0);

    const [box] = boundsBoxes(engine);
    assert.ok(box);
    assert.deepEqual(
      [box.position.x, box.position.y, box.position.z],
      [10, 20, 30]
    );
  });

  it("copies bounds passed to registerChunk", () => {
    const parent = new THREE.Group();
    const debug = new VoxelDebugger(parent, { chunkBounds: true });
    const origin = { x: 1, y: 2, z: 3 };

    debug.registerChunk(
      "chunk",
      [],
      new MeshBuildStats(),
      { origin, size: 4 }
    );
    origin.x = 99;
    debug.chunkBounds = false;
    debug.chunkBounds = true;

    const group = parent.children.find(
      (child) => child.name === "VoxelDebugger:chunkBounds"
    );
    assert.ok(group);
    const [box] = group.children;
    assert.ok(box instanceof THREE.LineSegments);
    assert.deepEqual(
      [box.position.x, box.position.y, box.position.z],
      [1, 2, 3]
    );
    assert.equal(box.scale.x, 4);
  });

  it("outlines a chunk that produced no geometry", () => {
    // No tileset is loaded, so the chunk is registered without any mesh.
    const engine = new VoxelEngine({
      chunkSize: kChunkSize,
      layers: ["Ground"],
      debug: { chunkBounds: true }
    });
    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: kCubeId
    });
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 1);
    assert.equal(engine.debug.stats.meshes, 0);
    assert.equal(boundsBoxes(engine).length, 1);
  });

  it("hides meshless chunk bounds outside the view distance", () => {
    const engine = makeMeshlessCulledEngine();
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 4);
    assert.equal(engine.debug.stats.culledChunks, 2);
    assert.deepEqual(boundsKeys(engine), ["2,0,0", "3,0,0"]);
  });

  it("unloads meshless chunk bounds outside the view distance", () => {
    const engine = makeMeshlessCulledEngine({
      viewDistancePolicy: "unload"
    });
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 2);
    assert.deepEqual(boundsKeys(engine), ["2,0,0", "3,0,0"]);
  });

  it("drops the box of a chunk hidden by the view distance", () => {
    const engine = makeCulledEngine();
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 4);
    assert.equal(engine.debug.stats.culledChunks, 2);
    assert.deepEqual(boundsKeys(engine), ["2,0,0", "3,0,0"]);
  });

  it("brings the box back when the chunk is shown again", () => {
    const engine = makeCulledEngine();
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(boundsKeys(engine), ["0,0,0", "1,0,0"]);
  });

  it("drops the box of a chunk the unload policy disposes", () => {
    const engine = makeCulledEngine({ viewDistancePolicy: "unload" });
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 2);
    assert.deepEqual(boundsKeys(engine), ["2,0,0", "3,0,0"]);
  });

  it("outlines every chunk again once the view distance is lifted", () => {
    const engine = makeCulledEngine();
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    engine.viewDistance = ViewDistance.Unlimited;
    engine.tick(0);

    assert.deepEqual(
      boundsKeys(engine),
      ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]
    );
  });

  it("shares one geometry and one material across every box", () => {
    const engine = makeDebugEngine({ debug: { chunkBounds: true } });
    fillChunks(engine, "Ground", 3);
    engine.tick(0);

    const boxes = boundsBoxes(engine);
    assert.equal(boxes.length, 3);
    for (const box of boxes) {
      assert.equal(box.geometry, boxes[0].geometry);
      assert.equal(box.material, boxes[0].material);
    }
  });

  it("drops the box of a chunk whose layer is removed", () => {
    const engine = makeDebugEngine({ debug: { chunkBounds: true } });
    engine.world.removeLayer("Ground");
    engine.tick(0);

    assert.equal(boundsBoxes(engine).length, 0);
  });

  it("adds and removes the boxes as the toggle flips", () => {
    const engine = makeDebugEngine();

    engine.debug.chunkBounds = true;
    assert.equal(boundsBoxes(engine).length, 1);

    engine.debug.chunkBounds = false;
    assert.equal(findBoundsGroup(engine), undefined);

    engine.debug.chunkBounds = true;
    assert.equal(boundsBoxes(engine).length, 1);
  });

  it("detaches the bounds group on dispose", () => {
    const engine = makeDebugEngine({ debug: { chunkBounds: true } });
    engine.dispose();

    assert.equal(findBoundsGroup(engine), undefined);
  });
});
