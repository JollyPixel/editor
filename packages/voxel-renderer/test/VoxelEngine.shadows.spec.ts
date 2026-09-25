// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  VoxelEngine,
  VoxelEngineOptions
} from "../src/VoxelEngine.ts";
import {
  chunkMeshes,
  makeEngine as makeBaseEngine,
  placeCube
} from "./helpers/engine.ts";

function makeEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeBaseEngine({
    layers: ["Ground"],
    ...options
  });
  placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
  engine.tick(0);

  return engine;
}

function shadowFlags(
  engine: VoxelEngine
): Array<[boolean, boolean]> {
  return chunkMeshes(engine).map(
    (mesh) => [mesh.castShadow, mesh.receiveShadow]
  );
}

describe("VoxelEngine - shadows", () => {
  it("builds chunk meshes without shadows by default", () => {
    const engine = makeEngine();

    assert.equal(engine.castShadow, false);
    assert.equal(engine.receiveShadow, false);
    assert.ok(chunkMeshes(engine).length > 0);
    assert.deepEqual(
      new Set(shadowFlags(engine).flat()),
      new Set([false])
    );
  });

  it("applies the constructor flags to built chunk meshes", () => {
    const engine = makeEngine({
      castShadow: true,
      receiveShadow: true
    });

    assert.deepEqual(
      new Set(shadowFlags(engine).flat()),
      new Set([true])
    );
  });

  it("updates built chunk meshes when assigned", () => {
    const engine = makeEngine();

    engine.castShadow = true;
    assert.ok(shadowFlags(engine).every(([cast, receive]) => cast && !receive));

    engine.receiveShadow = true;
    engine.castShadow = false;
    assert.ok(shadowFlags(engine).every(([cast, receive]) => !cast && receive));
  });

  it("applies the assigned flags to chunks built afterwards", () => {
    const engine = makeEngine();
    engine.castShadow = true;
    engine.receiveShadow = true;

    placeCube(engine, "Ground", { x: 40, y: 0, z: 0 });
    engine.tick(0);

    assert.ok(chunkMeshes(engine).length > 1);
    assert.deepEqual(
      new Set(shadowFlags(engine).flat()),
      new Set([true])
    );
  });
});
