// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SchemaParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "#src/asset/voxelModel.ts";
import { ASSET_KINDS } from "#src/asset/voxelModelAssetKind.ts";

describe("ASSET_KINDS", () => {
  test("describes every kind it handles", () => {
    const handlers = ASSET_KINDS.handlers();

    assert.deepEqual(
      handlers.map((handler) => handler.kind),
      [VOXEL_MODEL_KIND]
    );
    assert.deepEqual(
      ASSET_KINDS.descriptors.map((descriptor) => descriptor.kind),
      [VOXEL_MODEL_KIND]
    );
  });

  test("takes no options", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);

    assert.ok(parser.parse({}).ok);
    for (const options of [
      { snapshot: { delay: 10 } },
      { chunkSize: 8 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
