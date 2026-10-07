// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureImporter } from "../../../src/textures/import/TextureImporter.ts";

describe("TextureImporter.parsePolicy", () => {
  test("reads every import policy", () => {
    assert.equal(TextureImporter.parsePolicy("replace"), "replace");
    assert.equal(TextureImporter.parsePolicy("add"), "add");
    assert.equal(TextureImporter.parsePolicy("ask"), "ask");
  });

  test("returns null for an unknown or missing policy", () => {
    assert.equal(TextureImporter.parsePolicy("Ask"), null);
    assert.equal(TextureImporter.parsePolicy(""), null);
    assert.equal(TextureImporter.parsePolicy(null), null);
    assert.equal(TextureImporter.parsePolicy(undefined), null);
  });
});
