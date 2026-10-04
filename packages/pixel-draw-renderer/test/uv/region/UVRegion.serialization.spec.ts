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
import {
  REGION_RECT,
  makeStacked,
  makeFree
} from "../../helpers/uv/region.ts";

describe("UVRegion", () => {
  describe("layout", () => {
    test("a layout is the region without its identity", () => {
      const region = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Head",
        color: "#f00",
        rect: REGION_RECT
      });

      assert.deepStrictEqual(region.toLayout(), {
        state: "stacked",
        rect: REGION_RECT
      });
    });

    test("fromLayout rebuilds the region with the given identity", () => {
      const region = UVRegion.fromLayout(makeFree().toLayout(), {
        id: "r2",
        name: "Body",
        color: "#0f0"
      });

      assert.strictEqual(region.id, "r2");
      assert.strictEqual(region.name, "Body");
      assert.strictEqual(region.color, "#0f0");
      assert.deepStrictEqual(region.toLayout(), makeFree().toLayout());
    });
  });

  describe("toJSON", () => {
    test("emits an explicit stacked payload", () => {
      assert.deepStrictEqual(makeStacked().toJSON(), {
        id: "r1",
        color: "#f00",
        state: "stacked",
        rect: REGION_RECT
      });
    });

    test("emits every face when free", () => {
      const data = makeFree().toJSON();

      assert.strictEqual(data.state, "free");
      assert.deepStrictEqual(
        Object.keys(data.state === "free" ? data.faces : {}).sort(),
        [...DEFAULT_UV_SLOTS].sort()
      );
    });

    test("includes the optional name", () => {
      const data = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: REGION_RECT
      }).toJSON();

      assert.strictEqual(data.name, "Grass block");
    });

    test("round-trips through JSON", () => {
      const region = makeFree().withRect({ x: 5, y: 5, width: 1, height: 1 }, "bottom");
      const restored = UVRegion.from(
        JSON.parse(JSON.stringify(region)) as ReturnType<UVRegion["toJSON"]>
      );

      assert.strictEqual(restored.state, "free");
      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          region.rectFor(face),
          `${face} must survive serialization`
        );
      }
    });

    test("returns copies the caller cannot use to mutate the region", () => {
      const region = makeStacked();
      const data = region.toJSON();
      if (data.state === "stacked") {
        data.rect.x = 99;
      }

      assert.strictEqual(region.rectFor("front").x, REGION_RECT.x);
    });
  });
});
