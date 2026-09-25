// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelBlockStats } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../src/document/index.ts";
import {
  BlockUsageStore,
  type BlockUsageSource
} from "../../src/state/index.ts";

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
  const mapDocument = new Emitter<MapDocumentEvents>();
  const source: BlockUsageSource = {
    stats: stats(2),
    usageOf: (blockId) => {
      return {
        blockId,
        voxels: 7,
        layers: []
      };
    },
    tilesetUsageOf: (tilesetId) => {
      return {
        tilesetId,
        blocks: [],
        voxels: 9
      };
    }
  };
  const usage = new BlockUsageStore({ mapDocument, source });

  return { mapDocument, source, usage };
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
    const { mapDocument, source, usage } = setup();
    const changes: number[] = [];
    usage.on("change", (next) => changes.push(next.voxels));

    Object.assign(source, { stats: stats(5) });
    mapDocument.emit("blockRegistryChanged");
    mapDocument.emit("reset");
    assert.deepEqual(changes, []);

    await flushMicrotasks();
    assert.deepEqual(changes, [5]);
    assert.equal(usage.stats.voxels, 5);
  });

  it("forwards per-block and per-tileset usage to its source", () => {
    const { usage } = setup();

    assert.equal(usage.usageOf(3).voxels, 7);
    assert.equal(usage.tilesetUsageOf("atlas").voxels, 9);
  });

  it("ignores the document once disposed", async() => {
    const { mapDocument, usage } = setup();
    let changed = false;
    usage.on("change", () => {
      changed = true;
    });

    usage.dispose();
    mapDocument.emit("reset");
    await flushMicrotasks();

    assert.equal(changed, false);
  });
});
