// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelBlockStats } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EditorMapEvents } from "../../../../src/map/EditorMap.ts";
import {
  BlockUsageStore,
  type BlockUsageSource
} from "../../../../src/features/blocks/usage/BlockUsageStore.ts";

function stats(
  voxels: number
): VoxelBlockStats {
  return {
    voxels,
    layers: [
      {
        layerName: "Ground",
        voxels,
        chunks: 1
      }
    ],
    blocks: new Map([[1, voxels]]),
    unusedBlocks: [],
    orphanBlocks: [],
    orphanVoxels: 0
  };
}

function setup() {
  const editorMap = new Emitter<EditorMapEvents>();
  const source: BlockUsageSource = {
    stats: stats(2),
    inspectUsage: (blockId) => {
      return {
        blockId,
        voxels: 7,
        layers: []
      };
    },
    inspectBlocksetUsage: (blocksetId) => {
      return {
        blocksetId,
        blocks: [],
        voxels: 9
      };
    }
  };
  const usage = new BlockUsageStore({ editorMap, source });

  return { editorMap, source, usage };
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

describe("BlockUsageStore", () => {
  it("reads the stats of its source up front", () => {
    const { usage } = setup();

    assert.equal(usage.stats.voxels, 2);
  });

  it("coalesces a burst of document changes into one refresh", async() => {
    const { editorMap, source, usage } = setup();
    const changes: number[] = [];
    usage.on("change", (next) => changes.push(next.voxels));

    Object.assign(source, { stats: stats(5) });
    editorMap.emit("blockRegistryChanged", "added");
    editorMap.emit("reset");
    assert.deepEqual(changes, []);

    await flushMicrotasks();
    assert.deepEqual(changes, [5]);
    assert.equal(usage.stats.voxels, 5);
  });

  it("ignores redefinitions, which never change what voxels use", async() => {
    const { editorMap, usage } = setup();
    const changes: number[] = [];
    usage.on("change", (next) => changes.push(next.voxels));

    editorMap.emit("blockRegistryChanged", "redefined");
    editorMap.emit("blockRegistryChanged", "retiled");

    await flushMicrotasks();
    assert.deepEqual(changes, []);
  });

  it("forwards per-block and per-blockset usage to its source", () => {
    const { usage } = setup();

    assert.equal(usage.inspectUsage(3).voxels, 7);
    assert.equal(usage.inspectBlocksetUsage("atlas").voxels, 9);
  });

  it("ignores the document once disposed", async() => {
    const { editorMap, usage } = setup();
    let changed = false;
    usage.on("change", () => {
      changed = true;
    });

    usage.dispose();
    editorMap.emit("reset");
    await flushMicrotasks();

    assert.equal(changed, false);
  });
});
