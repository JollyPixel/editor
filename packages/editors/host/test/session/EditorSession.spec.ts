// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetId,
  AssetKindMismatchError,
  AssetNotFoundError,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import {
  CATALOG_APPLIED,
  CATALOG_EXPORT,
  CATALOG_ROOM,
  CatalogUnavailableError,
  type CatalogExportCommand
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { EditorSession } from "#src/session/EditorSession.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";
import {
  FakeClient,
  changedMessage,
  fakeDocumentKind,
  record,
  snapshotMessage,
  type FakeDocumentKind
} from "../helpers/rooms.ts";

// CONSTANTS
const kIdentity = {
  username: "alice",
  peerId: "peer-alice",
  color: "#ff0000"
};
const kMap = record("map", "voxelmap");
const kGrass = record("grass", "pixelart");
const kStone = record("stone", "pixelart");
const kSound = record("sound", "audio");

function tileset(
  id: string
): AssetReferenceData {
  return {
    id,
    kind: "pixelart"
  };
}

interface ConnectOptions {
  target?: string;
  accepts?: string;
  kinds?: AssetDocumentKind<unknown>[];
  dependencies?: Record<string, AssetReferenceData[]>;
  resolveDocuments?: FakeDocumentKind;
}

async function startConnect(
  options: ConnectOptions
) {
  const client = new FakeClient();
  const pending = EditorSession.connect({
    launch: new EditorLaunch(new AssetId(options.target ?? "map")),
    identity: kIdentity,
    client,
    kinds: options.kinds ?? [],
    accepts: options.accepts ?? "voxelmap"
  });
  pending.catch(() => undefined);

  client.fakeRoom(CATALOG_ROOM).receive(snapshotMessage(
    [kMap, kGrass, kStone, kSound],
    options.dependencies ?? {}
  ));
  await new Promise((resolve) => {
    setImmediate(resolve);
  });

  return {
    client,
    pending
  };
}

async function connect(
  options: ConnectOptions = {}
) {
  const { client, pending } = await startConnect(options);
  options.resolveDocuments?.resolveAll();

  return {
    client,
    session: await pending
  };
}

describe("EditorSession.connect", () => {
  test("closes a client when the catalog never becomes ready", async() => {
    const client = new FakeClient();
    await assert.rejects(
      EditorSession.connect({
        launch: new EditorLaunch(new AssetId("map")),
        identity: kIdentity,
        client,
        kinds: [],
        accepts: "voxelmap",
        catalogTimeoutMs: 1
      }),
      CatalogUnavailableError
    );
    assert.strictEqual(client.destroyed, true);
  });

  test("releases acquired models when a later factory throws", async() => {
    const kind = fakeDocumentKind("pixelart");
    const failure = new Error("factory failed");
    const audio: AssetDocumentKind<unknown> = {
      kind: "audio",
      createDocument: () => {
        throw failure;
      }
    };
    const { client, pending } = await startConnect({
      kinds: [kind, audio],
      dependencies: {
        map: [tileset("grass"), { id: "sound", kind: "audio" }]
      }
    });

    await assert.rejects(pending, failure);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("pixelart:grass").leaves, 1);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });

  test("leases the target room-only without joining it", async() => {
    const { client, session } = await connect();

    assert.equal(session.target.record.id, "map");
    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    assert.equal(session.identity, kIdentity);
    session.dispose();
  });

  test("rejects a missing target and a target of another kind", async() => {
    await assert.rejects(
      connect({ target: "nope" }),
      AssetNotFoundError
    );
    await assert.rejects(
      connect({ target: "grass", accepts: "voxelmap" }),
      AssetKindMismatchError
    );
  });

  test("leases every modelled dependency and resolves once all are ready", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: {
        map: [tileset("grass"), tileset("stone"), { id: "sound", kind: "audio" }]
      },
      resolveDocuments: kind
    });

    const leased = [...session.dependencies()].map((lease) => lease.record.id);
    assert.deepEqual(leased.sort(), ["grass", "stone"]);
    assert.equal(client.fakeRoom("pixelart:grass").joins, 1);
    assert.equal(client.rooms.has("audio:sound"), false);
    session.dispose();
  });

  test("destroys the client when the target cannot be resolved", async() => {
    const { client, pending } = await startConnect({ target: "nope" });

    await assert.rejects(pending, AssetNotFoundError);
    assert.equal(client.destroyed, true);
  });

  test("disposes everything when a dependency fails to get ready", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, pending } = await startConnect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] }
    });
    kind.rejectAll(new Error("sync failed"));

    await assert.rejects(pending, /sync failed/);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });

  test("follows the transitive closure of the target", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { session } = await connect({
      kinds: [kind],
      dependencies: {
        map: [tileset("grass")],
        grass: [tileset("stone")],
        stone: [tileset("grass")]
      },
      resolveDocuments: kind
    });

    assert.equal(session.dependency("stone")?.record.id, "stone");
    assert.equal(kind.documents.length, 2);
    session.dispose();
  });
});

describe("EditorSession live closure", () => {
  test("exposes stable dependency views without release ownership", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({ kinds: [kind] });
    const added: unknown[] = [];
    session.on("dependency-added", (dependency) => added.push(dependency));
    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", kMap, [tileset("grass")])
    );
    const dependency = session.dependency("grass");
    assert.ok(dependency);
    assert.equal("release" in dependency, false);
    assert.equal(Object.isFrozen(dependency), true);
    assert.equal(added[0], dependency);
    assert.equal([...session.dependencies()][0], dependency);
    assert.equal(dependency.document, kind.documents[0]);
    kind.resolveAll();
    await dependency.ready;

    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", kMap, [tileset("grass")])
    );
    assert.equal(session.dependency("grass"), dependency);
    session.dispose();
  });

  for (const event of ["dependency-added", "dependency-removed"] as const) {
    test(`stops notifications when disposed during ${event}`, async() => {
      const kind = fakeDocumentKind("pixelart");
      const { client, session } = await connect({
        kinds: [kind],
        dependencies: {
          map: event === "dependency-removed" ? [tileset("grass")] : []
        },
        resolveDocuments: kind
      });
      let notifications = 0;
      session.on(event, () => {
        notifications++;
        session.dispose();
      });
      const next = event === "dependency-added" ?
        [tileset("grass"), tileset("stone")] : [tileset("stone")];
      client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", kMap, next));

      assert.equal(notifications, 1);
      assert.deepEqual([...session.dependencies()], []);
      assert.equal(kind.documents.every((document) => document.disposed), true);
      assert.equal(client.fakeRoom("pixelart:stone").leaves, 1);
      assert.equal(client.destroyed, true);
      assert.throws(() => session.assets.open(kind, "stone"), /disposed/);
      session.dispose();
    });
  }

  test("rolls back additions before removing existing dependencies", async() => {
    const kind = fakeDocumentKind("pixelart");
    const audio: AssetDocumentKind<unknown> = {
      kind: "audio",
      createDocument: () => {
        throw new Error("factory failed");
      }
    };
    const { client, session } = await connect({
      kinds: [kind, audio],
      dependencies: { map: [tileset("grass")] },
      resolveDocuments: kind
    });
    const original = session.dependency("grass");
    const notifications: string[] = [];
    session.on("dependency-added", () => notifications.push("added"));
    session.on("dependency-removed", () => notifications.push("removed"));

    assert.throws(() => {
      client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", kMap, [
        tileset("stone"),
        { id: "sound", kind: "audio" }
      ]));
    }, /factory failed/);
    assert.equal(session.dependency("grass"), original);
    assert.equal(kind.documents[0].disposed, false);
    assert.equal(kind.documents[1].disposed, true);
    assert.equal(session.assets.has("stone"), false);
    assert.deepEqual(notifications, []);
    session.dispose();
  });

  test("leases added edges and releases removed ones", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveDocuments: kind
    });
    const added: string[] = [];
    const removed: AssetReferenceData[] = [];
    session.on("dependency-added", (lease) => added.push(lease.record.id));
    session.on("dependency-removed", (reference) => removed.push(reference));

    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", kMap, [tileset("stone")])
    );

    assert.deepEqual(added, ["stone"]);
    assert.deepEqual(removed, [tileset("grass")]);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("pixelart:grass").leaves, 1);
    session.dispose();
  });

  test("a panel lease keeps a removed dependency alive", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveDocuments: kind
    });
    const panel = session.assets.open(kind, "grass");

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", kMap, []));

    assert.equal(session.dependency("grass"), undefined);
    assert.equal(panel.document.disposed, false);
    panel.release();
    assert.equal(panel.document.disposed, true);
    session.dispose();
  });

  test("drops a dependency whose record is deleted", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveDocuments: kind
    });
    const removed: string[] = [];
    session.on("dependency-removed", (reference) => removed.push(reference.id));

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("grass", null));

    assert.deepEqual(removed, ["grass"]);
    session.dispose();
  });

  test("dispose releases everything and destroys the client", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveDocuments: kind
    });

    session.dispose();
    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", kMap, [tileset("stone")])
    );

    assert.equal(kind.documents.length, 1);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });
});

describe("EditorSession target document", () => {
  test("keeps the target room-only when no kind is registered", async() => {
    const { client, session } = await connect();

    await session.targetReady;

    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    assert.equal("document" in session.target, false);
    session.dispose();
  });

  test("leases the target as a document and joins its room once", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, session } = await connect({
      kinds: [kind],
      resolveDocuments: kind
    });

    await session.targetReady;

    assert.equal(kind.documents.length, 1);
    assert.equal(client.fakeRoom("voxelmap:map").joins, 1);
    assert.equal(kind.documents[0].room, client.fakeRoom("voxelmap:map"));
    session.dispose();
  });

  test("rejects and disposes when the target never becomes ready", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const failure = new Error("target failed");
    const { client, pending } = await startConnect({ kinds: [kind] });

    kind.rejectAll(failure);

    await assert.rejects(pending, failure);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });

  test("targetLease shares the document the session already holds", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, session } = await connect({
      kinds: [kind],
      resolveDocuments: kind
    });

    const lease = session.targetLease(kind);

    assert.equal(lease.document, kind.documents[0]);
    assert.equal(kind.documents.length, 1);

    lease.release();

    assert.equal(lease.document.disposed, false);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 0);

    session.dispose();

    assert.equal(lease.document.disposed, true);
  });
});

describe("EditorSession archives", () => {
  test("downloads the target under its current catalog path", async() => {
    const { client, session } = await connect();
    const saved: string[] = [];
    const archives = session.archives({
      fallbackName: "map",
      resetWarning: "",
      browser: {
        location: {
          href: "http://localhost/",
          assign: () => undefined,
          reload: () => undefined
        },
        save: (_blob, fileName) => {
          saved.push(fileName);
        },
        askConflictPolicy: () => Promise.resolve(null),
        confirmReset: () => Promise.resolve(false)
      }
    });
    const catalog = client.fakeRoom(CATALOG_ROOM);
    catalog.receive(changedMessage("map", {
      ...kMap,
      source: "maps/overworld.voxelmap.json"
    }));

    const downloading = archives.download();
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
    const command = catalog.sent.find(isExportCommand);
    assert.ok(command);
    catalog.receive({
      type: CATALOG_APPLIED,
      requestId: command.requestId,
      command: CATALOG_EXPORT,
      content: {
        type: "inline",
        encoding: "base64",
        data: ""
      }
    });
    await downloading;

    assert.equal(command.root, "map");
    assert.deepEqual(saved, ["overworld.zip"]);
    session.dispose();
  });
});

function isExportCommand(
  message: unknown
): message is CatalogExportCommand & { requestId: string; } {
  return typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === CATALOG_EXPORT;
}
