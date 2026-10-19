// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetKindHandler } from "#src/index.ts";
import {
  liveCounterHandler,
  COUNTER_INCREMENTED,
  type CounterState
} from "../helpers/kinds.ts";
import {
  ROOM_ACTOR,
  roomHarness
} from "../helpers/rooms/roomHarness.ts";

function restoringCounterHandler(
  restored: Array<[unknown, number]>
): AssetKindHandler<CounterState> {
  const inner = liveCounterHandler({ delay: 0, maxDelay: 0 });
  const commands = inner.commands!;

  return {
    ...inner,
    commands: {
      ...commands,
      live: (binding) => {
        return {
          ...commands.live!(binding),
          restore: (command, version) => restored.push([command, version])
        };
      }
    }
  };
}

describe("registerAssetRooms — tag rooms", () => {
  test("a tag room serves the tagged version and refuses its commands", async() => {
    await using harness = await roomHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: ROOM_ACTOR
    })).unwrap();
    await harness.join("A");
    await harness.send("A", { action: "increment" });
    const room = new AssetRoom("counter", harness.assetId, "v1").toString();
    const eventCount = harness.sync.eventStore.reader.list(harness.assetId).length;

    const connection = await harness.join("B", room);
    await connection.receive({
      room,
      kind: "message",
      payload: { action: "increment" }
    });

    const [sync, snapshot, denied] = harness.clients.get("B")!.received;
    assert.deepEqual(
      (sync as { rights: Record<string, string>; }).rights.increment,
      "read"
    );
    assert.deepEqual(snapshot, {
      room,
      kind: "message",
      payload: {
        type: "snapshot",
        data: { value: 0 },
        version: 1
      }
    });
    assert.strictEqual((denied as { kind: string; }).kind, "denied");
    assert.strictEqual(
      harness.sync.eventStore.reader.list(harness.assetId).length,
      eventCount
    );
  });

  test("an unknown tag is refused", async() => {
    await using harness = await roomHarness();

    await harness.join(
      "A",
      new AssetRoom("counter", harness.assetId, "ghost").toString()
    );

    assert.deepEqual(harness.refusals, ["unknown tag"]);
  });
});

describe("registerAssetRooms — restore", () => {
  test("a cold room restores its arbiter from the replayed commands", async() => {
    const restored: Array<[unknown, number]> = [];
    await using harness = await roomHarness({
      handler: restoringCounterHandler(restored)
    });
    const versions = [1, 2].map(() => harness.sync.eventStore.writer.append({
      assetType: "counter",
      assetId: harness.assetId,
      eventType: COUNTER_INCREMENTED,
      eventData: { action: "increment" },
      actor: ROOM_ACTOR
    }).unwrap().eventVersion);

    await harness.join("alice");

    assert.deepEqual(restored, versions.map((version) => [
      { action: "increment" },
      version
    ]));
  });
});
