// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  chunkMeshes,
  makeView as makeBaseView,
  placeCube,
  type ViewTestOptions
} from "../helpers/view.ts";
import { expandPulled } from "../helpers/pulledFaces.ts";

// CONSTANTS
const kLit = 127;

function makeView(
  options: ViewTestOptions = {}
): VoxelView {
  const view = makeBaseView({
    layers: ["Ground"],
    ...options
  });
  placeCube(view, "Ground", { x: 1, y: 0, z: 1 });
  placeCube(view, "Ground", { x: 2, y: 1, z: 1 });
  view.tick(0);

  return view;
}

function shades(
  view: VoxelView
): Set<number> {
  const values = new Set<number>();
  for (const mesh of chunkMeshes(view)) {
    const normals = expandPulled(mesh.geometry).getAttribute("normal").array;
    for (let i = 3; i < normals.length; i += 4) {
      values.add(normals[i]);
    }
  }

  return values;
}

describe("VoxelView - ambient occlusion", () => {
  it("bakes nothing by default", () => {
    const view = makeView();

    assert.equal(view.lighting.ambientOcclusion, 0);
    assert.deepEqual(shades(view), new Set([kLit]));
  });

  it("bakes occlusion when constructed with a strength", () => {
    const view = makeView({ lighting: { ambientOcclusion: 0.6 } });

    assert.equal(view.lighting.ambientOcclusion, 0.6);
    assert.ok(shades(view).size > 1);
  });

  it("rebakes chunks when switched on or off, and clamps to 0-1", () => {
    const view = makeView();

    view.lighting.ambientOcclusion = 4;
    view.tick(0);
    assert.equal(view.lighting.ambientOcclusion, 1);
    assert.ok(shades(view).size > 1);

    view.lighting.ambientOcclusion = -1;
    view.tick(0);
    assert.equal(view.lighting.ambientOcclusion, 0);
    assert.deepEqual(shades(view), new Set([kLit]));
  });

  it("changes strength without rebuilding chunks", () => {
    const view = makeView({ lighting: { ambientOcclusion: 0.5 } });

    view.lighting.ambientOcclusion = 0.8;

    const dirty = [...view.document.world.getAllChunks()]
      .filter(({ chunk }) => chunk.dirty);
    assert.equal(view.lighting.ambientOcclusion, 0.8);
    assert.deepEqual(dirty, []);
  });
});
