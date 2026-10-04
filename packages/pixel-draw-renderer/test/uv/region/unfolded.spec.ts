// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVRegion,
  DEFAULT_UV_SLOTS,
  type UVSlot
} from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

function stackedRegion(
  rect: SelectionRect = { x: 0, y: 0, width: 4, height: 4 }
): UVRegion {
  return new UVRegion({
    state: "stacked",
    id: "r1",
    color: "#f00",
    rect
  });
}

function rects(
  region: UVRegion
): Record<UVSlot, SelectionRect> {
  return Object.fromEntries(
    region.slotsOf().map(({ slot, geometry }) => [slot, "shape" in geometry ? geometry.rect : geometry])
  );
}

describe("UVRegion — unfold", () => {
  test("packs every face into a net anchored on the stacked rect", () => {
    const unfolded = stackedRegion({ x: 8, y: 8, width: 4, height: 4 }).unfold();

    assert.strictEqual(unfolded.state, "unfolded");
    assert.deepStrictEqual(rects(unfolded), {
      front: { x: 8, y: 8, width: 4, height: 4 },
      back: { x: 12, y: 8, width: 4, height: 4 },
      left: { x: 8, y: 12, width: 4, height: 4 },
      right: { x: 12, y: 12, width: 4, height: 4 },
      top: { x: 8, y: 16, width: 4, height: 4 },
      bottom: { x: 12, y: 16, width: 4, height: 4 }
    });
  });

  test("reports the net bounds as the region rect for every face", () => {
    const unfolded = stackedRegion().unfold();
    const bounds = { x: 0, y: 0, width: 8, height: 12 };

    assert.deepStrictEqual(unfolded.bounds, bounds);
    for (const face of DEFAULT_UV_SLOTS) {
      assert.deepStrictEqual(unfolded.rectFor(face), bounds);
    }
  });

  test("returns the same instance when already unfolded", () => {
    const unfolded = stackedRegion().unfold();

    assert.strictEqual(unfolded.unfold(), unfolded);
  });

  test("repacks a hand-arranged free region, discarding its layout", () => {
    const arranged = stackedRegion()
      .free()
      .withRect({ x: 40, y: 40, width: 4, height: 4 }, "top");

    assert.deepStrictEqual(
      rects(arranged.unfold()).top,
      { x: 0, y: 8, width: 4, height: 4 }
    );
  });

  test("unfolding is idempotent, so a repeated unfold packs the same net", () => {
    const once = stackedRegion().unfold();

    assert.deepStrictEqual(
      rects(once.free().unfold()),
      rects(once)
    );
  });

  test("keeps a five-face ramp's triangles while packing them", () => {
    const ramp = new UVRegion({
      state: "stacked",
      id: "ramp",
      color: "#f00",
      rect: { x: 0, y: 0, width: 4, height: 4 },
      activeFaces: ["back", "left", "right", "top", "bottom"],
      faces: {
        back: { x: 0, y: 0, width: 4, height: 4 },
        left: {
          shape: "triangle",
          corner: "bottom-right",
          rect: { x: 0, y: 0, width: 4, height: 4 }
        },
        right: {
          shape: "triangle",
          corner: "bottom-right",
          rect: { x: 0, y: 0, width: 4, height: 4 }
        },
        top: { x: 0, y: 0, width: 4, height: 4 },
        bottom: { x: 0, y: 0, width: 4, height: 4 }
      }
    }).unfold();

    assert.deepStrictEqual(ramp.geometryFor("left"), {
      shape: "triangle",
      corner: "bottom-right",
      rect: { x: 4, y: 0, width: 4, height: 4 }
    });
    assert.deepStrictEqual(ramp.bounds, { x: 0, y: 0, width: 8, height: 12 });
  });

  test("facesOf yields one entry per active face, none of them null", () => {
    const faces = stackedRegion().unfold().slotsOf();

    assert.deepStrictEqual(
      faces.map(({ slot }) => slot),
      [...DEFAULT_UV_SLOTS]
    );
  });
});

describe("UVRegion — transitions out of unfolded", () => {
  test("free keeps every face exactly where the net put it", () => {
    const unfolded = stackedRegion().unfold();
    const freed = unfolded.free();

    assert.strictEqual(freed.state, "free");
    assert.deepStrictEqual(rects(freed), rects(unfolded));
  });

  test("stack collapses the net back onto its starting rect at the first largest face", () => {
    const stacked = stackedRegion({ x: 8, y: 8, width: 4, height: 4 })
      .unfold()
      .stack();

    assert.strictEqual(stacked.state, "stacked");
    assert.strictEqual(stacked.stackedFace, "front");
    assert.deepStrictEqual(
      stacked.rectFor("front"),
      { x: 8, y: 8, width: 4, height: 4 }
    );
  });

  test("stack honours a requested face, moving the region onto that cell", () => {
    const stacked = stackedRegion().unfold().stack("bottom");

    assert.strictEqual(stacked.stackedFace, "bottom");
    assert.deepStrictEqual(
      stacked.rectFor("front"),
      { x: 4, y: 8, width: 4, height: 4 }
    );
  });
});

describe("UVRegion — moving an unfolded region", () => {
  test("withRect translates every face by the bounds delta", () => {
    const moved = stackedRegion()
      .unfold()
      .withRect({ x: 5, y: 7, width: 8, height: 12 });

    assert.deepStrictEqual(moved.bounds, { x: 5, y: 7, width: 8, height: 12 });
    assert.deepStrictEqual(rects(moved).bottom, { x: 9, y: 15, width: 4, height: 4 });
  });

  test("withRect ignores the face argument", () => {
    const target = { x: 5, y: 7, width: 8, height: 12 };
    const unfolded = stackedRegion().unfold();

    assert.deepStrictEqual(
      rects(unfolded.withRect(target, "top")),
      rects(unfolded.withRect(target))
    );
  });

  test("round-trips through JSON", () => {
    const unfolded = stackedRegion().unfold();
    const data = unfolded.toJSON();

    assert.strictEqual(data.state, "unfolded");
    assert.deepStrictEqual(rects(UVRegion.from(data)), rects(unfolded));
  });
});
