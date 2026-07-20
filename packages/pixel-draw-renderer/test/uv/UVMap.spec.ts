// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVMap, type UVMapEvent } from "../../src/uv/UVMap.ts";
import type { Vec2 } from "../../src/types.ts";

function makeMap(
  size: Vec2 = { x: 32, y: 32 }
): UVMap {
  return new UVMap({ getCanvasSize: () => size });
}

describe("UVMap — create", () => {
  it("creates a region with the requested size at the origin, with a palette color", () => {
    const map = makeMap();
    const region = map.create({ width: 8, height: 8 });

    assert.deepStrictEqual(region.rect, { x: 0, y: 0, width: 8, height: 8 });
    assert.strictEqual(typeof region.color, "string");
    assert.strictEqual([...map.regions].length, 1);
  });

  it("clamps width/height to the canvas size", () => {
    const map = makeMap({ x: 4, y: 4 });
    const region = map.create({ width: 100, height: 100 });

    assert.deepStrictEqual(region.rect, { x: 0, y: 0, width: 4, height: 4 });
  });

  it("cascades subsequent regions instead of stacking them at the origin", () => {
    const map = makeMap();
    const a = map.create({ width: 8, height: 8 });
    const b = map.create({ width: 8, height: 8 });

    assert.notDeepStrictEqual(a.rect, b.rect);
  });

  it("assigns distinct colors from the palette to successive regions", () => {
    const map = makeMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    assert.notStrictEqual(a.color, b.color);
  });

  it("accepts an explicit id and color", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4, id: "custom-id", color: "#123456" });

    assert.strictEqual(region.id, "custom-id");
    assert.strictEqual(region.color, "#123456");
  });

  it("emits a region-created event", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-created", (e) => events.push(e));

    const region = map.create({ width: 4, height: 4 });

    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(events[0], { type: "region-created", region });
  });
});

describe("UVMap — restore", () => {
  it("re-adds a region exactly as given and emits region-created", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-created", (e) => events.push(e));

    const region = { id: "r1", rect: { x: 3, y: 3, width: 2, height: 2 }, color: "#abcdef" };
    const stored = map.restore(region);

    assert.deepStrictEqual(stored, region);
    assert.deepStrictEqual(map.get("r1"), region);
    assert.strictEqual(events.length, 1);
  });

  it("does not affect cascading placement of subsequent create() calls", () => {
    const map = makeMap();
    map.restore({ id: "r1", rect: { x: 10, y: 10, width: 2, height: 2 }, color: "#000" });
    const created = map.create({ width: 2, height: 2 });

    assert.deepStrictEqual(created.rect, { x: 0, y: 0, width: 2, height: 2 });
  });
});

describe("UVMap — delete", () => {
  it("removes the region and emits region-deleted with its last-known state", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-deleted", (e) => events.push(e));

    const result = map.delete(region.id);

    assert.strictEqual(result, true);
    assert.strictEqual(map.get(region.id), undefined);
    assert.deepStrictEqual(events[0], { type: "region-deleted", region });
  });

  it("returns false for an unknown id and does not emit", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-deleted", (e) => events.push(e));

    assert.strictEqual(map.delete("no-such"), false);
    assert.strictEqual(events.length, 0);
  });

  it("clears selectedRegionId when the selected region is deleted", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.delete(region.id);

    assert.strictEqual(map.selectedRegionId, null);
  });
});

describe("UVMap — move", () => {
  it("updates the rect and emits region-moved with the previous rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-moved", (e) => events.push(e));

    const result = map.move(region.id, { x: 10, y: 10, width: 4, height: 4 });

    assert.strictEqual(result, true);
    assert.deepStrictEqual(map.get(region.id)!.rect, { x: 10, y: 10, width: 4, height: 4 });
    assert.deepStrictEqual(events[0], {
      type: "region-moved",
      region: { ...region, rect: { x: 10, y: 10, width: 4, height: 4 } },
      previousRect: { x: 0, y: 0, width: 4, height: 4 }
    });
  });

  it("clamps the destination rect to canvas bounds", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });

    map.move(region.id, { x: 100, y: 100, width: 4, height: 4 });

    assert.deepStrictEqual(map.get(region.id)!.rect, { x: 12, y: 12, width: 4, height: 4 });
  });

  it("returns false for an unknown id", () => {
    const map = makeMap();
    assert.strictEqual(map.move("no-such", { x: 0, y: 0, width: 1, height: 1 }), false);
  });
});

describe("UVMap — previewMove", () => {
  it("emits region-dragging with the clamped rect, without mutating the stored region", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(region.id, { x: 100, y: 100, width: 4, height: 4 });

    assert.deepStrictEqual(events, [
      { type: "region-dragging", id: region.id, rect: { x: 12, y: 12, width: 4, height: 4 } }
    ]);
    assert.deepStrictEqual(map.get(region.id)!.rect, region.rect, "stored rect must be unchanged");
  });

  it("does not record history or affect move()'s previousRect bookkeeping", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const moveEvents: Extract<UVMapEvent, { type: "region-moved"; }>[] = [];
    map.on("region-moved", (e) => moveEvents.push(e));

    map.previewMove(region.id, { x: 5, y: 5, width: 4, height: 4 });
    map.previewMove(region.id, { x: 6, y: 6, width: 4, height: 4 });
    map.move(region.id, { x: 6, y: 6, width: 4, height: 4 });

    assert.strictEqual(moveEvents.length, 1);
    assert.deepStrictEqual(moveEvents[0].previousRect, region.rect);
  });

  it("is a no-op for an unknown id", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove("no-such", { x: 0, y: 0, width: 1, height: 1 });

    assert.strictEqual(events.length, 0);
  });
});

describe("UVMap — select / isVisible / showAll", () => {
  it("nothing is visible by default", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.strictEqual(map.isVisible(region.id), false);
  });

  it("a selected region becomes visible", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.select(region.id);
    assert.strictEqual(map.isVisible(region.id), true);
  });

  it("showAll makes every region visible regardless of selection", () => {
    const map = makeMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    map.showAll = true;
    assert.strictEqual(map.isVisible(a.id), true);
    assert.strictEqual(map.isVisible(b.id), true);
  });

  it("ignores selecting an unknown id", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select("no-such");

    assert.strictEqual(map.selectedRegionId, region.id);
  });

  it("select(null) deselects", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select(null);

    assert.strictEqual(map.selectedRegionId, null);
  });

  it("emits selection-changed only when the selection actually changes", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id);
    map.select(region.id);
    map.select(null);

    assert.strictEqual(events.length, 2);
  });

  it("emits visibility-changed only when showAll actually changes", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("visibility-changed", (e) => events.push(e));

    map.showAll = true;
    map.showAll = true;
    map.showAll = false;

    assert.strictEqual(events.length, 2);
  });
});

describe("UVMap — clear", () => {
  it("removes every region and resets cascading placement", () => {
    const map = makeMap();
    map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });

    map.clear();
    assert.strictEqual([...map.regions].length, 0);

    const region = map.create({ width: 4, height: 4 });
    assert.deepStrictEqual(region.rect, { x: 0, y: 0, width: 4, height: 4 });
  });
});

describe("UVMap — on/off", () => {
  it("off() stops a listener from receiving further events", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    function listener(
      e: Extract<UVMapEvent, { type: "region-created"; }>
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
