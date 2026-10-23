// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MemoryAssetSource,
  readJsonFile
} from "#src/index.ts";
import { bytes } from "./helpers/bytes.ts";

describe("readJsonFile", () => {
  test("returns null for a missing or malformed file", async() => {
    const source = new MemoryAssetSource([
      ["broken.json", bytes("{")]
    ]);

    assert.strictEqual(await readJsonFile(source, "missing.json"), null);
    assert.strictEqual(await readJsonFile(source, "broken.json"), null);
  });

  test("rethrows a read failure other than absence", async() => {
    const source = new MemoryAssetSource();

    await assert.rejects(
      () => readJsonFile(source, "../outside.json"),
      { name: "AssetPathEscapeError" }
    );
  });
});
