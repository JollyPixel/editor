// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  commandVariant,
  SchemaParser,
  withCommandHeader
} from "#src/index.ts";

describe("commandVariant", () => {
  test("requires the action and the required properties only", () => {
    const variant = commandVariant(
      "renamed",
      { name: { type: "string" } },
      { note: { type: "string" } }
    );

    assert.deepStrictEqual(variant, {
      type: "object",
      properties: {
        action: { const: "renamed" },
        name: { type: "string" },
        note: { type: "string" }
      },
      required: ["action", "name"]
    });
  });
});

describe("withCommandHeader", () => {
  test("adds the header properties and requires them", () => {
    const parser = new SchemaParser(withCommandHeader(
      commandVariant("renamed", { name: { type: "string" } })
    ));

    assert.ok(parser.parse({
      action: "renamed",
      name: "a",
      clientId: "c",
      seq: 1,
      timestamp: 1
    }).ok);
    assert.ok(parser.parse({
      action: "renamed",
      name: "a"
    }).err);
  });
});
