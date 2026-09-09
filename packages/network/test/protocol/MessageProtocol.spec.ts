// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  defineMessageProtocol,
  discriminatorOf,
  InvalidMessageProtocolError,
  NO_MESSAGES,
  protocolEvents,
  serverMessageProtocol,
  variantsOf
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

describe("discriminatorOf", () => {
  test("defaults to \"action\"", () => {
    assert.strictEqual(discriminatorOf(kCommandProtocol), "action");
  });

  test("honours an explicit discriminator", () => {
    assert.strictEqual(
      discriminatorOf({ schema: {}, discriminator: "type" }),
      "type"
    );
  });
});

describe("variantsOf", () => {
  test("reads oneOf", () => {
    assert.strictEqual(variantsOf(kCommandProtocol.schema).length, 2);
  });

  test("reads anyOf", () => {
    assert.strictEqual(variantsOf({ anyOf: [{}, {}, {}] }).length, 3);
  });

  test("treats a lone schema as a single variant", () => {
    const schema = { type: "object" } as const;

    assert.deepEqual(variantsOf(schema), [schema]);
  });

  test("yields nothing for a protocol that accepts no message", () => {
    assert.deepEqual(variantsOf(NO_MESSAGES.schema), []);
  });
});

describe("protocolEvents", () => {
  test("collects the discriminator constant of every variant", () => {
    assert.deepEqual(
      protocolEvents(kCommandProtocol),
      ["voxel-set", "voxel-removed"]
    );
  });

  test("prefers an explicit title over the discriminator constant", () => {
    assert.deepEqual(
      protocolEvents({
        schema: {
          oneOf: [
            {
              title: "$snapshot",
              type: "object"
            }
          ]
        }
      }),
      ["$snapshot"]
    );
  });

  test("rejects a variant that names no event", () => {
    assert.throws(
      () => protocolEvents({ schema: { oneOf: [{ type: "object" }] } }),
      InvalidMessageProtocolError
    );
  });

  test("rejects a variant whose discriminator is optional", () => {
    assert.throws(
      () => protocolEvents({
        schema: {
          oneOf: [
            {
              type: "object",
              properties: { action: { const: "voxel-set" } }
            }
          ]
        }
      }),
      InvalidMessageProtocolError
    );
  });
});

describe("serverMessageProtocol", () => {
  test("names a snapshot with the reserved event and a command with its action", () => {
    const outbound = serverMessageProtocol({
      command: kCommandProtocol,
      snapshot: { type: "object" }
    });

    assert.strictEqual(discriminatorOf(outbound), "type");
    assert.deepEqual(
      protocolEvents(outbound),
      [
        SNAPSHOT_EVENT,
        "voxel-set",
        "voxel-removed"
      ]
    );
  });
});
