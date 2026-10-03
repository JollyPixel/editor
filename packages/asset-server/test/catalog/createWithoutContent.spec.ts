// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  BINARY_KIND,
  CATALOG_APPLIED,
  CATALOG_CREATE,
  CATALOG_ROOM,
  CatalogExtension,
  CatalogProjection,
  TEXTURE_KIND,
  textureAssetKind,
  type AssetKindHandler
} from "#src/index.ts";
import {
  catalogBackend,
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import { recordingClient } from "../helpers/rooms.ts";

interface CatalogServer extends AsyncDisposable {
  readonly sync: SyncHarness;
  create(path: string, kind?: string): Promise<string | undefined>;
}

async function catalogServer(
  handlers: AssetKindHandler[] = []
): Promise<CatalogServer> {
  const sync = await syncHarness({ handlers });
  const projection = new CatalogProjection({
    eventStore: sync.eventStore
  });
  projection.load();
  projection.start();

  const server = new Server();
  server.register(new CatalogExtension({
    backend: catalogBackend(sync, projection)
  }));
  const author = recordingClient("A");
  server.handleConnect(author, { subject: "A", role: "default" });
  await server.handleMessage("A", { room: CATALOG_ROOM, kind: "join" });

  let requests = 0;

  return {
    sync,
    async create(path, kind) {
      await server.handleMessage("A", {
        room: CATALOG_ROOM,
        kind: "message",
        payload: {
          type: CATALOG_CREATE,
          requestId: `r${++requests}`,
          path,
          kind
        }
      });
      const reply = author.received.at(-1) as {
        payload?: { type?: string; };
      };

      return reply.payload?.type;
    },
    async [Symbol.asyncDispose]() {
      await server.close();
      projection.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

describe("catalog:create without content", () => {
  test("writes the default state of each built-in kind", async() => {
    await using catalog = await catalogServer([textureAssetKind()]);

    assert.strictEqual(await catalog.create("a.bin", BINARY_KIND), CATALOG_APPLIED);
    assert.strictEqual(await catalog.create("a.png", TEXTURE_KIND), CATALOG_APPLIED);
    await catalog.sync.projector.flush();

    assert.strictEqual(catalog.sync.identity.byPath("a.bin")?.kind, BINARY_KIND);
    assert.strictEqual(catalog.sync.identity.byPath("a.png")?.kind, TEXTURE_KIND);
    assert.deepEqual(await catalog.sync.source.read("a.bin"), new Uint8Array());
    assert.deepEqual(await catalog.sync.source.read("a.png"), new Uint8Array());
  });

  test("resolves the kind from the path when omitted", async() => {
    await using catalog = await catalogServer([textureAssetKind()]);

    assert.strictEqual(await catalog.create("a.png"), CATALOG_APPLIED);
    assert.strictEqual(catalog.sync.identity.byPath("a.png")?.kind, TEXTURE_KIND);
  });
});
