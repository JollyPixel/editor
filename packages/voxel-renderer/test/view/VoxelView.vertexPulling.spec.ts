// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  PulledChunkGeometry,
  PulledChunkMesh
} from "../../src/view/meshing/index.ts";
import {
  chunkMeshes,
  makeView,
  placeCube,
  type ViewTestOptions
} from "../helpers/view.ts";
import { CHUNK_SIZE } from "../helpers/ids.ts";
import { overlayMeshes } from "./inspector/VoxelInspector.helpers.ts";

function makePulledView(
  options: ViewTestOptions = {}
): VoxelView {
  const view = makeView({
    layers: ["Ground"],
    meshing: { budgetMs: 0 },
    ...options
  });
  placeCube(view, "Ground", { x: 1, y: 0, z: 1 });
  placeCube(view, "Ground", { x: 2, y: 0, z: 1 });
  view.flush();

  return view;
}

function positionNodeOf(
  mesh: THREE.Mesh
): unknown {
  return (mesh.material as { positionNode?: unknown; }).positionNode ?? null;
}

describe("VoxelView - pulled chunk meshes", () => {
  it("draws every chunk as a pulled mesh whose material pulls the vertices", () => {
    const view = makePulledView();
    const meshes = chunkMeshes(view);

    assert.ok(meshes.length > 0);
    for (const mesh of meshes) {
      assert.ok(mesh instanceof PulledChunkMesh);
      assert.ok(positionNodeOf(mesh) !== null);
    }
  });

  it("wires overlays to an expanded copy it disposes with the overlay", () => {
    const view = makePulledView({ inspector: { mode: "overlay" } });
    const [mesh] = chunkMeshes(view);
    const [overlay] = overlayMeshes(view);
    let disposed = false;
    overlay.geometry.addEventListener("dispose", () => {
      disposed = true;
    });

    assert.notEqual(overlay.geometry, mesh.geometry);
    assert.equal(overlay.geometry.getIndex()!.count, 10 * 6);

    view.inspector.mode = "off";
    assert.equal(disposed, true);
  });

  it("shares one face template table and material across chunks", () => {
    const view = makePulledView();
    placeCube(view, "Ground", { x: 3 * CHUNK_SIZE, y: 0, z: 0 });
    view.flush();

    const [near, far] = [...chunkMeshes(view)]
      .sort((a, b) => a.position.x - b.position.x);
    assert.ok(near.geometry instanceof PulledChunkGeometry);
    assert.ok(far.geometry instanceof PulledChunkGeometry);
    assert.notEqual(near.geometry, far.geometry);
    assert.equal(near.geometry.templates, far.geometry.templates);
    assert.equal(near.material, far.material);
  });
});
