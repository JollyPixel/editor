// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  compareLayerRanks,
  isLayerRank,
  rankBetween
} from "../../../src/document/world/index.ts";

describe("rankBetween", () => {
  it("returns a rank strictly between its bounds", () => {
    for (const [lower, upper] of [
      [null, null],
      [null, "V"],
      ["V", null],
      ["1", "2"],
      ["a", "a1"],
      ["zz", null],
      [null, "01"]
    ] as const) {
      const rank = rankBetween(lower, upper);

      assert.ok(isLayerRank(rank), rank);
      assert.ok(lower === null || rank > lower, `${rank} > ${lower}`);
      assert.ok(upper === null || rank < upper, `${rank} < ${upper}`);
    }
  });

  it("keeps finding room after repeated insertions at one spot", () => {
    const bounds: { lower: string | null; upper: string; } = {
      lower: null,
      upper: "V"
    };
    for (let step = 0; step < 200; step++) {
      const rank = rankBetween(bounds.lower, bounds.upper);
      assert.ok(isLayerRank(rank));
      assert.ok((bounds.lower === null || rank > bounds.lower) && rank < bounds.upper);
      if (step % 2 === 0) {
        bounds.lower = rank;
      }
      else {
        bounds.upper = rank;
      }
    }
  });

  it("goes above the lower bound when the bounds are tied", () => {
    const rank = rankBetween("V", "V");

    assert.ok(rank > "V");
  });
});

describe("compareLayerRanks", () => {
  it("orders by rank, then by id for tied ranks", () => {
    assert.ok(compareLayerRanks({ id: "b", rank: "1" }, { id: "a", rank: "2" }) < 0);
    assert.ok(compareLayerRanks({ id: "a", rank: "V" }, { id: "b", rank: "V" }) < 0);
    assert.strictEqual(compareLayerRanks({ id: "a", rank: "V" }, { id: "a", rank: "V" }), 0);
  });
});

describe("isLayerRank", () => {
  it("accepts base-62 digits not ending with 0", () => {
    assert.strictEqual(isLayerRank("V"), true);
    assert.strictEqual(isLayerRank("0V"), true);
    assert.strictEqual(isLayerRank("V0"), false);
    assert.strictEqual(isLayerRank(""), false);
    assert.strictEqual(isLayerRank("a-b"), false);
    assert.strictEqual(isLayerRank(3), false);
  });
});
