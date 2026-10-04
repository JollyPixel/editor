// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetKindSet } from "../../src/catalog/AssetKindSet.ts";
import { AssetTally } from "../../src/catalog/AssetTally.ts";

// CONSTANTS
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      icon: "kind:voxelmap"
    },
    {
      kind: "texture",
      label: "Texture",
      extension: ".png"
    }
  ],
  editable: ["voxelmap"]
});

describe("AssetTally", () => {
  test("counts records per kind, registered kinds first and in order", () => {
    const tally = AssetTally.count(
      [
        { kind: "zone" },
        { kind: "voxelmap" },
        { kind: "binary" },
        { kind: "voxelmap" }
      ],
      kKinds
    );

    assert.deepEqual(tally.rows, [
      {
        kind: "voxelmap",
        label: "Voxel map",
        icon: "kind:voxelmap",
        count: 2
      },
      {
        kind: "texture",
        label: "Texture",
        icon: "file",
        count: 0
      },
      {
        kind: "binary",
        label: "binary",
        icon: "file",
        count: 1
      },
      {
        kind: "zone",
        label: "zone",
        icon: "file",
        count: 1
      }
    ]);
    assert.equal(tally.total, 4);
  });

  test("an empty project lists every registered kind at zero", () => {
    const tally = AssetTally.count([], kKinds);

    assert.deepEqual(
      tally.rows.map((row) => [row.kind, row.count]),
      [["voxelmap", 0], ["texture", 0]]
    );
    assert.equal(tally.total, 0);
    assert.equal(AssetTally.EMPTY.total, 0);
  });

  test("equals compares the count of every kind", () => {
    const tally = AssetTally.count(
      [{ kind: "voxelmap" }, { kind: "texture" }],
      kKinds
    );

    assert.ok(tally.equals(AssetTally.count(
      [{ kind: "texture" }, { kind: "voxelmap" }],
      kKinds
    )));
    assert.ok(!tally.equals(AssetTally.count(
      [{ kind: "voxelmap" }, { kind: "voxelmap" }],
      kKinds
    )));
    assert.ok(!tally.equals(AssetTally.count(
      [{ kind: "voxelmap" }, { kind: "texture" }, { kind: "zone" }],
      kKinds
    )));
    assert.ok(!tally.equals(AssetTally.EMPTY));
  });
});
