// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  AssetSelection,
  newAssetKindOf
} from "../../../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import { assetMenu } from "../../../src/shell/assets/assetMenu.ts";
import { companionModelOf } from "../../helpers/assetTree.ts";

// CONSTANTS
const kModel = companionModelOf();
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      icon: "kind:voxelmap"
    },
    {
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart"
    }
  ],
  editable: []
});
const kCreation: Outline = [
  "new-folder",
  ["new-asset", ["new-asset:voxelmap", "new-asset:pixelart"]]
];

type Outline = Array<string | [string, Outline]>;

function outline(
  entries: readonly ContextMenuEntry[]
): Outline {
  return entries.map((entry): Outline[number] => {
    if (entry === "separator") {
      return "-";
    }

    return entry.items === undefined ?
      entry.id :
      [entry.id, outline(entry.items)];
  });
}

function menuOf(
  nodeIds: readonly string[]
): ContextMenuEntry[] {
  return assetMenu(new AssetSelection(kModel, nodeIds), kKinds);
}

describe("assetMenu", () => {
  test("the empty area only offers to create", () => {
    assert.deepEqual(outline(menuOf([])), kCreation);
  });

  test("an asset opens first, deletes last and creates nothing", () => {
    assert.deepEqual(
      outline(menuOf([assetNodeId("model-hero")])),
      ["open", "-", "rename", "export", "-", "delete"]
    );
  });

  test("a folder creates inside itself and has no export", () => {
    assert.deepEqual(
      outline(menuOf([folderNodeId(AssetPath.parse("models"))])),
      [...kCreation, "-", "rename", "-", "delete"]
    );
  });

  test("several rows are only deleted together", () => {
    assert.deepEqual(
      outline(menuOf([assetNodeId("model-hero"), assetNodeId("map-cave")])),
      ["delete"]
    );
  });

  test("offers one new asset per kind in a submenu, named and iconed after it", () => {
    const [, newAsset] = menuOf([]);
    assert.ok(newAsset !== "separator");

    assert.deepEqual(newAsset.items, [
      {
        id: "new-asset:voxelmap",
        label: "Voxel map",
        icon: "kind:voxelmap"
      },
      {
        id: "new-asset:pixelart",
        label: "Pixel art",
        icon: "file"
      }
    ]);
  });

  test("a new asset item names its kind", () => {
    assert.equal(newAssetKindOf("new-asset:voxelmap"), "voxelmap");
    assert.equal(newAssetKindOf("new-folder"), null);
  });

  test("delete carries the danger intent", () => {
    assert.deepEqual(menuOf([assetNodeId("model-hero")]).at(-1), {
      id: "delete",
      label: "Delete",
      icon: "trash",
      intent: "danger"
    });
  });
});
