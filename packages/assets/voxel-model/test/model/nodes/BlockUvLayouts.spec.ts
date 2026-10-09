// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockUvLayouts } from "#src/model/nodes/BlockUvLayouts.ts";

// CONSTANTS
const kNet = new BlockUvLayouts([BlockUvLayouts.net()]).extent;
const kTexture = {
  x: kNet.x * 2,
  y: kNet.y * 2
};

describe("BlockUvLayouts", () => {
  test("unfolds the six faces of a net at the texture origin by default", () => {
    assert.equal(BlockUvLayouts.net().state, "unfolded");
    assert.ok(kNet.x > 0 && kNet.y > 0);
  });

  test("places a net at the given origin", () => {
    const extent = new BlockUvLayouts([BlockUvLayouts.net({ x: 32, y: 16 })]).extent;

    assert.deepEqual(extent, {
      x: 32 + kNet.x,
      y: 16 + kNet.y
    });
  });

  test("reaches the farthest right and bottom edges of all layouts", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: 40, y: 0 }),
      BlockUvLayouts.net({ x: 0, y: 20 })
    ]);

    assert.deepEqual(layouts.extent, {
      x: 40 + kNet.x,
      y: 20 + kNet.y
    });
  });

  test("is empty without layouts", () => {
    assert.deepEqual(new BlockUvLayouts([]).extent, { x: 0, y: 0 });
  });

  test("places the next net at the texture origin when empty", () => {
    assert.deepEqual(new BlockUvLayouts([]).nextNet(kTexture), BlockUvLayouts.net());
  });

  test("places the next net in the first free cell, row by row", () => {
    const layouts = new BlockUvLayouts([BlockUvLayouts.net()]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net({ x: kNet.x, y: 0 }));
  });

  test("fills a gap left by a removed block", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: 0, y: kNet.y })
    ]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net({ x: kNet.x, y: 0 }));
  });

  test("falls back to the texture origin once the texture is full", () => {
    const layouts = new BlockUvLayouts([
      BlockUvLayouts.net(),
      BlockUvLayouts.net({ x: kNet.x, y: 0 }),
      BlockUvLayouts.net({ x: 0, y: kNet.y }),
      BlockUvLayouts.net({ x: kNet.x, y: kNet.y })
    ]);

    assert.deepEqual(layouts.nextNet(kTexture), BlockUvLayouts.net());
  });
});
