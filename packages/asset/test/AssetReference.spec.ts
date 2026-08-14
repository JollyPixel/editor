// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetId,
  AssetKindMismatchError,
  AssetReference,
  AssetType,
  type AssetReferenceGroup
} from "../src/index.ts";

const MODEL_ASSET = new AssetType<unknown>("model");

describe("AssetReference", () => {
  test("round-trips its persistent representation", () => {
    const reference = new AssetReference(
      new AssetId("01JOLLYPIXELMODEL"),
      MODEL_ASSET
    );

    const restored = AssetReference.parse(
      reference.toJSON(),
      MODEL_ASSET
    );

    assert.ok(restored.equals(reference));
    assert.deepEqual(restored.toJSON(), {
      id: "01JOLLYPIXELMODEL",
      kind: "model"
    });
  });

  test("creates its AssetId from a string", () => {
    const reference = new AssetReference(
      "asset-id",
      MODEL_ASSET
    );

    assert.ok(reference.id instanceof AssetId);
    assert.strictEqual(reference.id.value, "asset-id");
  });

  test("rejects empty identifiers and asset type kinds", () => {
    assert.throws(
      () => new AssetId(""),
      /must not be empty/
    );
    assert.throws(
      () => new AssetReference("", MODEL_ASSET),
      /must not be empty/
    );
    assert.throws(
      () => new AssetType(""),
      /kind must not be empty/
    );
  });

  test("rejects persisted kinds that differ from the requested type", () => {
    assert.throws(
      () => AssetReference.parse(
        {
          id: "asset-id",
          kind: "audio"
        },
        MODEL_ASSET
      ),
      AssetKindMismatchError
    );
  });

  test("preserves the asset value type", () => {
    const reference = new AssetReference(
      new AssetId("asset-id"),
      new AssetType<string>("text")
    );

    // @ts-expect-error Asset type tokens preserve incompatible value types.
    const incompatible: AssetReference<number> = reference;
    void incompatible;
  });

  test("preserves value types in a named reference group", () => {
    const assets = {
      dialogue: new AssetReference(
        "dialogue.intro",
        new AssetType<string>("text")
      )
    } satisfies AssetReferenceGroup;

    const reference: AssetReference<string> = assets.dialogue;

    // @ts-expect-error The group retains each reference's value type.
    const incompatible: AssetReference<number> = assets.dialogue;
    void reference;
    void incompatible;
  });
});
