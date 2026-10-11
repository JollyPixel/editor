// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import {
  isVoxelLayerCommand,
  type VoxelLayerCommand
} from "../../../src/document/commands/index.ts";
import { makeLogger } from "../../helpers/fakes.ts";

// CONSTANTS
const kOrigin = { x: 0, y: 0, z: 0 };

const kVoxelCommands: VoxelLayerCommand[] = [
  {
    action: "voxel-set",
    layerId: "Gone",
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
    layerId: "Gone",
    metadata: { entries: [{ position: kOrigin, blockId: 1 }] }
  },
  {
    action: "voxel-removed",
    layerId: "Gone",
    metadata: { position: kOrigin }
  },
  {
    action: "voxels-removed",
    layerId: "Gone",
    metadata: { entries: [{ position: kOrigin }] }
  },
  {
    action: "layer-transformed",
    layerId: "Gone",
    metadata: {
      rotation: 1,
      flipX: false,
      flipZ: false,
      flipY: false
    }
  }
];

describe("VoxelWorld.applyCommand - unknown layer", () => {
  for (const command of kVoxelCommands) {
    it(`drops '${command.action}' and warns instead of throwing`, () => {
      const world = new VoxelWorld(4);
      const warnings: string[] = [];

      assert.equal(world.applyCommand(command, makeLogger(warnings)), null);

      assert.equal(world.getLayer("Gone"), undefined);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], new RegExp(`dropped '${command.action}' for unknown layer 'Gone'`));
    });
  }

  it("stays quiet when the layer is known", () => {
    const world = new VoxelWorld(4);
    world.restoreLayer({ id: "Gone", name: "Gone" });
    const warnings: string[] = [];

    world.applyCommand(kVoxelCommands[0], makeLogger(warnings));

    assert.deepEqual(warnings, []);
    assert.equal(world.getLayer("Gone")?.getVoxelAt(kOrigin)?.blockId, 1);
  });

  it("leaves the layer lifecycle actions to their own guards", () => {
    const world = new VoxelWorld(4);
    const warnings: string[] = [];

    assert.equal(world.applyCommand({
      action: "merged",
      layerId: "Gone",
      metadata: { targetLayerId: "AlsoGone" }
    }, makeLogger(warnings)), null);
    assert.equal(world.applyCommand({
      action: "removed",
      layerId: "Gone",
      metadata: {}
    }, makeLogger(warnings)), null);

    assert.deepEqual(warnings, []);
    assert.deepEqual(world.getLayers(), []);
  });
});

describe("VoxelWorld.applyCommand - applied command", () => {
  function makeWorld(
    ...layers: string[]
  ) {
    const world = new VoxelWorld(4);
    layers.forEach((name) => world.addLayer(name));
    const emitted: VoxelLayerCommand[] = [];
    world.on("command", (command) => {
      if (isVoxelLayerCommand(command)) {
        emitted.push(command);
      }
    });

    return { world, emitted };
  }

  it("returns the command without notifying world listeners", () => {
    const { world, emitted } = makeWorld();

    const applied = world.applyCommand({
      action: "added",
      layerId: "ground",
      metadata: { name: "Ground", rank: "V", options: {} }
    });

    assert.equal(applied?.action, "added");
    assert.equal(world.getLayer("Ground")?.id, "ground");
    assert.deepEqual(emitted, []);
  });

  it("refuses a layer whose id already exists, and renames a clashing name", () => {
    const { world } = makeWorld("Ground");

    assert.equal(world.applyCommand({
      action: "added",
      layerId: world.getLayer("Ground")!.id,
      metadata: { name: "Other", rank: "a", options: {} }
    }), null);
    assert.deepEqual(world.applyCommand({
      action: "added",
      layerId: "second",
      metadata: { name: "Ground", rank: "a", options: {} }
    }), {
      action: "added",
      layerId: "second",
      metadata: { name: "Ground (1)", rank: "a", options: {} }
    });
  });

  it("renames a layer, keeping names unique", () => {
    const { world } = makeWorld("Bottom", "Top");
    const top = world.getLayer("Top")!;

    const applied = world.applyCommand({
      action: "updated",
      layerId: top.id,
      metadata: { options: { name: "Bottom" } }
    });

    assert.deepEqual(
      applied?.action === "updated" && applied.metadata,
      { options: { name: "Bottom (1)" } }
    );
    assert.equal(top.name, "Bottom (1)");
  });

  it("returns null for a layer command that changes nothing", () => {
    const { world } = makeWorld("Bottom", "Top");

    const bottom = world.getLayer("Bottom")!;
    assert.equal(world.applyCommand({
      action: "layer-moved",
      layerId: bottom.id,
      metadata: { rank: bottom.rank }
    }), null);
    assert.equal(world.applyCommand({
      action: "position-updated",
      layerId: "Gone",
      metadata: { position: kOrigin }
    }), null);
    assert.equal(world.applyCommand({
      action: "object-removed",
      layerName: "Gone",
      metadata: { objectId: "missing" }
    }), null);
  });

  it("moves a layer to its rank", () => {
    const { world } = makeWorld("Bottom", "Top");
    const top = world.getLayer("Top")!;

    world.applyCommand({
      action: "layer-moved",
      layerId: top.id,
      metadata: { rank: "0V" }
    });

    assert.deepEqual(world.getLayers().map((layer) => layer.name), ["Bottom", "Top"]);
  });

  it("returns the clone name the world resolved", () => {
    const { world } = makeWorld("Ground");
    const ground = world.getLayer("Ground")!;

    assert.deepEqual(world.applyCommand({
      action: "cloned",
      layerId: ground.id,
      metadata: { cloneId: "copy", rank: "z", options: { name: "Ground" } }
    }), {
      action: "cloned",
      layerId: ground.id,
      metadata: { cloneId: "copy", rank: "z", options: { name: "Ground (1)" } }
    });
    assert.equal(world.getLayerById("copy")?.name, "Ground (1)");
  });

  it("returns only the patched cells that changed", () => {
    const { world, emitted } = makeWorld("Ground");
    world.setVoxel("Ground", { position: kOrigin, blockId: 2 });
    emitted.length = 0;

    const layerId = world.getLayer("Ground")!.id;
    const applied = world.applyCommand({
      action: "voxels-patched",
      layerId,
      metadata: { cells: [0, 0, 0, 2, 0, 1, 0, 0, 3, 0] }
    });

    assert.deepEqual(applied, {
      action: "voxels-patched",
      layerId,
      metadata: { cells: [1, 0, 0, 3, 0] }
    });
    assert.equal(world.applyCommand({
      action: "voxels-patched",
      layerId,
      metadata: { cells: [0, 0, 0, 2, 0] }
    }), null);
    assert.deepEqual(emitted, []);
  });

  it("emits pending local edits before applying inside a transaction", () => {
    const { world, emitted } = makeWorld("Ground");

    world.transaction(() => {
      world.setVoxel("Ground", { position: kOrigin, blockId: 2 });
      world.applyCommand({
        action: "voxels-patched",
        layerId: world.getLayer("Ground")!.id,
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
