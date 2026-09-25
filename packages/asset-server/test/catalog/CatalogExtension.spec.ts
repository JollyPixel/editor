// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  protocolEvents,
  Server,
  type ClientHandle,
  type RoomPeer,
  type RoomContext
} from "@jolly-pixel/network";
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  createCatalogHandler,
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_EXPORT,
  CATALOG_IMPORT,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogCommand
} from "#src/index.ts";
import {
  archiveBackend,
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

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
      identity: {
        subject: "alice-subject",
        role: "default"
      }
    }
  };
}

function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

function peer(
  clientId: string
): RoomPeer {
  return {
    clientId,
    identity: { subject: clientId, role: "default" },
    profile: {},
    presence: {}
  };
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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);

    assert.strictEqual(room.direct.length, 1);
    assert.deepEqual(room.direct[0], {
      clientId: "A",
      payload: {
        type: CATALOG_SNAPSHOT,
        manifest: projection.snapshot(),
        dependencies: {
          [projection.snapshot().assets[0].id]: []
        }
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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);
    extension.onClientConnect(client("B"), peer("B"), room.context);

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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);

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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);

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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);
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

    const extension = new CatalogExtension({
      backend: archiveBackend(harness, projection)
    });
    const room = fakeRoom();
    extension.onClientConnect(client("A"), peer("A"), room.context);
    extension.dispose();

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.deepEqual(room.broadcasts, []);
    projection.close();
  });

  test("names its wire events for the rights table", async() => {
    await using harness = await syncHarness();
    const extension = new CatalogExtension({
      backend: archiveBackend(harness, new CatalogProjection({
        eventStore: harness.eventStore
      }))
    });

    assert.deepEqual(
      protocolEvents(extension.protocols.inbound!),
      [
        CATALOG_CREATE,
        CATALOG_RENAME,
        CATALOG_DELETE,
        CATALOG_EXPORT,
        CATALOG_PLAN,
        CATALOG_IMPORT
      ]
    );
    assert.deepEqual(
      protocolEvents(extension.protocols.outbound!),
      [CATALOG_SNAPSHOT, CATALOG_CHANGED, CATALOG_APPLIED, CATALOG_REJECTED]
    );
    extension.dispose();
  });
});

interface CommandHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly room: FakeRoom;
  send(command: CatalogCommand): Promise<void>;
  lastDirect(): { clientId: string; payload: unknown; } | undefined;
}

async function commandHarness(
  maxContentBytes?: number
): Promise<CommandHarness> {
  const sync = await syncHarness();
  const projection = new CatalogProjection({
    eventStore: sync.eventStore
  });
  projection.load();
  projection.start();

  const extension = new CatalogExtension({
    backend: archiveBackend(sync, projection),
    maxContentBytes
  });
  const room = fakeRoom();
  extension.onClientConnect(client("A"), peer("A"), room.context);

  return {
    sync,
    room,
    send: (command) => extension.onMessage("A", command, room.context),
    lastDirect: () => room.direct.at(-1),
    async [Symbol.asyncDispose]() {
      extension.dispose();
      projection.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

function lastPayloadType(
  commands: CommandHarness
): string | undefined {
  const payload = commands.lastDirect()?.payload as { type?: string; } | undefined;

  return payload?.type;
}

function recorder(
  id: string
): ClientHandle & { received: unknown[]; } {
  const received: unknown[] = [];

  return {
    id,
    received,
    send: (payload) => received.push(payload)
  };
}

describe("CatalogExtension — commands", () => {
  test("create writes the asset, broadcasts the change and acknowledges the author", async() => {
    await using commands = await commandHarness();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r1",
      path: "textures/grass.png",
      content: encodeContent(bytes("grass"))
    });
    await commands.sync.projector.flush();

    const record = commands.sync.identity.byPath("textures/grass.png");
    assert.notStrictEqual(record, undefined);
    assert.strictEqual(
      text(await commands.sync.source.read("textures/grass.png")),
      "grass"
    );
    assert.strictEqual(
      (commands.room.broadcasts[0] as { type: string; }).type,
      CATALOG_CHANGED
    );
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r1",
        command: CATALOG_CREATE,
        assetId: record!.id
      }
    });
  });

  test("stamps lifecycle events with the context identity as actor", async() => {
    await using commands = await commandHarness();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r101",
      path: "a.png",
      content: encodeContent(bytes("one"))
    });

    const [event] = commands.sync.eventStore.reader.listAll({
      eventTypePrefix: "asset."
    });
    assert.deepEqual(event.actor, {
      type: "user",
      id: "alice-subject"
    });
  });

  test("rename and delete act on the asset id", async() => {
    await using commands = await commandHarness();
    const created = (await commands.sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r102",
      assetId: created.assetId,
      to: "b.png"
    });
    assert.strictEqual(
      commands.sync.identity.byId(created.assetId)?.path,
      "b.png"
    );

    await commands.send({
      type: CATALOG_DELETE,
      requestId: "r2",
      assetId: created.assetId
    });
    assert.strictEqual(commands.sync.identity.byId(created.assetId), undefined);
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r2",
        command: CATALOG_DELETE,
        assetId: created.assetId
      }
    });
  });

  test("rejects a path used by another asset to the author only", async() => {
    await using commands = await commandHarness();
    await commands.sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    const broadcasts = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r3",
      path: "a.png",
      content: encodeContent(bytes("two"))
    });

    assert.strictEqual(commands.room.broadcasts.length, broadcasts);
    const payload = commands.lastDirect()?.payload as {
      type: string;
      requestId: string;
      command: string;
      reason: string;
    };
    assert.strictEqual(payload.type, CATALOG_REJECTED);
    assert.strictEqual(payload.requestId, "r3");
    assert.strictEqual(payload.command, CATALOG_CREATE);
    assert.match(payload.reason, /already used/);
  });

  test("creates next to a taken path when asked to suffix", async() => {
    await using commands = await commandHarness();
    await commands.sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r4",
      path: "a.png",
      onConflict: "suffix",
      content: encodeContent(bytes("two"))
    });

    const record = commands.sync.identity.byPath("a-2.png");
    assert.notStrictEqual(record, undefined);
    assert.deepEqual(commands.lastDirect()?.payload, {
      type: CATALOG_APPLIED,
      requestId: "r4",
      command: CATALOG_CREATE,
      assetId: record!.id
    });
  });

  test("rejects an unsafe path without broadcasting", async() => {
    await using commands = await commandHarness();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r103",
      path: "../escape.png",
      content: encodeContent(bytes("x"))
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
    assert.deepEqual(commands.room.broadcasts, []);
  });

  test("rejects content over the size limit without writing", async() => {
    await using commands = await commandHarness(4);

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r104",
      path: "a.png",
      content: encodeContent(bytes("12345"))
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
    assert.strictEqual(commands.sync.identity.byPath("a.png"), undefined);
  });

  test("rejects an unknown asset id", async() => {
    await using commands = await commandHarness();

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r105",
      assetId: "ghost",
      to: "b.png"
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
  });
});

describe("CatalogExtension — server", () => {
  test("a role granted create but not delete is denied the delete", async() => {
    await using sync = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: sync.eventStore
    });
    projection.load();
    projection.start();
    const created = (await sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const server = new Server({
      rights: {
        author: {
          [`${CATALOG_ROOM}.${CATALOG_DELETE}`]: "read"
        }
      }
    });
    server.register(new CatalogExtension({
      backend: archiveBackend(sync, projection)
    }));
    const author = recorder("A");
    server.handleConnect(author, { subject: "A", role: "author" });
    await server.handleMessage("A", { room: CATALOG_ROOM, kind: "join" });

    await server.handleMessage("A", {
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_DELETE,
        requestId: "r106",
        assetId: created.assetId
      }
    });
    const denied = author.received.at(-1);
    await server.handleMessage("A", {
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_CREATE,
        requestId: "r107",
        path: "b.png",
        content: encodeContent(bytes("two"))
      }
    });

    assert.deepEqual(denied, {
      room: CATALOG_ROOM,
      kind: "denied",
      event: CATALOG_DELETE,
      reason: `role "author" cannot write "${CATALOG_DELETE}"`
    });
    assert.notStrictEqual(sync.identity.byId(created.assetId), undefined);
    assert.notStrictEqual(sync.identity.byPath("b.png"), undefined);

    await server.close();
    projection.close();
  });

  test("a malformed command gets an error envelope", async() => {
    await using sync = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: sync.eventStore
    });
    projection.load();

    const server = new Server();
    server.register(new CatalogExtension({
      backend: archiveBackend(sync, projection)
    }));
    const author = recorder("A");
    server.handleConnect(author, { subject: "A", role: "default" });
    await server.handleMessage("A", { room: CATALOG_ROOM, kind: "join" });

    await server.handleMessage("A", {
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_RENAME,
        assetId: "a1"
      }
    });

    assert.strictEqual(
      (author.received.at(-1) as { kind: string; }).kind,
      "error"
    );

    await server.close();
    projection.close();
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

    await using server = await catalogServer(projection);
    const response = await fetch(`${server.origin}${CATALOG_URL_PATH}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "application/json; charset=utf-8"
    );
    assert.deepEqual(await response.json(), projection.snapshot());
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

    await using server = await catalogServer(projection);
    const response = await fetch(
      `${server.origin}${CATALOG_URL_PATH}?since=12`
    );

    assert.strictEqual(response.status, 200);
    assert.deepEqual(await response.json(), projection.snapshot());
  });

  test("answers 304 while the snapshot is unchanged", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    await using server = await catalogServer(projection);
    const first = await fetch(`${server.origin}${CATALOG_URL_PATH}`);
    await first.arrayBuffer();
    const etag = first.headers.get("etag");

    assert.ok(etag !== null);
    assert.strictEqual(first.headers.get("cache-control"), "no-cache");

    const second = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      headers: { "if-none-match": etag }
    });

    assert.strictEqual(second.status, 304);
  });

  test("refuses a non-GET method", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    await using server = await catalogServer(projection);
    const response = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      method: "POST"
    });

    assert.strictEqual(response.status, 405);
    assert.strictEqual(response.headers.get("allow"), "GET, HEAD");
  });
});

async function catalogServer(
  projection: CatalogProjection
): Promise<{ origin: string; } & AsyncDisposable> {
  const handler = createCatalogHandler({ projection });
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });
  const { port } = server.address() as { port: number; };

  return {
    origin: `http://127.0.0.1:${port}`,
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  };
}
