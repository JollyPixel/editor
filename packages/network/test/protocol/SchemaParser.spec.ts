// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SchemaParser } from "#src/protocol/SchemaParser.ts";
import { describeErrors } from "#src/protocol/schema.ts";

// CONSTANTS
const kPointParser = new SchemaParser({
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" }
  },
  required: ["x", "y"]
});

describe("SchemaParser", () => {
  test("returns a value that matches the schema", () => {
    const result = kPointParser.parse({ x: 1, y: 2 });

    assert.strictEqual(result.ok, true);
    assert.deepEqual(result.val, { x: 1, y: 2 });
  });

  test("returns the errors of a value that does not match", () => {
    const result = kPointParser.parse({ x: "one" });

    assert.strictEqual(result.ok, false);
    assert.match(describeErrors(result.val), /\/x /);
    assert.match(describeErrors(result.val), /y/);
  });
});
