// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import { DraftFolders } from "../../src/catalog/DraftFolders.ts";

function draftsOf(
  ...paths: string[]
): DraftFolders {
  return new DraftFolders(paths.map((path) => AssetPath.parse(path)));
}

function pathsOf(
  drafts: DraftFolders
): string[] {
  return [...drafts].map((path) => path.toString());
}

describe("DraftFolders", () => {
  test("follows a renamed or moved folder holding drafts", () => {
    const drafts = draftsOf("maps/new", "maps", "models/new").rebased([
      {
        from: AssetPath.parse("maps"),
        to: AssetPath.parse("world/maps")
      }
    ]);

    assert.deepEqual(pathsOf(drafts), ["world/maps/new", "world/maps", "models/new"]);
  });

  test("drops the drafts deleted with a folder, not its same-prefixed siblings", () => {
    const drafts = draftsOf("maps", "maps/new", "maps-old").without([
      AssetPath.parse("maps")
    ]);

    assert.deepEqual(pathsOf(drafts), ["maps-old"]);
  });

  test("drops a draft once an asset lands under it", () => {
    const drafts = draftsOf("maps", "maps/new").unpopulated([
      AssetPath.parse("maps/overworld.voxelmap.json")
    ]);

    assert.deepEqual(pathsOf(drafts), ["maps/new"]);
  });
});
