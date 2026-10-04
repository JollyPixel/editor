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
  test("exposes its slots and active slots", () => {
    const region = makeFree();

    assert.deepStrictEqual(region.slots, DEFAULT_UV_SLOTS);
    assert.deepStrictEqual(region.activeSlots, DEFAULT_UV_SLOTS);
  });

  describe("construction", () => {
    test("rejects a stacked slot outside the region topology", () => {
      assert.throws(
        () => new UVRegion({
          state: "stacked",
          id: "r1",
          color: "#f00",
          rect: REGION_RECT,
          stackedFace: "missing"
        }),
        RangeError
      );
    });

    test("parses an explicit free payload", () => {
      const faces = {
        front: { x: 0, y: 0, width: 1, height: 1 },
        back: { x: 1, y: 0, width: 1, height: 1 },
        left: { x: 2, y: 0, width: 1, height: 1 },
        right: { x: 3, y: 0, width: 1, height: 1 },
        top: { x: 4, y: 0, width: 1, height: 1 },
        bottom: { x: 5, y: 0, width: 1, height: 1 }
      };
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces
      });

      assert.strictEqual(region.state, "free");
      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(
          region.rectFor(face),
          faces[face],
          `${face} must keep its own rect`
        );
      }
    });

    test("copies the incoming rect instead of aliasing it", () => {
      const rect = { ...REGION_RECT };
      const region = new UVRegion({ state: "stacked", id: "r1", color: "#f00", rect });
      rect.x = 99;

      assert.strictEqual(
        region.rectFor("front").x,
        REGION_RECT.x,
        "later caller mutation must not reach the region"
      );
    });

    test("from() passes an existing instance through unchanged", () => {
      const region = makeStacked();

      assert.strictEqual(UVRegion.from(region), region);
    });

    test("rejects a region with no active slot it has geometry for", () => {
      for (const activeFaces of [[], ["missing"]]) {
        assert.throws(
          () => new UVRegion({
            state: "free",
            id: "r1",
            color: "#f00",
            faces: { front: REGION_RECT },
            activeFaces
          }),
          RangeError
        );
      }
    });

    test("from() builds an instance out of raw data", () => {
      const region = UVRegion.from({ state: "stacked", id: "r1", color: "#f00", rect: REGION_RECT });

      assert.ok(region instanceof UVRegion);
      assert.strictEqual(region.state, "stacked");
    });
  });

  describe("rectFor / facesOf", () => {
    test("a stacked region returns its single rect for every face", () => {
      const region = makeStacked();

      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(region.rectFor(face), REGION_RECT, `${face} must share the rect`);
      }
    });

    test("slotsOf yields one null-slotted entry when stacked", () => {
      assert.deepStrictEqual(
        makeStacked().slotsOf(),
        [{ slot: null, geometry: REGION_RECT }]
      );
    });

    test("keeps triangle geometry and its bounds separate", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["left"],
        faces: {
          front: REGION_RECT,
          back: REGION_RECT,
          left: { shape: "triangle", corner: "top-right", rect: REGION_RECT },
          right: REGION_RECT,
          top: REGION_RECT,
          bottom: REGION_RECT
        }
      });

      assert.deepStrictEqual(region.rectFor("left"), REGION_RECT);
      assert.deepStrictEqual(region.slotsOf(), [{
        slot: "left",
        geometry: { shape: "triangle", corner: "top-right", rect: REGION_RECT }
      }]);
    });

    test("slotsOf yields six entries in default slot order when free", () => {
      const faces = makeFree().slotsOf();

      assert.deepStrictEqual(
        faces.map((entry) => entry.slot),
        [...DEFAULT_UV_SLOTS],
        "iteration order drives hit-testing and paint order"
      );
    });

    test("keeps active faces in the order the region declared them", () => {
      const rect = { ...REGION_RECT };
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["top", "left", "top"],
        faces: {
          front: rect,
          back: rect,
          left: rect,
          right: rect,
          top: rect,
          bottom: rect
        }
      });

      assert.deepStrictEqual(
        region.slotsOf().map(({ slot }) => slot),
        ["top", "left"]
      );
    });

    test("geometryFor returns a copy", () => {
      const region = makeStacked();
      const geometry = region.geometryFor("front");
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, REGION_RECT.x);
    });

    test("rectFor returns a copy", () => {
      const region = makeStacked();
      const rect = region.rectFor("front");
      rect.x = 99;

      assert.strictEqual(region.rectFor("front").x, REGION_RECT.x);
    });

    test("slotsOf returns geometry copies", () => {
      const region = makeFree();
      const [{ geometry }] = region.slotsOf();
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, REGION_RECT.x);
    });
  });

  describe("free", () => {
    test("gives every face the current rect, so the mesh does not change", () => {
      const region = makeFree();

      assert.strictEqual(region.state, "free");
      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(region.rectFor(face), REGION_RECT, `${face} must start where the region was`);
      }
    });

    test("returns the same instance when already free", () => {
      const region = makeFree();

      assert.strictEqual(region.free(), region);
    });

    test("leaves the source region untouched", () => {
      const region = makeStacked();
      const before = region.toJSON();
      region.free();

      assert.deepStrictEqual(region.toJSON(), before);
    });
  });

  test("DEFAULT_UV_SLOTS lists every built-in UVSlot once, in hit-testing and paint order", () => {
    assert.deepStrictEqual(
      [...DEFAULT_UV_SLOTS],
      ["front", "back", "left", "right", "top", "bottom"]
    );
  });
});
