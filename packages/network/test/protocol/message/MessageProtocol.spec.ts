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
  MessageProtocol,
  NO_MESSAGE_PROTOCOLS,
  withEvent
} from "#src/protocol/message/MessageProtocol.ts";
import {
  InvalidMessageProtocolError
} from "#src/protocol/message/errors/InvalidMessageProtocolError.ts";

// CONSTANTS
const kSetVariant = z.object({
  action: z.literal("voxel-set"),
  x: z.number()
});
const kRemovedVariant = z.object({
  action: z.literal("voxel-removed")
});

describe("MessageProtocol", () => {
  test("names each union variant after its \"action\" literal by default", () => {
    const protocol = new MessageProtocol(z.union([
      kSetVariant,
      kRemovedVariant
    ]));

    assert.deepEqual(protocol.events, ["voxel-set", "voxel-removed"]);
    assert.deepEqual(
      protocol.variants.map((variant) => variant.schema),
      [kSetVariant, kRemovedVariant]
    );
  });

  test("reads discriminated union variants", () => {
    const protocol = new MessageProtocol(z.discriminatedUnion("action", [
      kSetVariant,
      kRemovedVariant
    ]));

    assert.deepEqual(protocol.events, ["voxel-set", "voxel-removed"]);
  });

  test("treats a lone schema as a single variant", () => {
    const protocol = new MessageProtocol(kRemovedVariant);

    assert.deepEqual(protocol.events, ["voxel-removed"]);
  });

  test("honours an explicit discriminator", () => {
    const protocol = new MessageProtocol(
      z.object({
        type: z.literal("ping")
      }),
      {
        discriminator: "type"
      }
    );

    assert.deepEqual(protocol.events, ["ping"]);
  });

  test("prefers a withEvent() name over the discriminator literal", () => {
    const protocol = new MessageProtocol(z.union([
      withEvent(z.object({
        action: z.literal("voxel-removed")
      }), "$removed")
    ]));

    assert.deepEqual(protocol.events, ["$removed"]);
  });

  test("tags a nested union with the literal its options share", () => {
    const protocol = new MessageProtocol(z.union([
      kRemovedVariant,
      z.union([
        z.object({ action: z.literal("applied"), command: z.literal("create") }),
        z.object({ action: z.literal("applied"), command: z.literal("delete") })
      ])
    ]));

    assert.deepEqual(
      protocol.variants.map(({ event, tag }) => [event, tag]),
      [["voxel-removed", "voxel-removed"], ["applied", "applied"]]
    );
  });

  test("declares no event when it accepts no message", () => {
    assert.deepEqual(MessageProtocol.EMPTY.events, []);
    assert.strictEqual(NO_MESSAGE_PROTOCOLS.inbound, MessageProtocol.EMPTY);
    assert.strictEqual(NO_MESSAGE_PROTOCOLS.outbound, MessageProtocol.EMPTY);
  });

  test("rejects a variant that names no event", () => {
    assert.throws(
      () => new MessageProtocol(z.union([z.object({ x: z.number() })])),
      InvalidMessageProtocolError
    );
  });

  test("rejects a variant whose discriminator is optional", () => {
    assert.throws(
      () => new MessageProtocol(z.union([
        z.object({ action: z.optional(z.literal("voxel-set")) })
      ])),
      InvalidMessageProtocolError
    );
  });
});
