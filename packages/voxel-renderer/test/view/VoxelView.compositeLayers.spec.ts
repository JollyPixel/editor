// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  chunkMeshes,
  faceCountOf,
  makeView,
  placeCube
} from "../helpers/view.ts";

// CONSTANTS
const kMeshKey = /^voxel_chunk_((?:cell|layer:[^:]+):-?\d+,-?\d+,-?\d+)/;

function meshKeys(
  view: VoxelView
): string[] {
  return chunkMeshes(view)
    .map((mesh) => kMeshKey.exec(mesh.name)?.[1] ?? mesh.name)
    .sort();
}

function facesOf(
  view: VoxelView
): number {
  return chunkMeshes(view).reduce(
    (total, mesh) => total + faceCountOf(mesh),
    0
  );
}

function makeLayeredView(): VoxelView {
  const view = makeView({ layers: ["Top", "Ground"] });
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
  placeCube(view, "Top", { x: 1, y: 0, z: 0 });

  return view;
}

function layerId(
  view: VoxelView,
  name: string
): string {
  return view.document.world.getLayer(name)!.id;
}

describe("VoxelView - composite layers", () => {
  it("draws the layers of one chunk cell in a single mesh", () => {
    const view = makeLayeredView();

    view.flush();

    assert.deepEqual(meshKeys(view), ["cell:0,0,0"]);
    assert.equal(facesOf(view), 10);
  });

  it("draws as many faces as one layer holding every voxel", () => {
    const layered = makeLayeredView();
    const single = makeView({ layers: ["Ground"] });
    placeCube(single, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(single, "Ground", { x: 1, y: 0, z: 0 });

    layered.flush();
    single.flush();

    assert.equal(facesOf(layered), facesOf(single));
  });

  it("keeps a layer placed off the chunk grid in its own mesh", () => {
    const view = makeLayeredView();
    view.document.world.setLayerPosition("Ground", { x: 2, y: 0, z: 0 });

    view.flush();

    assert.deepEqual(
      meshKeys(view),
      ["cell:0,0,0", `layer:${layerId(view, "Ground")}:0,0,0`].sort()
    );
  });

  it("rebuilds the cell without a layer chunk emptied of its voxels", () => {
    const view = makeLayeredView();
    view.tick(0);

    view.document.world.removeVoxel("Top", { position: { x: 1, y: 0, z: 0 } });
    view.tick(0);

    assert.deepEqual(meshKeys(view), ["cell:0,0,0"]);
    assert.equal(facesOf(view), 6);
  });

  it("removes the cell mesh once no layer draws in it", () => {
    const view = makeLayeredView();
    view.tick(0);

    view.document.world.removeVoxel("Top", { position: { x: 1, y: 0, z: 0 } });
    view.document.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    view.tick(0);

    assert.deepEqual(chunkMeshes(view), []);
  });

  it("moves a layer's faces to the cell of its new position", () => {
    const view = makeLayeredView();
    view.tick(0);

    view.document.world.setLayerPosition("Top", { x: 4, y: 0, z: 0 });
    view.tick(0);

    assert.deepEqual(meshKeys(view), ["cell:0,0,0", "cell:1,0,0"]);
    assert.equal(facesOf(view), 12);
  });

  it("rebuilds the cell without a hidden layer", () => {
    const view = makeLayeredView();
    view.tick(0);

    view.document.world.updateLayer("Top", { visible: false });
    view.tick(0);

    assert.deepEqual(meshKeys(view), ["cell:0,0,0"]);
    assert.equal(facesOf(view), 6);
  });

  it("rebuilds the cell without a removed layer", () => {
    const view = makeLayeredView();
    view.tick(0);

    view.document.world.removeLayer("Top");
    view.tick(0);

    assert.deepEqual(meshKeys(view), ["cell:0,0,0"]);
    assert.equal(facesOf(view), 6);
  });
});
