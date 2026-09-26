// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MessageParser,
  defineMessageProtocol,
  type JSONSchema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import * as server from "#src/network/server.ts";
import {
  uvLayoutSchema,
  uvRegionSchema
} from "#src/network/UVLayout.schema.ts";

// CONSTANTS
const kRect = { x: 0, y: 0, width: 8, height: 8 };

function accepts(
  schema: JSONSchema,
  payload: unknown
): boolean {
  const protocol = defineMessageProtocol({
    schema: {
      oneOf: [
        {
          type: "object",
          properties: {
            action: { const: "check" },
            value: schema
          },
          required: ["action", "value"]
        }
      ]
    }
  });

  return new MessageParser(protocol).parse({
    action: "check",
    value: payload
  }).ok;
}

describe("network/UVLayout.schema", () => {
  test("a layout accepts every region state without identity", () => {
    assert.equal(accepts(uvLayoutSchema, {
      state: "stacked",
      rect: kRect
    }), true);
    assert.equal(accepts(uvLayoutSchema, {
      state: "unfolded",
      faces: { front: kRect },
      activeFaces: ["front"]
    }), true);
    assert.equal(accepts(uvLayoutSchema, {
      state: "free",
      faces: { top: kRect }
    }), true);
  });

  test("a layout rejects unknown states and missing geometry", () => {
    assert.equal(accepts(uvLayoutSchema, {
      state: "folded",
      rect: kRect
    }), false);
    assert.equal(accepts(uvLayoutSchema, {
      state: "unfolded"
    }), false);
    assert.equal(accepts(uvLayoutSchema, {
      state: "stacked"
    }), false);
  });

  test("a region is a layout with an id and a color", () => {
    const layout = {
      state: "stacked",
      rect: kRect
    };

    assert.equal(accepts(uvRegionSchema, layout), false);
    assert.equal(accepts(uvRegionSchema, {
      ...layout,
      id: "a",
      color: "#fff",
      name: "A"
    }), true);
  });

  test("the server entry point exports the layout schema", () => {
    assert.equal(server.uvLayoutSchema, uvLayoutSchema);
  });
});
