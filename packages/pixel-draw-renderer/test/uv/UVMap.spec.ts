// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVMap,
  type UVMapEvent
} from "#src/uv/UVMap.ts";
import type { Vec2 } from "#src/types.ts";

function makeMap(
  size: Vec2 = { x: 32, y: 32 }
): UVMap {
  return new UVMap({ getCanvasSize: () => size });
}

describe("UVMap — create", () => {
  test("creates a region with the requested size at the origin, with a palette color", () => {
    const map = makeMap();
    const region = map.create({ width: 8, height: 8 });

    assert.deepStrictEqual(
      region.rect,
      { x: 0, y: 0, width: 8, height: 8 }
    );
    assert.strictEqual(typeof region.color, "string");
    assert.strictEqual([...map.regions].length, 1);
  });

  test("clamps width/height to the canvas size", () => {
    const map = makeMap({ x: 4, y: 4 });
    const region = map.create({ width: 100, height: 100 });

    assert.deepStrictEqual(
      region.rect,
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("cascades subsequent regions instead of stacking them at the origin", () => {
    const map = makeMap();
    const a = map.create({ width: 8, height: 8 });
    const b = map.create({ width: 8, height: 8 });

    assert.notDeepStrictEqual(a.rect, b.rect);
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

  test("emits a region-created event", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-created", (e) => events.push(e));

    const region = map.create({ width: 4, height: 4 });

    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(
      events[0],
      { type: "region-created", region }
    );
  });
});

describe("UVMap — restore", () => {
  test("re-adds a region exactly as given and emits region-created", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-created", (e) => events.push(e));

    const region = {
      id: "r1",
      rect: { x: 3, y: 3, width: 2, height: 2 },
      color: "#abcdef"
    };
    const stored = map.restore(region);

    assert.deepStrictEqual(stored, region);
    assert.deepStrictEqual(map.get("r1"), region);
    assert.strictEqual(events.length, 1);
  });

  test("does not affect cascading placement of subsequent create() calls", () => {
    const map = makeMap();
    map.restore({
      id: "r1",
      rect: { x: 10, y: 10, width: 2, height: 2 },
      color: "#000"
    });
    const created = map.create({ width: 2, height: 2 });

    assert.deepStrictEqual(
      created.rect,
      { x: 0, y: 0, width: 2, height: 2 }
    );
  });
});

describe("UVMap — delete", () => {
  test("removes the region and emits region-deleted with its last-known state", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-deleted", (e) => events.push(e));

    const result = map.delete(region.id);

    assert.ok(result);
    assert.strictEqual(map.get(region.id), undefined);
    assert.deepStrictEqual(
      events[0],
      { type: "region-deleted", region }
    );
  });

  test("returns false for an unknown id and does not emit", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-deleted", (e) => events.push(e));

    assert.ok(!map.delete("no-such"));
    assert.strictEqual(events.length, 0);
  });

  test("clears selectedRegionId when the selected region is deleted", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.delete(region.id);

    assert.strictEqual(map.selectedRegionId, null);
  });
});

describe("UVMap — move", () => {
  test("updates the rect and emits region-moved with the previous rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-moved", (e) => events.push(e));

    const result = map.move(
      region.id,
      { x: 10, y: 10, width: 4, height: 4 }
    );

    assert.ok(result);
    assert.deepStrictEqual(
      map.get(region.id)!.rect,
      { x: 10, y: 10, width: 4, height: 4 }
    );
    assert.deepStrictEqual(events[0], {
      type: "region-moved",
      region: {
        ...region,
        rect: {
          x: 10,
          y: 10,
          width: 4,
          height: 4
        }
      },
      previousRect: {
        x: 0,
        y: 0,
        width: 4,
        height: 4
      }
    });
  });

  test("clamps the destination rect to canvas bounds", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });

    map.move(
      region.id,
      { x: 100, y: 100, width: 4, height: 4 }
    );

    assert.deepStrictEqual(
      map.get(region.id)!.rect,
      { x: 12, y: 12, width: 4, height: 4 }
    );
  });

  test("returns false for an unknown id", () => {
    const map = makeMap();
    assert.ok(
      !map.move("no-such", {
        x: 0, y: 0, width: 1, height: 1
      })
    );
  });
});

describe("UVMap — previewMove", () => {
  test("emits region-dragging with the clamped rect, without mutating the stored region", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(
      region.id,
      { x: 100, y: 100, width: 4, height: 4 }
    );

    assert.deepStrictEqual(events, [
      {
        type: "region-dragging",
        id: region.id,
        rect: { x: 12, y: 12, width: 4, height: 4 }
      }
    ]);
    assert.deepStrictEqual(
      map.get(region.id)!.rect,
      region.rect,
      "stored rect must be unchanged"
    );
  });

  test("does not record history or affect move()'s previousRect bookkeeping", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const moveEvents: Extract<UVMapEvent, { type: "region-moved"; }>[] = [];
    map.on("region-moved", (e) => moveEvents.push(e));

    map.previewMove(
      region.id,
      { x: 5, y: 5, width: 4, height: 4 }
    );
    map.previewMove(
      region.id,
      { x: 6, y: 6, width: 4, height: 4 }
    );
    map.move(
      region.id,
      { x: 6, y: 6, width: 4, height: 4 }
    );

    assert.strictEqual(moveEvents.length, 1);
    assert.deepStrictEqual(moveEvents[0].previousRect, region.rect);
  });

  test("is a no-op for an unknown id", () => {
    const map = makeMap();
    const events: UVMapEvent[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(
      "no-such",
      { x: 0, y: 0, width: 1, height: 1 }
    );

    assert.strictEqual(events.length, 0);
  });
});

describe("UVMap — select / isVisible / showAll", () => {
  test("nothing is visible by default", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(!map.isVisible(region.id));
  });

  test("a selected region becomes visible", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.select(region.id);
    assert.ok(map.isVisible(region.id));
  });

  test("showAll makes every region visible regardless of selection", () => {
    const map = makeMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    map.showAll = true;
    assert.ok(map.isVisible(a.id));
    assert.ok(map.isVisible(b.id));
  });

  test("ignores selecting an unknown id", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select("no-such");

    assert.strictEqual(map.selectedRegionId, region.id);
  });

  test("select(null) deselects", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select(null);

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("emits selection-changed only when the selection actually changes", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: UVMapEvent[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id);
    map.select(region.id);
    map.select(null);

    assert.strictEqual(events.length, 2);
  });

  test("emits visibility-changed only when showAll actually changes", () => {
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
  test("removes every region and resets cascading placement", () => {
    const map = makeMap();
    map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });

    map.clear();
    assert.strictEqual([...map.regions].length, 0);

    const region = map.create({ width: 4, height: 4 });
    assert.deepStrictEqual(
      region.rect,
      { x: 0, y: 0, width: 4, height: 4 },
      "rect must be { x: 0, y: 0, width: 4, height: 4 }"
    );
  });
});

describe("UVMap — on/off", () => {
  test("off() stops a listener from receiving further events", () => {
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
