// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SelectionPresence,
  type SelectionPresenceData
} from "#src/selection/SelectionPresence.ts";

describe("SelectionPresence", () => {
  test("owns its data and returns independent snapshots", () => {
    const mask = [true];
    const data: SelectionPresenceData = {
      phase: "floating",
      sourceRect: { x: -1, y: 0, width: 1, height: 1 },
      liveRect: { x: -1, y: 0, width: 1, height: 1 },
      mask,
      pixels: [{ r: 10, g: 20, b: 30, a: 0 }],
      eraseColor: { r: 1, g: 2, b: 3, a: 128 },
      blankSource: false
    };
    const expected = structuredClone(data);
    const presence = new SelectionPresence(data);
    data.sourceRect.x = 9;
    data.liveRect.y = 8;
    data.pixels[0].r = 255;
    data.eraseColor.a = 255;
    mask[0] = false;
    assert.deepEqual(presence.toJSON(), expected);

    const snapshot = presence.toJSON();
    assert.ok("pixels" in snapshot);
    snapshot.liveRect.x = 5;
    snapshot.pixels[0].g = 255;
    snapshot.eraseColor.r = 255;
    assert.deepEqual(presence.toJSON(), expected);
  });

  test("rejects invalid geometry, sparse content and inconsistent masks", () => {
    const rect = { x: 0, y: 0, width: 2, height: 1 };
    const invalid = [
      { phase: "selected", rect, mask: [true] },
      { phase: "selected", rect, mask: [false, false] },
      { phase: "selected", rect, mask: Object.assign([], { 0: true, length: 2 }) },
      { phase: "selected", rect: { ...rect, x: 0.5 }, mask: [true, true] },
      { phase: "selected", rect: { ...rect, width: 0 }, mask: [] },
      {
        phase: "floating",
        sourceRect: rect,
        liveRect: rect,
        mask: [true, true],
        pixels: Object.assign([], { length: 2 }),
        eraseColor: { r: 0, g: 0, b: 0, a: 0 },
        blankSource: false
      }
    ];
    for (const data of invalid) {
      assert.equal(SelectionPresence.parse(data), null);
    }
  });
});
