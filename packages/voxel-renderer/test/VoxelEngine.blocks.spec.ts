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
