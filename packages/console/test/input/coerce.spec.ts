// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { ArgDef } from "#src/index.ts";
import { coerce } from "#src/input/coerce.ts";
import { InvalidValueError } from "#src/input/errors/InvalidValueError.ts";

type ScalarType = "string" | "number" | "boolean";

function arg(
  type: ScalarType
): ArgDef {
  return {
    name: "value",
    type
  };
}

function enumArg(
  enumValues: readonly string[]
): ArgDef {
  return {
    name: "value",
    type: "enum",
    enumValues
  };
}

describe("coerce", () => {
  const accepted: [string, ScalarType, unknown][] = [
    ["anything goes", "string", "anything goes"],
    ["", "string", ""],
    ["3", "number", 3],
    ["-2.5", "number", -2.5],
    ["1e3", "number", 1000],
    [" 4 ", "number", 4],
    ["true", "boolean", true],
    ["FALSE", "boolean", false],
    ["1", "boolean", true],
    ["0", "boolean", false],
    ["Yes", "boolean", true],
    ["y", "boolean", true],
    [" on ", "boolean", true],
    ["NO", "boolean", false],
    ["n", "boolean", false],
    ["off", "boolean", false]
  ];
  for (const [literal, type, expected] of accepted) {
    test(`${type} accepts ${JSON.stringify(literal)}`, () => {
      assert.equal(coerce(literal, arg(type)), expected);
    });
  }

  const rejected: [string, ScalarType][] = [
    ["", "number"],
    ["  ", "number"],
    ["abc", "number"],
    ["Infinity", "number"],
    ["NaN", "number"],
    ["yep", "boolean"],
    ["", "boolean"],
    ["2", "boolean"]
  ];
  for (const [literal, type] of rejected) {
    test(`${type} rejects ${JSON.stringify(literal)}`, () => {
      assert.throws(() => coerce(literal, arg(type)), InvalidValueError);
    });
  }

  test("enum matches case-insensitively and returns the declared case", () => {
    assert.equal(coerce("rotatey", enumArg(["rotateY", "fixed"])), "rotateY");
  });

  test("enum rejects a value outside enumValues", () => {
    assert.throws(
      () => coerce("spin", enumArg(["rotateY", "fixed"])),
      { message: "Expected one of rotateY, fixed, got \"spin\"" }
    );
  });
});
