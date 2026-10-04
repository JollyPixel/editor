// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { rectOf } from "#src/uv/geometry/geometry.ts";
import {
  makeUvMap,
  type EventPayload
} from "../../helpers/uv/map.ts";

describe("UVMap — resize", () => {
  test("commits through region-state-changed with the previous region", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-state-changed">[] = [];
    map.on("region-state-changed", (event) => events.push(event));

    assert.equal(
      map.resize(region.id, { x: 0, y: 0, width: 6, height: 3 }),
      true
    );

    assert.deepEqual(map.get(region.id)!.bounds, { x: 0, y: 0, width: 6, height: 3 });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].previous, region.toJSON());
  });

  test("stops a moved edge at the canvas border", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    const region = map.create({ width: 4, height: 4 });
    map.move(region.id, { x: 26, y: 2, width: 4, height: 4 });

    map.resize(region.id, { x: 26, y: -5, width: 12, height: 11 });

    assert.deepEqual(map.get(region.id)!.bounds, { x: 26, y: 0, width: 6, height: 6 });
  });

  test("stops an unfolded face once a sliding neighbor reaches the border", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");
    const net = map.get(region.id)!;
    const front = rectOf(net.geometryFor("front"));

    map.resize(
      region.id,
      { ...front, width: 40 },
      "front"
    );

    const resized = map.get(region.id)!;
    assert.equal(resized.bounds.x + resized.bounds.width, 32);
    assert.equal(
      rectOf(resized.geometryFor("front")).x,
      front.x
    );
  });

  test("previews the clamped region without storing it", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => events.push(event));

    const preview = map.previewResize(
      region.id,
      { x: 0, y: 0, width: 50, height: 4 }
    );

    assert.deepEqual(preview?.bounds, { x: 0, y: 0, width: 32, height: 4 });
    assert.equal(events.length, 1);
    assert.equal(events[0].region, preview);
    assert.equal(events[0].face, null);
    assert.equal(map.get(region.id), region);
  });

  test("names the previewed face only for a free region", () => {
    const map = makeUvMap({ x: 32, y: 32 });
    const net = map.create({ width: 4, height: 4 });
    map.setState(net.id, "unfolded");
    const free = map.create({ width: 4, height: 4 });
    map.setState(free.id, "free");
    const faces: (string | null)[] = [];
    map.on("region-dragging", (event) => faces.push(event.face));

    map.previewResize(net.id, { x: 0, y: 0, width: 6, height: 4 }, "front");
    map.previewResize(free.id, { x: 0, y: 0, width: 6, height: 4 }, "front");

    assert.deepEqual(faces, [null, "front"]);
  });

  test("leaves an unchanged size uncommitted", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 4 });

    assert.equal(map.resize(region.id, region.bounds), false);
    assert.equal(map.resize("missing", region.bounds), false);
    assert.equal(map.previewResize("missing", region.bounds), null);
  });
});
