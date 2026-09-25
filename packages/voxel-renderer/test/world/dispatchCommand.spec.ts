// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import type { VoxelLayerCommand } from "../../src/commands/index.ts";
import { makeLogger } from "../helpers/fakes.ts";

// CONSTANTS
const kOrigin = { x: 0, y: 0, z: 0 };

const kVoxelCommands: VoxelLayerCommand[] = [
  {
    action: "voxel-set",
    layerName: "Gone",
    metadata: {
      position: kOrigin,
      blockId: 1,
      rotation: 0,
      flipX: false,
      flipZ: false,
      flipY: false
    }
  },
  {
    action: "voxels-set",
    layerName: "Gone",
    metadata: { entries: [{ position: kOrigin, blockId: 1 }] }
  },
  {
    action: "voxel-removed",
    layerName: "Gone",
    metadata: { position: kOrigin }
  },
  {
    action: "voxels-removed",
    layerName: "Gone",
    metadata: { entries: [{ position: kOrigin }] }
  }
];

describe("VoxelWorld.apply - unknown layer", () => {
  for (const command of kVoxelCommands) {
    it(`drops '${command.action}' and warns instead of throwing`, () => {
      const world = new VoxelWorld(4);
      const warnings: string[] = [];

      assert.equal(world.apply(command, makeLogger(warnings)), null);

      assert.equal(world.getLayer("Gone"), undefined);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], new RegExp(`dropped '${command.action}' for unknown layer 'Gone'`));
    });
  }

  it("stays quiet when the layer is known", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Gone");
    const warnings: string[] = [];

    world.apply(kVoxelCommands[0], makeLogger(warnings));

    assert.deepEqual(warnings, []);
    assert.equal(world.getLayer("Gone")?.getVoxelAt(kOrigin)?.blockId, 1);
  });

  it("leaves the layer lifecycle actions to their own guards", () => {
    const world = new VoxelWorld(4);
    const warnings: string[] = [];

    assert.equal(world.apply({
      action: "merged",
      layerName: "Gone",
      metadata: { targetLayerName: "AlsoGone" }
    }, makeLogger(warnings)), null);
    assert.equal(world.apply({
      action: "removed",
      layerName: "Gone",
      metadata: {}
    }, makeLogger(warnings)), null);

    assert.deepEqual(warnings, []);
    assert.deepEqual(world.getLayers(), []);
  });
});

describe("VoxelWorld.apply - applied command", () => {
  function makeWorld(
    ...layers: string[]
  ) {
    const world = new VoxelWorld(4);
    layers.forEach((name) => world.addLayer(name));
    const emitted: VoxelLayerCommand[] = [];
    world.on("command", (command) => emitted.push(command));

    return { world, emitted };
  }

  it("returns the command without notifying world listeners", () => {
    const { world, emitted } = makeWorld();

    const applied = world.apply({
      action: "added",
      layerName: "Ground",
      metadata: { options: {} }
    });

    assert.equal(applied?.action, "added");
    assert.ok(world.getLayer("Ground"));
    assert.deepEqual(emitted, []);
  });

  it("returns null for a layer command that changes nothing", () => {
    const { world } = makeWorld("Bottom", "Top");

    assert.equal(world.apply({
      action: "reordered",
      layerName: "Bottom",
      metadata: { direction: "down" }
    }), null);
    assert.equal(world.apply({
      action: "position-updated",
      layerName: "Gone",
      metadata: { position: kOrigin }
    }), null);
    assert.equal(world.apply({
      action: "object-removed",
      layerName: "Gone",
      metadata: { objectId: "missing" }
    }), null);
  });

  it("returns the clamped index of a layer move", () => {
    const { world } = makeWorld("Bottom", "Top");

    assert.deepEqual(world.apply({
      action: "layer-moved",
      layerName: "Top",
      metadata: { toIndex: 99 }
    }), {
      action: "layer-moved",
      layerName: "Top",
      metadata: { toIndex: 1 }
    });
  });

  it("returns the clone name the world resolved", () => {
    const { world } = makeWorld("Ground");

    assert.deepEqual(world.apply({
      action: "cloned",
      layerName: "Ground",
      metadata: { options: { name: "Ground" } }
    }), {
      action: "cloned",
      layerName: "Ground",
      metadata: { options: { name: "Ground (1)" } }
    });
  });

  it("returns only the patched cells that changed", () => {
    const { world, emitted } = makeWorld("Ground");
    world.setVoxel("Ground", { position: kOrigin, blockId: 2 });
    emitted.length = 0;

    const applied = world.apply({
      action: "voxels-patched",
      layerName: "Ground",
      metadata: { cells: [0, 0, 0, 2, 0, 1, 0, 0, 3, 0] }
    });

    assert.deepEqual(applied, {
      action: "voxels-patched",
      layerName: "Ground",
      metadata: { cells: [1, 0, 0, 3, 0] }
    });
    assert.equal(world.apply({
      action: "voxels-patched",
      layerName: "Ground",
      metadata: { cells: [0, 0, 0, 2, 0] }
    }), null);
    assert.deepEqual(emitted, []);
  });

  it("emits pending local edits before applying inside a transaction", () => {
    const { world, emitted } = makeWorld("Ground");

    world.transaction(() => {
      world.setVoxel("Ground", { position: kOrigin, blockId: 2 });
      world.apply({
        action: "voxels-patched",
        layerName: "Ground",
        metadata: { cells: [0, 0, 0, 3, 0] }
      });
      world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: 4 });
    });

    assert.deepEqual(emitted.map(({ metadata }) => metadata), [
      { cells: [0, 0, 0, 2, 0] },
      { cells: [1, 0, 0, 4, 0] }
    ]);
    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 3);
  });
});
