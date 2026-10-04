// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  makeUvMap,
  type EventPayload
} from "../../helpers/uv/map.ts";

describe("UVMap — create", () => {
  test("accepts slot-named topology options", () => {
    const uv = makeUvMap();
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
    const map = makeUvMap();
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
    const map = makeUvMap();
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
  test("sizes a slot from its template while the stacked rect keeps the region size", () => {
    const map = makeUvMap();
    const region = map.create({
      width: 16,
      height: 16,
      state: "stacked",
      activeSlots: ["front", "top"],
      slotGeometries: {
        top: { shape: "rectangle", height: 23 }
      }
    });

    assert.deepStrictEqual(region.bounds, { x: 0, y: 0, width: 16, height: 16 });
    assert.deepStrictEqual(region.toJSON().faces?.top, {
      x: 0, y: 0, width: 16, height: 23
    });
    assert.strictEqual(region.free().rectFor("top").height, 23);
  });

  test("clamps a slot template size to the canvas", () => {
    const map = makeUvMap();
    const region = map.create({
      width: 8,
      height: 8,
      activeSlots: ["top"],
      slotGeometries: {
        top: { shape: "rectangle", width: 0, height: 10_000 }
      }
    });

    assert.deepStrictEqual(region.rectFor("top"), {
      x: 0, y: 0, width: 1, height: 32
    });
  });

  test("creates a stacked region with the requested size at the origin, with a palette color", () => {
    const map = makeUvMap();
    const region = map.create({ width: 8, height: 8 });

    assert.strictEqual(region.state, "stacked");
    assert.deepStrictEqual(
      region.rectFor("front"),
      { x: 0, y: 0, width: 8, height: 8 }
    );
    assert.strictEqual(typeof region.color, "string");
    assert.strictEqual([...map.regions].length, 1);
  });

  test("clamps width/height to the canvas size", () => {
    const map = makeUvMap({ x: 4, y: 4 });
    const region = map.create({ width: 100, height: 100 });

    assert.deepStrictEqual(
      region.rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("cascades subsequent regions instead of stacking them at the origin", () => {
    const map = makeUvMap();
    const a = map.create({ width: 8, height: 8 });
    const b = map.create({ width: 8, height: 8 });

    assert.notDeepStrictEqual(a.rectFor("front"), b.rectFor("front"));
  });

  test("assigns distinct colors from the palette to successive regions", () => {
    const map = makeUvMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    assert.notStrictEqual(a.color, b.color);
  });

  test("accepts an explicit id and color", () => {
    const map = makeUvMap();
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
    const map = makeUvMap();
    const region = map.create({
      width: 4,
      height: 4,
      name: "Grass block"
    });

    assert.strictEqual(region.name, "Grass block");
  });

  test("emits a region-created event", () => {
    const map = makeUvMap();
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
