// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_FOLDERS,
  CATALOG_IMPORT,
  CATALOG_MOVE_FOLDER,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT
} from "#src/index.ts";
import { createCatalogHandler } from "#src/node.ts";
import {
  catalogBackend,
  syncHarness
} from "../helpers/backend.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import {
  catalogCommands,
  serveCatalog,
  type CatalogCommands
} from "../helpers/catalog.ts";
import {
  recordingClient,
  recordingRoom,
  roomPeer
} from "../helpers/rooms.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogExtension — join", () => {
  test("sends the snapshot to the joining client", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);

    assert.strictEqual(room.direct.length, 1);
    assert.deepEqual(room.direct[0], {
      clientId: "A",
      payload: {
        type: CATALOG_SNAPSHOT,
        manifest: projection.snapshot(),
        dependencies: {
          [projection.snapshot().assets[0].id]: []
        },
        folders: []
      }
    });
    extension.dispose();
  });

  test("every joiner gets its own snapshot", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
    extension.onClientConnect(recordingClient("B"), roomPeer("B"), room.context);

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
      projector: harness.projector
    });
    projection.load();
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);

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

  test("stops broadcasting once the last client left", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
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
      projector: harness.projector
    });
    projection.start();

    const extension = new CatalogExtension({
      backend: catalogBackend(harness, projection)
    });
    const room = recordingRoom();
    extension.onClientConnect(recordingClient("A"), roomPeer("A"), room.context);
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
      backend: catalogBackend(harness, new CatalogProjection({
        projector: harness.projector
      }))
    });

    assert.deepEqual(
      extension.protocols.inbound!.events,
      [
        CATALOG_CREATE,
        CATALOG_RENAME,
        CATALOG_DELETE,
        CATALOG_CREATE_FOLDER,
        CATALOG_MOVE_FOLDER,
        CATALOG_DELETE_FOLDER,
        CATALOG_EXPORT,
        CATALOG_PLAN,
        CATALOG_IMPORT
      ]
    );
    assert.deepEqual(
      extension.protocols.outbound!.events,
      [
        CATALOG_SNAPSHOT,
        CATALOG_CHANGED,
        CATALOG_FOLDERS,
        CATALOG_APPLIED,
        CATALOG_REJECTED
      ]
    );
    extension.dispose();
  });
});

function lastPayloadType(
  commands: CatalogCommands
): string | undefined {
  const payload = commands.lastDirect()?.payload as { type?: string; } | undefined;

  return payload?.type;
}

async function createAll(
  commands: CatalogCommands,
  paths: string[]
): Promise<string[]> {
  const assetIds: string[] = [];
  for (const path of paths) {
    const created = (await commands.sync.writer.create({
      path,
      data: bytes(path),
      actor: kActor
    })).unwrap();
    assetIds.push(created.assetId);
  }

  return assetIds;
}

function broadcastsSince(
  commands: CatalogCommands,
  start: number
): { type: string; changes?: unknown[]; }[] {
  return commands.room.broadcasts.slice(start) as { type: string; changes?: unknown[]; }[];
}

describe("CatalogExtension — command lists", () => {
  test("a rename list broadcasts its folders and changes once, then the count", async() => {
    await using commands = await catalogCommands();
    const assetIds = await createAll(commands, ["a.png", "b.png", "c.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r110",
      renames: assetIds.map((assetId, index) => {
        return {
          assetId,
          to: `moved/sub-${index}/${index}.png`
        };
      })
    });

    const sent = broadcastsSince(commands, start);
    assert.deepEqual(sent.map(({ type }) => type), [CATALOG_FOLDERS, CATALOG_CHANGED]);
    assert.strictEqual(sent[1].changes?.length, 3);
    assert.strictEqual(commands.sync.identity.byId(assetIds[2])?.path, "moved/sub-2/2.png");
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r110",
        command: CATALOG_RENAME,
        applied: 3
      }
    });
  });

  test("a rename list stops at the first refused rename and names it", async() => {
    await using commands = await catalogCommands();
    const [a, b, c] = await createAll(commands, ["a.png", "b.png", "c.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r111",
      renames: [
        { assetId: a, to: "x.png" },
        { assetId: b, to: "c.png" },
        { assetId: c, to: "y.png" }
      ]
    });

    const reply = commands.lastDirect()?.payload as { applied?: number; failure?: string; };
    assert.strictEqual(reply.applied, 1);
    assert.strictEqual(typeof reply.failure, "string");
    assert.strictEqual(commands.sync.identity.byId(c)?.path, "c.png");
    const sent = broadcastsSince(commands, start);
    assert.deepEqual(sent.map(({ type }) => type), [CATALOG_CHANGED]);
    assert.strictEqual(sent[0].changes?.length, 1);
  });

  test("a list refused on its first entry applies nothing and broadcasts nothing", async() => {
    await using commands = await catalogCommands();
    const [a] = await createAll(commands, ["a.png", "b.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r112",
      renames: [{ assetId: a, to: "b.png" }]
    });

    const reply = commands.lastDirect()?.payload as { applied?: number; failure?: string; };
    assert.strictEqual(lastPayloadType(commands), CATALOG_APPLIED);
    assert.strictEqual(reply.applied, 0);
    assert.strictEqual(typeof reply.failure, "string");
    assert.deepEqual(broadcastsSince(commands, start), []);
  });

  test("a delete list removes every asset", async() => {
    await using commands = await catalogCommands();
    const assetIds = await createAll(commands, ["a.png", "b.png"]);

    await commands.send({
      type: CATALOG_DELETE,
      requestId: "r113",
      assetIds
    });

    assert.deepEqual(
      assetIds.map((assetId) => commands.sync.identity.byId(assetId)),
      [undefined, undefined]
    );
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r113",
        command: CATALOG_DELETE,
        applied: 2
      }
    });
  });
});

describe("CatalogExtension — commands", () => {
  test("create writes the asset, broadcasts the change and acknowledges the author", async() => {
    await using commands = await catalogCommands();

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
    assert.deepEqual(commands.room.broadcasts[0], {
      type: CATALOG_FOLDERS,
      folders: ["textures"]
    });
    assert.strictEqual(
      (commands.room.broadcasts[1] as { type: string; }).type,
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
    await using commands = await catalogCommands();

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

  test("rejects a path used by another asset to the author only", async() => {
    await using commands = await catalogCommands();
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
    await using commands = await catalogCommands();
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
    await using commands = await catalogCommands();

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
    await using commands = await catalogCommands(4);

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r104",
      path: "a.png",
      content: encodeContent(bytes("12345"))
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
    assert.strictEqual(commands.sync.identity.byPath("a.png"), undefined);
  });
});

describe("CatalogExtension — server", () => {
  test("a role granted create but not delete is denied the delete", async() => {
    await using sync = await syncHarness();
    const projection = new CatalogProjection({
      projector: sync.projector
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
          [`${CATALOG_ROOM}.${CATALOG_DELETE}`]: "read",
          "*": "write"
        }
      }
    });
    server.register(new CatalogExtension({
      backend: catalogBackend(sync, projection)
    }));
    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: "A", role: "author" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    await connectionA.receive({
      room: CATALOG_ROOM,
      kind: "message",
      payload: {
        type: CATALOG_DELETE,
        requestId: "r106",
        assetIds: [created.assetId]
      }
    });
    const denied = author.received.at(-1);
    await connectionA.receive({
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
      projector: sync.projector
    });
    projection.load();

    const server = new Server();
    server.register(new CatalogExtension({
      backend: catalogBackend(sync, projection)
    }));
    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: "A", role: "default" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    await connectionA.receive({
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
      projector: harness.projector
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    projection.load();

    await using server = await serveCatalog(projection);
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
      projector: harness.projector
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
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const response = await fetch(
      `${server.origin}${CATALOG_URL_PATH}?since=12`
    );

    assert.strictEqual(response.status, 200);
    assert.deepEqual(await response.json(), projection.snapshot());
  });

  test("answers 304 while the snapshot is unchanged", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
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
      projector: harness.projector
    });
    projection.load();

    await using server = await serveCatalog(projection);
    const response = await fetch(`${server.origin}${CATALOG_URL_PATH}`, {
      method: "POST"
    });

    assert.strictEqual(response.status, 405);
    assert.strictEqual(response.headers.get("allow"), "GET, HEAD");
  });
});
