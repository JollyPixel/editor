// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  CATALOG_MOVE_FOLDER,
  CATALOG_UNTAG
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  RECORDED_ASSET,
  recorderHarness,
  writeData
} from "../../helpers/auditRecorder.ts";

describe("AuditRecorder structure and retention", () => {
  test("records lifecycle events and catalog activity as structure rows", async(t) => {
    await using harness = await recorderHarness(t);
    const actor: EventStore.Actor = {
      type: "user",
      id: "alice"
    };
    await harness.lifecycle(ASSET_CREATED, writeData());
    await harness.lifecycle(ASSET_RENAMED, {
      from: "map.bin",
      to: "maps/map.bin",
      kind: "binary",
      hash: "h"
    });
    await harness.lifecycle(ASSET_UPDATED, writeData({
      restoredFrom: {
        name: "v1",
        eventVersion: 1
      }
    }));
    harness.activity.emit("applied", {
      applied: {
        command: CATALOG_MOVE_FOLDER,
        from: "maps",
        path: "levels"
      },
      actor
    });
    harness.activity.emit("applied", {
      applied: {
        command: CATALOG_UNTAG,
        assetId: RECORDED_ASSET,
        name: "v1"
      },
      actor
    });
    await harness.lifecycle(ASSET_DELETED, {
      path: "levels/map.bin",
      kind: "binary"
    });

    const rows = harness.rows("structure").toReversed();

    assert.deepEqual(rows.map((entry) => (
      "action" in entry ? `${entry.type} ${entry.action}` : entry.type
    )), [
      "asset created",
      "asset renamed",
      "asset restored",
      "folder moved",
      "tag deleted",
      "asset deleted"
    ]);
    assert.deepEqual(rows[2], {
      type: "asset",
      at: 0,
      actor,
      assetId: RECORDED_ASSET,
      action: "restored",
      path: "map.bin",
      tag: "v1"
    });
    assert.deepEqual(rows[3], {
      type: "folder",
      at: 0,
      actor,
      action: "moved",
      path: "levels",
      previousPath: "maps"
    });
  });

  test("prunes kept versions and rows past their age, releasing only history points", async(t) => {
    await using harness = await recorderHarness(t);
    const created = await harness.lifecycle(ASSET_CREATED, writeData());
    await harness.edit("alice");
    await harness.snapshot();
    (await harness.events.tags.create({
      assetId: RECORDED_ASSET,
      name: "v1",
      eventVersion: created,
      actor: {
        type: "user",
        id: "alice"
      }
    })).unwrap();
    await harness.at(40 * 24 * 60);

    await harness.retain({
      keepRowsDays: null,
      keepVersionsDays: 30
    });

    assert.deepEqual(harness.versions(), [{ from: null, to: null }]);
    assert.deepEqual(await harness.tagNames(), ["v1"]);

    await harness.retain({
      keepRowsDays: 30,
      keepVersionsDays: null
    });

    assert.deepEqual(harness.rows(), []);
  });
});
