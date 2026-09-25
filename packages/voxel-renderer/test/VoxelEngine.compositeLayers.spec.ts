// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";

// CONSTANTS
const kMeshKey = /^voxel_chunk_((?:cell|layer:[^:]+):-?\d+,-?\d+,-?\d+)/;

function meshKeys(
  engine: VoxelEngine
): string[] {
  return chunkMeshes(engine)
    .map((mesh) => kMeshKey.exec(mesh.name)?.[1] ?? mesh.name)
    .sort();
}

function trianglesOf(
  engine: VoxelEngine
): number {
  return chunkMeshes(engine).reduce(
    (total, mesh) => total + (mesh.geometry.drawRange.count / 3),
    0
  );
}

function makeLayeredEngine(): VoxelEngine {
  const engine = makeEngine({ layers: ["Top", "Ground"] });
  placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
  placeCube(engine, "Top", { x: 1, y: 0, z: 0 });

  return engine;
}

function layerId(
  engine: VoxelEngine,
  name: string
): string {
  return engine.world.getLayer(name)!.id;
}

describe("VoxelEngine - composite layers", () => {
  it("draws the layers of one chunk cell in a single mesh", () => {
    const engine = makeLayeredEngine();

    engine.flush();

    assert.deepEqual(meshKeys(engine), ["cell:0,0,0"]);
    assert.equal(trianglesOf(engine), 20);
  });

  it("draws as many triangles as one layer holding every voxel", () => {
    const layered = makeLayeredEngine();
    const single = makeEngine({ layers: ["Ground"] });
    placeCube(single, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(single, "Ground", { x: 1, y: 0, z: 0 });

    layered.flush();
    single.flush();

    assert.equal(trianglesOf(layered), trianglesOf(single));
  });

  it("keeps a faded layer in its own mesh at the layer opacity", () => {
    const engine = makeLayeredEngine();
    engine.world.updateLayer("Ground", { opacity: 0.5 });

    engine.flush();

    const groundKey = `layer:${layerId(engine, "Ground")}:0,0,0`;
    assert.deepEqual(meshKeys(engine), ["cell:0,0,0", groundKey].sort());
    const faded = chunkMeshes(engine).find(
      (mesh) => mesh.name.startsWith(`voxel_chunk_${groundKey}`)
    )!;
    assert.equal((faded.material as THREE.Material).opacity, 0.5);
  });

  it("keeps a layer placed off the chunk grid in its own mesh", () => {
    const engine = makeLayeredEngine();
    engine.world.setLayerPosition("Ground", { x: 2, y: 0, z: 0 });

    engine.flush();

    assert.deepEqual(
      meshKeys(engine),
      ["cell:0,0,0", `layer:${layerId(engine, "Ground")}:0,0,0`].sort()
    );
  });

  it("rebuilds the cell without a layer chunk emptied of its voxels", () => {
    const engine = makeLayeredEngine();
    engine.tick(0);

    engine.world.removeVoxel("Top", { position: { x: 1, y: 0, z: 0 } });
    engine.tick(0);

    assert.deepEqual(meshKeys(engine), ["cell:0,0,0"]);
    assert.equal(trianglesOf(engine), 12);
  });

  it("removes the cell mesh once no layer draws in it", () => {
    const engine = makeLayeredEngine();
    engine.tick(0);

    engine.world.removeVoxel("Top", { position: { x: 1, y: 0, z: 0 } });
    engine.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    engine.tick(0);

    assert.deepEqual(chunkMeshes(engine), []);
  });

  it("moves a layer's faces to the cell of its new position", () => {
    const engine = makeLayeredEngine();
    engine.tick(0);

    engine.world.setLayerPosition("Top", { x: 4, y: 0, z: 0 });
    engine.tick(0);

    assert.deepEqual(meshKeys(engine), ["cell:0,0,0", "cell:1,0,0"]);
    assert.equal(trianglesOf(engine), 24);
  });

  it("hands a layer that fades over to its own mesh", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.tick(0);

    engine.world.updateLayer("Ground", { opacity: 0.5 });
    engine.tick(0);

    assert.deepEqual(
      meshKeys(engine),
      [`layer:${layerId(engine, "Ground")}:0,0,0`]
    );
  });

  it("rebuilds the cell without a hidden layer", () => {
    const engine = makeLayeredEngine();
    engine.tick(0);

    engine.world.updateLayer("Top", { visible: false });
    engine.tick(0);

    assert.deepEqual(meshKeys(engine), ["cell:0,0,0"]);
    assert.equal(trianglesOf(engine), 12);
  });

  it("rebuilds the cell without a removed layer", () => {
    const engine = makeLayeredEngine();
    engine.tick(0);

    engine.world.removeLayer("Top");
    engine.tick(0);

    assert.deepEqual(meshKeys(engine), ["cell:0,0,0"]);
    assert.equal(trianglesOf(engine), 12);
  });
});
