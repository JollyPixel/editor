// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import {
  Client,
  LoopbackTransport,
  Server
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_VIEW_ROOM,
  CatalogViewExtension,
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

interface ViewHarness extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly view: CatalogClient;
  readonly ids: Record<"map" | "grass" | "stone" | "other", string>;
  write(assetId: string, ...targets: string[]): Promise<void>;
  viewer(): Promise<Viewer>;
}

interface Viewer extends Disposable {
  readonly catalog: CatalogClient;
}

async function viewHarness(): Promise<ViewHarness> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [linkHandler()],
    reconcile: {
      watch: false
    }
  });
  async function create(
    path: string,
    data: Uint8Array
  ): Promise<string> {
    return (await backend.writer.create({
      path,
      data,
      actor: kActor
    })).unwrap().assetId;
  }
  const grass = await create("textures/grass.png", bytes("grass"));
  const stone = await create("textures/stone.png", bytes("stone"));
  const other = await create("other.link", linkContent());
  const map = await create("map.link", linkContent(grass));

  const server = new Server({ logger: silentLogger() });
  const detach = backend.attach(server);
  const extension = new CatalogViewExtension({
    catalog: backend.catalog,
    scope: () => map
  });
  server.register(extension);
  const transport = new LoopbackTransport({ server });
  async function viewer(): Promise<Viewer> {
    const client = new Client({
      socket: () => transport.connect()
    });
    const catalog = await CatalogClient.connect(client, {
      room: CATALOG_VIEW_ROOM
    });

    return {
      catalog,
      [Symbol.dispose]() {
        catalog.dispose();
        client.destroy();
      }
    };
  }
  const first = await viewer();
  const view = first.catalog;

  return {
    backend,
    view,
    ids: { map, grass, stone, other },
    async write(assetId, ...targets) {
      const changed = new Promise<void>((resolve) => {
        function onChange(): void {
          view.off("change", onChange);
          resolve();
        }
        view.on("change", onChange);
      });
      await backend.writer.update({
        assetId,
        data: linkContent(...targets),
        actor: kActor
      });
      await backend.flush();
      await changed;
    },
    viewer,
    async [Symbol.asyncDispose]() {
      first[Symbol.dispose]();
      detach();
      await server.close();
      await backend.close();
      eventStore.close();
    }
  };
}

function visible(
  harness: ViewHarness
): string[] {
  return Object.entries(harness.ids)
    .filter(([, assetId]) => harness.view.record(assetId) !== undefined)
    .map(([name]) => name);
}

describe("CatalogViewExtension", () => {
  test("shows a viewer only its asset and the dependency closure", async() => {
    await using harness = await viewHarness();

    assert.deepEqual(visible(harness), ["map", "grass"]);
  });

  test("shows an asset linked later and hides one unlinked", async() => {
    await using harness = await viewHarness();
    const { map, stone } = harness.ids;

    await harness.write(map, stone);

    assert.deepEqual(visible(harness), ["map", "stone"]);
    assert.deepEqual(
      harness.view.dependencies.listDependencies(map).map(({ id }) => id),
      [stone]
    );
  });

  test("forwards no change of an asset outside the closure", async() => {
    await using harness = await viewHarness();
    const { map, other, grass, stone } = harness.ids;
    let changes = 0;
    harness.view.on("change", () => changes++);

    await harness.backend.writer.update({
      assetId: other,
      data: linkContent(grass),
      actor: kActor
    });
    await harness.write(map, grass, stone);

    assert.equal(changes, 1);
    assert.equal(harness.view.record(other), undefined);
  });

  test("keeps the other viewers of an asset in step after one leaves", {
    timeout: 5_000
  }, async() => {
    await using harness = await viewHarness();
    const { map, stone } = harness.ids;
    const leaving = await harness.viewer();
    using staying = await harness.viewer();
    leaving[Symbol.dispose]();

    const stoneShown = new Promise<void>((resolve) => {
      staying.catalog.on("change", () => {
        if (staying.catalog.record(stone) !== undefined) {
          resolve();
        }
      });
    });
    await harness.write(map, stone);
    await stoneShown;

    assert.notEqual(harness.view.record(stone), undefined);
  });

  test("rejects every command", async() => {
    await using harness = await viewHarness();

    await assert.rejects(
      harness.view.remove(harness.ids.map),
      CatalogRejectedError
    );
  });
});
