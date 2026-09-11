// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVMap } from "#src/uv/UVMap.ts";
import { UVController } from "#src/uv/UVController.ts";
import {
  UVRegion,
  DEFAULT_UV_SLOTS,
  type UVSlot
} from "#src/uv/UVRegion.ts";
import type { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import type {
  SelectionRect,
  Vec2
} from "#src/types.ts";

class FakeOverlay {
  overrides: { id: string; face: UVSlot | null; rect: SelectionRect | null; }[] = [];

  setLiveOverride(
    id: string,
    face: UVSlot | null,
    rect: SelectionRect | null
  ): void {
    this.overrides.push({ id, face, rect });
  }
}

function makeMap(
  size: Vec2 = { x: 64, y: 64 }
): UVMap {
  return new UVMap({ getCanvasSize: () => size });
}

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

  test("stack collapses the net back onto the first largest face", () => {
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

  test("a stacked round-trip returns the region to its starting rect", () => {
    const rect = { x: 12, y: 20, width: 4, height: 4 };

    assert.deepStrictEqual(
      stackedRegion(rect).unfold().stack()
        .rectFor("front"),
      rect
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

describe("UVMap — setState unfolded", () => {
  test("stores the packed net and reports the previous region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: { state: string; previous: string; }[] = [];
    map.on("region-state-changed", ({ region: next, previous }) => {
      events.push({ state: next.state, previous: previous.state });
    });

    assert.ok(map.setState(region.id, "unfolded"));
    assert.strictEqual(map.get(region.id)!.state, "unfolded");
    assert.deepStrictEqual(events, [{ state: "unfolded", previous: "stacked" }]);
  });

  test("is a no-op on a region already unfolded", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.setState(region.id, "unfolded");
    assert.ok(!map.setState(region.id, "unfolded"));
  });

  test("shifts a net that overhangs back inside the canvas", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 8, height: 8 });
    map.move(region.id, { x: 8, y: 8, width: 8, height: 8 });

    map.setState(region.id, "unfolded");

    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 0, y: 0, width: 16, height: 24 }
    );
  });

  test("leaves a net taller than the canvas hanging off the far edge", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 8, height: 8 });

    map.setState(region.id, "unfolded");

    const bounds = map.get(region.id)!.bounds;
    assert.deepStrictEqual(bounds, { x: 0, y: 0, width: 16, height: 24 });
    assert.ok(bounds.height > 16, "the transition still succeeds");
  });

  test("creates a region directly in the unfolded state", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4, state: "unfolded" });

    assert.strictEqual(region.state, "unfolded");
    assert.deepStrictEqual(region.bounds, { x: 0, y: 0, width: 8, height: 12 });
  });

  test("selects the region without a face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");

    map.select(region.id, "top");

    assert.strictEqual(map.selectedRegionId, region.id);
    assert.strictEqual(map.selectedSlot, null);
  });

  test("moves as a whole, reporting a null face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");
    const events: { face: UVSlot | null; previousRect: SelectionRect; }[] = [];
    map.on("region-moved", ({ face, previousRect }) => events.push({ face, previousRect }));

    assert.ok(map.move(region.id, { x: 4, y: 4, width: 8, height: 12 }, "top"));

    assert.deepStrictEqual(events, [
      { face: null, previousRect: { x: 0, y: 0, width: 8, height: 12 } }
    ]);
    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 4, y: 4, width: 8, height: 12 }
    );
  });
});

describe("UVController — dragging an unfolded region", () => {
  function makeSetup() {
    const map = makeMap();
    const overlay = new FakeOverlay();
    const controller = new UVController({
      uvMap: map,
      overlay: overlay as unknown as UVRegionLayer
    });
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");
    map.select(region.id);

    return { map, overlay, controller, id: region.id };
  }

  test("grabbing any cell drags the whole net", () => {
    const { map, controller, id } = makeSetup();

    controller.handleStart({ x: 6, y: 10 });
    controller.handleMove({ x: 8, y: 13 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(id)!.bounds,
      { x: 2, y: 3, width: 8, height: 12 }
    );
  });

  test("overrides the whole region, not the grabbed face", () => {
    const { overlay, controller } = makeSetup();

    controller.handleStart({ x: 6, y: 10 });
    controller.handleMove({ x: 8, y: 13 });

    assert.strictEqual(overlay.overrides.length, 1);
    assert.strictEqual(overlay.overrides[0].face, null);
    assert.deepStrictEqual(
      overlay.overrides[0].rect,
      { x: 2, y: 3, width: 8, height: 12 }
    );
  });

  test("cancelling a drag leaves the net where it started", () => {
    const { map, overlay, controller, id } = makeSetup();
    const before = map.get(id)!.bounds;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 9, y: 9 });
    controller.cancelDrag();

    assert.deepStrictEqual(map.get(id)!.bounds, before);
    assert.deepStrictEqual(overlay.overrides.at(-1), {
      id,
      face: null,
      rect: null
    });
  });
});
