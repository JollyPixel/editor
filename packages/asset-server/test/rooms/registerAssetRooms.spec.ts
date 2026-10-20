// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetRelay } from "#src/index.ts";
import {
  failingLiveCounterHandler,
  liveCounterHandler,
  relayCounterHandler,
  COUNTER_INCREMENTED
} from "../helpers/kinds.ts";
import type { RecordingClient } from "../helpers/rooms.ts";
import { roomHarness } from "../helpers/rooms/roomHarness.ts";

describe("registerAssetRooms — admission", () => {
  test("an unregistered kind is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", "voxelmap:whatever");

    assert.deepEqual(harness.refusals, ["unknown kind"]);
    assert.strictEqual(harness.sync.states.has("whatever"), false);
  });

  test("an unknown asset id is refused", async() => {
    await using harness = await roomHarness();

    await harness.join("A", new AssetRoom("counter", "ghost").toString());

    assert.deepEqual(harness.refusals, ["unknown asset"]);
    assert.strictEqual(harness.sync.states.has("ghost"), false);
  });

  test("a kind whose handler builds no extension is refused", async() => {
    await using harness = await roomHarness({ kind: "plain" });

    await harness.join("A");

    assert.deepEqual(harness.refusals, ["kind has no live protocol"]);
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });

  test("a kind exposing a live protocol is hosted by the room extension", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");

    assert.strictEqual(harness.sync.states.has(harness.assetId), true);
    assert.deepEqual(
      harness.clients.get("A")!.received.at(-1),
      {
        room: new AssetRoom("counter", harness.assetId).toString(),
        kind: "message",
        payload: {
          type: "snapshot",
          data: { value: 0 },
          version: 1
        }
      }
    );
  });

  test("a live protocol appends its command event type", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");
    await harness.send("A", { action: "increment" });
    await harness.send("A", { action: "decrement" });

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);

    assert.strictEqual(appended.length, 1);
  });

  test("a payload the command protocol cannot parse never reaches the room", async() => {
    await using harness = await roomHarness({ kind: "live" });

    await harness.join("A");
    for (const payload of [{ action: "decrement" }, { type: "command" }, null]) {
      await harness.send("A", payload);
    }

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);
    const errors = harness.clients.get("A")!.received
      .filter((envelope) => (envelope as { kind: string; }).kind === "error");

    assert.strictEqual(appended.length, 0);
    assert.strictEqual(errors.length, 3);
  });

  test("an asset id belonging to another live kind is refused", async() => {
    await using harness = await roomHarness({
      extraHandlers: [
        {
          ...liveCounterHandler(),
          kind: "gauge",
          extensions: { ".gauge": "text/plain; charset=utf-8" }
        }
      ]
    });

    await harness.join("A", new AssetRoom("gauge", harness.assetId).toString());

    assert.deepEqual(harness.refusals, ["unknown asset"]);
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — live room opening", () => {
  test("a live protocol that fails to open keeps the room closed and releases the state", async() => {
    await using harness = await roomHarness({ handler: failingLiveCounterHandler() });

    await harness.join("A");

    assert.deepEqual(harness.clients.get("A")!.received, []);
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — relay", () => {
  const kNudge = z.object({
    action: z.literal("nudge"),
    to: z.string()
  });
  const kNudged = z.object({
    type: z.literal("nudged"),
    from: z.string()
  });

  const kNudgeSchemas = {
    inbound: [kNudge],
    outbound: [kNudged]
  };

  function nudgeRelay(
    left: string[]
  ): AssetRelay<z.infer<typeof kNudge>> {
    return {
      receive: (clientId, { to }, room) => {
        room.sendTo(to, {
          type: "nudged",
          from: clientId
        });
      },
      leave: (clientId) => left.push(clientId)
    };
  }

  function payloads(
    client: RecordingClient
  ): unknown[] {
    return client.received.map((envelope) => (envelope as { payload?: unknown; }).payload);
  }

  test("a relay message reaches the relay and its reply reaches the peer, outside the event log", async() => {
    await using harness = await roomHarness({ handler: relayCounterHandler(kNudgeSchemas, nudgeRelay([])) });
    await harness.join("A");
    await harness.join("B");
    const before = harness.sync.eventStore.reader.list(harness.assetId).length;

    await harness.send("A", { action: "nudge", to: "B" });
    await harness.send("A", { action: "nudge" });

    assert.deepEqual(payloads(harness.clients.get("B")!).at(-1), {
      type: "nudged",
      from: "A"
    });
    assert.strictEqual(harness.sync.eventStore.reader.list(harness.assetId).length, before);
    assert.strictEqual(
      harness.clients.get("A")!.received
        .filter((envelope) => (envelope as { kind: string; }).kind === "error").length,
      1
    );
  });

  test("commands still go through arbitration next to the relay", async() => {
    await using harness = await roomHarness({ handler: relayCounterHandler(kNudgeSchemas, nudgeRelay([])) });
    await harness.join("A");

    await harness.send("A", { action: "increment" });

    const appended = harness.sync.eventStore.reader
      .list(harness.assetId)
      .filter((event) => event.eventType === COUNTER_INCREMENTED);
    assert.strictEqual(appended.length, 1);
  });

  test("a peer leaving the room leaves the relay", async() => {
    const left: string[] = [];
    await using harness = await roomHarness({
      handler: relayCounterHandler(kNudgeSchemas, nudgeRelay(left))
    });
    const connection = await harness.join("A");
    await harness.join("B");

    await connection.receive({
      room: new AssetRoom("counter", harness.assetId).toString(),
      kind: "leave"
    });

    assert.deepEqual(left, ["A"]);
  });

  test("a relay message sharing a command tag fails registration", async() => {
    await assert.rejects(
      roomHarness({
        handler: relayCounterHandler(
          {
            inbound: [z.object({ action: z.literal("increment"), extra: z.string() })],
            outbound: []
          },
          {
            receive: () => assert.fail("no relay message reaches a room that never opened")
          }
        )
      }),
      {
        name: "TypeError",
        message: /own literal "action", got increment/
      }
    );
  });
});
