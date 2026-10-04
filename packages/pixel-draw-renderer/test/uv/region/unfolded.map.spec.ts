// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { UVSlot } from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";

describe("UVMap — setState unfolded", () => {
  test("stores the packed net and reports the previous region", () => {
    const map = makeUvMap({ x: 64, y: 64 });
    const region = map.create({ width: 4, height: 4 });
    const events: { state: string; previous: string; }[] = [];
    map.on("region-state-changed", ({ region: next, previous }) => {
      events.push({ state: next.state, previous: previous.state });
    });

    assert.ok(map.setState(region.id, "unfolded"));
    assert.strictEqual(map.get(region.id)!.state, "unfolded");
    assert.deepStrictEqual(events, [{ state: "unfolded", previous: "stacked" }]);
  });

  test("shifts an overhanging net inside, leaving extra height off the far edge", () => {
    const map = makeUvMap({ x: 16, y: 16 });
    const region = map.create({ width: 8, height: 8 });
    map.move(region.id, { x: 8, y: 8, width: 8, height: 8 });

    map.setState(region.id, "unfolded");

    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 0, y: 0, width: 16, height: 24 }
    );
  });

  test("creates a region directly in the unfolded state", () => {
    const map = makeUvMap({ x: 64, y: 64 });
    const region = map.create({ width: 4, height: 4, state: "unfolded" });

    assert.strictEqual(region.state, "unfolded");
    assert.deepStrictEqual(region.bounds, { x: 0, y: 0, width: 8, height: 12 });
  });

  test("selects the region without a face", () => {
    const map = makeUvMap({ x: 64, y: 64 });
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");

    map.select(region.id, "top");

    assert.strictEqual(map.selectedRegionId, region.id);
    assert.strictEqual(map.selectedSlot, null);
  });

  test("moves as a whole, reporting a null face", () => {
    const map = makeUvMap({ x: 64, y: 64 });
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "unfolded");
    const events: { face: UVSlot | null; previousRect: SelectionRect; }[] = [];
    map.on("region-moved", ({ face, previousRect }) => events.push({ face, previousRect }));

    assert.ok(map.move(region.id, { x: 4, y: 4, width: 8, height: 12 }, "top"));

    assert.deepStrictEqual(events, [
      { face: null, previousRect: { x: 0, y: 0, width: 8, height: 12 } }
    ]);
    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 4, y: 4, width: 8, height: 12 }
    );
  });
});
