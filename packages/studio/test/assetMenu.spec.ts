// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../src/catalog/AssetPath.ts";
import {
  AssetSelection,
  newAssetKindOf
} from "../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../src/catalog/AssetTreeModel.ts";
import { assetMenu } from "../src/shell/assets/assetMenu.ts";
import { companionModelOf } from "./helpers/assetTree.ts";

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
const kCreation = ["new-folder", "new-asset:voxelmap", "new-asset:pixelart"];

function outline(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.map((entry) => {
    if (entry === "separator") {
      return "-";
    }

    return entry.disabled === true ? `(${entry.id})` : entry.id;
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

  test("an asset opens first and deletes last", () => {
    assert.deepEqual(
      outline(menuOf([assetNodeId("model-hero")])),
      ["open", "-", ...kCreation, "-", "rename", "export", "-", "delete"]
    );
  });

  test("a folder keeps the export item disabled", () => {
    assert.deepEqual(
      outline(menuOf([folderNodeId(AssetPath.parse("models"))])),
      [...kCreation, "-", "rename", "(export)", "-", "delete"]
    );
  });

  test("offers one new asset per kind, named and iconed after it", () => {
    const [, map, texture] = menuOf([]);

    assert.deepEqual(map, {
      id: "new-asset:voxelmap",
      label: "New voxel map",
      icon: "kind:voxelmap"
    });
    assert.deepEqual(texture, {
      id: "new-asset:pixelart",
      label: "New pixel art",
      icon: "file"
    });
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
      intent: "danger",
      disabled: false
    });
  });
});
