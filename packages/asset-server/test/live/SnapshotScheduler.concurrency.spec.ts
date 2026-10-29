// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { AssetKindRegistry, type AssetKindHandler } from "#src/index.ts";
import { AssetStateStore } from "#src/live/AssetStateStore.ts";
import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED,
  type CounterCommand,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes, text } from "../helpers/bytes.ts";

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

async function increment(
  harness: SyncHarness,
  assetId: string
): Promise<void> {
  (await harness.eventStore.writer.append({
    assetType: "counter",
    assetId,
    eventType: COUNTER_INCREMENTED,
    eventData: { action: "increment" },
    actor: kActor
  })).unwrap();
}

interface GatedCounter {
  readonly handler: AssetKindHandler<CounterState, CounterCommand>;
  hold(): {
    serializing: Promise<void>;
    release(): void;
  };
}

function gatedCounter(): GatedCounter {
  const base = counterHandler({ delay: 60_000, maxDelay: 120_000 });
  let gate: {
    started: PromiseWithResolvers<void>;
    released: PromiseWithResolvers<void>;
  } | null = null;

  return {
    handler: {
      ...base,
      async serialize(state) {
        const value = state.value;
        const current = gate;
        gate = null;
        if (current !== null) {
          current.started.resolve();
          await current.released.promise;
        }

        return bytes(String(value));
      }
    },
    hold() {
      gate = {
        started: Promise.withResolvers<void>(),
        released: Promise.withResolvers<void>()
      };
      const { started, released } = gate;

      return {
        serializing: started.promise,
        release: () => released.resolve()
      };
    }
  };
}

describe("SnapshotScheduler — concurrent commands", () => {
  test("a command folded while serializing is not lost", async() => {
    const counter = gatedCounter();
    await using harness = await syncHarness({
      handlers: [counter.handler]
    });
    const assetId = await counterAsset(harness);
    await increment(harness, assetId);
    await increment(harness, assetId);

    const gate = counter.hold();
    const snapshot = harness.scheduler.snapshot(assetId);
    await gate.serializing;
    await increment(harness, assetId);
    gate.release();

    assert.strictEqual(await snapshot, false);
    const live = harness.states.get(assetId)!.state as CounterState;
    assert.strictEqual(live.value, 3);
    assert.strictEqual(harness.scheduler.pending, 1);

    await harness.scheduler.flush();
    assert.strictEqual(text(await harness.source.read("a.counter")), "3");

    const replayed = new AssetStateStore({
      eventStore: harness.eventStore,
      kinds: new AssetKindRegistry([counter.handler])
    });
    const entry = await replayed.acquire(assetId, "counter");
    assert.strictEqual((entry.state as CounterState).value, 3);
  });

  test("flush retries a snapshot a command superseded", async() => {
    const counter = gatedCounter();
    await using harness = await syncHarness({
      handlers: [counter.handler]
    });
    const assetId = await counterAsset(harness);
    await increment(harness, assetId);

    const gate = counter.hold();
    const flushed = harness.scheduler.flush(assetId);
    await gate.serializing;
    await increment(harness, assetId);
    gate.release();
    await flushed;

    assert.strictEqual(harness.scheduler.pending, 0);
    assert.strictEqual(text(await harness.source.read("a.counter")), "2");
  });
});

describe("SnapshotScheduler — compaction", () => {
  test("keeps the whole log without compaction", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()]
    });
    const assetId = await counterAsset(harness);
    await increment(harness, assetId);
    await harness.scheduler.snapshot(assetId);

    assert.strictEqual((await harness.eventStore.reader.list(assetId)).length, 3);
  });

  test("keeps the previous snapshot and the commands since", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()],
      compact: true
    });
    const assetId = await counterAsset(harness);
    await increment(harness, assetId);
    await increment(harness, assetId);
    await harness.scheduler.snapshot(assetId);
    await increment(harness, assetId);
    await harness.scheduler.snapshot(assetId);

    assert.deepEqual(
      (await harness.eventStore.reader.list(assetId)).map(
        (event) => event.eventVersion
      ),
      [4, 5, 6]
    );
  });
});
