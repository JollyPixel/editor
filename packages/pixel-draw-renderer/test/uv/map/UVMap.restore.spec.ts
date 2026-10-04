// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { UVRegionData } from "#src/uv/region/UVRegion.ts";
import {
  makeUvMap,
  type EventPayload
} from "../../helpers/uv/map.ts";

describe("UVMap — restore", () => {
  test("re-adds a region exactly as given and emits region-created", () => {
    const map = makeUvMap();
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
    const map = makeUvMap();
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
    const map = makeUvMap();
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

  test("restoring a known id reports a state change, not a second creation", () => {
    const map = makeUvMap();
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
    const map = makeUvMap();
    const region = map.create({ id: "r1", width: 4, height: 4 });
    const created: EventPayload<"region-created">[] = [];
    map.on("region-created", (e) => created.push(e));

    const stored = map.restore(region.toJSON());

    assert.strictEqual(created.length, 0);
    assert.strictEqual(stored.id, "r1");
    assert.strictEqual([...map.regions].length, 1);
  });
});
