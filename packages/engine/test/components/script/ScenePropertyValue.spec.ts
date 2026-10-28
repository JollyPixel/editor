// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import {
  inferScenePropertyType,
  parseScenePropertyValue,
  serializeScenePropertyValue,
  type ScenePropertyType
} from "../../../src/components/script/ScenePropertyValue.ts";
import type { JSONValue } from "../../../src/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

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

describe("serializeScenePropertyValue", () => {
  test("writes back the stored value of every parsed property", () => {
    const values: [ScenePropertyType, JSONValue][] = [
      ["number", 2],
      ["string", "hello"],
      ["boolean", true],
      ["Vector2", [0, 1]],
      ["Vector3", [0, 1, 0]],
      ["Vector4", [1, 2, 3, 4]],
      ["Color", "#ff8800"],
      ["number[]", [1, 2]],
      ["string[]", ["a"]],
      ["boolean[]", [false]]
    ];

    for (const [type, value] of values) {
      const parsed = parseScenePropertyValue(type, value);

      assert.deepEqual(serializeScenePropertyValue(type, parsed), value);
    }
  });

  test("writes nothing for a value of another type", () => {
    assert.strictEqual(serializeScenePropertyValue("Vector3", [0, 1, 0]), undefined);
    assert.strictEqual(serializeScenePropertyValue("number", "2"), undefined);
  });

  test("writes an actor reference as its persistent id, null once destroyed", () => {
    const { world } = createSceneSetup();
    const door = new Actor(world as any, { name: "door", persistentId: "door-1" });

    assert.strictEqual(serializeScenePropertyValue("Actor", door), "door-1");
    assert.strictEqual(parseScenePropertyValue("Actor", "door-1"), "door-1");

    door.destroy();

    assert.strictEqual(serializeScenePropertyValue("Actor", door), null);
  });
});
