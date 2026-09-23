// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../src/VoxelEngine.types.ts";
import {
  chunkMeshes,
  makeEngine as makeBaseEngine,
  placeCube
} from "./helpers/engine.ts";

// CONSTANTS
const kLit = 127;

function makeEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeBaseEngine({
    layers: ["Ground"],
    ...options
  });
  placeCube(engine, "Ground", { x: 1, y: 0, z: 1 });
  placeCube(engine, "Ground", { x: 2, y: 1, z: 1 });
  engine.tick(0);

  return engine;
}

function shades(
  engine: VoxelEngine
): Set<number> {
  const values = new Set<number>();
  for (const mesh of chunkMeshes(engine)) {
    const normals = (mesh.geometry as THREE.BufferGeometry)
      .getAttribute("normal").array;
    for (let i = 3; i < normals.length; i += 4) {
      values.add(normals[i]);
    }
  }

  return values;
}

describe("VoxelEngine - ambient occlusion", () => {
  it("bakes nothing by default", () => {
    const engine = makeEngine();

    assert.equal(engine.ambientOcclusion, 0);
    assert.deepEqual(shades(engine), new Set([kLit]));
  });

  it("bakes occlusion when constructed with a strength", () => {
    const engine = makeEngine({ ambientOcclusion: 0.6 });

    assert.equal(engine.ambientOcclusion, 0.6);
    assert.ok(shades(engine).size > 1);
  });

  it("rebakes chunks when switched on or off, and clamps to 0-1", () => {
    const engine = makeEngine();

    engine.ambientOcclusion = 4;
    engine.tick(0);
    assert.equal(engine.ambientOcclusion, 1);
    assert.ok(shades(engine).size > 1);

    engine.ambientOcclusion = -1;
    engine.tick(0);
    assert.equal(engine.ambientOcclusion, 0);
    assert.deepEqual(shades(engine), new Set([kLit]));
  });

  it("changes strength without rebuilding chunks", () => {
    const engine = makeEngine({ ambientOcclusion: 0.5 });

    engine.ambientOcclusion = 0.8;

    const dirty = [...engine.world.getAllChunks()]
      .filter(({ chunk }) => chunk.dirty);
    assert.equal(engine.ambientOcclusion, 0.8);
    assert.deepEqual(dirty, []);
  });
});
