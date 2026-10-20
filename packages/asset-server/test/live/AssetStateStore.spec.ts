// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ASSET_UPDATED, type AssetKindHandler } from "#src/index.ts";

import { syncHarness, type SyncHarness } from "../helpers/backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED,
  type CounterCommand,
  type CounterState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

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
): number {
  return harness.eventStore.writer.append({
    assetType: "counter",
    assetId,
    eventType: COUNTER_INCREMENTED,
    eventData: { action: "increment" },
    actor: kActor
  }).unwrap().eventVersion;
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
});

describe("AssetStateStore — commands since checkpoint", () => {
  test("hands the replayed commands over once", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });
    const assetId = await counterAsset(harness);
    const versions = [
      increment(harness, assetId),
      increment(harness, assetId)
    ];

    await harness.states.acquire(assetId, "counter");

    assert.deepEqual(
      harness.states.takeCommandsSinceCheckpoint(assetId),
      versions.map((version) => {
        return {
          command: { action: "increment" },
          version
        };
      })
    );
    assert.deepEqual(harness.states.takeCommandsSinceCheckpoint(assetId), []);
  });

  test("restarts at a checkpoint appended after the replay", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler({ delay: 0, maxDelay: 0 })]
    });
    const assetId = await counterAsset(harness);

    await harness.states.acquire(assetId, "counter");
    increment(harness, assetId);
    await harness.scheduler.flush();
    const version = increment(harness, assetId);

    assert.deepEqual(harness.states.takeCommandsSinceCheckpoint(assetId), [
      {
        command: { action: "increment" },
        version
      }
    ]);
  });

  test("forgets the commands of a released asset", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });
    const assetId = await counterAsset(harness);
    increment(harness, assetId);

    await harness.states.acquire(assetId, "counter");
    harness.states.release(assetId);

    assert.deepEqual(harness.states.takeCommandsSinceCheckpoint(assetId), []);
  });
});

describe("AssetStateStore — replaced content", () => {
  test("announces an update of a held asset once its state holds it", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });
    const assetId = await counterAsset(harness);
    const entry = await harness.states.acquire(assetId, "counter");
    const seen: Array<[string, number]> = [];
    harness.states.on("replaced", (id) => {
      seen.push([id, (entry.state as CounterState).value]);
    });

    (await harness.writer.update({
      assetId,
      data: bytes("7"),
      actor: kActor
    })).unwrap();

    assert.deepEqual(seen, [[assetId, 7]]);
  });

  test("stays quiet for a scheduled snapshot and for commands", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler({ delay: 0, maxDelay: 0 })]
    });
    const assetId = await counterAsset(harness);
    await harness.states.acquire(assetId, "counter");
    const seen: string[] = [];
    harness.states.on("replaced", (id) => seen.push(id));

    increment(harness, assetId);
    await harness.scheduler.flush();

    const last = harness.eventStore.reader.list(assetId).at(-1);
    assert.equal(last?.eventType, ASSET_UPDATED);
    assert.deepEqual(seen, []);
  });

  test("stays quiet for an asset nobody holds", async() => {
    await using harness = await syncHarness({ handlers: [counterHandler()] });
    const assetId = await counterAsset(harness);
    const seen: string[] = [];
    harness.states.on("replaced", (id) => seen.push(id));

    (await harness.writer.update({
      assetId,
      data: bytes("7"),
      actor: kActor
    })).unwrap();

    assert.deepEqual(seen, []);
  });
});
