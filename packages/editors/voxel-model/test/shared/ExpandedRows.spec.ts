// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { ExpandedRows } from "#src/shared/ExpandedRows.ts";

describe("ExpandedRows", () => {
  test("opens, closes and toggles rows without repeating one", () => {
    const rows = new ExpandedRows();

    rows.expand("a");
    rows.expand("a");
    rows.toggle("b", true);
    rows.toggle("a");
    rows.toggle("c");

    assert.deepEqual(rows.ids, ["b", "c"]);
  });

  test("hands out a new array only when the rows change", () => {
    const rows = new ExpandedRows();
    rows.reset(["a"]);
    const before = rows.ids;

    rows.expand("a");
    rows.toggle("b", false);
    assert.equal(rows.ids, before);

    rows.expand("b");
    assert.notEqual(rows.ids, before);
    assert.deepEqual(before, ["a"]);
  });
});
