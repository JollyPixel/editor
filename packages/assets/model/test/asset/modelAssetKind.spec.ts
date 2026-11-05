// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MAX_KIND_CONTENT_BYTES } from "@jolly-pixel/asset-server";
import { SchemaParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { ASSET_KINDS } from "#src/index.ts";

// CONSTANTS
const kBytesPerMb = 1024 * 1024;

describe("ASSET_KINDS", () => {
  test("accepts 64 MB model files unless maxFileMb sets another size", () => {
    const [byDefault] = ASSET_KINDS.handlers();
    const [configured] = ASSET_KINDS.handlers({
      maxFileMb: 100
    });

    assert.strictEqual(byDefault.maxContentBytes, 64 * kBytesPerMb);
    assert.strictEqual(configured.maxContentBytes, 100 * kBytesPerMb);
  });

  test("takes maxFileMb in whole megabytes up to MAX_KIND_CONTENT_BYTES", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);
    const ceilingMb = MAX_KIND_CONTENT_BYTES / kBytesPerMb;

    for (const options of [{}, { maxFileMb: 1 }, { maxFileMb: ceilingMb }]) {
      assert.ok(parser.parse(options).ok, JSON.stringify(options));
    }
    for (const options of [
      { maxFileMb: 0 },
      { maxFileMb: ceilingMb + 1 },
      { maxFileMb: 1.5 },
      { maxFileMb: "64" },
      { maxFile: 64 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
