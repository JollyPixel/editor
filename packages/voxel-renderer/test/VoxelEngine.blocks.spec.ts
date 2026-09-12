// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelBlockHookEvent } from "../src/hooks.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { makeVoxelEntry } from "./helpers/voxelEntry.ts";
import {
  makeEngine,
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "./helpers/engine.ts";

describe("VoxelEngine — block definitions", () => {
  it("registers a definition, marks the chunks dirty and emits", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);
    engine.world.addLayer("Ground");
    engine.world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(kCubeId));
    engine.tick(0);

    engine.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));

    assert.equal(engine.blockRegistry.get(kLeavesId)?.name, "Leaves");
    assert.deepEqual(
      events.map((event) => event.action),
      ["block-defined"]
    );
    assert.ok(
      [...engine.world.getAllChunks()].every(({ chunk }) => chunk.dirty)
    );
  });

  it("emits the resolved definition, not the raw one", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlock(makeBlockDef(kLeavesId, "cube"));

    const [event] = events;
    assert.equal(event.action, "block-defined");
    assert.deepEqual(
      event.action === "block-defined" ? event.block : null,
      engine.blockRegistry.get(kLeavesId)
    );
  });

  it("emits once per block of a batch", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlocks([
      makeBlockDef(kLeavesId, "cube"),
      makeBlockDef(3, "cube")
    ]);

    assert.equal(events.length, 2);
  });

  it("emits nothing for an empty batch", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlocks([]);

    assert.deepEqual(events, []);
  });

  it("removes a definition and reports the removal", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.removeBlock(kCubeId), true);

    assert.equal(engine.blockRegistry.has(kCubeId), false);
    assert.deepEqual(
      events.map((event) => event.action),
      ["block-removed"]
    );
  });

  it("stays silent when the removed id is unknown", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.removeBlock(99), false);

    assert.deepEqual(events, []);
  });
});

describe("VoxelEngine — block lookup by position", () => {
  it("joins a placed voxel to its definition and properties", () => {
    const engine = makeEngine();
    engine.defineBlock(
      makeBlockDef(kLeavesId, "cube", {
        name: "Leaves",
        properties: { hardness: 1, flammable: true }
      })
    );
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", {
      position: { x: 1, y: 2, z: 3 },
      blockId: kLeavesId
    });

    assert.equal(engine.blockAt({ x: 1, y: 2, z: 3 })?.name, "Leaves");
    assert.deepEqual(
      engine.blockPropertiesAt({ x: 1, y: 2, z: 3 }),
      { hardness: 1, flammable: true }
    );
  });

  it("hands out a copy that does not write back into the registry", () => {
    const engine = makeEngine();
    engine.defineBlock(
      makeBlockDef(kLeavesId, "cube", { properties: { hardness: 1 } })
    );
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: kLeavesId
    });

    engine.blockPropertiesAt({ x: 0, y: 0, z: 0 })!.hardness = 99;

    assert.deepEqual(
      engine.blockPropertiesAt({ x: 0, y: 0, z: 0 }),
      { hardness: 1 }
    );
  });

  it("reports air as absent", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");

    assert.equal(engine.blockAt({ x: 9, y: 9, z: 9 }), undefined);
    assert.equal(engine.blockPropertiesAt({ x: 9, y: 9, z: 9 }), undefined);
  });

  it("reports a voxel whose block was unregistered as absent", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: kCubeId
    });

    engine.removeBlock(kCubeId);

    assert.equal(engine.blockAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(engine.blockPropertiesAt({ x: 0, y: 0, z: 0 }), undefined);
  });
});

describe("VoxelEngine — block order", () => {
  function ids(
    engine: ReturnType<typeof makeEngine>
  ): number[] {
    return [...engine.blockRegistry].map((block) => block.id);
  }

  it("moves a block and emits the resolved index", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.moveBlock(kCubeId, 99), true);

    assert.deepEqual(ids(engine), [kLeavesId, kCubeId]);
    assert.deepEqual(events, [
      {
        action: "block-moved",
        blockId: kCubeId,
        toIndex: 1
      }
    ]);
  });

  it("stays silent when the block already sits at the index", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.moveBlock(kCubeId, 0), false);
    assert.deepEqual(events, []);
  });

  it("stays silent for an unknown block", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.moveBlock(404, 0), false);
    assert.deepEqual(events, []);
  });

  it("leaves the meshes untouched", () => {
    const engine = makeEngine();
    engine.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));
    engine.world.addLayer("Ground");
    engine.world.setVoxelAt(
      "Ground",
      { x: 0, y: 0, z: 0 },
      makeVoxelEntry(kCubeId)
    );
    engine.tick(0);

    engine.moveBlock(kCubeId, 1);

    assert.equal(
      [...engine.world.getAllChunks()].some(({ chunk }) => chunk.dirty),
      false
    );
  });
});
