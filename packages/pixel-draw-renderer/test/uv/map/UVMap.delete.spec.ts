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

describe("UVMap — delete", () => {
  test("removes the region and emits region-deleted with its last-known state", () => {
    const map = makeUvMap();
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
    const map = makeUvMap();
    const events: EventPayload<"region-deleted">[] = [];
    map.on("region-deleted", (e) => events.push(e));

    assert.ok(!map.delete("no-such"));
    assert.strictEqual(events.length, 0);
  });

  test("clears selection and emits selection-changed when the selected region is deleted", () => {
    const map = makeUvMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.select(region.id, "top");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.delete(region.id);

    assert.strictEqual(map.selectedRegionId, null);
    assert.strictEqual(map.selectedSlot, null);
    assert.deepStrictEqual(events, [{
      selectedRegionId: null,
      selectedSlot: null
    }]);
  });
});

describe("UVMap — clear", () => {
  test("removes every region and resets cascading placement", () => {
    const map = makeUvMap();
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

  test("terminates when a listener restores a region while clearing", () => {
    const map = makeUvMap();
    const first = map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });

    let restored = 0;
    map.on("region-deleted", ({ region }) => {
      if (region.id === first.id && restored < 8) {
        restored++;
        map.restore(region);
      }
    });

    map.clear();

    assert.strictEqual(restored, 1);
    assert.deepStrictEqual([...map.regions].map((region) => region.id), [first.id]);
  });

  test("a filter deletes matching regions and keeps cascading placement", () => {
    const map = makeUvMap();
    const kept = map.create({ id: "kept", width: 4, height: 4 });
    map.create({ id: "gone", width: 4, height: 4 });

    map.clear((region) => region.id === "gone");

    assert.deepStrictEqual([...map.regions].map((region) => region.id), [kept.id]);
    assert.notDeepStrictEqual(
      map.create({ width: 4, height: 4 }).rectFor("front"),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });

  test("emits every region-deleted before a single selection-changed and changed", () => {
    const map = makeUvMap();
    const first = map.create({ width: 4, height: 4 });
    map.create({ width: 4, height: 4 });
    map.select(first.id);
    const events: string[] = [];
    map.on("region-deleted", () => events.push("region-deleted"));
    map.on("selection-changed", () => events.push("selection-changed"));
    map.on("changed", () => events.push("changed"));

    map.clear();

    assert.deepStrictEqual(events, [
      "region-deleted",
      "region-deleted",
      "selection-changed",
      "changed"
    ]);
  });
});
