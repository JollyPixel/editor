// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { decodeTypeface } from "#src/index.ts";
import { typefaceContentFromFont } from "#src/conversion/typefaceFromFont.ts";
import { blockLetterFont } from "../helpers/fontFiles.ts";

describe("typefaceContentFromFont", () => {
  test("converts a font file into typeface glyphs scaled to its em square", async() => {
    const typeface = decodeTypeface(
      await typefaceContentFromFont(blockLetterFont())
    );

    assert.equal(typeface.familyName, "Fixture Regular");
    assert.equal(typeface.resolution, 1000);
    assert.deepEqual(Object.keys(typeface.glyphs).sort(), [" ", "A"]);
    assert.equal(typeface.glyphs[" "].ha, 417);
    assert.deepEqual(
      {
        ha: typeface.glyphs.A.ha,
        o: typeface.glyphs.A.o
      },
      {
        ha: 903,
        o: "m 139 0 l 139 972 l 694 972 z"
      }
    );
  });

  test("rejects a dropped file that is not a font", async() => {
    await assert.rejects(
      typefaceContentFromFont(new TextEncoder().encode("not a font")),
      InvalidAssetFileError
    );
  });
});
