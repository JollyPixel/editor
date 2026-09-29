// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelTransform } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  TemplateStore,
  type TemplatePlacement
} from "../../src/state/TemplateStore.ts";

function placingStore(): TemplateStore {
  const store = new TemplateStore();
  store.beginPlacement("house", { x: 4, y: 0, z: -2 });

  return store;
}

describe("TemplateStore placement", () => {
  test("begins on a rounded cell, untransformed, and selects the template", () => {
    const store = new TemplateStore();
    store.beginPlacement("house", { x: 3.6, y: 0.2, z: -1.5 });

    assert.equal(store.selected, "house");
    assert.equal(store.placing, true);
    assert.deepEqual(store.placement?.position, { x: 4, y: 0, z: -1 });
    assert.equal(store.placement?.transform, VoxelTransform.Identity);
  });

  test("moves to a new cell and ignores moves within the same cell", () => {
    const store = placingStore();
    const changes: Array<TemplatePlacement | null> = [];
    store.subscribe("placementChange", (placement) => changes.push(placement));

    store.movePlacement({ x: 4.2, y: 0, z: -2 });
    store.movePlacement({ x: 6, y: 1, z: -2 });

    assert.equal(changes.length, 1);
    assert.deepEqual(store.placement?.position, { x: 6, y: 1, z: -2 });
  });

  test("composes transforms after the current one", () => {
    const store = placingStore();

    store.transformPlacement({ rotation: 1 });
    store.transformPlacement({ rotation: 1 });
    store.transformPlacement({ flipY: true });

    const expected = VoxelTransform.fromPacked(
      VoxelTransform.pack({ rotation: 2, flipY: true })
    );
    assert.ok(store.placement?.transform.equals(expected));
  });

  test("ignores identity transforms and edits without a placement", () => {
    const store = new TemplateStore();
    const changes: Array<TemplatePlacement | null> = [];
    store.subscribe("placementChange", (placement) => changes.push(placement));

    store.movePlacement({ x: 1, y: 1, z: 1 });
    store.transformPlacement({ rotation: 1 });
    store.beginPlacement("house", { x: 0, y: 0, z: 0 });
    store.transformPlacement({ rotation: 4 });

    assert.equal(changes.length, 1);
  });

  test("ending clears the placement and the drag state but keeps the selection", () => {
    const store = placingStore();
    store.dragging = true;

    store.endPlacement();

    assert.equal(store.placement, null);
    assert.equal(store.dragging, false);
    assert.equal(store.selected, "house");
  });
});

describe("TemplateStore.reconcile", () => {
  test("drops the selection and placement of a removed template", () => {
    const store = placingStore();

    store.reconcile(["tree"]);

    assert.equal(store.selected, null);
    assert.equal(store.placement, null);
  });

  test("keeps both while the template still exists", () => {
    const store = placingStore();

    store.reconcile(["house", "tree"]);

    assert.equal(store.selected, "house");
    assert.notEqual(store.placement, null);
  });
});
