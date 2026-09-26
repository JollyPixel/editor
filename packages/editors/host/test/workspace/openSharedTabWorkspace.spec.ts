// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { indexedDB } from "fake-indexeddb";
import { BINARY_KIND } from "@jolly-pixel/asset-server";
import { CATALOG_ROOM, CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { openSharedTabWorkspace } from "#src/workspace/shared-tab/openSharedTabWorkspace.ts";

Object.assign(globalThis, { indexedDB });

test("a second tab edits the persistent catalog through its owner", async() => {
  const name = `shared-${crypto.randomUUID()}`;
  const options = {
    name,
    handlers: [],
    seed: {
      "readme.bin": {
        id: "readme",
        kind: BINARY_KIND,
        content: () => new TextEncoder().encode("hello")
      }
    }
  };
  const owner = await openSharedTabWorkspace(options);
  const follower = await openSharedTabWorkspace(options);
  const first = owner.connect();
  const second = follower.connect();
  const firstCatalog = new CatalogClient(first.client.room(CATALOG_ROOM));
  const secondCatalog = new CatalogClient(second.client.room(CATALOG_ROOM));
  try {
    await Promise.all([firstCatalog.ready, secondCatalog.ready]);
    assert.strictEqual(owner.persistent, true);
    assert.strictEqual(follower.persistent, true);
    assert.deepEqual(
      (await follower.launchSources(BINARY_KIND)).length,
      3
    );
    const changed = new Promise<void>((resolve) => {
      secondCatalog.on("change", resolve);
    });
    const id = await firstCatalog.create(
      "second.bin",
      new TextEncoder().encode("second"),
      { kind: BINARY_KIND }
    );
    await changed;
    assert.strictEqual(secondCatalog.record(id)?.source, "second.bin");
  }
  finally {
    firstCatalog.dispose();
    secondCatalog.dispose();
    first.client.destroy();
    second.client.destroy();
    await follower.close();
    await owner.close();
  }
});
