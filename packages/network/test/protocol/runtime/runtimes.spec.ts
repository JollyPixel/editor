// Import Node.js Dependencies
import {
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import * as browser from "#src/protocol/runtime/browser.ts";
import * as node from "#src/protocol/runtime/node.ts";
import {
  dependentRequired,
  describeErrors,
  minProperties,
  notMultipleOf,
  requiredAnyOf
} from "#src/protocol/schema.ts";

// CONSTANTS
const kSchemas = {
  point: z.object({
    x: z.number(),
    y: z.optional(z.int().check(z.minimum(0)))
  }),
  strict: z.strictObject({
    kind: z.enum(["box", "plane"])
  }),
  nullableName: z.object({
    name: z.nullable(z.string().check(z.minLength(1)))
  }),
  tagged: z.union([
    z.object({ action: z.literal("set"), value: z.number() }),
    z.object({ action: z.literal("clear") })
  ]),
  minProperties: minProperties(
    z.record(z.string().check(z.minLength(1)), z.literal([0, 1, 2, 3])),
    1
  ),
  dependentRequired: dependentRequired(
    z.object({
      from: z.optional(z.string()),
      content: z.optional(z.number())
    }),
    { from: ["content"] }
  ),
  requiredAnyOf: requiredAnyOf(
    z.object({
      src: z.optional(z.string()),
      size: z.optional(z.int()),
      asset: z.optional(z.string())
    }),
    [["src", "size"], ["asset"]]
  ),
  notMultipleOf: notMultipleOf(z.int(), 2)
};
const kValues: unknown[] = [
  null,
  0,
  1,
  2,
  3,
  1.5,
  "x",
  [],
  {},
  { x: 1 },
  { x: 1, y: 2, extra: true },
  { x: 1, y: -1 },
  { x: 1, y: 1.5 },
  { kind: "box" },
  { kind: "box", extra: 1 },
  { kind: "cone" },
  { name: null },
  { name: "" },
  { name: "a" },
  { top: 1 },
  { top: 4 },
  { "": 1 },
  { action: "set", value: 1 },
  { action: "set" },
  { action: "clear", extra: 1 },
  { action: "other" },
  { from: "a" },
  { from: "a", content: 1 },
  { content: 1 },
  { src: "a" },
  { src: "a", size: 1 },
  { asset: "a" },
  { src: "a", asset: "b" }
];

describe("schema runtimes", () => {
  before(async() => {
    new browser.SchemaValidator(z.string()).isValid("x");
    await import("#src/protocol/runtime/compiler.ts");
    await setImmediate();
  });

  for (const [name, schema] of Object.entries(kSchemas)) {
    test(`the compiled browser and Node runtimes agree on "${name}"`, () => {
      const inBrowser = new browser.SchemaValidator(schema);
      const onNode = new node.SchemaValidator(schema);

      for (const value of kValues) {
        assert.strictEqual(
          inBrowser.isValid(value),
          onNode.isValid(value),
          `${name}: ${JSON.stringify(value)}`
        );
      }
    });
  }

  test("the browser runtime points at the failing property", () => {
    const errors = new browser.SchemaValidator(kSchemas.point)
      .errors({ x: "one" });

    assert.match(describeErrors(errors), /^\/x /);
  });

  test("the Node runtime points at the failing property", () => {
    const errors = new node.SchemaValidator(kSchemas.point)
      .errors({ x: "one" });

    assert.match(describeErrors(errors), /^\/x /);
  });
});
