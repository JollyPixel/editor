// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindSet,
  newAssetName,
  type AssetKindEntry
} from "../src/catalog/AssetKindSet.ts";

// CONSTANTS
const kMap: AssetKindEntry = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json",
  icon: "kind:voxelmap"
};
const kTexture: AssetKindEntry = {
  kind: "texture",
  label: "Texture",
  extension: ".png"
};
const kKinds = new AssetKindSet({
  kinds: [kMap, kTexture],
  editable: ["voxelmap"]
});

describe("AssetKindSet", () => {
  test("knows only the listed kinds", () => {
    assert.equal(kKinds.has("voxelmap"), true);
    assert.equal(kKinds.has("binary"), false);
    assert.equal(AssetKindSet.EMPTY.has("voxelmap"), false);
  });

  test("finds the entry of a listed kind", () => {
    assert.deepEqual(kKinds.entryOf("voxelmap"), kMap);
    assert.equal(kKinds.entryOf("binary"), undefined);
  });

  test("names a new asset after the kind label", () => {
    assert.equal(newAssetName(kMap), "New voxel map");
    assert.equal(newAssetName(kTexture), "New texture");
  });

  test("falls back to the file icon", () => {
    assert.equal(kKinds.iconFor("voxelmap"), "kind:voxelmap");
    assert.equal(kKinds.iconFor("texture"), "file");
    assert.equal(kKinds.iconFor("binary"), "file");
  });

  test("details every kind no editor opens, listed or not", () => {
    assert.equal(kKinds.detailFor("voxelmap"), undefined);
    assert.equal(kKinds.detailFor("texture"), "no editor");
    assert.equal(kKinds.detailFor("binary"), "no editor");
  });

  test("offers the listed kinds in order", () => {
    assert.deepEqual(kKinds.toOptions(), [
      {
        value: "voxelmap",
        label: "Voxel map",
        icon: "kind:voxelmap"
      },
      {
        value: "texture",
        label: "Texture",
        icon: "file"
      }
    ]);
    assert.deepEqual(AssetKindSet.EMPTY.toOptions(), []);
  });

  test("copies and freezes its inputs", () => {
    const kinds: AssetKindEntry[] = [{ ...kTexture }];
    const editable = ["texture"];
    const set = new AssetKindSet({
      kinds,
      editable
    });
    kinds.push(kMap);
    editable.push("voxelmap");

    assert.equal(set.has("voxelmap"), false);
    assert.equal(set.detailFor("voxelmap"), "no editor");
    assert.equal(Object.isFrozen(set.entries), true);
    assert.equal(Object.isFrozen(set.entries[0]), true);
  });
});
