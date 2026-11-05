// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  assetNodeId,
  folderNodeId,
  type AssetTreeNode
} from "../../../src/catalog/AssetTreeModel.ts";
import {
  FakeTreeCatalog,
  findLabel
} from "../../helpers/assetTree.ts";
import {
  MAP_RECORD,
  MODEL_RECORD,
  TREE_KINDS,
  treeView
} from "../../helpers/assetTreeView.ts";
import { readChips } from "../../helpers/notifications.ts";

function pendingRows(
  nodes: readonly AssetTreeNode[],
  folder = ""
): string[] {
  return nodes.flatMap((node) => (
    node.pending === undefined ?
      pendingRows(node.children ?? [], `${folder}${node.label}/`) :
      [`${folder}${node.label}: ${node.pending}`]
  ));
}

describe("AssetTreeView", () => {
  test("shows a new name while renaming and the old one again when the rename fails", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    catalog.failure = "disk full";
    const { view, errors } = treeView(catalog);
    const nodeId = assetNodeId(MAP_RECORD.id);
    const before = findLabel(view.nodes, nodeId);

    const renaming = view.rename(nodeId, "world");
    const during = findLabel(view.nodes, nodeId);
    await renaming;

    assert.notEqual(during, before);
    assert.equal(findLabel(view.nodes, nodeId), before);
    assert.equal(errors.length, 1);
  });

  test("keeps a renamed folder expanded and selected under its new path", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, browserState } = treeView(catalog);
    const maps = folderNodeId(AssetPath.parse("maps"));
    const world = folderNodeId(AssetPath.parse("world"));
    view.toggle(maps, true);
    view.select([maps]);

    await view.rename(maps, "world");
    catalog.change();
    view.refresh();

    assert.ok(view.model.has(world));
    assert.ok(view.expanded.has(world));
    assert.deepEqual(view.selected, [world]);
    assert.ok(browserState.expandedFolders.has(world));
  });

  test("asks once per convertible format and adds the dropped files in the folder", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, errors, notifications } = treeView(catalog);
    const asked: string[] = [];

    await view.importFiles(AssetPath.parse("maps"), [
      new File(["png"], "hero.png"),
      new File(["png"], "tiles.png"),
      new File(["vox"], "tree.vox"),
      new File(["txt"], "notes.txt"),
      new File(["zip"], "photos.zip")
    ], {
      conversion: async(group) => {
        asked.push(group.format);

        return group.format === ".png" ?
          { convertTo: TREE_KINDS.findEntry("pixelart") ?? null } :
          null;
      },
      conflicts: async() => null
    });
    catalog.change();

    assert.deepEqual(asked, [".png", ".vox"]);
    assert.deepEqual(
      [...catalog.records()].map((record) => record.path).sort(),
      [
        "maps/hero.pixelart",
        "maps/notes.txt",
        "maps/overworld.voxelmap.json",
        "maps/photos.zip",
        "maps/tiles.pixelart"
      ]
    );
    assert.ok(view.expanded.has(folderNodeId(AssetPath.parse("maps"))));
    assert.deepEqual(errors, []);
    assert.deepEqual(readChips(notifications), ["success Added 4 files"]);
  });

  test("shows dropped files as pending rows until the catalog lists them", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, imported } = treeView(catalog);
    const asked: string[] = [];
    const release = catalog.hold();

    const importing = view.importFiles(AssetPath.parse("maps"), [
      new File(["png"], "hero.png"),
      new File(["vox"], "tree.vox"),
      new File(["txt"], "notes.txt")
    ], {
      conversion: async(group) => {
        asked.push(group.format);

        return { convertTo: group.kinds[0] ?? null };
      },
      conflicts: async() => null
    });
    await setImmediate();
    const askedWhileAdding = [...asked];
    const whileAdding = pendingRows(view.nodes);
    release();
    await importing;
    const beforeEcho = pendingRows(view.nodes);
    catalog.change();
    view.refresh();

    const added = [...catalog.byId.values()]
      .filter(({ id }) => id !== MAP_RECORD.id);
    assert.deepEqual(askedWhileAdding, [".png", ".vox"]);
    assert.deepEqual(whileAdding, [
      "maps/hero.pixelart: Converting to Pixel art",
      "maps/notes.txt: Adding",
      "maps/tree.voxelmodel.json: Converting to Voxel model"
    ]);
    assert.deepEqual(beforeEcho, whileAdding);
    assert.deepEqual(pendingRows(view.nodes), []);
    assert.deepEqual(added.map(({ path }) => path).sort(), [
      "maps/hero.pixelart",
      "maps/notes.txt",
      "maps/tree.voxelmodel.json"
    ]);
    assert.equal(imported.length, 1);
    assert.ok(added.some(({ id }) => imported[0] === assetNodeId(id)));
  });

  test("reveals a dropped file the catalog lists before its add resolves", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    catalog.echoBeforeReply = true;
    const { view, imported } = treeView(catalog);

    await view.importFiles(AssetPath.parse("maps"), [
      new File(["txt"], "notes.txt")
    ], {
      conversion: async() => null,
      conflicts: async() => null
    });
    view.refresh();

    assert.deepEqual(pendingRows(view.nodes), []);
    assert.deepEqual(imported, [assetNodeId("created-1")]);
  });

  test("removes the pending row of a file the catalog refuses", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    catalog.failure = "disk full";
    const { view, errors, imported, notifications } = treeView(catalog);

    await view.importFiles(AssetPath.parse("maps"), [
      new File(["txt"], "notes.txt")
    ], {
      conversion: async() => null,
      conflicts: async() => null
    });

    assert.deepEqual(pendingRows(view.nodes), []);
    assert.deepEqual(errors, []);
    assert.deepEqual(imported, []);
    assert.deepEqual(readChips(notifications), [
      "error Could not add \"notes.txt\": disk full"
    ]);
  });

  test("selects a new asset and asks to rename it once the catalog lists it", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, created } = treeView(catalog);

    await view.createAsset("voxelmap", AssetPath.parse("maps"));
    view.refresh();
    const beforeEcho = [...created];
    catalog.change();
    view.refresh();

    const [assetId] = [...catalog.byId.keys()].filter((id) => id !== MAP_RECORD.id);
    assert.ok(assetId !== undefined);
    assert.deepEqual(beforeEcho, []);
    assert.deepEqual(created, [assetNodeId(assetId)]);
    assert.deepEqual(view.selected, [assetNodeId(assetId)]);
    assert.ok(view.expanded.has(folderNodeId(AssetPath.parse("maps"))));
  });
});

describe("AssetTreeView actions", () => {
  test("offers share only when the studio can share, and only on one asset", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const maps = folderNodeId(AssetPath.parse("maps"));
    const map = assetNodeId(MAP_RECORD.id);
    const offline = treeView(catalog);
    const online = treeView(catalog, { sharing: true });

    offline.view.run("share", [map]);
    online.view.run("share", [maps]);
    online.view.run("share", [map]);

    assert.deepEqual(
      [offline.view.allows("share", [map]), online.view.allows("share", [maps])],
      [false, false]
    );
    assert.deepEqual(offline.prompted, []);
    assert.deepEqual(online.prompted, [`share ${MAP_RECORD.id}`]);
  });

  test("opens and renames through the page's prompts, rename on one row only", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD, MODEL_RECORD], ["maps"]);
    const { view, prompted } = treeView(catalog);
    const map = assetNodeId(MAP_RECORD.id);
    const model = assetNodeId(MODEL_RECORD.id);

    view.run("open", [map]);
    view.run("rename", [map, model]);
    view.select([model]);
    view.run("rename");

    assert.deepEqual(prompted, [`open ${MAP_RECORD.id}`, `rename ${model}`]);
  });

  test("replaces an asset with a file of its format or one its kind converts, refusing others", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD, MODEL_RECORD], ["maps"]);
    const { view, prompted, errors, notifications } = treeView(catalog, {
      picks: [
        new File(["json"], "Hero.VoxelModel.json"),
        new File(["vox"], "tree.vox"),
        new File(["txt"], "notes.txt"),
        null
      ]
    });
    const model = assetNodeId(MODEL_RECORD.id);

    for (let pick = 0; pick < 4; pick++) {
      view.run("replace", [model]);
      await setImmediate();
    }
    view.run("replace", [assetNodeId(MAP_RECORD.id), model]);

    assert.deepEqual(catalog.replaced, [
      { assetId: MODEL_RECORD.id, content: "json", from: undefined },
      { assetId: MODEL_RECORD.id, content: "vox", from: ".vox" }
    ]);
    assert.deepEqual(errors, [
      "Could not replace \"hero.voxelmodel.json\" with \"notes.txt\": it is not a .voxelmodel.json file"
    ]);
    assert.deepEqual(readChips(notifications), [
      "success Replaced \"hero.voxelmodel.json\": with \"tree.vox\"",
      "success Replaced \"hero.voxelmodel.json\": with \"Hero.VoxelModel.json\""
    ]);
    assert.deepEqual(new Set(prompted), new Set(["pick .voxelmodel.json,.vox"]));
    assert.equal(prompted.length, 4);
  });

  test("turns the replace notification into the catalog's refusal", async() => {
    const catalog = new FakeTreeCatalog([MODEL_RECORD], []);
    catalog.failure = "disk full";
    const { view, errors, notifications } = treeView(catalog, {
      picks: [new File(["json"], "Hero.VoxelModel.json")]
    });

    view.run("replace", [assetNodeId(MODEL_RECORD.id)]);
    await setImmediate();

    assert.deepEqual(errors, []);
    assert.deepEqual(readChips(notifications), [
      "error Could not replace \"hero.voxelmodel.json\": disk full"
    ]);
  });
});
