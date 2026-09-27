// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "#src/index.ts";
import { RoomHarness } from "../helpers/RoomHarness.ts";

function decodeTool(
  value: unknown
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function setup(
  harness = new RoomHarness()
) {
  const channel = new PresenceChannel(harness.room, {
    key: "tool",
    decode: decodeTool
  });
  const changes: PresenceChange<string>[] = [];
  channel.on("change", (change) => changes.push(change));

  return {
    harness,
    channel,
    changes
  };
}

describe("PresenceChannel", () => {
  test("replays the peers already in the room", () => {
    const harness = new RoomHarness();
    harness.peerJoined("B", { tool: "brush" });
    harness.peerJoined("C");

    const channel = new PresenceChannel(harness.room, {
      key: "tool",
      decode: decodeTool
    });

    assert.deepEqual([...channel.values], [["B", "brush"]]);
  });

  test("applies patches carrying its key and ignores the others", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B");

    harness.peerPresence("B", { cursor: { x: 1, y: 1 } });
    harness.peerPresence("B", { tool: "fill" });

    assert.deepEqual(changes, [{ clientId: "B", value: "fill" }]);
    assert.strictEqual(channel.values.get("B"), "fill");
  });

  test("an undecodable value removes the peer value", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    harness.peerPresence("B", { tool: null });
    harness.peerPresence("B", { tool: 42 });

    assert.deepEqual(changes, [
      { clientId: "B", value: "brush" },
      { clientId: "B", value: undefined }
    ]);
    assert.strictEqual(channel.values.has("B"), false);
  });

  test("peer-joined reads the join presence", () => {
    const { harness, changes } = setup();

    harness.peerJoined("B", { tool: "line" });

    assert.deepEqual(changes, [{ clientId: "B", value: "line" }]);
  });

  test("peer-left removes the peer value", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    harness.peerLeft("B");

    assert.deepEqual(changes.at(-1), { clientId: "B", value: undefined });
    assert.strictEqual(channel.values.size, 0);
  });

  test("sync replays members and drops peers that are gone", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    harness.admit("self", { C: { tool: "fill" } });

    assert.deepEqual(changes.slice(1), [
      { clientId: "B", value: undefined },
      { clientId: "C", value: "fill" }
    ]);
    assert.deepEqual([...channel.values], [["C", "fill"]]);
  });

  test("sync leaves unchanged values quiet", () => {
    const { harness, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    harness.admit("self", { B: { tool: "brush" } });

    assert.deepEqual(changes, [{ clientId: "B", value: "brush" }]);
  });

  test("leaving the room removes every value", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    harness.room.leave();

    assert.deepEqual(changes.at(-1), { clientId: "B", value: undefined });
    assert.strictEqual(channel.values.size, 0);
  });

  test("publish skips a value equal to the last published one", () => {
    const harness = new RoomHarness();
    harness.room.join();
    const channel = new PresenceChannel(harness.room, {
      key: "cursor",
      decode: (value): { x: number; } | undefined => (
        typeof value === "object" && value !== null && "x" in value && typeof value.x === "number" ?
          { x: value.x } :
          undefined
      ),
      equals: (left, right) => left.x === right.x
    });

    assert.strictEqual(channel.publish({ x: 1 }), true);
    assert.strictEqual(channel.publish({ x: 1 }), false);
    assert.strictEqual(channel.publish({ x: 2 }), true);

    assert.deepEqual(harness.patches, [
      { cursor: { x: 1 } },
      { cursor: { x: 2 } }
    ]);
  });

  test("destroy removes every value and stops listening", () => {
    const { harness, channel, changes } = setup();
    harness.peerJoined("B", { tool: "brush" });

    channel.destroy();
    harness.peerPresence("B", { tool: "fill" });

    assert.deepEqual(changes, [
      { clientId: "B", value: "brush" },
      { clientId: "B", value: undefined }
    ]);
    assert.strictEqual(channel.values.size, 0);
  });

  test("a zod schema decodes values and drops the ones it rejects", () => {
    const harness = new RoomHarness();
    harness.peerJoined("B", { cursor: { x: 1, y: 2, extra: true } });
    harness.peerJoined("C", { cursor: { x: "1", y: 2 } });

    const channel = new PresenceChannel(harness.room, {
      key: "cursor",
      decode: z.object({
        x: z.number(),
        y: z.number()
      })
    });
    const changes: PresenceChange<{ x: number; y: number; }>[] = [];
    channel.on("change", (change) => changes.push(change));

    assert.deepEqual([...channel.values], [["B", { x: 1, y: 2 }]]);

    harness.peerPresence("B", { cursor: null });

    assert.deepEqual(changes, [{ clientId: "B", value: undefined }]);
    assert.strictEqual(channel.values.size, 0);
  });
});
