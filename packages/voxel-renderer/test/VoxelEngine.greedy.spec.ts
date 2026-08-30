// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import { mockTexture } from "./helpers/mockTexture.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { makeAtlasDef } from "./helpers/atlas.ts";

// CONSTANTS
const kCubeId = 1;
const kLayer = "Ground";

function makeEngine(
  greedy: boolean
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize: 4,
    layers: [kLayer],
    greedy,
    blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ]
  });
  engine.loadTileset(
    makeAtlasDef(),
    mockTexture()
  );

  // A 4×4 plate, which merges into 6 quads.
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      engine.setVoxel(kLayer, {
        position: { x, y: 0, z },
        blockId: kCubeId
      });
    }
  }
  engine.tick(0);

  return engine;
}

function triangles(
  engine: VoxelEngine
): number {
  let count = 0;
  engine.root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      count += object.geometry.getIndex()?.count ?? 0;
    }
  });

  return count / 3;
}

function materials(
  engine: VoxelEngine
): THREE.Material[] {
  const found: THREE.Material[] = [];
  engine.root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.Material) {
      found.push(object.material);
    }
  });

  return found;
}

/** `enableTileWrapping` assigns `colorNode` (a TSL node, not `THREE.Material` API). */
function colorNodeOf(
  material: THREE.Material
): unknown {
  return (material as { colorNode?: unknown; }).colorNode;
}

describe("VoxelEngine — greedy meshing", () => {
  it("is off by default", () => {
    assert.equal(new VoxelEngine().greedy, false);
  });

  it("cuts the triangle count of a flat plate", () => {
    // 48 voxel faces vs 6 merged quads, two triangles each.
    assert.equal(triangles(makeEngine(false)), 96);
    assert.equal(triangles(makeEngine(true)), 12);
  });

  it("prepares chunk materials to repeat a tile across a merged quad", () => {
    for (const material of materials(makeEngine(true))) {
      assert.notEqual(colorNodeOf(material), undefined);
    }
  });

  it("leaves the material untouched when off", () => {
    for (const material of materials(makeEngine(false))) {
      assert.equal(colorNodeOf(material), undefined);
    }
  });

  it("reports the folded faces through the debugger", () => {
    const engine = makeEngine(true);

    assert.equal(engine.debug.stats.faces, 6);
    assert.equal(engine.debug.stats.mergedFaces, 42);
  });

  it("rebuilds the world when toggled at runtime", () => {
    const engine = makeEngine(false);
    assert.equal(triangles(engine), 96);

    engine.greedy = true;
    engine.tick(0);
    assert.equal(engine.greedy, true);
    assert.equal(triangles(engine), 12);

    engine.greedy = false;
    engine.tick(0);
    assert.equal(triangles(engine), 96);
  });

  it("swaps the materials when toggled so geometry and shader stay in step", () => {
    const engine = makeEngine(true);
    engine.greedy = false;
    engine.tick(0);

    for (const material of materials(engine)) {
      assert.notEqual(
        material.customProgramCacheKey(),
        "jolly-pixel:tile-wrap"
      );
    }
  });
});
