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
  commandVariant,
  SchemaParser,
  withCommandHeader
} from "#src/index.ts";

describe("commandVariant", () => {
  test("requires its action and its non-optional properties", () => {
    const parser = new SchemaParser(commandVariant("renamed", {
      name: z.string(),
      note: z.optional(z.string())
    }));

    assert.ok(parser.parse({ action: "renamed", name: "a" }).ok);
    assert.ok(parser.parse({ action: "moved", name: "a" }).err);
    assert.ok(parser.parse({ action: "renamed" }).err);
  });
});

describe("withCommandHeader", () => {
  test("adds the header properties and requires them", () => {
    const parser = new SchemaParser(withCommandHeader(
      commandVariant("renamed", { name: z.string() })
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
