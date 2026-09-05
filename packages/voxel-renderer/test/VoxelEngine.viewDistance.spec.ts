// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../src/VoxelEngine.types.ts";
import { ViewDistance } from "../src/world/index.ts";
import type { VoxelCollider } from "../src/collision/index.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId,
  CHUNK_SIZE as kChunkSize
} from "./helpers/engine.ts";

// CONSTANTS
const kLayer = "Ground";

/**
 * One voxel in each of `count` chunks along +X, so chunk `i` is centered on
 * `x = (i * 4) + 2`.
 */
function makeEngine(
  count: number,
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeBaseEngine({
    layers: [kLayer],
    rebuildBudgetMs: 0,
    ...options
  });

  for (let i = 0; i < count; i++) {
    engine.world.setVoxel(kLayer, {
      position: { x: i * kChunkSize, y: 0, z: 0 },
      blockId: kCubeId
    });
  }

  return engine;
}

function builtChunks(
  engine: VoxelEngine
): string[] {
  return engine.root.children
    .map((mesh) => mesh.name.split(":")[1])
    .sort();
}

function visibleChunks(
  engine: VoxelEngine
): string[] {
  return engine.root.children
    .filter((mesh) => mesh.visible)
    .map((mesh) => mesh.name.split(":")[1])
    .sort();
}

function chunkOf(
  engine: VoxelEngine,
  cx: number
) {
  return engine.world.getLayer(kLayer)!.getChunk(cx, 0, 0)!;
}

describe("VoxelEngine — view distance", () => {
  it("meshes every chunk when unlimited", () => {
    const engine = makeEngine(4);
    engine.focus = { x: 2, y: 2, z: 2 };

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
  });

  it("meshes every chunk while no focus is set", () => {
    const engine = makeEngine(4, { viewDistance: 1 });

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
  });

  it("leaves chunks beyond the view distance unmeshed and dirty", () => {
    const engine = makeEngine(4, { viewDistance: 1 });
    engine.focus = { x: 2, y: 2, z: 2 };

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0"]);
    assert.equal(chunkOf(engine, 2).dirty, true);
    assert.equal(chunkOf(engine, 3).dirty, true);
  });

  it("meshes a chunk with the edits it missed once the focus reaches it", () => {
    const engine = makeEngine(4, { viewDistance: 1 });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    engine.world.setVoxel(kLayer, {
      position: { x: 13, y: 1, z: 0 },
      blockId: kCubeId
    });
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.ok(builtChunks(engine).includes("3,0,0"));
    assert.equal(chunkOf(engine, 3).dirty, false);
    assert.equal(chunkOf(engine, 3).voxelCount, 2);
  });

  it("ignores the vertical axis by default", () => {
    const engine = makeEngine(2, { viewDistance: 1 });
    engine.focus = { x: 2, y: 400, z: 2 };

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0"]);
  });

  it("measures the vertical axis in sphere shape", () => {
    const engine = makeEngine(2, {
      viewDistance: {
        chunks: 1,
        shape: "sphere"
      }
    });
    engine.focus = { x: 2, y: 400, z: 2 };

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), []);
  });

  it("hides a built chunk that leaves the view distance", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    // Hidden, not disposed: the geometry is still attached to the root.
    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
    assert.deepEqual(visibleChunks(engine), ["2,0,0", "3,0,0"]);
    assert.equal(engine.debug.stats.culledChunks, 2);
  });

  it("shows a hidden chunk again when the focus comes back", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(visibleChunks(engine), ["0,0,0", "1,0,0"]);
    assert.equal(engine.debug.stats.culledChunks, 2);
  });

  it("keeps a chunk inside the hysteresis slack visible", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 1
      }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    // Chunk 0 is 8 units away: outside the admit radius, inside the retain
    // radius, so it must not flip.
    engine.focus = { x: 10, y: 2, z: 2 };
    engine.tick(0);

    assert.ok(visibleChunks(engine).includes("0,0,0"));
  });

  it("disposes a chunk leaving the view distance under the unload policy", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      },
      viewDistancePolicy: "unload"
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["2,0,0", "3,0,0"]);
    assert.equal(chunkOf(engine, 0).dirty, true);
  });

  it("remeshes an unloaded chunk when it comes back into view", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      },
      viewDistancePolicy: "unload"
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0"]);
  });

  it("keeps colliders for chunks the view distance unloads", () => {
    const live = new Set<string>();
    function collider(): VoxelCollider {
      return {
        rebuildChunk: (key) => void live.add(key),
        removeChunk: (key) => void live.delete(key),
        dispose: () => void 0
      };
    }

    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      },
      viewDistancePolicy: "unload",
      collider
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    const near = [...live];
    assert.equal(near.length, 2);

    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["2,0,0", "3,0,0"]);
    assert.ok(near.every((key) => live.has(key)));
  });

  it("restores every hidden chunk when the view distance becomes unlimited", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);
    assert.equal(engine.debug.stats.culledChunks, 2);

    engine.viewDistance = ViewDistance.Unlimited;
    engine.tick(0);

    assert.deepEqual(visibleChunks(engine), ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
    assert.equal(engine.debug.stats.culledChunks, 0);
  });

  it("applies a widened view distance without waiting for the focus to move", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0"]);

    engine.viewDistance = new ViewDistance({
      chunks: 4,
      hysteresis: 0
    });
    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
  });

  it("accounts for the layer offset", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      }
    });
    engine.world.setLayerOffset(kLayer, { x: 100, y: 0, z: 0 });
    engine.focus = { x: 102, y: 2, z: 2 };

    engine.tick(0);

    assert.deepEqual(builtChunks(engine), ["0,0,0", "1,0,0"]);
  });

  it("hides chunks from the wireframe overlay too", () => {
    const engine = makeEngine(4, {
      viewDistance: {
        chunks: 1,
        hysteresis: 0
      },
      debug: { mode: "overlay" }
    });
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);
    function overlays(): number {
      return engine.root
        .getObjectByName("VoxelDebugger")!
        .children.length;
    }
    assert.equal(overlays(), 2);

    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(overlays(), 2);
    assert.deepEqual(
      (engine.root.getObjectByName("VoxelDebugger")!.children as THREE.Object3D[])
        .map((overlay) => overlay.name.split(":")[1])
        .sort(),
      ["2,0,0", "3,0,0"]
    );
  });
});
