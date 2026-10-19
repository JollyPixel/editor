// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UVNet } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvNetPreview } from "../../../src/uv/nets/UvNetPreview.ts";

describe("UvNetPreview", () => {
  test("draws slots sharing a cell once, listing every slot", () => {
    const net = new UVNet([[["top", "bottom"], ["front", "back", "left", "right"]]]);
    const region = {
      activeSlots: ["top", "bottom", "front", "back", "left", "right"],
      slotGeometry: () => {
        return { x: 0, y: 0, width: 4, height: 2 };
      }
    };

    const preview = new UvNetPreview(net, region);

    assert.deepStrictEqual(preview.cells, [
      { rect: { x: 0, y: 0, width: 4, height: 2 }, slots: ["top", "bottom"] },
      { rect: { x: 4, y: 0, width: 4, height: 2 }, slots: ["front", "back", "left", "right"] }
    ]);
    assert.deepStrictEqual([preview.width, preview.height], [8, 2]);
  });

  test("draws every net at the same face size until it outgrows the height cap", () => {
    const wide = new UvNetPreview(UVNet.packed, null);
    const cross = new UvNetPreview(new UVNet([
      [null, "top"],
      ["left", "front", "right", "back"],
      [null, "bottom"]
    ]), null);
    const column = new UvNetPreview(new UVNet(
      ["top", "front", "bottom", "back", "left", "right"].map((slot) => [slot])
    ), null);

    assert.deepStrictEqual(
      [wide, cross, column].map((preview) => [
        Math.round(preview.width * preview.scale),
        Math.round(preview.height * preview.scale)
      ]),
      [[112, 168], [224, 168], [33, 200]]
    );
  });
});
