// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AssetKindEntry } from "../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../src/catalog/AssetPath.ts";
import {
  assetNodeId,
  folderNodeId,
  type AssetRelocation
} from "../src/catalog/AssetTreeModel.ts";
import {
  AssetCommands,
  type AssetCommandCatalog
} from "../src/shell/assets/AssetCommands.ts";
import { companionModelOf } from "./helpers/assetTree.ts";

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
  created: Parameters<AssetCommandCatalog["create"]>[];
}

function commandsFailingAt(
  failAt: number
): CommandsProbe {
  let calls = 0;
  async function fail(): Promise<void> {
    if (calls++ === failAt) {
      throw new Error("disk full");
    }
  }
  const created: Parameters<AssetCommandCatalog["create"]>[] = [];
  const catalog: AssetCommandCatalog = {
    create: async(...args) => {
      created.push(args);
      await fail();

      return "created";
    },
    rename: fail,
    remove: fail,
    exportArchive: async() => new Uint8Array()
  };
  const errors: string[] = [];

  return {
    commands: new AssetCommands({
      catalog,
      onError: (message) => errors.push(message)
    }),
    errors,
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
    const { commands, errors } = commandsFailingAt(2);
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
});
