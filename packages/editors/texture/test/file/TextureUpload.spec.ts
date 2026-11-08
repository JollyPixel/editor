// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureUpload } from "#src/file/TextureUpload.ts";
import { TextureFileError } from "#src/errors/TextureFileError.ts";

describe("TextureUpload", () => {
  test("accepts a replacement in the format of the asset, whatever its case", async() => {
    const upload = new TextureUpload(
      new File([new Uint8Array([1, 2])], "Hero.PNG"),
      ".png"
    );

    assert.deepEqual(await upload.bytes(), new Uint8Array([1, 2]));
  });

  test("refuses a replacement in another format", () => {
    assert.throws(
      () => new TextureUpload(new File([], "hero.jpg"), ".png"),
      TextureFileError
    );
  });
});
