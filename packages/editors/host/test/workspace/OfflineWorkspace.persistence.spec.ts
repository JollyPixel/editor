// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { indexedDB } from "fake-indexeddb";
import {
  BINARY_KIND,
  type AssetSeedMap
} from "@jolly-pixel/asset-server/backend";
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  LAST_OPENED_STORAGE_PREFIX,
  LastOpenedLaunchSource
} from "#src/launch/sources/LastOpenedLaunchSource.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "guest"
};
const kSeedIds = ["seed-readme", "seed-notes"];

Object.assign(globalThis, {
  indexedDB,
  localStorage: window.localStorage
});

function bytes(
  value: string
): Uint8Array {
  return new TextEncoder().encode(value);
}

function seed(): AssetSeedMap {
  return {
    "notes/readme.bin": {
      id: kSeedIds[0],
      kind: BINARY_KIND,
      content: () => bytes("readme")
    },
    "notes/notes.bin": {
      id: kSeedIds[1],
      kind: BINARY_KIND,
      content: () => bytes("notes")
    }
  };
}

function open(
  name: string
): Promise<OfflineWorkspace> {
  return OfflineWorkspace.open({
    handlers: [],
    seed,
    storage: "indexeddb",
    name
  });
}

function catalogIds(
  workspace: OfflineWorkspace
): string[] {
  return Array.from(
    workspace.backend.catalog.catalog,
    (record) => record.id.value
  ).sort();
}

describe("OfflineWorkspace on IndexedDB", () => {
  test("a reload keeps asset content and ids", async() => {
    const first = await open("reload");
    const created = (await first.backend.writer.create({
      path: "maps/new.bin",
      data: bytes("map"),
      actor: kActor
    })).unwrap();
    await first.close();

    const second = await open("reload");

    assert.strictEqual(second.persistent, true);
    assert.deepEqual(
      catalogIds(second),
      [created.assetId, ...kSeedIds].sort()
    );
    assert.deepEqual(
      await second.backend.source.read("maps/new.bin"),
      bytes("map")
    );
    await second.close();
  });

  test("a stale projection checkpoint does not block writes", async() => {
    const first = await open("checkpoint");
    await first.backend.writer.create({
      path: "imported.bin",
      data: bytes("first"),
      assetId: "imported",
      actor: kActor
    });
    for (let revision = 0; revision < 12; revision++) {
      await first.backend.writer.update({
        assetId: "imported",
        data: bytes(`revision ${revision}`),
        actor: kActor
      });
    }
    await first.backend.writer.remove({
      assetId: "imported",
      actor: kActor
    });
    await first.close();

    const second = await open("checkpoint");
    await second.backend.writer.create({
      path: "imported.bin",
      data: bytes("imported again"),
      assetId: "imported",
      actor: kActor
    });
    await second.close();

    const third = await open("checkpoint");
    assert.deepEqual(
      await third.backend.source.read("imported.bin"),
      bytes("imported again")
    );
    await third.close();
  });

  test("a rename then a reload keeps one asset", async() => {
    const first = await open("rename");
    await first.backend.writer.rename({
      assetId: kSeedIds[0],
      to: "notes/renamed.bin",
      actor: kActor
    });
    await first.close();

    const second = await open("rename");

    assert.deepEqual(catalogIds(second), [...kSeedIds].sort());
    assert.strictEqual(
      second.backend.catalog.record(kSeedIds[0])?.source,
      "notes/renamed.bin"
    );
    await second.close();
  });

  test("a deleted seed asset stays deleted after a reload", async() => {
    const first = await open("delete");
    await first.backend.writer.remove({
      assetId: kSeedIds[0],
      actor: kActor
    });
    await first.close();

    const second = await open("delete");

    assert.deepEqual(catalogIds(second), [kSeedIds[1]]);
    await second.close();
  });

  test("a second tab falls back to memory storage", async() => {
    const first = await open("tabs");
    const second = await open("tabs");

    assert.strictEqual(first.persistent, true);
    assert.strictEqual(second.persistent, false);
    assert.strictEqual(second.storage, "memory");
    await second.close();
    await first.close();

    const third = await open("tabs");
    assert.strictEqual(third.persistent, true);
    await third.close();
  });

  test("failed seeding releases the persistent database", async() => {
    const failure = new Error("seed failed");
    await assert.rejects(
      OfflineWorkspace.open({
        handlers: [],
        storage: "indexeddb",
        name: "failed-seed",
        seed: () => {
          throw failure;
        }
      }),
      failure
    );

    const workspace = await open("failed-seed");
    assert.equal(workspace.persistent, true);
    await workspace.close();
  });

  test("reset empties the database", async() => {
    const first = await open("reset");
    await first.backend.writer.create({
      path: "extra.bin",
      data: bytes("extra"),
      actor: kActor
    });
    await first.reset();

    const second = await open("reset");

    assert.deepEqual(catalogIds(second), [...kSeedIds].sort());
    await second.close();
  });
});

describe("OfflineWorkspace launch sources", () => {
  async function target(
    workspace: OfflineWorkspace
  ): Promise<string> {
    const launch = await EditorLaunch.read(
      workspace.launchSources(BINARY_KIND)
    );

    return launch.target.value;
  }

  test("falls back to the first record of the accepted kind", async() => {
    localStorage.clear();
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed
    });

    assert.ok(kSeedIds.includes(await target(workspace)));
    await workspace.close();
  });

  test("prefers the last opened target while it is known", async() => {
    localStorage.clear();
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed
    });

    LastOpenedLaunchSource.remember(BINARY_KIND, kSeedIds[1]);
    assert.strictEqual(await target(workspace), kSeedIds[1]);

    localStorage.setItem(`${LAST_OPENED_STORAGE_PREFIX}${BINARY_KIND}`, "gone");
    assert.notStrictEqual(await target(workspace), "gone");
    await workspace.close();
  });

  test("the query target wins over the last opened one", async() => {
    localStorage.clear();
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed
    });
    LastOpenedLaunchSource.remember(BINARY_KIND, kSeedIds[1]);
    const search = location.search;
    location.search = `?target=${kSeedIds[0]}`;

    try {
      assert.strictEqual(await target(workspace), kSeedIds[0]);
    }
    finally {
      location.search = search;
      await workspace.close();
    }
  });

  test("ignores a query target absent from the offline catalog", async() => {
    localStorage.clear();
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed
    });
    const search = location.search;
    location.search = "?target=server-only";

    try {
      assert.ok(kSeedIds.includes(await target(workspace)));
    }
    finally {
      location.search = search;
      await workspace.close();
    }
  });
});
