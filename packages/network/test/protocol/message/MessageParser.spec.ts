// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { MessageParser } from "#src/protocol/message/MessageParser.ts";
import {
  MessageProtocol,
  withEvent
} from "#src/protocol/message/MessageProtocol.ts";

// CONSTANTS
const kCommandProtocol = new MessageProtocol(z.union([
  z.object({
    action: z.literal("voxel-set"),
    x: z.number()
  }),
  z.object({
    action: z.literal("voxel-removed")
  })
]));

describe("MessageParser", () => {
  test("of() compiles one parser per protocol", () => {
    const parser = MessageParser.fromProtocol(kCommandProtocol);

    assert.strictEqual(MessageParser.fromProtocol(kCommandProtocol), parser);
    assert.notStrictEqual(
      MessageParser.fromProtocol(new MessageProtocol(kCommandProtocol.schema)),
      parser
    );
    assert.strictEqual(parser.parse({ action: "voxel-removed" }).ok, true);
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

    assert.ok(!result.ok);
    assert.ok(result.val.length > 0);
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

  test("rejects a payload matching variants of two different events", () => {
    const parser = new MessageParser(new MessageProtocol(z.union([
      withEvent(z.object({ x: z.number() }), "paint"),
      withEvent(z.object({ y: z.number() }), "erase")
    ])));

    const result = parser.parse({ x: 1, y: 2 });

    assert.ok(!result.ok);
    assert.match(result.val[0].message, /matches both "paint" and "erase"/);
    assert.strictEqual(parser.parse({ x: 1 }).unwrap().event, "paint");
  });

  test("checks variants without a discriminator alongside the tagged ones", () => {
    const parser = new MessageParser(new MessageProtocol(z.union([
      z.object({ action: z.literal("voxel-set") }),
      withEvent(z.object({}), "anything")
    ])));

    assert.ok(!parser.parse({ action: "voxel-set" }).ok);
    assert.strictEqual(parser.parse({ action: "other" }).unwrap().event, "anything");
  });

  test("tells variants sharing a tag apart by a nested literal", () => {
    const parser = new MessageParser(new MessageProtocol(
      z.union(["paint", "erase"].map((action) => withEvent(z.object({
        type: z.literal("command"),
        data: z.object({
          action: z.literal(action),
          x: z.number()
        })
      }), action))),
      { discriminator: "type" }
    ));

    assert.strictEqual(
      parser.parse({ type: "command", data: { action: "erase", x: 1 } }).unwrap().event,
      "erase"
    );
    assert.strictEqual(
      parser.parse({ type: "command", data: { action: "paint", x: 2 } }).unwrap().event,
      "paint"
    );
    for (const data of [{ action: "erase", x: "one" }, { action: "fill", x: 1 }, { x: 1 }]) {
      assert.strictEqual(
        parser.parse({ type: "command", data }).ok,
        false,
        `expected ${JSON.stringify(data)} to be rejected`
      );
    }
  });

  test("accepts nothing when the protocol declares no message", () => {
    const parser = new MessageParser(MessageProtocol.EMPTY);

    assert.strictEqual(parser.parse({ action: "voxel-set" }).ok, false);
    assert.strictEqual(parser.parse({}).ok, false);
  });
});
