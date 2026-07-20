// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionCollection } from "../../src/uv/UVRegionCollection.ts";
import type { UVRegion } from "../../src/uv/UVRegion.ts";

function makeRegion(
  id: string
): UVRegion {
  return { id, rect: { x: 0, y: 0, width: 2, height: 2 }, color: "#f00" };
}

describe("UVRegionCollection", () => {
  it("get returns undefined for an unknown id", () => {
    const collection = new UVRegionCollection();

    assert.strictEqual(collection.get("r1"), undefined);
  });

  it("set stores a copy, keyed by region.id", () => {
    const collection = new UVRegionCollection();
    const region = makeRegion("r1");
    collection.set(region);

    assert.deepStrictEqual(collection.get("r1"), region);
    assert.notStrictEqual(collection.get("r1"), region);
  });

  it("set upserts an existing id", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.set({ ...makeRegion("r1"), color: "#00f" });

    assert.strictEqual(collection.get("r1")!.color, "#00f");
  });

  it("remove deletes an existing region", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.remove("r1");

    assert.strictEqual(collection.get("r1"), undefined);
  });

  it("remove is a no-op for an unknown id", () => {
    const collection = new UVRegionCollection();

    assert.doesNotThrow(() => collection.remove("no-such"));
  });

  it("is iterable, yielding every stored region", () => {
    const collection = new UVRegionCollection();
    collection.set(makeRegion("r1"));
    collection.set(makeRegion("r2"));

    assert.deepStrictEqual([...collection], [makeRegion("r1"), makeRegion("r2")]);
  });
});
