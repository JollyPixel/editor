// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  decodeTypeface,
  fontAssetKind
} from "#src/index.ts";
import { blockLetterFont } from "../helpers/fontFiles.ts";

// CONSTANTS
const kHandler = fontAssetKind();

describe("fontAssetKind", () => {
  test("loads the content its .otf conversion produces and serializes it back", async() => {
    const conversion = kHandler.conversions?.[".otf"];
    assert.ok(conversion !== undefined);
    const { content } = await conversion(blockLetterFont());
    const state = kHandler.create("font-1");
    kHandler.load(state, content);

    assert.deepEqual(
      decodeTypeface(await kHandler.serialize(state)),
      decodeTypeface(content)
    );
  });

  test("refuses a typeface file that is missing its glyphs", () => {
    const state = kHandler.create("font-1");
    const content = new TextEncoder().encode(JSON.stringify({
      familyName: "Broken",
      resolution: 1000
    }));

    assert.throws(
      () => kHandler.load(state, content),
      InvalidAssetFileError
    );
  });
});
