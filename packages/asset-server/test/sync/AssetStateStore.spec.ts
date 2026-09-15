// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetStateStore,
  type AssetKindHandler
} from "#src/index.ts";
import {
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED,
  type CounterCommand,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes, text } from "../helpers/bytes.ts";
import { recordingLogger } from "../helpers/logger.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function recordingCounterHandler(): {
  handler: AssetKindHandler<CounterState, CounterCommand>;
  folded: string[];
} {
  const inner = counterHandler();
  const commands = inner.commands!;
  const folded: string[] = [];

  return {
    folded,
    handler: {
      ...inner,
      load(state, content) {
        folded.push("load");
        inner.load(state, content);
      },
      commands: {
        ...commands,
        apply(state, command) {
          folded.push(COUNTER_INCREMENTED);
          commands.apply(state, command);
        }
      }
    }
  };
}

async function counterAsset(
  harness: SyncHarness
): Promise<string> {
  const created = (await harness.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: kActor
  })).unwrap();
  await harness.projector.flush();

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

describe("AssetStateStore — checkpointed replay", () => {
  test("resumes at the newest asset.updated instead of the head", async() => {
    const { handler, folded } = recordingCounterHandler();
    await using harness = await syncHarness({
      handlers: [handler],
      snapshot: { delay: 0, maxDelay: 0 }
    });
    const assetId = await counterAsset(harness);

    await harness.states.acquire(assetId, "counter");
    increment(harness, assetId);
    increment(harness, assetId);
    increment(harness, assetId);
    await harness.scheduler.flush();
    increment(harness, assetId);
    harness.states.release(assetId);

    folded.length = 0;
    const entry = await harness.states.acquire(assetId, "counter");

    assert.deepEqual(folded, ["load", COUNTER_INCREMENTED]);
    assert.strictEqual((entry.state as CounterState).value, 4);
  });

  test("folds the whole stream when it holds no checkpoint yet", async() => {
    const { handler, folded } = recordingCounterHandler();
    await using harness = await syncHarness({ handlers: [handler] });
    const assetId = "loose-asset";

    increment(harness, assetId);
    increment(harness, assetId);

    const entry = await harness.states.acquire(assetId, "counter");

    assert.deepEqual(folded, [COUNTER_INCREMENTED, COUNTER_INCREMENTED]);
    assert.strictEqual((entry.state as CounterState).value, 2);
  });

  test("resumes at asset.created when it is the only checkpoint", async() => {
    const { handler, folded } = recordingCounterHandler();
    await using harness = await syncHarness({ handlers: [handler] });
    const assetId = await counterAsset(harness);

    increment(harness, assetId);

    folded.length = 0;
    const entry = await harness.states.acquire(assetId, "counter");

    assert.deepEqual(folded, ["load", COUNTER_INCREMENTED]);
    assert.strictEqual((entry.state as CounterState).value, 1);
  });

  test("serialize() replays through the same checkpoint for a cold asset", async() => {
    const { handler, folded } = recordingCounterHandler();
    await using harness = await syncHarness({
      handlers: [handler],
      snapshot: { delay: 0, maxDelay: 0 }
    });
    const assetId = await counterAsset(harness);

    await harness.states.acquire(assetId, "counter");
    increment(harness, assetId);
    await harness.scheduler.flush();
    harness.states.release(assetId);

    folded.length = 0;
    const data = await harness.states.serialize(assetId, "counter");

    assert.deepEqual(folded, ["load"]);
    assert.strictEqual(text(data), "1");
  });
});

describe("AssetStateStore — replay concurrency", () => {
  test("yields during a long replay so other work interleaves", async() => {
    const { handler } = recordingCounterHandler();
    await using harness = await syncHarness({ handlers: [handler] });
    const assetId = "long-asset";

    for (let index = 0; index < 600; index++) {
      increment(harness, assetId);
    }

    let interleaved = false;
    setImmediate(() => {
      interleaved = true;
    });
    const entry = await harness.states.acquire(assetId, "counter");

    assert.strictEqual(interleaved, true);
    assert.strictEqual((entry.state as CounterState).value, 600);
  });

  test("concurrent callers share one replay", async() => {
    const { handler, folded } = recordingCounterHandler();
    await using harness = await syncHarness({ handlers: [handler] });
    const assetId = "shared-asset";

    for (let index = 0; index < 300; index++) {
      increment(harness, assetId);
    }

    const [first, second] = await Promise.all([
      harness.states.acquire(assetId, "counter"),
      harness.states.acquire(assetId, "counter")
    ]);

    assert.strictEqual(first, second);
    assert.strictEqual(folded.length, 300);
    assert.strictEqual((first.state as CounterState).value, 300);
  });

  test("folds events appended while the replay was yielding", async() => {
    const { handler } = recordingCounterHandler();
    await using harness = await syncHarness({ handlers: [handler] });
    const assetId = "growing-asset";

    for (let index = 0; index < 300; index++) {
      increment(harness, assetId);
    }

    const acquired = harness.states.acquire(assetId, "counter");
    increment(harness, assetId);
    const entry = await acquired;

    assert.strictEqual((entry.state as CounterState).value, 301);
  });
});

describe("AssetStateStore — fault isolation", () => {
  function throwingCounterHandler(): AssetKindHandler<CounterState, CounterCommand> {
    const inner = counterHandler();

    return {
      ...inner,
      commands: {
        ...inner.commands!,
        apply() {
          throw new Error("corrupt command");
        }
      }
    };
  }

  test("a throwing replay fold is logged and keeps the last good state", async() => {
    using eventStore = EventStore.persistence.memory();
    const { logger, records } = recordingLogger();
    const states = new AssetStateStore({
      eventStore,
      kinds: new AssetKindRegistry([throwingCounterHandler()]),
      logger
    });

    eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: COUNTER_INCREMENTED,
      eventData: { action: "increment" },
      actor: kActor
    }).unwrap();

    const entry = await states.acquire("a1", "counter");

    assert.strictEqual((entry.state as CounterState).value, 0);
    assert.deepEqual(
      records.map((record) => [record.level, record.message]),
      [["error", "asset event not folded"]]
    );
    assert.strictEqual(records[0].metadata.reason, "corrupt command");
  });

  test("a throwing live fold does not escape the append", async() => {
    using eventStore = EventStore.persistence.memory();
    const { logger, records } = recordingLogger();
    const states = new AssetStateStore({
      eventStore,
      kinds: new AssetKindRegistry([throwingCounterHandler()]),
      logger
    });
    states.start();
    await states.acquire("a1", "counter");

    const appended = eventStore.writer.append({
      assetType: "counter",
      assetId: "a1",
      eventType: COUNTER_INCREMENTED,
      eventData: { action: "increment" },
      actor: kActor
    });
    states.close();

    assert.strictEqual(appended.ok, true);
    assert.strictEqual(records.length, 1);
  });
});
