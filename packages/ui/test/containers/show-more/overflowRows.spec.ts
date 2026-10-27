// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { overflowRows } from "../../../src/containers/show-more/overflowRows.ts";

describe("overflowRows", () => {
  const cases: [total: number, limit: number, expected: number][] = [
    [12, 5, 7],
    [7, 5, 2],
    [6, 5, 0],
    [5, 5, 0],
    [0, 5, 0],
    [3, 0, 3],
    [3, -2, 3],
    [8, 4.7, 4],
    [8, Number.NaN, 0]
  ];

  for (const [total, limit, expected] of cases) {
    test(`hides the last ${expected} of ${total} rows with a limit of ${limit}`, () => {
      const rows = Array.from({ length: total }, (_, index) => index);

      assert.deepEqual(
        overflowRows(rows, limit),
        rows.slice(total - expected)
      );
    });
  }
});
