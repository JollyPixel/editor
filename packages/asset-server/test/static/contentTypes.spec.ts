// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  contentTypesFromKinds,
  DEFAULT_CONTENT_TYPE,
  resolveContentType,
  textureAssetHandler
} from "#src/index.ts";
import { counterHandler } from "../helpers/kinds.ts";

describe("resolveContentType", () => {
  test("matches on the lowercased extension", () => {
    assert.strictEqual(
      resolveContentType("textures/BLOCK.PNG"),
      "image/png"
    );
  });

  test("falls back to the octet stream", () => {
    assert.strictEqual(
      resolveContentType("a.unknown"),
      DEFAULT_CONTENT_TYPE
    );
    assert.strictEqual(
      resolveContentType("LICENSE"),
      DEFAULT_CONTENT_TYPE
    );
  });

  test("uses the table it is given", () => {
    assert.strictEqual(
      resolveContentType("a.pixelart", { ".pixelart": "application/json" }),
      "application/json"
    );
  });
});

describe("contentTypesFromKinds", () => {
  test("merges what the registered kinds declare over the defaults", () => {
    const table = contentTypesFromKinds(
      new AssetKindRegistry([
        {
          ...textureAssetHandler(),
          contentTypes: { ".png": "image/png-custom" }
        }
      ])
    );

    assert.strictEqual(table[".png"], "image/png-custom");
    assert.strictEqual(table[".json"], "application/json; charset=utf-8");
  });

  test("keeps the defaults for a kind declaring nothing", () => {
    const table = contentTypesFromKinds(
      new AssetKindRegistry([counterHandler()])
    );

    assert.strictEqual(table[".png"], "image/png");
    assert.strictEqual(table[".counter"], undefined);
  });
});
