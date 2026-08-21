// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
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
  harness.states.acquire(created.assetId, "counter");

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
    eventData: {},
    actor: kActor
  }).unwrap();
}

describe("SnapshotScheduler — cadence", () => {
  test("snapshots after the quiet period", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    assert.strictEqual(harness.scheduler.pending, 1);

    harness.timers.advance(1_000);
    await harness.scheduler.flush();

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
  });

  test("several events inside one quiet period produce one write", async() => {
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
    harness.timers.advance(400);
    increment(harness, assetId);
    harness.timers.advance(400);
    increment(harness, assetId);
    harness.timers.advance(1_000);
    await harness.scheduler.flush();

    assert.strictEqual(writes, 1);
    assert.strictEqual(text(await harness.source.read("a.counter")), "3");
  });

  test("the max delay caps a continuously edited asset", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 1_000, maxDelay: 2_500 }
    });
    const assetId = await counterAsset(harness);

    // Never quiesces: an event every 500ms keeps resetting the debounce.
    for (let index = 0; index < 5; index++) {
      increment(harness, assetId);
      harness.timers.advance(500);
    }
    await harness.scheduler.flush();

    assert.strictEqual(harness.projector.pending, 0);
    assert.notStrictEqual(
      text(await harness.source.read("a.counter")),
      "0"
    );
  });

  test("a zero delay snapshots on the next timer turn", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      snapshot: { delay: 0, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    harness.timers.advance(0);
    await harness.scheduler.flush();

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
  });

  test("a kind can override the default quiet period", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler({ delay: 100 })],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    harness.timers.advance(100);
    await harness.scheduler.flush();

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
  });

  test("a kind can override the default maximum delay", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler({ maxDelay: 200 })],
      snapshot: { delay: 1_000, maxDelay: 10_000 }
    });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);
    harness.timers.advance(200);
    await harness.scheduler.flush();

    assert.strictEqual(text(await harness.source.read("a.counter")), "1");
  });
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
    await counterAsset(harness);

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
});
