// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetPath } from "../src/catalog/AssetPath.ts";
import { AssetSelection } from "../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../src/catalog/AssetTreeModel.ts";
import { assetMenu } from "../src/shell/assets/assetMenu.ts";
import { companionModelOf } from "./helpers/assetTree.ts";

// CONSTANTS
const kModel = companionModelOf();

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
  return assetMenu(new AssetSelection(kModel, nodeIds));
}

describe("assetMenu", () => {
  test("the empty area only offers a new folder", () => {
    assert.deepEqual(outline(menuOf([])), ["new-folder"]);
  });

  test("an asset opens first and deletes last", () => {
    assert.deepEqual(
      outline(menuOf([assetNodeId("model-hero")])),
      ["open", "-", "new-folder", "rename", "export", "-", "delete"]
    );
  });

  test("a folder keeps the export item disabled", () => {
    assert.deepEqual(
      outline(menuOf([folderNodeId(AssetPath.parse("models"))])),
      ["new-folder", "rename", "(export)", "-", "delete"]
    );
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
