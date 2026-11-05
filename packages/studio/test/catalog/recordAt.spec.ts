// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { recordAt } from "../../src/catalog/recordAt.ts";

describe("recordAt", () => {
  test("finds the record at a path whatever its case", () => {
    const readme = { id: "b", kind: "text", path: "readme.MD" };

    assert.equal(recordAt([
      { id: "a", kind: "text", path: "docs/README.md" },
      readme
    ], "README.md"), readme);
  });

  test("finds nothing when no record has the path", () => {
    assert.equal(recordAt([
      { id: "a", kind: "text", path: "docs/README.md" },
      { id: "b", kind: "text", path: "README.txt" }
    ], "README.md"), null);
  });
});
