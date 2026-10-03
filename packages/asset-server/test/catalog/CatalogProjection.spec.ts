// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  CatalogProjection,
  type CatalogChange
} from "#src/index.ts";
import {
  countingReads,
  syncHarness
} from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogProjection — load mirrors the projector", () => {
  test("reads no event from the log", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    });

    const counter = countingReads(harness.eventStore);
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    assert.strictEqual(counter.read, 0);
    assert.strictEqual(projection.size, 1);
  });

  test("carries the path and revision of a renamed asset", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    const updated = (await harness.writer.update({
      assetId: created.assetId,
      data: bytes("two"),
      actor: kActor
    })).unwrap();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "b.png",
      actor: kActor
    });

    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    const record = projection.catalog.get(new AssetId(created.assetId));
    assert.strictEqual(record.source, "b.png");
    assert.strictEqual(
      record.revision,
      (updated.eventData as { hash: string; }).hash
    );
  });

  test("leaves out a deleted asset", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });

    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    assert.strictEqual(projection.size, 0);
  });

  test("lists assets in creation order", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    await harness.writer.create({
      path: "b.png",
      data: bytes("two"),
      actor: kActor
    });

    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    assert.deepEqual(
      projection.snapshot().assets.map((record) => record.source),
      ["a.png", "b.png"]
    );
  });

  test("revision carries the content hash", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();

    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();

    const [record] = projection.snapshot().assets;
    assert.strictEqual(
      record.revision,
      harness.projector.desired(created.assetId)?.hash
    );
  });
});

describe("CatalogProjection — live changes", () => {
  test("emits one change per lifecycle event", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.load();
    projection.start();

    const changes: CatalogChange[] = [];
    projection.on("changed", (change) => changes.push(change));

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });

    assert.deepEqual(
      changes.map((change) => change.eventType),
      ["asset.created", "asset.deleted"]
    );
    assert.strictEqual(changes[0].record?.source, "a.png");
    assert.strictEqual(changes[1].record, null);
    projection.close();
  });

  test("ignores events the projector skips", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.start();

    const changes: CatalogChange[] = [];
    projection.on("changed", (change) => changes.push(change));
    harness.eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: kActor
    });
    harness.eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.created",
      eventData: { path: "a.png" },
      actor: kActor
    });

    assert.deepEqual(changes, []);
    assert.strictEqual(projection.size, 0);
    projection.close();
  });

  test("a delete for an unknown asset emits nothing", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.start();

    const changes: CatalogChange[] = [];
    projection.on("changed", (change) => changes.push(change));
    harness.eventStore.writer.append({
      assetType: "binary",
      assetId: "ghost",
      eventType: "asset.deleted",
      eventData: {
        path: "gone.png",
        kind: "binary"
      },
      actor: kActor
    });

    assert.deepEqual(changes, []);
    projection.close();
  });

  test("close stops following the projector", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({ projector: harness.projector });
    projection.start();
    projection.close();

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.strictEqual(projection.size, 0);
  });
});
