// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MessageParser } from "#src/protocol/MessageParser.ts";
import {
  defineMessageProtocol,
  NO_MESSAGES,
  OPAQUE_PROTOCOLS,
  serverMessageProtocol
} from "#src/protocol/MessageProtocol.ts";
import { SNAPSHOT_EVENT } from "#src/protocol/constants.ts";
import { defineSchema } from "#src/protocol/schema.ts";

// CONSTANTS
const kCommandProtocol = defineMessageProtocol({
  schema: defineSchema({
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "voxel-set" },
          x: { type: "number" }
        },
        required: [
          "action",
          "x"
        ]
      },
      {
        type: "object",
        properties: {
          action: { const: "voxel-removed" }
        },
        required: ["action"]
      }
    ]
  })
});

describe("MessageParser", () => {
  test("exposes the events its protocol declares", () => {
    const parser = new MessageParser(kCommandProtocol);

    assert.deepEqual(parser.events, ["voxel-set", "voxel-removed"]);
  });

  test("returns the matching variant's event alongside the message", () => {
    const parser = new MessageParser(kCommandProtocol);
    const result = parser.parse({ action: "voxel-set", x: 3 });

    assert.strictEqual(result.ok, true);
    assert.deepEqual(result.val, {
      event: "voxel-set",
      message: { action: "voxel-set", x: 3 }
    });
  });

  test("rejects a known action carrying the wrong shape", () => {
    const parser = new MessageParser(kCommandProtocol);
    const result = parser.parse({ action: "voxel-set", x: "three" });

    assert.strictEqual(result.ok, false);
    assert.ok((result.val as readonly unknown[]).length > 0);
  });

  test("rejects an unknown action", () => {
    const parser = new MessageParser(kCommandProtocol);

    assert.strictEqual(parser.parse({ action: "voxel-fly" }).ok, false);
  });

  test("rejects a value that is not an object", () => {
    const parser = new MessageParser(kCommandProtocol);

    for (const value of [null, 42, "voxel-set", []]) {
      assert.strictEqual(
        parser.parse(value).ok,
        false,
        `expected ${JSON.stringify(value)} to be rejected`
      );
    }
  });

  test("accepts nothing when the protocol declares no message", () => {
    const parser = new MessageParser(NO_MESSAGES);

    assert.deepEqual(parser.events, []);
    assert.strictEqual(parser.parse({ action: "voxel-set" }).ok, false);
    assert.strictEqual(parser.parse({}).ok, false);
  });

  test("resolves a server message to the inner command's event", () => {
    const parser = new MessageParser(serverMessageProtocol({
      command: kCommandProtocol,
      snapshot: { type: "object" }
    }));

    const snapshot = parser.parse({ type: "snapshot", data: {} });
    assert.strictEqual(snapshot.ok, true);
    assert.strictEqual(snapshot.val.event, SNAPSHOT_EVENT);

    const command = parser.parse({
      type: "command",
      data: { action: "voxel-removed" }
    });
    assert.strictEqual(command.ok, true);
    assert.strictEqual(command.val.event, "voxel-removed");
  });

  describe("fromProtocols", () => {
    test("compiles both sides of a protocol pair", () => {
      const { inbound, outbound } = MessageParser.fromProtocols({
        inbound: kCommandProtocol,
        outbound: NO_MESSAGES
      });

      assert.deepStrictEqual(
        inbound?.events,
        [
          "voxel-set",
          "voxel-removed"
        ]
      );
      assert.deepStrictEqual(outbound?.events, []);
    });

    test("keeps opaque sides null", () => {
      const parsers = MessageParser.fromProtocols(OPAQUE_PROTOCOLS);

      assert.strictEqual(parsers.inbound, null);
      assert.strictEqual(parsers.outbound, null);
    });
  });
});
