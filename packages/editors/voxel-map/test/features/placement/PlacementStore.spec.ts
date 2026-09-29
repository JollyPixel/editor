// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelTransform,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { PlacementStore } from "../../../src/features/placement/PlacementStore.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../src/features/placement/PlacementSource.ts";
import type { Placement } from "../../../src/features/placement/Placement.ts";

// CONSTANTS
const kHouse = new TemplateSource("house");

function placingStore(): PlacementStore {
  const store = new PlacementStore();
  store.begin(kHouse, { x: 4, y: 0, z: -2 });

  return store;
}

describe("PlacementStore", () => {
  test("begins on a rounded cell, untransformed", () => {
    const store = new PlacementStore();
    store.begin(kHouse, { x: 3.6, y: 0.2, z: -1.5 });

    assert.equal(store.placing, true);
    assert.equal(store.placement?.source, kHouse);
    assert.deepEqual(store.placement?.position, { x: 4, y: 0, z: -1 });
    assert.equal(store.placement?.transform, VoxelTransform.Identity);
  });

  test("moves to a new cell and ignores moves within the same cell", () => {
    const store = placingStore();
    const changes: Array<Placement | null> = [];
    store.subscribe("change", (placement) => changes.push(placement));

    store.move({ x: 4.2, y: 0, z: -2 });
    store.move({ x: 6, y: 1, z: -2 });

    assert.equal(changes.length, 1);
    assert.deepEqual(store.placement?.position, { x: 6, y: 1, z: -2 });
  });

  test("composes transforms after the current one", () => {
    const store = placingStore();

    store.transform({ rotation: 1 });
    store.transform({ rotation: 1 });
    store.transform({ flipY: true });

    const expected = VoxelTransform.fromPacked(
      VoxelTransform.pack({ rotation: 2, flipY: true })
    );
    assert.ok(store.placement?.transform.equals(expected));
  });

  test("ignores identity transforms and edits without a placement", () => {
    const store = new PlacementStore();
    const changes: Array<Placement | null> = [];
    store.subscribe("change", (placement) => changes.push(placement));

    store.move({ x: 1, y: 1, z: 1 });
    store.transform({ rotation: 1 });
    store.begin(kHouse, { x: 0, y: 0, z: 0 });
    store.transform({ rotation: 4 });

    assert.equal(changes.length, 1);
  });

  test("ending clears the placement once", () => {
    const store = placingStore();
    const changes: Array<Placement | null> = [];
    store.subscribe("change", (placement) => changes.push(placement));

    store.end();
    store.end();

    assert.equal(store.placement, null);
    assert.deepEqual(changes, [null]);
  });
});

describe("PlacementStore.reconcile", () => {
  test("ends the placement of a removed template", () => {
    const store = placingStore();

    store.reconcile(new VoxelWorld());

    assert.equal(store.placement, null);
  });

  test("ends the placement of a removed layer and keeps a live one", () => {
    const world = new VoxelWorld();
    world.addLayer("Draft");
    world.setVoxelBulk("Draft", [
      {
        position: { x: 0, y: 0, z: 0 },
        blockId: 1
      }
    ]);
    const store = new PlacementStore();
    const source = LayerSource.capture(world, "Draft")!;
    store.begin(source, source.pivot);

    store.reconcile(world);
    assert.notEqual(store.placement, null);

    world.removeLayer("Draft");
    store.reconcile(world);
    assert.equal(store.placement, null);
  });
});
