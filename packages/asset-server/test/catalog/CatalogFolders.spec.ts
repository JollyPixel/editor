// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  CatalogFolders,
  CatalogProjection,
  createAssetBackend,
  FolderMovedIntoItselfError,
  type AssetEventDataMap
} from "#src/index.ts";
import {
  archiveBackend,
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface FoldersHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly folders: CatalogFolders;
  readonly emitted: string[][];
}

async function foldersHarness(): Promise<FoldersHarness> {
  const sync = await syncHarness();
  const catalog = new CatalogProjection({
    projector: sync.projector
  });
  catalog.load();
  catalog.start();
  const backend = archiveBackend(sync, catalog);
  const folders = new CatalogFolders({
    source: sync.source,
    catalog,
    flush: () => backend.flush()
  });
  const emitted: string[][] = [];
  folders.on("changed", (paths) => emitted.push([...paths]));

  return {
    sync,
    folders,
    emitted,
    async [Symbol.asyncDispose]() {
      folders.close();
      catalog.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

describe("CatalogFolders", () => {
  test("refresh lists the source folders and those of unprojected assets", async() => {
    await using harness = await foldersHarness();
    await harness.sync.source.createFolder("drafts");
    await harness.sync.writer.create({
      path: "maps/world/overworld.json",
      data: bytes("{}"),
      actor: kActor
    });

    await harness.folders.refresh();
    await harness.folders.refresh();

    assert.deepEqual(harness.folders.toJSON(), [
      "drafts",
      "maps",
      "maps/world"
    ]);
    assert.deepEqual(harness.emitted.at(-1), harness.folders.toJSON());
  });

  test("keeps the folder an asset is renamed out of", async() => {
    await using harness = await foldersHarness();
    const created = (await harness.sync.writer.create({
      path: "maps/overworld.json",
      data: bytes("{}"),
      actor: kActor
    })).unwrap();
    await harness.sync.writer.rename({
      assetId: created.assetId,
      to: "tiles/overworld.json",
      actor: kActor
    });

    assert.deepEqual(harness.emitted, [
      ["maps"],
      ["maps", "tiles"]
    ]);
  });

  test("create adds the folder and its parents once", async() => {
    await using harness = await foldersHarness();

    const created = await harness.folders.create("maps/draft");
    await harness.folders.create("maps/draft");

    assert.strictEqual(created, "maps/draft");
    assert.deepEqual(harness.emitted, [
      ["maps", "maps/draft"]
    ]);
  });

  test("delete keeps the sub-folders still holding an asset", async() => {
    await using harness = await foldersHarness();
    await harness.folders.create("maps/draft");
    await harness.sync.writer.create({
      path: "maps/world/overworld.json",
      data: bytes("{}"),
      actor: kActor
    });
    await harness.sync.projector.flush();

    await harness.folders.delete("maps");

    assert.deepEqual(harness.folders.toJSON(), [
      "maps",
      "maps/world"
    ]);
  });
});

describe("CatalogFolders — move", () => {
  test("recreates the subtree at the target and removes the emptied origin", async() => {
    await using harness = await foldersHarness();
    await harness.folders.create("maps/draft/deep");
    const created = (await harness.sync.writer.create({
      path: "maps/overworld.json",
      data: bytes("{}"),
      actor: kActor
    })).unwrap();
    await harness.sync.writer.rename({
      assetId: created.assetId,
      to: "levels/overworld.json",
      actor: kActor
    });

    const moved = await harness.folders.move("maps", "levels");

    assert.strictEqual(moved, "levels");
    assert.deepEqual(harness.folders.toJSON(), [
      "levels",
      "levels/draft",
      "levels/draft/deep"
    ]);
    assert.deepEqual(await harness.sync.source.list(), [
      "levels/overworld.json"
    ]);
  });

  test("rejects a folder moved into itself", async() => {
    await using harness = await foldersHarness();
    await harness.folders.create("maps");

    await assert.rejects(
      () => harness.folders.move("maps", "maps/inner"),
      FolderMovedIntoItselfError
    );
    assert.deepEqual(harness.folders.toJSON(), ["maps"]);
  });
});

describe("CatalogFolders — ordering", () => {
  test("a folder created while a refresh reads the source is kept", async() => {
    await using harness = await foldersHarness();
    const listed = Promise.withResolvers<void>();
    const original = harness.sync.source.folders.bind(harness.sync.source);
    harness.sync.source.folders = async() => {
      const folders = await original();
      await listed.promise;

      return folders;
    };

    const refreshed = harness.folders.refresh();
    const created = harness.folders.create("drafts");
    listed.resolve();
    await Promise.all([refreshed, created]);

    assert.deepEqual(harness.folders.toJSON(), ["drafts"]);
    assert.deepEqual(harness.emitted.at(-1), ["drafts"]);
  });
});

describe("createAssetBackend folders", () => {
  test("lists the empty folders of the source at startup", async() => {
    const source = new MemoryAssetSource([
      ["maps/overworld.json", bytes("{}")]
    ]);
    await source.createFolder("drafts/empty");

    await using backend = await createAssetBackend({
      source,
      eventStore: EventStore.persistence.memory<AssetEventDataMap>(),
      watch: false
    });

    assert.deepEqual(backend.folders.toJSON(), [
      "drafts",
      "drafts/empty",
      "maps"
    ]);
  });
});
