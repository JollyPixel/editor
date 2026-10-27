// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  addProperty,
  convertProperty,
  listText,
  parseList,
  removeProperty,
  renameProperty,
  scriptProperties
} from "../../src/components/scriptProperties.ts";

describe("scriptProperties", () => {
  test("shows a value no property type parses as a string", () => {
    const properties = scriptProperties({
      up: [0, 1, 0],
      mixed: [1, "a"]
    });

    assert.deepEqual(
      properties.map(({ key, type }) => [key, type]),
      [
        ["up", "Vector3"],
        ["mixed", "string"]
      ]
    );
  });

  test("converts a value to another type, keeping what carries over", () => {
    assert.deepEqual(convertProperty(5, "Vector3"), [5, 0, 0]);
    assert.deepEqual(convertProperty([1, 2, 3], "Vector2"), [1, 2]);
    assert.strictEqual(convertProperty([7, 8], "number"), 7);
    assert.strictEqual(convertProperty(true, "number"), 1);
    assert.strictEqual(convertProperty(0, "boolean"), false);
    assert.strictEqual(convertProperty("blue", "Color"), "#ffffff");
    assert.deepEqual(convertProperty([1, 2, 3], "number[]"), [1, 2, 3]);
    assert.deepEqual(convertProperty("a, b", "string[]"), ["a", "b"]);
    assert.deepEqual(convertProperty(true, "boolean[]"), [true]);
  });

  test("edits a list as comma-separated text", () => {
    assert.strictEqual(listText(["a", "b"]), "a, b");
    assert.deepEqual(parseList("1, x, 2.5,", "number[]"), [1, 2.5]);
    assert.deepEqual(parseList(" a ,, b ", "string[]"), ["a", "b"]);
    assert.deepEqual(parseList("true, no", "boolean[]"), [true, false]);
  });

  test("renames a key in place and refuses a key that already exists", () => {
    const properties = { speed: 1, jump: 2, name: "a" };

    assert.deepEqual(
      Object.keys(renameProperty(properties, "jump", " height ")),
      ["speed", "height", "name"]
    );
    assert.deepEqual(renameProperty(properties, "jump", "speed"), properties);
  });

  test("removes a property whose key is cleared", () => {
    assert.deepEqual(renameProperty({ a: 1, b: 2 }, "a", "  "), { b: 2 });
    assert.deepEqual(removeProperty({ a: 1, b: 2 }, "a"), { b: 2 });
  });

  test("adds a property under a trimmed key unless it is blank or taken", () => {
    const properties = { speed: 1 };

    assert.deepEqual(addProperty(properties, " up ", [0, 1, 0]), { speed: 1, up: [0, 1, 0] });
    assert.deepEqual(addProperty(properties, "speed", 5), properties);
    assert.deepEqual(addProperty(properties, " ", 5), properties);
  });
});
