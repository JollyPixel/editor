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

function makeView(
  options: ViewTestOptions = {}
): VoxelView {
  const view = makeBaseView({
    layers: ["Ground"],
    ...options
  });
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
  view.tick(0);

  return view;
}

function shadowFlags(
  view: VoxelView
): Array<[boolean, boolean]> {
  return chunkMeshes(view).map(
    (mesh) => [mesh.castShadow, mesh.receiveShadow]
  );
}

describe("VoxelView - shadows", () => {
  it("builds chunk meshes without shadows by default", () => {
    const view = makeView();

    assert.equal(view.lighting.castShadow, false);
    assert.equal(view.lighting.receiveShadow, false);
    assert.ok(chunkMeshes(view).length > 0);
    assert.deepEqual(
      new Set(shadowFlags(view).flat()),
      new Set([false])
    );
  });

  it("applies the constructor flags to built chunk meshes", () => {
    const view = makeView({
      lighting: {
        castShadow: true,
        receiveShadow: true
      }
    });

    assert.deepEqual(
      new Set(shadowFlags(view).flat()),
      new Set([true])
    );
  });

  it("updates built chunk meshes when assigned", () => {
    const view = makeView();

    view.lighting.castShadow = true;
    assert.ok(shadowFlags(view).every(([cast, receive]) => cast && !receive));

    view.lighting.receiveShadow = true;
    view.lighting.castShadow = false;
    assert.ok(shadowFlags(view).every(([cast, receive]) => !cast && receive));
  });

  it("applies the assigned flags to chunks built afterwards", () => {
    const view = makeView();
    view.lighting.castShadow = true;
    view.lighting.receiveShadow = true;

    placeCube(view, "Ground", { x: 40, y: 0, z: 0 });
    view.tick(0);

    assert.ok(chunkMeshes(view).length > 1);
    assert.deepEqual(
      new Set(shadowFlags(view).flat()),
      new Set([true])
    );
  });
});
