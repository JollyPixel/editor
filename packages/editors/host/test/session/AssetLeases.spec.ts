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
import { AssetLeases } from "#src/session/AssetLeases.ts";
import { AssetModelConflictError } from "#src/errors/AssetModelConflictError.ts";
import {
  FakeClient,
  fakeModelKind,
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
  test("the first lease builds the model and joins the asset room", () => {
    const { client, leases } = setup();
    const kind = fakeModelKind("pixelart");

    const lease = leases.open(kind, "tex");

    assert.equal(kind.models.length, 1);
    assert.equal(lease.model, kind.models[0]);
    assert.equal(lease.record.id, "tex");
    assert.equal(client.fakeRoom("pixelart:tex").joins, 1);
  });

  test("leases of one asset share the model until the last release", () => {
    const { client, leases } = setup();
    const kind = fakeModelKind("pixelart");

    const first = leases.open(kind, "tex");
    const second = leases.open(kind, "tex");
    assert.equal(first.model, second.model);
    assert.equal(kind.models.length, 1);

    first.release();
    first.release();
    assert.equal(first.model.disposed, false);
    assert.equal(leases.holders("tex"), 1);

    second.release();
    assert.equal(first.model.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(leases.has("tex"), false);
  });

  test("reopening after the last release builds a fresh model", () => {
    const { leases } = setup();
    const kind = fakeModelKind("pixelart");

    leases.open(kind, "tex").release();
    const lease = leases.open(kind, "tex");

    assert.equal(kind.models.length, 2);
    assert.equal(lease.model.disposed, false);
  });

  test("a room lease leaves joining to its holder", () => {
    const { client, leases } = setup();

    const lease = leases.openRoom("voxelmap", "map");

    assert.equal(lease.record.id, "map");
    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    lease.release();
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });

  test("ready follows the model", async() => {
    const { leases } = setup();
    const kind = fakeModelKind("pixelart");
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

  test("refuses a model lease on an asset already leased room-only", () => {
    const { leases } = setup();
    leases.openRoom("pixelart", "tex");

    assert.throws(
      () => leases.open(fakeModelKind("pixelart"), "tex"),
      AssetModelConflictError
    );
  });

  test("a room lease shares the entry of a model lease", () => {
    const { client, leases } = setup();
    const kind = fakeModelKind("pixelart");
    const lease = leases.open(kind, "tex");

    const room = leases.openRoom("pixelart", "tex");
    lease.release();

    assert.equal(room.room, lease.room);
    assert.equal(lease.model.disposed, false);
    room.release();
    assert.equal(lease.model.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").joins, 1);
  });

  test("rejects unknown assets and kind mismatches", () => {
    const { leases } = setup();

    assert.throws(
      () => leases.open(fakeModelKind("pixelart"), "missing"),
      AssetNotFoundError
    );
    assert.throws(
      () => leases.open(fakeModelKind("pixelart"), "map"),
      AssetKindMismatchError
    );
    assert.throws(
      () => leases.openRoom("pixelart", "map"),
      AssetKindMismatchError
    );
  });

  test("dispose closes every open asset", () => {
    const { client, leases } = setup();
    const kind = fakeModelKind("pixelart");
    const lease = leases.open(kind, "tex");
    leases.openRoom("voxelmap", "map");

    leases.dispose();

    assert.equal(lease.model.disposed, true);
    assert.equal(client.fakeRoom("pixelart:tex").leaves, 1);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });
});
