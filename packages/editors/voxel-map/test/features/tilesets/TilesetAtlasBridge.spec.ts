// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  TilesetAtlasBridge,
  type TilesetAtlasBridgeOptions
} from "../../../src/features/tilesets/TilesetAtlasBridge.ts";

// CONSTANTS
const kRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 4,
  height: 4
};

function setup() {
  const queue: Array<() => void> = [];
  const counts = {
    images: 0,
    frames: 0,
    alphaSyncs: 0
  };
  const atlas = {
    def: {
      tileSize: 16,
      cols: 2,
      rows: 2
    },
    updateImage: () => {
      counts.images++;
    }
  };
  const pixels = Object.assign(new Emitter(), {
    buffer: {
      canvas: () => {
        return {};
      }
    },
    size: () => {
      return { x: 32, y: 32 };
    }
  });
  const tileset = Object.assign(new Emitter(), {
    tileSize: 16
  });
  const options = {
    view: {
      atlases: {
        get: () => atlas
      },
      requestFrame: () => {
        counts.frames++;
      }
    },
    pixels,
    tileset,
    definition: {
      id: "tiles",
      tileSize: 16,
      cols: 2,
      rows: 2
    },
    mapDocument: {
      ready: true,
      subscribe: () => () => undefined
    },
    blocks: {
      defineBlock: () => undefined,
      syncAlphaModes: () => {
        counts.alphaSyncs++;
      }
    },
    scheduler: (callback: () => void) => {
      queue.push(callback);
    }
  } as unknown as TilesetAtlasBridgeOptions;
  const bridge = new TilesetAtlasBridge(options);

  return {
    bridge,
    pixels,
    queue,
    counts,
    runQueue(): void {
      for (const callback of queue.splice(0)) {
        callback();
      }
    }
  };
}

describe("TilesetAtlasBridge", () => {
  test("syncs on construction and schedules nothing while idle", () => {
    const { queue, counts } = setup();

    assert.equal(counts.images, 1);
    assert.equal(counts.frames, 1);
    assert.equal(queue.length, 0);
  });

  test("a pixel change schedules one flush, then the alpha sync", () => {
    const { pixels, queue, counts, runQueue } = setup();

    pixels.emit("changed", { bounds: kRect });
    pixels.emit("changed", { bounds: kRect });
    assert.equal(queue.length, 1);

    const alphaSyncs = counts.alphaSyncs;
    runQueue();
    assert.equal(counts.images, 2);
    assert.equal(counts.frames, 2);
    assert.equal(queue.length, 1);

    runQueue();
    assert.equal(counts.alphaSyncs, alphaSyncs + 1);
    assert.equal(queue.length, 0);
  });

  test("a destroyed bridge stops scheduling", () => {
    const { bridge, pixels, queue } = setup();

    bridge.destroy();
    pixels.emit("changed", { bounds: kRect });

    assert.equal(queue.length, 0);
  });
});
