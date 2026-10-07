// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  ArgDef,
  ConsoleScalar
} from "#src/index.ts";
import {
  coerce,
  coerceBoolean,
  coerceList,
  coerceNumber,
  formatValue
} from "#src/input/coerce.ts";
import { InvalidValueError } from "#src/input/errors/InvalidValueError.ts";

type ScalarType = "string" | "number" | "boolean";

// CONSTANTS
const kItemCoercers: Record<ScalarType, (item: string) => ConsoleScalar> = {
  string: (item) => item,
  number: coerceNumber,
  boolean: coerceBoolean
};

function list(
  literal: string,
  items: ScalarType
): ConsoleScalar[] {
  return coerceList(literal, kItemCoercers[items]);
}

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

describe("coerce a list", () => {
  const accepted: [string, ScalarType, unknown[]][] = [
    ["Mod+y Mod+Shift+z", "string", ["Mod+y", "Mod+Shift+z"]],
    ["  a   b  ", "string", ["a", "b"]],
    ["\"two words\" a,b", "string", ["two words", "a,b"]],
    ["\"say \\\"hi\\\"\"", "string", ["say \"hi\""]],
    ["", "string", []],
    ["\"\"", "string", []],
    ["1 -2.5 1e3", "number", [1, -2.5, 1000]],
    ["yes off 1", "boolean", [true, false, true]]
  ];
  for (const [literal, items, expected] of accepted) {
    test(`${items}[] accepts ${JSON.stringify(literal)}`, () => {
      assert.deepEqual(list(literal, items), expected);
    });
  }

  const rejected: [string, ScalarType, string][] = [
    ["a \"\"", "string", "Expected a list without empty items, got \"a \"\"\""],
    ["a \"b", "string", "Expected a closing quote, got \"a \"b\""],
    ["1 two", "number", "Expected a number, got \"two\""],
    ["true maybe", "boolean", "Expected a boolean (true, false, yes, no, on, off, 1, 0), got \"maybe\""]
  ];
  for (const [literal, items, message] of rejected) {
    test(`${items}[] rejects ${JSON.stringify(literal)}`, () => {
      assert.throws(() => list(literal, items), {
        name: "InvalidValueError",
        message
      });
    });
  }

  test("formatValue writes a literal that reads back to the same list", () => {
    const values: [ConsoleScalar[], ScalarType][] = [
      [["Mod+y", "Mod+Shift+z"], "string"],
      [["two words", "say \"hi\"", "back\\slash", "\"lead", "a,b"], "string"],
      [[], "string"],
      [[1, -2.5], "number"],
      [[true, false], "boolean"]
    ];
    for (const [value, items] of values) {
      const literal = formatValue(value);
      assert.deepEqual(list(literal, items), value, literal);
    }
  });
});
