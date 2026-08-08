// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVMap,
  type UVMapEvent,
  type UVMapEventType
} from "#src/uv/UVMap.ts";
import { UV_FACES } from "#src/uv/UVRegion.ts";
import type { Vec2 } from "#src/types.ts";

type EventPayload<T extends UVMapEventType> = Parameters<UVMapEvent[T]>[0];

function makeMap(
  size: Vec2 = { x: 32, y: 32 }
): UVMap {
  return new UVMap({ getCanvasSize: () => size });
}

describe("UVMap — create", () => {
  test("creates a five-face ramp with triangular sides", () => {
    const map = makeMap();
    const region = map.create({
      width: 8,
      height: 8,
      activeFaces: ["back", "left", "right", "top", "bottom"],
      faceGeometries: {
        left: { shape: "triangle", corner: "bottom-right" },
        right: { shape: "triangle", corner: "bottom-right" }
      }
    });

    assert.strictEqual(region.state, "uncollapsed");
    assert.deepStrictEqual(region.facesOf().map(({ face }) => face), [
      "back", "left", "right", "top", "bottom"
    ]);
    assert.deepStrictEqual(region.geometryFor("left"), {
      shape: "triangle", corner: "bottom-right", rect: { x: 0, y: 0, width: 8, height: 8 }
    });
  });

  test("creates a collapsed ramp when requested", () => {
    const map = makeMap();
    const region = map.create({
      width: 8,
      height: 8,
      state: "collapsed",
      activeFaces: ["back", "left", "right", "top", "bottom"],
      faceGeometries: {
        left: { shape: "triangle", corner: "bottom-right" },
        right: { shape: "triangle", corner: "bottom-right" }
      }
    });

    assert.strictEqual(region.state, "collapsed");
    assert.deepStrictEqual(region.facesOf().map(({ face }) => face), [null]);
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

  test("creates collapsed regions", () => {
    const map = makeMap();

    assert.strictEqual(map.create({ width: 8, height: 8 }).state, "collapsed");
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

    const region = {
      id: "r1",
      rect: { x: 3, y: 3, width: 2, height: 2 },
      color: "#abcdef"
    };
    const stored = map.restore(region);

    assert.deepStrictEqual(stored.toJSON(), {
      ...region,
      state: "collapsed"
    });
    assert.strictEqual(map.get("r1"), stored);
    assert.strictEqual(events.length, 1);
  });

  test("restores an uncollapsed region from raw data", () => {
    const map = makeMap();
    const stored = map.restore({
      id: "r1",
      color: "#abcdef",
      state: "uncollapsed",
      faces: {
        front: { x: 0, y: 0, width: 2, height: 2 },
        back: { x: 2, y: 0, width: 2, height: 2 },
        left: { x: 4, y: 0, width: 2, height: 2 },
        right: { x: 6, y: 0, width: 2, height: 2 },
        top: { x: 8, y: 0, width: 2, height: 2 },
        bottom: { x: 10, y: 0, width: 2, height: 2 }
      }
    });

    assert.strictEqual(stored.state, "uncollapsed");
    assert.deepStrictEqual(stored.rectFor("top"), { x: 8, y: 0, width: 2, height: 2 });
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
      created.rectFor("front"),
      { x: 0, y: 0, width: 2, height: 2 }
    );
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

  test("clears selectedRegionId and selectedFace when the selected region is deleted", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.select(region.id, "top");

    map.delete(region.id);

    assert.strictEqual(map.selectedRegionId, null);
    assert.strictEqual(map.selectedFace, null);
  });
});

describe("UVMap — move", () => {
  test("updates the rect and emits region-moved with the previous rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-moved">[] = [];
    map.on("region-moved", (e) => events.push(e));

    const result = map.move(
      region.id,
      { x: 10, y: 10, width: 4, height: 4 }
    );

    assert.ok(result);
    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      { x: 10, y: 10, width: 4, height: 4 }
    );
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].region, map.get(region.id));
    assert.strictEqual(events[0].face, null, "a collapsed region moves as a whole");
    assert.deepStrictEqual(events[0].previousRect, { x: 0, y: 0, width: 4, height: 4 });
  });

  test("clamps the destination rect to canvas bounds", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });

    map.move(
      region.id,
      { x: 100, y: 100, width: 4, height: 4 }
    );

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
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

  test("moves a single face of an uncollapsed region, leaving the others put", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    const events: EventPayload<"region-moved">[] = [];
    map.on("region-moved", (e) => events.push(e));

    const result = map.move(
      region.id,
      { x: 10, y: 10, width: 4, height: 4 },
      "left"
    );

    assert.ok(result);
    const moved = map.get(region.id)!;
    assert.deepStrictEqual(moved.rectFor("left"), { x: 10, y: 10, width: 4, height: 4 });
    assert.deepStrictEqual(moved.rectFor("right"), { x: 0, y: 0, width: 4, height: 4 });
    assert.strictEqual(events[0].face, "left");
  });

  test("refuses to move an uncollapsed region when no face is given", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    const events: EventPayload<"region-moved">[] = [];
    map.on("region-moved", (e) => events.push(e));

    assert.ok(
      !map.move(region.id, { x: 10, y: 10, width: 4, height: 4 }),
      "moving every face at once is not supported yet"
    );
    assert.strictEqual(events.length, 0);
  });

  test("ignores the face argument for a collapsed region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(map.move(region.id, { x: 8, y: 8, width: 4, height: 4 }, "top"));
    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("back"),
      { x: 8, y: 8, width: 4, height: 4 }
    );
  });
});

describe("UVMap — previewMove", () => {
  test("emits region-dragging with the clamped rect, without mutating the stored region", () => {
    const map = makeMap({ x: 16, y: 16 });
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(
      region.id,
      { x: 100, y: 100, width: 4, height: 4 }
    );

    assert.deepStrictEqual(events, [
      {
        id: region.id,
        face: null,
        rect: { x: 12, y: 12, width: 4, height: 4 },
        geometry: { x: 12, y: 12, width: 4, height: 4 }
      }
    ]);
    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      region.rectFor("front"),
      "stored rect must be unchanged"
    );
  });

  test("carries the face for an uncollapsed region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(region.id, { x: 5, y: 5, width: 4, height: 4 }, "bottom");

    assert.strictEqual(events[0].face, "bottom");
  });

  test("carries moved triangle geometry without mutating its corner", () => {
    const map = makeMap();
    const region = map.create({
      width: 4,
      height: 4,
      activeFaces: ["left"],
      faceGeometries: {
        left: { shape: "triangle", corner: "top-right" }
      }
    });
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => events.push(event));

    map.previewMove(region.id, { x: 5, y: 6, width: 4, height: 4 }, "left");

    assert.deepStrictEqual(events[0].geometry, {
      shape: "triangle",
      corner: "top-right",
      rect: { x: 5, y: 6, width: 4, height: 4 }
    });
  });

  test("does not record history or affect move()'s previousRect bookkeeping", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const moveEvents: EventPayload<"region-moved">[] = [];
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
    assert.deepStrictEqual(moveEvents[0].previousRect, region.rectFor("front"));
  });

  test("is a no-op for an unknown id", () => {
    const map = makeMap();
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (e) => events.push(e));

    map.previewMove(
      "no-such",
      { x: 0, y: 0, width: 1, height: 1 }
    );

    assert.strictEqual(events.length, 0);
  });
});

describe("UVMap — uncollapse / collapse", () => {
  test("uncollapse gives every face the region's current rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(map.uncollapse(region.id));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "uncollapsed");
    for (const face of UV_FACES) {
      assert.deepStrictEqual(
        stored.rectFor(face),
        region.rectFor("front"),
        `${face} must not move when uncollapsing`
      );
    }
  });

  test("uncollapse emits region-state-changed carrying the previous region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-state-changed">[] = [];
    map.on("region-state-changed", (e) => events.push(e));

    map.uncollapse(region.id);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].region, map.get(region.id));
    assert.deepStrictEqual(events[0].previous, region.toJSON());
  });

  test("collapse keeps the requested face and discards the others", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");

    assert.ok(map.collapse(region.id, "top"));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "collapsed");
    assert.deepStrictEqual(stored.rectFor("front"), { x: 12, y: 12, width: 4, height: 4 });
  });

  test("collapse defaults to the front face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");

    map.collapse(region.id);

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("returns false for an unknown id or a redundant transition", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(!map.uncollapse("no-such"));
    assert.ok(!map.collapse(region.id), "already collapsed");
    assert.ok(map.uncollapse(region.id));
    assert.ok(!map.uncollapse(region.id), "already uncollapsed");
  });

  test("restoreState puts a whole region back without a create/delete cycle", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");
    const before = map.get(region.id)!.toJSON();

    map.collapse(region.id);
    const created: string[] = [];
    map.on("region-created", (e) => created.push(e.region.id));

    assert.ok(map.restoreState(before));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "uncollapsed");
    assert.deepStrictEqual(
      stored.rectFor("top"),
      { x: 12, y: 12, width: 4, height: 4 },
      "a discarded face must come back"
    );
    assert.deepStrictEqual(created, [], "restoring state is not a creation");
  });

  test("restoreState returns false for an unknown id", () => {
    const map = makeMap();

    assert.ok(
      !map.restoreState({
        id: "no-such",
        color: "#000",
        rect: { x: 0, y: 0, width: 1, height: 1 }
      })
    );
  });
});

describe("UVMap — selectedFace", () => {
  test("stays null for a collapsed region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.select(region.id, "top");

    assert.strictEqual(map.selectedFace, null);
  });

  test("defaults to front when an uncollapsed region is selected without a face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);

    map.select(region.id);

    assert.strictEqual(map.selectedFace, "front");
  });

  test("keeps the requested face for an uncollapsed region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);

    map.select(region.id, "bottom");

    assert.strictEqual(map.selectedFace, "bottom");
  });

  test("is renormalized when the selected region collapses", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.select(region.id, "bottom");

    map.collapse(region.id);

    assert.strictEqual(map.selectedFace, null);
  });

  test("emits selection-changed when collapsing clears the face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.select(region.id, "bottom");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.collapse(region.id);

    assert.deepStrictEqual(events, [
      { selectedRegionId: region.id, selectedFace: null }
    ]);
  });

  test("emits selection-changed when the face alone changes", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);
    map.select(region.id, "front");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id, "back");
    map.select(region.id, "back");

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].selectedFace, "back");
  });
});

describe("UVMap — select / visibility", () => {
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
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id);
    map.select(region.id);
    map.select(null);

    assert.strictEqual(events.length, 2);
  });

  test("emits visibility-changed only when showAll actually changes", () => {
    const map = makeMap();
    const events: EventPayload<"visibility-changed">[] = [];
    map.on("visibility-changed", (e) => events.push(e));

    map.showAll = true;
    map.showAll = true;
    map.showAll = false;

    assert.strictEqual(events.length, 2);
  });

  test("region labels are hidden by default", () => {
    assert.strictEqual(makeMap().showRegionLabels, false);
  });

  test("emits label-visibility-changed only when the preference changes", () => {
    const map = makeMap();
    const events: EventPayload<"label-visibility-changed">[] = [];
    map.on("label-visibility-changed", (e) => events.push(e));

    map.showRegionLabels = true;
    map.showRegionLabels = true;
    map.showRegionLabels = false;

    assert.deepStrictEqual(events, [
      { showRegionLabels: true },
      { showRegionLabels: false }
    ]);
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
