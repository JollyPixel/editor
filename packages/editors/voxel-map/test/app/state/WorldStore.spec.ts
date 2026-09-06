// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { VoxelLayerHookEvent } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { WorldStore } from "../../../src/app/state/index.ts";

describe("WorldStore", () => {
  it("starts ready and tracks a pending networked registry", () => {
    const world = new WorldStore();

    assert.equal(world.blocksReady, true);

    world.blocksReady = false;
    assert.equal(world.blocksReady, false);
  });

  it("forwards every signal to its watchers until they unsubscribe", () => {
    const world = new WorldStore();
    const seen: string[] = [];
    const layerEvent: VoxelLayerHookEvent = {
      action: "removed",
      layerName: "Ground",
      metadata: {}
    };

    world.watch("layerUpdated", (event) => {
      seen.push(`layerUpdated:${event.action}`);
    });
    const stop = world.watch("reset", () => seen.push("reset"));
    world.watch("blockRegistryChanged", () => seen.push("blocks"));

    world.emit("layerUpdated", layerEvent);
    world.emit("blockRegistryChanged");
    world.emit("reset");
    stop();
    world.emit("reset");

    assert.deepEqual(seen, [
      "layerUpdated:removed",
      "blocks",
      "reset"
    ]);
  });
});
