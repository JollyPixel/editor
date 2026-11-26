// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";
import { AssetRoom } from "@jolly-pixel/asset";
import type { RightsMap } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetRelay } from "#src/index.ts";
import {
  liveTileHandler,
  relayCounterHandler
} from "../helpers/kinds.ts";
import type { RecordingClient } from "../helpers/rooms.ts";
import { roomHarness } from "../helpers/live/roomHarness.ts";

// CONSTANTS
const kNudge = z.object({
  action: z.literal("nudge"),
  to: z.string()
});
const kPoke = z.object({
  action: z.literal("poke"),
  to: z.string()
});
const kNudged = z.object({
  type: z.literal("nudged"),
  from: z.string()
});
const kNudgeRelay: AssetRelay<{ to: string; }> = {
  receive: (clientId, { to }, room) => room.sendTo(to, {
    type: "nudged",
    from: clientId
  })
};

describe("registerAssetRooms — readers", () => {
  test("a reader may send a relay query but no other relay message", async() => {
    await using harness = await roomHarness({
      handler: relayCounterHandler(
        {
          inbound: [kNudge, kPoke],
          outbound: [kNudged],
          queries: ["nudge"]
        },
        kNudgeRelay
      ),
      rights: readerRights("counter")
    });
    await harness.join("A");
    await harness.join("B");

    await harness.send("A", { action: "nudge", to: "B" });
    await harness.send("A", { action: "poke", to: "B" });

    const nudges = harness.clients.get("B")!.received
      .map((envelope) => (envelope as { payload?: { type?: string; }; }).payload)
      .filter((payload) => payload?.type === "nudged");
    assert.deepEqual(nudges, [{ type: "nudged", from: "A" }]);
    assert.deepEqual(deniedEvents(harness.clients.get("A")!), ["poke"]);
  });

  test("a relay query naming no relay message fails registration", async() => {
    await assert.rejects(
      roomHarness({
        handler: relayCounterHandler(
          {
            inbound: [kNudge],
            outbound: [kNudged],
            queries: ["nudged"]
          },
          kNudgeRelay
        )
      }),
      {
        name: "TypeError",
        message: /relay query "nudged" names no inbound relay message/
      }
    );
  });

  test("a reader subscribes to parts", async() => {
    await using harness = await roomHarness({
      extraHandlers: [liveTileHandler()],
      asset: {
        kind: "tiles",
        path: "a.tiles"
      },
      rights: readerRights("tiles")
    });
    const connection = await harness.join("A");

    await connection.receive({
      room: new AssetRoom("tiles", harness.assetId).toString(),
      kind: "message",
      payload: { action: "subscribe-parts", parts: ["a"] }
    });

    const client = harness.clients.get("A")!;
    assert.deepEqual(deniedEvents(client), []);
    assert.ok(client.received.some(
      (envelope) => (envelope as { payload?: { type?: string; }; }).payload?.type === "parts"
    ));
  });
});

function readerRights(
  kind: string
): RightsMap {
  return {
    default: {
      [`${kind}.$join`]: "write",
      [`${kind}.$presence`]: "write",
      [`${kind}.*`]: "read"
    }
  };
}

function deniedEvents(
  client: RecordingClient
): string[] {
  return client.received
    .filter((envelope) => (envelope as { kind: string; }).kind === "denied")
    .map((envelope) => (envelope as { event: string; }).event);
}
