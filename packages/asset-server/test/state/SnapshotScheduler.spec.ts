// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ASSET_UPDATED } from "#src/index.ts";
import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED
} from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

async function counterAsset(
  harness: SyncHarness
): Promise<string> {
  const created = (await harness.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: kActor
  })).unwrap();
  await harness.projector.flush();
  await harness.states.acquire(created.assetId, "counter");

  return created.assetId;
}

function increment(
  harness: SyncHarness,
  assetId: string
): void {
  harness.eventStore.writer.append({
    assetType: "counter",
    assetId,
    eventType: COUNTER_INCREMENTED,
    eventData: { action: "increment" },
    actor: kActor
  }).unwrap();
}

async function pendingAfter(
  t: TestContext,
  harness: SyncHarness,
  milliseconds: number
): Promise<number> {
  t.mock.timers.tick(milliseconds);
  await setImmediate();

  return harness.scheduler.pending;
}

describe("SnapshotScheduler — cadence", () => {
  test("snapshots after the quiet period", async(t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 999), 1);
    assert.strictEqual(await pendingAfter(t, harness, 1), 0);

    await harness.scheduler.flush();
    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
  });

  test("several events inside one quiet period produce one write", async(t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    let writes = 0;
    const original = harness.source.write.bind(harness.source);
    harness.source.write = (path, data) => {
      if (path === "a.counter") {
        writes += 1;
      }

      return original(path, data);
    };

    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 400), 1);
    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 400), 1);
    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 999), 1);
    assert.strictEqual(await pendingAfter(t, harness, 1), 0);
    await harness.scheduler.flush();

    assert.strictEqual(writes, 1);
    assert.strictEqual(text(await harness.source.read("a.counter")), "3");
  });

  test("the max delay caps a continuously edited asset", async(t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 2_500 }
    });
    const assetId = await counterAsset(harness);

    for (let index = 0; index < 5; index++) {
      increment(harness, assetId);
      assert.strictEqual(await pendingAfter(t, harness, 499), 1);
      await pendingAfter(t, harness, 1);
    }
    assert.strictEqual(harness.scheduler.pending, 0);

    await harness.scheduler.flush();
    assert.strictEqual(text(await harness.source.read("a.counter")), "5");
  });

  test("a zero delay snapshots on the next timer turn", async(t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 0, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    assert.strictEqual(harness.scheduler.pending, 1);
    assert.strictEqual(await pendingAfter(t, harness, 0), 0);
  });

  test("defaults to a 2s quiet period capped at 30s", async(t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    await using harness = await syncHarness({
      handlers: [counterHandler()]
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 1_999), 1);
    assert.strictEqual(await pendingAfter(t, harness, 1), 0);
    await harness.scheduler.flush();

    for (let elapsed = 0; elapsed < 28_500; elapsed += 1_500) {
      increment(harness, assetId);
      assert.strictEqual(await pendingAfter(t, harness, 1_500), 1);
    }
    increment(harness, assetId);
    assert.strictEqual(await pendingAfter(t, harness, 1_499), 1);
    assert.strictEqual(await pendingAfter(t, harness, 1), 0);
  });

  for (const [label, override, quiet] of [
    ["quiet period", { delay: 100 }, 100],
    ["maximum delay", { maxDelay: 200 }, 200]
  ] as const) {
    test(`a kind can override the default ${label}`, async(t) => {
      t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
      await using harness = await syncHarness({
        handlers: [counterHandler(override)],
        snapshot: { delay: 1_000, maxDelay: 10_000 }
      });
      const assetId = await counterAsset(harness);

      increment(harness, assetId);
      assert.strictEqual(await pendingAfter(t, harness, quiet - 1), 1);
      assert.strictEqual(await pendingAfter(t, harness, 1), 0);
    });
  }
});

describe("SnapshotScheduler — triggers", () => {
  test("flush snapshots without waiting for the timer", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 60_000, maxDelay: 120_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    await harness.scheduler.flush(assetId);

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
    assert.strictEqual(harness.scheduler.pending, 0);
  });

  test("close flushes what is still pending", async() => {
    const harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 60_000, maxDelay: 120_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    await harness.scheduler.close();

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
    await harness.projector.close();
    harness.states.close();
    harness.eventStore.close();
  });

  test("lifecycle events do not schedule a snapshot", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    (await harness.writer.rename({
      assetId,
      to: "b.counter",
      actor: kActor
    })).unwrap();

    assert.strictEqual(harness.scheduler.pending, 0);
  });

  test("an asset with no live state is never snapshotted", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const created = (await harness.writer.create({
      path: "b.counter",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    increment(harness, created.assetId);

    assert.strictEqual(harness.scheduler.pending, 0);
    assert.strictEqual(
      await harness.scheduler.snapshot(created.assetId),
      false
    );
  });

  test("an unchanged state appends nothing", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    const before = harness.eventStore.reader.listAll().length;
    assert.strictEqual(await harness.scheduler.snapshot(assetId), false);

    assert.strictEqual(
      harness.eventStore.reader.listAll().length,
      before
    );
  });

  test("records the snapshot as an update by the snapshot actor", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    assert.strictEqual(await harness.scheduler.snapshot(assetId), true);

    const [update] = harness.eventStore.reader.listAll({
      eventTypePrefix: ASSET_UPDATED
    });
    assert.partialDeepStrictEqual(update, {
      assetType: "counter",
      actor: {
        type: "system",
        source: "snapshot"
      },
      eventData: {
        path: "a.counter",
        kind: "counter"
      }
    });
  });
});

describe("SnapshotScheduler browser timers", () => {
  test("tracks snapshots when timers return numbers", async(t) => {
    await using harness = await syncHarness({
      handlers: [counterHandler()]
    });
    const assetId = await counterAsset(harness);
    t.mock.method(globalThis, "setTimeout", () => 1);
    const clear = t.mock.method(globalThis, "clearTimeout", () => void 0);

    increment(harness, assetId);
    assert.equal(harness.scheduler.pending, 1);
    await harness.scheduler.flush();

    assert.equal(harness.scheduler.pending, 0);
    assert.equal(clear.mock.calls[0].arguments[0], 1);
    assert.equal(text(await harness.source.read("a.counter")), "1");
  });
});
