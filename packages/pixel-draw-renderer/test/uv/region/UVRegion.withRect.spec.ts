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
  describe("withRect", () => {
    const nextRect: SelectionRect = { x: 7, y: 8, width: 2, height: 2 };

    test("replaces the shared rect when stacked", () => {
      const region = makeStacked().withRect(nextRect);

      assert.strictEqual(region.state, "stacked");
      assert.deepStrictEqual(region.rectFor("back"), nextRect);
    });

    test("ignores the face argument when stacked", () => {
      const region = makeStacked().withRect(nextRect, "top");

      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(region.rectFor(face), nextRect, `${face} must follow the shared rect`);
      }
    });

    test("moves only the named face when free", () => {
      const region = makeFree().withRect(nextRect, "left");

      assert.deepStrictEqual(region.rectFor("left"), nextRect);
      for (const face of DEFAULT_UV_SLOTS.filter((value) => value !== "left")) {
        assert.deepStrictEqual(region.rectFor(face), REGION_RECT, `${face} must stay put`);
      }
    });

    test("is a no-op when free and no face is given", () => {
      const region = makeFree();

      assert.strictEqual(
        region.withRect(nextRect),
        region,
        "moving every face at once is not supported yet"
      );
    });

    test("leaves the source region untouched", () => {
      const region = makeFree();
      region.withRect(nextRect, "left");

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
      assert.strictEqual(region.name, "Grass block");

      const changed = region
        .free()
        .withRect(nextRect, "front")
        .stack();

      assert.strictEqual(changed.name, "Grass block");
    });
  });
});
