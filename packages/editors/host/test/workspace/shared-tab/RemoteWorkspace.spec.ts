// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { indexedDB } from "fake-indexeddb";
import { BINARY_KIND } from "@jolly-pixel/asset-server";
import { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { openSharedTabWorkspace } from "#src/workspace/shared-tab/openSharedTabWorkspace.ts";
import { openBridgeChannel } from "#src/workspace/shared-tab/protocol.ts";

Object.assign(globalThis, { indexedDB });

async function openTabs() {
  const name = `remote-${crypto.randomUUID()}`;
  const options = {
    name,
    project: () => {
      return {
        handlers: [],
        seed: {
          "readme.bin": {
            id: "readme",
            kind: BINARY_KIND,
            content: () => new TextEncoder().encode("hello")
          }
        }
      };
    }
  };
  const owner = await openSharedTabWorkspace(options);
  const follower = await openSharedTabWorkspace(options);

  return {
    name,
    follower,
    [Symbol.asyncDispose]: async() => {
      await follower.close();
      await owner.close();
    }
  };
}

describe("RemoteWorkspace", () => {
  it("hands the launch catalog to its first connection", async() => {
    await using tabs = await openTabs();
    const [source] = tabs.follower.launchSources(BINARY_KIND);

    assert.strictEqual((await source.read())?.target.value, "readme");
    const first = tabs.follower.connect();
    const second = tabs.follower.connect();
    const catalog = await first.openCatalog?.(first.client, {});
    try {
      assert.ok(catalog instanceof CatalogClient);
      assert.strictEqual(catalog.record("readme")?.kind, BINARY_KIND);
      assert.strictEqual(second.openCatalog, undefined);
    }
    finally {
      catalog?.dispose();
      first.client.destroy();
      second.client.destroy();
    }
  });

  it("drops the launch catalog when a connection opened first", async() => {
    await using tabs = await openTabs();
    const early = tabs.follower.connect();
    const [source] = tabs.follower.launchSources(BINARY_KIND);

    assert.strictEqual((await source.read())?.target.value, "readme");
    const next = tabs.follower.connect();
    try {
      assert.strictEqual(next.openCatalog, undefined);
    }
    finally {
      early.client.destroy();
      next.client.destroy();
    }
  });

  it("keeps socket traffic off the shared workspace channel", async() => {
    await using tabs = await openTabs();
    const shared = openBridgeChannel(tabs.name);
    const types: unknown[] = [];
    shared.addEventListener("message", (event) => {
      types.push((event.data as { type: unknown; }).type);
    });
    const connection = tabs.follower.connect();
    try {
      const catalog = await CatalogClient.connect(connection.client);
      assert.strictEqual(catalog.record("readme")?.kind, BINARY_KIND);
      catalog.dispose();

      assert.ok(types.includes("connect"));
      assert.deepEqual(
        types.filter((type) => type === "send" || type === "event"),
        []
      );
    }
    finally {
      connection.client.destroy();
      shared.close();
    }
  });
});
