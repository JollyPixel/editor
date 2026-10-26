// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  inferScenePropertyType,
  parseScenePropertyValue
} from "../../../src/components/script/ScenePropertyValue.ts";
import type { JSONValue } from "../../../src/systems/scene/file/SceneFile.ts";

describe("inferScenePropertyType", () => {
  test("names a type that parses the stored value back", () => {
    const values: [JSONValue, string][] = [
      [2, "number"],
      [true, "boolean"],
      ["hello", "string"],
      ["#ff8800", "Color"],
      [[0, 1], "Vector2"],
      [[0, 1, 0], "Vector3"],
      [[1, 2, 3, 4], "Vector4"],
      [[1, 2, 3, 4, 5], "number[]"],
      [[], "number[]"],
      [["a", "b"], "string[]"],
      [[true, false], "boolean[]"]
    ];

    for (const [value, expected] of values) {
      const type = inferScenePropertyType(value);

      assert.strictEqual(type, expected);
      assert.notStrictEqual(parseScenePropertyValue(type!, value), undefined);
    }
  });

  test("names no type for a value no property type parses", () => {
    assert.strictEqual(inferScenePropertyType(null), null);
    assert.strictEqual(inferScenePropertyType([1, "a"]), null);
    assert.strictEqual(inferScenePropertyType({ x: 1 }), null);
  });
});
