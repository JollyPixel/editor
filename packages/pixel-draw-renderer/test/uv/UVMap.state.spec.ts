// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_UV_SLOTS } from "#src/uv/UVRegion.ts";
import { makeMap, type EventPayload } from "../helpers/uv-map.ts";

describe("UVMap — free / stack", () => {
  test("free gives every face the region's current rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(map.setState(region.id, "free"));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "free");
    for (const face of DEFAULT_UV_SLOTS) {
      assert.deepStrictEqual(
        stored.rectFor(face),
        region.rectFor("front"),
        `${face} must not move when freeing`
      );
    }
  });

  test("freeing a region that moved while stacked restarts on its rect", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 24, y: 24, width: 4, height: 4 }, "top");
    map.setState(region.id, "stacked");
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 });

    assert.ok(map.setState(region.id, "free"));

    const stored = map.get(region.id)!;
    for (const face of DEFAULT_UV_SLOTS) {
      assert.deepStrictEqual(
        stored.rectFor(face),
        { x: 12, y: 12, width: 4, height: 4 },
        `${face} must not carry its pre-stack offset`
      );
    }
  });

  test("free emits region-state-changed carrying the previous region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-state-changed">[] = [];
    map.on("region-state-changed", (e) => events.push(e));

    map.setState(region.id, "free");

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].region, map.get(region.id));
    assert.deepStrictEqual(events[0].previous, region.toJSON());
  });

  test("stack uses the requested face as the shared rectangle", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");

    assert.ok(map.setState(region.id, "stacked", "top"));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "stacked");
    assert.deepStrictEqual(stored.rectFor("front"), { x: 12, y: 12, width: 4, height: 4 });
  });

  test("stack defaults to the front face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");

    map.setState(region.id, "stacked");

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("returns false for an unknown id or a redundant transition", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(!map.setState("no-such", "free"));
    assert.ok(!map.setState(region.id, "stacked"), "already stacked");
    assert.ok(map.setState(region.id, "free"));
    assert.ok(!map.setState(region.id, "free"), "already free");
  });

  test("restoreState puts a whole region back without a create/delete cycle", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 12, y: 12, width: 4, height: 4 }, "top");
    const before = map.get(region.id)!.toJSON();

    map.setState(region.id, "stacked");
    const created: string[] = [];
    map.on("region-created", (e) => created.push(e.region.id));

    assert.ok(map.restoreState(before));

    const stored = map.get(region.id)!;
    assert.strictEqual(stored.state, "free");
    assert.deepStrictEqual(
      stored.rectFor("top"),
      { x: 12, y: 12, width: 4, height: 4 },
      "the previous face layout must come back"
    );
    assert.deepStrictEqual(created, [], "restoring state is not a creation");
  });

  test("restoreState returns false for an unknown id", () => {
    const map = makeMap();

    assert.ok(
      !map.restoreState({
        state: "stacked",
        id: "no-such",
        color: "#000",
        rect: { x: 0, y: 0, width: 1, height: 1 }
      })
    );
  });
});
