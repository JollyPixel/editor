// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import { assetNodeId } from "../../../src/catalog/AssetTreeModel.ts";
import { LARGE_FILE_BYTES } from "../../../src/shell/assets/fileSize.ts";
import { FakeTreeCatalog } from "../../helpers/assetTree.ts";
import {
  MODEL_MAX_CONTENT_BYTES,
  MODEL_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";

// CONSTANTS
const kLargeFileBytes = LARGE_FILE_BYTES + 1;
const kOversizedFileBytes = MODEL_MAX_CONTENT_BYTES + 1;

describe("AssetTreeView file sizes", () => {
  test("refuses a drop over the limit of the kind it becomes, adds large ones once confirmed", async() => {
    const added: Record<string, string[]> = {};
    for (const acceptLargeFiles of [false, true]) {
      const catalog = new FakeTreeCatalog([], ["maps"]);
      const { view, errors, prompted } = treeView(catalog, { acceptLargeFiles });

      await view.importFiles(AssetPath.parse("maps"), [
        new File([new Uint8Array(kOversizedFileBytes)], "hero.voxelmodel.json"),
        new File([new Uint8Array(kOversizedFileBytes)], "ship.vox"),
        new File([new Uint8Array(kLargeFileBytes)], "scan.txt"),
        new File(["txt"], "notes.txt")
      ], {
        conversion: async({ kinds }) => {
          return { convertTo: kinds[0] };
        },
        conflicts: async() => null
      });
      catalog.change();

      assert.deepEqual(errors, [
        "Could not add \"hero.voxelmodel.json\": it is larger than 12 MB",
        "Could not add \"ship.vox\": it is larger than 12 MB"
      ]);
      assert.deepEqual(prompted, ["confirm large scan.txt"]);
      added[String(acceptLargeFiles)] = [...catalog.records()].map((record) => record.path).sort();
    }

    assert.deepEqual(added, {
      false: ["maps/notes.txt"],
      true: ["maps/notes.txt", "maps/scan.txt"]
    });
  });

  test("refuses a replacement over its kind's limit and sends a large one once confirmed", async() => {
    const replaced: Record<string, string[]> = {};
    for (const acceptLargeFiles of [false, true]) {
      const catalog = new FakeTreeCatalog([MODEL_RECORD], ["maps"]);
      const { view, errors, prompted } = treeView(catalog, {
        acceptLargeFiles,
        picks: [
          new File([new Uint8Array(kOversizedFileBytes)], "hero.voxelmodel.json"),
          new File([new Uint8Array(kLargeFileBytes)], "hero.voxelmodel.json")
        ]
      });

      for (let pick = 0; pick < 2; pick++) {
        view.run("replace", [assetNodeId(MODEL_RECORD.id)]);
        await setImmediate();
      }

      assert.deepEqual(errors, [
        "Could not replace \"hero.voxelmodel.json\": \"hero.voxelmodel.json\" is larger than 12 MB"
      ]);
      assert.strictEqual(prompted.at(-1), "confirm large hero.voxelmodel.json");
      replaced[String(acceptLargeFiles)] = catalog.replaced.map(({ assetId }) => assetId);
    }

    assert.deepEqual(replaced, {
      false: [],
      true: [MODEL_RECORD.id]
    });
  });
});
