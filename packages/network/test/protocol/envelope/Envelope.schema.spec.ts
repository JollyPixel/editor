// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { compileAll } from "../../../scripts/compileSchemas.ts";

// CONSTANTS
const kGeneratedDir = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "src",
  "protocol",
  "envelope",
  "generated"
);

describe("compiled envelope validators", () => {
  test("the checked-in modules match the schemas they are generated from", async() => {
    for (const [fileName, expected] of compileAll()) {
      const actual = await fs.readFile(
        path.join(kGeneratedDir, fileName),
        "utf8"
      );

      assert.equal(
        actual.replace(/\r\n/g, "\n"),
        expected,
        `${fileName} is stale, run "pnpm run build:schemas"`
      );
    }
  });
});
