// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { AssetLeases } from "#src/lease/AssetLeases.ts";
import { UnsettledChangesError } from "#src/lease/errors/UnsettledChangesError.ts";
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
  test("reports unsaved while any open document has pending changes", () => {
    const { leases } = setup([record("tex", "pixelart"), record("grass", "pixelart")]);
    const kind = fakeDocumentKind("pixelart");
    const reports: boolean[] = [];
    leases.on("unsaved", (unsaved) => reports.push(unsaved));
    const tex = leases.open(kind, "tex");
    const grass = leases.open(kind, "grass");

    tex.document.changes.edit();
    grass.document.changes.edit();
    tex.document.changes.acknowledge();
    assert.equal(leases.unsaved, true);
    grass.release();

    assert.equal(leases.unsaved, false);
    assert.deepEqual(reports, [true, false]);
  });

  test("settles once the server acknowledges every pending change", async() => {
    const { leases } = setup();
    const tex = leases.open(fakeDocumentKind("pixelart"), "tex");
    tex.document.changes.edit();
    let settled = false;

    const settling = leases.settled().then(() => {
      settled = true;
    });
    await Promise.resolve();
    assert.equal(settled, false);
    tex.document.changes.acknowledge();
    await settling;

    assert.equal(settled, true);
  });

  test("stops waiting for pending changes once its signal aborts", async() => {
    const { leases } = setup();
    const tex = leases.open(fakeDocumentKind("pixelart"), "tex");
    tex.document.changes.edit();
    const waiting = new AbortController();

    const settling = leases.settled(waiting.signal);
    waiting.abort();

    await assert.rejects(settling, UnsettledChangesError);
  });
});
