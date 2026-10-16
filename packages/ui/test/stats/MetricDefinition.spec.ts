// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  resolveMetricRange
} from "../../src/stats/MetricDefinition.ts";

describe("resolveMetricRange", () => {
  it("resolves fixed and automatic graph bounds", () => {
    assert.deepEqual(
      resolveMetricRange(
        { id: "auto", label: "Auto" },
        [4, 2, 8]
      ),
      { min: 2, max: 8 }
    );
    assert.deepEqual(
      resolveMetricRange(
        { id: "fixed", label: "Fixed", min: 0, max: 10 },
        [4, 2, 8]
      ),
      { min: 0, max: 10 }
    );
  });

  it("scans the history only for a missing bound", () => {
    assert.deepEqual(
      resolveMetricRange(
        { id: "floor", label: "Floor", min: 0 },
        [4, 2, 8]
      ),
      { min: 0, max: 8 }
    );
    assert.deepEqual(
      resolveMetricRange(
        { id: "ceiling", label: "Ceiling", max: 10 },
        [4, 2, 8]
      ),
      { min: 2, max: 10 }
    );
  });

  it("falls back to zero for an empty history", () => {
    assert.deepEqual(
      resolveMetricRange(
        { id: "auto", label: "Auto" },
        []
      ),
      { min: 0, max: 0 }
    );
  });

  it("handles a history longer than the spread argument limit", () => {
    const history = Array.from({ length: 200_000 }, (_, index) => index % 97);

    assert.deepEqual(
      resolveMetricRange(
        { id: "auto", label: "Auto" },
        history
      ),
      { min: 0, max: 96 }
    );
  });
});
