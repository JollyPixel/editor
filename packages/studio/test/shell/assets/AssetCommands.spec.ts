// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AssetKindEntry } from "../../../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetRelocation
} from "../../../src/catalog/AssetTreeModel.ts";
import {
  AssetCommands,
  type AssetCommandCatalog
} from "../../../src/shell/assets/AssetCommands.ts";
import { companionModelOf } from "../../helpers/assetTree.ts";

// CONSTANTS
const kMaps = folderNodeId(AssetPath.parse("maps"));
const kMapKind: AssetKindEntry = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json"
};

interface CommandsProbe {
  commands: AssetCommands;
  errors: string[];
  calls: string[];
  created: Parameters<AssetCommandCatalog["create"]>[];
}

function commandsFailingAt(
  failAt: number
): CommandsProbe {
  const calls: string[] = [];
  async function call(
    name: string,
    target: string
  ): Promise<void> {
    calls.push(`${name} ${target}`);
    if (calls.length - 1 === failAt) {
      throw new Error("disk full");
    }
  }
  const created: Parameters<AssetCommandCatalog["create"]>[] = [];
  const catalog: AssetCommandCatalog = {
    create: async(...args) => {
      created.push(args);
      await call("create", args[0]);

      return "created";
    },
    rename: (assetId) => call("rename", assetId),
    remove: (assetId) => call("remove", assetId),
    createFolder: async(path) => {
      await call("createFolder", path);

      return path;
    },
    moveFolder: async(from, to) => {
      await call("moveFolder", `${from} ${to}`);

      return to;
    },
    removeFolder: (path) => call("removeFolder", path),
    exportArchive: async() => new Uint8Array()
  };
  const errors: string[] = [];

  return {
    commands: new AssetCommands({
      catalog,
      onError: (message) => errors.push(message)
    }),
    errors,
    calls,
    created
  };
}

function relocationOf(
  from: string,
  to: string,
  count: number
): AssetRelocation {
  return {
    nodeId: folderNodeId(AssetPath.parse(from)),
    type: "folder",
    from: AssetPath.parse(from),
    to: AssetPath.parse(to),
    renames: Array.from({ length: count }, (_, index) => {
      return {
        assetId: `${from}-${index}`,
        to: `${to}/${index}`
      };
    })
  };
}

describe("AssetCommands", () => {
  test("creates a new asset of a kind in a folder, without content", async() => {
    const { commands, created, errors } = commandsFailingAt(-1);

    const assetId = await commands.create(AssetPath.parse("maps"), kMapKind);

    assert.equal(assetId, "created");
    assert.deepEqual(created, [[
      "maps/New voxel map.voxelmap.json",
      null,
      {
        kind: "voxelmap",
        onConflict: "suffix"
      }
    ]]);
    assert.deepEqual(errors, []);
  });

  test("reports a create the catalog refuses", async() => {
    const { commands, errors } = commandsFailingAt(0);

    assert.equal(await commands.create(AssetPath.ROOT, kMapKind), null);
    assert.deepEqual(errors, ['Could not create "New voxel map": disk full']);
  });

  test("says how many renames of a folder went through and returns it", async() => {
    const { commands, errors } = commandsFailingAt(2);
    const relocation = relocationOf("maps", "worlds", 3);

    assert.equal(await commands.relocate([relocation], "rename"), relocation);
    assert.deepEqual(errors, ['Renamed 2 of 3 assets under "maps": disk full']);
  });

  test("counts every asset of a move of several rows", async() => {
    const { commands, errors } = commandsFailingAt(3);
    const failed = relocationOf("models", "world/models", 2);

    assert.equal(
      await commands.relocate([relocationOf("maps", "world/maps", 1), failed], "move"),
      failed
    );
    assert.deepEqual(errors, ["Moved 2 of 3 assets: disk full"]);
  });

  test("names the project root when a move there fails", async() => {
    const { commands, errors } = commandsFailingAt(0);

    await commands.relocate([relocationOf("maps/old", "old", 1)], "move");

    assert.deepEqual(errors, ['Could not move "old" to the project root: disk full']);
  });

  test("says how many deletions went through, under a folder or not", async() => {
    const model = companionModelOf();
    const owner = commandsFailingAt(1);
    await owner.commands.remove(
      model.deletionOf([assetNodeId("map-overworld")]),
      true
    );
    const folder = commandsFailingAt(1);
    await folder.commands.remove(model.deletionOf([kMaps]), true);

    assert.deepEqual(owner.errors, ["Deleted 1 of 2 assets: disk full"]);
    assert.deepEqual(folder.errors, ['Deleted 1 of 3 assets under "maps": disk full']);
  });

  test("creates a folder, or reports the refusal", async() => {
    const created = commandsFailingAt(-1);
    const refused = commandsFailingAt(0);

    assert.equal(await created.commands.createFolder(AssetPath.parse("maps/draft")), true);
    assert.equal(await refused.commands.createFolder(AssetPath.parse("maps/draft")), false);
    assert.deepEqual(created.calls, ["createFolder maps/draft"]);
    assert.deepEqual(refused.errors, ['Could not create "draft": disk full']);
  });

  test("moves a folder once its assets are renamed", async() => {
    const { commands, calls } = commandsFailingAt(-1);

    assert.equal(
      await commands.relocate([relocationOf("maps", "worlds", 1)], "rename"),
      null
    );
    assert.deepEqual(calls, [
      "rename maps-0",
      "moveFolder maps worlds"
    ]);
  });

  test("reports an unfinished folder move without undoing its renames", async() => {
    const { commands, errors } = commandsFailingAt(1);

    assert.equal(
      await commands.relocate([relocationOf("maps", "worlds", 1)], "rename"),
      null
    );
    assert.deepEqual(errors, ['Could not finish renaming "maps": disk full']);
  });

  test("leaves the folders alone when an asset moves", async() => {
    const { commands, calls } = commandsFailingAt(-1);
    const relocation: AssetRelocation = {
      ...relocationOf("maps/a.png", "a.png", 1),
      type: "asset"
    };

    await commands.relocate([relocation], "move");

    assert.deepEqual(calls, ["rename maps/a.png-0"]);
  });

  test("deletes the folders of a deletion after their assets", async() => {
    const { commands, calls } = commandsFailingAt(-1);
    const deletion = companionModelOf().deletionOf([kMaps]);

    await commands.remove(deletion, false);

    assert.strictEqual(calls.length, deletion.assets.length + 1);
    assert.strictEqual(calls.at(-1), "removeFolder maps");
  });

  test("names the folder whose removal fails", async() => {
    const drafts = AssetPath.parse("drafts");
    const model = new AssetTreeModel([], { folders: [drafts] });
    const { commands, errors } = commandsFailingAt(0);

    await commands.remove(model.deletionOf([folderNodeId(drafts)]), false);

    assert.deepEqual(errors, ['Could not delete "drafts": disk full']);
  });

  test("keeps deleting the other folders when one removal fails", async() => {
    const drafts = AssetPath.parse("drafts");
    const scratch = AssetPath.parse("scratch");
    const model = new AssetTreeModel([], { folders: [drafts, scratch] });
    const { commands, calls, errors } = commandsFailingAt(0);

    await commands.remove(
      model.deletionOf([folderNodeId(drafts), folderNodeId(scratch)]),
      false
    );

    assert.deepEqual(calls, [
      "removeFolder drafts",
      "removeFolder scratch"
    ]);
    assert.deepEqual(errors, ['Could not delete "drafts": disk full']);
  });
});
