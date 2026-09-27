// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetKindMismatchError,
  AssetReference,
  AssetType
} from "../src/index.ts";

// CONSTANTS
const kModelAsset = new AssetType<unknown>("model");

describe("AssetReference", () => {
  test("round-trips its persistent representation", () => {
    const reference = new AssetReference(
      "01JOLLYPIXELMODEL",
      kModelAsset
    );

    const restored = AssetReference.parse(
      reference.toJSON(),
      kModelAsset
    );

    assert.ok(restored.equals(reference));
    assert.deepEqual(restored.toJSON(), {
      id: "01JOLLYPIXELMODEL",
      kind: "model"
    });
  });

  test("equals compares id and kind", () => {
    const reference = new AssetReference("hero", kModelAsset);

    assert.ok(!reference.equals(new AssetReference("villain", kModelAsset)));
    assert.ok(
      !reference.equals(new AssetReference("hero", new AssetType("audio")))
    );
  });

  test("rejects malformed persisted references with a TypeError", () => {
    const cases: Array<[unknown, RegExp]> = [
      [null, /reference must be an object/],
      [[], /reference must be an object/],
      [{ kind: "model" }, /ID must be a string/],
      [{ id: "hero" }, /kind must be a string/]
    ];

    for (const [input, message] of cases) {
      assert.throws(
        () => AssetReference.parse(input, kModelAsset),
        {
          name: "TypeError",
          message
        }
      );
    }
  });

  test("rejects persisted kinds that differ from the requested type", () => {
    assert.throws(
      () => AssetReference.parse(
        {
          id: "asset-id",
          kind: "audio"
        },
        kModelAsset
      ),
      AssetKindMismatchError
    );
  });
});
