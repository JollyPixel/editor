// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeMap, type EventPayload } from "../helpers/uv-map.ts";

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
    assert.strictEqual(events[0].face, null, "a stacked region moves as a whole");
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

  test("moves a single face of an free region, leaving the others put", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
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

  test("refuses to move an free region when no face is given", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    const events: EventPayload<"region-moved">[] = [];
    map.on("region-moved", (e) => events.push(e));

    assert.ok(
      !map.move(region.id, { x: 10, y: 10, width: 4, height: 4 }),
      "moving every face at once is not supported yet"
    );
    assert.strictEqual(events.length, 0);
  });

  test("ignores the face argument for a stacked region", () => {
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

  test("carries the face for an free region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
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
      activeSlots: ["left"],
      slotGeometries: {
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
