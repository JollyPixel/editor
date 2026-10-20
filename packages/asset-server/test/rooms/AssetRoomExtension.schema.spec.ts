// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CATCH_UP_EVENT,
  MessageParser,
  MessageProtocol,
  SNAPSHOT_EVENT,
  withEvent
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { assetRoomOutboundProtocol } from "#src/rooms/AssetRoomExtension.schema.ts";

// CONSTANTS
const kCommandProtocol = new MessageProtocol(z.union([
  z.object({
    action: z.literal("voxel-set")
  }),
  z.object({
    action: z.literal("object-added")
  })
]));

function outboundParser(): MessageParser {
  return new MessageParser(
    assetRoomOutboundProtocol(kCommandProtocol, z.object({}))
  );
}

describe("assetRoomOutboundProtocol", () => {
  test("names a snapshot with the reserved event and a command or correction with its action", () => {
    const protocol = assetRoomOutboundProtocol(kCommandProtocol, z.object({}));

    assert.deepEqual(protocol.events.slice(0, 6), [
      SNAPSHOT_EVENT,
      "voxel-set",
      "object-added",
      "voxel-set",
      "object-added",
      CATCH_UP_EVENT
    ]);
  });

  test("appends the room notices, then relay messages named by withEvent()", () => {
    const protocol = assetRoomOutboundProtocol(
      kCommandProtocol,
      z.object({}),
      [
        withEvent(z.object({
          type: z.literal("nudge")
        }), "$nudge")
      ]
    );

    assert.deepEqual(protocol.events.slice(-3), ["deleted", "rejected", "$nudge"]);
  });

  test("resolves a server message to the inner command's event", () => {
    const parser = outboundParser();

    const snapshot = parser.parse({ type: "snapshot", data: {} });
    assert.ok(snapshot.ok);
    assert.strictEqual(snapshot.val.event, SNAPSHOT_EVENT);

    const command = parser.parse({
      type: "command",
      data: { action: "object-added" }
    });
    assert.ok(command.ok);
    assert.strictEqual(command.val.event, "object-added");

    const correction = parser.parse({
      type: "correction",
      data: { action: "voxel-set" }
    });
    assert.ok(correction.ok);
    assert.strictEqual(correction.val.event, "voxel-set");
  });

  test("declares a non-negative room version and acks", () => {
    const parser = outboundParser();

    assert.ok(parser.parse({ type: "command", data: { action: "voxel-set" }, version: 4 }).ok);
    assert.ok(parser.parse({ type: "snapshot", data: {}, version: 4, acks: { A: 2 } }).ok);
    assert.strictEqual(
      parser.parse({ type: "command", data: { action: "voxel-set" }, version: -1 }).ok,
      false
    );
    assert.strictEqual(
      parser.parse({ type: "snapshot", data: {}, acks: { A: -1 } }).ok,
      false
    );
  });

  test("validates every command of a catch-up", () => {
    const parser = outboundParser();

    const caughtUp = parser.parse({
      type: "catch-up",
      data: [{ action: "voxel-set" }, { action: "object-added" }],
      version: 9,
      acks: { A: 3 }
    });
    assert.ok(caughtUp.ok);
    assert.strictEqual(caughtUp.val.event, CATCH_UP_EVENT);
    assert.strictEqual(
      parser.parse({ type: "catch-up", data: [{ action: "unknown" }], version: 9 }).ok,
      false
    );
  });
});
