// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelUpload } from "#src/file/ModelUpload.ts";
import { ModelFileError } from "#src/file/errors/ModelFileError.ts";

describe("ModelUpload", () => {
  test("accepts a replacement in the format of the asset, whatever its case", async() => {
    const upload = new ModelUpload(
      new File([new Uint8Array([1, 2])], "Hero.FBX"),
      ".fbx"
    );

    assert.deepEqual(await upload.bytes(), new Uint8Array([1, 2]));
  });

  test("refuses a replacement in another format", () => {
    assert.throws(
      () => new ModelUpload(new File([], "hero.glb"), ".fbx"),
      ModelFileError
    );
  });
});
