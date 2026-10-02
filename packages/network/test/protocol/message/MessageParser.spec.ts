// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MessageParser } from "#src/protocol/message/MessageParser.ts";
import { MessageProtocol } from "#src/protocol/message/MessageProtocol.ts";

// CONSTANTS
const kCommandProtocol = new MessageProtocol({
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
});

describe("MessageParser", () => {
  test("of() compiles one parser per protocol", () => {
    const parser = MessageParser.of(kCommandProtocol);

    assert.strictEqual(MessageParser.of(kCommandProtocol), parser);
    assert.notStrictEqual(
      MessageParser.of(new MessageProtocol(kCommandProtocol.schema)),
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

  test("accepts nothing when the protocol declares no message", () => {
    const parser = new MessageParser(MessageProtocol.EMPTY);

    assert.strictEqual(parser.parse({ action: "voxel-set" }).ok, false);
    assert.strictEqual(parser.parse({}).ok, false);
  });
});
