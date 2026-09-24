// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { Server } from "@jolly-pixel/network";
import { Client } from "@jolly-pixel/network/client";
import { LoopbackTransport } from "@jolly-pixel/network/transport/loopback.ts";

// Import Internal Dependencies
import {
  createAssetBackend,
  silentLogger,
  type AssetBackend
} from "#src/index.ts";
import {
  CatalogClient,
  CatalogRejectedError
} from "#src/catalog/client/index.ts";
import {
  linkContent,
  linkHandler
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface LinkedWorkspace extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly catalog: CatalogClient;
  readonly targetId: string;
  readonly linkId: string;
}

async function linkedWorkspace(
  catalogDeleteProtection?: boolean
): Promise<LinkedWorkspace> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [linkHandler()],
    catalogDeleteProtection,
    watch: false
  });
  const target = (await backend.writer.create({
    path: "textures/grass.png",
    data: bytes("grass"),
    actor: kActor
  })).unwrap();
  const link = (await backend.writer.create({
    path: "a.link",
    data: linkContent(target.assetId),
    actor: kActor
  })).unwrap();

  const server = new Server({ logger: silentLogger() });
  const detach = backend.attach(server);
  const transport = new LoopbackTransport({ server });
  const client = new Client({
    socket: () => transport.connect()
  });
  const catalog = await CatalogClient.connect(client);

  return {
    backend,
    catalog,
    targetId: target.assetId,
    linkId: link.assetId,
    async [Symbol.asyncDispose]() {
      catalog.dispose();
      client.destroy();
      detach();
      await server.close();
      await backend.close();
      eventStore.close();
    }
  };
}

describe("catalog delete protection", () => {
  test("refuses a delete while another asset references the target", async() => {
    await using workspace = await linkedWorkspace();

    await assert.rejects(
      workspace.catalog.remove(workspace.targetId),
      (error: CatalogRejectedError) => {
        assert.strictEqual(error.name, "CatalogRejectedError");
        assert.match(error.message, /still referenced by "a\.link"/);

        return true;
      }
    );
    await workspace.backend.flush();

    assert.notStrictEqual(
      workspace.backend.catalog.record(workspace.targetId),
      undefined
    );
    assert.notStrictEqual(
      workspace.catalog.record(workspace.targetId),
      undefined
    );
  });

  test("deletes a referenced asset when the caller forces it", async() => {
    await using workspace = await linkedWorkspace();

    await workspace.catalog.remove(workspace.targetId, { force: true });
    await workspace.backend.flush();

    assert.strictEqual(
      workspace.backend.catalog.record(workspace.targetId),
      undefined
    );
  });

  test("deletes freely once the last dependent is gone", async() => {
    await using workspace = await linkedWorkspace();

    await workspace.catalog.remove(workspace.linkId);
    await workspace.catalog.remove(workspace.targetId);
    await workspace.backend.flush();

    assert.strictEqual(workspace.backend.catalog.size, 0);
  });

  test("lets the backend opt out of the protection", async() => {
    await using workspace = await linkedWorkspace(false);

    await workspace.catalog.remove(workspace.targetId);
    await workspace.backend.flush();

    assert.strictEqual(
      workspace.backend.catalog.record(workspace.targetId),
      undefined
    );
  });
});
