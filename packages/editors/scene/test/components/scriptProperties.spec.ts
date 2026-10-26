// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  convertProperty,
  freePropertyKey,
  removeProperty,
  renameProperty,
  scriptProperties
} from "../../src/components/scriptProperties.ts";

describe("scriptProperties", () => {
  test("types a stored value the way the engine converts it", () => {
    const properties = scriptProperties({
      speed: 2,
      enabled: true,
      title: "hello",
      tint: "#ff8800",
      up: [0, 1, 0],
      quaternion: [1, 2, 3, 4],
      samples: [1, 2, 3, 4, 5]
    });

    assert.deepEqual(
      properties.map(({ key, type }) => [key, type]),
      [
        ["speed", "number"],
        ["enabled", "boolean"],
        ["title", "string"],
        ["tint", "color"],
        ["up", "vector3"],
        ["quaternion", "vector4"],
        ["samples", "string"]
      ]
    );
  });

  test("converts a value to another type, keeping what carries over", () => {
    assert.deepEqual(convertProperty(5, "vector3"), [5, 0, 0]);
    assert.deepEqual(convertProperty([1, 2, 3], "vector2"), [1, 2]);
    assert.strictEqual(convertProperty([7, 8], "number"), 7);
    assert.strictEqual(convertProperty(true, "number"), 1);
    assert.strictEqual(convertProperty(0, "boolean"), false);
    assert.strictEqual(convertProperty("blue", "color"), "#ffffff");
  });

  test("renames a key in place and refuses a key that already exists", () => {
    const properties = { speed: 1, jump: 2, name: "a" };

    assert.deepEqual(Object.keys(renameProperty(properties, "jump", "height")), ["speed", "height", "name"]);
    assert.deepEqual(renameProperty(properties, "jump", "speed"), properties);
  });

  test("finds a free key and removes one", () => {
    assert.strictEqual(freePropertyKey({ property: 1, property2: 2 }), "property3");
    assert.deepEqual(removeProperty({ a: 1, b: 2 }, "a"), { b: 2 });
  });
});
