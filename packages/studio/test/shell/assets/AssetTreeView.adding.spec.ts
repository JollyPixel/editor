// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import { FakeTreeCatalog } from "../../helpers/assetTree.ts";
import {
  MAP_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";
import { readChips } from "../../helpers/notifications.ts";

describe("AssetTreeView adding notification", () => {
  test("fills the bar with the stages each dropped file has passed", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, notifications } = treeView(catalog);
    const release = catalog.hold();

    const importing = view.importFiles(AssetPath.parse("maps"), [
      new File(["png"], "hero.png"),
      new File(["txt"], "notes.txt")
    ], {
      conversion: async(group) => {
        return { convertTo: group.kinds[0] ?? null };
      },
      conflicts: async() => null
    });
    await setImmediate();
    const whileConverting = notifications.entries[0]?.progress;
    release();
    await importing;

    assert.equal(whileConverting, (1 / 3) / 2);
    assert.equal(notifications.entries[0]?.progress, null);
    assert.deepEqual(readChips(notifications), ["success Added 2 files"]);
  });
});
