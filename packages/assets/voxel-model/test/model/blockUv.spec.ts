// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BLOCK_UV_SIZE,
  blockUvBounds,
  createBlockUv,
  nextBlockUvOrigin
} from "#src/model/blockUv.ts";

// CONSTANTS
const kNet = blockUvBounds(createBlockUv());
const kTexture = {
  x: kNet.width * 2,
  y: kNet.height * 2
};

describe("createBlockUv", () => {
  test("unfolds the six faces at the texture origin by default", () => {
    const layout = createBlockUv();

    assert.equal(layout.state, "unfolded");
    assert.deepEqual(
      {
        x: kNet.x,
        y: kNet.y
      },
      {
        x: 0,
        y: 0
      }
    );
    assert.ok(kNet.width > BLOCK_UV_SIZE);
  });

  test("places the net at the given origin", () => {
    const bounds = blockUvBounds(createBlockUv({ x: 32, y: 16 }));

    assert.deepEqual(bounds, {
      ...kNet,
      x: 32,
      y: 16
    });
  });
});

describe("nextBlockUvOrigin", () => {
  test("starts at the texture origin", () => {
    assert.deepEqual(nextBlockUvOrigin([], kTexture), { x: 0, y: 0 });
  });

  test("takes the first free cell, row by row", () => {
    const origin = nextBlockUvOrigin([createBlockUv()], kTexture);

    assert.deepEqual(origin, { x: kNet.width, y: 0 });
  });

  test("fills a gap left by a removed block", () => {
    const layouts = [
      createBlockUv(),
      createBlockUv({ x: 0, y: kNet.height })
    ];

    assert.deepEqual(
      nextBlockUvOrigin(layouts, kTexture),
      { x: kNet.width, y: 0 }
    );
  });

  test("falls back to the texture origin once the texture is full", () => {
    const layouts = [
      createBlockUv(),
      createBlockUv({ x: kNet.width, y: 0 }),
      createBlockUv({ x: 0, y: kNet.height }),
      createBlockUv({ x: kNet.width, y: kNet.height })
    ];

    assert.deepEqual(nextBlockUvOrigin(layouts, kTexture), { x: 0, y: 0 });
  });
});
