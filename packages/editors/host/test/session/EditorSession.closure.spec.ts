// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetId, type AssetReferenceData } from "@jolly-pixel/asset";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";
import { MAP, fakeConnection } from "../helpers/session/connection.ts";
import {
  changedMessage,
  fakeDocumentKind,
  type FakeDocumentKind
} from "../helpers/rooms.ts";

function blockset(
  id: string
): AssetReferenceData {
  return {
    id,
    kind: "pixelart"
  };
}

interface OpenOptions {
  target?: string;
  accepts?: string;
  kinds?: AssetDocumentKind<unknown>[];
  dependencies?: Record<string, AssetReferenceData[]>;
  resolveDocuments?: FakeDocumentKind;
  launch?: EditorLaunch;
}

async function startOpen(
  options: OpenOptions
) {
  const { client, connection } = await fakeConnection({
    dependencies: options.dependencies
  });
  const pending = connection.openSession({
    launch: options.launch ?? new EditorLaunch(
      new AssetId(options.target ?? "map")
    ),
    kinds: options.kinds ?? [],
    accepts: options.accepts ?? "voxelmap"
  });
  pending.catch(() => undefined);

  return {
    client,
    pending
  };
}

async function open(
  options: OpenOptions = {}
) {
  const { client, pending } = await startOpen(options);
  options.resolveDocuments?.resolveAll();

  return {
    client,
    session: await pending
  };
}

describe("EditorSession live closure", () => {
  test("exposes stable dependency views without release ownership", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await open({ kinds: [kind] });
    const added: unknown[] = [];
    session.on("dependency-added", (dependency) => added.push(dependency));
    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", MAP, [blockset("grass")])
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
      changedMessage("map", MAP, [blockset("grass")])
    );
    assert.equal(session.dependency("grass"), dependency);
    session.dispose();
  });

  for (const event of ["dependency-added", "dependency-removed"] as const) {
    test(`stops notifications when disposed during ${event}`, async() => {
      const kind = fakeDocumentKind("pixelart");
      const { client, session } = await open({
        kinds: [kind],
        dependencies: {
          map: event === "dependency-removed" ? [blockset("grass")] : []
        },
        resolveDocuments: kind
      });
      let notifications = 0;
      session.on(event, () => {
        notifications++;
        session.dispose();
      });
      const next = event === "dependency-added" ?
        [blockset("grass"), blockset("stone")] : [blockset("stone")];
      client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", MAP, next));

      assert.equal(notifications, 1);
      assert.deepEqual([...session.dependencies()], []);
      assert.equal(kind.documents.every((document) => document.disposed), true);
      assert.equal(client.fakeRoom("pixelart:stone").leaves, 1);
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
    const { client, session } = await open({
      kinds: [kind, audio],
      dependencies: { map: [blockset("grass")] },
      resolveDocuments: kind
    });
    const original = session.dependency("grass");
    const notifications: string[] = [];
    session.on("dependency-added", () => notifications.push("added"));
    session.on("dependency-removed", () => notifications.push("removed"));

    assert.throws(() => {
      client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", MAP, [
        blockset("stone"),
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
    const { client, session } = await open({
      kinds: [kind],
      dependencies: { map: [blockset("grass")] },
      resolveDocuments: kind
    });
    const added: string[] = [];
    const removed: AssetReferenceData[] = [];
    session.on("dependency-added", (lease) => added.push(lease.record.id));
    session.on("dependency-removed", (reference) => removed.push(reference));

    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", MAP, [blockset("stone")])
    );

    assert.deepEqual(added, ["stone"]);
    assert.deepEqual(removed, [blockset("grass")]);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("pixelart:grass").leaves, 1);
    session.dispose();
  });

  test("a panel lease keeps a removed dependency alive", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await open({
      kinds: [kind],
      dependencies: { map: [blockset("grass")] },
      resolveDocuments: kind
    });
    const panel = session.assets.open(kind, "grass");

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", MAP, []));

    assert.equal(session.dependency("grass"), undefined);
    assert.equal(panel.document.disposed, false);
    panel.release();
    assert.equal(panel.document.disposed, true);
    session.dispose();
  });

  test("drops a dependency whose record is deleted", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await open({
      kinds: [kind],
      dependencies: { map: [blockset("grass")] },
      resolveDocuments: kind
    });
    const removed: string[] = [];
    session.on("dependency-removed", (reference) => removed.push(reference.id));

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("grass", null));

    assert.deepEqual(removed, ["grass"]);
    session.dispose();
  });

  test("dispose releases every lease and stops following the catalog", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await open({
      kinds: [kind],
      dependencies: { map: [blockset("grass")] },
      resolveDocuments: kind
    });

    session.dispose();
    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", MAP, [blockset("stone")])
    );

    assert.equal(kind.documents.length, 1);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });
});

describe("EditorSession tag view", () => {
  test("a launch naming a tag leases the target through the tag room", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, session } = await open({
      kinds: [kind],
      resolveDocuments: kind,
      launch: new EditorLaunch(new AssetId("map")).viewing("v1")
    });

    assert.equal(kind.documents[0].room, client.fakeRoom("voxelmap@v1:map"));
    session.dispose();
  });
});
