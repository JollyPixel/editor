// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { SchemaParser } from "#src/protocol/SchemaParser.ts";
import { describeErrors } from "#src/protocol/schema.ts";

// CONSTANTS
const kPointParser = new SchemaParser(z.object({
  x: z.number(),
  y: z.number()
}));

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
