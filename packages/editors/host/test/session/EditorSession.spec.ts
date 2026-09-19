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
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import { EditorSession } from "#src/session/EditorSession.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetModelKind } from "#src/session/AssetLease.ts";
import {
  FakeClient,
  changedMessage,
  fakeModelKind,
  record,
  snapshotMessage,
  type FakeModelKind
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
  kinds?: AssetModelKind<unknown>[];
  dependencies?: Record<string, AssetReferenceData[]>;
  resolveModels?: FakeModelKind;
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
    accepts: options.accepts
  });

  client.fakeRoom(CATALOG_ROOM).receive(snapshotMessage(
    [kMap, kGrass, kStone, kSound],
    options.dependencies ?? {}
  ));
  await Promise.resolve();

  return {
    client,
    pending
  };
}

async function connect(
  options: ConnectOptions = {}
) {
  const { client, pending } = await startConnect(options);
  options.resolveModels?.resolveAll();

  return {
    client,
    session: await pending
  };
}

describe("EditorSession.connect", () => {
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
    const kind = fakeModelKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: {
        map: [tileset("grass"), tileset("stone"), { id: "sound", kind: "audio" }]
      },
      resolveModels: kind
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
    const kind = fakeModelKind("pixelart");
    const { client, pending } = await startConnect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] }
    });
    kind.rejectAll(new Error("sync failed"));

    await assert.rejects(pending, /sync failed/);
    assert.equal(kind.models[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });

  test("follows the transitive closure of the target", async() => {
    const kind = fakeModelKind("pixelart");
    const { session } = await connect({
      kinds: [kind],
      dependencies: {
        map: [tileset("grass")],
        grass: [tileset("stone")],
        stone: [tileset("grass")]
      },
      resolveModels: kind
    });

    assert.equal(session.dependency("stone")?.record.id, "stone");
    assert.equal(kind.models.length, 2);
    session.dispose();
  });
});

describe("EditorSession live closure", () => {
  test("leases added edges and releases removed ones", async() => {
    const kind = fakeModelKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveModels: kind
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
    assert.equal(kind.models[0].disposed, true);
    assert.equal(client.fakeRoom("pixelart:grass").leaves, 1);
    session.dispose();
  });

  test("a panel lease keeps a removed dependency alive", async() => {
    const kind = fakeModelKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveModels: kind
    });
    const panel = session.assets.open(kind, "grass");

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("map", kMap, []));

    assert.equal(session.dependency("grass"), undefined);
    assert.equal(panel.model.disposed, false);
    panel.release();
    assert.equal(panel.model.disposed, true);
    session.dispose();
  });

  test("drops a dependency whose record is deleted", async() => {
    const kind = fakeModelKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveModels: kind
    });
    const removed: string[] = [];
    session.on("dependency-removed", (reference) => removed.push(reference.id));

    client.fakeRoom(CATALOG_ROOM).receive(changedMessage("grass", null));

    assert.deepEqual(removed, ["grass"]);
    session.dispose();
  });

  test("dispose releases everything and destroys the client", async() => {
    const kind = fakeModelKind("pixelart");
    const { client, session } = await connect({
      kinds: [kind],
      dependencies: { map: [tileset("grass")] },
      resolveModels: kind
    });

    session.dispose();
    client.fakeRoom(CATALOG_ROOM).receive(
      changedMessage("map", kMap, [tileset("stone")])
    );

    assert.equal(kind.models.length, 1);
    assert.equal(kind.models[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });
});
