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

describe("UVMap.rotate", () => {
  test("rotates a stacked region and emits region-rotated", () => {
    const map = makeUvMap();
    const region = map.create({ width: 16, height: 8 });
    const rotated: EventPayload<"region-rotated">[] = [];
    const stateChanged: unknown[] = [];
    map.on("region-rotated", (event) => rotated.push(event));
    map.on("region-state-changed", (event) => stateChanged.push(event));

    assert.ok(map.rotate(region.id, "cw"));

    assert.strictEqual(rotated.length, 1);
    assert.strictEqual(rotated[0].face, null);
    assert.strictEqual(rotated[0].region, map.get(region.id));
    assert.deepStrictEqual(rotated[0].previous, region.toJSON());
    assert.strictEqual(stateChanged.length, 0);
  });

  test("clamps a rotated region back inside the canvas", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 16 });
    map.move(region.id, { x: 28, y: 0, width: 4, height: 16 });

    map.rotate(region.id, "cw");

    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 16, y: 0, width: 16, height: 4 }
    );
  });

  test("a free region needs a slot and clamps only that slot", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 16 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 28, y: 0, width: 4, height: 16 }, "top");
    const events: EventPayload<"region-rotated">[] = [];
    map.on("region-rotated", (event) => events.push(event));

    assert.ok(!map.rotate(region.id, "cw"));
    assert.ok(map.rotate(region.id, "cw", "top"));

    const stored = map.get(region.id)!;
    assert.deepStrictEqual(
      stored.geometryFor("top"),
      { x: 16, y: 0, width: 16, height: 4, rotation: 1 }
    );
    assert.deepStrictEqual(stored.rectFor("front"), region.rectFor("front"));
    assert.strictEqual(events[0].face, "top");
  });

  test("returns false for an unknown region", () => {
    assert.ok(!makeUvMap().rotate("missing", "cw"));
  });

  test("restoreRotation replaces the region and reports the rotated face", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-rotated">[] = [];
    map.on("region-rotated", (event) => events.push(event));

    assert.ok(map.restoreRotation(region.rotated("cw").toJSON()));

    assert.strictEqual(map.get(region.id)!.geometryFor("front").rotation, 1);
    assert.strictEqual(events[0].face, null);
  });

  test("moves keep the current size and rotation", () => {
    const map = makeUvMap();
    const region = map.create({ width: 16, height: 8 });
    map.rotate(region.id, "cw");
    const dragged: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => dragged.push(event));

    map.previewMove(region.id, { x: 2, y: 2, width: 16, height: 8 });
    map.move(region.id, { x: 4, y: 4, width: 16, height: 8 });

    assert.deepStrictEqual(
      dragged[0].region.geometryFor("front"),
      { x: 2, y: 2, width: 8, height: 16, rotation: 1 }
    );
    assert.deepStrictEqual(
      map.get(region.id)!.geometryFor("front"),
      { x: 4, y: 4, width: 8, height: 16, rotation: 1 }
    );
  });
});
