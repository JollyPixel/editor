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
  parseNewAssetKind
} from "../../../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import { assetMenu } from "../../../src/shell/assets/assetMenu.ts";
import { createCompanionModel } from "../../helpers/assetTree.ts";

// CONSTANTS
const kModel = createCompanionModel();
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

function buildMenu(
  nodeIds: readonly string[],
  sharing = false
): ContextMenuEntry[] {
  return assetMenu(new AssetSelection(kModel, nodeIds), kKinds, sharing);
}

describe("assetMenu", () => {
  test("the empty area only offers to create", () => {
    assert.deepEqual(outline(buildMenu([])), kCreation);
  });

  test("an asset opens first, deletes last and creates nothing", () => {
    assert.deepEqual(
      outline(buildMenu([assetNodeId("model-hero")])),
      ["open", "-", "rename", "export", "-", "delete"]
    );
  });

  test("an asset offers a share link only when the studio can share", () => {
    assert.deepEqual(
      outline(buildMenu([assetNodeId("model-hero")], true)),
      ["open", "-", "rename", "export", "share", "-", "delete"]
    );
    assert.deepEqual(
      outline(buildMenu([folderNodeId(AssetPath.parse("models"))], true)),
      [...kCreation, "-", "rename", "-", "delete"]
    );
  });

  test("a folder creates inside itself and has no export", () => {
    assert.deepEqual(
      outline(buildMenu([folderNodeId(AssetPath.parse("models"))])),
      [...kCreation, "-", "rename", "-", "delete"]
    );
  });

  test("several rows are only deleted together", () => {
    assert.deepEqual(
      outline(buildMenu([assetNodeId("model-hero"), assetNodeId("map-cave")])),
      ["delete"]
    );
  });

  test("offers one new asset per kind in a submenu, named, iconed and keyed after it", () => {
    const [, newAsset] = buildMenu([]);
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
    assert.deepEqual(
      newAsset.items?.map((item) => parseNewAssetKind(item.id)),
      ["voxelmap", "pixelart"]
    );
    assert.equal(parseNewAssetKind("new-folder"), null);
  });

  test("delete carries the danger intent", () => {
    assert.deepEqual(buildMenu([assetNodeId("model-hero")]).at(-1), {
      id: "delete",
      label: "Delete",
      icon: "trash",
      intent: "danger"
    });
  });
});
