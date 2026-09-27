// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MessageProtocol,
  NO_MESSAGE_PROTOCOLS
} from "#src/protocol/message/MessageProtocol.ts";
import {
  InvalidMessageProtocolError
} from "#src/protocol/message/errors/InvalidMessageProtocolError.ts";

// CONSTANTS
const kSetVariant = {
  type: "object",
  properties: {
    action: { const: "voxel-set" },
    x: { type: "number" }
  },
  required: [
    "action",
    "x"
  ]
} as const;
const kRemovedVariant = {
  type: "object",
  properties: {
    action: { const: "voxel-removed" }
  },
  required: ["action"]
} as const;

describe("MessageProtocol", () => {
  test("names each oneOf variant after its \"action\" constant by default", () => {
    const protocol = new MessageProtocol({
      oneOf: [
        kSetVariant,
        kRemovedVariant
      ]
    });

    assert.deepEqual(protocol.events, ["voxel-set", "voxel-removed"]);
    assert.deepEqual(
      protocol.variants.map((variant) => variant.schema),
      [kSetVariant, kRemovedVariant]
    );
  });

  test("reads anyOf variants", () => {
    const protocol = new MessageProtocol({
      anyOf: [
        kSetVariant,
        kRemovedVariant
      ]
    });

    assert.deepEqual(protocol.events, ["voxel-set", "voxel-removed"]);
  });

  test("treats a lone schema as a single variant", () => {
    const protocol = new MessageProtocol(kRemovedVariant);

    assert.deepEqual(protocol.events, ["voxel-removed"]);
  });

  test("honours an explicit discriminator", () => {
    const protocol = new MessageProtocol(
      {
        type: "object",
        properties: {
          type: { const: "ping" }
        },
        required: ["type"]
      },
      {
        discriminator: "type"
      }
    );

    assert.deepEqual(protocol.events, ["ping"]);
  });

  test("prefers an explicit title over the discriminator constant", () => {
    const protocol = new MessageProtocol({
      oneOf: [
        {
          ...kRemovedVariant,
          title: "$removed"
        }
      ]
    });

    assert.deepEqual(protocol.events, ["$removed"]);
  });

  test("declares no event when it accepts no message", () => {
    assert.deepEqual(MessageProtocol.EMPTY.events, []);
    assert.strictEqual(NO_MESSAGE_PROTOCOLS.inbound, MessageProtocol.EMPTY);
    assert.strictEqual(NO_MESSAGE_PROTOCOLS.outbound, MessageProtocol.EMPTY);
  });

  test("rejects a variant that names no event", () => {
    assert.throws(
      () => new MessageProtocol({ oneOf: [{ type: "object" }] }),
      InvalidMessageProtocolError
    );
  });

  test("rejects a variant whose discriminator is optional", () => {
    assert.throws(
      () => new MessageProtocol({
        oneOf: [
          {
            type: "object",
            properties: { action: { const: "voxel-set" } }
          }
        ]
      }),
      InvalidMessageProtocolError
    );
  });
});
