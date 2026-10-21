// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { ASSET_CREATED } from "#src/index.ts";
import { syncHarness } from "../../helpers/backend.ts";
import { counterHandler } from "../../helpers/kinds.ts";
import { bytes } from "../../helpers/bytes.ts";

function lifecycleEvents(
  eventStore: EventStore.EventStore
): EventStore.Event[] {
  return eventStore.reader.listAll({ eventTypePrefix: "asset." });
}

describe("Reconciler — cold start", () => {
  test("emits one create per discovered file and persists the asset index", async() => {
    const source = new MemoryAssetSource([
      ["a.png", bytes("one")],
      ["nested/b.counter", bytes("2")]
    ]);
    await using harness = await syncHarness({
      source,
      handlers: [counterHandler()]
    });

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 2);
    assert.deepEqual(
      lifecycleEvents(harness.eventStore).map((event) => event.eventType),
      [ASSET_CREATED, ASSET_CREATED]
    );
    assert.strictEqual(
      harness.assetIndex.byPath("nested/b.counter")?.kind,
      "counter"
    );
    assert.strictEqual(harness.assetIndex.byPath("a.png")?.kind, "binary");
  });

  test("a second pass over the same directory emits nothing", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.deepEqual(report, {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
    assert.strictEqual(lifecycleEvents(harness.eventStore).length, 1);
  });

  test("reuses the ids a valid asset index already carries", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    await source.write(
      ".jollypixel/assets.json",
      bytes(JSON.stringify({
        version: 1,
        assets: [{ id: "kept-id", path: "a.png", kind: "binary" }]
      }))
    );
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();

    assert.strictEqual(
      lifecycleEvents(harness.eventStore)[0].assetId,
      "kept-id"
    );
  });

  test("does not rewrite the files it discovered", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    let writes = 0;
    const original = source.write.bind(source);
    source.write = (path, data) => {
      if (path === "a.png") {
        writes += 1;
      }

      return original(path, data);
    };
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();
    await harness.projector.flush();

    assert.strictEqual(writes, 0);
    assert.strictEqual(harness.projector.pending, 0);
  });
});

describe("Reconciler — concurrent passes", () => {
  test("a pass waits for the one in flight", async() => {
    await using harness = await syncHarness();
    await harness.source.write("a.png", bytes("one"));

    const [first, second] = await Promise.all([
      harness.reconciler.reconcile(),
      harness.reconciler.reconcile()
    ]);

    assert.strictEqual(first.unwrap().created, 1);
    assert.deepEqual(second.unwrap(), {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
  });
});

describe("Reconciler — failures", () => {
  test("an entry that cannot be read is counted, not swallowed", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("readable.png", bytes("one"));
    await source.write("broken.png", bytes("two"));

    const read = source.read.bind(source);
    source.read = (path) => (path === "broken.png" ?
      Promise.reject(new Error("EIO")) :
      read(path));

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 1);
    assert.strictEqual(report.failed, 1);
  });

  test("an unreadable path is never mistaken for a deletion", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("kept.png", bytes("one"));
    await harness.reconciler.reconcile();
    await harness.projector.flush();

    const read = source.read.bind(source);
    source.read = (path) => (path === "kept.png" ?
      Promise.reject(new Error("EIO")) :
      read(path));

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.failed, 1);
    assert.strictEqual(report.deleted, 0);
    assert.deepEqual(
      lifecycleEvents(harness.eventStore).map((event) => event.eventType),
      [ASSET_CREATED]
    );
  });

  test("a failing append is counted instead of reported as success", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("a.png", bytes("one"));

    const append = harness.eventStore.writer.append.bind(
      harness.eventStore.writer
    );
    harness.eventStore.writer.append = (input) => {
      if (input.eventType === ASSET_CREATED) {
        throw new Error("log unavailable");
      }

      return append(input);
    };

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 0);
    assert.strictEqual(report.failed, 1);
  });
});
