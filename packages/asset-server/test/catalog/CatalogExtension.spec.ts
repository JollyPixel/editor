// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type {
  ClientHandle,
  RoomContext
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  createCatalogHandler,
  CATALOG_CHANGED,
  CATALOG_SNAPSHOT,
  DEFAULT_CATALOG_PATH
} from "#src/index.ts";
import { syncHarness } from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface FakeRoom {
  context: RoomContext;
  broadcasts: unknown[];
  direct: { clientId: string; payload: unknown; }[];
}

function fakeRoom(): FakeRoom {
  const broadcasts: unknown[] = [];
  const direct: { clientId: string; payload: unknown; }[] = [];

  return {
    broadcasts,
    direct,
    context: {
      room: {
        broadcast: (payload) => broadcasts.push(payload),
        sendTo: (clientId, payload) => direct.push({ clientId, payload })
      },
      eventStore: {
        append: () => Promise.resolve(true),
        list: () => Promise.resolve([])
      }
    }
  };
}

function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

describe("CatalogExtension — join", () => {
  test("sends the snapshot to the joining client", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);

    assert.strictEqual(room.direct.length, 1);
    assert.deepEqual(room.direct[0], {
      clientId: "A",
      payload: {
        type: CATALOG_SNAPSHOT,
        manifest: projection.snapshot()
      }
    });
    extension.dispose();
  });

  test("every joiner gets its own snapshot", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);
    extension.onClientConnect(client("B"), {}, room.context);

    assert.deepEqual(
      room.direct.map((entry) => entry.clientId),
      ["A", "B"]
    );
    extension.dispose();
  });
});

describe("CatalogExtension — broadcast", () => {
  test("one broadcast per subsequent catalog event", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();
    projection.start();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.strictEqual(room.broadcasts.length, 1);
    assert.deepEqual(
      (room.broadcasts[0] as { type: string; }).type,
      CATALOG_CHANGED
    );
    extension.dispose();
    projection.close();
  });

  test("a domain event broadcasts nothing", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);

    harness.eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: kActor
    }).unwrap();

    assert.deepEqual(room.broadcasts, []);
    extension.dispose();
    projection.close();
  });

  test("stops broadcasting once the last client left", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);
    extension.onClientDisconnect("A");

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.deepEqual(room.broadcasts, []);
    extension.dispose();
    projection.close();
  });

  test("dispose unsubscribes from the projection", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    const extension = new CatalogExtension({ projection });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), {}, room.context);
    extension.dispose();

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.deepEqual(room.broadcasts, []);
    projection.close();
  });

  test("names its wire events for the rights table", () => {
    const extension = new CatalogExtension({
      projection: new CatalogProjection({
        eventStore: null as never
      })
    });

    assert.strictEqual(
      extension.getEventName({ type: CATALOG_CHANGED }),
      CATALOG_CHANGED
    );
    assert.strictEqual(extension.getEventName(null), CATALOG_CHANGED);
    extension.dispose();
  });
});

describe("catalog HTTP handler", () => {
  test("returns the same bytes as the snapshot", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    const server = http.createServer((request, response) => {
      createCatalogHandler({ projection })(request, response, () => {
        response.statusCode = 404;
        response.end();
      });
    });
    server.listen(0);
    await new Promise((resolve) => {
      server.once("listening", resolve);
    });
    const { port } = server.address() as { port: number; };

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}${DEFAULT_CATALOG_PATH}`
      );

      assert.strictEqual(response.status, 200);
      assert.strictEqual(
        response.headers.get("content-type"),
        "application/json; charset=utf-8"
      );
      assert.deepEqual(await response.json(), projection.snapshot());
    }
    finally {
      server.close();
    }
  });

  test("passes other paths to the next handler", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    let nexted = false;
    const handler = createCatalogHandler({ projection });
    handler(
      { url: "/index.html", method: "GET" } as never,
      {} as never,
      () => {
        nexted = true;
      }
    );

    assert.strictEqual(nexted, true);
  });

  test("ignores the query string when matching the path", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    let payload = "";
    const response = {
      statusCode: 0,
      setHeader: () => void 0,
      end: (chunk: string) => {
        payload = chunk;
      }
    };

    createCatalogHandler({ projection })(
      { url: `${DEFAULT_CATALOG_PATH}?since=12`, method: "GET" } as never,
      response as never,
      () => void 0
    );

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(JSON.parse(payload), projection.snapshot());
  });

  test("refuses a non-GET method", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    const headers = new Map<string, string>();
    let ended = false;
    const response = {
      statusCode: 200,
      setHeader: (key: string, value: string) => headers.set(key, value),
      end: () => {
        ended = true;
      }
    };

    createCatalogHandler({ projection })(
      { url: DEFAULT_CATALOG_PATH, method: "POST" } as never,
      response as never,
      () => void 0
    );

    assert.strictEqual(response.statusCode, 405);
    assert.strictEqual(headers.get("allow"), "GET, HEAD");
    assert.strictEqual(ended, true);
  });
});
