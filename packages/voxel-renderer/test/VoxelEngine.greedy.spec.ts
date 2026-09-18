// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import {
  chunkMeshes,
  makeEngine as makeBaseEngine,
  placeCube
} from "./helpers/engine.ts";

function makeEngine(
  greedy: boolean
): VoxelEngine {
  const engine = makeBaseEngine({ layers: ["Ground"], greedy });
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      placeCube(engine, "Ground", { x, y: 0, z });
    }
  }
  engine.tick(0);

  return engine;
}

function triangles(
  engine: VoxelEngine
): number {
  return chunkMeshes(engine)
    .reduce((count, mesh) => count + (mesh.geometry.drawRange.count / 3), 0);
}

function materials(
  engine: VoxelEngine
): Set<THREE.Material | THREE.Material[]> {
  return new Set(chunkMeshes(engine).map((mesh) => mesh.material));
}

function programKeyOf(
  material: THREE.Material | THREE.Material[]
): string {
  assert.ok(!Array.isArray(material));

  return material.customProgramCacheKey();
}

describe("VoxelEngine - greedy meshing", () => {
  it("is off by default", () => {
    assert.equal(new VoxelEngine().greedy, false);
  });

  it("rebuilds the world when toggled at runtime", () => {
    const engine = makeEngine(false);
    const naive = triangles(engine);

    engine.greedy = true;
    engine.tick(0);
    assert.equal(engine.greedy, true);
    assert.ok(triangles(engine) < naive);

    engine.greedy = false;
    engine.tick(0);
    assert.equal(triangles(engine), naive);
  });

  it("swaps the chunk materials so geometry and shader stay in step", () => {
    const engine = makeEngine(true);
    const merged = materials(engine);
    const mergedPrograms = new Set([...merged].map(programKeyOf));

    engine.greedy = false;
    engine.tick(0);

    for (const material of materials(engine)) {
      assert.equal(merged.has(material), false);
      assert.equal(mergedPrograms.has(programKeyOf(material)), false);
    }
  });
});
