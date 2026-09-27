// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  ASSET_URL_PREFIX,
  CATALOG_URL_PATH
} from "../src/index.ts";

describe("urls", () => {
  test("exposes the routes both sides agree on", () => {
    assert.strictEqual(CATALOG_URL_PATH, "/__jollypixel/catalog");
    assert.strictEqual(ASSET_URL_PREFIX, "/assets/");
  });
});
