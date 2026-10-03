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
import { assetEvent } from "../helpers/events.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("CatalogProjection — load reads the tail of the log", () => {
  test("reads only each asset's newest checkpoint", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    for (let index = 1; index <= 20; index++) {
      await harness.writer.update({
        assetId: created.assetId,
        data: bytes(String(index)),
        actor: kActor
      });
    }

    const counter = countingReads(harness.eventStore);
    const projection = new CatalogProjection({ eventStore: counter.store });
    projection.load();

    assert.strictEqual(counter.read, 1);
    assert.strictEqual(projection.size, 1);
  });

  test("folds the renames stored after the checkpoint", async() => {
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

    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    const record = projection.catalog.get(new AssetId(created.assetId));
    assert.strictEqual(record.source, "b.png");
    assert.strictEqual(
      record.revision,
      (updated.eventData as { hash: string; }).hash
    );
  });

  test("drops an asset deleted after its newest checkpoint", async() => {
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

    const projection = new CatalogProjection({
      eventStore: harness.eventStore
    });
    projection.load();

    assert.strictEqual(projection.size, 0);
  });
});

describe("CatalogProjection — folding", () => {
  test("folds each created asset in log order", async() => {
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

    const applied = projection.apply(
      assetEvent("counter.incremented", {}, { assetType: "counter" })
    );

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

    const applied = projection.apply(
      assetEvent("asset.created", { path: "a.png" })
    );

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

    const applied = projection.apply(assetEvent(
      "asset.updated",
      {
        path: "b.png",
        kind: "binary",
        hash: "h2"
      },
      { assetId: created.val.assetId }
    ));

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

    const applied = projection.apply(assetEvent(
      "asset.deleted",
      {
        path: "gone.png",
        kind: "binary"
      },
      { assetId: "ghost" }
    ));

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
});
