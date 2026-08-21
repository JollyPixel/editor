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
import { syncHarness } from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogProjection — folding", () => {
  test("folds a scripted log into the expected catalog", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

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
    projection.load();

    assert.strictEqual(projection.size, 2);
    assert.deepEqual(
      projection.snapshot().assets.map((record) => record.source),
      ["a.png", "b.png"]
    );
  });

  test("revision carries the content hash", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    projection.load();

    const [record] = projection.snapshot().assets;
    assert.strictEqual(
      record.revision,
      harness.projector.desired(created.assetId)?.hash
    );
  });

  test("an update replaces the revision, keeping the id", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    projection.load();
    const before = projection.snapshot().assets[0].revision;

    await harness.writer.update({
      assetId: created.assetId,
      data: bytes("two"),
      actor: kActor
    });
    projection.load();

    const [record] = projection.snapshot().assets;
    assert.strictEqual(record.id, created.assetId);
    assert.notStrictEqual(record.revision, before);
  });

  test("a rename updates source without changing the id", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "renamed/b.png",
      actor: kActor
    });
    projection.load();

    const [record] = projection.snapshot().assets;
    assert.strictEqual(record.id, created.assetId);
    assert.strictEqual(record.source, "renamed/b.png");
  });

  test("a delete removes the record", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });
    projection.load();

    assert.strictEqual(projection.size, 0);
    assert.deepEqual(projection.snapshot().assets, []);
  });

  test("is order-independent for disjoint assets", async() => {
    await using harness = await syncHarness();

    await harness.writer.create({
      path: "b.png",
      data: bytes("two"),
      actor: kActor
    });
    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    const forward = new CatalogProjection({
      eventStore: harness.eventStore
    });
    forward.load();

    const replayed = new CatalogProjection({
      eventStore: harness.eventStore
    });
    for (const event of [
      ...harness.eventStore.reader.listAll({ eventTypePrefix: "asset." })
    ].reverse()) {
      replayed.apply(event);
    }

    assert.deepEqual(
      forward.snapshot().assets.map((record) => record.source).sort(),
      replayed.snapshot().assets.map((record) => record.source).sort()
    );
  });

  test("ignores an event outside the reserved prefix", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    const applied = projection.apply({
      eventId: 1,
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      eventVersion: 1,
      actor: kActor,
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(applied, false);
    assert.strictEqual(projection.size, 0);
    projection.close();
  });

  test("ignores a payload that does not match its event type", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    const applied = projection.apply({
      eventId: 1,
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.created",
      eventData: { path: "a.png" },
      eventVersion: 1,
      actor: kActor,
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(applied, false);
    assert.strictEqual(projection.size, 0);
    projection.close();
  });

  test("a malformed update leaves the last good record in place", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    assert.ok(created.ok);
    projection.load();

    const applied = projection.apply({
      eventId: 99,
      assetType: "binary",
      assetId: created.val.assetId,
      eventType: "asset.updated",
      eventData: { path: "b.png", kind: "binary", hash: "h2" },
      eventVersion: 1,
      actor: kActor,
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(applied, false);
    assert.strictEqual(projection.size, 1);
    assert.deepEqual(
      projection.snapshot().assets.map((record) => record.source),
      ["a.png"]
    );
  });

  test("a delete for an unknown asset changes nothing", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const applied = projection.apply({
      eventId: 1,
      assetType: "binary",
      assetId: "ghost",
      eventType: "asset.deleted",
      eventData: { path: "gone.png", kind: "binary" },
      eventVersion: 1,
      actor: kActor,
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(applied, false);
  });
});

describe("CatalogProjection — live subscription", () => {
  test("emits one change per lifecycle event", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
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

  test("a domain event emits nothing", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();

    let changes = 0;
    projection.on("changed", () => {
      changes += 1;
    });

    harness.eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: "counter.incremented",
      eventData: {},
      actor: kActor
    }).unwrap();

    assert.strictEqual(changes, 0);
    projection.close();
  });

  test("close stops folding", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.start();
    projection.close();

    await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    assert.strictEqual(projection.size, 0);
  });

  test("the catalog resolves records by id", async() => {
    await using harness = await syncHarness();
    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    projection.load();

    assert.strictEqual(
      projection.catalog.get(new AssetId(created.assetId)).source,
      "a.png"
    );
  });
});
