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

  test("passes its options to the handler", () => {
    const snapshot = {
      delay: 10
    };
    const [handler] = ASSET_KINDS.handlers({
      snapshot
    });

    assert.strictEqual(handler.snapshot, snapshot);
  });

  test("accepts only the JSON options of the handler", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);

    assert.ok(parser.parse({
      snapshot: {
        delay: 10,
        maxDelay: 20
      }
    }).ok);
    for (const options of [
      { snapshot: { delay: "10" } },
      { snapshot: { every: 10 } },
      { chunkSize: 8 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
