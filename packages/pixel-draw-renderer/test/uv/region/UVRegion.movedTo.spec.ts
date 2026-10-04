// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVRegion,
  DEFAULT_UV_SLOTS
} from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";
import {
  REGION_RECT,
  makeStacked,
  makeFree
} from "../../helpers/uv/region.ts";

describe("UVRegion", () => {
  describe("movedTo", () => {
    const position = { x: 7, y: 8 };
    const movedRect: SelectionRect = { ...REGION_RECT, ...position };

    test("moves the shared rect when stacked, keeping its size", () => {
      const region = makeStacked().movedTo(position);

      assert.strictEqual(region.state, "stacked");
      assert.deepStrictEqual(region.rectFor("back"), movedRect);
    });

    test("ignores the slot argument when stacked", () => {
      const region = makeStacked().movedTo(position, "top");

      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(region.rectFor(face), movedRect, `${face} must follow the shared rect`);
      }
    });

    test("moves only the named slot when free", () => {
      const region = makeFree().movedTo(position, "left");

      assert.deepStrictEqual(region.rectFor("left"), movedRect);
      for (const face of DEFAULT_UV_SLOTS.filter((value) => value !== "left")) {
        assert.deepStrictEqual(region.rectFor(face), REGION_RECT, `${face} must stay put`);
      }
    });

    test("is a no-op when free and no slot is given", () => {
      const region = makeFree();

      assert.strictEqual(region.movedTo(position), region);
    });

    test("is a no-op for an inactive slot of a free region", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces: { front: REGION_RECT, back: REGION_RECT },
        activeFaces: ["front"]
      });

      assert.strictEqual(region.movedTo(position, "back"), region);
    });

    test("is a no-op when the position does not change", () => {
      const region = makeFree();

      assert.strictEqual(region.movedTo(REGION_RECT, "left"), region);
    });

    test("leaves the source region untouched", () => {
      const region = makeFree();
      region.movedTo(position, "left");

      assert.deepStrictEqual(region.rectFor("left"), REGION_RECT);
    });

    test("preserves the name through geometry and state changes", () => {
      const region = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: REGION_RECT
      });

      const changed = region
        .free()
        .movedTo(position, "front")
        .stack();

      assert.strictEqual(changed.name, "Grass block");
    });
  });
});
