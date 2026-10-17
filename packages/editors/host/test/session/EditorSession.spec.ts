// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetId,
  AssetKindMismatchError,
  AssetNotFoundError,
  type AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";
import { fakeConnection } from "../helpers/session/connection.ts";
import { fakeDocumentKind, type FakeDocumentKind } from "../helpers/rooms.ts";

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

describe("EditorSession open", () => {
  test("releases acquired models when a later factory throws", async() => {
    const kind = fakeDocumentKind("pixelart");
    const failure = new Error("factory failed");
    const audio: AssetDocumentKind<unknown> = {
      kind: "audio",
      createDocument: () => {
        throw failure;
      }
    };
    const { client, pending } = await startOpen({
      kinds: [kind, audio],
      dependencies: {
        map: [blockset("grass"), { id: "sound", kind: "audio" }]
      }
    });

    await assert.rejects(pending, failure);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("pixelart:grass").leaves, 1);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });

  test("leases the target room-only without joining it", async() => {
    const { client, session } = await open();

    assert.equal(session.target.record.id, "map");
    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    assert.equal(session.identity.username, "alice");
    session.dispose();
  });

  test("rejects a missing target and a target of another kind", async() => {
    await assert.rejects(
      open({ target: "nope" }),
      AssetNotFoundError
    );
    await assert.rejects(
      open({ target: "grass", accepts: "voxelmap" }),
      AssetKindMismatchError
    );
  });

  test("leases every modelled dependency and resolves once all are ready", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, session } = await open({
      kinds: [kind],
      dependencies: {
        map: [blockset("grass"), blockset("stone"), { id: "sound", kind: "audio" }]
      },
      resolveDocuments: kind
    });

    const leased = [...session.dependencies()].map((lease) => lease.record.id);
    assert.deepEqual(leased.sort(), ["grass", "stone"]);
    assert.equal(client.fakeRoom("pixelart:grass").joins, 1);
    assert.equal(client.rooms.has("audio:sound"), false);
    session.dispose();
  });

  test("leaves every room when a dependency fails to get ready", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, pending } = await startOpen({
      kinds: [kind],
      dependencies: { map: [blockset("grass")] }
    });
    kind.rejectAll(new Error("sync failed"));

    await assert.rejects(pending, /sync failed/);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });

  test("follows the transitive closure of the target", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { session } = await open({
      kinds: [kind],
      dependencies: {
        map: [blockset("grass")],
        grass: [blockset("stone")],
        stone: [blockset("grass")]
      },
      resolveDocuments: kind
    });

    assert.equal(session.dependency("stone")?.record.id, "stone");
    assert.equal(kind.documents.length, 2);
    session.dispose();
  });
});
