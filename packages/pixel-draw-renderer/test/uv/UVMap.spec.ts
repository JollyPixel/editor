// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { UVRegionData } from "#src/uv/UVRegion.ts";
import { makeMap, type EventPayload } from "../helpers/uv-map.ts";

describe("UVMap — create", () => {
  test("accepts slot-named topology options", () => {
    const uv = makeMap();
    const region = uv.create({
      width: 4,
      height: 4,
      activeSlots: ["side"],
      slotGeometries: {
        side: {
          shape: "triangle",
          corner: "top-left"
        }
      }
    });

    assert.deepStrictEqual(region.activeSlots, ["side"]);
    const geometry = region.geometryFor("side");
    assert.ok("shape" in geometry);
    assert.strictEqual(geometry.shape, "triangle");
  });

  test("creates a five-face ramp with triangular sides", () => {
    const map = makeMap();
    const region = map.create({
      width: 8,
      height: 8,
      activeSlots: ["back", "left", "right", "top", "bottom"],
      slotGeometries: {
        left: { shape: "triangle", corner: "bottom-right" },
        right: { shape: "triangle", corner: "bottom-right" }
      }
    });

    assert.strictEqual(region.state, "free");
    assert.deepStrictEqual(region.slotsOf().map(({ slot }) => slot), [
      "back", "left", "right", "top", "bottom"
    ]);
    assert.deepStrictEqual(region.geometryFor("left"), {
      shape: "triangle", corner: "bottom-right", rect: { x: 0, y: 0, width: 8, height: 8 }
    });
  });

  test("creates a stacked ramp when requested", () => {
    const map = makeMap();
    const region = map.create({
      width: 8,
      height: 8,
      state: "stacked",
      activeSlots: ["back", "left", "right", "top", "bottom"],
      slotGeometries: {
        left: { shape: "triangle", corner: "bottom-right" },
        right: { shape: "triangle", corner: "bottom-right" }
      }
    });

    assert.strictEqual(region.state, "stacked");
    assert.deepStrictEqual(region.slotsOf().map(({ slot }) => slot), [null]);
    assert.deepStrictEqual(region.toJSON().activeFaces, ["back", "left", "right", "top", "bottom"]);
    assert.deepStrictEqual(region.toJSON().faces?.left, {
      shape: "triangle", corner: "bottom-right", rect: { x: 0, y: 0, width: 8, height: 8 }
    });
  });
  test("creates a region with the requested size at the origin, with a palette color", () => {
    const map = makeMap();
    const region = map.create({ width: 8, height: 8 });

    assert.deepStrictEqual(
      region.rectFor("front"),
      { x: 0, y: 0, width: 8, height: 8 }
    );
    assert.strictEqual(typeof region.color, "string");
    assert.strictEqual([...map.regions].length, 1);
  });

  test("creates stacked regions", () => {
    const map = makeMap();

    assert.strictEqual(map.create({ width: 8, height: 8 }).state, "stacked");
  });

  test("clamps width/height to the canvas size", () => {
    const map = makeMap({ x: 4, y: 4 });
    const region = map.create({ width: 100, height: 100 });

    assert.deepStrictEqual(
      region.rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("cascades subsequent regions instead of stacking them at the origin", () => {
    const map = makeMap();
    const a = map.create({ width: 8, height: 8 });
    const b = map.create({ width: 8, height: 8 });

    assert.notDeepStrictEqual(a.rectFor("front"), b.rectFor("front"));
  });

  test("assigns distinct colors from the palette to successive regions", () => {
    const map = makeMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    assert.notStrictEqual(a.color, b.color);
  });

  test("accepts an explicit id and color", () => {
    const map = makeMap();
    const region = map.create({
      width: 4,
      height: 4,
      id: "custom-id",
      color: "#123456"
    });

    assert.strictEqual(region.id, "custom-id");
    assert.strictEqual(region.color, "#123456");
  });

  test("accepts an optional region name", () => {
    const map = makeMap();
    const region = map.create({
      width: 4,
      height: 4,
      name: "Grass block"
    });

    assert.strictEqual(region.name, "Grass block");
  });

  test("emits a region-created event", () => {
    const map = makeMap();
    const events: EventPayload<"region-created">[] = [];
    map.on("region-created", (e) => events.push(e));

    const region = map.create({ width: 4, height: 4 });

    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(
      events[0],
      { region }
    );
  });
});

describe("UVMap — restore", () => {
  test("re-adds a region exactly as given and emits region-created", () => {
    const map = makeMap();
    const events: EventPayload<"region-created">[] = [];
    map.on("region-created", (e) => events.push(e));

    const region: UVRegionData = {
      state: "stacked",
      id: "r1",
      rect: { x: 3, y: 3, width: 2, height: 2 },
      color: "#abcdef"
    };
    const stored = map.restore(region);

    assert.deepStrictEqual(stored.toJSON(), {
      ...region,
      state: "stacked"
    });
    assert.strictEqual(map.get("r1"), stored);
    assert.strictEqual(events.length, 1);
  });

  test("restores an free region from raw data", () => {
    const map = makeMap();
    const stored = map.restore({
      id: "r1",
      color: "#abcdef",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 2, height: 2 },
        back: { x: 2, y: 0, width: 2, height: 2 },
        left: { x: 4, y: 0, width: 2, height: 2 },
        right: { x: 6, y: 0, width: 2, height: 2 },
        top: { x: 8, y: 0, width: 2, height: 2 },
        bottom: { x: 10, y: 0, width: 2, height: 2 }
      }
    });

    assert.strictEqual(stored.state, "free");
    assert.deepStrictEqual(stored.rectFor("top"), { x: 8, y: 0, width: 2, height: 2 });
  });

  test("does not affect cascading placement of subsequent create() calls", () => {
    const map = makeMap();
    map.restore({
      state: "stacked",
      id: "r1",
      rect: { x: 10, y: 10, width: 2, height: 2 },
      color: "#000"
    });
    const created = map.create({ width: 2, height: 2 });

    assert.deepStrictEqual(
      created.rectFor("front"),
      { x: 0, y: 0, width: 2, height: 2 }
    );
  });

  // A duplicated or echoed uv-region-created command used to emit a second
  // region-created for a region the listener already tracked, which had the
  // examples gallery build a second preview mesh and orphan the first.
  test("restoring a known id reports a state change, not a second creation", () => {
    const map = makeMap();
    const created: EventPayload<"region-created">[] = [];
    const changed: EventPayload<"region-state-changed">[] = [];
    map.on("region-created", (e) => created.push(e));
    map.on("region-state-changed", (e) => changed.push(e));

    const region = map.create({ id: "r1", width: 4, height: 4 });
    map.restore({
      ...region.toJSON(),
      color: "#123456"
    });

    assert.strictEqual(created.length, 1, "no duplicate creation");
    assert.strictEqual(changed.length, 1);
    assert.strictEqual(changed[0].previous.color, region.color);
    assert.strictEqual(map.get("r1")!.color, "#123456");
    assert.strictEqual([...map.regions].length, 1);
  });

  test("restoring identical data for a known id adds neither a region nor a creation", () => {
    const map = makeMap();
    const region = map.create({ id: "r1", width: 4, height: 4 });
    const created: EventPayload<"region-created">[] = [];
    map.on("region-created", (e) => created.push(e));

    const stored = map.restore(region.toJSON());

    assert.strictEqual(created.length, 0);
    assert.strictEqual(stored.id, "r1");
    assert.strictEqual([...map.regions].length, 1);
  });
});

describe("UVMap — delete", () => {
  test("removes the region and emits region-deleted with its last-known state", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-deleted">[] = [];
    map.on("region-deleted", (e) => events.push(e));

    const result = map.delete(region.id);

    assert.ok(result);
    assert.strictEqual(map.get(region.id), undefined);
    assert.deepStrictEqual(
      events[0],
      { region }
    );
  });

  test("returns false for an unknown id and does not emit", () => {
    const map = makeMap();
    const events: EventPayload<"region-deleted">[] = [];
    map.on("region-deleted", (e) => events.push(e));

    assert.ok(!map.delete("no-such"));
    assert.strictEqual(events.length, 0);
  });

  test("clears selection and emits selection-changed when the selected region is deleted", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.select(region.id, "top");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.delete(region.id);

    assert.strictEqual(map.selectedRegionId, null);
    assert.strictEqual(map.selectedSlot, null);
    assert.deepStrictEqual(events, [{
      selectedRegionId: null,
      selectedSlot: null
    }]);
  });
});

describe("UVMap — clear", () => {
  test("removes every region and resets cascading placement", () => {
    const map = makeMap();
    map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });

    map.clear();
    assert.strictEqual([...map.regions].length, 0);

    const region = map.create({ width: 4, height: 4 });
    assert.deepStrictEqual(
      region.rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 },
      "rect must be { x: 0, y: 0, width: 4, height: 4 }"
    );
  });

  test("terminates when a listener restores a region while clearing", () => {
    const map = makeMap();
    const first = map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });

    // The voxel-map bridge puts a block region back as soon as it is
    // deleted; clearing must not feed that re-insertion back into itself.
    let restored = 0;
    map.on("region-deleted", ({ region }) => {
      if (region.id === first.id && restored < 8) {
        restored++;
        map.restore(region);
      }
    });

    map.clear();

    assert.strictEqual(restored, 1);
    assert.deepStrictEqual([...map.regions].map((region) => region.id), [first.id]);
  });
});

describe("UVMap — on/off", () => {
  test("off() stops a listener from receiving further events", () => {
    const map = makeMap();
    const events: EventPayload<"region-created">[] = [];
    function listener(
      e: EventPayload<"region-created">
    ): void {
      events.push(e);
    }

    map.on("region-created", listener);
    map.create({ width: 4, height: 4 });
    map.off("region-created", listener);
    map.create({ width: 4, height: 4 });

    assert.strictEqual(events.length, 1);
  });
});
