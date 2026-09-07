// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  cloneLayerEntry,
  mergeLayerEntry
} from "../../../src/features/layers/layerActions.ts";
import type { MergeLayerContext } from "../../../src/features/layers/MergeLayerDialog.ts";
import { SelectionStore } from "../../../src/app/state/index.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("A");
  world.addLayer("B");
  world.addObjectLayer("Triggers");

  return world;
}

function picker(
  target: string | null
): {
  pick: (context: MergeLayerContext) => Promise<string | null>;
  contexts: MergeLayerContext[];
} {
  const contexts: MergeLayerContext[] = [];

  return {
    contexts,
    pick(context) {
      contexts.push(context);

      return Promise.resolve(target);
    }
  };
}

describe("cloneLayerEntry", () => {
  test("clones the layer and selects the copy", () => {
    const world = makeWorld();
    const selection = new SelectionStore();

    cloneLayerEntry(world, selection, { kind: "voxel-layer", name: "B" });

    assert.ok(world.getLayer("B (1)"));
    assert.deepEqual(selection.current, {
      kind: "voxel-layer",
      name: "B (1)"
    });
  });

  test("carries the source voxels into the copy", () => {
    const world = makeWorld();
    world.setVoxelAt("B", { x: 1, y: 0, z: 0 }, {
      blockId: 4,
      transform: 0
    });

    cloneLayerEntry(world, new SelectionStore(), {
      kind: "voxel-layer",
      name: "B"
    });

    assert.equal(
      world.getLayer("B (1)")?.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId,
      4
    );
  });

  test("ignores anything that is not a voxel layer", () => {
    const world = makeWorld();
    const selection = new SelectionStore();

    cloneLayerEntry(world, selection, {
      kind: "object-layer",
      name: "Triggers"
    });

    assert.equal(world.getLayers().length, 2);
    assert.equal(selection.current, null);
  });
});

describe("mergeLayerEntry", () => {
  test("merges into the picked target and selects it", async() => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const { pick, contexts } = picker("A");

    await mergeLayerEntry(
      world,
      selection,
      { kind: "voxel-layer", name: "B" },
      pick
    );

    assert.equal(world.getLayer("B"), undefined);
    assert.deepEqual(selection.current, {
      kind: "voxel-layer",
      name: "A"
    });
    assert.deepEqual(contexts[0], {
      sourceName: "B",
      options: [{ value: "A", label: "A" }],
      defaultTarget: "A"
    });
  });

  test("leaves the world alone when the dialog is dismissed", async() => {
    const world = makeWorld();
    const selection = new SelectionStore();

    await mergeLayerEntry(
      world,
      selection,
      { kind: "voxel-layer", name: "B" },
      picker(null).pick
    );

    assert.ok(world.getLayer("B"));
    assert.equal(selection.current, null);
  });

  test("does not open the dialog in a single-layer world", async() => {
    const world = new VoxelWorld(4);
    world.addLayer("Only");
    const { pick, contexts } = picker("Only");

    await mergeLayerEntry(
      world,
      new SelectionStore(),
      { kind: "voxel-layer", name: "Only" },
      pick
    );

    assert.deepEqual(contexts, []);
    assert.ok(world.getLayer("Only"));
  });

  test("ignores anything that is not a voxel layer", async() => {
    const world = makeWorld();
    const { pick, contexts } = picker("A");

    await mergeLayerEntry(
      world,
      new SelectionStore(),
      { kind: "object-layer", name: "Triggers" },
      pick
    );

    assert.deepEqual(contexts, []);
    assert.equal(world.getLayers().length, 2);
  });
});
