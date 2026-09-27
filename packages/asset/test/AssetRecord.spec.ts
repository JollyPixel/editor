// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetRecord,
  type AssetRecordOptions
} from "../src/index.ts";

// CONSTANTS
const kWorldOptions: AssetRecordOptions = {
  id: "world",
  kind: "voxelmap",
  source: "maps/world.voxelmap"
};

function worldRecord(): AssetRecord {
  return new AssetRecord(kWorldOptions);
}

describe("AssetRecord", () => {
  test("rejects an invalid kind, a blank source, or a blank revision", () => {
    const cases: Array<[Partial<AssetRecordOptions>, RegExp]> = [
      [{ kind: " " }, /kind must be non-empty without a colon/],
      [{ kind: "voxel:map" }, /kind must be non-empty without a colon/],
      [{ source: "" }, /source must not be empty/],
      [{ revision: "" }, /revision must not be empty/]
    ];

    for (const [override, message] of cases) {
      assert.throws(
        () => new AssetRecord({
          ...kWorldOptions,
          ...override
        }),
        {
          name: "TypeError",
          message
        }
      );
    }
  });

  test("serializes revision only when it is set", () => {
    assert.deepEqual(worldRecord().toJSON(), {
      id: "world",
      kind: "voxelmap",
      source: "maps/world.voxelmap"
    });
    assert.deepEqual(
      new AssetRecord({
        ...kWorldOptions,
        revision: "sha256:abc"
      }).toJSON(),
      {
        id: "world",
        kind: "voxelmap",
        source: "maps/world.voxelmap",
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

  test("rejects malformed persisted records with a ZodError", () => {
    const cases: unknown[] = [
      null,
      [],
      { kind: "voxelmap", source: "a" },
      { id: "world", kind: 1, source: "a" },
      { id: "world", kind: "voxelmap" },
      {
        ...kWorldOptions,
        revision: 1
      }
    ];

    for (const input of cases) {
      assert.throws(
        () => AssetRecord.parse(input),
        { name: "ZodError" }
      );
    }
  });

  test("applies constructor invariants to parsed records", () => {
    assert.throws(
      () => AssetRecord.parse({
        ...kWorldOptions,
        source: " "
      }),
      {
        name: "TypeError",
        message: /source must not be empty/
      }
    );
  });
});
