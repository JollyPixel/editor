// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../src/catalog/AssetPath.ts";
import { InvalidAssetNameError } from "../src/catalog/errors/InvalidAssetNameError.ts";

describe("AssetPath", () => {
  test("parses a source into segments, the empty source being the root", () => {
    const path = AssetPath.parse("maps/overworld.voxelmap.json");

    assert.deepEqual(path.segments, ["maps", "overworld.voxelmap.json"]);
    assert.equal(path.name, "overworld.voxelmap.json");
    assert.equal(path.parent.toString(), "maps");
    assert.equal(path.parent.parent.isRoot, true);
    assert.equal(AssetPath.parse("").isRoot, true);
    assert.equal(AssetPath.ROOT.parent, AssetPath.ROOT);
  });

  test("reads the extension from the first dot, a leading dot excluded", () => {
    assert.equal(AssetPath.parse("maps/overworld.voxelmap.json").extension, ".voxelmap.json");
    assert.equal(AssetPath.parse(".gitkeep").extension, "");
    assert.equal(AssetPath.parse("README").extension, "");
  });

  test("reads the stem as the name without its extension", () => {
    assert.equal(AssetPath.parse("maps/overworld.voxelmap.json").stem, "overworld");
    assert.equal(AssetPath.parse(".gitkeep").stem, ".gitkeep");
    assert.equal(AssetPath.parse("README").stem, "README");
  });

  test("renames within the same folder", () => {
    const path = AssetPath.parse("textures/stone");

    assert.equal(path.withName("brick").toString(), "textures/brick");
  });

  test("keeps the extension of a renamed asset", () => {
    const path = AssetPath.parse("maps/overworld.voxelmap.json");

    assert.equal(path.withNameKeepingExtension("cave").toString(), "maps/cave.voxelmap.json");
    assert.equal(
      path.withNameKeepingExtension("cave.voxelmap.json").toString(),
      "maps/cave.voxelmap.json"
    );
    assert.equal(
      path.withNameKeepingExtension("cave.json").toString(),
      "maps/cave.json.voxelmap.json"
    );
    assert.equal(AssetPath.parse("README").withNameKeepingExtension("NOTES").toString(), "NOTES");
  });

  test("refuses empty, reserved, separated or extension-only names", () => {
    const path = AssetPath.parse("maps/overworld.voxelmap.json");

    assert.throws(() => path.withName(""), InvalidAssetNameError);
    assert.throws(() => path.withName(".."), InvalidAssetNameError);
    assert.throws(() => path.withName("a/b"), InvalidAssetNameError);
    assert.throws(() => path.withName("a\\b"), InvalidAssetNameError);
    assert.throws(() => path.withNameKeepingExtension(".voxelmap.json"), InvalidAssetNameError);
  });

  test("is under a strict ancestor only, not a sibling sharing its prefix", () => {
    const path = AssetPath.parse("maps/cave/a.bin");

    assert.equal(path.isUnder(AssetPath.parse("maps")), true);
    assert.equal(path.isUnder(AssetPath.ROOT), true);
    assert.equal(path.isUnder(path), false);
    assert.equal(path.isUnder(AssetPath.parse("map")), false);
  });

  test("rebases a prefix and leaves outside paths untouched", () => {
    const from = AssetPath.parse("textures");
    const to = AssetPath.parse("art/textures");

    assert.equal(
      AssetPath.parse("textures/blocks/stone").rebase(from, to).toString(),
      "art/textures/blocks/stone"
    );
    assert.equal(from.rebase(from, to).toString(), "art/textures");
    assert.equal(AssetPath.parse("maps/a").rebase(from, to).toString(), "maps/a");
  });

  test("moves under another folder keeping its name", () => {
    const moved = AssetPath.parse("maps/a.bin").moveUnder(AssetPath.parse("archive"));

    assert.equal(moved.toString(), "archive/a.bin");
    assert.equal(moved.equals(AssetPath.parse("archive/a.bin")), true);
  });
});
