// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetKind,
  AssetRecord,
  type AssetRecordOptions
} from "../src/index.ts";

// CONSTANTS
const kWorldOptions: AssetRecordOptions = {
  id: "world",
  kind: "voxelmap",
  path: "maps/world.voxelmap"
};

function worldRecord(): AssetRecord {
  return new AssetRecord(kWorldOptions);
}

describe("AssetRecord", () => {
  test("rejects a blank revision", () => {
    assert.throws(
      () => new AssetRecord({
        ...kWorldOptions,
        revision: ""
      }),
      {
        name: "TypeError",
        message: /revision must not be empty/
      }
    );
  });

  test("hasKind accepts a kind or its name", () => {
    const record = worldRecord();

    assert.ok(record.hasKind("voxelmap"));
    assert.ok(record.hasKind(new AssetKind("voxelmap")));
    assert.ok(!record.hasKind("texture"));
  });

  test("serializes revision only when it is set", () => {
    assert.deepEqual(worldRecord().toJSON(), {
      id: "world",
      kind: "voxelmap",
      path: "maps/world.voxelmap"
    });
    assert.deepEqual(
      new AssetRecord({
        ...kWorldOptions,
        revision: "sha256:abc"
      }).toJSON(),
      {
        id: "world",
        kind: "voxelmap",
        path: "maps/world.voxelmap",
        revision: "sha256:abc"
      }
    );
  });

  test("parses a record with an explicitly undefined revision", () => {
    const record = AssetRecord.parse({
      ...kWorldOptions,
      revision: undefined
    });

    assert.equal(record.id.value, "world");
    assert.equal(record.revision, undefined);
  });

  test("rejects malformed persisted records with a $ZodError", () => {
    const cases: unknown[] = [
      null,
      [],
      { kind: "voxelmap", path: "a" },
      { id: "world", kind: 1, path: "a" },
      { id: "world", kind: "voxelmap" },
      {
        ...kWorldOptions,
        revision: 1
      }
    ];

    for (const input of cases) {
      assert.throws(
        () => AssetRecord.parse(input),
        { name: "$ZodError" }
      );
    }
  });

  test("applies constructor invariants to parsed records", () => {
    assert.throws(
      () => AssetRecord.parse({
        ...kWorldOptions,
        revision: " "
      }),
      {
        name: "TypeError",
        message: /revision must not be empty/
      }
    );
  });
});
