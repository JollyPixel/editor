// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetKindMismatchError,
  AssetNotFoundError,
  type AssetRecordData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { AssetLeases } from "#src/lease/AssetLeases.ts";
import { AssetDocumentConflictError } from "#src/lease/errors/AssetDocumentConflictError.ts";
import {
  FakeClient,
  fakeDocumentKind,
  record
} from "../helpers/rooms.ts";

function setup(
  records: AssetRecordData[] = [record("tex", "pixelart"), record("map", "voxelmap")]
) {
  const client = new FakeClient();
  const byId = new Map(records.map((entry) => [entry.id, entry]));
  const leases = new AssetLeases({
    rooms: client,
    records: {
      record: (assetId) => byId.get(assetId)
    }
  });

  return {
    client,
    leases
  };
}

describe("AssetLeases", () => {
  test("disposes a new document when joining its room throws", (context) => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");
    client.room("pixelart:tex");
    const room = client.fakeRoom("pixelart:tex");
    context.mock.method(room, "join", () => {
      throw new Error("join failed");
    });

    assert.throws(() => leases.open(kind, "tex"), /join failed/);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(room.leaves, 1);
    assert.equal(leases.has("tex"), false);
  });

  test("leaves the room when a document factory throws", () => {
    const { client, leases } = setup();
    const failure = new Error("factory failed");

    assert.throws(() => leases.open({
      kind: "pixelart",
      createDocument: () => {
        throw failure;
      }
    }, "tex"), failure);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(leases.has("tex"), false);
  });

  test("refuses acquisitions after disposal and ignores late releases", () => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");
    const lease = leases.open(kind, "tex");
    leases.dispose();
    lease.release();
    leases.dispose();

    assert.throws(() => leases.open(kind, "tex"), /disposed/);
    assert.throws(() => leases.openRoom("voxelmap", "map"), /disposed/);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(client.rooms.has("voxelmap:map"), false);
  });

  test("the first lease builds the document and joins the asset room", () => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");

    const lease = leases.open(kind, "tex");

    assert.equal(kind.documents.length, 1);
    assert.equal(lease.document, kind.documents[0]);
    assert.equal(lease.record.id, "tex");
    assert.equal(client.fakeRoom("pixelart:tex").joins, 1);
  });

  test("leases of one asset share the document until the last release", () => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");

    const first = leases.open(kind, "tex");
    const second = leases.open(kind, "tex");
    assert.equal(first.document, second.document);
    assert.equal(kind.documents.length, 1);

    first.release();
    first.release();
    assert.equal(first.document.disposed, false);
    assert.equal(leases.holders("tex"), 1);

    second.release();
    assert.equal(first.document.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(leases.has("tex"), false);
  });

  test("reopening after the last release builds a fresh document", () => {
    const { leases } = setup();
    const kind = fakeDocumentKind("pixelart");

    leases.open(kind, "tex").release();
    const lease = leases.open(kind, "tex");

    assert.equal(kind.documents.length, 2);
    assert.equal(lease.document.disposed, false);
  });

  test("a room lease leaves joining to its holder", () => {
    const { client, leases } = setup();

    const lease = leases.openRoom("voxelmap", "map");

    assert.equal(lease.record.id, "map");
    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    lease.release();
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });

  test("ready follows the document", async() => {
    const { leases } = setup();
    const kind = fakeDocumentKind("pixelart");
    const lease = leases.open(kind, "tex");
    let ready = false;
    void lease.ready.then(() => {
      ready = true;
    });

    await Promise.resolve();
    assert.equal(ready, false);
    kind.resolveAll();
    await lease.ready;
    assert.equal(ready, true);
  });

  test("refuses a document lease on an asset already leased room-only", () => {
    const { leases } = setup();
    leases.openRoom("pixelart", "tex");

    assert.throws(
      () => leases.open(fakeDocumentKind("pixelart"), "tex"),
      AssetDocumentConflictError
    );
  });

  test("refuses a document lease from another kind object", () => {
    const { leases } = setup();
    leases.open(fakeDocumentKind("pixelart"), "tex");

    assert.throws(
      () => leases.open(fakeDocumentKind("pixelart"), "tex"),
      AssetDocumentConflictError
    );
    assert.equal(leases.holders("tex"), 1);
  });

  test("a room lease shares the entry of a document lease", () => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");
    const lease = leases.open(kind, "tex");

    const room = leases.openRoom("pixelart", "tex");
    lease.release();

    assert.equal(room.room, lease.room);
    assert.equal(lease.document.disposed, false);
    room.release();
    assert.equal(lease.document.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").joins, 1);
  });

  test("rejects unknown assets and kind mismatches", () => {
    const { leases } = setup();

    assert.throws(
      () => leases.open(fakeDocumentKind("pixelart"), "missing"),
      AssetNotFoundError
    );
    assert.throws(
      () => leases.open(fakeDocumentKind("pixelart"), "map"),
      AssetKindMismatchError
    );
    assert.throws(
      () => leases.openRoom("pixelart", "map"),
      AssetKindMismatchError
    );

    leases.openRoom("voxelmap", "map");
    assert.throws(
      () => leases.openRoom("pixelart", "map"),
      AssetKindMismatchError
    );
  });

  test("dispose closes every open asset", () => {
    const { client, leases } = setup();
    const kind = fakeDocumentKind("pixelart");
    const lease = leases.open(kind, "tex");
    leases.openRoom("voxelmap", "map");

    leases.dispose();

    assert.equal(lease.document.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });
});
