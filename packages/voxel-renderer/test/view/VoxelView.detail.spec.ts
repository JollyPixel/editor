// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  chunkMeshes,
  fillChunks,
  makeView,
  type ViewTestOptions
} from "../helpers/view.ts";
import {
  CHUNK_SIZE as kChunkSize,
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "../helpers/ids.ts";

// CONSTANTS
const kLayer = "Ground";
const kNear = { x: 2, y: 2, z: 2 };
const kLastChunkX = 3 * kChunkSize;

function makeDetailView(
  options: ViewTestOptions = {}
): VoxelView {
  const view = makeView({
    layers: [kLayer],
    meshing: { budgetMs: 0 },
    blocks: [
      makeBlockDef(kCubeId, "cube"),
      makeBlockDef(kLeavesId, "cube", { alphaMode: "blend" })
    ],
    ...options
  });
  fillChunks(view, kLayer, 4);
  view.focus = kNear;

  return view;
}

function meshAt(
  view: VoxelView,
  x: number
): THREE.Mesh {
  const mesh = chunkMeshes(view).find((candidate) => candidate.position.x === x);
  assert.ok(mesh, `a chunk mesh must sit at x=${x}`);

  return mesh;
}

describe("VoxelView - far materials", () => {
  it("draws every chunk with the same materials without a far distance", () => {
    const view = makeDetailView();
    view.flush();

    assert.equal(meshAt(view, 0).material, meshAt(view, kLastChunkX).material);
  });

  it("gives chunks beyond farDistance a material of their own", () => {
    const view = makeDetailView({ range: { farDistance: 1.5 } });
    view.flush();

    assert.equal(meshAt(view, 0).material, meshAt(view, kChunkSize).material);
    assert.notEqual(meshAt(view, 0).material, meshAt(view, kLastChunkX).material);
  });

  it("draws far blend blocks opaque", () => {
    const view = makeDetailView({ range: { farDistance: 1.5 } });
    fillChunks(view, kLayer, 4, kLeavesId);
    view.flush();

    const near = meshAt(view, 0).material as THREE.Material;
    const far = meshAt(view, kLastChunkX).material as THREE.Material;
    assert.equal(near.transparent, true);
    assert.equal(far.transparent, false);
    assert.equal(far.depthWrite, true);
  });

  it("swaps materials without remeshing when the focus moves", () => {
    const view = makeDetailView({ range: { farDistance: 1.5 } });
    view.flush();
    const nearMaterial = meshAt(view, 0).material;
    const farMesh = meshAt(view, kLastChunkX);

    view.focus = { x: kLastChunkX + 2, y: 2, z: 2 };
    view.tick(0);

    assert.equal(meshAt(view, kLastChunkX), farMesh);
    assert.equal(farMesh.material, nearMaterial);
    assert.notEqual(meshAt(view, 0).material, nearMaterial);
  });

  it("restores full detail once the far distance is lifted", () => {
    const view = makeDetailView({ range: { farDistance: 1.5 } });
    view.flush();

    view.range.farDistance = Infinity;
    view.tick(0);

    assert.equal(meshAt(view, 0).material, meshAt(view, kLastChunkX).material);
  });
});
