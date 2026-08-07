// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionCollection } from "#src/uv/UVRegionCollection.ts";
import { UVRegion, type UVRegionData } from "#src/uv/UVRegion.ts";

function makeRegion(
  id: string
): UVRegionData {
  return {
    id,
    state: "collapsed",
    rect: { x: 0, y: 0, width: 2, height: 2 },
    color: "#f00"
  };
}

describe("UVRegionCollection", () => {
  test("get returns undefined for an unknown id", () => {
    const collection = new UVRegionCollection();

    assert.strictEqual(collection.get("r1"), undefined);
  });

  test("set stores an instance built from raw data, keyed by region.id", () => {
    const collection = new UVRegionCollection();
    const region = makeRegion("r1");
    collection.set(region);

    const stored = collection.get("r1")!;
    assert.ok(stored instanceof UVRegion);
    assert.deepStrictEqual(stored.toJSON(), region);
  });

  test("set keeps an instance as-is", () => {
    const collection = new UVRegionCollection();
    const region = new UVRegion(makeRegion("r1"));
    collection.set(region);

    assert.strictEqual(collection.get("r1"), region);
  });

  test("stores an uncollapsed region without flattening it", () => {
    const collection = new UVRegionCollection();
    collection.set(new UVRegion(makeRegion("r1")).uncollapse());

    assert.strictEqual(collection.get("r1")!.state, "uncollapsed");
  });

  test("set upserts an existing id", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.set({ ...makeRegion("r1"), color: "#00f" });

    assert.strictEqual(collection.get("r1")!.color, "#00f");
  });

  test("remove deletes an existing region", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.remove("r1");

    assert.strictEqual(
      collection.get("r1"),
      undefined,
      "collection must yield r1 and r2"
    );
  });

  test("remove is a no-op for an unknown id", () => {
    const collection = new UVRegionCollection();

    assert.doesNotThrow(
      () => collection.remove("no-such"),
      "remove must not throw for an unknown id"
    );
  });

  test("is iterable, yielding every stored region", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.set(makeRegion("r2"));

    assert.deepStrictEqual(
      [...collection].map((region) => region.toJSON()),
      [makeRegion("r1"), makeRegion("r2")],
      "collection must yield r1 and r2"
    );
  });
});
